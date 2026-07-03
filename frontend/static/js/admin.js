const { useState, useEffect, useRef, useCallback } = React;
const DS = window.IOSIPadOS26DesignSystem_9abca8 || {};

/* ─── API ─── */
const API_BASE = '/api';

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

/* member_phone은 숫자만 저장되므로 표시할 때만 보기 좋게 포맷한다. */
function formatPhone(digits) {
  if (!digits) return digits;
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0,3)}-${digits.slice(3)}`;
  return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7,11)}`;
}

async function apiPatch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `PATCH ${path} failed: ${res.status}`);
  return data;
}

/* ─── STATUS META ─── */
const STATUS_META = {
  pending:   { label: '대기중',  color: 'var(--accents-orange)' },
  preparing: { label: '제조중',  color: 'var(--accents-blue)' },
  completed: { label: '완료',    color: 'var(--accents-green)' },
  cancelled: { label: '취소됨',  color: 'var(--accents-red)' },
};
const STATUS_FILTERS = [
  { label: '전체', value: '' },
  { label: '대기중', value: 'pending' },
  { label: '제조중', value: 'preparing' },
  { label: '완료', value: 'completed' },
  { label: '취소됨', value: 'cancelled' },
];
const TYPE_FILTERS = [
  { label: '전체', value: '' },
  { label: '🍽 매장', value: 'dine-in' },
  { label: '🥤 포장', value: 'takeout' },
];

function StatusBadge({ status, style }) {
  const meta = STATUS_META[status] || { label: status, color: 'var(--labels-tertiary)' };
  return (
    <DS.Badge
      count={meta.label}
      color={meta.color}
      style={{ fontSize: 11, padding: '0 10px', height: 22, minWidth: 0, borderRadius: 999, ...style }}
    />
  );
}

function todayISO() {
  // toISOString()은 UTC 기준이라 시간대에 따라 하루가 밀릴 수 있어 로컬 날짜를 직접 조합한다.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(isoLike) {
  // SQLite "YYYY-MM-DD HH:MM:SS"
  const [datePart, timePart] = (isoLike || '').split(' ');
  if (!timePart) return isoLike || '';
  return timePart.slice(0, 5);
}
function fmtDate(isoLike) {
  const [datePart] = (isoLike || '').split(' ');
  return datePart || '';
}

function itemOptionSummary(item, extraLabelById) {
  const parts = [item.temp === 'ice' ? '🧊 ICE' : '🔥 HOT'];
  if (item.size && item.size !== 'base') parts.push(`${item.size}사이즈`);
  if (item.caffeine === 'decaf') parts.push('디카페인');
  if (item.temp === 'ice' && item.iceType === 'crushed') parts.push('간얼음');
  if (item.extras && item.extras.length > 0) {
    parts.push(item.extras.map(id => extraLabelById[id] || id).join(', '));
  }
  return parts.join(' · ');
}

/* ─── SUMMARY CARDS ─── */
function SummaryCard({ label, value, tint }) {
  return (
    <DS.Card padding={16} radius={16} style={{ flex: 1, minWidth: 140 }}>
      <div className="ios-caption1" style={{ color: 'var(--labels-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: tint || 'var(--labels-primary)' }}>{value}</div>
    </DS.Card>
  );
}

/* ─── ORDER LIST ROW ─── */
function OrderRow({ order, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left',
      background: active ? 'color-mix(in srgb, var(--accents-blue) 10%, white)' : 'var(--backgrounds-grouped-secondary)',
      border: `1.5px solid ${active ? 'var(--accents-blue)' : 'var(--separators-non-opaque)'}`,
      borderRadius: 14, padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--labels-primary)' }}>#{order.orderNumber}</span>
        <StatusBadge status={order.status} />
      </div>
      <div className="ios-caption1" style={{ color: 'var(--labels-secondary)', marginBottom: 6 }}>
        {fmtTime(order.createdAt)} · {order.orderType === 'dine-in' ? '🍽 매장' : '🥤 포장'} · 상품 {order.items.reduce((s, i) => s + i.qty, 0)}개
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="ios-caption1" style={{ color: 'var(--labels-tertiary)' }}>
          {order.items.map(i => i.name).join(', ')}
        </span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--labels-primary)', flexShrink: 0, marginLeft: 8 }}>
          ₩{order.total.toLocaleString()}
        </span>
      </div>
    </button>
  );
}

