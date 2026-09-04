import { ThumbsUp, MessageCircle, EyeOff } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { initials } from "../taskDisplay.js";
import { STATUS_COLORS } from "./suggestionModel.js";

// RecordCard'ın anatomisiyle aynı ruhta (avatar → başlık → durum → alt
// satır) ama öneri gerçek şeması farklı (öncelik yok, departman yerine
// kategori, atanan yerine gönderen) — bu yüzden RecordCard'ı ZORLA
// kullanmak yerine aynı görsel dile sahip kendi kart tipi (ListScreen'in
// `renderCard` prop'uyla takılır, bkz. SuggestionsScreen.jsx).
export function SuggestionCard({ suggestion: s, onOpen }) {
  const statusStyle = STATUS_COLORS[s.status] || STATUS_COLORS["Yeni"];
  return (
    <button
      onClick={() => onOpen(s)}
      style={{
        all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", gap: 10, width: "100%",
        padding: "12px 16px", borderBottom: `1px solid ${t.hairline}`, background: t.surface,
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: "50%", background: t.pineSoft, color: t.pine, fontSize: 12, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
      }}>
        {s.anonymous ? <EyeOff size={15} aria-hidden="true" /> : initials(s.authorName)}
      </div>
      <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <p style={{
          margin: 0, fontSize: 14.5, fontWeight: 600, color: t.ink, lineHeight: 1.35,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {s.title}
        </p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: t.ink, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusStyle.color, flexShrink: 0 }} />
          {s.status}
        </p>
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: t.pine, background: t.pineSoft, borderRadius: 4, padding: "2px 7px" }}>
            {s.category}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: t.muted }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><ThumbsUp size={13} aria-hidden="true" /> {(s.supporters || []).length}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MessageCircle size={13} aria-hidden="true" /> {(s.comments || []).length}</span>
          </span>
        </div>
      </div>
    </button>
  );
}
