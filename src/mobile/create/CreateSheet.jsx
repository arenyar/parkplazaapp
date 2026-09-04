import { X, Wrench, ClipboardCheck, Sparkles, ShieldCheck, AlertTriangle } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";

// Sözleşme (bkz. mobil-ui-prompt 6.4, component ağacı bölüm 5): FAB → alt
// sayfa. `RecordForm`/hiyerarşik `TypePicker` Faz 2/3 kapsamı — her seçenek,
// mevcut GERÇEK yazma yolunu (Operasyonlar > TaskForm, bkz. src/pages/
// Operasyonlar.jsx pendingTaskAction) departman ön-doluyla açar; yeni bir
// form icat edilmedi.
// Kullanıcı teyidiyle: "artı yeşil butonu departmana göre güncelle" — liste
// artık sabit değil, personelin kendi departmanına göre en olası seçenek
// EN ÜSTTE (Teknik → Arıza Bildir, Güvenlik → Güvenlik Olayı, Temizlik →
// Temizlik Kaydı); ilgisiz üç seçenek de aşağıda dursun diye tamamen
// kaldırılmadı — nadiren de olsa bir Teknik personeli güvenlik olayı da
// bildirebilir.
const BASE_OPTIONS = {
  ariza: { key: "ariza", label: "Arıza Bildir", icon: AlertTriangle, department: "Teknik", issueType: "Arıza" },
  guvenlik: { key: "guvenlik", label: "Güvenlik olayı", icon: ShieldCheck, department: "Güvenlik" },
  temizlik: { key: "temizlik", label: "Temizlik kaydı", icon: Sparkles, department: "Temizlik" },
  talep: { key: "talep", label: "Talep oluştur", icon: Wrench, department: null },
  gorev: { key: "gorev", label: "Görev oluştur", icon: ClipboardCheck, department: null, category: "Planlı Bakım" },
};
const ORDER_BY_ROLE = {
  "Teknik": ["ariza", "talep", "gorev", "guvenlik", "temizlik"],
  "Güvenlik": ["guvenlik", "talep", "gorev", "ariza", "temizlik"],
  "Temizlik": ["temizlik", "talep", "gorev", "ariza", "guvenlik"],
};
const DEFAULT_ORDER = ["talep", "gorev", "ariza", "guvenlik", "temizlik"]; // Yönetim vb.

export function CreateSheet({ open, onClose, onSelect, role }) {
  if (!open) return null;
  const OPTIONS = (ORDER_BY_ROLE[role] || DEFAULT_ORDER).map((k) => BASE_OPTIONS[k]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "flex-end" }} role="dialog" aria-modal="true" aria-label="Yeni kayıt">
      <div style={{ position: "absolute", inset: 0, background: "rgba(20,49,40,0.45)" }} onClick={onClose} />
      <div style={{ position: "relative", width: "100%", maxWidth: 480, margin: "0 auto", background: t.surface, borderRadius: "16px 16px 0 0", paddingBottom: "calc(12px + env(safe-area-inset-bottom))", boxShadow: "0 -8px 24px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${t.hairline}` }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: t.ink }}>Yeni kayıt</p>
          <button onClick={onClose} aria-label="Kapat" style={{ all: "unset", cursor: "pointer", color: t.muted, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {OPTIONS.map(({ key, label, icon: Icon, department, category, issueType }) => (
          <button
            key={key}
            onClick={() => onSelect({ department, category, issueType })}
            style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
              width: "100%", minHeight: 52, padding: "10px 16px", color: t.ink, borderBottom: `1px solid ${t.hairline}`,
            }}
          >
            <span style={{ width: 36, height: 36, borderRadius: "50%", background: t.pineSoft, color: t.pine, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={18} aria-hidden="true" />
            </span>
            <span style={{ fontSize: 15 }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
