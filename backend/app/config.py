from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    books_dir: str = "/books"
    database_url: str = "sqlite+aiosqlite:///./data/bookshelf.db"
    redis_url: str = "redis://redis:6379/0"
    google_books_api_key: str = ""
    secret_key: str = "changeme"
    base_url: str = "http://localhost"

    kobo_enabled: bool = True
    opds_enabled: bool = True

    auto_apply_threshold: int = 80
    metadata_strategy: str = "prefer_online"  # prefer_online | fill_gaps
    preferred_source: str = "google_books"  # google_books | open_library

    covers_dir: str = ""
    author_photos_dir: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
