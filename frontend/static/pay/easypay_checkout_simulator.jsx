import React, { useState, useEffect, useRef } from "react";
import { Lock, ShieldCheck, CheckCircle2, XCircle, Loader2, CreditCard, ChevronLeft, Smartphone, Clock, Fingerprint, ScanFace } from "lucide-react";

const PRODUCT = {
  name: "Workflow Pro 연간 구독",
  desc: "팀 워크스페이스 무제한 · 우선 기술지원",
  price: 129000,
};

const METHODS = [
  { id: "kakao", label: "카카오페이", desc: "카카오톡으로 간편하게 결제", color: "#FEE500", text: "#3A2929" },
  { id: "naver", label: "네이버페이", desc: "네이버 아이디로 간편하게 결제", color: "#03C75A", text: "#FFFFFF" },
  { id: "samsung", label: "삼성페이", desc: "지문 인증으로 간편하게 결제", color: "#1428A0", text: "#FFFFFF" },
  { id: "apple", label: "Apple Pay", desc: "Face ID로 즉시 결제", color: "#000000", text: "#FFFFFF" },
  { id: "payco", label: "PAYCO", desc: "페이코 포인트로 간편하게 결제", color: "#E4312B", text: "#FFFFFF" },
  { id: "card", label: "신용 · 체크카드", desc: "카드 정보를 직접 입력", color: "#1A1D29", text: "#FFFFFF" },
];

const ISSUERS = [
  { id: "shinhan", label: "신한카드", color: "#0046FF" },
  { id: "samsung", label: "삼성카드", color: "#1428A0" },
  { id: "kb", label: "KB국민카드", color: "#FFB300" },
  { id: "hyundai", label: "현대카드", color: "#000000" },
  { id: "lotte", label: "롯데카드", color: "#ED1C24" },
  { id: "hana", label: "하나카드", color: "#008485" },
  { id: "nh", label: "NH농협카드", color: "#00A651" },
  { id: "woori", label: "우리카드", color: "#0067AC" },
  { id: "bc", label: "BC카드", color: "#EA002C" },
];

const TEST_CARDS = [
  { label: "정상 승인", number: "4242424242424242", expiry: "12/28", cvc: "123" },
  { label: "카드 거절", number: "4000000000000002", expiry: "12/28", cvc: "123" },
];

