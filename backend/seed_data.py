"""빽다방(paikdabang) 실제 커피 메뉴 체계를 반영한 시드 데이터.

커피는 온도(HOT/ICED) · 카페인(일반/디카페인, 일부 메뉴) · 얼음(각얼음/간얼음) ·
사이즈(기본 / 빽사이즈 32oz, 일부 메뉴만) 옵션 조합으로 구성된다.
논커피/주스/차/블랙펄/디저트는 기존 S/M/L 사이즈 체계를 그대로 사용한다.
"""

# 커피 메뉴는 하위 그룹(sub_group) 단위로 화면에 묶어서 보여준다.
COFFEE_GROUPS = [
    "아메리카노 계열",
    "에스프레소",
    "라떼 계열",
    "모카/마키아또",
    "콜드브루 라인",
    "시그니처 히트 메뉴",
]

CATEGORIES = [
    {"id": "coffee", "label": "커피", "sub": "COFFEE"},
    {"id": "noncoffee", "label": "논커피", "sub": "NON COFFEE"},
    {"id": "juice", "label": "주스/에이드", "sub": "JUICE/ADE"},
    {"id": "tea", "label": "차", "sub": "TEA"},
    {"id": "pearl", "label": "블랙펄", "sub": "TAPIOCA/PEARL"},
    {"id": "dessert", "label": "디저트", "sub": "DESSERT"},
]

