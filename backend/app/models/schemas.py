from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl


# ---------- Auth ----------

class RegisterRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str


# ---------- Profiles ----------

class ProfileCreate(BaseModel):
    name: str
    url: str
    contact_number: str = ""
    email: str = ""
    description: str = ""
    gemini_api_key: str = ""
    composio_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    image_model: str = "imagen-4.0-generate-001"
    ig_user_id: str = ""
    currency: str = ""
    facebook_page_id: str = ""


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    description: Optional[str] = None
    gemini_api_key: Optional[str] = None
    composio_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    image_model: Optional[str] = None
    ig_user_id: Optional[str] = None
    currency: Optional[str] = None
    facebook_page_id: Optional[str] = None


class ProfileResponse(BaseModel):
    id: int
    user_id: int
    name: str
    url: str
    contact_number: str
    email: str
    description: str
    gemini_api_key_set: bool
    composio_api_key_set: bool
    gemini_model: str
    image_model: str
    ig_user_id: str
    currency: str
    facebook_page_id: str
    created_at: str

    @classmethod
    def from_db(cls, row: dict) -> "ProfileResponse":
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            name=row["name"],
            url=row["url"],
            contact_number=row["contact_number"] or "",
            email=row["email"] or "",
            description=row["description"] or "",
            gemini_api_key_set=bool(row["gemini_api_key"]),
            composio_api_key_set=bool(row["composio_api_key"]),
            gemini_model=row.get("gemini_model") or "gemini-2.5-flash",
            image_model=row.get("image_model") or "imagen-4.0-generate-001",
            ig_user_id=row.get("ig_user_id") or "",
            currency=row.get("currency") or "",
            facebook_page_id=row.get("facebook_page_id") or "",
            created_at=str(row["created_at"]),
        )


class ProfileStatsResponse(ProfileResponse):
    post_counts: dict
    usage: dict
    pipeline_count: int


# ---------- Pipelines ----------

class PipelineCreate(BaseModel):
    name: str
    platforms: List[str] = ["facebook"]
    languages: List[str] = ["English"]
    schedule: str = "manual"
    post_time: str = "09:00"


class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    platforms: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    schedule: Optional[str] = None
    post_time: Optional[str] = None
    status: Optional[str] = None
    workflow_configured: Optional[bool] = None
    posts_per_run: Optional[int] = None
    caption_prompt: Optional[str] = None
    image_prompt: Optional[str] = None


class PipelineResponse(BaseModel):
    id: int
    profile_id: int
    name: str
    platforms: List[str]
    languages: List[str]
    schedule: str
    post_time: str
    status: str
    workflow_configured: bool
    posts_per_run: int
    caption_prompt: str
    image_prompt: str
    created_at: str

    @classmethod
    def from_db(cls, row: dict) -> "PipelineResponse":
        return cls(
            id=row["id"],
            profile_id=row["profile_id"],
            name=row["name"],
            platforms=row["platforms"],
            languages=row["languages"],
            schedule=row["schedule"],
            post_time=row.get("post_time") or "09:00",
            status=row["status"],
            workflow_configured=bool(row.get("workflow_configured", 0)),
            posts_per_run=int(row.get("posts_per_run") or 1),
            caption_prompt=row.get("caption_prompt") or "",
            image_prompt=row.get("image_prompt") or "",
            created_at=str(row["created_at"]),
        )


# ---------- Tracked Products ----------

class TrackedProductResponse(BaseModel):
    id: int
    profile_id: int
    name: str
    product_url: str
    image_url: str
    description: str
    enabled: bool
    created_at: str

    @classmethod
    def from_db(cls, row: dict) -> "TrackedProductResponse":
        return cls(
            id=row["id"],
            profile_id=row["profile_id"],
            name=row["name"],
            product_url=row["product_url"],
            image_url=row.get("image_url") or "",
            description=row.get("description") or "",
            enabled=bool(row["enabled"]),
            created_at=str(row["created_at"]),
        )


# ---------- Pipeline Status ----------

class PipelineStatusResponse(BaseModel):
    running: bool
    step: str
    step_index: int


# ---------- Posts ----------

class PostResponse(BaseModel):
    id: int
    profile_id: int
    pipeline_id: Optional[int]
    product_name: str
    product_url: str
    product_description: str
    image_filename: str
    image_url: str
    caption: str
    platforms: List[str]
    status: str
    caption_prompt_used: str
    image_prompt_used: str
    posted_at: Optional[str]
    created_at: str

    @classmethod
    def from_db(cls, row: dict) -> "PostResponse":
        return cls(
            id=row["id"],
            profile_id=row["profile_id"],
            pipeline_id=row.get("pipeline_id"),
            product_name=row["product_name"] or "",
            product_url=row["product_url"] or "",
            product_description=row.get("product_description") or "",
            image_filename=row["image_filename"] or "",
            image_url=row["image_url"] or "",
            caption=row["caption"] or "",
            platforms=row["platforms"],
            status=row["status"],
            caption_prompt_used=row.get("caption_prompt_used") or "",
            image_prompt_used=row.get("image_prompt_used") or "",
            posted_at=str(row["posted_at"]) if row.get("posted_at") else None,
            created_at=str(row["created_at"]),
        )


# ---------- Scraper ----------

class ScrapeRequest(BaseModel):
    url: str
    phone: str
    profile_id: Optional[int] = None


class Product(BaseModel):
    name: str
    price: str
    product_url: str
    image_url: str
    description: str = ""


class ScrapeResponse(BaseModel):
    products: List[Product]
    site_theme: str
    site_title: str


# ---------- Image Processing ----------

class ProcessImageRequest(BaseModel):
    product: Product
    site_theme: str
    profile_id: Optional[int] = None


class ProcessImageResponse(BaseModel):
    composite_image_url: str
    image_filename: str


# ---------- Caption ----------

class GenerateCaptionRequest(BaseModel):
    product: Product
    phone: str
    languages: List[str]
    site_theme: str
    profile_id: Optional[int] = None


class GenerateCaptionResponse(BaseModel):
    caption: str


# ---------- Publish ----------

class PublishRequest(BaseModel):
    image_filename: str
    caption: str
    platforms: List[str]
    profile_id: Optional[int] = None
    post_id: Optional[int] = None   # if approving an existing pending post


class PublishResponse(BaseModel):
    success: bool
    message: str
    results: dict


# ---------- Settings ----------

class SettingsPayload(BaseModel):
    gemini_api_key: Optional[str] = None
    composio_api_key: Optional[str] = None


class SettingsResponse(BaseModel):
    gemini_api_key_set: bool
    composio_api_key_set: bool
    message: str
