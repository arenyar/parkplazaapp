import { Menu, User } from "lucide-react";
import { T } from "../theme.js";
import { NAV_ITEMS } from "./navItems.js";
import { AvatarInitials } from "../components/ui.jsx";

export function Sidebar({ view, setView, branding, currentUser, role, allowedKeys, mobileNavOpen, setMobileNavOpen }) {
  const items = allowedKeys ? NAV_ITEMS.filter((it) => allowedKeys.includes(it.key)) : NAV_ITEMS;
  const nav = (
    <nav className="sidebar-nav" style={{ gap: 3 }}>
      {items.map(({ key, label, icon: Icon }) => (
        <button key={key} onClick={() => { setView(key); setMobileNavOpen(false); }} className={`nav-item${view === key ? " active" : ""}`}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: 500, background: "transparent", color: view === key ? "#fff" : T.dim, borderLeft: "3px solid transparent", whiteSpace: "nowrap" }}>
          <Icon size={15} strokeWidth={1.8} />
          <span style={{ flex: 1 }}>{label}</span>
        </button>
      ))}
    </nav>
  );
  return (
    <>
      <aside className="sidebar" style={{ width: 224, background: T.surface2, color: "#fff", padding: "18px 12px", flexShrink: 0, borderRight: `1px solid ${T.line}`, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 16px", width: "100%" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#0B1420", flexShrink: 0 }}>PP</div>
          <div className="sidebar-brand-text" style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.4 }}>{branding.orgName}</div>
            <div style={{ fontSize: 10.5, color: T.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{branding.siteName}</div>
          </div>
          <button className="hamburger" onClick={() => setMobileNavOpen((s) => !s)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
            <Menu size={20} />
          </button>
        </div>
        <div className="sidebar-nav-desktop">{nav}</div>
        <div style={{ flex: 1 }} />
        <div className="sidebar-footer" style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 8px 4px", borderTop: `1px solid ${T.line}` }}>
          <AvatarInitials name={currentUser} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser || "Kullanıcı seçilmedi"}</div>
            <div style={{ fontSize: 10.5, color: T.dim }}>{role || "Rol belirsiz"}</div>
          </div>
        </div>
      </aside>
      {mobileNavOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 55 }} onClick={() => setMobileNavOpen(false)}>
          <div style={{ background: T.surface2, height: "100%", width: 240, padding: "20px 14px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ color: "#fff", fontWeight: 700, marginBottom: 14 }}>{branding.orgName}</div>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
