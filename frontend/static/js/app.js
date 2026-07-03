const { useState, useEffect, useRef } = React;

/* iOS/iPadOS 26 Design System component kit, loaded via /static/js/ds-bundle.js
   (Button, IconButton, SegmentedControl, Stepper, Card, Badge, List, ListRow,
   NavigationBar, TabBar, Toolbar, Sheet, Icon, ActivityIndicator, ...). All
   colors/spacing/radii below are pulled from its CSS custom properties
   (fig-tokens.css / spacing.css / typography.css) instead of hardcoded values. */
const DS = window.IOSIPadOS26DesignSystem_9abca8 || {};

/* 메뉴에 표시되는 가격은 부가세 포함가(최종 결제가)다. 별도로 더하지 않고
   포함된 부가세를 역산해 공급가액/부가세를 표시용으로만 분리한다. */
function computeTotals(cart) {
  const total = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const tax = Math.round(total - total / 1.1);
  const subtotal = total - tax;
  return { subtotal, tax, total };
}

/* ─── API ─── */
const API_BASE = '/api';

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `POST ${path} failed: ${res.status}`);
  return data;
}

/* ─── CUP SVG (illustrative artwork, not part of the system chrome) ─── */
const CUP_PALETTES = [
  ['#5C3D2E','#A0674E','#F5E6D8'],['#2D5016','#4E8C25','#B8E08A'],
  ['#1A3A6B','#2E6DB5','#8BB8E0'],['#6B2080','#9B45B5','#D4A0E8'],
  ['#B55A00','#E07820','#F8C890'],['#8B2030','#C43848','#F0A0A8'],
  ['#1A5C3A','#2E8A58','#80CCA8'],['#5C4A18','#8B7028','#D4B868'],
  ['#3A185C','#604488','#B090D0'],['#1A4A5C','#2E7890','#80C4D8'],
  ['#5C3A18','#8B5828','#D4A870'],['#1A5A5C','#2E8C90','#80D0D0'],
  ['#5C182E','#8B2A5C','#D480A8'],['#2A3A18','#485C28','#98B870'],['#4A1818','#782828','#C07070'],
];

function CupSVG({ id, size=72 }) {
  const [dark,mid,light] = CUP_PALETTES[(id-1) % CUP_PALETTES.length];
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 72 72" fill="none">
      <ellipse cx="36" cy="58" rx="16" ry="3.5" fill={dark} opacity="0.25"/>
      <path d={`M20,28 Q19,56 36,58 Q53,56 52,28 Z`} fill={mid}/>
      <path d={`M20,28 L52,28 L50,34 L22,34 Z`} fill={dark} opacity="0.4"/>
      <ellipse cx="36" cy="28" rx="16" ry="4" fill={light}/>
      <path d="M52,34 Q60,34 60,42 Q60,50 52,48" stroke={dark} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6"/>
      <ellipse cx="36" cy="27" rx="10" ry="2.5" fill="white" opacity="0.55"/>
      <path d="M30,20 Q33,14 36,20 Q39,14 42,20" stroke={light} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7"/>
    </svg>
  );
}

/* ─── MENU BADGE (DS.Badge pill, colored by tag) ─── */
const MENU_BADGE_COLOR = {
  '대표': 'var(--accents-orange)', '강추': 'var(--accents-orange)', '베스트': 'var(--accents-orange)', '인기': 'var(--accents-orange)',
  '대표메뉴': 'var(--accents-red)',
  '신상': 'var(--accents-green)', '신메뉴': 'var(--accents-green)',
  '무당': 'var(--accents-purple)',
  '4잔': 'var(--accents-blue)', '2잔': 'var(--accents-blue)', '3잔': 'var(--accents-blue)',
};
function MenuBadge({ text }) {
  return (
    <DS.Badge
      count={text}
      color={MENU_BADGE_COLOR[text] || 'var(--labels-tertiary)'}
      style={{ position:'absolute', top:6, right:6, fontSize:9, padding:'0 7px', height:18, minWidth:0, boxShadow:'0 2px 6px rgba(0,0,0,0.2)' }}
    />
  );
}

function TempChip({ hot }) {
  const c = hot ? 'var(--accents-red)' : 'var(--accents-blue)';
  return (
    <span style={{ position:'absolute', top:6, left:6, fontSize:9, fontWeight:700, color:c, background:`color-mix(in srgb, ${c} 12%, transparent)`, borderRadius:'var(--radius-sm)', padding:'2px 5px' }}>
      {hot ? 'HOT' : 'ICE'}
    </span>
  );
}

/* ─── LOADING / ERROR ─── */
function LoadingScreen() {
  return (
    <div className="dark" style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--backgrounds-primary)', flexDirection:'column', gap:16 }}>
      <DS.ActivityIndicator size={28} color="var(--labels-secondary)"/>
      <div className="ios-footnote" style={{ color:'var(--labels-secondary)' }}>메뉴를 불러오는 중...</div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }) {
  return (
    <div className="dark" style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--backgrounds-primary)', flexDirection:'column', gap:16, padding:24, textAlign:'center' }}>
      <DS.Icon name="xmark.circle.fill" size={40} color="var(--accents-red)"/>
      <div className="ios-subhead" style={{ color:'var(--labels-secondary)' }}>{message}</div>
      <DS.Button variant="filled" onClick={onRetry}>다시 시도</DS.Button>
    </div>
  );
}

/* ─── WELCOME ─── */
function WelcomeScreen({ onSelect }) {
  return (
    <div className="dark" style={{ width:'100%', height:'100%', position:'relative', display:'flex', flexDirection:'column', background:'#1A1A1A', overflow:'hidden' }}>

      {/* ── 첫 화면 배경 영상 ── */}
      <video
        src="/static/photo/model.mp4"
        autoPlay muted loop playsInline
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:0 }}
      />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(160deg, rgba(245,208,32,0.6) 0%, rgba(245,166,35,0.55) 60%, rgba(232,135,26,0.65) 100%)', zIndex:1 }}/>

      {/* ── 상단 광고 배너 (영상 위에 겹쳐지는 브랜드 크리에이티브) ── */}
      <div style={{ flex:1, position:'relative', overflow:'hidden', zIndex:2 }}>

        <div style={{ position:'absolute', top:-60, right:-60, width:300, height:300, borderRadius:'50%', background:'rgba(255,255,255,0.12)' }}/>
        <div style={{ position:'absolute', bottom:60, left:-80, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }}/>
        <div style={{ position:'absolute', top:100, left:20, width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.1)' }}/>

        <div style={{ padding:'28px 28px 0', display:'flex', alignItems:'center', gap:10, position:'relative', zIndex:2 }}>
          <div style={{ background:'white', borderRadius:10, padding:'5px 10px', display:'flex', alignItems:'center', gap:4, boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}>
            <span style={{ fontSize:14, fontWeight:900, color:'#E8261A', letterSpacing:'-0.5px' }}>PAY</span>
            <span style={{ fontSize:14, fontWeight:900, color:'#222', letterSpacing:'-0.5px' }}>CO</span>
          </div>
          <span style={{ fontSize:18, color:'rgba(0,0,0,0.45)', fontWeight:300 }}>×</span>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:32, height:32, background:'#C8421A', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>☕</div>
            <span style={{ fontSize:17, fontWeight:900, color:'#1A1A1A', letterSpacing:'-0.5px' }}>빽다방</span>
          </div>
        </div>

        <div style={{ padding:'22px 28px 0', position:'relative', zIndex:2 }}>
          <div style={{ fontSize:18, fontWeight:700, color:'#1A1A1A', lineHeight:1.4, marginBottom:4 }}>
            페이코 포인트 또는<br/>PAYCO 포인트 카드결제시
          </div>
          <div style={{ display:'flex', alignItems:'baseline', gap:2, marginBottom:6 }}>
            <span style={{ fontSize:56, fontWeight:900, color:'#C8200A', lineHeight:1, letterSpacing:'-2px' }}>10%</span>
            <span style={{ fontSize:36, fontWeight:900, color:'#C8200A', letterSpacing:'-1px' }}>적립</span>
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:'rgba(0,0,0,0.55)', marginBottom:2 }}>건 당 최대 500P</div>
          <div style={{ fontSize:12, fontWeight:500, color:'rgba(0,0,0,0.45)' }}>5.1 ~ 10.31</div>
        </div>

        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:52, background:'rgba(30,30,30,0.88)', display:'flex', alignItems:'center', paddingLeft:24, zIndex:3, backdropFilter:'blur(4px)' }}>
          <span style={{ fontSize:28, fontWeight:900, color:'white', letterSpacing:'-1px' }}>PAY</span>
          <span style={{ fontSize:28, fontWeight:900, color:'#E8261A', letterSpacing:'-1px' }}>CO</span>
          <div style={{ marginLeft:'auto', paddingRight:20 }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', lineHeight:1.5, textAlign:'right' }}>
              본 메시지는 빽다방과 NHN PAYCO 사이에 의해 사전고지 없이<br/>변경 및 조기 종료될 수 있습니다.
            </div>
          </div>
        </div>
      </div>

      {/* ── 하단 선택 버튼 영역 (DS.Button) ── */}
      <div style={{ position:'relative', zIndex:2, background:'var(--backgrounds-primary)', padding:'20px 24px 28px', flexShrink:0 }}>
        <div className="ios-caption1" style={{ color:'var(--labels-tertiary)', textAlign:'center', marginBottom:16 }}>
          주문 방법을 선택해 주세요
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <DS.Button variant="bordered" tint="#fff" size="large" onClick={() => onSelect('dine-in')} style={{ flex:1 }}>
            매장에서 먹어요
          </DS.Button>
          <DS.Button variant="filled" tint="#fff" size="large" onClick={() => onSelect('takeout')} style={{ flex:1, color:'#1A1A1A' }}>
            포장해서 갈래요
          </DS.Button>
        </div>
      </div>
    </div>
  );
}

