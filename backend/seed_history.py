"""2014-01-01부터 오늘까지의 과거 주문 데이터를 생성해 kiosk.db에 대량 삽입한다.
하루 평균 125건을 기준으로 연도별(±30%대)/계절별/일별(±30%) 배율을 곱해 매출 추이에
자연스러운 굴곡이 생기도록 한다 (연도별·월별·일별 매출이 완전히 평평해지지 않도록).
메뉴/사이즈/옵션/결제수단 카탈로그가 이미 시드되어 있어야 한다 (database.init_db()가 처리).

실행:
    python seed_history.py
"""
import json
import math
import os
import random
import sqlite3
import time
from datetime import date, datetime, timedelta
from pathlib import Path

DB_PATH = Path(os.environ.get("KIOSK_DB_PATH", Path(__file__).resolve().parent / "kiosk.db"))

START_DATE = date(2014, 1, 1)
END_DATE = date.today()
BASE_ORDERS_PER_DAY = 125

TAX_RATE = 0.1
POINTS_RATE = 0.01

random.seed(20140101)

# 연도별 매출 규모를 30% 이상 들쭉날쭉하게 만들기 위한 연도별 배율.
# (해당 연도가 목록에 없으면 1.0을 사용 — END_DATE가 미래로 넘어가도 안전)
YEAR_FACTORS = {
    2014: 0.72, 2015: 1.18, 2016: 0.85, 2017: 1.32, 2018: 0.95,
    2019: 1.25, 2020: 0.68, 2021: 1.10, 2022: 0.80, 2023: 1.35,
    2024: 0.90, 2025: 1.20, 2026: 0.75, 2027: 1.05, 2028: 0.88,
}


def year_factor(year):
    return YEAR_FACTORS.get(year, 1.0)


def month_factor(month):
    # 여름 성수기(아이스 음료) 피크 + 겨울 비수기 저점의 계절성 곡선 (진폭 ±25%)
    return 1.0 + 0.25 * math.sin(2 * math.pi * (month - 4) / 12)


def day_factor():
    # 일별 변동 ±30%
    return random.uniform(0.7, 1.3)


def load_catalog(conn):
    menu_items = conn.execute(
        "SELECT id, category_id, price, has_baek_size, has_decaf, default_ice, hot_only, ice_only FROM menu_items"
    ).fetchall()
    sizes = dict(conn.execute("SELECT id, extra_price FROM sizes").fetchall())
    extras = dict(conn.execute("SELECT id, price FROM extras").fetchall())
    pay_methods = [r[0] for r in conn.execute("SELECT id FROM pay_methods").fetchall()]
    return menu_items, sizes, extras, pay_methods


def compute_unit_price(item, size_id, extra_ids, sizes, extras):
    _id, category, price, has_baek, _has_decaf, _default_ice, _hot_only, _ice_only = item
    total = price
    if category != "coffee":
        total += sizes[size_id]
    for eid in extra_ids:
        total += extras[eid]
    return total


def gen_order_time(day):
    # 07:00 ~ 22:00 사이 영업시간 랜덤 시각
    hour = random.randint(7, 21)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)
    return datetime(day.year, day.month, day.day, hour, minute, second)


