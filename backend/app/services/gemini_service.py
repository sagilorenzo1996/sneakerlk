"""
Gemini service — text generation (captions) and Imagen background generation.
Uses the google-genai SDK (google.genai).
"""
import io
import base64
import logging
from typing import List, Optional

from google import genai
from google.genai import types as genai_types

from app.config import get_settings

logger = logging.getLogger(__name__)


def _get_client(api_key: Optional[str] = None) -> genai.Client:
    if not api_key:
        settings = get_settings()
        api_key = settings.gemini_api_key
    if not api_key:
        raise ValueError("Gemini API key is not configured. Go to Settings to add it.")
    return genai.Client(api_key=api_key)


# ── Caption Generation ────────────────────────────────────────────────────────

DEFAULT_CAPTION_PROMPT = """\
You are a professional social media marketing copywriter for e-commerce.

Create an engaging Instagram/Facebook post caption for the following product:

- Product Name: {product_name}
- Price: {price}
- Product Link: {product_url}
- Contact Phone: {phone}
- Store Description: {store_description}
- Store Theme/Aesthetic: {site_theme}
- Product Description: {product_description}

Requirements:
1. {language_instruction}
2. Start with an attention-grabbing hook (emoji encouraged).
3. Highlight the product's key benefits based on the description and theme.
4. Include a clear call-to-action (e.g., "Shop now", "Order via WhatsApp").
5. Naturally include the product link: {product_url}
6. Include the contact phone number for orders: {phone}
7. End with 10-15 relevant hashtags.
8. Keep total length under 2200 characters.
9. Make it feel authentic, not robotic.

Return ONLY the caption text, no extra commentary.\
"""

DEFAULT_IMAGE_PROMPT = (
    "A high-end, minimalist professional product photography stage. "
    "Empty minimalist pedestal setup for a {store_description_hint}. "
    "Color Palette: {site_theme}. "
    "Lighting: Soft-box studio lighting with elegant shadows and a subtle radial gradient. "
    "Texture: Smooth matte surface with a hint of architectural depth. "
    "Composition: Perfectly centered, symmetrical, empty space, 8k resolution, clean lines, social media aesthetic. "
    "Exclusions: No products, no animals, no people, no text, no logos. 1:1 Aspect Ratio."
)


def generate_caption(
    product_name: str,
    price: str,
    product_url: str,
    phone: str,
    languages: List[str],
    site_theme: str,
    product_description: str = "",
    api_key: Optional[str] = None,
    model: str = "gemini-2.5-flash",
    prompt_template: Optional[str] = None,
    store_description: str = "",
) -> tuple[str, str]:
    """Generate an engaging social media caption using Gemini.
    Returns (caption_text, actual_prompt_used).
    """
    client = _get_client(api_key)

    lang_instruction = (
        f"Write the caption in the following language(s): {', '.join(languages)}. "
        "If multiple languages are selected, blend them naturally or use all of them in sections."
        if languages
        else "Write the caption in English."
    )

    template = prompt_template or DEFAULT_CAPTION_PROMPT
    prompt = template.format(
        product_name=product_name,
        price=price,
        product_url=product_url,
        phone=phone,
        site_theme=site_theme,
        product_description=product_description or "Not available",
        language_instruction=lang_instruction,
        store_description=store_description or "Not specified",
    )

    logger.info(
        "[Gemini caption] model=%s | prompt (%d chars):\n%s",
        model, len(prompt), prompt,
    )

    response = client.models.generate_content(
        model=model,
        contents=prompt,
    )
    return response.text.strip(), prompt


# ── Background Image Generation (Imagen 3) ───────────────────────────────────

def generate_background_image(site_theme: str,
                               api_key: Optional[str] = None,
                               image_model: str = "imagen-4.0-generate-001",
                               image_prompt_override: Optional[str] = None,
                               store_description: str = "",
                               product_name: str = "",
                               price: str = "") -> tuple[bytes, str]:
    """
    Generate a background image using Google Imagen.
    Returns (raw_image_bytes, actual_prompt_used).
    """
    client = _get_client(api_key)

    store_description_hint = store_description.strip() if store_description else "premium e-commerce boutique"

    # Derive a simple store type label from the theme for the prompt
    theme_lower = site_theme.lower()
    store_type = "fashion" if "fashion" in theme_lower or "clothing" in theme_lower \
        else "beauty" if "beauty" in theme_lower or "cosmetic" in theme_lower \
        else "electronics" if "electronics" in theme_lower or "tech" in theme_lower \
        else "jewellery" if "jewel" in theme_lower \
        else "food" if "food" in theme_lower or "coffee" in theme_lower \
        else "home decor" if "decor" in theme_lower or "furniture" in theme_lower \
        else "general e-commerce"

    if image_prompt_override:
        prompt = image_prompt_override.format(
            site_theme=site_theme,
            store_description=store_description or "",
            store_description_hint=store_description_hint,
            store_type=store_type,
            product_name=product_name,
            price=price,
        )
    else:
        prompt = DEFAULT_IMAGE_PROMPT.format(
            site_theme=site_theme,
            store_description_hint=store_description_hint,
            store_type=store_type,
        )

    logger.info(
        "[Gemini image] model=%s | prompt (%d chars):\n%s",
        image_model, len(prompt), prompt,
    )

    try:
        response = client.models.generate_images(
            model=image_model,
            prompt=prompt,
            config=genai_types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="1:1",
                safety_filter_level="block_low_and_above",
                person_generation="dont_allow",
            ),
        )
        if response.generated_images:
            return response.generated_images[0].image.image_bytes, prompt
    except Exception as e:
        # Imagen may not be available on all API tiers — fallback to gradient
        print(f"Imagen failed ({e}), falling back to gradient background.")

    return _generate_gradient_background_fallback(site_theme), prompt


def _generate_gradient_background_fallback(site_theme: str) -> bytes:
    """
    Fallback: ask Gemini Flash to generate an image inline (experimental).
    If that also fails, return a solid-color PNG.
    """
    from PIL import Image as PILImage
    import re

    # Parse a dominant color from theme string (hex codes)
    hex_pattern = re.compile(r"#([0-9a-fA-F]{3,6})")
    matches = hex_pattern.findall(site_theme)
    color = (230, 230, 230)  # default light gray
    if matches:
        h = matches[0]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        try:
            color = tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))
        except Exception:
            pass

    # Create a simple gradient PNG
    width, height = 1080, 1080
    img = PILImage.new("RGB", (width, height))
    pixels = img.load()
    r, g, b = color
    for y in range(height):
        factor = y / height
        pr = int(min(255, r + (255 - r) * factor * 0.5))
        pg = int(min(255, g + (255 - g) * factor * 0.5))
        pb = int(min(255, b + (255 - b) * factor * 0.5))
        for x in range(width):
            pixels[x, y] = (pr, pg, pb)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ── Text Parsing (structure raw scraped text) ─────────────────────────────────

def parse_scraped_text(raw_text: str, url: str,
                       api_key: Optional[str] = None) -> dict:
    """
    Ask Gemini to extract structured product data from unstructured HTML text.
    Returns a dict with keys: name, price, description.
    """
    client = _get_client(api_key)
    prompt = f"""
From the following raw text scraped from {url}, extract product information.
Return ONLY valid JSON with keys: "name", "price", "description".
If multiple products exist, return only the most prominent one.

Raw text:
{raw_text[:3000]}
"""
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json"
            ),
        )
        import json
        return json.loads(response.text)
    except Exception:
        return {"name": "", "price": "", "description": ""}