/* 메뉴 목록을 sub_group 순서대로 묶는다. group이 없는 카테고리는 그룹 하나로 취급. */
function groupItems(items) {
  const groups = [];
  for (const item of items) {
    const key = item.group || null;
    let bucket = groups.find(([g]) => g === key);
    if (!bucket) { bucket = [key, []]; groups.push(bucket); }
    bucket[1].push(item);
  }
  return groups;
}

/* 상단바에 쓰는 STEP n/3 뱃지 */
function StepPill({ children }) {
  return (
    <span style={{
      background:'color-mix(in srgb, var(--accents-orange) 25%, transparent)',
      border:'1px solid color-mix(in srgb, var(--accents-orange) 40%, transparent)',
      borderRadius:'var(--radius-md)', padding:'3px 10px',
      font:'700 11px/1 var(--font-system)', color:'var(--accents-orange)',
    }}>{children}</span>
  );
}

/* 두 줄(타이틀+부제) 짜리 NavigationBar 타이틀 */
function TwoLineTitle({ title, subtitle }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', lineHeight:1.2 }}>
      <span className="ios-headline" style={{ color:'var(--labels-primary)' }}>{title}</span>
      <span className="ios-caption2" style={{ color:'var(--labels-tertiary)' }}>{subtitle}</span>
    </div>
  );
}

