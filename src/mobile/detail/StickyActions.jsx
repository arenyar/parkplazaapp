import { MoreHorizontal } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";

// Sözleşme (bkz. mobile-ops-ui SKILL.md StickyActions): alt yapışkan bar —
// solda modül adı, sağda "…", altta en fazla iki birincil aksiyon.
export function StickyActions({ moduleLabel, actions, onMore }) {
  return (
    <div style={{
      position: "sticky", bottom: 0, background: t.surface, borderTop: `1px solid ${t.hairline}`,
      padding: "8px 16px calc(8px + env(safe-area-inset-bottom))", boxShadow: "0 -4px 14px rgba(20,49,40,0.10)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: t.muted }}>{moduleLabel}</span>
        <button onClick={onMore} aria-label="Hızlı aksiyonlar" style={{ all: "unset", cursor: "pointer", color: t.ink, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
          <MoreHorizontal size={20} aria-hidden="true" />
        </button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 44, textAlign: "center", borderRadius: 4,
              fontSize: 13.5, fontWeight: 700,
              background: a.variant === "primary" ? t.pine : t.surface,
              color: a.variant === "primary" ? "#fff" : t.pine,
              border: a.variant === "primary" ? "none" : `1px solid ${t.pine}`,
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
