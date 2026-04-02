"""
Composio social account connection endpoints.

GET  /api/profiles/{profile_id}/connections          — check Facebook & Instagram status
POST /api/profiles/{profile_id}/connections/{app}    — initiate OAuth, returns redirect URL
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth_deps import get_current_user
from app.database import get_profile, get_user_by_email

router = APIRouter()

SUPPORTED_APPS = {"facebook", "instagram"}


def _get_composio_key(profile_id: int, user_email: str) -> str:
    profile = get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    user = get_user_by_email(user_email)
    if not user or profile["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your profile.")
    key = profile.get("composio_api_key") or ""
    if not key:
        raise HTTPException(status_code=400, detail="No Composio API key set on this profile.")
    return key


class ConnectionStatus(BaseModel):
    facebook: bool
    instagram: bool


class InitiateResponse(BaseModel):
    app: str
    redirect_url: str


@router.get("", response_model=ConnectionStatus)
async def get_connections(
    profile_id: int,
    current_user: str = Depends(get_current_user),
):
    """Return whether Facebook and Instagram are connected for this profile."""
    key = _get_composio_key(profile_id, current_user)
    try:
        from composio import ComposioToolSet, App
    except ImportError:
        raise HTTPException(status_code=500, detail="composio-core is not installed.")

    toolset = ComposioToolSet(api_key=key)
    entity  = toolset.get_entity(id="default")

    def is_connected(app) -> bool:
        try:
            entity.get_connection(app)
            return True
        except Exception:
            return False

    return ConnectionStatus(
        facebook=is_connected(App.FACEBOOK),
        instagram=is_connected(App.INSTAGRAM),
    )


@router.post("/{app_name}", response_model=InitiateResponse)
async def initiate_connection(
    profile_id: int,
    app_name: str,
    current_user: str = Depends(get_current_user),
):
    """Initiate an OAuth connection. Returns a redirect URL for the user to open."""
    if app_name not in SUPPORTED_APPS:
        raise HTTPException(status_code=400, detail=f"Unsupported app '{app_name}'. Use: facebook, instagram.")

    key = _get_composio_key(profile_id, current_user)
    try:
        from composio import ComposioToolSet, App
    except ImportError:
        raise HTTPException(status_code=500, detail="composio-core is not installed.")

    toolset = ComposioToolSet(api_key=key)
    entity  = toolset.get_entity(id="default")
    app     = App.FACEBOOK if app_name == "facebook" else App.INSTAGRAM

    try:
        connection = entity.initiate_connection(app)
        return InitiateResponse(app=app_name, redirect_url=connection.redirectUrl)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
