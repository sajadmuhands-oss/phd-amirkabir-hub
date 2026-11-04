import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", BASE_DIR / "uploads"))

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
for folder in ("research", "presentations", "documents", "misc"):
    (UPLOADS_DIR / folder).mkdir(parents=True, exist_ok=True)


def _database_url() -> str:
    url = (os.getenv("DATABASE_URL") or "").strip()
    if not url:
        return f"sqlite:///{DATA_DIR / 'phd_hub.db'}"
    # Render / Heroku يعطيان postgres:// وSQLAlchemy يتوقع postgresql://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and "+psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = _database_url()
IS_SQLITE = DATABASE_URL.startswith("sqlite")

engine_kwargs = {}
if IS_SQLITE:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