/* ─── MENU SCREEN ─── */
function MenuScreen({ catalog, orderType, cart, onAdd, onViewCart, onBack }) {
  const [cat, setCat] = useState(catalog.categories[0]?.id);
  const [sel, setSel] = useState(null);
  const cartCount = cart.reduce((s,i) => s+i.qty, 0);
  const cartTotal = cart.reduce((s,i) => s+i.unitPrice*i.qty, 0);
  const items = catalog.menu[cat] || [];

  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'var(--backgrounds-grouped-primary)', position:'relative' }}>
      {/* Top chrome (dark surface) */}
      <div className="dark" style={{ background:'var(--backgrounds-primary)', flexShrink:0 }}>
        <DS.NavigationBar
          back="뒤로" onBack={onBack} translucent={false}
          title={<TwoLineTitle title="빽다방" subtitle={orderType==='dine-in' ? '🍽 매장 이용' : '🥤 포장'}/>}
          trailing={<StepPill>STEP 2/3</StepPill>}
          style={{ borderBottom:'none' }}
        />
        {/* Notice */}
        <div style={{ margin:'0 12px 10px', background:'color-mix(in srgb, var(--accents-orange) 12%, transparent)', border:'1px solid color-mix(in srgb, var(--accents-orange) 25%, transparent)', borderRadius:'var(--radius-md)', padding:'7px 10px', display:'flex', gap:7, alignItems:'flex-start' }}>
          <span style={{ fontSize:13, flexShrink:0, marginTop:1 }}>⚠️</span>
          <span className="ios-caption2" style={{ color:'var(--labels-secondary)', lineHeight:1.45 }}>현재 제품 가격과 상이한 모바일 교환권은 매장 계산대에서만 인상 전 가격으로 적용됩니다. 스마트오더 및 키오스크로 안심하게 결제하실 수 있습니다.</span>
        </div>
        {/* Category tabs (DS.SegmentedControl) */}
        <div style={{ padding:'0 12px 12px' }}>
          <DS.SegmentedControl
            segments={catalog.categories.map(c => ({ label: c.label, value: c.id }))}
            value={cat}
            onChange={setCat}
            style={{ height:36 }}
          />
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px', paddingBottom:96 }}>
        {groupItems(items).map(([group, grouped]) => (
          <div key={group || '_'} style={{ marginBottom:14 }}>
            {group && <div className="ios-caption1" style={{ fontWeight:800, color:'var(--labels-secondary)', margin:'4px 2px 8px' }}>{group}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
              {grouped.map(item => (
                <button key={item.id} onClick={() => setSel(item)} style={{
                  background:'var(--backgrounds-grouped-secondary)', border:'none',
                  borderRadius:'var(--radius-lg)', padding:'12px 8px', cursor:'pointer',
                  textAlign:'center', position:'relative',
                  boxShadow:'var(--shadow-card)',
                  transition:'transform 0.12s',
                }}
                  onMouseDown={e => e.currentTarget.style.transform='scale(0.96)'}
                  onMouseUp={e => e.currentTarget.style.transform='scale(1)'}
                  onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
                >
                  {item.badge && <MenuBadge text={item.badge}/>}
                  {(item.hotOnly || item.iceOnly) && <TempChip hot={item.hotOnly}/>}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:68 }}>
                    <CupSVG id={item.id} size={60}/>
                  </div>
                  <div className="ios-caption1" style={{ fontWeight:600, color:'var(--labels-primary)', lineHeight:1.35, marginBottom:5, minHeight:30, display:'flex', alignItems:'center', justifyContent:'center' }}>{item.name}</div>
                  <div style={{ fontSize:13, fontWeight:900, color:'var(--labels-primary)' }}>₩{item.price.toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom toolbar (dark surface) */}
      <div className="dark" style={{ position:'absolute', bottom:0, left:0, right:0 }}>
        <DS.Toolbar translucent={false} style={{ height:74, padding:'10px 16px', background:'var(--backgrounds-primary)' }}>
          <div>
            <div className="ios-caption2" style={{ color:'var(--labels-tertiary)' }}>총 결제 금액</div>
            <div style={{ fontSize:20, fontWeight:900, color:'var(--labels-primary)', letterSpacing:'-0.5px' }}>₩{cartTotal.toLocaleString()}</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <DS.Button variant="filled" tint={cartCount>0 ? 'var(--accents-blue)' : 'var(--fills-tertiary)'} disabled={cartCount===0} onClick={() => cartCount>0 && onViewCart()}>
                결제하기
              </DS.Button>
              {cartCount>0 && <DS.Badge count={cartCount} style={{ position:'absolute', top:-8, right:-8 }}/>}
            </div>
          </div>
        </DS.Toolbar>
      </div>

      {sel && <ItemModal item={sel} sizes={catalog.sizes} extraOptions={catalog.extras} onClose={() => setSel(null)} onAdd={(cfg) => { onAdd({...sel,...cfg}); setSel(null); }}/>}
    </div>
  );
}

/* ─── ITEM MODAL (DS.Sheet bottom sheet) ─── */
function ModalSection({ label, children }) {
  return (
    <div style={{ padding:'14px 0', borderBottom:'0.5px solid var(--separators-non-opaque)' }}>
      <div className="ios-footnote" style={{ color:'var(--labels-primary)', fontWeight:700, marginBottom:10 }}>{label}</div>
      {children}
    </div>
  );
}

function ItemModal({ item, sizes, extraOptions, onClose, onAdd }) {
  const isCoffee = item.category === 'coffee';
  const isFood = item.category === 'dessert'; // 크로와상/마카롱/티라미수/와플 등 음료가 아닌 상품
  const [temp, setTemp] = useState(item.iceOnly ? 'ice' : item.hotOnly ? 'hot' : 'ice');
  const [size, setSize] = useState('M');
  const [caffeine, setCaffeine] = useState('regular');
  const [iceType, setIceType] = useState(item.defaultIce || 'cube');
  const [extras, setExtras] = useState([]);
  const [qty, setQty] = useState(1);

  // 상품 카테고리에 맞지 않는 추가 옵션은 제거한다.
  // - 디저트(음식류)는 음료용 옵션(샷/시럽/휘핑/펄/텀블러)이 전혀 해당되지 않는다.
  // - 빽사이즈는 hasBaekSize 메뉴에서만.
  // - 에스프레소 샷 추가는 커피 베이스 음료(커피/논커피 라떼류)에만 해당.
  // - 버블펄 추가는 블랙펄 메뉴 또는 이름에 '버블'이 들어간 음료에만 해당.
  const visibleExtras = isFood ? [] : extraOptions.filter(e => {
    if (e.id === 'baeksize') return item.hasBaekSize;
    if (e.id === 'shot') return item.category === 'coffee' || item.category === 'noncoffee';
    if (e.id === 'pearl') return item.category === 'pearl' || item.name.includes('버블');
    return true;
  });
  const sizeExtra = (isCoffee || isFood) ? 0 : (sizes.find(s=>s.id===size)?.extra||0);
  const extraTotal = extras.reduce((s,id) => s+(extraOptions.find(e=>e.id===id)?.price||0), 0);
  const unitPrice = item.price + sizeExtra + extraTotal;
  const total = unitPrice * qty;

  const toggleExtra = id => setExtras(p => p.includes(id) ? p.filter(e=>e!==id) : [...p,id]);

  return (
    <DS.Sheet detent="large" radius={34} grabber onClick={onClose} style={{ height:'auto', maxHeight:'88%' }}>
      <div onClick={e=>e.stopPropagation()}>
        {/* Product header */}
        <div style={{ padding:'12px 20px 16px', display:'flex', gap:14, alignItems:'center', borderBottom:'0.5px solid var(--separators-non-opaque)' }}>
          <div style={{ background:'var(--fills-quaternary)', borderRadius:'var(--radius-lg)', padding:10, flexShrink:0 }}><CupSVG id={item.id} size={68}/></div>
          <div style={{ flex:1 }}>
            <div className="ios-headline" style={{ color:'var(--labels-primary)', marginBottom:3 }}>{item.name}</div>
            <div className="ios-footnote" style={{ color:'var(--labels-secondary)', marginBottom:6 }}>{item.en}</div>
            <div style={{ display:'flex', gap:6 }}>
              {item.hotOnly && <span style={{ fontSize:10, fontWeight:700, color:'var(--accents-red)', background:'color-mix(in srgb, var(--accents-red) 10%, transparent)', borderRadius:6, padding:'3px 7px' }}>HOT ONLY</span>}
              {item.iceOnly && <span style={{ fontSize:10, fontWeight:700, color:'var(--accents-blue)', background:'color-mix(in srgb, var(--accents-blue) 10%, transparent)', borderRadius:6, padding:'3px 7px' }}>ICE ONLY</span>}
            </div>
            <div className="ios-title2" style={{ color:'var(--accents-blue)', marginTop:6 }}>₩{unitPrice.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ padding:'0 20px' }}>
          {/* Temp: 음식류(디저트)는 온도 선택 자체가 없다 */}
          {!isFood && !item.hotOnly && !item.iceOnly && (
            <ModalSection label="🌡 온도 선택">
              <DS.SegmentedControl segments={[{label:'🧊 ICE', value:'ice'},{label:'🔥 HOT', value:'hot'}]} value={temp} onChange={setTemp} style={{ height:40 }}/>
            </ModalSection>
          )}
          {/* Size: 커피는 기본/빽사이즈(아래 추가 옵션), 디저트는 단일 사이즈, 그 외 음료는 S/M/L */}
          {!isCoffee && !isFood && (
            <ModalSection label="📐 사이즈 선택">
              <DS.SegmentedControl
                segments={sizes.map(s => ({ label: s.extra>0 ? `${s.id} +${s.extra.toLocaleString()}` : `${s.id} 기본`, value: s.id }))}
                value={size} onChange={setSize} style={{ height:40 }}
              />
            </ModalSection>
          )}
          {/* 카페인 선택: 디카페인 지원 메뉴만 */}
          {isCoffee && item.hasDecaf && (
            <ModalSection label="☕ 카페인 선택">
              <DS.SegmentedControl segments={[{label:'일반', value:'regular'},{label:'디카페인', value:'decaf'}]} value={caffeine} onChange={setCaffeine} style={{ height:40 }}/>
            </ModalSection>
          )}
          {/* 얼음 선택: 커피 + ICED 인 경우만 */}
          {isCoffee && temp==='ice' && (
            <ModalSection label="🧊 얼음 선택">
              <DS.SegmentedControl segments={[{label:'각얼음', value:'cube'},{label:'간얼음', value:'crushed'}]} value={iceType} onChange={setIceType} style={{ height:40 }}/>
            </ModalSection>
          )}
          {/* Extras (DS.List / DS.ListRow): 해당 상품에 적용 가능한 옵션이 없으면 섹션 자체를 숨긴다 */}
          {visibleExtras.length > 0 && (
            <ModalSection label="✨ 추가 옵션 (선택)">
              <DS.List inset={false}>
                {visibleExtras.map(e => {
                  const on = extras.includes(e.id);
                  return (
                    <DS.ListRow
                      key={e.id}
                      title={e.label}
                      accessory="checkmark"
                      selected={on}
                      onClick={() => toggleExtra(e.id)}
                      style={{ padding:'11px 6px' }}
                      trailing={<span style={{ fontSize:13, fontWeight:700, color: on ? 'var(--accents-blue)' : 'var(--labels-secondary)' }}>{e.price<0 ? '−' : '+'}₩{Math.abs(e.price).toLocaleString()}</span>}
                    />
                  );
                })}
              </DS.List>
            </ModalSection>
          )}
          {/* Qty (DS.Stepper) */}
          <div style={{ padding:'14px 0 16px', display:'flex', alignItems:'center', gap:14 }}>
            <div className="ios-footnote" style={{ color:'var(--labels-primary)', fontWeight:700 }}>🔢 수량</div>
            <DS.Stepper value={qty} min={1} onChange={setQty}/>
            <span style={{ fontSize:16, fontWeight:800, color:'var(--labels-primary)', minWidth:16, textAlign:'center' }}>{qty}</span>
            <span style={{ marginLeft:'auto', fontSize:11, color:'var(--labels-secondary)' }}>₩{unitPrice.toLocaleString()} × {qty}개</span>
          </div>
          {/* Add btn */}
          <DS.Button
            variant="filled" size="large" block
            onClick={() => onAdd({ temp: isFood ? null : temp, size: (isCoffee || isFood) ? 'base' : size, caffeine, iceType: isFood ? null : iceType, extras, qty, unitPrice })}
            style={{ justifyContent:'space-between', padding:'0 22px', marginBottom:8 }}
          >
            <span>장바구니 담기</span>
            <span>₩{total.toLocaleString()}</span>
          </DS.Button>
        </div>
      </div>
    </DS.Sheet>
  );
}

/* 장바구니 항목의 옵션 요약 문구를 만든다. */
function cartItemSummary(item, extraOptions) {
  const parts = item.temp ? [item.temp==='ice' ? '🧊 ICE' : '🔥 HOT'] : [];
  if (item.size && item.size !== 'base') parts.push(`${item.size}사이즈`);
  if (item.caffeine === 'decaf') parts.push('디카페인');
  if (item.temp==='ice' && item.iceType === 'crushed') parts.push('간얼음');
  if (item.extras?.length > 0) {
    parts.push(item.extras.map(id => extraOptions.find(e=>e.id===id)?.label.replace(' 추가','').replace(' 시럽','시럽')).join(', '));
  }
  return parts.join(' · ');
}

/* ─── CART SCREEN ─── */
function CartScreen({ cart, extraOptions, orderType, onBack, onPayment, onQty, onRemove }) {
  const { subtotal, tax, total } = computeTotals(cart);

  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'var(--backgrounds-grouped-primary)' }}>
      <div className="dark" style={{ background:'var(--backgrounds-primary)', flexShrink:0 }}>
        <DS.NavigationBar
          back="뒤로" onBack={onBack} translucent={false}
          title={<TwoLineTitle title="주문 확인" subtitle={orderType==='dine-in' ? '🍽 매장 이용' : '🥤 포장'}/>}
          trailing={<StepPill>STEP 3/3</StepPill>}
          style={{ borderBottom:'none' }}
        />
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:14 }}>
        {cart.length===0 ? (
          <div style={{ textAlign:'center', padding:'70px 20px' }}>
            <div style={{ fontSize:44, marginBottom:14 }}>🛒</div>
            <div className="ios-headline" style={{ color:'var(--labels-primary)' }}>장바구니가 비었어요</div>
            <div className="ios-footnote" style={{ color:'var(--labels-secondary)', marginTop:6 }}>메뉴를 선택해 담아주세요</div>
          </div>
        ) : (
          <>
            {cart.map((item, idx) => (
              <DS.Card key={idx} padding={14} radius={16} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                  <div style={{ background:'var(--fills-quaternary)', borderRadius:12, padding:6, flexShrink:0 }}><CupSVG id={item.id} size={48}/></div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:'var(--labels-primary)', marginBottom:3 }}>{item.name}</div>
                    <div className="ios-caption1" style={{ color:'var(--labels-secondary)', marginBottom:8, lineHeight:1.4 }}>
                      {cartItemSummary(item, extraOptions)}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <DS.Stepper value={item.qty} min={0} onChange={v => onQty(idx, v)} style={{ height:28 }}/>
                      <span style={{ fontSize:14, fontWeight:800, color:'var(--labels-primary)' }}>{item.qty}개</span>
                    </div>
                  </div>
                  <div style={{ textAlign:'right', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                    <div style={{ fontSize:15, fontWeight:900, color:'var(--labels-primary)' }}>₩{(item.unitPrice*item.qty).toLocaleString()}</div>
                    <div className="ios-caption2" style={{ color:'var(--labels-secondary)' }}>₩{item.unitPrice.toLocaleString()} × {item.qty}</div>
                    <DS.IconButton icon="trash" variant="plain" tint="var(--accents-red)" size="small" onClick={() => onRemove(idx)}/>
                  </div>
                </div>
              </DS.Card>
            ))}
            {/* Summary (DS.Card) */}
            <DS.Card padding={16} radius={16}>
              <div className="ios-footnote" style={{ color:'var(--labels-primary)', fontWeight:700, marginBottom:12 }}>주문 요약</div>
              {[['소계', subtotal], ['부가세 (10%, 포함)', tax]].map(([l,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span className="ios-footnote" style={{ color:'var(--labels-secondary)' }}>{l}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--labels-primary)' }}>₩{v.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ borderTop:'0.5px solid var(--separators-non-opaque)', paddingTop:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:16, fontWeight:800, color:'var(--labels-primary)' }}>최종 합계</span>
                <span className="ios-title2" style={{ color:'var(--accents-blue)' }}>₩{total.toLocaleString()}</span>
              </div>
            </DS.Card>
          </>
        )}
      </div>

      <DS.Toolbar translucent={false} style={{ height:'auto', padding:'12px 16px', background:'var(--backgrounds-primary)' }}>
        <DS.Button variant="bordered" size="large" onClick={onBack} style={{ flex:1 }}>← 메뉴 추가</DS.Button>
        <DS.Button variant="filled" size="large" disabled={cart.length===0} onClick={onPayment} style={{ flex:2 }}>결제하기 · ₩{total.toLocaleString()}</DS.Button>
      </DS.Toolbar>
    </div>
  );
}

/* ─── PAYMENT SCREEN ─── */
const PHONE_PATTERN = /^01[0-9]-?\d{3,4}-?\d{4}$/;

function formatPhoneDigits(digits) {
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0,3)}-${digits.slice(3)}`;
  return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7,11)}`;
}

