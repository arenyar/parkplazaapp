import { Menu, Bell, Search } from "lucide-react";
import { mobileTokens as t, MIN_TOUCH_TARGET as TAP } from "../tokens.js";

const iconBtn = { all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: TAP, height: TAP, flexShrink: 0, color: t.ink };

// Sözleşme (bkz. .claude/Skills/mobile-ops-ui/SKILL.md):
// { baslik, kapsam, bildirimSayisi, onMenu, onSearch } — sticky. Bildirim
// rozeti yalnız bana atanan açık kayıt sayısı; acil varsa kiremit.
export function TopBar({ baslik, kapsam, bildirimSayisi = 0, bildirimKiremit = false, onMenu, onSearch }) {
  return (
    <header
      style={{
        position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4,
        padding: "6px 4px", background: t.surface, borderBottom: `1px solid ${t.hairline}`,
      }}
    >
      <button style={iconBtn} onClick={onMenu} aria-label="Menüyü aç">
        <Menu size={22} strokeWidth={2} aria-hidden="true" />
      </button>
      <div style={{ minWidth: 0, flex: 1, padding: "0 2px" }}>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.25, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {baslik}
        </h1>
        {kapsam && (
          <p style={{ margin: 0, fontSize: 12, color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kapsam}</p>
        )}
      </div>
      <button style={{ ...iconBtn, position: "relative" }} onClick={onSearch} aria-label="Ara">
        <Search size={20} strokeWidth={2} aria-hidden="true" />
      </button>
      <div style={{ ...iconBtn, position: "relative" }} aria-label={`Bildirimler — bana atanan ${bildirimSayisi} açık kayıt`}>
        <Bell size={20} strokeWidth={2} aria-hidden="true" />
        {bildirimSayisi > 0 && (
          <span
            style={{
              position: "absolute", top: 4, right: 4, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 8,
              background: bildirimKiremit ? t.kiremit : t.pine, color: "#fff", fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
            }}
          >
            {bildirimSayisi > 99 ? "99+" : bildirimSayisi}
          </span>
        )}
      </div>
    </header>
  );
}
