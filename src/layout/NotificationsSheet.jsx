import { T, STATUS } from "../theme.js";
import { fmtDateTime } from "../lib/format.js";

const LEVEL_COLOR = { critical: STATUS.critical.color, warning: STATUS.warning.color, info: STATUS.info.color };

export function NotificationsSheet({ notifications, onClose, onMarkAllRead }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 150, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface2, borderLeft: `1px solid ${T.line}`, width: 360, maxWidth: "100%", height: "100%", overflowY: "auto", padding: "18px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>Bildirimler</h3>
          <button onClick={onMarkAllRead} style={{ background: "none", border: "none", color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Tümünü okundu işaretle</button>
        </div>
        {notifications.length === 0 && <p style={{ color: T.dim, fontSize: 13 }}>Bildirim yok.</p>}
        {notifications.map((n) => (
          <div key={n.id} style={{ padding: "12px 0", borderBottom: `1px solid ${T.line}`, opacity: n.read ? 0.55 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: LEVEL_COLOR[n.level] || T.dim, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{n.title}</span>
            </div>
            <div style={{ fontSize: 12, color: T.dim }}>{n.body}</div>
            <div style={{ fontSize: 10.5, color: T.dimmer, marginTop: 4 }}>{fmtDateTime(n.at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
