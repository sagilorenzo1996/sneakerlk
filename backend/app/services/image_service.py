"""
Image processing pipeline:
  1. Download product image
  2. Remove background with rembg
  3. Generate thematic background via Gemini Imagen
  4. Composite foreground onto background
  5. Overlay product name + price text
  6. Save and return the file path
"""
import asyncio
import io
import os
import uuid
from pathlib import Path
from typing import Optional, Tuple

import httpx
from PIL import Image, ImageDraw, ImageFont, ImageFilter

from app.services.gemini_service import generate_background_image
from app.models.schemas import Product
from app.utils.helpers import slugify

STATIC_DIR = Path(__file__).parent.parent.parent / "static" / "images"
CANVAS_SIZE = (1080, 1080)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
    )
}


# ── Public Entry Point ────────────────────────────────────────────────────────

async def process_product_image(product: Product, site_theme: str,
                                api_key: Optional[str] = None,
                                image_model: str = "imagen-4.0-generate-001",
                                image_prompt_override: Optional[str] = None,
                                store_description: str = "") -> Tuple[str, str, str]:
    """
    Full pipeline. Returns (static_url_path, filename, actual_image_prompt_used).
    """
    STATIC_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Download product image
    product_img_bytes = await _download_image(product.image_url)
    product_img = Image.open(io.BytesIO(product_img_bytes)).convert("RGBA")

    # 2. Remove background — CPU-intensive, run in thread pool
    fg_img = await asyncio.to_thread(_remove_background, product_img)

    # 3. Generate AI background — blocking network call, run in thread pool
    bg_bytes, image_prompt_used = await asyncio.to_thread(
        generate_background_image, site_theme,
        api_key, image_model, image_prompt_override, store_description,
        product.name, product.price,
    )
    bg_img = Image.open(io.BytesIO(bg_bytes)).convert("RGB")

    # 4. Composite — CPU work, run in thread pool
    final_img = await asyncio.to_thread(_composite, bg_img, fg_img)

    # 5. Save
    filename = f"{slugify(product.name)[:40]}_{uuid.uuid4().hex[:8]}.jpg"
    out_path = STATIC_DIR / filename
    await asyncio.to_thread(
        lambda: final_img.convert("RGB").save(str(out_path), format="JPEG", quality=92)
    )

    return f"/static/images/{filename}", filename, image_prompt_used


async def process_product_image_with_reference(
        product: Product,
        reference_image_path: str,
        store_description: str = "") -> Tuple[str, str, str]:
    """
    Like process_product_image but uses an existing local image as the background
    instead of generating one with AI.  Returns (static_url_path, filename, "reference").
    """
    STATIC_DIR.mkdir(parents=True, exist_ok=True)

    product_img_bytes = await _download_image(product.image_url)
    product_img = Image.open(io.BytesIO(product_img_bytes)).convert("RGBA")

    fg_img = await asyncio.to_thread(_remove_background, product_img)

    bg_img = await asyncio.to_thread(lambda: Image.open(reference_image_path).convert("RGB"))

    final_img = await asyncio.to_thread(_composite, bg_img, fg_img)

    filename = f"{slugify(product.name)[:40]}_{uuid.uuid4().hex[:8]}.jpg"
    out_path = STATIC_DIR / filename
    await asyncio.to_thread(
        lambda: final_img.convert("RGB").save(str(out_path), format="JPEG", quality=92)
    )

    return f"/static/images/{filename}", filename, "reference"


# ── Step Implementations ──────────────────────────────────────────────────────

async def _download_image(url: str) -> bytes:
    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True, timeout=30) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.content


def _remove_background(img: Image.Image) -> Image.Image:
    """Remove background using rembg. Returns RGBA image."""
    try:
        from rembg import remove as rembg_remove
        buf_in = io.BytesIO()
        img.save(buf_in, format="PNG")
        buf_in.seek(0)
        result_bytes = rembg_remove(buf_in.read())
        return Image.open(io.BytesIO(result_bytes)).convert("RGBA")
    except ImportError:
        # rembg not installed — return original with white bg stripped heuristically
        return _simple_bg_remove(img)
    except Exception as e:
        print(f"rembg failed: {e} — using original image")
        return img.convert("RGBA")


