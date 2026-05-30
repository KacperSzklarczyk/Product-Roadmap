from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import close_db, init_db
from routers import (
    audit,
    auth,
    comments,
    export,
    features,
    members,
    milestones,
    projects,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Tortoise in the lifespan context (not @app.on_event, which is
    # deprecated). Schema is applied via aerich migrations, not generate_schemas.
    await init_db()
    yield
    await close_db()


app = FastAPI(title="Product Roadmap Planner API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(features.router)
app.include_router(milestones.router)
app.include_router(members.router)
app.include_router(comments.router)
app.include_router(audit.router)
app.include_router(export.router)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
