import re
import unicodedata
from urllib.parse import urlparse, urljoin


def slugify(text: str) -> str:
    """Convert text to a filesystem-safe slug."""
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", text)


def ensure_absolute_url(base_url: str, url: str) -> str:
    """Convert a relative URL to absolute using the base URL."""
    if not url:
        return ""
    if url.startswith("//"):
        parsed = urlparse(base_url)
        return f"{parsed.scheme}:{url}"
    if url.startswith("http"):
        return url
    return urljoin(base_url, url)


def extract_domain(url: str) -> str:
    """Return the base domain of a URL."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def clean_price(price_text: str) -> str:
    """Normalize price strings."""
    price_text = price_text.strip()
    # Keep currency symbols and digits
    price_text = re.sub(r"\s+", " ", price_text)
    return price_text[:50]  # truncate safety
