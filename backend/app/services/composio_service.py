"""
Composio service — publish posts to Facebook and Instagram.

Facebook  : FACEBOOK_CREATE_PHOTO_POST  (page_id + url + message)
Instagram : two-step —
    1. INSTAGRAM_CREATE_MEDIA_CONTAINER (create container → creation_id)
    2. INSTAGRAM_CREATE_POST            (ig_user_id + creation_id → ig_media_id)
"""
import logging
from pathlib import Path
from typing import Optional

from composio import Action, ComposioToolSet

from app.config import get_settings
from app.services.litterbox_service import upload_image as litterbox_upload

logger = logging.getLogger(__name__)


def publish_to_platforms(
    image_filename: str,
    caption: str,
    platforms: list[str],
    composio_api_key: Optional[str] = None,
    ig_user_id: Optional[str] = None,
    facebook_page_id: Optional[str] = None,
) -> dict:
    if not composio_api_key:
        settings = get_settings()
        composio_api_key = settings.composio_api_key
    if not composio_api_key:
        raise ValueError("Composio API key is not configured.")

    try:
        image_url = litterbox_upload(image_filename)
    except Exception as e:
        raise ValueError(f"Image upload failed: {e}")

    toolset = ComposioToolSet(api_key=composio_api_key, entity_id="default")
    results = {}

    if "facebook" in platforms:
        logger.info("[Composio] Publishing to Facebook…")
        if not facebook_page_id:
            results["facebook"] = {
                "status": "error",
                "error": "Facebook Page ID is not set on this profile. Add it in Edit Profile.",
            }
        else:
            results["facebook"] = _post_facebook(toolset, caption, image_url, facebook_page_id)

    if "instagram" in platforms:
        logger.info("[Composio] Publishing to Instagram…")
        if not ig_user_id:
            results["instagram"] = {
                "status": "error",
                "error": "Instagram Business Account ID is not set on this profile. Add it in Edit Profile.",
            }
        else:
            results["instagram"] = _post_instagram(toolset, caption, image_url, ig_user_id)

    return results


def _post_facebook(toolset: ComposioToolSet, caption: str, image_url: str, page_id: str) -> dict:
    try:
        result = toolset.execute_action(
            action=Action.FACEBOOK_CREATE_PHOTO_POST,
            params={
                "page_id": page_id,
                "url":     image_url,
                "message": caption,
            },
        )
        logger.info("[Composio] Facebook result: %s", result)
        return {"status": "success", "data": result}
    except Exception as e:
        logger.error("[Composio] Facebook failed: %s", e)
        return {"status": "error", "error": str(e)}


def _post_instagram(toolset: ComposioToolSet, caption: str, image_url: str, ig_user_id: str) -> dict:
    try:
        # Step 1 — create media container
        container_result = toolset.execute_action(
            action=Action.INSTAGRAM_CREATE_MEDIA_CONTAINER,
            params={
                "ig_user_id":   ig_user_id,
                "content_type": "photo",
                "image_url":    image_url,
                "caption":      caption,
            },
        )
        logger.info("[Composio] Instagram container result: %s", container_result)

        if not container_result.get("successfull"):
            return {"status": "error", "error": f"Container creation failed: {container_result}"}

        creation_id = container_result["data"]["id"]
        logger.info("[Composio] Instagram container ID: %s", creation_id)

        # Step 2 — publish the container
        publish_result = toolset.execute_action(
            action=Action.INSTAGRAM_CREATE_POST,
            params={
                "ig_user_id":  ig_user_id,
                "creation_id": creation_id,
            },
        )
        logger.info("[Composio] Instagram publish result: %s", publish_result)
        return {"status": "success", "data": publish_result}

    except Exception as e:
        logger.error("[Composio] Instagram post failed: %s", e)
        return {"status": "error", "error": str(e)}
