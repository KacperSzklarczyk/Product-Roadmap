from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, loaded from environment variables.

    All secrets come from the environment (Railway env vars in prod, .env locally)
    — never hardcoded. See backend/.env.example for the expected keys.
    """

    DATABASE_URL: str
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    FRONTEND_URL: str = "http://localhost:3000"

    # AI feature extraction (Anthropic). Key is optional so the app boots without it;
    # the ai-draft endpoint returns 503 when it's unset.
    ANTHROPIC_API_KEY: str | None = None
    AI_MODEL: str = "claude-sonnet-4-6"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
