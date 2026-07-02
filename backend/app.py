import json
import os
import random
import re
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from database import get_db, init_db

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

# 결제 금액의 1%를 포인트로 적립한다.
POINTS_RATE = 0.01

PHONE_PATTERN = re.compile(r"^01[0-9]-?\d{3,4}-?\d{4}$")

ORDER_STATUSES = ("pending", "preparing", "completed", "cancelled")

app = Flask(__name__, static_folder=None)

# gunicorn 등 WSGI 서버가 app.py를 import만 하고 __main__ 블록을 안 타는 경우에도
# DB 스키마가 준비되도록 모듈 로드 시점에 실행한다 (이미 DB 파일이 있으면 아무 것도 안 함).
init_db()


def row_to_dict(row):
    return dict(row)


# ─── 프론트엔드 정적 파일 서빙 ───

@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/admin")
def admin_index():
    return send_from_directory(FRONTEND_DIR, "admin.html")


@app.get("/admin/sales")
def admin_sales_page():
    return send_from_directory(FRONTEND_DIR, "sales.html")


@app.get("/admin/members")
def admin_members_page():
    return send_from_directory(FRONTEND_DIR, "members.html")


@app.get("/static/<path:path>")
def frontend_static(path):
    return send_from_directory(FRONTEND_DIR / "static", path)


# ─── 메뉴 관련 API ───

@app.get("/api/categories")
def get_categories():
    db = get_db()
    rows = db.execute("SELECT id, label, sub FROM categories ORDER BY sort_order").fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.get("/api/menu")
def get_menu():
    """카테고리별 메뉴 목록. ?category=coffee 로 특정 카테고리만 조회 가능."""
    category = request.args.get("category")
    db = get_db()
    if category:
        rows = db.execute(
            "SELECT * FROM menu_items WHERE category_id = ? ORDER BY id", (category,)
        ).fetchall()
        db.close()
        return jsonify([serialize_menu_item(r) for r in rows])

    cats = db.execute("SELECT id FROM categories ORDER BY sort_order").fetchall()
    result = {}
    for c in cats:
        rows = db.execute(
            "SELECT * FROM menu_items WHERE category_id = ? ORDER BY id", (c["id"],)
        ).fetchall()
        result[c["id"]] = [serialize_menu_item(r) for r in rows]
    db.close()
    return jsonify(result)


def serialize_menu_item(row):
    return {
        "id": row["id"],
        "category": row["category_id"],
        "group": row["sub_group"],
        "name": row["name"],
        "en": row["name_en"],
        "price": row["price"],
        "badge": row["badge"],
        "hotOnly": bool(row["hot_only"]),
        "iceOnly": bool(row["ice_only"]),
        "hasDecaf": bool(row["has_decaf"]),
        "hasBaekSize": bool(row["has_baek_size"]),
        "defaultIce": row["default_ice"],
    }


@app.get("/api/sizes")
def get_sizes():
    db = get_db()
    rows = db.execute("SELECT id, label, extra_price AS extra FROM sizes ORDER BY sort_order").fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.get("/api/extras")
def get_extras():
    db = get_db()
    rows = db.execute("SELECT id, label, price FROM extras").fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.get("/api/pay-methods")
def get_pay_methods():
    db = get_db()
    rows = db.execute("SELECT id, label, icon, color FROM pay_methods").fetchall()
    db.close()
    return jsonify([row_to_dict(r) for r in rows])


# ─── 주문 관련 API ───

def compute_unit_price(db, item, size_id, extra_ids):
    """item: menu_items 행. 커피 카테고리는 '기본/빽사이즈' 체계(빽사이즈는 extras의
    'baeksize' 항목으로 표현)를 쓰고, 그 외 카테고리는 기존 S/M/L 사이즈표를 쓴다."""
    total = item["price"]

    if item["category_id"] != "coffee":
        size = db.execute("SELECT extra_price FROM sizes WHERE id = ?", (size_id,)).fetchone()
        if size is None:
            raise ValueError(f"존재하지 않는 사이즈입니다: {size_id}")
        total += size["extra_price"]

    for eid in extra_ids:
        extra = db.execute("SELECT price FROM extras WHERE id = ?", (eid,)).fetchone()
        if extra is None:
            raise ValueError(f"존재하지 않는 옵션입니다: {eid}")
        if eid == "baeksize" and not item["has_baek_size"]:
            raise ValueError(f"'{item['name']}'은(는) 빽사이즈를 지원하지 않는 메뉴입니다.")
        total += extra["price"]

    return total


