import { useState } from "react";
import { Sparkles } from "lucide-react";
import { editTextWithAI } from "../lib/aiEdit.js";
import { showToast } from "../lib/toast.js";

// Herhangi bir metin alanının yanına konabilen tek satırlık AI düzenleme
// butonu — kullanıcı teyidiyle: "yapay zeka desteği ile tüm formları taslak
// ve imla kurallarına göre güncelle". Tek kaynak: netlify/functions/
// edit-form-text.js (bkz. lib/aiEdit.js) — Güvenlik'in Olay Tutanağı'ndaki
// ilk sürümüyle AYNI çağrı, burada genelleştirilip paylaşılabilir hale
// getirildi. value boşken devre dışı; context varsayılan "genel" (imla/
// dilbilgisi), "tutanak" resmi/hukuka uygun üslup ister.
export function AiEditButton({ value, onChange, context = "genel", label = "Metni Düzenle (AI)" }) {
  const [editing, setEditing] = useState(false);
  async function run() {
    if (!value?.trim() || editing) return;
    setEditing(true);
    try {
      const edited = await editTextWithAI(value, context);
      onChange(edited);
      showToast("Metin yapay zeka ile düzenlendi.", "success");
    } catch (err) {
      console.error("Metin düzenlenemedi:", err);
      showToast("Metin düzenlenemedi: " + err.message, "error");
    } finally {
      setEditing(false);
    }
  }
  return (
    <button type="button" onClick={run} disabled={!value?.trim() || editing} title="Metni yapay zeka ile taslak/imla kurallarına göre düzenle"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, border: "none", borderRadius: 999, padding: "5px 11px",
        cursor: !value?.trim() || editing ? "default" : "pointer", background: "rgba(139,92,246,0.12)", color: "#8B5CF6", opacity: !value?.trim() || editing ? 0.5 : 1,
      }}>
      <Sparkles size={12} />
      {editing ? "Düzenleniyor…" : label}
    </button>
  );
}
