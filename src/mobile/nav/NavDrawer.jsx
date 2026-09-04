import { Monitor, ChevronRight } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { KISISEL_ITEMS, ARACLAR_ITEMS, DAHAFAZLA_ITEMS, isItemVisible } from "./navConfig.js";
import StoredImage from "../../components/StoredImage.jsx";

function Rozet({ count, urgent }) {
  if (!count) return null;
  return (
    <span
      style={{
        minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, fontSize: 11, fontWeight: 700, lineHeight: "18px",
        textAlign: "center", color: "#fff", background: urgent ? t.kiremit : t.pine, flexShrink: 0,
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function Section({ baslik, items, permissions, ctx, activeKey, onSelect }) {
  const visible = items.filter((it) => isItemVisible(it, permissions));
  if (visible.length === 0) return null;
  return (
    <div style={{ padding: "8px 0", borderBottom: `1px solid ${t.hairline}` }}>
      {baslik && (
        <p style={{ margin: 0, padding: "6px 16px 4px", fontSize: 12, fontWeight: 600, color: t.muted }}>{baslik}</p>
      )}
      {visible.map((item) => {
        const isActive = item.key === activeKey;
        const badge = item.badge ? item.badge(ctx) : null;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            onClick={() => onSelect(item)}
            style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              width: "100%", minHeight: 46, padding: "6px 16px 6px 13px", fontSize: 14,
              background: isActive ? t.pineSoft : "transparent", color: isActive ? t.pine : t.ink, fontWeight: isActive ? 600 : 400,
              borderLeft: `3px solid ${isActive ? t.pine : "transparent"}`,
            }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: isActive ? t.surface : t.ivory, color: isActive ? t.pine : t.muted,
            }}>
              <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
            <Rozet count={badge?.count} urgent={badge?.urgent} />
          </button>
        );
      })}
    </div>
  );
}

// Sözleşme (bkz. mobile-ops-ui SKILL.md + mobil-ui-prompt 6.1.1): üç bölüm,
// sırası sabit — Kişisel → Araçlar → Daha fazla. Menü `currentAccount.permissions`
// ile filtrelenir (users/{uid}.roles bu depoda yok — bkz. onaylanan envanter);
// yetkisiz modül gizlenir, route seviyesinde ayrıca MobileApp.jsx'te de korunur.
export function NavDrawer({ open, onClose, userName, deptLabel, siteName, photoUrl, permissions, tasks, currentUserName, draftCount, activeKey, onSelect, onLogout, onDesktopSwitch, onOpenProfile }) {
  if (!open) return null;
  const ctx = { tasks, userName: currentUserName, draftCount };

  function handleSelect(item) {
    if (item.kind === "logout") { onLogout(); return; }
    onSelect(item);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }} role="dialog" aria-modal="true" aria-label="Ana menü">
      <div style={{ position: "absolute", inset: 0, background: "rgba(20,49,40,0.45)" }} onClick={onClose} />
      <div
        style={{
          position: "relative", width: "75%", maxWidth: 320, height: "100%", overflowY: "auto",
          background: t.surface, display: "flex", flexDirection: "column",
        }}
      >
        {/* Faz 15 — kullanıcı bloğuna dokununca Profil ekranı açılır (spec).
            Fotoğraf varsa (bkz. ProfileScreen) gerçek StoredImage, yoksa
            baş harfler. */}
        <button
          onClick={() => { onClose(); onOpenProfile(); }}
          style={{
            all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
            width: "100%", padding: "16px", borderBottom: `1px solid ${t.hairline}`,
          }}
        >
          {photoUrl ? (
            <StoredImage src={photoUrl} alt={userName} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: t.pine, color: "#fff", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {(userName || "?").split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</p>
            <p style={{ margin: 0, fontSize: 12, color: t.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{siteName}{deptLabel ? ` · ${deptLabel}` : ""}</p>
          </div>
          <ChevronRight size={16} style={{ color: t.muted, flexShrink: 0 }} aria-hidden="true" />
        </button>

        <Section baslik={null} items={KISISEL_ITEMS} permissions={permissions} ctx={ctx} activeKey={activeKey} onSelect={handleSelect} />
        <Section baslik="Araçlar" items={ARACLAR_ITEMS} permissions={permissions} ctx={ctx} activeKey={activeKey} onSelect={handleSelect} />
        <Section baslik="Daha fazla" items={DAHAFAZLA_ITEMS} permissions={permissions} ctx={ctx} activeKey={activeKey} onSelect={handleSelect} />

        <button
          onClick={onDesktopSwitch}
          style={{
            all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
            width: "100%", minHeight: 44, padding: "12px 16px", fontSize: 13, color: t.muted,
          }}
        >
          <Monitor size={18} strokeWidth={1.9} aria-hidden="true" /> Masaüstü sürümüne geç
        </button>
      </div>
    </div>
  );
}
