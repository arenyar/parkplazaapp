import { useState } from "react";
import { Camera } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { uploadPhoto } from "../../lib/storage.js";
import { CATEGORIES } from "./suggestionModel.js";

const fieldStyle = { width: "100%", boxSizing: "border-box", padding: "9px 10px", borderRadius: 4, border: `1px solid ${t.hairline}`, fontSize: 13.5, fontFamily: "inherit", color: t.ink, background: t.surface };

// Spec (Faz 9): başlık, açıklama, kategori, isteğe bağlı fotoğraf, isteğe
// bağlı anonim gönderim.
export function SuggestionForm({ onSave, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [anonymous, setAnonymous] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setUploading(true);
    let photoUrl = null;
    if (photoFile) {
      try { photoUrl = await uploadPhoto(photoFile, "suggestions"); } catch { /* fotoğraf isteğe bağlı — yükleme başarısız olsa da öneri kaydedilir */ }
    }
    setUploading(false);
    onSave({ title: title.trim(), description: description.trim(), category, anonymous, photoUrl });
  }

  return (
    <div style={{ padding: 16, background: t.ivory }}>
      <div style={{ background: t.surface, border: `1px solid ${t.hairline}`, borderRadius: 4, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Başlık *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} placeholder="Öneriyi kısaca özetleyin" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Kategori</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={fieldStyle}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11.5, color: t.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>Açıklama</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...fieldStyle, minHeight: 80, resize: "vertical" }} placeholder="Detaylandırın" />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 13, color: t.ink }}>Anonim gönder — adım hiçbir rolde görünmesin, sadece departmanım görünsün</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "8px 10px", borderRadius: 4, border: `1px dashed ${t.hairline}`, color: t.muted, fontSize: 13, cursor: "pointer" }}>
          <Camera size={17} aria-hidden="true" />
          {photoFile ? photoFile.name : "Fotoğraf ekle (opsiyonel)"}
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={handleSave} disabled={!title.trim() || uploading}
            style={{ all: "unset", boxSizing: "border-box", cursor: title.trim() ? "pointer" : "default", flex: 1, minHeight: 44, textAlign: "center", borderRadius: 4, background: t.pine, color: "#fff", fontSize: 13.5, fontWeight: 700, opacity: title.trim() && !uploading ? 1 : 0.5 }}
          >
            {uploading ? "Gönderiliyor…" : "Gönder"}
          </button>
          <button onClick={onCancel} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 44, textAlign: "center", borderRadius: 4, border: `1px solid ${t.hairline}`, color: t.ink, fontSize: 13.5, fontWeight: 700 }}>
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}
