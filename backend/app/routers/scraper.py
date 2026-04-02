from fastapi import APIRouter, HTTPException

from app.models.schemas import ScrapeRequest, ScrapeResponse
from app.services.scraper_service import scrape_website

router = APIRouter()


@router.post("", response_model=ScrapeResponse)
async def scrape(request: ScrapeRequest):
    """
    Scrape the given URL for products.
    Tries Shopify /products.json first, then falls back to HTML parsing.
    """
    try:
        products, site_theme, site_title = await scrape_website(request.url)
    # products list is already capped inside scraper_service (max 20)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Scraping failed: {str(e)}")

    if not products:
        raise HTTPException(
            status_code=404,
            detail=(
                "No products found on this page. "
                "Try pasting a direct product listing URL or a /collections page."
            ),
        )

    return ScrapeResponse(
        products=products,
        site_theme=site_theme,
        site_title=site_title,
    )
