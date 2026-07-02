import os
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
# Azure 등 배포 환경에서는 코드 재배포 시에도 DB가 지워지지 않도록 코드 폴더 밖의
# 영구 저장 경로(예: /home/data/kiosk.db)를 KIOSK_DB_PATH로 지정해 쓸 수 있다.
DB_PATH = Path(os.environ.get("KIOSK_DB_PATH", BASE_DIR / "kiosk.db"))
SCHEMA_PATH = BASE_DIR / "schema.sql"


def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
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
