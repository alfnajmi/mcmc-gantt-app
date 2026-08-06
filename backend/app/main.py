"""FastAPI application entry point — Multi-project Gantt Platform."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import database
from app.config import CORS_ORIGINS
from app.routers import links, tasks, projects, csv_import

STATIC_DIR = Path("static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.connect()
    yield
    await database.disconnect()


app = FastAPI(
    title="Gantt Platform",
    description="Multi-project Gantt chart platform. Create projects, import CSV, embed anywhere.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(projects.router)
app.include_router(csv_import.router)
app.include_router(tasks.router)
app.include_router(links.router)


@app.get("/api/health")
async def health():
    pool = database.get_pool()
    async with pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM gantt_projects")
    return {"status": "ok", "projects": count, "version": "2.0.0"}


# --- Page routes ---

@app.get("/admin")
async def admin_page():
    """Admin panel — create, configure, import projects."""
    return FileResponse(STATIC_DIR / "admin.html")


@app.get("/project/{slug}")
async def project_page(slug: str):
    """Full Gantt editor for a project."""
    return FileResponse(STATIC_DIR / "project.html")


@app.get("/embed/{slug}")
async def embed_page(slug: str):
    """Read-only embeddable Gantt view."""
    return FileResponse(STATIC_DIR / "project.html")


# Serve remaining static assets (CSS, JS, images)
app.mount("/static", StaticFiles(directory="static"), name="static-assets")


# Root landing page
@app.get("/")
async def landing():
    return FileResponse(STATIC_DIR / "index.html")
