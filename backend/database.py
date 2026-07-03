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


def _migrate_pay_methods(conn):
    """이미 배포된(기존) DB에도 새로 추가된 결제수단이 누락 없이 반영되도록,
    seed_data.PAY_METHODS 기준으로 없는 행만 채워 넣는다. 기존 행은 건드리지
    않으므로 과거 주문이 참조하는 결제수단(FK)도 안전하다."""
    from seed_data import PAY_METHODS

    existing = {row["id"] for row in conn.execute("SELECT id FROM pay_methods")}
    for pm in PAY_METHODS:
        if pm["id"] not in existing:
            conn.execute(
                "INSERT INTO pay_methods (id, label, icon, color) VALUES (?, ?, ?, ?)",
                (pm["id"], pm["label"], pm["icon"], pm["color"]),
            )
    conn.commit()


def init_db():
    """DB 파일이 없으면 스키마를 만들고 초기 메뉴 데이터를 시드한다.
    이미 있는 DB(운영 환경 포함)라면 스키마는 그대로 두고, 코드 업데이트로
    새로 추가된 결제수단만 채워 넣는다."""
    is_new = not DB_PATH.exists()
    conn = get_db()
    if is_new:
        with open(SCHEMA_PATH, encoding="utf-8") as f:
            conn.executescript(f.read())
        from seed_data import seed
        seed(conn)
    else:
        _migrate_pay_methods(conn)
    conn.close()
