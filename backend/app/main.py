"""FastAPI application entry point — Gantt API (Plane-powered)."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import plane_gantt
from app.services import cache


@asynccontextmanager
async def lifespan(app: FastAPI):
    await cache.connect()
    yield
    await cache.disconnect()


app = FastAPI(
    title="Gantt API",
    description="Gantt chart API powered by Plane.so. Serves dhtmlxGantt-compatible data for projects, issues, cycles, and modules.",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API router (Plane-sourced)
app.include_router(plane_gantt.router)


@app.get("/")
async def root():
    return {"service": "gantt-api", "engine": "plane", "version": "3.0.0"}
