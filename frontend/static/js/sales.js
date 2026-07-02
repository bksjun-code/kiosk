const { useState, useEffect, useCallback } = React;
const DS = window.IOSIPadOS26DesignSystem_9abca8 || {};

/* ─── API ─── */
const API_BASE = '/api';
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

/* ─── DATE HELPERS ─── */
function toISODate(d) {
  // toISOString()은 UTC 기준이라 시간대에 따라 하루가 밀릴 수 있어 로컬 날짜를 직접 조합한다.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function defaultRange(granularity) {
  const today = new Date();
  if (granularity === 'day') {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: toISODate(from), to: toISODate(today) };
  }
  if (granularity === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    return { from: toISODate(from), to: toISODate(today) };
  }
  return { from: '', to: '' }; // year: 전체 기간
}
function periodLabel(period, granularity) {
  if (granularity === 'day') {
    const [, m, d] = period.split('-');
    return `${m}/${d}`;
  }
  if (granularity === 'month') {
    const [y, m] = period.split('-');
    return `${y.slice(2)}.${m}`;
  }
  return `${period}년`;
}

const GRANULARITIES = [
  { label: '일별', value: 'day' },
  { label: '월별', value: 'month' },
  { label: '년별', value: 'year' },
];

const PAY_ICON_FALLBACK = '💳';