/* ─── ORDER DETAIL PANEL ─── */
function OrderDetail({ order, payMethods, extraLabelById, onChangeStatus, updating }) {
  if (!order) {
    return (
      <DS.Card padding={40} radius={18} style={{ textAlign: 'center', color: 'var(--labels-tertiary)' }}>
        왼쪽 목록에서 주문을 선택하세요
      </DS.Card>
    );
  }
  const pm = payMethods.find(p => p.id === order.payMethod);
  const canAdvance = order.status === 'pending' || order.status === 'preparing';
  const nextStatus = order.status === 'pending' ? 'preparing' : 'completed';
  const nextLabel = order.status === 'pending' ? '제조 시작' : '제조 완료';

  return (
    <DS.Card padding={20} radius={18}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 16, borderBottom: '0.5px solid var(--separators-non-opaque)' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--labels-primary)' }}>주문 #{order.orderNumber}</div>
          <div className="ios-footnote" style={{ color: 'var(--labels-secondary)', marginTop: 4 }}>
            {fmtDate(order.createdAt)} {fmtTime(order.createdAt)} · {order.orderType === 'dine-in' ? '🍽 매장 이용' : '🥤 포장'}
          </div>
        </div>
        <StatusBadge status={order.status} style={{ height: 26, fontSize: 12, padding: '0 12px' }}/>
      </div>

      {/* Items */}
      <div className="ios-footnote" style={{ color: 'var(--labels-primary)', fontWeight: 700, marginBottom: 10 }}>주문 상품</div>
      <DS.List inset={false} style={{ marginBottom: 16 }}>
        {order.items.map(item => (
          <DS.ListRow
            key={item.id}
            title={`${item.name} × ${item.qty}`}
            subtitle={itemOptionSummary(item, extraLabelById)}
            trailing={<span style={{ fontSize: 14, fontWeight: 700, color: 'var(--labels-primary)' }}>₩{(item.unitPrice * item.qty).toLocaleString()}</span>}
            style={{ padding: '10px 4px' }}
          />
        ))}
      </DS.List>

      {/* Summary */}
      <div style={{ background: 'var(--backgrounds-grouped-primary)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
        {[
          ['소계', `₩${order.subtotal.toLocaleString()}`],
          ['부가세', `₩${order.tax.toLocaleString()}`],
          ['결제수단', pm ? `${pm.icon} ${pm.label}` : order.payMethod],
          ...(order.pointsUsed > 0
            ? [['적립금 사용', `-${order.pointsUsed.toLocaleString()}P (${formatPhone(order.memberPhone)})`]]
            : [['적립 포인트', order.memberPhone ? `+${order.pointsEarned.toLocaleString()}P (${formatPhone(order.memberPhone)})` : '미적립']]),
        ].map(([l, v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="ios-footnote" style={{ color: 'var(--labels-secondary)' }}>{l}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--labels-primary)' }}>{v}</span>
          </div>
        ))}
        <div style={{ borderTop: '0.5px solid var(--separators-non-opaque)', marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--labels-primary)' }}>결제 총액</span>
          <span className="ios-title2" style={{ color: 'var(--accents-blue)' }}>₩{order.total.toLocaleString()}</span>
        </div>
      </div>

      {/* Actions */}
      {order.status === 'cancelled' && (
        <div className="ios-footnote" style={{ color: 'var(--accents-red)', textAlign: 'center' }}>취소된 주문입니다.</div>
      )}
      {order.status === 'completed' && (
        <div className="ios-footnote" style={{ color: 'var(--accents-green)', textAlign: 'center' }}>처리가 완료된 주문입니다.</div>
      )}
      {canAdvance && (
        <div style={{ display: 'flex', gap: 10 }}>
          <DS.Button variant="bordered" tint="var(--accents-red)" onClick={() => onChangeStatus(order.id, 'cancelled')} disabled={updating} style={{ flex: 1 }}>
            주문 취소
          </DS.Button>
          <DS.Button variant="filled" onClick={() => onChangeStatus(order.id, nextStatus)} disabled={updating} style={{ flex: 2 }}>
            {nextLabel}
          </DS.Button>
        </div>
      )}
    </DS.Card>
  );
}

/* ─── APP ─── */
function App() {
  const [orders, setOrders] = useState([]);
  const [payMethods, setPayMethods] = useState([]);
  const [extraLabelById, setExtraLabelById] = useState({});
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(todayISO());
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);

  // 필터가 바뀌면 첫 페이지로 되돌린다.
  useEffect(() => { setOffset(0); }, [statusFilter, typeFilter, dateFilter, q]);

  const loadStatic = useCallback(() => {
    apiGet('/pay-methods').then(setPayMethods).catch(() => {});
    apiGet('/extras').then(list => {
      const map = {};
      list.forEach(e => { map[e.id] = e.label; });
      setExtraLabelById(map);
    }).catch(() => {});
  }, []);

  const loadOrders = useCallback(() => {
    const params = new URLSearchParams({ limit: LIMIT, offset });
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('orderType', typeFilter);
    if (dateFilter) params.set('date', dateFilter);
    if (q.trim()) params.set('q', q.trim());

    // 요약 카드는 상태 필터를 제외한 나머지(날짜/유형/검색) 조건을 그대로 반영한다.
    const summaryParams = new URLSearchParams();
    if (typeFilter) summaryParams.set('orderType', typeFilter);
    if (dateFilter) summaryParams.set('date', dateFilter);
    if (q.trim()) summaryParams.set('q', q.trim());

    setError(null);
    Promise.all([
      apiGet(`/admin/orders?${params.toString()}`),
      apiGet(`/admin/summary?${summaryParams.toString()}`),
    ])
      .then(([ordersRes, summaryRes]) => {
        setOrders(ordersRes.orders);
        setTotal(ordersRes.total);
        setSummary(summaryRes);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [statusFilter, typeFilter, dateFilter, q, offset]);

  useEffect(loadStatic, []);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  // 15초마다 자동 새로고침 (필터가 바뀌면 effect가 재실행되며 인터벌도 재설정됨)
  useEffect(() => {
    const id = setInterval(loadOrders, 15000);
    return () => clearInterval(id);
  }, [loadOrders]);

  const selected = orders.find(o => o.id === selectedId) || null;

  const handleChangeStatus = (orderId, status) => {
    setUpdating(true);
    apiPatch(`/admin/orders/${orderId}/status`, { status })
      .then(() => { loadOrders(); })
      .catch(err => setError(err.message))
      .finally(() => setUpdating(false));
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 60px' }}>
      {/* Header */}
      <AdminNav active="orders"/>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--labels-primary)' }}>☕ 빽다방 주문 관리</div>
          <div className="ios-footnote" style={{ color: 'var(--labels-secondary)', marginTop: 2 }}>주문 내역 · 처리 상태 · 결제 · 적립 포인트</div>
        </div>
        <DS.Button variant="tinted" icon="arrow.clockwise" onClick={loadOrders}>새로고침</DS.Button>
      </div>

      {/* Summary: 날짜/유형/검색 필터를 반영해 갱신됨 (상태 필터는 제외) */}
      {summary && (
        <>
          <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', margin: '0 0 8px 2px' }}>
            {dateFilter ? `${dateFilter} 기준` : '전체 기간 기준'}
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <SummaryCard label="주문 수" value={`${summary.count.toLocaleString()}건`} />
            <SummaryCard label="매출" value={`₩${summary.revenue.toLocaleString()}`} tint="var(--accents-blue)" />
            <SummaryCard label="적립 포인트" value={`${summary.points.toLocaleString()}P`} tint="var(--accents-orange)" />
            <SummaryCard label="처리 대기" value={`${summary.pendingCount.toLocaleString()}건`} tint={summary.pendingCount > 0 ? 'var(--accents-red)' : 'var(--accents-green)'} />
          </div>
        </>
      )}

      {/* Filters */}
      <DS.Card padding={14} radius={14} style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260 }}>
          <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', marginBottom: 4 }}>처리 상태</div>
          <DS.SegmentedControl segments={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} style={{ height: 32 }} />
        </div>
        <div style={{ minWidth: 180 }}>
          <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', marginBottom: 4 }}>주문 유형</div>
          <DS.SegmentedControl segments={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} style={{ height: 32 }} />
        </div>
        <div>
          <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', marginBottom: 4 }}>날짜</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{ height: 32, borderRadius: 8, border: '1px solid var(--separators-non-opaque)', padding: '0 8px', fontSize: 13, background: 'var(--backgrounds-primary)', color: 'var(--labels-primary)' }}
            />
            {dateFilter && <DS.Button variant="plain" onClick={() => setDateFilter('')}>전체 기간</DS.Button>}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', marginBottom: 4 }}>주문번호 검색</div>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="예: 12"
            style={{ width: '100%', height: 32, borderRadius: 8, border: '1px solid var(--separators-non-opaque)', padding: '0 10px', fontSize: 13, background: 'var(--backgrounds-primary)', color: 'var(--labels-primary)' }}
          />
        </div>
      </DS.Card>

      <div className="ios-caption1" style={{ color: 'var(--labels-tertiary)', margin: '0 0 8px 2px' }}>
        {dateFilter ? `${dateFilter} · ` : ''}총 {total.toLocaleString()}건 중 {total === 0 ? 0 : offset + 1}-{Math.min(offset + LIMIT, total)}건 표시
      </div>

      {error && <div className="ios-footnote" style={{ color: 'var(--accents-red)', marginBottom: 12 }}>{error}</div>}

      {/* Master-detail */}
      <div className="admin-master-detail-grid">
        <div className="admin-order-list-col">
          {loading ? (
            <DS.Card padding={40} radius={18} style={{ textAlign: 'center' }}>
              <DS.ActivityIndicator size={22} color="var(--labels-secondary)" />
            </DS.Card>
          ) : orders.length === 0 ? (
            <DS.Card padding={40} radius={18} style={{ textAlign: 'center', color: 'var(--labels-tertiary)' }}>
              조건에 맞는 주문이 없습니다
            </DS.Card>
          ) : (
            orders.map(o => (
              <OrderRow key={o.id} order={o} active={o.id === selectedId} onClick={() => setSelectedId(o.id)} />
            ))
          )}
          {total > LIMIT && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
              <DS.Button variant="tinted" onClick={() => setOffset(o => Math.max(0, o - LIMIT))} disabled={offset === 0}>← 이전</DS.Button>
              <DS.Button variant="tinted" onClick={() => setOffset(o => o + LIMIT)} disabled={offset + LIMIT >= total}>다음 →</DS.Button>
            </div>
          )}
        </div>
        <div className="admin-order-detail-col" style={{ position: 'sticky', top: 24 }}>
          <OrderDetail order={selected} payMethods={payMethods} extraLabelById={extraLabelById} onChangeStatus={handleChangeStatus} updating={updating} />
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app-root')).render(<App/>);
