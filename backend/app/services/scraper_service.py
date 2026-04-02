"""
Scraper service — supports Shopify's /products.json API first,
then falls back to generic BeautifulSoup HTML scraping.
"""
import json
import logging
import re
from typing import List, Tuple
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from app.models.schemas import Product
from app.utils.helpers import ensure_absolute_url, clean_price, extract_domain

logger = logging.getLogger(__name__)


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


async def scrape_website(url: str) -> Tuple[List[Product], str, str]:
    """
    Returns (products, site_theme_description, site_title).
    Tries Shopify JSON endpoint first, then falls back to HTML.
    """
    base = extract_domain(url)
    logger.info("[Scraper] Starting scrape for %s (base: %s)", url, base)

    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=30) as client:
        # ── 1. Try Shopify /products.json ──
        logger.info("[Scraper] Trying Shopify /products.json endpoint…")
        shopify_products, site_title = await _try_shopify(client, base)
        if shopify_products:
            logger.info("[Scraper] Shopify: found %d products", len(shopify_products))
            theme = await _extract_theme(client, url)
            logger.info("[Scraper] Theme extracted: %s", theme[:80])
            return shopify_products[:20], theme, site_title

        logger.info("[Scraper] Shopify endpoint not available, falling back to HTML scrape…")

        # ── 2. Generic HTML scrape ──
        response = await client.get(url)
        response.raise_for_status()
        html = response.text
        soup = BeautifulSoup(html, "lxml")

        site_title = (soup.find("title") or soup.find("h1") or "").get_text(strip=True)[:80]
        theme = _extract_theme_from_html(soup, url)
        logger.info("[Scraper] Site title: %s | Theme: %s", site_title, theme[:80])

        products = _parse_html_products(soup, base)
        logger.info("[Scraper] HTML parse found %d products", len(products))

        # If still nothing, try /collections/all
        if not products:
            logger.info("[Scraper] No products from homepage, trying /collections/all…")
            products = await _try_collections(client, base)
            logger.info("[Scraper] Collections found %d products", len(products))

        # Enrich product descriptions by visiting individual product pages
        if products:
            logger.info("[Scraper] Enriching %d product(s) with details from their pages…", min(len(products), 20))
            products = await _enrich_product_descriptions(client, products[:20])

        return products[:20], theme, site_title


# ── Shopify JSON ──────────────────────────────────────────────────────────────

async def _try_shopify(client: httpx.AsyncClient, base: str) -> Tuple[List[Product], str]:
    try:
        r = await client.get(f"{base}/products.json?limit=50", timeout=15)
        if r.status_code != 200:
            return [], ""
        data = r.json()
        raw_products = data.get("products", [])
        if not raw_products:
            return [], ""

        # Fetch store currency from /shop.json
        currency_symbol = "$"
        try:
            shop_r = await client.get(f"{base}/shop.json", timeout=10)
            if shop_r.status_code == 200:
                shop_data = shop_r.json().get("shop", {})
                currency_code = shop_data.get("currency", "")
                money_format = shop_data.get("money_format", "")
                # Extract symbol from money_format (e.g. "Rs. {{amount}}" → "Rs. ")
                symbol_match = re.match(r"^([^{]+)", money_format)
                if symbol_match:
                    currency_symbol = symbol_match.group(1).strip() + " "
                elif currency_code:
                    currency_symbol = currency_code + " "
                logger.info("[Scraper] Shopify currency: %s (format: %s)", currency_code, money_format)
        except Exception as e:
            logger.warning("[Scraper] Could not fetch /shop.json: %s", e)

        products: List[Product] = []
        for p in raw_products:
            variants = p.get("variants", [{}])
            price = variants[0].get("price", "0.00") if variants else "0.00"
            images = p.get("images", [])
            image_url = images[0].get("src", "") if images else ""
            handle = p.get("handle", "")
            # Strip HTML tags from body_html for a plain-text description
            raw_desc = p.get("body_html", "") or ""
            description = BeautifulSoup(raw_desc, "lxml").get_text(separator=" ", strip=True)[:400]
            products.append(
                Product(
                    name=p.get("title", "Unnamed Product"),
                    price=f"{currency_symbol}{price}",
                    product_url=f"{base}/products/{handle}",
                    image_url=image_url,
                    description=description,
                )
            )
        return products, ""
    except Exception:
        return [], ""


async def _try_collections(client: httpx.AsyncClient, base: str) -> List[Product]:
    try:
        r = await client.get(f"{base}/collections/all", timeout=15)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, "lxml")
        return _parse_html_products(soup, base)
    except Exception:
        return []