/* ─── SUMMARY CARD ─── */
function StatCard({ label, value, tint }) {
  return (
    <DS.Card padding={16} radius={16} style={{ flex: 1, minWidth: 150 }}>
      <div className="ios-caption1" style={{ color: 'var(--labels-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: tint || 'var(--labels-primary)' }}>{value}</div>
    </DS.Card>
  );
}

/* 상단만 둥근 막대 경로 */
function roundedTopBarPath(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

function formatRevenueTick(v) {
  if (v >= 10000) return `${Math.round(v / 10000).toLocaleString()}만`;
  return v.toLocaleString();
}

/* ─── TREND CHART: 막대(매출, 왼쪽 축) + 꺾은선(판매건수, 오른쪽 축) 콤보 ─── */
function TrendChart({ data, granularity }) {
  const width = 900, height = 220, padding = { top: 16, right: 46, bottom: 28, left: 54 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--labels-tertiary)' }}>
        표시할 매출 데이터가 없습니다
      </div>
    );
  }

  const revenueMax = Math.max(...data.map(d => d.revenue), 1);
  const countMax = Math.max(...data.map(d => d.orderCount), 1);
  const n = data.length;
  const gap = 6;
  const barW = Math.max(4, innerW / n - gap);
  // 라벨이 겹치지 않도록 항목이 많으면 일부만 표시
  const labelStep = Math.max(1, Math.ceil(n / 12));
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const barX = i => padding.left + i * (innerW / n) + gap / 2;
  const yFor = (v, max) => padding.top + innerH - (max > 0 ? (v / max) * innerH : 0);
  const points = data.map((d, i) => [barX(i) + barW / 2, yFor(d.orderCount, countMax)]);
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {ticks.map(f => (
        <g key={f}>
          <line
            x1={padding.left} x2={width - padding.right}
            y1={padding.top + innerH * (1 - f)} y2={padding.top + innerH * (1 - f)}
            stroke="var(--separators-non-opaque)" strokeWidth="1"
          />
          <text x={padding.left - 8} y={padding.top + innerH * (1 - f) + 3} textAnchor="end" fontSize="10" fill="var(--labels-tertiary)">
            {formatRevenueTick(Math.round(revenueMax * f))}
          </text>
          <text x={width - padding.right + 8} y={padding.top + innerH * (1 - f) + 3} textAnchor="start" fontSize="10" fill="#8FA0B8">
            {Math.round(countMax * f).toLocaleString()}건
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const h = revenueMax > 0 ? (d.revenue / revenueMax) * innerH : 0;
        const x = barX(i);
        const y = padding.top + innerH - h;
        return (
          <path key={d.period} d={roundedTopBarPath(x, y, barW, Math.max(h, 1), 4)} fill="#B5BAC2"/>
        );
      })}
      <path d={linePath} fill="none" stroke="#8FA0B8" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((d, i) => (
        <g key={d.period}>
          <circle cx={points[i][0]} cy={points[i][1]} r={5} fill="#8FA0B8" stroke="var(--backgrounds-grouped-secondary)" strokeWidth="1.5" style={{ cursor: 'pointer' }}>
            <title>{`${periodLabel(d.period, granularity)}\n매출 ₩${d.revenue.toLocaleString()}\n판매건수 ${d.orderCount.toLocaleString()}건`}</title>
          </circle>
          {i % labelStep === 0 && (
            <text x={points[i][0]} y={height - 8} textAnchor="middle" fontSize="10" fill="var(--labels-tertiary)">
              {periodLabel(d.period, granularity)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ─── PAYMENT METHOD BREAKDOWN (가로 막대) ─── */
function PaymentBreakdown({ items }) {
  if (items.length === 0) {
    return <div className="ios-footnote" style={{ color: 'var(--labels-tertiary)', textAlign: 'center', padding: '24px 0' }}>데이터 없음</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(p => (
        <div key={p.payMethod}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 8px', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--labels-primary)', wordBreak: 'keep-all' }}>{p.icon || PAY_ICON_FALLBACK} {p.label}</span>
            <span className="ios-caption1" style={{ color: 'var(--labels-secondary)', whiteSpace: 'nowrap' }}>₩{p.revenue.toLocaleString()} · {p.share}% · {p.orderCount}건</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--fills-tertiary)', overflow: 'hidden' }}>
            <div style={{ width: `${p.share}%`, height: '100%', background: 'var(--accents-blue)', borderRadius: 4 }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── ORDER TYPE BREAKDOWN ─── */
/* 완료된 주문만 집계하므로(대기중/제조중/취소 제외), 비중(%)도 전체 매출이 아니라
   이 완료 건들끼리의 합계를 기준으로 계산해야 100%에 맞게 나온다. */
function OrderTypeBreakdown({ items }) {
  const meta = { 'dine-in': { label: '🍽 매장', tint: 'var(--accents-orange)' }, 'takeout': { label: '🥤 포장', tint: 'var(--accents-green)' } };
  if (items.length === 0) {
    return <div className="ios-footnote" style={{ color: 'var(--labels-tertiary)', textAlign: 'center', padding: '24px 0' }}>데이터 없음</div>;
  }
  const completedTotal = items.reduce((s, t) => s + t.revenue, 0);
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {items.map(t => {
        const m = meta[t.orderType] || { label: t.orderType, tint: 'var(--labels-secondary)' };
        const share = completedTotal ? Math.round((t.revenue / completedTotal) * 100) : 0;
        return (
          <div key={t.orderType} style={{ flex: 1, textAlign: 'center', padding: '16px 10px', borderRadius: 14, background: 'var(--backgrounds-grouped-primary)' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: m.tint }}>₩{t.revenue.toLocaleString()}</div>
            <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', marginTop: 2 }}>{t.orderCount}건 · {share}%</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── TOP ITEMS ─── */
function TopItems({ items }) {
  if (items.length === 0) {
    return <div className="ios-footnote" style={{ color: 'var(--labels-tertiary)', textAlign: 'center', padding: '24px 0' }}>데이터 없음</div>;
  }
  const max = Math.max(...items.map(i => i.revenue), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => (
        <div key={it.name}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 8px', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--labels-primary)', wordBreak: 'keep-all' }}>{i + 1}. {it.name}</span>
            <span className="ios-caption1" style={{ color: 'var(--labels-secondary)', whiteSpace: 'nowrap' }}>₩{it.revenue.toLocaleString()} · {it.qty}개</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--fills-tertiary)', overflow: 'hidden' }}>
            <div style={{ width: `${(it.revenue / max) * 100}%`, height: '100%', background: 'var(--accents-orange)', borderRadius: 3 }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── APP ─── */
function App() {
  const [granularity, setGranularity] = useState('day');
  const [range, setRange] = useState(defaultRange('day'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const changeGranularity = (g) => {
    setGranularity(g);
    setRange(defaultRange(g));
  };

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ granularity });
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    apiGet(`/admin/sales?${params.toString()}`)
      .then(res => { setData(res); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [granularity, range]);

  useEffect(() => { load(); }, [load]);

  const totals = data?.totals;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 60px' }}>
      <AdminNav active="sales"/>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--labels-primary)' }}>📊 매출 상세</div>
          <div className="ios-footnote" style={{ color: 'var(--labels-secondary)', marginTop: 2 }}>일별 · 월별 · 년별 매출 추이, 결제방식별 · 주문유형별 매출</div>
        </div>
        <DS.Button variant="tinted" icon="arrow.clockwise" onClick={load}>새로고침</DS.Button>
      </div>

      {/* Controls */}
      <DS.Card padding={14} radius={14} style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', marginBottom: 4 }}>집계 단위</div>
          <DS.SegmentedControl segments={GRANULARITIES} value={granularity} onChange={changeGranularity} style={{ height: 32, width: 220 }} />
        </div>
        <div>
          <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', marginBottom: 4 }}>시작일</div>
          <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
            style={{ height: 32, borderRadius: 8, border: '1px solid var(--separators-non-opaque)', padding: '0 8px', fontSize: 13, background: 'var(--backgrounds-primary)', color: 'var(--labels-primary)' }}/>
        </div>
        <div>
          <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', marginBottom: 4 }}>종료일</div>
          <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
            style={{ height: 32, borderRadius: 8, border: '1px solid var(--separators-non-opaque)', padding: '0 8px', fontSize: 13, background: 'var(--backgrounds-primary)', color: 'var(--labels-primary)' }}/>
        </div>
        <DS.Button variant="plain" onClick={() => setRange({ from: '', to: '' })}>전체 기간</DS.Button>
      </DS.Card>

      {error && <div className="ios-footnote" style={{ color: 'var(--accents-red)', marginBottom: 12 }}>{error}</div>}

      {loading && !data ? (
        <DS.Card padding={40} radius={18} style={{ textAlign: 'center' }}>
          <DS.ActivityIndicator size={22} color="var(--labels-secondary)" />
        </DS.Card>
      ) : data && (
        <>
          {/* Totals */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <StatCard label="총 매출" value={`₩${totals.revenue.toLocaleString()}`} tint="var(--accents-blue)" />
            <StatCard label="총 주문 수" value={`${totals.orderCount.toLocaleString()}건`} />
            <StatCard label="평균 객단가" value={`₩${totals.avgOrder.toLocaleString()}`} />
            <StatCard label="적립 포인트" value={`${totals.points.toLocaleString()}P`} tint="var(--accents-orange)" />
          </div>

          {/* Trend chart */}
          <DS.Card padding={20} radius={18} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="ios-footnote" style={{ color: 'var(--labels-primary)', fontWeight: 700 }}>
                매출 추이 ({GRANULARITIES.find(g => g.value === granularity)?.label})
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--labels-secondary)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#B5BAC2', display: 'inline-block' }}/>매출 (왼쪽 축)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--labels-secondary)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8FA0B8', display: 'inline-block' }}/>판매건수 (오른쪽 축)
                </span>
              </div>
            </div>
            <TrendChart data={data.trend} granularity={granularity} />
          </DS.Card>

          <div className="sales-breakdown-grid" style={{ marginBottom: 16 }}>
            <DS.Card padding={20} radius={18}>
              <div className="ios-footnote" style={{ color: 'var(--labels-primary)', fontWeight: 700, marginBottom: 14 }}>결제방식별 매출</div>
              <PaymentBreakdown items={data.byPayment} />
            </DS.Card>
            <DS.Card padding={20} radius={18}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
                <div className="ios-footnote" style={{ color: 'var(--labels-primary)', fontWeight: 700 }}>주문유형별 매출</div>
                <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)' }}>(완료된 주문 기준)</div>
              </div>
              <OrderTypeBreakdown items={data.byOrderType} />
              <div className="ios-footnote" style={{ color: 'var(--labels-primary)', fontWeight: 700, margin: '20px 0 14px' }}>인기 메뉴 TOP 5</div>
              <TopItems items={data.topItems} />
            </DS.Card>
          </div>
        </>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app-root')).render(<App/>);
