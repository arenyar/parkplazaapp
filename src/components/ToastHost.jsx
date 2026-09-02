import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { T, STATUS } from "../theme.js";
import { subscribeToast } from "../lib/toast.js";
import { useIsMobile } from "../lib/useIsMobile.js";

const VARIANTS = {
  success: { icon: CheckCircle2, color: STATUS.normal.color, bg: STATUS.normal.bg },
  error: { icon: AlertTriangle, color: STATUS.critical.color, bg: STATUS.critical.bg },
  info: { icon: Info, color: T.accent, bg: `${T.accent}22` },
};

// App.jsx'te tek sefer monte edilir — kullanıcı teyidiyle: "window.alert
// kullanma... Başarı için toast" (bkz. .claude/Skills/parkplaza-operations).
// Herhangi bir sayfadan `showToast(mesaj, "success"|"error"|"info")` ile
// tetiklenir, birkaç saniye sonra kendiliğinden kapanır.
export function ToastHost() {
  const [items, setItems] = useState([]);
  const isMobile = useIsMobile();

  useEffect(() => subscribeToast((message, variant) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, message, variant: VARIANTS[variant] ? variant : "info" }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4500);
  }), []);

  if (items.length === 0) return null;
  // Mobilde alt sabit gezinme çubuğu (bkz. MobileBottomNav/GlobalStyle
  // .bottom-nav) var — üstüne binmesin diye kaldırılıyor ve kenardan kenara
  // tam genişlik kullanılıyor (tek elle daha kolay okunur/kapatılır).
  const mobileStyle = { left: 12, right: 12, bottom: 78 };
  const desktopStyle = { right: 18, bottom: 18, maxWidth: 340 };
  return (
    <div style={{ position: "fixed", zIndex: 400, display: "flex", flexDirection: "column", gap: 8, ...(isMobile ? mobileStyle : desktopStyle) }}>
      {items.map((t) => {
        const v = VARIANTS[t.variant];
        const Icon = v.icon;
        return (
          <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: T.surface2, border: `1px solid ${T.line}`, borderLeft: `3px solid ${v.color}`, borderRadius: 10, padding: "10px 12px", boxShadow: "0 6px 20px rgba(0,0,0,0.35)" }}>
            <Icon size={15} color={v.color} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: T.ink, flex: 1, lineHeight: 1.4 }}>{t.message}</span>
            <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex", flexShrink: 0 }}><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}
