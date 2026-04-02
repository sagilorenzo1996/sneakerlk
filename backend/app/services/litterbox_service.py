"""
Upload a local image to Litterbox (litterbox.catbox.moe) for a temporary public URL.
No API key required. Files expire after the chosen duration.
"""
import logging
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

LITTERBOX_URL = "https://litterbox.catbox.moe/resources/internals/api.php"
STATIC_IMAGES_DIR = Path(__file__).parent.parent.parent / "static" / "images"


def upload_image(image_filename: str, expiry: str = "24h") -> str:
    """
    Upload image_filename (relative to static/images/) to Litterbox.
    expiry: "1h", "12h", "24h", or "72h"
    Returns the public URL string.
    Raises ValueError on failure.
    """
    image_path = STATIC_IMAGES_DIR / image_filename
    if not image_path.exists():
        raise ValueError(f"Image file not found: {image_path}")

    with open(image_path, "rb") as f:
        response = requests.post(
            LITTERBOX_URL,
            data={"reqtype": "fileupload", "time": expiry},
            files={"fileToUpload": (image_filename, f)},
            timeout=30,
        )

    if not response.ok:
        raise ValueError(f"Litterbox upload failed ({response.status_code}): {response.text}")

    url = response.text.strip()
    if not url.startswith("https://"):
        raise ValueError(f"Litterbox returned unexpected response: {url}")

    logger.info("[Litterbox] Uploaded %s → %s", image_filename, url)
    return url
