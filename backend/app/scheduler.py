"""
APScheduler-based pipeline scheduler.

Each active pipeline with a non-manual schedule gets a cron job that:
  1. Runs the pipeline (scrape → image → caption → save as pending)
  2. Posts are saved as "pending" for user approval, same as a manual run.

Schedule values:
  "daily"  → runs every day at post_time (HH:MM)
  "weekly" → runs every Monday at post_time
  "manual" → never scheduled (skipped)
"""
import asyncio
import logging
import random
import re

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import (
    get_disabled_product_urls, get_pipelines_by_profile,
    get_profile, get_profiles_by_user, get_users,
    create_post, record_usage,
)
from app.services.gemini_service import generate_caption
from app.services.image_service import process_product_image
from app.services.scraper_service import scrape_website
from app.ws_manager import broadcast

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _apply_currency(price: str, currency: str) -> str:
    numeric = re.sub(r"^[^\d]*", "", price).strip()
    return f"{currency} {numeric}" if numeric else price


def _job_id(pipeline_id: int) -> str:
    return f"pipeline_{pipeline_id}"


# ── Core run logic ────────────────────────────────────────────────────────────

async def _run_pipeline(pipeline_id: int) -> None:
    """Execute a scheduled pipeline run — identical logic to the manual run endpoint."""
    from app.database import get_pipeline  # local import to avoid circular at module load

    pipeline = get_pipeline(pipeline_id)
    if not pipeline:
        logger.warning("[Scheduler] Pipeline %d not found, skipping.", pipeline_id)
        return
    if pipeline["status"] != "active":
        logger.info("[Scheduler] Pipeline %d is paused, skipping.", pipeline_id)
        return

    profile = get_profile(pipeline["profile_id"])
    if not profile:
        logger.warning("[Scheduler] Profile for pipeline %d not found.", pipeline_id)
        return

    gemini_key        = profile["gemini_api_key"] or None
    gemini_model      = profile.get("gemini_model") or "gemini-2.5-flash"
    image_model       = profile.get("image_model")  or "imagen-4.0-generate-001"
    currency          = profile.get("currency") or ""
    store_description = profile.get("description") or ""
    posts_per_run     = int(pipeline.get("posts_per_run") or 1)
    caption_prompt    = pipeline.get("caption_prompt") or ""
    image_prompt      = pipeline.get("image_prompt") or ""
    profile_id        = pipeline["profile_id"]

    logger.info("[Scheduler] Running pipeline %d (profile %d)", pipeline_id, profile_id)

    try:
        await broadcast(pipeline_id, running=True, step="Visiting store website…", step_index=0)
        try:
            products, site_theme, _ = await scrape_website(profile["url"])
        except Exception as e:
            logger.error("[Scheduler] Pipeline %d scrape failed: %s", pipeline_id, e)
            await broadcast(pipeline_id, running=False)
            return

        if not products:
            logger.warning("[Scheduler] Pipeline %d: no products found.", pipeline_id)
            await broadcast(pipeline_id, running=False)
            return

        if currency:
            products = [p.model_copy(update={"price": _apply_currency(p.price, currency)})
                        for p in products]

        disabled_urls = get_disabled_product_urls(profile_id)
        products = [p for p in products if p.product_url not in disabled_urls]

        if not products:
            logger.warning("[Scheduler] Pipeline %d: all products disabled.", pipeline_id)
            await broadcast(pipeline_id, running=False)
            return

        random.shuffle(products)

        for idx, product in enumerate(products[:posts_per_run], start=1):
            try:
                await broadcast(pipeline_id, running=True,
                                step=f"Generating background image… ({idx}/{posts_per_run})", step_index=2)
                image_url_path, image_filename, actual_image_prompt = await process_product_image(
                    product=product,
                    site_theme=site_theme,
                    api_key=gemini_key,
                    image_model=image_model,
                    image_prompt_override=image_prompt or None,
                    store_description=store_description,
                )
                record_usage(profile_id, "gemini", "image")

                await broadcast(pipeline_id, running=True,
                                step=f"Writing post caption… ({idx}/{posts_per_run})", step_index=3)
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
                record_usage(profile_id, "gemini", "caption")

                await broadcast(pipeline_id, running=True,
                                step=f"Saving posts… ({idx}/{posts_per_run})", step_index=4)
                await asyncio.to_thread(create_post,
                    profile_id=profile_id,
                    pipeline_id=pipeline_id,
                    product_name=product.name,
                    product_url=product.product_url,
                    image_filename=image_filename,
                    image_url=image_url_path,
                    caption=caption_text,
                    platforms=pipeline["platforms"],
                    status="pending",
                    product_description=product.description,
                    caption_prompt_used=actual_caption_prompt,
                    image_prompt_used=actual_image_prompt,
                )
                logger.info("[Scheduler] Pipeline %d: post created for '%s'", pipeline_id, product.name)

            except Exception as e:
                logger.error("[Scheduler] Pipeline %d: failed on '%s': %s", pipeline_id, product.name, e)

    finally:
        await broadcast(pipeline_id, running=False)


# ── Schedule management ───────────────────────────────────────────────────────

def _cron_trigger(schedule: str, post_time: str) -> CronTrigger | None:
    """Return a CronTrigger for the given schedule, or None if manual."""
    try:
        hour, minute = post_time.split(":")
    except Exception:
        hour, minute = "9", "0"

    if schedule == "daily":
        return CronTrigger(hour=int(hour), minute=int(minute))
    if schedule == "weekly":
        return CronTrigger(day_of_week="mon", hour=int(hour), minute=int(minute))
    return None  # manual


def add_pipeline(pipeline: dict) -> None:
    """Add or replace a scheduled job for this pipeline."""
    job_id = _job_id(pipeline["id"])
    trigger = _cron_trigger(pipeline["schedule"], pipeline.get("post_time", "09:00"))

    if trigger is None:
        remove_pipeline(pipeline["id"])
        return

    if pipeline["status"] != "active":
        remove_pipeline(pipeline["id"])
        return

    scheduler.add_job(
        _run_pipeline,
        trigger=trigger,
        args=[pipeline["id"]],
        id=job_id,
        replace_existing=True,
        misfire_grace_time=300,
    )
    logger.info(
        "[Scheduler] Scheduled pipeline %d — %s at %s",
        pipeline["id"], pipeline["schedule"], pipeline.get("post_time"),
    )


def remove_pipeline(pipeline_id: int) -> None:
    job_id = _job_id(pipeline_id)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info("[Scheduler] Removed job for pipeline %d", pipeline_id)


def load_all_pipelines() -> None:
    """On startup, schedule all active non-manual pipelines from the DB."""
    try:
        users = get_users()
    except Exception as e:
        logger.error("[Scheduler] Could not load users: %s", e)
        return

    for user in users:
        for profile in get_profiles_by_user(user["id"]):
            for pipeline in get_pipelines_by_profile(profile["id"]):
                if pipeline["schedule"] != "manual" and pipeline["status"] == "active":
                    add_pipeline(pipeline)
