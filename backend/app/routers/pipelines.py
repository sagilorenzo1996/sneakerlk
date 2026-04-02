import asyncio
import logging
import random
import re

from fastapi import APIRouter, Depends, HTTPException

from app.auth_deps import get_current_user

logger = logging.getLogger(__name__)
from app.database import (
    create_pipeline, create_post, delete_pipeline, get_disabled_product_urls, get_pipeline,
    get_pipelines_by_profile, get_profile, get_user_by_email, record_usage, update_pipeline,
)
from app.models.schemas import (
    PipelineCreate, PipelineResponse, PipelineStatusResponse, PipelineUpdate, PostResponse,
)
from app.scheduler import add_pipeline, remove_pipeline
from app.ws_manager import broadcast
from app.services.gemini_service import generate_caption
from app.services.image_service import process_product_image
from app.services.scraper_service import scrape_website

router = APIRouter()

# In-memory pipeline run status: pipeline_id → {running, step, step_index}
_pipeline_status: dict[int, dict] = {}


async def _set_status(pipeline_id: int, step: str, step_index: int) -> None:
    _pipeline_status[pipeline_id] = {"running": True, "step": step, "step_index": step_index}
    await broadcast(pipeline_id, running=True, step=step, step_index=step_index)


async def _clear_status(pipeline_id: int) -> None:
    _pipeline_status.pop(pipeline_id, None)
    await broadcast(pipeline_id, running=False)


def _apply_currency(price: str, currency: str) -> str:
    """Strip any leading non-numeric characters and prepend the profile currency."""
    numeric = re.sub(r"^[^\d]*", "", price).strip()
    return f"{currency} {numeric}" if numeric else price


def _assert_profile_owner(profile_id: int, user_email: str) -> dict:
    profile = get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    user = get_user_by_email(user_email)
    if not user or profile["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your profile.")
    return profile


@router.get("/profiles/{profile_id}/pipelines", response_model=list[PipelineResponse])
async def list_pipelines(
    profile_id: int,
    current_user: str = Depends(get_current_user),
):
    _assert_profile_owner(profile_id, current_user)
    return [PipelineResponse.from_db(p) for p in get_pipelines_by_profile(profile_id)]


@router.post("/profiles/{profile_id}/pipelines", response_model=PipelineResponse, status_code=201)
async def create_new_pipeline(
    profile_id: int,
    payload: PipelineCreate,
    current_user: str = Depends(get_current_user),
):
    _assert_profile_owner(profile_id, current_user)
    pipeline = create_pipeline(
        profile_id=profile_id,
        name=payload.name,
        platforms=payload.platforms,
        languages=payload.languages,
        schedule=payload.schedule,
        post_time=payload.post_time,
    )
    add_pipeline(pipeline)
    return PipelineResponse.from_db(pipeline)


@router.put("/profiles/{profile_id}/pipelines/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline_endpoint(
    profile_id: int,
    pipeline_id: int,
    payload: PipelineUpdate,
    current_user: str = Depends(get_current_user),
):
    _assert_profile_owner(profile_id, current_user)
    pipeline = get_pipeline(pipeline_id)
    if not pipeline or pipeline["profile_id"] != profile_id:
        raise HTTPException(status_code=404, detail="Pipeline not found.")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    # Convert bool to int for SQLite
    if "workflow_configured" in updates:
        updates["workflow_configured"] = int(updates["workflow_configured"])
    updated = update_pipeline(pipeline_id, **updates)
    add_pipeline(updated)
    return PipelineResponse.from_db(updated)


@router.get("/profiles/{profile_id}/pipelines/{pipeline_id}/status",
            response_model=PipelineStatusResponse)
async def get_pipeline_status(
    profile_id: int,
    pipeline_id: int,
    current_user: str = Depends(get_current_user),
):
    _assert_profile_owner(profile_id, current_user)
    status = _pipeline_status.get(pipeline_id)
    if not status:
        return PipelineStatusResponse(running=False, step="", step_index=0)
    return PipelineStatusResponse(**status)


@router.delete("/profiles/{profile_id}/pipelines/{pipeline_id}", status_code=204)
async def delete_pipeline_endpoint(
    profile_id: int,
    pipeline_id: int,
    current_user: str = Depends(get_current_user),
):
    _assert_profile_owner(profile_id, current_user)
    pipeline = get_pipeline(pipeline_id)
    if not pipeline or pipeline["profile_id"] != profile_id:
        raise HTTPException(status_code=404, detail="Pipeline not found.")
    delete_pipeline(pipeline_id)
    remove_pipeline(pipeline_id)


@router.post("/profiles/{profile_id}/pipelines/{pipeline_id}/run",
             response_model=list[PostResponse])