def _simple_bg_remove(img: Image.Image) -> Image.Image:
    """
    Naive corner-color flood-fill background removal fallback.
    Only works on simple solid backgrounds.
    """
    img = img.convert("RGBA")
    data = img.load()
    width, height = img.size
    # Sample corners
    corner_colors = [
        data[0, 0][:3],
        data[width - 1, 0][:3],
        data[0, height - 1][:3],
        data[width - 1, height - 1][:3],
    ]
    # Most common corner color
    bg_color = max(set(corner_colors), key=corner_colors.count)
    threshold = 40

    for y in range(height):
        for x in range(width):
            r, g, b, a = data[x, y]
            if (
                abs(r - bg_color[0]) < threshold
                and abs(g - bg_color[1]) < threshold
                and abs(b - bg_color[2]) < threshold
            ):
                data[x, y] = (r, g, b, 0)
    return img


def _composite(bg: Image.Image, fg: Image.Image) -> Image.Image:
    """Scale background to canvas, scale foreground to 60% height, center it."""
    canvas_w, canvas_h = CANVAS_SIZE

    # Background
    bg = bg.resize(CANVAS_SIZE, Image.LANCZOS)
    canvas = bg.convert("RGBA")

    # Foreground — scale to fill 80% of the canvas (up or down), preserving aspect ratio
    max_fg_w = int(canvas_w * 0.70)
    max_fg_h = int(canvas_h * 0.70)
    scale = min(max_fg_w / fg.width, max_fg_h / fg.height)
    new_w = max(1, int(fg.width * scale))
    new_h = max(1, int(fg.height * scale))
    fg = fg.resize((new_w, new_h), Image.LANCZOS)

    # Add subtle drop shadow
    shadow = _make_shadow(fg)
    shadow_x = (canvas_w - shadow.width) // 2 + 8
    shadow_y = (canvas_h - shadow.height) // 2 + 8 - 30
    canvas.paste(shadow, (shadow_x, shadow_y), shadow)

    # Paste foreground centered
    fg_x = (canvas_w - fg.width) // 2
    fg_y = (canvas_h - fg.height) // 2 - 30
    canvas.paste(fg, (fg_x, fg_y), fg)

    return canvas.convert("RGB")


def _make_shadow(fg: Image.Image, offset: int = 12, blur_radius: int = 16) -> Image.Image:
    """Create a blurred black shadow image the same size as fg."""
    shadow = Image.new("RGBA", (fg.width + offset * 2, fg.height + offset * 2), (0, 0, 0, 0))
    # Use alpha channel of fg as shadow mask
    if fg.mode == "RGBA":
        alpha = fg.split()[3]
        shadow_alpha = alpha.point(lambda p: int(p * 0.4))
        shadow.paste((0, 0, 0, 180), (offset, offset), shadow_alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur_radius))
    return shadow


def _add_text_overlay(img: Image.Image, product_name: str, price: str) -> Image.Image:
    """Add a semi-transparent banner at the bottom with product name and price."""
    canvas_w, canvas_h = img.size
    draw = ImageDraw.Draw(img, "RGBA")

    # Banner height
    banner_h = 160
    banner_top = canvas_h - banner_h

    # Semi-transparent dark banner
    draw.rectangle([(0, banner_top), (canvas_w, canvas_h)], fill=(0, 0, 0, 180))

    # Try to load a bundled font, fall back to default
    name_font = _load_font(size=48)
    price_font = _load_font(size=36, bold=True)

    # Product name — truncate if too long
    max_name_len = 40
    display_name = product_name if len(product_name) <= max_name_len else product_name[:37] + "…"

    # Center text horizontally
    name_bbox = draw.textbbox((0, 0), display_name, font=name_font)
    name_w = name_bbox[2] - name_bbox[0]
    name_x = (canvas_w - name_w) // 2
    name_y = banner_top + 20

    price_bbox = draw.textbbox((0, 0), price, font=price_font)
    price_w = price_bbox[2] - price_bbox[0]
    price_x = (canvas_w - price_w) // 2
    price_y = banner_top + 85

    # Subtle text shadow
    draw.text((name_x + 2, name_y + 2), display_name, font=name_font, fill=(0, 0, 0, 160))
    draw.text((name_x, name_y), display_name, font=name_font, fill=(255, 255, 255, 255))

    draw.text((price_x + 2, price_y + 2), price, font=price_font, fill=(0, 0, 0, 160))
    draw.text((price_x, price_y), price, font=price_font, fill=(255, 220, 80, 255))  # gold price

    return img


def _load_font(size: int = 40, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Load a font; falls back to Pillow default if no TTF found."""
    # Common system fonts on Windows / Mac / Linux
    candidates = [
        "arialbd.ttf" if bold else "arial.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
        "LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except (IOError, OSError):
            continue
    # Pillow built-in bitmap font (no size control, but never fails)
    return ImageFont.load_default()
