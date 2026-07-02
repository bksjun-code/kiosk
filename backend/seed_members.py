"""임의의 휴대폰 번호 100개에 5만원 이내의 적립금을 부여하고, 그 잔액이 어떻게
만들어졌는지 보여주는 적립/사용 내역(point_transactions)까지 함께 만든다.
실전 주문 이력과 무관하게 적립금 현황/사용내역 화면을 데모하기 위한 시드 데이터다.

실행:
    python seed_members.py
"""
import random
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "kiosk.db"

MEMBER_COUNT = 100
MAX_POINTS = 50000
HISTORY_DAYS = 180

random.seed(20260703)


def gen_phone(seen):
    while True:
        phone = "010" + "".join(str(random.randint(0, 9)) for _ in range(8))
        if phone not in seen:
            return phone


def split_amount(total, n):
    """total을 n개의 양의 정수로 무작위 분할한다."""
    if n <= 1:
        return [total]
    cuts = sorted(random.sample(range(1, total), n - 1)) if total > n - 1 else list(range(1, n))
    parts, prev = [], 0
    for c in cuts:
        parts.append(max(1, c - prev))
        prev = c
    parts.append(max(1, total - prev))
    # 반올림 오차 보정: 합이 total이 되도록 마지막 항목으로 맞춘다.
    parts[-1] += total - sum(parts)
    return parts


def gen_ledger(final_balance):
    """최종 잔액이 final_balance가 되는 적립(+사용) 이력을 시간순으로 만든다."""
    use_total = random.randint(500, 8000) if (random.random() < 0.4 and final_balance > 0) else 0
    earn_total = final_balance + use_total

    n_earn = random.randint(1, 5)
    earn_amounts = split_amount(earn_total, n_earn) if earn_total > 0 else []
    events = [("earn", amt, "적립금 지급 (프로모션)") for amt in earn_amounts]
    if use_total > 0:
        events.append(("use", use_total, "매장 결제 시 적립금 사용"))

    # 오래된 이벤트부터: days_ago를 내림차순으로 배정해 시간순(과거→현재)이 되게 한다.
    days_ago_list = sorted(
        (random.randint(1, HISTORY_DAYS) for _ in range(len(events))), reverse=True
    )

    ledger = []
    balance = 0
    now = datetime.now()
    for (etype, amount, memo), days_ago in zip(events, days_ago_list):
        balance += amount if etype == "earn" else -amount
        created_at = now - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        ledger.append({
            "type": etype,
            "amount": amount,
            "balance_after": balance,
            "memo": memo,
            "created_at": created_at.strftime("%Y-%m-%d %H:%M:%S"),
        })
    return ledger


def main():
    conn = sqlite3.connect(DB_PATH)

    seen = set()
    member_rows = []
    tx_rows = []
    for _ in range(MEMBER_COUNT):
        phone = gen_phone(seen)
        seen.add(phone)
        final_balance = random.randint(0, MAX_POINTS)
        ledger = gen_ledger(final_balance)
        member_rows.append((phone, final_balance))
        for tx in ledger:
            tx_rows.append((phone, tx["type"], tx["amount"], tx["balance_after"], None, tx["memo"], tx["created_at"]))

    conn.executemany("INSERT INTO members (phone, points_balance) VALUES (?, ?)", member_rows)
    conn.executemany(
        """INSERT INTO point_transactions (phone, type, amount, balance_after, order_id, memo, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        tx_rows,
    )
    conn.commit()

    total_members, total_balance = conn.execute(
        "SELECT COUNT(*), COALESCE(SUM(points_balance),0) FROM members"
    ).fetchone()
    total_tx = conn.execute("SELECT COUNT(*) FROM point_transactions").fetchone()[0]
    conn.close()
    print(f"완료: 회원 {total_members}명, 적립금 합계 {total_balance:,}P, 거래 내역 {total_tx:,}건")


if __name__ == "__main__":
    main()
