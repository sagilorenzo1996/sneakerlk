import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth_deps import get_current_user
from app.scheduler import scheduler, load_all_pipelines
from app.ws_manager import connect as ws_connect, disconnect as ws_disconnect
from app.routers import (
    auth, caption, connections, image_processing, pipeline_images, pipelines,
    posts, profiles, publish, scraper, tracked_products,
)

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_all_pipelines()
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)

# ── App Init ──────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Social Marketing Automation API",
    version="2.0.0",
    description="Automate social media marketing for Shopify/e-commerce stores.",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static Files ──────────────────────────────────────────────────────────────

STATIC_DIR = Path(__file__).parent.parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "images").mkdir(exist_ok=True)
(STATIC_DIR / "ref_images").mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ── Routers ───────────────────────────────────────────────────────────────────

_auth = [Depends(get_current_user)]

# Public
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

# Protected — core workflow
app.include_router(scraper.router,          prefix="/api/scrape",  tags=["Scraper"],          dependencies=_auth)
app.include_router(image_processing.router, prefix="/api/image",   tags=["Image Processing"], dependencies=_auth)
app.include_router(caption.router,          prefix="/api/caption", tags=["Caption"],          dependencies=_auth)
app.include_router(publish.router,          prefix="/api/publish", tags=["Publish"],          dependencies=_auth)

# Protected — profiles, pipelines, posts
app.include_router(profiles.router,         prefix="/api/profiles", tags=["Profiles"],         dependencies=_auth)
app.include_router(connections.router,      prefix="/api/profiles/{profile_id}/connections", tags=["Connections"], dependencies=_auth)
app.include_router(pipelines.router,        prefix="/api",          tags=["Pipelines"],        dependencies=_auth)
app.include_router(pipeline_images.router,  prefix="/api",          tags=["Pipeline Images"],  dependencies=_auth)
app.include_router(posts.router,            prefix="/api",          tags=["Posts"],            dependencies=_auth)
app.include_router(tracked_products.router, prefix="/api",          tags=["Tracked Products"], dependencies=_auth)

# ── WebSocket — pipeline status ───────────────────────────────────────────────

@app.websocket("/ws/pipeline/{pipeline_id}")
async def pipeline_ws(websocket: WebSocket, pipeline_id: int):
    await ws_connect(pipeline_id, websocket)
    try:
        while True:
            await websocket.receive_text()   # keep connection alive; client sends nothing
    except WebSocketDisconnect:
        ws_disconnect(pipeline_id, websocket)

# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