function luhnCheck(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

function fmtCard(digits) { return digits.replace(/(\d{4})(?=\d)/g, "$1 "); }
function fmtExpiry(digits) { return digits.length <= 2 ? digits : digits.slice(0, 2) + "/" + digits.slice(2, 4); }
function fmtMMSS(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function qrCells(seed) {
  const cells = [];
  let x = seed;
  for (let i = 0; i < 100; i++) {
    x = (x * 9301 + 49297) % 233280;
    cells.push(x / 233280 > 0.55);
  }
  return cells;
}

const PROCESSING_STEPS = ["카드 정보 확인 중", "발급사 승인 요청 중", "결제 완료 처리 중"];

export default function EasyPayCheckoutSimulator() {
  const [screen, setScreen] = useState("method");
  const [method, setMethod] = useState(null);
  const [failReason, setFailReason] = useState("");
  const [countdown, setCountdown] = useState(180);
  const [procIndex, setProcIndex] = useState(0);

  const [cardNumber, setCardNumber] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [selectedIssuer, setSelectedIssuer] = useState(null);

  const timers = useRef([]);
  const clearAllTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => clearAllTimers(), []);

  useEffect(() => {
    if (screen !== "wait") return;
    if (countdown <= 0) {
      setFailReason("인증 시간이 초과되었습니다. 다시 시도해주세요.");
      setScreen("fail");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [screen, countdown]);

  function selectMethod(id) {
    setMethod(id);
    setFailReason("");
    if (id === "card") {
      setScreen("card_issuer");
      return;
    }
    if (id === "apple") {
      // Apple Pay: 인페이지 시트 방식, 도메인 리다이렉트 없이 즉시 시트 노출
      setScreen("apple_sheet");
      return;
    }
    // kakao / naver / samsung: PG 리다이렉트 후 승인 대기
    setScreen("redirect");
    timers.current.push(
      setTimeout(() => {
        setCountdown(180);
        setScreen("wait");
      }, 1000)
    );
  }

  function simulateApprove() {
    clearAllTimers();
    setScreen("success");
  }
  function simulateDecline() {
    clearAllTimers();
    setFailReason("사용자가 결제를 거절했습니다.");
    setScreen("fail");
  }

  function selectIssuer(id) {
    setSelectedIssuer(id);
    setScreen("card_form");
  }

  const rawNumber = cardNumber.replace(/\s/g, "");

  function validateCard() {
    const e = {};
    if (rawNumber.length < 13 || rawNumber.length > 16 || !luhnCheck(rawNumber)) e.cardNumber = "카드 번호가 올바르지 않습니다.";
    if (!name.trim()) e.name = "카드에 표시된 이름을 입력해주세요.";
    const [mm, yy] = expiry.split("/");
    if (!mm || !yy || mm.length !== 2 || yy.length !== 2) e.expiry = "MM/YY 형식으로 입력해주세요.";
    if (cvc.length !== 3) e.cvc = "CVC는 3자리입니다.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function fillTestCard(tc) {
    setCardNumber(fmtCard(tc.number));
    setName("HONG GILDONG");
    setExpiry(tc.expiry);
    setCvc(tc.cvc);
    setErrors({});
    setTouched({});
  }

  function submitCard(ev) {
    ev.preventDefault();
    setTouched({ cardNumber: true, name: true, expiry: true, cvc: true });
    if (!validateCard()) return;
    setScreen("card_processing");
    setProcIndex(0);
    timers.current.push(setTimeout(() => setProcIndex(1), 600));
    timers.current.push(setTimeout(() => setProcIndex(2), 1200));
    timers.current.push(
      setTimeout(() => {
        if (rawNumber === "4000000000000002") {
          setFailReason("카드가 거절되었습니다. 카드사에 문의해주세요.");
          setScreen("fail");
        } else {
          setScreen("success");
        }
      }, 1900)
    );
  }

  function resetAll() {
    clearAllTimers();
    setScreen("method");
    setMethod(null);
    setCardNumber(""); setName(""); setExpiry(""); setCvc("");
    setTouched({}); setErrors({});
    setSelectedIssuer(null);
  }

  const activeMethodMeta = METHODS.find((m) => m.id === method);
  const activeIssuerMeta = ISSUERS.find((i) => i.id === selectedIssuer);
  const cells = qrCells(42);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#EEF1F6", minHeight: "100%", padding: "32px 16px", display: "flex", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');
        .ep-input { width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 10px; border: 1.5px solid #DDE1EA; font-size: 15px; font-family: 'JetBrains Mono', monospace; outline: none; transition: border-color .15s, box-shadow .15s; background: #fff; color: #1A1D29; }
        .ep-input:focus { border-color: #4338CA; box-shadow: 0 0 0 3px rgba(67,56,202,0.12); }
        .ep-input.err { border-color: #F43F5E; }
        .ep-input.name { font-family: 'Inter', sans-serif; }
        .ep-label { font-size: 12.5px; font-weight: 600; color: #565B72; margin-bottom: 6px; display: block; }
        .ep-err { font-size: 12px; color: #E11D48; margin-top: 5px; }
        .ep-method { width: 100%; display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 12px; border: 1.5px solid #DDE1EA; background: #fff; cursor: pointer; text-align: left; transition: border-color .15s, transform .1s; }
        .ep-method:hover { border-color: #4338CA; }
        .ep-method:active { transform: scale(0.99); }
        .ep-btn { width: 100%; padding: 14px; border-radius: 10px; border: none; font-size: 15px; font-weight: 600; cursor: pointer; font-family: 'Space Grotesk', sans-serif; transition: opacity .15s, transform .1s; }
        .ep-btn:active { transform: scale(0.985); }
        .ep-chip:hover { background: #E9ECF4 !important; }
        .ep-issuer { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 16px 8px; border-radius: 12px; border: 1.5px solid #DDE1EA; background: #fff; cursor: pointer; transition: border-color .15s, transform .1s; }
        .ep-issuer:hover { border-color: #4338CA; }
        .ep-issuer:active { transform: scale(0.98); }
        @keyframes ep-spin { to { transform: rotate(360deg); } }
        @keyframes ep-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>

      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 1px 3px rgba(20,22,40,0.06), 0 12px 32px rgba(20,22,40,0.08)", padding: "30px 28px" }}>

          <div style={{ marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid #EEF0F5" }}>
            <p style={{ color: "#8A8FA8", fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", margin: "0 0 6px", textTransform: "uppercase" }}>결제 상품</p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16.5, fontWeight: 600, color: "#1A1D29", margin: "0 0 2px" }}>{PRODUCT.name}</p>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: "#1A1D29", margin: "6px 0 0" }}>
              {PRODUCT.price.toLocaleString()}<span style={{ fontSize: 13, fontWeight: 500, color: "#8A8FA8" }}>원</span>
            </p>
          </div>

          {screen === "method" && (
            <div>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, color: "#1A1D29", margin: "0 0 4px" }}>결제 수단 선택</h2>
              <p style={{ fontSize: 12.5, color: "#8A8FA8", margin: "0 0 18px" }}>시뮬레이션 화면이며 실제 결제는 발생하지 않습니다.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {METHODS.map((m) => (
                  <button key={m.id} className="ep-method" onClick={() => selectMethod(m.id)}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: m.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {m.id === "card" ? <CreditCard size={19} color={m.text} />
                        : m.id === "apple" ? <ScanFace size={19} color={m.text} />
                        : m.id === "samsung" ? <Fingerprint size={19} color={m.text} />
                        : <Smartphone size={19} color={m.text} />}
                    </div>
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 600, color: "#1A1D29", margin: 0 }}>{m.label}</p>
                      <p style={{ fontSize: 12, color: "#8A8FA8", margin: "2px 0 0" }}>{m.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8A8FA8", fontSize: 12, marginTop: 20 }}>
                <ShieldCheck size={14} />
                <span>결제 정보는 각 결제사 서버에서 안전하게 처리됩니다</span>
              </div>
            </div>
          )}

          {screen === "redirect" && (
            <div style={{ minHeight: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
              <Loader2 size={30} color="#4338CA" style={{ animation: "ep-spin .9s linear infinite" }} />
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1D29", margin: 0 }}>
                {activeMethodMeta?.label} 결제창으로 이동 중
              </p>
              <p style={{ fontSize: 12, color: "#8A8FA8", margin: 0, maxWidth: 260 }}>
                실제 서비스에서는 이 시점에 {activeMethodMeta?.label} 도메인으로 리다이렉트됩니다.
              </p>
            </div>
          )}

          {screen === "apple_sheet" && (
            <div style={{ minHeight: 340, display: "flex", flexDirection: "column" }}>
              <div style={{ background: "#000", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
                <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: "0 0 12px", fontFamily: "'Space Grotesk', sans-serif" }}>Apple Pay</p>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#D1D1D6", marginBottom: 4 }}>
                  <span>{PRODUCT.name}</span>
                  <span>{PRODUCT.price.toLocaleString()}원</span>
                </div>
                <div style={{ borderTop: "1px solid #333", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 13, color: "#fff", fontWeight: 600 }}>
                  <span>합계</span>
                  <span>{PRODUCT.price.toLocaleString()}원</span>
                </div>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "20px 0" }}>
                <ScanFace size={40} color="#1A1D29" style={{ animation: "ep-pulse 1.6s ease-in-out infinite" }} />
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, fontWeight: 600, color: "#1A1D29", margin: 0 }}>Face ID로 결제를 확인하세요</p>
                <p style={{ fontSize: 12, color: "#8A8FA8", margin: 0 }}>도메인 이동 없이 이 화면에서 바로 인증됩니다</p>

                <div style={{ width: "100%", marginTop: 10, paddingTop: 16, borderTop: "1px dashed #DDE1EA" }}>
                  <p style={{ fontSize: 11.5, color: "#8A8FA8", margin: "0 0 10px", textAlign: "center" }}>
                    실기기 Face ID 없이 테스트하려면 아래 버튼을 사용하세요
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="ep-btn" style={{ background: "#10B981", color: "#fff", padding: "10px" }} onClick={simulateApprove}>Face ID 인증 성공</button>
                    <button className="ep-btn" style={{ background: "#F7F8FB", color: "#42465A", border: "1px solid #DDE1EA", padding: "10px" }} onClick={simulateDecline}>인증 취소</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {screen === "wait" && (
            <div style={{ minHeight: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 2, width: 140, height: 140, background: "#fff", border: "1px solid #EEF0F5", borderRadius: 10, padding: 10 }}>
                {cells.map((on, i) => (
                  <div key={i} style={{ background: on ? "#1A1D29" : "transparent", borderRadius: 1 }} />
                ))}
              </div>
              <div>
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1D29", margin: "0 0 4px" }}>
                  {activeMethodMeta?.label} 앱에서 결제를 승인해주세요
                </p>
                <p style={{ fontSize: 12, color: "#8A8FA8", margin: 0 }}>모바일 알림 또는 QR 스캔으로 인증합니다</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: countdown < 30 ? "#E11D48" : "#565B72", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
                <Clock size={14} />
                <span>{fmtMMSS(countdown)} 이내 인증 필요</span>
              </div>

              <div style={{ width: "100%", marginTop: 6, paddingTop: 16, borderTop: "1px dashed #DDE1EA" }}>
                <p style={{ fontSize: 11.5, color: "#8A8FA8", margin: "0 0 10px" }}>
                  실제 앱 없이 결과를 테스트해보려면 아래 버튼으로 웹훅 콜백을 시뮬레이션하세요
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="ep-btn" style={{ background: "#10B981", color: "#fff", padding: "10px" }} onClick={simulateApprove}>승인 시뮬레이션</button>
                  <button className="ep-btn" style={{ background: "#F7F8FB", color: "#42465A", border: "1px solid #DDE1EA", padding: "10px" }} onClick={simulateDecline}>거절 시뮬레이션</button>
                </div>
              </div>
            </div>
          )}

          {screen === "card_issuer" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <button type="button" onClick={resetAll} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
                  <ChevronLeft size={18} color="#8A8FA8" />
                </button>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, margin: 0, color: "#1A1D29" }}>카드사 선택</h2>
              </div>
              <p style={{ fontSize: 12.5, color: "#8A8FA8", margin: "4px 0 18px 30px" }}>결제하실 카드의 발급사를 선택해주세요</p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {ISSUERS.map((iss) => (
                  <button key={iss.id} className="ep-issuer" onClick={() => selectIssuer(iss.id)}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: iss.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#1A1D29" }}>{iss.label}</span>
                  </button>
                ))}
              </div>

              <p style={{ fontSize: 11.5, color: "#8A8FA8", margin: "18px 0 0", textAlign: "center" }}>
                카드사를 모르시면 다음 화면에서 카드번호만 입력하셔도 됩니다
              </p>
              <button type="button" className="ep-btn" style={{ background: "#F7F8FB", color: "#42465A", border: "1px solid #DDE1EA", marginTop: 10 }} onClick={() => selectIssuer(null)}>
                카드사 선택 건너뛰기
              </button>
            </div>
          )}

          {screen === "card_form" && (
            <form onSubmit={submitCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <button type="button" onClick={() => setScreen("card_issuer")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
                  <ChevronLeft size={18} color="#8A8FA8" />
                </button>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, margin: 0, color: "#1A1D29" }}>카드 정보 입력</h2>
              </div>
              {activeIssuerMeta && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, marginLeft: 30 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: activeIssuerMeta.color }} />
                  <span style={{ fontSize: 12.5, color: "#565B72", fontWeight: 600 }}>{activeIssuerMeta.label}</span>
                  <button type="button" onClick={() => setScreen("card_issuer")} style={{ background: "none", border: "none", color: "#4338CA", fontSize: 12, cursor: "pointer", padding: 0 }}>변경</button>
                </div>
              )}
              {!activeIssuerMeta && <div style={{ marginBottom: 16 }} />}

              <div style={{ marginBottom: 14 }}>
                <label className="ep-label">카드 번호</label>
                <input className={"ep-input" + (touched.cardNumber && errors.cardNumber ? " err" : "")} inputMode="numeric" placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(fmtCard(e.target.value.replace(/\D/g, "").slice(0, 16)))}
                  onBlur={() => setTouched((t) => ({ ...t, cardNumber: true }))} />
                {touched.cardNumber && errors.cardNumber && <p className="ep-err">{errors.cardNumber}</p>}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="ep-label">카드 소유자 이름</label>
                <input className={"ep-input name" + (touched.name && errors.name ? " err" : "")} placeholder="HONG GILDONG"
                  value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))} />
                {touched.name && errors.name && <p className="ep-err">{errors.name}</p>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div>
                  <label className="ep-label">유효기간</label>
                  <input className={"ep-input" + (touched.expiry && errors.expiry ? " err" : "")} inputMode="numeric" placeholder="MM/YY"
                    value={expiry} onChange={(e) => setExpiry(fmtExpiry(e.target.value.replace(/\D/g, "").slice(0, 4)))}
                    onBlur={() => setTouched((t) => ({ ...t, expiry: true }))} />
                  {touched.expiry && errors.expiry && <p className="ep-err">{errors.expiry}</p>}
                </div>
                <div>
                  <label className="ep-label">CVC</label>
                  <input className={"ep-input" + (touched.cvc && errors.cvc ? " err" : "")} inputMode="numeric" placeholder="123"
                    value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    onBlur={() => setTouched((t) => ({ ...t, cvc: true }))} />
                  {touched.cvc && errors.cvc && <p className="ep-err">{errors.cvc}</p>}
                </div>
              </div>

              <button type="submit" className="ep-btn" style={{ background: "#1A1D29", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Lock size={15} />
                {PRODUCT.price.toLocaleString()}원 결제하기
              </button>

              <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #EEF0F5" }}>
                <p style={{ fontSize: 11.5, color: "#8A8FA8", margin: "0 0 8px", fontWeight: 600 }}>테스트 카드</p>
                <div style={{ display: "flex", gap: 8 }}>
                  {TEST_CARDS.map((tc) => (
                    <button type="button" key={tc.label} className="ep-chip" onClick={() => fillTestCard(tc)}
                      style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 8, border: "1px solid #DDE1EA", background: "#F7F8FB", color: "#42465A", cursor: "pointer" }}>
                      {tc.label}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {screen === "card_processing" && (
            <div style={{ minHeight: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <Loader2 size={32} color="#4338CA" style={{ animation: "ep-spin .9s linear infinite" }} />
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1D29", margin: 0 }}>{PROCESSING_STEPS[procIndex]}...</p>
              <div style={{ display: "flex", gap: 6 }}>
                {PROCESSING_STEPS.map((_, i) => (
                  <div key={i} style={{ width: 24, height: 4, borderRadius: 2, background: i <= procIndex ? "#4338CA" : "#E5E7F0", transition: "background .3s" }} />
                ))}
              </div>
            </div>
          )}

          {screen === "success" && (
            <div style={{ minHeight: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
              <CheckCircle2 size={48} color="#10B981" />
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: "#1A1D29", margin: 0 }}>결제가 완료되었습니다</p>
              <p style={{ fontSize: 13, color: "#8A8FA8", margin: 0 }}>
                {method === "card" && activeIssuerMeta ? `${activeIssuerMeta.label} · ` : ""}{activeMethodMeta?.label} · {PRODUCT.price.toLocaleString()}원
              </p>
              <div style={{ background: "#F7F8FB", borderRadius: 10, padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#565B72", marginTop: 4 }}>
                tid_{String(Date.now()).slice(-10)}
              </div>
              <button className="ep-btn" style={{ background: "#F7F8FB", color: "#42465A", marginTop: 12, width: 180 }} onClick={resetAll}>처음으로</button>
            </div>
          )}

          {screen === "fail" && (
            <div style={{ minHeight: 340, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
              <XCircle size={48} color="#F43F5E" />
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: "#1A1D29", margin: 0 }}>결제에 실패했습니다</p>
              <p style={{ fontSize: 13, color: "#8A8FA8", margin: 0, maxWidth: 260 }}>{failReason}</p>
              <button className="ep-btn" style={{ background: "#1A1D29", color: "#fff", marginTop: 12, width: 180 }} onClick={resetAll}>처음으로</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
