from fastapi import APIRouter, Depends, HTTPException

from app.auth_deps import get_current_user
from app.database import (
    get_profile, get_tracked_products, get_user_by_email,
    set_tracked_product_enabled,
)
from app.models.schemas import TrackedProductResponse

router = APIRouter()


def _assert_profile_owner(profile_id: int, user_email: str) -> dict:
    profile = get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    user = get_user_by_email(user_email)
    if not user or profile["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your profile.")
    return profile


@router.get("/profiles/{profile_id}/products", response_model=list[TrackedProductResponse])
async def list_tracked_products(
    profile_id: int,
    current_user: str = Depends(get_current_user),
):
    _assert_profile_owner(profile_id, current_user)
    return [TrackedProductResponse.from_db(p) for p in get_tracked_products(profile_id)]


@router.patch("/profiles/{profile_id}/products/{product_id}/toggle",
              response_model=TrackedProductResponse)
async def toggle_tracked_product(
    profile_id: int,
    product_id: int,
    enabled: bool,
    current_user: str = Depends(get_current_user),
):
    profile = _assert_profile_owner(profile_id, current_user)
    products = get_tracked_products(profile_id)
    if not any(p["id"] == product_id for p in products):
        raise HTTPException(status_code=404, detail="Product not found.")
    updated = set_tracked_product_enabled(product_id, enabled)
    return TrackedProductResponse.from_db(updated)