def gen_order(day, coffee_items, other_items, sizes, extras, pay_methods, is_today):
    order_type = random.choices(["dine-in", "takeout"], weights=[55, 45])[0]
    pay_method = random.choice(pay_methods)
    n_items = random.choices([1, 2, 3], weights=[60, 30, 10])[0]

    items = []
    subtotal = 0
    for _ in range(n_items):
        pool = coffee_items if (not other_items or random.random() < 0.7) else other_items
        item = random.choice(pool)
        iid, category, price, has_baek, has_decaf, default_ice, hot_only, ice_only = item

        if hot_only:
            temp = "hot"
        elif ice_only:
            temp = "ice"
        else:
            temp = random.choice(["ice", "hot"])

        caffeine = "decaf" if (has_decaf and random.random() < 0.12) else "regular"

        if temp == "ice":
            ice_type = default_ice
            if random.random() < 0.15:
                ice_type = "crushed" if ice_type == "cube" else "cube"
        else:
            ice_type = "cube"

        extra_ids = []
        if category == "coffee":
            size_id = "base"
            if has_baek and random.random() < 0.2:
                extra_ids.append("baeksize")
        else:
            size_id = random.choices(["S", "M", "L"], weights=[20, 55, 25])[0]

        for eid in ("shot", "syrup", "whip", "pearl"):
            if random.random() < 0.12:
                extra_ids.append(eid)
        if random.random() < 0.08:
            extra_ids.append("tumbler")

        qty = random.choices([1, 2], weights=[80, 20])[0]
        unit_price = compute_unit_price(item, size_id, extra_ids, sizes, extras)
        subtotal += unit_price * qty
        items.append((iid, temp, size_id, caffeine, ice_type, extra_ids, qty, unit_price))

    # 메뉴 가격은 부가세 포함가다. subtotal(현재까지 누적한 값)이 곧 결제 총액이고,
    # 포함된 부가세를 역산해 공급가액/부가세로 표시용으로만 분리한다.
    total = subtotal
    tax = round(total - total / (1 + TAX_RATE))
    subtotal = total - tax
    points = round(total * POINTS_RATE)
    order_number = str(random.randint(10, 99))

    if is_today:
        status = random.choices(["pending", "preparing", "completed", "cancelled"], weights=[15, 10, 70, 5])[0]
    else:
        status = random.choices(["completed", "cancelled"], weights=[96, 4])[0]

    created_at = gen_order_time(day).strftime("%Y-%m-%d %H:%M:%S")

    order_row = (order_number, order_type, pay_method, subtotal, tax, total, points, status, created_at)
    return order_row, items


def main():
    t0 = time.time()
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = OFF")

    existing = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
    if existing:
        print(f"orders 테이블에 이미 {existing}건이 있습니다. 계속하면 데이터가 추가로 쌓입니다.")

    menu_items, sizes, extras, pay_methods = load_catalog(conn)
    coffee_items = [m for m in menu_items if m[1] == "coffee"]
    other_items = [m for m in menu_items if m[1] != "coffee"]

    next_id = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM orders").fetchone()[0]
    next_item_id = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM order_items").fetchone()[0]

    order_buf, item_buf = [], []
    total_orders = 0
    total_items = 0
    day = START_DATE
    day_count = 0

    # name은 menu_items에서 매번 조회하면 느리므로 미리 맵으로 들고 있는다.
    name_by_id = dict(conn.execute("SELECT id, name FROM menu_items").fetchall())

    while day <= END_DATE:
        is_today = day == END_DATE
        n = round(BASE_ORDERS_PER_DAY * year_factor(day.year) * month_factor(day.month) * day_factor())
        n = max(20, n)
        for _ in range(n):
            order_row, items = gen_order(day, coffee_items, other_items, sizes, extras, pay_methods, is_today)
            order_id = next_id
            next_id += 1
            order_buf.append((order_id, *order_row))
            for (iid, temp, size_id, caffeine, ice_type, extra_ids, qty, unit_price) in items:
                item_id = next_item_id
                next_item_id += 1
                item_buf.append((
                    item_id, order_id, iid, name_by_id[iid], temp, size_id, caffeine, ice_type,
                    json.dumps(extra_ids, ensure_ascii=False), qty, unit_price,
                ))
            total_orders += 1
            total_items += len(items)

        day_count += 1
        day += timedelta(days=1)

        if len(order_buf) >= 20000 or day > END_DATE:
            conn.executemany(
                "INSERT INTO orders (id, order_number, order_type, pay_method, subtotal, tax, total, "
                "points_earned, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                order_buf,
            )
            conn.executemany(
                "INSERT INTO order_items (id, order_id, menu_item_id, name, temp, size, caffeine, "
                "ice_type, extras, qty, unit_price) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                item_buf,
            )
            conn.commit()
            order_buf.clear()
            item_buf.clear()
            elapsed = time.time() - t0
            print(f"  {day.isoformat()} 까지 처리 완료 - 누적 주문 {total_orders:,}건, 상품 {total_items:,}건 ({elapsed:.1f}s)")

    conn.close()
    elapsed = time.time() - t0
    print(f"완료: {START_DATE} ~ {END_DATE} ({day_count}일), 주문 {total_orders:,}건, 상품 {total_items:,}건, {elapsed:.1f}초 소요")


if __name__ == "__main__":
    main()
