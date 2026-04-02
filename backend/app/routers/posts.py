from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from app.auth_deps import get_current_user
from app.database import (
    approve_post_transactional, delete_post, get_post, get_posts_by_profile,
    get_profile, get_user_by_email, update_post_status,
)
from app.models.schemas import PostResponse, PublishResponse
from app.services.composio_service import publish_to_platforms

router = APIRouter()

STATIC_IMAGES_DIR = Path(__file__).parent.parent.parent / "static" / "images"


def _delete_image_file(image_filename: str) -> None:
    """Delete the generated image from disk, ignoring errors if already gone."""
    if not image_filename:
        return
    path = STATIC_IMAGES_DIR / image_filename
    try:
        path.unlink(missing_ok=True)
    except Exception:
        pass


def _assert_post_owner(post_id: int, user_email: str) -> dict:
    post = get_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    profile = get_profile(post["profile_id"])
    user = get_user_by_email(user_email)
    if not user or not profile or profile["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your post.")
    return post


@router.get("/profiles/{profile_id}/posts", response_model=list[PostResponse])
async def list_posts(
    profile_id: int,
    status: str = None,
    current_user: str = Depends(get_current_user),
):
    profile = get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    user = get_user_by_email(current_user)
    if not user or profile["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your profile.")
    posts = get_posts_by_profile(profile_id, status=status)
    return [PostResponse.from_db(p) for p in posts]


@router.patch("/posts/{post_id}/approve", response_model=PublishResponse)
async def approve_post(
    post_id: int,
    current_user: str = Depends(get_current_user),
):
    """Approve a pending post and publish it immediately."""
    post = _assert_post_owner(post_id, current_user)
    if post["status"] != "pending":
        raise HTTPException(status_code=400, detail="Post is not pending approval.")

    profile = get_profile(post["profile_id"])
    composio_key = profile["composio_api_key"] or None
    ig_user_id = profile.get("ig_user_id") or None
    facebook_page_id = profile.get("facebook_page_id") or None

    # Step 1 — publish to social platforms (external, not yet committed to DB)
    try:
        results = publish_to_platforms(
            image_filename=post["image_filename"],
            caption=post["caption"],
            platforms=post["platforms"],
            composio_api_key=composio_key,
            ig_user_id=ig_user_id,
            facebook_page_id=facebook_page_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Publishing failed: {e}")

    # Step 2 — publishing succeeded; atomically update DB
    # (status → posted, tracked product upsert, usage record — all or nothing)
    try:
        approve_post_transactional(
            post_id=post_id,
            posted_at=datetime.utcnow().isoformat(),
            profile_id=post["profile_id"],
            product_name=post.get("product_name", ""),
            product_url=post.get("product_url", ""),
            image_url=post.get("image_url", ""),
            description=post.get("product_description", ""),
        )
    except Exception as e:
        # Post was published but DB update failed — return 207 so the client knows
        raise HTTPException(
            status_code=207,
            detail=f"Post published to social media but DB update failed: {e}. Refresh to check status.",
        )

    errors = [v.get("error") for v in results.values() if v.get("status") == "error"]
    if errors and len(errors) == len(results):
        raise HTTPException(status_code=502, detail="; ".join(str(e) for e in errors))

    return PublishResponse(success=True, message="Post published.", results=results)


@router.delete("/posts/{post_id}", status_code=204)
async def delete_post_endpoint(
    post_id: int,
    current_user: str = Depends(get_current_user),
):
    post = _assert_post_owner(post_id, current_user)
    _delete_image_file(post.get("image_filename", ""))
    delete_post(post["id"])


@router.patch("/posts/{post_id}/reject", status_code=204)
async def reject_post(
    post_id: int,
    current_user: str = Depends(get_current_user),
):
    post = _assert_post_owner(post_id, current_user)
    if post["status"] != "pending":
        raise HTTPException(status_code=400, detail="Post is not pending.")
    _delete_image_file(post.get("image_filename", ""))
    delete_post(post["id"])
