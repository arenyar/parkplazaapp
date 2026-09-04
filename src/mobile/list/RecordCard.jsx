import { mobileTokens as t } from "../tokens.js";
import { PRIORITY_COLOR, STATUS_COLOR, initials, actionLabel, placeOf } from "../taskDisplay.js";

// Sözleşme (bkz. mobile-ops-ui SKILL.md): anatomi sırası sabit —
// 1) avatar 2) başlık 3) öncelik satırı 4) mahal yolu 5) durum 6) ekip + aksiyon.
// Dokunma → DetailScreen (bkz. TaskListScreen.jsx) — Faz 4.
export function RecordCard({ task, onOpen }) {
  const priorityColor = PRIORITY_COLOR[task.priority] || t.muted;
  const statusColor = STATUS_COLOR[task.status] || t.muted;
  const action = actionLabel(task);
  const place = placeOf(task);

  return (
    <button
      onClick={() => onOpen(task)}
      style={{
        all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", gap: 10, width: "100%",
        padding: "12px 16px", borderBottom: `1px solid ${t.hairline}`, background: t.surface,
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: "50%", background: t.pineSoft, color: t.pine, fontSize: 12, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
      }}>
        {initials(task.assignee)}
      </div>
      <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <p style={{
          margin: 0, fontSize: 14.5, fontWeight: 600, color: t.ink, lineHeight: 1.35,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {task.description || task.issueType || "Kayıt"}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, display: "flex", alignItems: "center", gap: 5, color: priorityColor, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: priorityColor, flexShrink: 0 }} />
          {task.priority}
        </p>
        {place && (
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: t.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {place}
          </p>
        )}
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: t.ink, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
          {task.status}
        </p>
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: t.pine, background: t.pineSoft, borderRadius: 4, padding: "2px 7px" }}>
            {task.department}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: action === "Atanmadı" ? t.kiremit : t.pine, border: `1px solid ${t.hairline}`, borderRadius: 4, padding: "3px 9px" }}>
            {action}
          </span>
        </div>
      </div>
    </button>
  );
}