async def _enrich_product_descriptions(
    client: httpx.AsyncClient, products: List[Product]
) -> List[Product]:
    """
    Visit each product's URL to fetch a richer description.
    Skips products that already have a description or whose URL fails.
    """
    enriched = []
    for product in products:
        if product.description or not product.product_url:
            enriched.append(product)
            continue
        try:
            r = await client.get(product.product_url, timeout=15)
            if r.status_code != 200:
                enriched.append(product)
                continue
            soup = BeautifulSoup(r.text, "lxml")

            # Try schema.org first
            desc = ""
            for tag in soup.find_all("script", {"type": "application/ld+json"}):
                try:
                    data = json.loads(tag.string or "")
                    if isinstance(data, dict) and data.get("@type") == "Product":
                        desc = data.get("description", "")
                        if desc:
                            break
                except Exception:
                    continue

            # Fallback: meta description
            if not desc:
                meta = soup.find("meta", {"name": "description"}) or soup.find("meta", {"property": "og:description"})
                if meta:
                    desc = meta.get("content", "")

            # Fallback: first sizeable paragraph in product description div
            if not desc:
                for sel in ["[class*='product-description']", "[class*='product__description']",
                             "[class*='product-details']", ".description"]:
                    el = soup.select_one(sel)
                    if el:
                        desc = el.get_text(separator=" ", strip=True)
                        break

            description = desc.strip()[:400]
            logger.info("[Scraper] Enriched '%s': %d chars of description", product.name, len(description))
            enriched.append(product.model_copy(update={"description": description}))
        except Exception as e:
            logger.warning("[Scraper] Could not enrich '%s': %s", product.name, e)
            enriched.append(product)
    return enriched


# ── HTML Parsing ──────────────────────────────────────────────────────────────

