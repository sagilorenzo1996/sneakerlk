from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.database import get_profile, record_usage, update_post_status
from app.models.schemas import PublishRequest, PublishResponse
from app.services.composio_service import publish_to_platforms

router = APIRouter()


@router.post("", response_model=PublishResponse)
async def publish(request: PublishRequest):
    """Publish the approved post to Facebook and/or Instagram via Composio."""
    if not request.platforms:
        raise HTTPException(status_code=400, detail="Select at least one platform.")

    composio_key = None
    ig_user_id = None
    facebook_page_id = None
    if request.profile_id:
        profile = get_profile(request.profile_id)
        if profile:
            composio_key = profile["composio_api_key"] or None
            ig_user_id = profile.get("ig_user_id") or None
            facebook_page_id = profile.get("facebook_page_id") or None

    try:
        results = publish_to_platforms(
            image_filename=request.image_filename,
            caption=request.caption,
            platforms=request.platforms,
            composio_api_key=composio_key,
            ig_user_id=ig_user_id,
            facebook_page_id=facebook_page_id,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Publishing failed: {str(e)}")

    errors = [v.get("error") for v in results.values() if v.get("status") == "error"]
    if errors and len(errors) == len(results):
        raise HTTPException(status_code=502, detail="; ".join(str(e) for e in errors))

    # Mark the post record as posted if a post_id was supplied
    if request.post_id:
        try:
            update_post_status(request.post_id, "posted",
                               posted_at=datetime.utcnow().isoformat())
        except Exception:
            pass

    if request.profile_id:
        try:
            record_usage(request.profile_id, "composio", "publish")
        except Exception:
            pass

    return PublishResponse(
        success=True,
        message="Post submitted to selected platforms.",
        results=results,
    )
