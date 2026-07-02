/* 관리자 화면 공용 상단 내비게이션 (주문 관리 / 매출 상세) */
function AdminNav({ active }) {
  const tabs = [
    { href: '/admin', label: '주문 관리', key: 'orders' },
    { href: '/admin/sales', label: '매출 상세', key: 'sales' },
    { href: '/admin/members', label: '적립금 현황', key: 'members' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
      {tabs.map(t => (
        <a key={t.key} href={t.href} style={{
          textDecoration: 'none',
          padding: '6px 14px', borderRadius: 999,
          font: `600 13px/1 var(--font-system)`,
          color: active === t.key ? '#fff' : 'var(--labels-secondary)',
          background: active === t.key ? 'var(--accents-blue)' : 'var(--backgrounds-grouped-secondary)',
        }}>{t.label}</a>
      ))}
    </div>
  );
}