MENU_ITEMS = {
    "coffee": [
        # ── 아메리카노 계열 ── (빽사이즈 32oz 업사이즈 대상)
        {"id": 101, "group": "아메리카노 계열", "name": "아메리카노", "en": "Americano", "price": 1500, "badge": "대표", "hotOnly": False, "iceOnly": False, "hasDecaf": True, "hasBaekSize": True, "defaultIce": "cube"},
        {"id": 102, "group": "아메리카노 계열", "name": "에어폼 아메리카노", "en": "Air Foam Americano", "price": 2000, "badge": None, "hotOnly": False, "iceOnly": True, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},
        {"id": 103, "group": "아메리카노 계열", "name": "꿀아메리카노", "en": "Honey Americano", "price": 2000, "badge": None, "hotOnly": False, "iceOnly": False, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},
        {"id": 104, "group": "아메리카노 계열", "name": "헤이즐넛아메리카노", "en": "Hazelnut Americano", "price": 2000, "badge": None, "hotOnly": False, "iceOnly": False, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},
        {"id": 105, "group": "아메리카노 계열", "name": "생크림 아메리카노", "en": "Whipped Cream Americano", "price": 2500, "badge": "신메뉴", "hotOnly": False, "iceOnly": False, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},

        # ── 에스프레소 ──
        {"id": 110, "group": "에스프레소", "name": "더블에스프레소", "en": "Double Espresso", "price": 2000, "badge": None, "hotOnly": True, "iceOnly": False, "hasDecaf": True, "hasBaekSize": False, "defaultIce": "cube"},

        # ── 모카/마키아또 ──
        {"id": 140, "group": "모카/마키아또", "name": "카페모카", "en": "Café Mocha", "price": 3200, "badge": None, "hotOnly": False, "iceOnly": False, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},
        {"id": 141, "group": "모카/마키아또", "name": "카라멜마키아또", "en": "Caramel Macchiato", "price": 3500, "badge": None, "hotOnly": False, "iceOnly": False, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},

        # ── 콜드브루 라인 ──
        {"id": 150, "group": "콜드브루 라인", "name": "콜드브루", "en": "Cold Brew", "price": 3000, "badge": None, "hotOnly": False, "iceOnly": True, "hasDecaf": True, "hasBaekSize": False, "defaultIce": "cube"},
        {"id": 151, "group": "콜드브루 라인", "name": "콜드브루라떼", "en": "Cold Brew Latte", "price": 3500, "badge": None, "hotOnly": False, "iceOnly": True, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},
        {"id": 152, "group": "콜드브루 라인", "name": "콜드브루 연유라떼", "en": "Cold Brew Condensed Milk Latte", "price": 3800, "badge": None, "hotOnly": False, "iceOnly": True, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},
        {"id": 153, "group": "콜드브루 라인", "name": "콜드브루 흑당라떼", "en": "Cold Brew Brown Sugar Latte", "price": 4000, "badge": None, "hotOnly": False, "iceOnly": True, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},
        {"id": 154, "group": "콜드브루 라인", "name": "크리미 콜드브루 바닐라", "en": "Creamy Cold Brew Vanilla", "price": 4200, "badge": "신메뉴", "hotOnly": False, "iceOnly": True, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},
        {"id": 155, "group": "콜드브루 라인", "name": "크리미 콜드브루 카라멜", "en": "Creamy Cold Brew Caramel", "price": 4200, "badge": "신메뉴", "hotOnly": False, "iceOnly": True, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},

        # ── 시그니처 히트 메뉴 ──
        {"id": 160, "group": "시그니처 히트 메뉴", "name": "원조커피", "en": "Original Coffee", "price": 2000, "badge": "대표메뉴", "hotOnly": False, "iceOnly": False, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "crushed"},
        {"id": 161, "group": "시그니처 히트 메뉴", "name": "아이스티샷추가 (아샷추)", "en": "Peach Iced Tea + Espresso Shot", "price": 3200, "badge": "인기", "hotOnly": False, "iceOnly": True, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},
        {"id": 162, "group": "시그니처 히트 메뉴", "name": "아이스티샷 망고추가 (아샷망추)", "en": "Peach Iced Tea + Shot + Mango", "price": 3700, "badge": "인기", "hotOnly": False, "iceOnly": True, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},
        {"id": 163, "group": "시그니처 히트 메뉴", "name": "레드불 꿀샷추", "en": "Red Bull Honey Espresso", "price": 4500, "badge": "신메뉴", "hotOnly": False, "iceOnly": True, "hasDecaf": False, "hasBaekSize": False, "defaultIce": "cube"},
    ],
    "noncoffee": [
        {"id": 20, "name": "그린티라떼", "en": "Green Tea Latte", "price": 3500, "badge": None, "hotOnly": False, "iceOnly": False},
        {"id": 21, "name": "초코라떼", "en": "Choco Latte", "price": 3500, "badge": None, "hotOnly": False, "iceOnly": False},
        {"id": 22, "name": "딸기라떼", "en": "Strawberry Latte", "price": 3700, "badge": "신상", "hotOnly": False, "iceOnly": False},
        {"id": 23, "name": "고구마라떼", "en": "Sweet Potato Latte", "price": 3700, "badge": None, "hotOnly": False, "iceOnly": False},
        {"id": 24, "name": "흑임자라떼", "en": "Black Sesame Latte", "price": 3900, "badge": "신상", "hotOnly": False, "iceOnly": False},
        {"id": 120, "name": "카페라떼", "en": "Café Latte", "price": 2500, "badge": None, "hotOnly": False, "iceOnly": False},
        {"id": 121, "name": "바닐라라떼", "en": "Vanilla Latte", "price": 3000, "badge": None, "hotOnly": False, "iceOnly": False},
        {"id": 122, "name": "헤이즐넛라떼", "en": "Hazelnut Latte", "price": 3000, "badge": None, "hotOnly": False, "iceOnly": False},
        {"id": 123, "name": "달달연유라떼", "en": "Sweet Condensed Milk Latte", "price": 3200, "badge": "인기", "hotOnly": False, "iceOnly": False},
        {"id": 124, "name": "흑당버블 카페라떼", "en": "Brown Sugar Bubble Latte", "price": 4000, "badge": "신메뉴", "hotOnly": False, "iceOnly": True},
        {"id": 125, "name": "바나나 카페라떼", "en": "Banana Café Latte", "price": 3200, "badge": None, "hotOnly": False, "iceOnly": False},
        {"id": 126, "name": "아이스크림 카페라떼", "en": "Ice Cream Café Latte", "price": 3700, "badge": None, "hotOnly": False, "iceOnly": True},
        {"id": 127, "name": "아이스크림 바닐라라떼", "en": "Ice Cream Vanilla Latte", "price": 3700, "badge": None, "hotOnly": False, "iceOnly": True},
        {"id": 128, "name": "아이스크림 카페모카", "en": "Ice Cream Café Mocha", "price": 3900, "badge": None, "hotOnly": False, "iceOnly": True},
        {"id": 129, "name": "피스타치오 생크림 카페라떼", "en": "Pistachio Whipped Latte", "price": 4200, "badge": "신메뉴", "hotOnly": False, "iceOnly": False},
    ],
    "juice": [
        {"id": 30, "name": "레몬에이드", "en": "Lemon Ade", "price": 3000, "badge": None, "hotOnly": False, "iceOnly": True},
        {"id": 31, "name": "자몽에이드", "en": "Grapefruit Ade", "price": 3000, "badge": None, "hotOnly": False, "iceOnly": True},
        {"id": 32, "name": "청포도에이드", "en": "Green Grape Ade", "price": 3000, "badge": None, "hotOnly": False, "iceOnly": True},
        {"id": 33, "name": "오렌지주스", "en": "Orange Juice", "price": 2500, "badge": None, "hotOnly": False, "iceOnly": True},
    ],
    "tea": [
        {"id": 40, "name": "유자차", "en": "Yuzu Tea", "price": 2500, "badge": None, "hotOnly": False, "iceOnly": False},
        {"id": 41, "name": "캐모마일차", "en": "Chamomile Tea", "price": 2500, "badge": None, "hotOnly": True, "iceOnly": False},
        {"id": 42, "name": "페퍼민트차", "en": "Peppermint Tea", "price": 2500, "badge": None, "hotOnly": True, "iceOnly": False},
        {"id": 43, "name": "히비스커스차", "en": "Hibiscus Tea", "price": 2800, "badge": None, "hotOnly": False, "iceOnly": False},
    ],
    "pearl": [
        {"id": 50, "name": "블랙펄 밀크티", "en": "Black Pearl Milk Tea", "price": 4000, "badge": "신메뉴", "hotOnly": False, "iceOnly": True},
        {"id": 51, "name": "블랙펄 스무디", "en": "Black Pearl Smoothie", "price": 4200, "badge": None, "hotOnly": False, "iceOnly": True},
        {"id": 52, "name": "블랙펄 라떼", "en": "Black Pearl Latte", "price": 3800, "badge": None, "hotOnly": False, "iceOnly": False},
    ],
    "dessert": [
        {"id": 60, "name": "크로와상", "en": "Croissant", "price": 2000, "badge": None, "hotOnly": False, "iceOnly": False},
        {"id": 61, "name": "마카롱 세트", "en": "Macaron Set", "price": 3500, "badge": None, "hotOnly": False, "iceOnly": False},
        {"id": 62, "name": "티라미수", "en": "Tiramisu", "price": 3500, "badge": None, "hotOnly": False, "iceOnly": False},
        {"id": 63, "name": "와플", "en": "Waffle", "price": 2800, "badge": None, "hotOnly": False, "iceOnly": False},
    ],
}

