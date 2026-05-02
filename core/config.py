from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    supabase_url: str = ""
    supabase_service_key: str = ""
    alpha_vantage_api_key: str = ""
    fred_api_key: str = ""
    news_api_key: str = ""
    polygon_api_key: str = ""
    finnhub_api_key: str = ""
    deepgram_api_key: str = ""
    demo_user_id: str = ""

    # `extra="ignore"` so unrelated keys in .env (e.g. used only by scripts)
    # don't crash the app at import time.
    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=False, extra="ignore"
    )


settings = Settings()