def _parse_html_products(soup: BeautifulSoup, base: str) -> List[Product]:
    products: List[Product] = []

    # Strategy 1 — schema.org Product markup
    for tag in soup.find_all("script", {"type": "application/ld+json"}):
        try:
            data = json.loads(tag.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if item.get("@type") == "Product":
                    name = item.get("name", "")
                    offers = item.get("offers", {})
                    if isinstance(offers, list):
                        offers = offers[0]
                    price = offers.get("price", "")
                    currency = offers.get("priceCurrency", "")
                    price_str = f"{currency}{price}" if price else ""
                    img = item.get("image", "")
                    if isinstance(img, list):
                        img = img[0]
                    url = item.get("url", "")
                    if name and img:
                        products.append(
                            Product(
                                name=name[:120],
                                price=price_str or "See website",
                                product_url=ensure_absolute_url(base, url),
                                image_url=ensure_absolute_url(base, img),
                            )
                        )
        except Exception:
            continue

    if products:
        return products[:20]

    # Strategy 2 — heuristic CSS selector approach
    selectors = [
        ("a.product-item", "img", ".price"),
        ("div.product-card", "img", ".price"),
        ("li.product", "img", ".price"),
        ("div[class*='product']", "img", "[class*='price']"),
    ]
    for container_sel, img_sel, price_sel in selectors:
        containers = soup.select(container_sel)
        for c in containers[:20]:
            img_tag = c.select_one(img_sel)
            price_tag = c.select_one(price_sel)
            link_tag = c.find("a")
            title_tag = c.find(["h2", "h3", "h4", "span"], class_=re.compile("title|name", re.I))

            img_url = ""
            if img_tag:
                img_url = (
                    img_tag.get("data-src")
                    or img_tag.get("data-lazy-src")
                    or img_tag.get("src", "")
                )

            if not img_url:
                continue

            name = (title_tag.get_text(strip=True) if title_tag else c.get_text(strip=True)[:60])
            price = clean_price(price_tag.get_text() if price_tag else "")
            href = ensure_absolute_url(base, link_tag.get("href", "") if link_tag else "")

            products.append(
                Product(
                    name=name or "Product",
                    price=price or "See website",
                    product_url=href or base,
                    image_url=ensure_absolute_url(base, img_url),
                )
            )
        if products:
            break

    return products[:20]


# ── Theme Extraction ──────────────────────────────────────────────────────────

async def _extract_theme(client: httpx.AsyncClient, url: str) -> str:
    try:
        r = await client.get(url, timeout=15)
        soup = BeautifulSoup(r.text, "lxml")
        return _extract_theme_from_html(soup, url)
    except Exception:
        return "modern e-commerce product photography, clean white background, professional lighting"


def _extract_theme_from_html(soup: BeautifulSoup, url: str) -> str:
    """Build a theme description string for Imagen prompt generation."""
    hints: List[str] = []

    # Meta description / keywords
    for meta in soup.find_all("meta"):
        name = (meta.get("name") or "").lower()
        content = meta.get("content", "")
        if name in ("description", "keywords") and content:
            hints.append(content[:200])

    # Title
    title = soup.find("title")
    if title:
        hints.append(title.get_text(strip=True)[:100])

    # Body text snippet
    body = soup.get_text(separator=" ", strip=True)[:500]
    hints.append(body)

    # Collect all unique hex colors from the page
    color_pattern = re.compile(r"#([0-9a-fA-F]{3,6})")
    candidates: list[tuple[tuple[int, int, int], str]] = []  # (rgb, hex)
    seen_hexes: set[str] = set()
    for h in color_pattern.findall(str(soup)):
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) != 6:
            continue
        h = h.lower()
        if h in seen_hexes:
            continue
        seen_hexes.add(h)
        try:
            rgb = (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
        except ValueError:
            continue
        candidates.append((rgb, h))

    # Greedily pick up to 3 maximally contrasting colors
    selected: list[tuple[tuple[int, int, int], str]] = []
    for _ in range(3):
        if not candidates:
            break
        if not selected:
            # Seed with the color farthest from mid-grey (most visually prominent)
            best = max(candidates, key=lambda c: sum((v - 128) ** 2 for v in c[0]))
        else:
            # Pick the color with the greatest minimum distance to already-selected colors
            def _min_dist(c: tuple) -> float:
                return min(
                    sum((c[0][i] - s[0][i]) ** 2 for i in range(3))
                    for s in selected
                )
            best = max(candidates, key=_min_dist)
        selected.append(best)
        candidates.remove(best)

    named_colors = [f"{_evocative_color_name(rgb)} (#{h})" for rgb, h in selected]
    return ", ".join(named_colors) if named_colors else "pure white (#ffffff), soft mist (#f8f8f8)"


# Base color table for nearest-match lookup
_NAMED_COLORS = {
    "black":     (0, 0, 0),       "white":     (255, 255, 255), "red":       (255, 0, 0),
    "green":     (0, 128, 0),     "blue":      (0, 0, 255),     "yellow":    (255, 255, 0),
    "orange":    (255, 165, 0),   "purple":    (128, 0, 128),   "pink":      (255, 192, 203),
    "brown":     (139, 69, 19),   "grey":      (128, 128, 128), "silver":    (192, 192, 192),
    "gold":      (255, 215, 0),   "beige":     (245, 245, 220), "ivory":     (255, 255, 240),
    "cream":     (255, 253, 208), "navy":      (0, 0, 128),     "teal":      (0, 128, 128),
    "coral":     (255, 127, 80),  "maroon":    (128, 0, 0),     "olive":     (128, 128, 0),
    "turquoise": (64, 224, 208),  "lavender":  (230, 230, 250), "indigo":    (75, 0, 130),
    "charcoal":  (54, 69, 79),    "rose gold": (183, 110, 121), "champagne": (247, 231, 206),
}

# Evocative adjectives keyed by base color name
_COLOR_ADJECTIVES = {
    "black":     ["deep onyx", "rich black", "midnight black"],
    "white":     ["pure white", "crisp white", "luminous white"],
    "grey":      ["soft mist", "cool grey", "light ash"],
    "silver":    ["soft silver", "polished silver", "brushed silver"],
    "charcoal":  ["deep charcoal", "dark slate", "graphite"],
    "red":       ["vivid red", "bold crimson", "rich ruby"],
    "orange":    ["vibrant orange", "warm amber", "bold tangerine"],
    "yellow":    ["warm golden yellow", "soft sunshine", "bright citrine"],
    "gold":      ["warm gold", "rich champagne gold", "antique gold"],
    "champagne": ["soft champagne", "warm champagne", "blush champagne"],
    "beige":     ["warm beige", "soft sand", "natural linen"],
    "ivory":     ["delicate ivory", "soft ivory", "warm ivory"],
    "cream":     ["gentle cream", "warm cream", "buttery cream"],
    "brown":     ["rich espresso", "warm walnut", "deep mocha"],
    "maroon":    ["deep burgundy", "rich maroon", "dark merlot"],
    "pink":      ["soft blush", "delicate rose", "pale pink"],
    "rose gold": ["elegant rose gold", "warm rose gold", "blush rose gold"],
    "coral":     ["warm coral", "soft terracotta", "peachy coral"],
    "purple":    ["rich plum", "deep violet", "regal purple"],
    "lavender":  ["soft lavender", "gentle lilac", "muted mauve"],
    "indigo":    ["deep indigo", "rich midnight blue", "bold indigo"],
    "navy":      ["deep navy", "classic navy blue", "rich midnight navy"],
    "blue":      ["bold blue", "vivid cobalt", "clear sapphire"],
    "teal":      ["cool teal", "muted teal", "deep sea teal"],
    "turquoise": ["fresh turquoise", "bright aqua", "vibrant teal"],
    "green":     ["rich forest green", "deep emerald", "natural green"],
    "olive":     ["muted olive", "earthy sage", "natural khaki"],
    "cyan":      ["bright cyan", "fresh aqua", "electric cyan"],
}


def _evocative_color_name(rgb: tuple) -> str:
    """Return a mood-driven color name using lightness and saturation to pick the adjective."""
    import random as _random
    r, g, b = rgb

    # Find nearest base color
    best_name, best_dist = "grey", float("inf")
    for name, (cr, cg, cb) in _NAMED_COLORS.items():
        dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
        if dist < best_dist:
            best_dist = dist
            best_name = name

    # Pick adjective variant based on lightness so similar hues get different descriptors
    adjectives = _COLOR_ADJECTIVES.get(best_name, [best_name])
    lightness = (r + g + b) / 3
    idx = int(lightness / 256 * len(adjectives))
    idx = min(idx, len(adjectives) - 1)
    return adjectives[idx]
