"""
Manage reference images for a pipeline (used by the 'reference_images' workflow type).
Images are stored at:  static/ref_images/{pipeline_id}/{filename}
The pipeline.reference_images column keeps a JSON list of filenames.
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from app.auth_deps import get_current_user
from app.database import get_pipeline, get_profile, get_user_by_email, update_pipeline

router = APIRouter()

REF_IMAGES_DIR = Path(__file__).parent.parent.parent / "static" / "ref_images"


def _assert_pipeline_owner(profile_id: int, pipeline_id: int, user_email: str) -> dict:
    profile = get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    user = get_user_by_email(user_email)
    if not user or profile["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your profile.")
    pipeline = get_pipeline(pipeline_id)
    if not pipeline or pipeline["profile_id"] != profile_id:
        raise HTTPException(status_code=404, detail="Pipeline not found.")
    return pipeline


def _pipeline_dir(pipeline_id: int) -> Path:
    d = REF_IMAGES_DIR / str(pipeline_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.get("/profiles/{profile_id}/pipelines/{pipeline_id}/reference-images")
async def list_reference_images(
    profile_id: int,
    pipeline_id: int,
    current_user: str = Depends(get_current_user),
):
    pipeline = _assert_pipeline_owner(profile_id, pipeline_id, current_user)
    return {"filenames": pipeline.get("reference_images") or []}


@router.post("/profiles/{profile_id}/pipelines/{pipeline_id}/reference-images")
async def upload_reference_images(
    profile_id: int,
    pipeline_id: int,
    files: list[UploadFile] = File(...),
    current_user: str = Depends(get_current_user),
):
    pipeline = _assert_pipeline_owner(profile_id, pipeline_id, current_user)
    d = _pipeline_dir(pipeline_id)

    existing: list[str] = list(pipeline.get("reference_images") or [])
    added = []

    for upload in files:
        ext = Path(upload.filename).suffix.lower() if upload.filename else ".jpg"
        if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

        filename = f"{uuid.uuid4().hex[:12]}{ext}"
        dest = d / filename
        dest.write_bytes(await upload.read())
        existing.append(filename)
        added.append(filename)

    update_pipeline(pipeline_id, reference_images=existing)
    return {"added": added, "filenames": existing}


@router.delete("/profiles/{profile_id}/pipelines/{pipeline_id}/reference-images/{filename}", status_code=204)
async def delete_reference_image(
    profile_id: int,
    pipeline_id: int,
    filename: str,
    current_user: str = Depends(get_current_user),
):
    pipeline = _assert_pipeline_owner(profile_id, pipeline_id, current_user)
    existing: list[str] = list(pipeline.get("reference_images") or [])

    if filename not in existing:
        raise HTTPException(status_code=404, detail="Image not found.")

    # Remove file from disk
    file_path = _pipeline_dir(pipeline_id) / filename
    file_path.unlink(missing_ok=True)

    existing.remove(filename)
    update_pipeline(pipeline_id, reference_images=existing)
