import { useState } from "react";
import { PRIORITY_STYLES } from "../theme.js";
import { useTheme } from "../lib/ThemeContext.jsx";
import { MobileTaskCard } from "./MobileTaskCard.jsx";

// Kullanıcı teyidiyle: "Görevlere Tıkladığında sadece ilgili görevin kartı
// gelmeli" — masaüstündeki TaskList'in (kalem/çöp kutusu simgeli, ayrı bir
// TaskForm açan) mobil karşılığı: kart nereye dokunursa dokunsun açılır,
// silme YOK (mobil = sadece veri girişi).
export function MobileTaskList({ tasks, onSaveTask, emptyText = "Kayıt yok." }) {
  const T = useTheme();
  const [editing, setEditing] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tasks.length === 0 && <p style={{ color: T.dim, fontSize: 13 }}>{emptyText}</p>}
      {tasks.map((t) => {
        const ps = PRIORITY_STYLES[t.priority] || {};
        return (
          <button key={t.id} onClick={() => setEditing(t)}
            style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%",
              border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", background: T.surface2 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>#{t.ticketNo} · {t.description}</div>
              <div style={{ fontSize: 11, color: T.dim, marginTop: 1 }}>{t.status}{t.dueDate ? ` · Termin: ${t.dueDate}` : ""}</div>
            </span>
            <span style={{ background: ps.bg, color: ps.fg, fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: "2px 8px", textTransform: "uppercase", flexShrink: 0 }}>{t.priority}</span>
          </button>
        );
      })}
      {editing && (
        <MobileTaskCard task={editing} onClose={() => setEditing(null)}
          onSave={(updated) => { onSaveTask(updated); setEditing(null); }} />
      )}
    </div>
  );
}
