const { useState, useEffect, useCallback } = React;
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

function fmtDateTime(isoLike) {
  // SQLite "YYYY-MM-DD HH:MM:SS"
  const [datePart, timePart] = (isoLike || '').split(' ');
  if (!datePart) return isoLike || '';
  return `${datePart} ${(timePart || '').slice(0, 5)}`;
}

/* ─── SUMMARY CARD ─── */
function SummaryCard({ label, value, tint }) {
  return (
    <DS.Card padding={16} radius={16} style={{ flex: 1, minWidth: 140 }}>
      <div className="ios-caption1" style={{ color: 'var(--labels-secondary)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: tint || 'var(--labels-primary)' }}>{value}</div>
    </DS.Card>
  );
}

const TX_META = {
  earn: { label: '적립', color: 'var(--accents-green)', sign: '+' },
  use:  { label: '사용', color: 'var(--accents-red)', sign: '-' },
  adjust: { label: '조정', color: 'var(--accents-blue)', sign: '' },
};

/* ─── MEMBER ROW ─── */
function MemberRow({ member, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left',
      background: active ? 'color-mix(in srgb, var(--accents-blue) 10%, white)' : 'var(--backgrounds-grouped-secondary)',
      border: `1.5px solid ${active ? 'var(--accents-blue)' : 'var(--separators-non-opaque)'}`,
      borderRadius: 14, padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--labels-primary)' }}>{formatPhone(member.phone)}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accents-orange)' }}>{member.pointsBalance.toLocaleString()}P</span>
      </div>
      <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', marginTop: 4 }}>
        가입일 {(member.createdAt || '').slice(0, 10)}
      </div>
    </button>
  );
}

/* ─── MEMBER DETAIL: 적립금 사용내역 ─── */
function MemberDetail({ phone }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!phone) return;
    setLoading(true);
    setError(null);
    apiGet(`/admin/members/${phone}/transactions?limit=100`)
      .then(res => { setData(res); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [phone]);

  if (!phone) {
    return (
      <DS.Card padding={40} radius={18} style={{ textAlign: 'center', color: 'var(--labels-tertiary)' }}>
        왼쪽 목록에서 회원을 선택하세요
      </DS.Card>
    );
  }
  if (loading) {
    return (
      <DS.Card padding={40} radius={18} style={{ textAlign: 'center' }}>
        <DS.ActivityIndicator size={22} color="var(--labels-secondary)" />
      </DS.Card>
    );
  }
  if (error) {
    return <div className="ios-footnote" style={{ color: 'var(--accents-red)' }}>{error}</div>;
  }

  return (
    <DS.Card padding={20} radius={18}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="ios-headline" style={{ color: 'var(--labels-primary)' }}>{formatPhone(data.phone)}</div>
          <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', marginTop: 2 }}>적립금 사용내역 (최근 {data.transactions.length}건)</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)' }}>보유 적립금</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accents-orange)' }}>{data.pointsBalance.toLocaleString()}P</div>
        </div>
      </div>

      {data.transactions.length === 0 ? (
        <div className="ios-footnote" style={{ color: 'var(--labels-tertiary)', textAlign: 'center', padding: '24px 0' }}>내역이 없습니다</div>
      ) : (
        <DS.List inset={false}>
          {data.transactions.map(tx => {
            const meta = TX_META[tx.type] || { label: tx.type, color: 'var(--labels-secondary)', sign: '' };
            return (
              <DS.ListRow
                key={tx.id}
                title={
                  <span>
                    <span style={{ color: meta.color, fontWeight: 700 }}>{meta.label}</span>
                    {tx.memo ? ` · ${tx.memo}` : ''}
                  </span>
                }
                subtitle={`${fmtDateTime(tx.createdAt)} · 잔액 ${tx.balanceAfter.toLocaleString()}P${tx.orderId ? ` · 주문 #${tx.orderId}` : ''}`}
                trailing={<span style={{ fontSize: 14, fontWeight: 800, color: meta.color }}>{meta.sign}{tx.amount.toLocaleString()}P</span>}
                style={{ padding: '10px 4px' }}
              />
            );
          })}
        </DS.List>
      )}
    </DS.Card>
  );
}

const LIMIT = 50;

/* ─── APP ─── */
function App() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('balance');
  const [offset, setOffset] = useState(0);
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPhone, setSelectedPhone] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ sort, limit: LIMIT, offset });
    if (q) params.set('q', q);
    apiGet(`/admin/members?${params.toString()}`)
      .then(res => {
        setMembers(res.members);
        setTotal(res.total);
        setTotalBalance(res.totalBalance);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [q, sort, offset]);

  useEffect(() => { setOffset(0); }, [q, sort]);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 60px' }}>
      <AdminNav active="members"/>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--labels-primary)' }}>🎁 적립금 현황</div>
          <div className="ios-footnote" style={{ color: 'var(--labels-secondary)', marginTop: 2 }}>휴대폰 번호별 보유 적립금 · 적립/사용 내역 조회</div>
        </div>
        <DS.Button variant="tinted" icon="arrow.clockwise" onClick={load}>새로고침</DS.Button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <SummaryCard label="회원 수" value={`${total.toLocaleString()}명`} />
        <SummaryCard label="적립금 합계" value={`${totalBalance.toLocaleString()}P`} tint="var(--accents-orange)" />
      </div>

      <DS.Card padding={14} radius={14} style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', marginBottom: 4 }}>휴대폰 번호 검색</div>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="예: 1234"
            style={{ width: '100%', height: 32, borderRadius: 8, border: '1px solid var(--separators-non-opaque)', padding: '0 10px', fontSize: 13, background: 'var(--backgrounds-primary)', color: 'var(--labels-primary)' }}
          />
        </div>
        <div>
          <div className="ios-caption2" style={{ color: 'var(--labels-tertiary)', marginBottom: 4 }}>정렬</div>
          <DS.SegmentedControl
            segments={[{ label: '적립금 많은 순', value: 'balance' }, { label: '번호순', value: 'phone' }]}
            value={sort} onChange={setSort} style={{ height: 32 }}
          />
        </div>
      </DS.Card>

      {error && <div className="ios-footnote" style={{ color: 'var(--accents-red)', marginBottom: 12 }}>{error}</div>}

      {/* Master-detail */}
      <div className="members-master-detail-grid">
        <div>
          {loading ? (
            <DS.Card padding={40} radius={18} style={{ textAlign: 'center' }}>
              <DS.ActivityIndicator size={22} color="var(--labels-secondary)" />
            </DS.Card>
          ) : members.length === 0 ? (
            <DS.Card padding={40} radius={18} style={{ textAlign: 'center', color: 'var(--labels-tertiary)' }}>
              조건에 맞는 회원이 없습니다
            </DS.Card>
          ) : (
            members.map(m => (
              <MemberRow key={m.phone} member={m} active={m.phone === selectedPhone} onClick={() => setSelectedPhone(m.phone)} />
            ))
          )}

          {total > LIMIT && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 8 }}>
              <DS.Button variant="bordered" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}>이전</DS.Button>
              <div className="ios-footnote" style={{ color: 'var(--labels-secondary)', display: 'flex', alignItems: 'center' }}>
                {offset + 1}-{Math.min(offset + LIMIT, total)} / {total}
              </div>
              <DS.Button variant="bordered" disabled={offset + LIMIT >= total} onClick={() => setOffset(o => o + LIMIT)}>다음</DS.Button>
            </div>
          )}
        </div>

        <MemberDetail phone={selectedPhone}/>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app-root')).render(<App/>);
