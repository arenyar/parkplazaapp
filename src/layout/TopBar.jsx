import { useEffect, useState } from "react";
import { Menu, Search, Bell, User } from "lucide-react";
import { T } from "../theme.js";
import { AvatarInitials } from "../components/ui.jsx";
import { searchAcrossData } from "../lib/search.js";

const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAYS_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function ResultRow({ title, sub, onClick }) {
  return (
    <button onClick={onClick} onMouseDown={(e) => e.preventDefault()} className="search-row"
      style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", padding: "8px 12px", borderRadius: 8, boxSizing: "border-box" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#fff" }}>{title}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
    </button>
  );
}

export function TopBar({ branding, search, setSearch, data, onResultClick, unreadCount, onOpenNotifications, currentUser, role, onLogout, onToggleNav, onOpenCommand }) {
  const [now, setNow] = useState(new Date());
  const [focused, setFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const dateLabel = `${now.getDate()} ${MONTHS_TR[now.getMonth()]} ${now.getFullYear()} ${DAYS_TR[now.getDay()]} · ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const results = focused ? searchAcrossData(search, data) : [];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
      <button className="hamburger" onClick={onToggleNav} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}><Menu size={20} /></button>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: 0.3 }}>OPERATIONS CENTER</div>
        <div style={{ fontSize: 12, color: T.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{branding.siteName} — {branding.tagline}</div>
      </div>
      <div style={{ position: "relative", flex: 1, minWidth: 160, maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 12px" }}>
          <Search size={15} color={T.dim} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 120)}
            placeholder="Ara: varlık, görev, olay, risk, doküman…" style={{ flex: 1, minWidth: 0, background: "none", border: "none", outline: "none", color: "#fff", fontSize: 13 }} />
        </div>
        {focused && search.trim() && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, boxShadow: "0 12px 32px rgba(0,0,0,0.4)", zIndex: 60, maxHeight: 360, overflowY: "auto" }}>
            {results.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12.5, color: T.dim }}>Sonuç bulunamadı.</div>}
            {results.map((g) => (
              <div key={g.label} style={{ marginBottom: 4 }}>
                <div style={{ padding: "6px 12px 2px", fontSize: 10.5, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 0.4 }}>{g.label}</div>
                {g.items.map((it) => <ResultRow key={it.id} title={it.title} sub={it.sub} onClick={() => onResultClick(g.type, it.ref)} />)}
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={onOpenCommand} title="Hızlı işlem paneli (Ctrl+K)" style={{ display: "flex", alignItems: "center", gap: 6, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: "7px 10px", color: T.dim, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
        <span style={{ fontFamily: "ui-monospace, monospace" }}>⌘K</span>
      </button>
      <div style={{ fontSize: 12, color: T.dim, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{dateLabel}</div>
      <button onClick={onOpenNotifications} title={unreadCount ? `${unreadCount} okunmamış bildirim` : "Bildirim yok"} style={{ position: "relative", width: 36, height: 36, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <Bell size={16} color={T.dim} />
        {unreadCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#E2685A", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{unreadCount}</span>}
      </button>
      <div style={{ position: "relative" }}>
        <button onClick={() => setUserMenuOpen((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#fff" }}>{currentUser || "Kullanıcı seç"}</div>
            <div style={{ fontSize: 10.5, color: T.dim }}>{role || "—"}</div>
          </div>
          <AvatarInitials name={currentUser} size={32} />
        </button>
        {userMenuOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 60 }} onClick={() => setUserMenuOpen(false)} />
            <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: 6, minWidth: 160, zIndex: 61, boxShadow: "0 12px 32px rgba(0,0,0,0.4)" }}>
              <button onClick={() => { setUserMenuOpen(false); onLogout(); }} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, color: "#E2685A" }}>
                Çıkış Yap
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