def normalize_phone(phone):
    """휴대폰 번호를 숫자만 남긴 표준형으로 정규화한다.
    대시(-) 유무와 상관없이 같은 번호가 항상 같은 문자열로 저장/조회되도록 한다."""
    return re.sub(r"\D", "", phone or "")


def member_points_balance(db, phone):
    row = db.execute("SELECT points_balance FROM members WHERE phone = ?", (phone,)).fetchone()
    return row["points_balance"] if row else 0


def adjust_member_points(db, phone, delta, order_id=None, memo=None):
    """회원 적립금 잔액을 delta만큼 가감하고(음수면 차감), 그 내역을 point_transactions에 남긴다.
    회원이 없으면 새로 만든다."""
    db.execute(
        "INSERT INTO members (phone, points_balance) VALUES (?, ?) "
        "ON CONFLICT(phone) DO UPDATE SET points_balance = points_balance + excluded.points_balance",
        (phone, delta),
    )
    balance_after = member_points_balance(db, phone)
    db.execute(
        """INSERT INTO point_transactions (phone, type, amount, balance_after, order_id, memo)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (phone, "earn" if delta > 0 else "use", abs(delta), balance_after, order_id, memo),
    )


@app.get("/api/members/<phone>/points")
def get_member_points(phone):
    if not PHONE_PATTERN.match(phone):
        return jsonify({"error": "휴대폰 번호 형식이 올바르지 않습니다. (예: 010-1234-5678)"}), 400
    db = get_db()
    balance = member_points_balance(db, normalize_phone(phone))
    db.close()
    return jsonify({"phone": phone, "balance": balance})


@app.post("/api/orders")
def create_order():
    payload = request.get_json(silent=True) or {}
    order_type = payload.get("orderType")
    pay_method = payload.get("payMethod")
    items = payload.get("items") or []
    member_phone = (payload.get("memberPhone") or "").strip() or None
    use_points = bool(payload.get("usePoints"))

    if order_type not in ("dine-in", "takeout"):
        return jsonify({"error": "orderType은 dine-in 또는 takeout 이어야 합니다."}), 400
    if not items:
        return jsonify({"error": "장바구니가 비어 있습니다."}), 400
    if member_phone and not PHONE_PATTERN.match(member_phone):
        return jsonify({"error": "휴대폰 번호 형식이 올바르지 않습니다. (예: 010-1234-5678)"}), 400
    if use_points and not member_phone:
        return jsonify({"error": "적립금을 사용하려면 휴대폰 번호가 필요합니다."}), 400
    # 대시 유무와 무관하게 항상 같은 형태로 저장해야 잔액 조회가 일관되게 맞는다.
    member_phone = normalize_phone(member_phone) if member_phone else None

    db = get_db()

    pm = db.execute("SELECT id FROM pay_methods WHERE id = ?", (pay_method,)).fetchone()
    if pm is None:
        db.close()
        return jsonify({"error": "유효하지 않은 결제수단입니다."}), 400

    prepared_items = []
    try:
        for it in items:
            menu_item_id = it.get("id")
            size = it.get("size")
            temp = it.get("temp")
            caffeine = it.get("caffeine") or "regular"
            ice_type = it.get("iceType") or "cube"
            qty = int(it.get("qty", 1))
            extras = it.get("extras") or []

            item = db.execute("SELECT * FROM menu_items WHERE id = ?", (menu_item_id,)).fetchone()
            if item is None:
                raise ValueError(f"존재하지 않는 메뉴입니다: {menu_item_id}")
            if temp not in ("ice", "hot"):
                raise ValueError("temp는 ice 또는 hot 이어야 합니다.")
            if qty < 1:
                raise ValueError("수량은 1 이상이어야 합니다.")
            if caffeine not in ("regular", "decaf"):
                raise ValueError("caffeine은 regular 또는 decaf 이어야 합니다.")
            if caffeine == "decaf" and not item["has_decaf"]:
                raise ValueError(f"'{item['name']}'은(는) 디카페인을 지원하지 않는 메뉴입니다.")
            if ice_type not in ("cube", "crushed"):
                raise ValueError("iceType은 cube 또는 crushed 이어야 합니다.")

            unit_price = compute_unit_price(db, item, size, extras)
            prepared_items.append({
                "menu_item_id": menu_item_id,
                "name": item["name"],
                "temp": temp,
                "size": size if item["category_id"] != "coffee" else "base",
                "caffeine": caffeine,
                "ice_type": ice_type,
                "extras": extras,
                "qty": qty,
                "unit_price": unit_price,
            })
    except ValueError as e:
        db.close()
        return jsonify({"error": str(e)}), 400

    # 메뉴 가격 합계(적립금 차감 전). 적립금을 사용하면 여기서 차감한 금액이
    # 실제 결제 총액이 되고, 부가세는 그 결제 총액을 기준으로 역산한다.
    menu_total = sum(i["unit_price"] * i["qty"] for i in prepared_items)

    if use_points:
        # 클라이언트가 보낸 적립금 액수는 신뢰하지 않고 서버에서 잔액을 다시 계산한다.
        points_used = min(member_points_balance(db, member_phone), menu_total)
        points_earned = 0
    else:
        points_used = 0
        # 휴대폰 번호를 입력해 적립을 선택한 경우에만 포인트를 적립한다.
        points_earned = round((menu_total - points_used) * POINTS_RATE) if member_phone else 0

    total = menu_total - points_used
    tax = round(total - total / 1.1)
    subtotal = total - tax
    order_number = str(random.randint(10, 99))

    cur = db.execute(
        """INSERT INTO orders (order_number, order_type, pay_method, subtotal, tax, total, points_earned, points_used, member_phone, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')""",
        (order_number, order_type, pay_method, subtotal, tax, total, points_earned, points_used, member_phone),
    )
    order_id = cur.lastrowid

    for i in prepared_items:
        db.execute(
            """INSERT INTO order_items
               (order_id, menu_item_id, name, temp, size, caffeine, ice_type, extras, qty, unit_price)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (order_id, i["menu_item_id"], i["name"], i["temp"], i["size"], i["caffeine"], i["ice_type"],
             json.dumps(i["extras"], ensure_ascii=False), i["qty"], i["unit_price"]),
        )

    if points_used > 0:
        adjust_member_points(db, member_phone, -points_used, order_id=order_id, memo=f"주문 #{order_number} 결제 시 사용")
    if points_earned > 0:
        adjust_member_points(db, member_phone, points_earned, order_id=order_id, memo=f"주문 #{order_number} 결제 적립")

    db.commit()
    db.close()

    return jsonify({
        "orderId": order_id,
        "orderNumber": order_number,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "pointsEarned": points_earned,
        "pointsUsed": points_used,
        "memberPhone": member_phone,
    }), 201


def serialize_order(order_row, items_rows):
    return {
        "id": order_row["id"],
        "orderNumber": order_row["order_number"],
        "orderType": order_row["order_type"],
        "payMethod": order_row["pay_method"],
        "subtotal": order_row["subtotal"],
        "tax": order_row["tax"],
        "total": order_row["total"],
        "pointsEarned": order_row["points_earned"],
        "pointsUsed": order_row["points_used"],
        "memberPhone": order_row["member_phone"],
        "status": order_row["status"],
        "createdAt": order_row["created_at"],
        "items": [
            {
                "id": it["id"],
                "menuItemId": it["menu_item_id"],
                "name": it["name"],
                "temp": it["temp"],
                "size": it["size"],
                "caffeine": it["caffeine"],
                "iceType": it["ice_type"],
                "extras": json.loads(it["extras"]),
                "qty": it["qty"],
                "unitPrice": it["unit_price"],
            }
            for it in items_rows
        ],
    }


@app.get("/api/orders/<int:order_id>")
def get_order(order_id):
    db = get_db()
    order = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if order is None:
        db.close()
        return jsonify({"error": "주문을 찾을 수 없습니다."}), 404
    items = db.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,)).fetchall()
    db.close()
    return jsonify(serialize_order(order, items))


# ─── 관리자: 주문 관리 API ───

@app.get("/api/admin/orders")
def admin_list_orders():
    """주문 목록(페이지네이션). ?status=pending&orderType=takeout&date=2026-07-02&q=12 로 필터링,
    ?limit=50&offset=0 으로 페이지 지정. q는 주문번호 부분 일치 검색.
    수년치 주문 이력이 쌓일 수 있으므로 date 등으로 범위를 좁히지 않으면 최신순으로 limit개만 반환한다."""
    status = request.args.get("status")
    order_type = request.args.get("orderType")
    date = request.args.get("date")
    q = request.args.get("q")
    limit = min(max(request.args.get("limit", 50, type=int), 1), 200)
    offset = max(request.args.get("offset", 0, type=int), 0)

    clauses, params = [], []
    if status:
        clauses.append("status = ?")
        params.append(status)
    if order_type:
        clauses.append("order_type = ?")
        params.append(order_type)
    if date:
        clauses.append("date(created_at) = ?")
        params.append(date)
    if q:
        clauses.append("order_number LIKE ?")
        params.append(f"%{q}%")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    db = get_db()
    total = db.execute(f"SELECT COUNT(*) AS c FROM orders {where}", params).fetchone()["c"]
    orders = db.execute(
        f"SELECT * FROM orders {where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
        [*params, limit, offset],
    ).fetchall()

    items_by_order = {}
    order_ids = [o["id"] for o in orders]
    if order_ids:
        placeholders = ",".join("?" * len(order_ids))
        for it in db.execute(
            f"SELECT * FROM order_items WHERE order_id IN ({placeholders})", order_ids
        ).fetchall():
            items_by_order.setdefault(it["order_id"], []).append(it)
    db.close()

    return jsonify({
        "orders": [serialize_order(o, items_by_order.get(o["id"], [])) for o in orders],
        "total": total,
        "limit": limit,
        "offset": offset,
    })


@app.get("/api/admin/members")
def admin_list_members():
    """휴대폰 번호별 적립금 현황(페이지네이션). ?q=1234 로 번호 부분 검색,
    ?sort=balance|phone (기본 balance desc), ?limit=50&offset=0 으로 페이지 지정."""
    q = request.args.get("q")
    sort = request.args.get("sort", "balance")
    limit = min(max(request.args.get("limit", 50, type=int), 1), 200)
    offset = max(request.args.get("offset", 0, type=int), 0)

    clauses, params = [], []
    if q:
        q_digits = normalize_phone(q)
        clauses.append("phone LIKE ?")
        params.append(f"%{q_digits}%")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    order_by = "phone ASC" if sort == "phone" else "points_balance DESC"

    db = get_db()
    total = db.execute(f"SELECT COUNT(*) AS c FROM members {where}", params).fetchone()["c"]
    totals = db.execute(
        f"SELECT COALESCE(SUM(points_balance),0) AS sum_balance, COUNT(*) AS c FROM members {where}", params
    ).fetchone()
    members = db.execute(
        f"SELECT * FROM members {where} ORDER BY {order_by} LIMIT ? OFFSET ?",
        [*params, limit, offset],
    ).fetchall()
    db.close()

    return jsonify({
        "members": [
            {"phone": m["phone"], "pointsBalance": m["points_balance"], "createdAt": m["created_at"]}
            for m in members
        ],
        "total": total,
        "totalBalance": totals["sum_balance"],
        "limit": limit,
        "offset": offset,
    })


@app.get("/api/admin/members/<phone>/transactions")
def admin_member_transactions(phone):
    """특정 회원의 적립/사용 내역(최신순, 페이지네이션)."""
    phone = normalize_phone(phone)
    limit = min(max(request.args.get("limit", 50, type=int), 1), 200)
    offset = max(request.args.get("offset", 0, type=int), 0)

    db = get_db()
    member = db.execute("SELECT * FROM members WHERE phone = ?", (phone,)).fetchone()
    if member is None:
        db.close()
        return jsonify({"error": "존재하지 않는 회원입니다."}), 404

    total = db.execute(
        "SELECT COUNT(*) AS c FROM point_transactions WHERE phone = ?", (phone,)
    ).fetchone()["c"]
    rows = db.execute(
        "SELECT * FROM point_transactions WHERE phone = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
        (phone, limit, offset),
    ).fetchall()
    db.close()

    return jsonify({
        "phone": phone,
        "pointsBalance": member["points_balance"],
        "transactions": [
            {
                "id": r["id"],
                "type": r["type"],
                "amount": r["amount"],
                "balanceAfter": r["balance_after"],
                "orderId": r["order_id"],
                "memo": r["memo"],
                "createdAt": r["created_at"],
            }
            for r in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    })


@app.get("/api/admin/summary")
def admin_summary():
    """주문 수 / 매출 / 적립 포인트 / 처리 대기 건수 요약.
    ?date=YYYY-MM-DD&orderType=takeout&q=12 로 /api/admin/orders와 동일한 조건을 걸 수 있다.
    date를 생략하면 전체 기간을 대상으로 한다 (status는 걸지 않는다 — pendingCount가 별도로 상태를 본다)."""
    date = request.args.get("date")
    order_type = request.args.get("orderType")
    q = request.args.get("q")

    clauses, params = [], []
    if date:
        clauses.append("date(created_at) = ?")
        params.append(date)
    if order_type:
        clauses.append("order_type = ?")
        params.append(order_type)
    if q:
        clauses.append("order_number LIKE ?")
        params.append(f"%{q}%")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    pending_where = where + (" AND " if clauses else "WHERE ") + "status IN ('pending','preparing')"

    db = get_db()
    row = db.execute(
        f"""SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(points_earned),0) AS points
            FROM orders {where}""",
        params,
    ).fetchone()
    pending = db.execute(f"SELECT COUNT(*) AS cnt FROM orders {pending_where}", params).fetchone()
    db.close()
    return jsonify({
        "count": row["cnt"],
        "revenue": row["revenue"],
        "points": row["points"],
        "pendingCount": pending["cnt"],
    })


@app.get("/api/admin/sales")
def admin_sales():
    """매출 상세 집계. 취소된 주문은 매출에서 제외한다.
    ?granularity=day|month|year (기본 day) — 매출 추이 집계 단위
    ?from=YYYY-MM-DD&to=YYYY-MM-DD — 조회 기간 (생략 시 전체 기간)
    """
    granularity = request.args.get("granularity", "day")
    if granularity not in ("day", "month", "year"):
        return jsonify({"error": "granularity는 day, month, year 중 하나여야 합니다."}), 400
    date_from = request.args.get("from")
    date_to = request.args.get("to")
    period_fmt = {"day": "%Y-%m-%d", "month": "%Y-%m", "year": "%Y"}[granularity]

    clauses, params = ["status != 'cancelled'"], []
    if date_from:
        clauses.append("date(created_at) >= ?")
        params.append(date_from)
    if date_to:
        clauses.append("date(created_at) <= ?")
        params.append(date_to)
    where = "WHERE " + " AND ".join(clauses)

    # 주문유형별 매출은 처리가 완료된 주문만 집계한다 (대기중/제조중/취소 제외).
    completed_clauses = ["status = 'completed'"]
    if date_from:
        completed_clauses.append("date(created_at) >= ?")
    if date_to:
        completed_clauses.append("date(created_at) <= ?")
    completed_where = "WHERE " + " AND ".join(completed_clauses)

    db = get_db()

    trend = db.execute(
        f"""SELECT strftime(?, created_at) AS period, COUNT(*) AS order_count,
                   COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(points_earned),0) AS points
            FROM orders {where}
            GROUP BY period ORDER BY period""",
        [period_fmt, *params],
    ).fetchall()

    by_payment_rows = db.execute(
        f"""SELECT pay_method, COUNT(*) AS order_count, COALESCE(SUM(total),0) AS revenue
            FROM orders {where}
            GROUP BY pay_method ORDER BY revenue DESC""",
        params,
    ).fetchall()
    pay_methods = {r["id"]: r for r in db.execute("SELECT * FROM pay_methods").fetchall()}

    by_type_rows = db.execute(
        f"""SELECT order_type, COUNT(*) AS order_count, COALESCE(SUM(total),0) AS revenue
            FROM orders {completed_where}
            GROUP BY order_type""",
        params,
    ).fetchall()

    totals = db.execute(
        f"""SELECT COUNT(*) AS order_count, COALESCE(SUM(total),0) AS revenue,
                   COALESCE(SUM(points_earned),0) AS points, COALESCE(AVG(total),0) AS avg_order
            FROM orders {where}""",
        params,
    ).fetchone()

    top_items = db.execute(
        f"""SELECT oi.name AS name, SUM(oi.qty) AS qty, SUM(oi.qty * oi.unit_price) AS revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            {where}
            GROUP BY oi.name ORDER BY revenue DESC LIMIT 5""",
        params,
    ).fetchall()

    db.close()

    total_revenue = totals["revenue"] or 0

    def pm_label(pid):
        return pay_methods[pid]["label"] if pid in pay_methods else pid

    def pm_icon(pid):
        return pay_methods[pid]["icon"] if pid in pay_methods else ""

    return jsonify({
        "granularity": granularity,
        "trend": [
            {"period": r["period"], "orderCount": r["order_count"], "revenue": r["revenue"], "points": r["points"]}
            for r in trend
        ],
        "byPayment": [
            {
                "payMethod": r["pay_method"],
                "label": pm_label(r["pay_method"]),
                "icon": pm_icon(r["pay_method"]),
                "orderCount": r["order_count"],
                "revenue": r["revenue"],
                "share": round(r["revenue"] / total_revenue * 100, 1) if total_revenue else 0,
            }
            for r in by_payment_rows
        ],
        "byOrderType": [
            {"orderType": r["order_type"], "orderCount": r["order_count"], "revenue": r["revenue"]}
            for r in by_type_rows
        ],
        "totals": {
            "orderCount": totals["order_count"],
            "revenue": totals["revenue"],
            "points": totals["points"],
            "avgOrder": round(totals["avg_order"]) if totals["avg_order"] else 0,
        },
        "topItems": [
            {"name": r["name"], "qty": r["qty"], "revenue": r["revenue"]}
            for r in top_items
        ],
    })


@app.patch("/api/admin/orders/<int:order_id>/status")
def admin_update_status(order_id):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")
    if status not in ORDER_STATUSES:
        return jsonify({"error": f"status는 {', '.join(ORDER_STATUSES)} 중 하나여야 합니다."}), 400

    db = get_db()
    order = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if order is None:
        db.close()
        return jsonify({"error": "주문을 찾을 수 없습니다."}), 404

    prev_status = order["status"]
    db.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))

    # 취소되면 이 주문에서 있었던 적립/사용 효과를 되돌리고, 취소가 다시 풀리면 재적용한다.
    if order["member_phone"]:
        phone = order["member_phone"]
        order_no = order["order_number"]
        if status == "cancelled" and prev_status != "cancelled":
            if order["points_used"] > 0:
                adjust_member_points(db, phone, order["points_used"], order_id=order_id,
                                      memo=f"주문 #{order_no} 취소로 적립금 환불")
            if order["points_earned"] > 0:
                revoke = min(order["points_earned"], member_points_balance(db, phone))
                if revoke > 0:
                    adjust_member_points(db, phone, -revoke, order_id=order_id,
                                          memo=f"주문 #{order_no} 취소로 적립 회수")
        elif prev_status == "cancelled" and status != "cancelled":
            if order["points_used"] > 0:
                rededuct = min(order["points_used"], member_points_balance(db, phone))
                if rededuct > 0:
                    adjust_member_points(db, phone, -rededuct, order_id=order_id,
                                          memo=f"주문 #{order_no} 취소 취소로 적립금 재차감")
            if order["points_earned"] > 0:
                adjust_member_points(db, phone, order["points_earned"], order_id=order_id,
                                      memo=f"주문 #{order_no} 취소 취소로 재적립")

    db.commit()
    order = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    items = db.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,)).fetchall()
    db.close()
    return jsonify(serialize_order(order, items))


if __name__ == "__main__":
    # host="0.0.0.0"으로 열어야 같은 컴퓨터가 아닌 외부(가상머신 바깥)에서도 접속할 수 있다.
    # 단, Flask 디버그 모드는 원격 코드 실행으로 이어질 수 있는 대화형 디버거를 노출하므로
    # 외부에 여는 배포 환경에서는 절대 켜면 안 된다 (기본값 꺼짐, 로컬 개발 시에만 FLASK_DEBUG=1로 명시적으로 켠다).
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    host = os.environ.get("FLASK_RUN_HOST", "0.0.0.0")
    port = int(os.environ.get("FLASK_RUN_PORT", 6000))
    app.run(debug=debug, host=host, port=port)
