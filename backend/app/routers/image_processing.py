from fastapi import APIRouter, HTTPException

from app.database import get_profile, record_usage
from app.models.schemas import ProcessImageRequest, ProcessImageResponse
from app.services.image_service import process_product_image

router = APIRouter()


@router.post("", response_model=ProcessImageResponse)
async def process_image(request: ProcessImageRequest):
    """
    Full pipeline:
      download → remove BG → generate AI background → composite → text overlay → save.
    """
    api_key = None
    image_model = "imagen-4.0-generate-001"
    if request.profile_id:
        profile = get_profile(request.profile_id)
        if profile:
            api_key = profile["gemini_api_key"] or None
            image_model = profile.get("image_model") or image_model

    try:
        url_path, filename = await process_product_image(
            product=request.product,
            site_theme=request.site_theme,
            api_key=api_key,
            image_model=image_model,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image processing failed: {str(e)}")

    if request.profile_id:
        try:
            record_usage(request.profile_id, "gemini", "image")
        except Exception:
            pass

    return ProcessImageResponse(
        composite_image_url=url_path,
        image_filename=filename,
    )