SIZES = [
    {"id": "S", "label": "Small", "extra": 0},
    {"id": "M", "label": "Medium", "extra": 300},
    {"id": "L", "label": "Large", "extra": 600},
]

EXTRAS = [
    {"id": "shot", "label": "에스프레소 샷 추가", "price": 500},
    {"id": "syrup", "label": "바닐라 시럽", "price": 300},
    {"id": "whip", "label": "휘핑크림 추가", "price": 500},
    {"id": "pearl", "label": "버블펄 추가", "price": 700},
    # 커피 메뉴 중 hasBaekSize=True 인 항목에서만 노출되는 사이즈 업그레이드
    {"id": "baeksize", "label": "빽사이즈 업그레이드 (946ml/32oz)", "price": 1000},
    # 텀블러 지참 할인 (모든 메뉴 공통)
    {"id": "tumbler", "label": "텀블러 지참 할인", "price": -100},
]

PAY_METHODS = [
    {"id": "card", "label": "신용/체크카드", "icon": "\U0001F4B3", "color": "#1A6CF5"},
    {"id": "cash", "label": "현금결제", "icon": "\U0001F4B5", "color": "#10B981"},
    {"id": "samsung", "label": "삼성페이", "icon": "⬛", "color": "#1428A0"},
    {"id": "kakao", "label": "카카오페이", "icon": "\U0001F7E1", "color": "#FEE500"},
    {"id": "naver", "label": "네이버페이", "icon": "\U0001F7E2", "color": "#03C75A"},
    {"id": "apple", "label": "Apple Pay", "icon": "\U0001F34E", "color": "#333"},
]


def seed(db):
    for i, c in enumerate(CATEGORIES):
        db.execute(
            "INSERT INTO categories (id, label, sub, sort_order) VALUES (?, ?, ?, ?)",
            (c["id"], c["label"], c["sub"], i),
        )

    for cat_id, items in MENU_ITEMS.items():
        for item in items:
            db.execute(
                """INSERT INTO menu_items
                   (id, category_id, sub_group, name, name_en, price, badge, hot_only, ice_only,
                    has_decaf, has_baek_size, default_ice)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (item["id"], cat_id, item.get("group"), item["name"], item["en"], item["price"],
                 item["badge"], int(item["hotOnly"]), int(item["iceOnly"]),
                 int(item.get("hasDecaf", False)), int(item.get("hasBaekSize", False)),
                 item.get("defaultIce", "cube")),
            )

    for i, s in enumerate(SIZES):
        db.execute(
            "INSERT INTO sizes (id, label, extra_price, sort_order) VALUES (?, ?, ?, ?)",
            (s["id"], s["label"], s["extra"], i),
        )

    for e in EXTRAS:
        db.execute("INSERT INTO extras (id, label, price) VALUES (?, ?, ?)", (e["id"], e["label"], e["price"]))

    for pm in PAY_METHODS:
        db.execute(
            "INSERT INTO pay_methods (id, label, icon, color) VALUES (?, ?, ?, ?)",
            (pm["id"], pm["label"], pm["icon"], pm["color"]),
        )

    db.commit()