/* ─── PAYMENT GATEWAY SIMULATION ───
   실제 PG사 연동 없이 각 결제수단(간편결제 리다이렉트/승인대기, 카드사 선택 후
   카드 입력, Apple Pay 시트)을 화면상에서 재현한다. 시뮬레이션이 성공으로
   끝나야만 실제 주문 생성 API(onPay)를 호출한다. */
function luhnCheck(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}
function fmtCardNumber(digits) { return digits.replace(/(\d{4})(?=\d)/g, '$1 '); }
function fmtCardExpiry(digits) { return digits.length <= 2 ? digits : digits.slice(0, 2) + '/' + digits.slice(2, 4); }
function fmtMMSS(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
/* 실제 QR 코드처럼 보이도록 세 모서리 파인더 패턴 + 타이밍 패턴 + 정렬 패턴을
   그리고, 나머지 모듈만 시드 기반 의사난수로 채운다(스캔 가능한 진짜 QR은 아님). */
const QR_SIZE = 21;
function qrMatrix(seed) {
  let x = seed;
  const rand = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  const grid = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false));

  const drawFinder = (r0, c0) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[r0 + r][c0 + c] = border || core;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, QR_SIZE - 7);
  drawFinder(QR_SIZE - 7, 0);

  for (let i = 8; i < QR_SIZE - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  const ar = QR_SIZE - 9, ac = QR_SIZE - 9;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const border = r === 0 || r === 4 || c === 0 || c === 4;
      const core = r === 2 && c === 2;
      grid[ar + r][ac + c] = border || core;
    }
  }

  for (let r = 0; r < QR_SIZE; r++) {
    for (let c = 0; c < QR_SIZE; c++) {
      const inFinder = (r < 8 && c < 8) || (r < 8 && c >= QR_SIZE - 8) || (r >= QR_SIZE - 8 && c < 8);
      const inAlign = r >= ar - 1 && r <= ar + 5 && c >= ac - 1 && c <= ac + 5;
      const inTiming = r === 6 || c === 6;
      if (inFinder || inAlign || inTiming) continue;
      grid[r][c] = rand() > 0.55;
    }
  }
  return grid.flat();
}
const TEST_CARDS = [
  { label: '정상 승인', number: '4242424242424242', expiry: '12/29', cvc: '123' },
  { label: '카드 거절', number: '4000000000000002', expiry: '12/29', cvc: '123' },
];
/* 키오스크 고객 화면에는 간편결제/카드만 노출한다. '현금결제'는 계산대 직원이
   별도로 처리하는 방식이라 여기서는 숨기지만, 과거 주문이 참조하므로 DB에서는
   지우지 않는다(관리자 화면의 매출 통계·주문 상세는 영향받지 않음). */
