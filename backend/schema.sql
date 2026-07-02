-- 빽다방 키오스크 DB 스키마

DROP TABLE IF EXISTS point_transactions;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS sizes;
DROP TABLE IF EXISTS extras;
DROP TABLE IF EXISTS pay_methods;

CREATE TABLE categories (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  sub        TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE menu_items (
  id            INTEGER PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES categories(id),
  sub_group     TEXT,
  name          TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  price         INTEGER NOT NULL,
  badge         TEXT,
  hot_only      INTEGER NOT NULL DEFAULT 0,
  ice_only      INTEGER NOT NULL DEFAULT 0,
  has_decaf     INTEGER NOT NULL DEFAULT 0,
  has_baek_size INTEGER NOT NULL DEFAULT 0,
  default_ice   TEXT NOT NULL DEFAULT 'cube'
);

CREATE TABLE sizes (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  extra_price INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL
);

CREATE TABLE extras (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  price INTEGER NOT NULL
);

CREATE TABLE pay_methods (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon  TEXT NOT NULL,
  color TEXT NOT NULL
);

-- 휴대폰 번호(숫자만) 기준 적립금 잔액. 주문마다 SUM으로 다시 계산하지 않고
-- 적립/사용 시점에 이 테이블의 잔액을 직접 갱신한다.
CREATE TABLE members (
  phone          TEXT PRIMARY KEY,
  points_balance INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number  TEXT NOT NULL,
  order_type    TEXT NOT NULL CHECK (order_type IN ('dine-in','takeout')),
  pay_method    TEXT NOT NULL REFERENCES pay_methods(id),
  subtotal      INTEGER NOT NULL,
  tax           INTEGER NOT NULL,
  total         INTEGER NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  -- 이 주문에서 사용(차감)한 적립금. 적립금을 사용한 주문은 points_earned가 항상 0이다.
  points_used   INTEGER NOT NULL DEFAULT 0,
  -- 적립/적립금 사용 시에만 입력받는 휴대폰 번호. 둘 다 아니면 NULL.
  member_phone  TEXT,
  -- 주문 처리(제조) 상태. 결제는 키오스크에서 이미 완료된 상태로 생성된다.
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preparing','completed','cancelled')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- 적립금 적립/사용 이력(원장). 잔액은 members.points_balance가 최종값을 들고 있고,
-- 이 테이블은 "왜 그 값이 됐는지"를 시간순으로 보여주기 위한 히스토리다.
CREATE TABLE point_transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  phone         TEXT NOT NULL REFERENCES members(phone),
  type          TEXT NOT NULL CHECK (type IN ('earn','use','adjust')),
  amount        INTEGER NOT NULL, -- earn/adjust(+)는 양수, use는 차감된 양(양수)으로 기록
  balance_after INTEGER NOT NULL,
  order_id      INTEGER REFERENCES orders(id),
  memo          TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id),
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  name         TEXT NOT NULL,
  temp         TEXT NOT NULL CHECK (temp IN ('ice','hot')),
  size         TEXT NOT NULL,
  caffeine     TEXT NOT NULL DEFAULT 'regular' CHECK (caffeine IN ('regular','decaf')),
  ice_type     TEXT NOT NULL DEFAULT 'cube' CHECK (ice_type IN ('cube','crushed')),
  extras       TEXT NOT NULL DEFAULT '[]',
  qty          INTEGER NOT NULL,
  unit_price   INTEGER NOT NULL
);

-- 대량의 주문 이력(연 단위)에서 관리자 조회/집계가 풀스캔되지 않도록 인덱싱한다.
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_pay_method ON orders(pay_method);
CREATE INDEX idx_orders_order_type ON orders(order_type);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_point_transactions_phone ON point_transactions(phone, created_at DESC);
