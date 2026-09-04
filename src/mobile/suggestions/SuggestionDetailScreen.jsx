import { useState } from "react";
import { ArrowLeft, ThumbsUp, EyeOff } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { initials } from "../taskDisplay.js";
import { STATUS_ORDER, STATUS_COLORS, hasSupported } from "./suggestionModel.js";

function fmt(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return null; }
}
function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${t.hairline}` }}>
      <p style={{ margin: 0, fontSize: 11.5, color: t.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 14, color: t.ink }}>{value}</p>
    </div>
  );
}

// Spec (Faz 9): destekle (bir kez) + yorum; Yönetim durumu değiştirir,
// GEREKÇE ZORUNLU ("gerekçesiz reddedilen öneri sistemi öldürür" — bu
// yüzden her durum değişikliğinde, sadece "Uygulanmayacak"ta değil, zorunlu
// tutuldu). Kabul edilen öneri "Göreve dönüştür" ile bağlı kalır.
export function SuggestionDetailScreen({ suggestion: s, currentUser, viewerRole, onBack, onSave, onConvertToTask }) {
  const [commentDraft, setCommentDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState(s.status);
  const [reasonDraft, setReasonDraft] = useState("");
  const [statusFormOpen, setStatusFormOpen] = useState(false);

  const isManagement = viewerRole === "Yönetim";
  const supported = hasSupported(s, currentUser.name);
  const statusStyle = STATUS_COLORS[s.status] || STATUS_COLORS["Yeni"];

  function toggleSupport() {
    if (supported) return; // spec: bir kullanıcı bir kez — geri alınmıyor
    onSave({ ...s, supporters: [...(s.supporters || []), currentUser.name] });
  }
  function addComment() {
    if (!commentDraft.trim()) return;
    onSave({ ...s, comments: [...(s.comments || []), { author: currentUser.name, text: commentDraft.trim(), at: new Date().toISOString() }] });
    setCommentDraft("");
  }
  function saveStatus() {
    if (!reasonDraft.trim()) return; // gerekçe zorunlu
    onSave({ ...s, status: statusDraft, statusReason: reasonDraft.trim(), statusChangedBy: currentUser.name, statusChangedAt: new Date().toISOString() });
    setStatusFormOpen(false);
    setReasonDraft("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: t.ivory }}>
      <div style={{ background: t.surface, borderBottom: `1px solid ${t.hairline}`, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <button onClick={onBack} aria-label="Geri" style={{ all: "unset", cursor: "pointer", color: t.ink, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, color: t.muted, display: "flex", alignItems: "center", gap: 5 }}>
              {s.anonymous ? <><EyeOff size={12} aria-hidden="true" /> {s.authorDepartment}</> : `${s.authorName} · ${s.authorDepartment}`} · {fmt(s.createdAt)}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 15.5, fontWeight: 600, color: t.ink, lineHeight: 1.35 }}>{s.title}</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, display: "flex", alignItems: "center", gap: 6, color: t.ink }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusStyle.color, flexShrink: 0 }} /> {s.status}
            </p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: "4px 16px 16px" }}>
        <Row label="Kategori" value={s.category} />
        <Row label="Açıklama" value={s.description} />
        {s.statusReason && <Row label={`Durum gerekçesi (${s.statusChangedBy || "—"})`} value={s.statusReason} />}
        {s.convertedTaskId && <Row label="Bağlı görev" value={`#${s.convertedTaskId}`} />}

        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <button
            onClick={toggleSupport} disabled={supported}
            style={{
              all: "unset", boxSizing: "border-box", cursor: supported ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              minHeight: 40, padding: "0 16px", borderRadius: 4, border: `1px solid ${supported ? t.ok : t.pine}`, color: supported ? t.ok : t.pine, fontSize: 13, fontWeight: 700,
            }}
          >
            <ThumbsUp size={15} aria-hidden="true" /> {supported ? "Destekledin" : "Destekle"} · {(s.supporters || []).length}
          </button>
          {isManagement && s.status === "Kabul edildi" && !s.convertedTaskId && (
            <button onClick={() => onConvertToTask(s)} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", minHeight: 40, padding: "0 16px", borderRadius: 4, background: t.pine, color: "#fff", fontSize: 13, fontWeight: 700 }}>
              Göreve dönüştür
            </button>
          )}
        </div>

        {isManagement && (
          <div style={{ marginTop: 18 }}>
            {!statusFormOpen ? (
              <button onClick={() => { setStatusFormOpen(true); setStatusDraft(s.status); }} style={{ all: "unset", cursor: "pointer", fontSize: 12.5, color: t.pine, fontWeight: 700, textDecoration: "underline" }}>
                Durumu değiştir
              </button>
            ) : (
              <div style={{ background: t.surface, border: `1px solid ${t.hairline}`, borderRadius: 4, padding: 14 }}>
                <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Yeni durum</label>
                <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 4, border: `1px solid ${t.hairline}`, fontSize: 13.5, marginBottom: 10 }}>
                  {STATUS_ORDER.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
                <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Gerekçe *</label>
                <textarea
                  value={reasonDraft} onChange={(e) => setReasonDraft(e.target.value)} placeholder="Bu durum değişikliğinin gerekçesi (zorunlu)"
                  style={{ width: "100%", boxSizing: "border-box", minHeight: 60, padding: "8px 10px", borderRadius: 4, border: `1px solid ${t.hairline}`, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={saveStatus} disabled={!reasonDraft.trim()} style={{ all: "unset", boxSizing: "border-box", cursor: reasonDraft.trim() ? "pointer" : "default", flex: 1, minHeight: 40, textAlign: "center", borderRadius: 4, background: t.pine, color: "#fff", fontSize: 13, fontWeight: 700, opacity: reasonDraft.trim() ? 1 : 0.5 }}>Kaydet</button>
                  <button onClick={() => setStatusFormOpen(false)} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 40, textAlign: "center", borderRadius: 4, border: `1px solid ${t.hairline}`, color: t.ink, fontSize: 13, fontWeight: 700 }}>Vazgeç</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11.5, color: t.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>Yorumlar · {(s.comments || []).length}</p>
          {(s.comments || []).map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: `1px solid ${t.hairline}` }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: t.pineSoft, color: t.pine, fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {initials(c.author)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, color: t.ink }}>{c.text}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: t.muted }}>{c.author} · {fmt(c.at)}</p>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder="Yorum ekle"
              style={{ flex: 1, boxSizing: "border-box", padding: "9px 10px", borderRadius: 4, border: `1px solid ${t.hairline}`, fontSize: 13.5 }}
            />
            <button onClick={addComment} disabled={!commentDraft.trim()} style={{ all: "unset", boxSizing: "border-box", cursor: commentDraft.trim() ? "pointer" : "default", padding: "0 16px", borderRadius: 4, background: t.pine, color: "#fff", fontSize: 13, fontWeight: 700, opacity: commentDraft.trim() ? 1 : 0.5, display: "flex", alignItems: "center" }}>
              Gönder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