const KIOSK_PAY_METHOD_ORDER = ['kakao', 'naver', 'samsung', 'apple', 'payco', 'card'];
function kioskPayMethods(payMethods) {
  return KIOSK_PAY_METHOD_ORDER
    .map(id => payMethods.find(pm => pm.id === id))
    .filter(Boolean);
}
const PAY_METHOD_DESC = {
  kakao: '카카오톡으로 간편하게 결제',
  naver: '네이버 아이디로 간편하게 결제',
  samsung: '지문 인증으로 간편하게 결제',
  apple: 'Face ID로 즉시 결제',
  payco: '페이코 포인트로 간편하게 결제',
  card: '카드 정보를 직접 입력',
  cash: '카운터에서 현금으로 결제',
};
const CARD_ISSUERS = [
  { id: 'shinhan', label: '신한카드', color: '#0046FF' },
  { id: 'samsung', label: '삼성카드', color: '#1428A0' },
  { id: 'kb', label: 'KB국민카드', color: '#FFB300' },
  { id: 'hyundai', label: '현대카드', color: '#000000' },
  { id: 'lotte', label: '롯데카드', color: '#ED1C24' },
  { id: 'hana', label: '하나카드', color: '#008485' },
  { id: 'nh', label: 'NH농협카드', color: '#00A651' },
  { id: 'woori', label: '우리카드', color: '#0067AC' },
  { id: 'bc', label: 'BC카드', color: '#EA002C' },
];

/* 결제수단별 게이트웨이 시뮬레이션 오버레이. 승인되면 onApprove(), 취소/거절되면
   onCancel(reason)을 호출해 부모(PaymentScreen)가 실제 결제 진행 여부를 결정한다. */