async def run_pipeline(
    profile_id: int,
    pipeline_id: int,
    is_test: bool = False,
    current_user: str = Depends(get_current_user),
):
    """
    Manually trigger a pipeline run:
      scrape → process first product → generate caption → save as pending post.
    """
    profile = _assert_profile_owner(profile_id, current_user)
    pipeline = get_pipeline(pipeline_id)
    if not pipeline or pipeline["profile_id"] != profile_id:
        raise HTTPException(status_code=404, detail="Pipeline not found.")
    if pipeline["status"] != "active":
        raise HTTPException(status_code=400, detail="Pipeline is paused.")
    if not pipeline.get("workflow_configured"):
        raise HTTPException(status_code=400, detail="Workflow not configured. Please configure the workflow first.")

    gemini_key        = profile["gemini_api_key"] or None
    gemini_model      = profile.get("gemini_model") or "gemini-2.5-flash"
    image_model       = profile.get("image_model")  or "imagen-4.0-generate-001"
    currency          = profile.get("currency") or ""
    store_description = profile.get("description") or ""
    posts_per_run   = int(pipeline.get("posts_per_run") or 1)
    caption_prompt  = pipeline.get("caption_prompt") or ""
    image_prompt    = pipeline.get("image_prompt") or ""

    post_status = "test" if is_test else "pending"
    logger.info(
        "[Pipeline %d] Run started | profile=%d | model=%s | image_model=%s | posts_per_run=%d | test=%s | currency=%s",
        pipeline_id, profile_id, gemini_model, image_model, posts_per_run, is_test, currency or "from site",
    )

    try:
        # 1. Scrape the profile's URL
        await _set_status(pipeline_id, "Visiting store website…", 0)
        logger.info("[Pipeline %d] Step 1/4 — Scraping %s", pipeline_id, profile["url"])
        try:
            products, site_theme, site_title = await scrape_website(profile["url"])
        except Exception as e:
            logger.error("[Pipeline %d] Scraping failed: %s", pipeline_id, e)
            raise HTTPException(status_code=422, detail=f"Scraping failed: {e}")

        if not products:
            logger.warning("[Pipeline %d] No products found at %s", pipeline_id, profile["url"])
            raise HTTPException(status_code=404, detail="No products found on profile URL.")

        await _set_status(pipeline_id, "Fetching product details…", 1)
        logger.info(
            "[Pipeline %d] Scraped %d product(s) | site: %s | theme: %s",
            pipeline_id, len(products), site_title, site_theme[:60],
        )

        # Apply profile currency override to all scraped product prices
        if currency:
            products = [p.model_copy(update={"price": _apply_currency(p.price, currency)})
                        for p in products]
            logger.info("[Pipeline %d] Currency override applied: %s", pipeline_id, currency)

        # Filter out disabled products
        disabled_urls = get_disabled_product_urls(profile_id)
        if disabled_urls:
            before = len(products)
            products = [p for p in products if p.product_url not in disabled_urls]
            logger.info("[Pipeline %d] Filtered %d disabled product(s), %d remaining",
                        pipeline_id, before - len(products), len(products))

        if not products:
            raise HTTPException(status_code=404, detail="No eligible products (all are disabled).")

        # Randomly pick products for this run
        random.shuffle(products)

        created_posts = []
        for idx, product in enumerate(products[:posts_per_run], start=1):
            logger.info(
                "[Pipeline %d] Processing product %d/%d — '%s' | price=%s | desc=%d chars",
                pipeline_id, idx, posts_per_run, product.name, product.price, len(product.description),
            )
            try:
                # 2. Process image
                await _set_status(pipeline_id, f"Generating background image… ({idx}/{posts_per_run})", 2)
                logger.info("[Pipeline %d] Step 2/4 — Generating background image (model: %s)", pipeline_id, image_model)
                image_url_path, image_filename, actual_image_prompt = await process_product_image(
                    product=product,
                    site_theme=site_theme,
                    api_key=gemini_key,
                    image_model=image_model,
                    image_prompt_override=image_prompt or None,
                    store_description=store_description,
                )
                logger.info("[Pipeline %d] Image saved: %s", pipeline_id, image_filename)
                record_usage(profile_id, "gemini", "image")

                # 3. Generate caption — blocking network call, run in thread pool
                await _set_status(pipeline_id, f"Writing post caption… ({idx}/{posts_per_run})", 3)
                logger.info(
                    "[Pipeline %d] Step 3/4 — Generating caption (model: %s, languages: %s)",
                    pipeline_id, gemini_model, pipeline["languages"],
                )
                caption_text, actual_caption_prompt = await asyncio.to_thread(
                    generate_caption,
                    product.name,
                    product.price,
                    product.product_url,
                    profile["contact_number"] or "",
                    pipeline["languages"],
                    site_theme,
                    product.description,
                    gemini_key,
                    gemini_model,
                    caption_prompt or None,
                    store_description,
                )
                logger.info("[Pipeline %d] Caption generated (%d chars)", pipeline_id, len(caption_text))
                record_usage(profile_id, "gemini", "caption")

                # 4. Save post — sync SQLite write, run in thread pool
                await _set_status(pipeline_id, f"Saving posts… ({idx}/{posts_per_run})", 4)
                logger.info("[Pipeline %d] Step 4/4 — Saving post (status=%s)", pipeline_id, post_status)
                post = await asyncio.to_thread(create_post,
                    profile_id=profile_id,
                    pipeline_id=pipeline_id,
                    product_name=product.name,
                    product_url=product.product_url,
                    image_filename=image_filename,
                    image_url=image_url_path,
                    caption=caption_text,
                    platforms=pipeline["platforms"],
                    status=post_status,
                    product_description=product.description,
                    caption_prompt_used=actual_caption_prompt,
                    image_prompt_used=actual_image_prompt,
                )
                created_posts.append(PostResponse.from_db(post))
                logger.info("[Pipeline %d] Post %d created (id=%d)", pipeline_id, idx, post["id"])

            except Exception as e:
                logger.error("[Pipeline %d] Failed on product '%s': %s", pipeline_id, product.name, e)
                raise HTTPException(status_code=500, detail=f"Pipeline run failed: {e}")

        logger.info("[Pipeline %d] Run complete — %d post(s) created", pipeline_id, len(created_posts))
        return created_posts
    finally:
        await _clear_status(pipeline_id)
