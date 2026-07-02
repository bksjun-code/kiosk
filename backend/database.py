import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "kiosk.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """DB 파일이 없으면 스키마를 만들고 초기 메뉴 데이터를 시드한다."""
    is_new = not DB_PATH.exists()
    conn = get_db()
    if is_new:
        with open(SCHEMA_PATH, encoding="utf-8") as f:
            conn.executescript(f.read())
        from seed_data import seed
        seed(conn)
    conn.close()
