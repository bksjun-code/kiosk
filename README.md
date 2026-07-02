# 빽다방 키오스크 (Flask + SQLite)

원본 `백다방 키오스크.html`(단일 React 파일)을 프론트엔드/백엔드로 분리했습니다.

## 구조

```
kiosk-app/
  backend/
    app.py          Flask 앱, REST API
    database.py     SQLite 연결/초기화
    schema.sql       테이블 정의
    seed_data.py     메뉴/사이즈/옵션/결제수단 초기 데이터
    seed_history.py  2014년~오늘까지 대량 주문 이력 생성 스크립트 (테스트/데모용)
    requirements.txt
  frontend/
    index.html        키오스크 주문 화면 (고객용)
    admin.html         주문 관리 대시보드 (직원용)
    sales.html          매출 상세 대시보드 (직원용)
    static/js/app.js        키오스크 React 앱
    static/js/admin.js      주문 관리 React 앱
    static/js/sales.js      매출 상세 React 앱
    static/js/admin-nav.js  관리자 화면 공용 상단 내비게이션
    static/js/ds-bundle.js  iOS/iPadOS 26 디자인 시스템 컴포넌트
    static/css/      디자인 토큰 CSS
```

## 실행

```bash
cd backend
pip install -r requirements.txt
python app.py
```

- 키오스크(고객용): http://localhost:5000
- 주문 관리(직원용): http://localhost:5000/admin
- 매출 상세(직원용): http://localhost:5000/admin/sales

최초 실행 시 `backend/kiosk.db`가 자동 생성되고 메뉴 데이터가 시드됩니다.

### 대량 주문 이력 생성 (선택)

주문 관리/매출 상세 화면을 실제 데이터처럼 테스트하려면:

```bash
cd backend
python seed_history.py
```

2014-01-01부터 오늘까지 매일 100~150건(옵션 조합·결제수단·주문유형을 무작위로 섞은)의 주문을 `orders`/`order_items`에 직접 대량 삽입한다 (57만여 건, 약 20초 소요). 이미 데이터가 있는 상태에서 다시 실행하면 누적된다 — 초기화하려면 `kiosk.db`를 지우고 서버를 다시 실행해 스키마를 재생성한 뒤 실행한다.

## API

### 메뉴
- `GET /api/categories` — 카테고리 목록
- `GET /api/menu` / `GET /api/menu?category=coffee` — 메뉴
- `GET /api/sizes` — 사이즈(S/M/L, 커피 외 카테고리용)
- `GET /api/extras` — 추가 옵션 (빽사이즈 업그레이드·텀블러 할인 포함)
- `GET /api/pay-methods` — 결제 수단

### 주문 (키오스크)
- `POST /api/orders` — 주문 생성 (`{orderType, payMethod, items:[{id,temp,size,caffeine,iceType,extras,qty}]}`). 서버가 가격·포인트를 재계산해 저장하고 주문번호를 반환. 결제 총액의 1%가 포인트로 적립됨.
- `GET /api/orders/<id>` — 주문 상세 조회

### 주문 관리 (직원용, `/admin`)
- `GET /api/admin/orders` — 주문 목록(페이지네이션). 옵션 포함 상품 내역이 함께 반환됨. 쿼리스트링으로 필터링:
  - `status` — `pending`(대기중) / `preparing`(제조중) / `completed`(완료) / `cancelled`(취소)
  - `orderType` — `dine-in` / `takeout`
  - `date` — `YYYY-MM-DD`
  - `q` — 주문번호 부분 검색
  - `limit`(기본 50, 최대 200) / `offset` — 페이지네이션. 응답은 `{orders, total, limit, offset}` 형태.
    수년치 이력이 쌓일 수 있어 필터 없이 호출해도 최신순 `limit`개만 반환한다.
- `GET /api/admin/summary` — 오늘 주문 수 / 매출 / 적립 포인트 / 처리 대기 건수
- `PATCH /api/admin/orders/<id>/status` — 처리 상태 변경 (`{status}`)

### 매출 상세 (직원용, `/admin/sales`)
- `GET /api/admin/sales?granularity=day|month|year&from=YYYY-MM-DD&to=YYYY-MM-DD` — 취소 주문을 제외한 매출 집계.
  기간을 생략하면 전체 기간을 대상으로 한다. 응답에 포함되는 항목:
  - `trend` — 집계 단위(일/월/년)별 매출 추이 (매출액·주문수·적립포인트)
  - `byPayment` — 결제수단별 매출/건수/비중
  - `byOrderType` — 매장/포장 주문유형별 매출
  - `totals` — 총 매출/주문수/평균 객단가/적립포인트
  - `topItems` — 매출 기준 인기 메뉴 TOP 5

## 주문 처리 상태 흐름

`pending`(대기중) → `preparing`(제조중) → `completed`(완료), 언제든 `cancelled`(취소)로 전환 가능. 결제는 키오스크에서 이미 완료된 상태로 주문이 생성되며, 이 상태값은 매장의 제조/전달 진행 상황을 관리한다.
