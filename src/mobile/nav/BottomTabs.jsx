import { Home, LayoutGrid, QrCode } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";

const LEFT_TABS = [
  { key: "dashboard", label: "Anasayfa", icon: Home },
];
const RIGHT_TABS = [
  { key: "akis", label: "Akış", icon: LayoutGrid },
];

// Kullanıcı teyidiyle: "al barda sohbeti kaldır qr ortaya al akışı sağa al"
// — Sohbet (Faz 14 hiç yapılmadı, boş bir yer tutucuydu) tamamen kaldırıldı;
// düzen artık Anasayfa (sol) · QR (orta, yükseltilmiş) · Akış (sağ). QR bir
// "sekme" değil, tek dokunuşla QrScannerModal'ı açan bir aksiyon — bu yüzden
// `active` karşılaştırmasına girmiyor. Drawer açıkken de görünür kalması
// için AppShell'de drawer overlay'inden daha yüksek z-index'te render edilir.
export function BottomTabs({ active, onChange, onScan }) {
  return (
    <nav
      style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 0, width: "100%", maxWidth: 480,
        display: "flex", alignItems: "center", background: t.surface, borderTop: `1px solid ${t.hairline}`,
        paddingBottom: "env(safe-area-inset-bottom)", zIndex: 40,
      }}
    >
      {LEFT_TABS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-current={isActive ? "page" : undefined}
            style={{
              all: "unset", cursor: "pointer", flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, padding: "8px 0 6px", color: isActive ? t.pine : t.muted, minHeight: 44,
            }}
          >
            <Icon size={21} strokeWidth={isActive ? 2.3 : 1.8} aria-hidden="true" />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
          </button>
        );
      })}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0 6px" }}>
        <button
          onClick={onScan}
          aria-label="QR oku"
          style={{
            all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            width: 46, height: 46, borderRadius: "50%", background: t.pine, color: "#fff",
            marginTop: -22, boxShadow: "0 4px 12px rgba(20,49,40,0.35)", border: `3px solid ${t.surface}`,
          }}
        >
          <QrCode size={22} aria-hidden="true" />
        </button>
        <span style={{ fontSize: 11, fontWeight: 600, color: t.muted, marginTop: 3 }}>QR oku</span>
      </div>

      {RIGHT_TABS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-current={isActive ? "page" : undefined}
            style={{
              all: "unset", cursor: "pointer", flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, padding: "8px 0 6px", color: isActive ? t.pine : t.muted, minHeight: 44,
            }}
          >
            <Icon size={21} strokeWidth={isActive ? 2.3 : 1.8} aria-hidden="true" />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
