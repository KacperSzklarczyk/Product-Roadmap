from tortoise import Tortoise

from config import settings

# Tortoise / aerich configuration. `aerich.models` must be registered so aerich
# can manage its own migration-history table. The aerich CLI reads this dict via
# the `[tool.aerich]` reference in pyproject.toml (tortoise_orm = "database.TORTOISE_ORM").
TORTOISE_ORM = {
    "connections": {"default": settings.DATABASE_URL},
    "apps": {
        "models": {
            "models": ["models", "aerich.models"],
            "default_connection": "default",
        }
    },
}


async def init_db() -> None:
    """Initialize Tortoise connections. Called from the FastAPI lifespan handler
    (not @app.on_event, which is deprecated). Schema is owned by aerich migrations
    in prod — we do NOT call generate_schemas here."""
    await Tortoise.init(config=TORTOISE_ORM)


async def close_db() -> None:
    await Tortoise.close_connections()
