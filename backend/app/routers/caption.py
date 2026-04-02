from fastapi import APIRouter, HTTPException

from app.database import get_profile, record_usage
from app.models.schemas import GenerateCaptionRequest, GenerateCaptionResponse
from app.services.gemini_service import generate_caption

router = APIRouter()


@router.post("", response_model=GenerateCaptionResponse)
async def caption(request: GenerateCaptionRequest):
    """Generate a multilingual social media caption using Gemini."""
    api_key = None
    model = "gemini-2.0-flash"
    if request.profile_id:
        profile = get_profile(request.profile_id)
        if profile:
            api_key = profile["gemini_api_key"] or None
            model = profile.get("gemini_model") or model

    try:
        text = generate_caption(
            product_name=request.product.name,
            price=request.product.price,
            product_url=request.product.product_url,
            phone=request.phone,
            languages=request.languages,
            site_theme=request.site_theme,
            api_key=api_key,
            model=model,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Caption generation failed: {str(e)}")

    if request.profile_id:
        try:
            record_usage(request.profile_id, "gemini", "caption")
        except Exception:
            pass

    return GenerateCaptionResponse(caption=text)
