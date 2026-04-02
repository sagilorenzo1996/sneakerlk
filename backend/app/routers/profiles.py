from fastapi import APIRouter, Depends, HTTPException

from app.auth_deps import get_current_user
from app.database import (
    create_profile, delete_profile, get_monthly_usage, get_pipeline,
    get_pipelines_by_profile, get_post_counts, get_profile,
    get_profiles_by_user, get_user_by_email, update_profile,
)
from app.models.schemas import (
    ProfileCreate, ProfileResponse, ProfileStatsResponse, ProfileUpdate,
)

router = APIRouter()


def _owner_or_404(profile_id: int, user_email: str) -> dict:
    """Return the profile if it exists and belongs to the current user."""
    profile = get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    user = get_user_by_email(user_email)
    if not user or profile["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your profile.")
    return profile


@router.get("", response_model=list[ProfileStatsResponse])
async def list_profiles(current_user: str = Depends(get_current_user)):
    user = get_user_by_email(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    profiles = get_profiles_by_user(user["id"])
    result = []
    for p in profiles:
        result.append(ProfileStatsResponse(
            **ProfileResponse.from_db(p).model_dump(),
            post_counts=get_post_counts(p["id"]),
            usage=get_monthly_usage(p["id"]),
            pipeline_count=len(get_pipelines_by_profile(p["id"])),
        ))
    return result


@router.post("", response_model=ProfileResponse, status_code=201)
async def create_new_profile(
    payload: ProfileCreate,
    current_user: str = Depends(get_current_user),
):
    user = get_user_by_email(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    profile = create_profile(
        user_id=user["id"],
        name=payload.name,
        url=payload.url,
        contact_number=payload.contact_number,
        email=payload.email,
        description=payload.description,
        gemini_api_key=payload.gemini_api_key,
        composio_api_key=payload.composio_api_key,
        ig_user_id=payload.ig_user_id,
        currency=payload.currency,
        facebook_page_id=payload.facebook_page_id,
    )
    return ProfileResponse.from_db(profile)


@router.get("/{profile_id}", response_model=ProfileStatsResponse)
async def get_profile_detail(
    profile_id: int,
    current_user: str = Depends(get_current_user),
):
    profile = _owner_or_404(profile_id, current_user)
    return ProfileStatsResponse(
        **ProfileResponse.from_db(profile).model_dump(),
        post_counts=get_post_counts(profile_id),
        usage=get_monthly_usage(profile_id),
        pipeline_count=len(get_pipelines_by_profile(profile_id)),
    )


@router.put("/{profile_id}", response_model=ProfileResponse)
async def update_profile_endpoint(
    profile_id: int,
    payload: ProfileUpdate,
    current_user: str = Depends(get_current_user),
):
    _owner_or_404(profile_id, current_user)
    updated = update_profile(
        profile_id,
        **{k: v for k, v in payload.model_dump().items()
           if v is not None and not (k in ("gemini_api_key", "composio_api_key") and v == "")},
    )
    return ProfileResponse.from_db(updated)


@router.delete("/{profile_id}", status_code=204)
async def delete_profile_endpoint(
    profile_id: int,
    current_user: str = Depends(get_current_user),
):
    _owner_or_404(profile_id, current_user)
    delete_profile(profile_id)