function PaymentGatewaySheet({ method, methodMeta, amount, onApprove, onCancel }) {
  const [stage, setStage] = useState(method.id === 'card' ? 'card_issuer' : method.id === 'apple' ? 'apple_sheet' : 'redirect');
  const [countdown, setCountdown] = useState(60);
  const [issuer, setIssuer] = useState(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardTouched, setCardTouched] = useState({});
  const [cardErrors, setCardErrors] = useState({});
  const issuerMeta = CARD_ISSUERS.find(i => i.id === issuer);

  const timers = useRef([]);
  const pushTimer = (t) => timers.current.push(t);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (stage !== 'redirect') return;
    pushTimer(setTimeout(() => { setCountdown(60); setStage('wait'); }, 900));
  }, [stage]);

  useEffect(() => {
    if (stage !== 'wait') return;
    if (countdown <= 0) { onCancel('인증 시간이 초과되었습니다. 다시 시도해주세요.'); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, countdown]);

  const rawCardNumber = cardNumber.replace(/\s/g, '');
  function validateCard() {
    const e = {};
    if (rawCardNumber.length < 13 || rawCardNumber.length > 16 || !luhnCheck(rawCardNumber)) e.number = '카드 번호가 올바르지 않습니다.';
    if (!cardName.trim()) e.name = '카드에 표시된 이름을 입력해주세요.';
    const [mm, yy] = cardExpiry.split('/');
    if (!mm || !yy || mm.length !== 2 || yy.length !== 2) e.expiry = 'MM/YY 형식으로 입력해주세요.';
    if (cardCvc.length !== 3) e.cvc = 'CVC는 3자리입니다.';
    setCardErrors(e);
    return Object.keys(e).length === 0;
  }
  function fillTestCard(tc) {
    setCardNumber(fmtCardNumber(tc.number));
    setCardName('HONG GILDONG');
    setCardExpiry(tc.expiry);
    setCardCvc(tc.cvc);
    setCardErrors({}); setCardTouched({});
  }
  function submitCard() {
    setCardTouched({ number: true, name: true, expiry: true, cvc: true });
    if (!validateCard()) return;
    setStage('card_processing');
    pushTimer(setTimeout(() => {
      if (rawCardNumber === '4000000000000002') onCancel('카드가 거절되었습니다. 카드사에 문의해주세요.');
      else onApprove();
    }, 1400));
  }

  return (
    <DS.Sheet detent={stage === 'card_form' || stage === 'card_issuer' ? 'large' : 'medium'}>
      <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 16px 4px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {stage === 'card_form' && (
              <DS.IconButton icon="chevron.left" variant="plain" size="small" onClick={() => setStage('card_issuer')} aria-label="뒤로"/>
            )}
            <div style={{ width:32, height:32, borderRadius:9, background: methodMeta.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{methodMeta.icon}</div>
            <span className="ios-footnote" style={{ fontWeight:800, color:'var(--labels-primary)' }}>{methodMeta.label}</span>
          </div>
          {stage !== 'card_processing' && (
            <DS.IconButton icon="xmark" variant="plain" size="small" onClick={() => onCancel(null)} aria-label="취소"/>
          )}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'8px 24px 24px', display:'flex', flexDirection:'column' }}>
          {stage === 'redirect' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, textAlign:'center' }}>
              <DS.ActivityIndicator size={30} color="var(--accents-blue)"/>
              <div className="ios-headline" style={{ color:'var(--labels-primary)' }}>{methodMeta.label} 결제창으로 이동 중</div>
              <div className="ios-caption2" style={{ color:'var(--labels-tertiary)', maxWidth:260 }}>실제 서비스에서는 이 시점에 {methodMeta.label} 앱/도메인으로 이동합니다.</div>
            </div>
          )}

          {stage === 'wait' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:16, textAlign:'center', paddingTop:8 }}>
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${QR_SIZE}, 1fr)`, width:132, height:132, background:'#fff', border:'1px solid var(--separators-non-opaque)', borderRadius:10, padding:10 }}>
                {qrMatrix(42).map((on, i) => <div key={i} style={{ background: on ? '#000' : 'transparent' }}/>)}
              </div>
              <div>
                <div className="ios-headline" style={{ color:'var(--labels-primary)' }}>{methodMeta.label} 앱에서 결제를 승인해주세요</div>
                <div className="ios-caption2" style={{ color:'var(--labels-tertiary)', marginTop:4 }}>모바일 알림 또는 QR 스캔으로 인증합니다</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, color: countdown < 15 ? 'var(--accents-red)' : 'var(--labels-secondary)', fontSize:13, fontWeight:600 }}>
                <DS.Icon name="clock" size={14}/>
                <span>{fmtMMSS(countdown)} 이내 인증 필요</span>
              </div>
              <div style={{ width:'100%', marginTop:8, paddingTop:16, borderTop:'0.5px solid var(--separators-non-opaque)' }}>
                <div style={{ display:'flex', gap:8 }}>
                  <DS.Button variant="filled" tint="var(--accents-green)" block onClick={onApprove}>승인</DS.Button>
                  <DS.Button variant="bordered" block onClick={() => onCancel('사용자가 결제를 거절했습니다.')}>거절</DS.Button>
                </div>
              </div>
            </div>
          )}

          {stage === 'apple_sheet' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
              <div style={{ background:'#000', borderRadius:14, padding:'16px 18px', marginBottom:16 }}>
                <div style={{ color:'#fff', fontSize:13, fontWeight:700, marginBottom:10 }}>Apple Pay</div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, color:'#D1D1D6', marginBottom:4 }}>
                  <span>주문 금액</span><span>₩{amount.toLocaleString()}</span>
                </div>
                <div style={{ borderTop:'1px solid #333', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between', fontSize:13, color:'#fff', fontWeight:700 }}>
                  <span>합계</span><span>₩{amount.toLocaleString()}</span>
                </div>
              </div>
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:'12px 0' }}>
                <div style={{ fontSize:38 }}>🆔</div>
                <div className="ios-headline" style={{ color:'var(--labels-primary)' }}>Face ID로 결제를 확인하세요</div>
                <div className="ios-caption2" style={{ color:'var(--labels-tertiary)' }}>도메인 이동 없이 이 화면에서 바로 인증됩니다</div>
                <div style={{ width:'100%', marginTop:8, paddingTop:16, borderTop:'0.5px dashed var(--separators-non-opaque)' }}>
                  <div style={{ display:'flex', gap:8 }}>
                    <DS.Button variant="filled" tint="var(--accents-green)" block onClick={onApprove}>Face ID 인증 성공</DS.Button>
                    <DS.Button variant="bordered" block onClick={() => onCancel('Face ID 인증이 취소되었습니다.')}>인증 취소</DS.Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {stage === 'card_issuer' && (
            <div>
              <div className="ios-headline" style={{ color:'var(--labels-primary)', marginBottom:4 }}>카드사 선택</div>
              <div className="ios-caption2" style={{ color:'var(--labels-tertiary)', marginBottom:18 }}>결제하실 카드의 발급사를 선택해주세요</div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
                {CARD_ISSUERS.map(iss => (
                  <button key={iss.id} onClick={() => { setIssuer(iss.id); setStage('card_form'); }} style={{
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8,
                    padding:'16px 8px', borderRadius:12, border:`1.5px solid ${issuer === iss.id ? 'var(--accents-blue)' : 'var(--separators-non-opaque)'}`,
                    background:'var(--backgrounds-primary)', cursor:'pointer',
                  }}>
                    <div style={{ width:32, height:32, borderRadius:8, background: iss.color }}/>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--labels-primary)' }}>{iss.label}</span>
                  </button>
                ))}
              </div>

              <div className="ios-caption2" style={{ color:'var(--labels-tertiary)', margin:'18px 0 10px', textAlign:'center' }}>
                카드사를 모르시면 다음 화면에서 카드번호만 입력하셔도 됩니다
              </div>
              <DS.Button variant="gray" size="large" block onClick={() => { setIssuer(null); setStage('card_form'); }}>카드사 선택 건너뛰기</DS.Button>
            </div>
          )}

          {stage === 'card_form' && (
            <div>
              <div className="ios-caption2" style={{ color:'var(--labels-tertiary)', marginBottom:16 }}>
                {issuerMeta ? (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                    <span style={{ width:14, height:14, borderRadius:4, background: issuerMeta.color, display:'inline-block' }}/>
                    {issuerMeta.label} · ₩{amount.toLocaleString()}
                  </span>
                ) : `카드 정보를 입력해주세요 · ₩${amount.toLocaleString()}`}
              </div>

              <div style={{ marginBottom:18, padding:12, borderRadius:12, background:'var(--fills-tertiary)' }}>
                <div className="ios-caption2" style={{ color:'var(--labels-secondary)', fontWeight:700, marginBottom:8 }}>테스트 카드로 빠르게 입력하기</div>
                <div style={{ display:'flex', gap:8 }}>
                  {TEST_CARDS.map(tc => (
                    <button key={tc.label} onClick={() => fillTestCard(tc)} style={{ flex:1, fontSize:13, fontWeight:700, padding:'10px 10px', borderRadius:9, border:'1.5px solid var(--separators-non-opaque)', background:'var(--backgrounds-primary)', color:'var(--labels-primary)', cursor:'pointer' }}>
                      {tc.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:12 }}>
                <div className="ios-caption2" style={{ color:'var(--labels-secondary)', fontWeight:700, marginBottom:6 }}>카드 번호</div>
                <DS.TextField
                  value={cardNumber} placeholder="4242 4242 4242 4242" inputMode="numeric"
                  onChange={(v) => setCardNumber(fmtCardNumber(v.replace(/\D/g, '').slice(0, 16)))}
                  onBlur={() => setCardTouched(t => ({ ...t, number: true }))}
                  style={cardTouched.number && cardErrors.number ? { boxShadow:'inset 0 0 0 1.5px var(--accents-red)' } : undefined}
                />
                {cardTouched.number && cardErrors.number && <div className="ios-caption2" style={{ color:'var(--accents-red)', marginTop:4 }}>{cardErrors.number}</div>}
              </div>

              <div style={{ marginBottom:12 }}>
                <div className="ios-caption2" style={{ color:'var(--labels-secondary)', fontWeight:700, marginBottom:6 }}>카드 소유자 이름</div>
                <DS.TextField
                  value={cardName} placeholder="HONG GILDONG"
                  onChange={setCardName} onBlur={() => setCardTouched(t => ({ ...t, name: true }))}
                  style={cardTouched.name && cardErrors.name ? { boxShadow:'inset 0 0 0 1.5px var(--accents-red)' } : undefined}
                />
                {cardTouched.name && cardErrors.name && <div className="ios-caption2" style={{ color:'var(--accents-red)', marginTop:4 }}>{cardErrors.name}</div>}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                <div>
                  <div className="ios-caption2" style={{ color:'var(--labels-secondary)', fontWeight:700, marginBottom:6 }}>유효기간</div>
                  <DS.TextField
                    value={cardExpiry} placeholder="MM/YY" inputMode="numeric"
                    onChange={(v) => setCardExpiry(fmtCardExpiry(v.replace(/\D/g, '').slice(0, 4)))}
                    onBlur={() => setCardTouched(t => ({ ...t, expiry: true }))}
                    style={cardTouched.expiry && cardErrors.expiry ? { boxShadow:'inset 0 0 0 1.5px var(--accents-red)' } : undefined}
                  />
                  {cardTouched.expiry && cardErrors.expiry && <div className="ios-caption2" style={{ color:'var(--accents-red)', marginTop:4 }}>{cardErrors.expiry}</div>}
                </div>
                <div>
                  <div className="ios-caption2" style={{ color:'var(--labels-secondary)', fontWeight:700, marginBottom:6 }}>CVC</div>
                  <DS.TextField
                    value={cardCvc} placeholder="123" inputMode="numeric"
                    onChange={(v) => setCardCvc(v.replace(/\D/g, '').slice(0, 3))}
                    onBlur={() => setCardTouched(t => ({ ...t, cvc: true }))}
                    style={cardTouched.cvc && cardErrors.cvc ? { boxShadow:'inset 0 0 0 1.5px var(--accents-red)' } : undefined}
                  />
                  {cardTouched.cvc && cardErrors.cvc && <div className="ios-caption2" style={{ color:'var(--accents-red)', marginTop:4 }}>{cardErrors.cvc}</div>}
                </div>
              </div>

              <DS.Button variant="filled" size="large" block icon="lock" onClick={submitCard}>₩{amount.toLocaleString()} 결제하기</DS.Button>
            </div>
          )}

          {stage === 'card_processing' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14 }}>
              <DS.ActivityIndicator size={30} color="var(--accents-blue)"/>
              <div className="ios-headline" style={{ color:'var(--labels-primary)' }}>카드 승인 요청 중...</div>
            </div>
          )}
        </div>
      </div>
    </DS.Sheet>
  );
}

/* 키오스크 터치 환경에서는 OS 키보드 대신 화면 안에 숫자 패드를 그려서 입력받는다. */
function PhoneKeypad({ digits, onChange, maxLength = 11 }) {
  const press = d => { if (digits.length < maxLength) onChange(digits + d); };
  const backspace = () => onChange(digits.slice(0, -1));
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
      {keys.map((k, i) => k === '' ? <div key={i}/> : (
        <button
          key={i}
          onClick={() => k === '⌫' ? backspace() : press(k)}
          style={{
            height:48, borderRadius:10, border:'none', background:'var(--fills-tertiary)',
            color:'var(--labels-primary)', fontSize:18, fontWeight:700, cursor:'pointer',
          }}
        >{k}</button>
      ))}
    </div>
  );
}

function PaymentScreen({ total, payMethods, processing, error, onBack, onPay }) {
  const [sel, setSel] = useState(null);
  // 'none' | 'earn'(포인트 적립) | 'use'(적립금 사용) — 동시에 둘 다 할 수 없다.
  const [pointsMode, setPointsMode] = useState('none');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [balance, setBalance] = useState(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [gatewayError, setGatewayError] = useState(null);

  const phoneValid = PHONE_PATTERN.test(phoneDigits);
  const pointsToUse = pointsMode === 'use' && balance != null ? Math.min(balance, total) : 0;
  const payableTotal = total - pointsToUse;
  const canPay = sel
    && (pointsMode !== 'earn' || phoneValid)
    && (pointsMode !== 'use' || (phoneValid && balance != null));
  const activeMethodMeta = payMethods.find(p => p.id === sel);

  const handleGatewayApprove = () => {
    setGatewayOpen(false);
    onPay(sel, pointsMode === 'none' ? null : formatPhoneDigits(phoneDigits), pointsMode === 'use');
  };
  const handleGatewayCancel = (reason) => {
    setGatewayOpen(false);
    setGatewayError(reason);
  };

  const selectMode = (mode) => {
    setPointsMode(m => m === mode ? 'none' : mode);
    setPhoneDigits('');
    setBalance(null);
    setLookupError(null);
  };

  const changePhone = (digits) => {
    setPhoneDigits(digits);
    setBalance(null);
    setLookupError(null);
  };

  const lookupBalance = () => {
    setLooking(true);
    setLookupError(null);
    apiGet(`/members/${phoneDigits}/points`)
      .then(res => { setBalance(res.balance); setLooking(false); })
      .catch(err => { setLookupError(err.message); setLooking(false); });
  };

  return (
    <div style={{ width:'100%', height:'100%', position:'relative', display:'flex', flexDirection:'column', background:'var(--backgrounds-grouped-primary)' }}>
      <div className="dark" style={{ background:'var(--backgrounds-primary)', flexShrink:0 }}>
        <DS.NavigationBar
          back="뒤로" onBack={onBack} translucent={false}
          title={<TwoLineTitle title="결제 수단 선택" subtitle="Payment Method"/>}
          style={{ borderBottom:'none' }}
        />
      </div>

      <div style={{ flex:1, padding:16, overflowY:'auto' }}>
        {/* Amount card (dark surface, like the original navy gradient) */}
        <div className="dark" style={{ marginBottom:20 }}>
          <DS.Card padding={24} radius={20} elevated style={{ background:'var(--backgrounds-secondary)', textAlign:'center' }}>
            <div className="ios-caption1" style={{ color:'var(--labels-tertiary)', marginBottom:6, letterSpacing:1, textTransform:'uppercase' }}>결제할 금액</div>
            {pointsToUse > 0 ? (
              <>
                <div className="ios-title2" style={{ color:'var(--labels-tertiary)', textDecoration:'line-through' }}>₩{total.toLocaleString()}</div>
                <div className="ios-large-title" style={{ color:'var(--accents-green)' }}>₩{payableTotal.toLocaleString()}</div>
                <div className="ios-caption2" style={{ color:'var(--accents-green)', marginTop:4 }}>적립금 ₩{pointsToUse.toLocaleString()} 사용</div>
              </>
            ) : (
              <div className="ios-large-title" style={{ color:'var(--labels-primary)' }}>₩{total.toLocaleString()}</div>
            )}
            <div className="ios-caption2" style={{ color:'var(--labels-tertiary)', marginTop:6 }}>부가세 포함</div>
          </DS.Card>
        </div>

        <div>
          <div className="ios-footnote" style={{ color:'var(--labels-primary)', fontWeight:700 }}>결제 방식을 선택해 주세요</div>
          <div className="ios-caption2" style={{ color:'var(--labels-tertiary)', marginTop:2, marginBottom:14 }}>시뮬레이션 화면이며 실제 결제는 발생하지 않습니다.</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {payMethods.map(pm => {
            const on = sel===pm.id;
            return (
              <button key={pm.id} onClick={() => { setSel(pm.id); setGatewayError(null); }} style={{
                display:'flex', alignItems:'center', gap:14, textAlign:'left',
                background:'var(--backgrounds-primary)',
                border: `2px solid ${on ? 'var(--accents-blue)' : 'var(--separators-non-opaque)'}`,
                borderRadius:'var(--radius-lg)', padding:'16px 18px', cursor:'pointer',
                boxShadow: on ? '0 6px 20px rgba(26,108,245,0.18)' : 'var(--shadow-card)',
                transition:'all 0.18s',
              }}>
                <div style={{ width:42, height:42, borderRadius:10, background: pm.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, flexShrink:0 }}>{pm.icon}</div>
                <div>
                  <div style={{ fontSize:14.5, fontWeight:700, color:'var(--labels-primary)' }}>{pm.label}</div>
                  <div className="ios-caption2" style={{ color:'var(--labels-tertiary)', marginTop:2 }}>{PAY_METHOD_DESC[pm.id] || ''}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 적립금 사용 / 포인트 적립 */}
        <DS.Card padding={16} radius={16} style={{ marginTop:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div className="ios-footnote" style={{ color:'var(--labels-primary)', fontWeight:700 }}>적립금 사용하시겠어요?</div>
              <div className="ios-caption2" style={{ color:'var(--labels-tertiary)', marginTop:2 }}>보유하신 적립금만큼 결제 금액에서 차감됩니다</div>
            </div>
            <DS.Switch checked={pointsMode === 'use'} onChange={() => selectMode('use')}/>
          </div>

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:16, paddingTop:16, borderTop:'0.5px solid var(--separators-non-opaque)' }}>
            <div>
              <div className="ios-footnote" style={{ color:'var(--labels-primary)', fontWeight:700 }}>포인트 적립하시겠어요?</div>
              <div className="ios-caption2" style={{ color:'var(--labels-tertiary)', marginTop:2 }}>결제 금액의 1%가 적립됩니다</div>
            </div>
            <DS.Switch checked={pointsMode === 'earn'} onChange={() => selectMode('earn')}/>
          </div>

          {pointsMode !== 'none' && (
            <div style={{ marginTop:16 }}>
              <div style={{
                textAlign:'center', fontSize:20, fontWeight:800, letterSpacing:'1px', marginBottom:12,
                color: phoneDigits ? 'var(--labels-primary)' : 'var(--labels-tertiary)',
              }}>
                {phoneDigits ? formatPhoneDigits(phoneDigits) : '휴대폰 번호를 입력해 주세요'}
              </div>
              <PhoneKeypad digits={phoneDigits} onChange={changePhone}/>

              {pointsMode === 'use' && (
                <DS.Button
                  variant="tinted" size="medium" block disabled={!phoneValid || looking}
                  onClick={lookupBalance} style={{ marginTop:12 }}
                >
                  {looking ? '조회 중...' : '적립금 조회'}
                </DS.Button>
              )}

              {phoneDigits && !phoneValid && (
                <div className="ios-caption2" style={{ color:'var(--accents-red)', marginTop:8, textAlign:'center' }}>휴대폰 번호 형식이 올바르지 않아요</div>
              )}
              {lookupError && (
                <div className="ios-caption2" style={{ color:'var(--accents-red)', marginTop:8, textAlign:'center' }}>{lookupError}</div>
              )}
              {pointsMode === 'use' && balance != null && (
                <div className="ios-caption1" style={{ color:'var(--accents-green)', marginTop:8, textAlign:'center', fontWeight:700 }}>
                  보유 적립금 {balance.toLocaleString()}P{pointsToUse > 0 ? ` · ₩${pointsToUse.toLocaleString()} 사용 예정` : ' (사용 가능한 적립금 없음)'}
                </div>
              )}
            </div>
          )}
        </DS.Card>

        {(gatewayError || error) && <div className="ios-footnote" style={{ marginTop:14, color:'var(--accents-red)', textAlign:'center' }}>{gatewayError || error}</div>}
      </div>

      <DS.Toolbar translucent={false} style={{ height:'auto', padding:'12px 16px', background:'var(--backgrounds-primary)' }}>
        {processing ? (
          <div style={{ width:'100%', textAlign:'center', padding:'6px 0' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:10 }}>
              <DS.ActivityIndicator size={18} color="var(--accents-blue)"/>
              <span style={{ fontSize:15, fontWeight:700, color:'var(--accents-blue)' }}>결제 처리 중...</span>
            </div>
            <div style={{ height:4, background:'var(--fills-tertiary)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'var(--accents-blue)', borderRadius:2, animation:'prog 2.2s linear forwards' }}/>
            </div>
            <style>{`@keyframes prog { from { width:0% } to { width:100% } }`}</style>
          </div>
        ) : (
          <DS.Button
            variant="filled" size="large" block disabled={!canPay}
            onClick={() => { if (canPay) { setGatewayError(null); setGatewayOpen(true); } }}
            style={{ width:'100%' }}
          >
            {sel ? `${payMethods.find(p=>p.id===sel)?.label}로 ₩${payableTotal.toLocaleString()} 결제하기` : '결제 수단을 선택해 주세요'}
          </DS.Button>
        )}
      </DS.Toolbar>

      {gatewayOpen && activeMethodMeta && (
        <PaymentGatewaySheet
          method={activeMethodMeta}
          methodMeta={activeMethodMeta}
          amount={payableTotal}
          onApprove={handleGatewayApprove}
          onCancel={handleGatewayCancel}
        />
      )}
    </div>
  );
}

/* ─── COMPLETE SCREEN ─── */
function CompleteScreen({ orderType, orderNumber, pointsEarned, pointsUsed, onReset }) {
  return (
    <div className="dark" style={{ width:'100%', height:'100%', background:'var(--backgrounds-primary)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px', textAlign:'center' }}>
      <DS.Icon name="checkmark.circle.fill" size={72} color="var(--accents-green)"/>
      <div className="ios-title1" style={{ color:'var(--labels-primary)', marginTop:20, marginBottom:10 }}>주문 완료!</div>
      <div className="ios-subhead" style={{ color:'var(--labels-secondary)', lineHeight:1.7 }}>
        결제가 완료되었습니다.<br/>잠시 후 음료가 준비됩니다 ☕
      </div>
      <DS.Card padding={20} radius={20} elevated={false} style={{ background:'color-mix(in srgb, var(--accents-orange) 15%, transparent)', margin:'24px 0 36px' }}>
        <div className="ios-caption1" style={{ color:'var(--labels-tertiary)', marginBottom:6, letterSpacing:1 }}>ORDER NUMBER</div>
        <div style={{ fontSize:44, fontWeight:900, color:'var(--accents-orange)', letterSpacing:'-1px' }}>#{orderNumber}</div>
        <div className="ios-caption2" style={{ color:'var(--labels-tertiary)', marginTop:6 }}>
          {orderType==='dine-in' ? '🍽 테이블로 가져다 드립니다' : '🥤 카운터에서 받아가세요'}
        </div>
      </DS.Card>
      {pointsEarned > 0 && (
        <div className="ios-footnote" style={{ color:'var(--accents-green)', fontWeight:700, marginBottom:24 }}>
          🎁 {pointsEarned.toLocaleString()}P 적립되었습니다
        </div>
      )}
      {pointsUsed > 0 && (
        <div className="ios-footnote" style={{ color:'var(--accents-green)', fontWeight:700, marginBottom:24 }}>
          ✅ 적립금 {pointsUsed.toLocaleString()}P 사용했습니다
        </div>
      )}
      <DS.Button variant="filled" size="large" tint="var(--accents-orange)" onClick={onReset}>처음으로 돌아가기</DS.Button>
    </div>
  );
}

/* ─── APP ROOT ─── */
function App() {
  const [screen, setScreen] = useState('welcome');
  const [orderType, setOrderType] = useState(null);
  const [cart, setCart] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);

  const loadCatalog = () => {
    setLoadError(null);
    Promise.all([
      apiGet('/categories'),
      apiGet('/menu'),
      apiGet('/sizes'),
      apiGet('/extras'),
      apiGet('/pay-methods'),
    ])
      .then(([categories, menu, sizes, extras, payMethods]) => {
        setCatalog({ categories, menu, sizes, extras, payMethods });
      })
      .catch(err => setLoadError(err.message));
  };

  useEffect(loadCatalog, []);

  const addToCart = cfg => setCart(p => [...p, { ...cfg, cartId: Date.now() }]);
  const updateQty = (idx, qty) => {
    if (qty<1) setCart(p => p.filter((_,i)=>i!==idx));
    else setCart(p => p.map((item,i) => i===idx ? {...item, qty} : item));
  };
  const remove = idx => setCart(p => p.filter((_,i)=>i!==idx));
  const reset = () => { setScreen('welcome'); setOrderType(null); setCart([]); setCompletedOrder(null); setPayError(null); };

  const { total: payTotal } = computeTotals(cart);

  const handlePay = (payMethodId, memberPhone, usePoints) => {
    setPaying(true);
    setPayError(null);
    apiPost('/orders', {
      orderType,
      payMethod: payMethodId,
      memberPhone,
      usePoints: !!usePoints,
      // 디저트류는 온도 개념이 없어 temp가 null이다. DB의 temp 컬럼은 NOT NULL이라 'hot'을 자리값으로 보낸다.
      items: cart.map(i => ({ id: i.id, temp: i.temp || 'hot', size: i.size, caffeine: i.caffeine, iceType: i.iceType || 'cube', extras: i.extras, qty: i.qty })),
    })
      .then(res => {
        setCompletedOrder(res);
        setPaying(false);
        setScreen('complete');
      })
      .catch(err => {
        setPaying(false);
        setPayError(err.message);
      });
  };

  if (loadError) return <ErrorScreen message={loadError} onRetry={loadCatalog}/>;
  if (!catalog) return <LoadingScreen/>;

  return (
    <div style={{ width:'100%', height:'100%', position:'relative', overflow:'hidden' }}>
      {screen==='welcome' && <WelcomeScreen onSelect={t => { setOrderType(t); setScreen('menu'); }}/>}
      {screen==='menu' && <MenuScreen catalog={catalog} orderType={orderType} cart={cart} onAdd={addToCart} onViewCart={() => setScreen('cart')} onBack={() => setScreen('welcome')}/>}
      {screen==='cart' && <CartScreen cart={cart} extraOptions={catalog.extras} orderType={orderType} onBack={() => setScreen('menu')} onPayment={() => setScreen('payment')} onQty={updateQty} onRemove={remove}/>}
      {screen==='payment' && <PaymentScreen total={payTotal} payMethods={kioskPayMethods(catalog.payMethods)} processing={paying} error={payError} onBack={() => setScreen('cart')} onPay={handlePay}/>}
      {screen==='complete' && <CompleteScreen orderType={orderType} orderNumber={completedOrder?.orderNumber} pointsEarned={completedOrder?.pointsEarned} pointsUsed={completedOrder?.pointsUsed} onReset={reset}/>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app-root')).render(<App/>);

/* ─── SCALE TO FIT ─── */
function scaleKiosk() {
  const frame = document.getElementById('kiosk-frame');
  if (!frame) return;
  const scale = Math.min(window.innerWidth/540, window.innerHeight/960) * 0.96;
  frame.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', scaleKiosk);
scaleKiosk();
