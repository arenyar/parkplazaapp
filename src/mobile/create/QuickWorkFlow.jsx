import { useState } from "react";
import { Camera, X } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext.jsx";
import { Card, Button, Select, Input, Field, TextArea } from "../../components/ui.jsx";
import { TALEP_TYPES } from "../../mockData.js";
import { floorPhrase } from "../../piramitData.js";
import { stampStatusTiming } from "../../lib/taskTiming.js";
import { uploadPhoto } from "../../lib/storage.js";

// Kullanıcı teyidiyle: "genel olarak iş emirleri açarken... görevi başlat
// yada arıza kaydı aç dediğinde önce kat seçsin sonra departman seçsin
// bunlar popup şekilde açılan menude ilerleyecek sonrada diğer açıklamaları
// yazı görev başlat iş başlatacak işi kapatana kadar devam edecek. arıza iş
// emri aç dediğinde işi kendide yapabilir kayıtda açabilir şekilde organize
// et." — Bu akış (Kat → Departman → [sadece arıza] Kendin mi/Sadece kayıt →
// Form) ORİJİNALDE MahalKontrol.jsx içine gömülüydü, ama Teknik/Güvenlik'in
// MOBİL "Mahal" sekmesi MahalKontrol'ü DEĞİL MahalGridScreen'i kullanıyor
// (bkz. Teknik.jsx/Guvenlik.jsx tab==="mahal" dalı) — yani MahalKontrol hiç
// mount olmuyordu, popup'lar da hiç tetiklenmiyordu. Bu yüzden akış
// departman SAYFASI seviyesine (Teknik.jsx/Guvenlik.jsx/Temizlik.jsx) taşındı
// — hangi "mahal" alt-ekranı kullanılırsa kullanılsın her zaman aktif.
export function useQuickWorkFlow({ state, updateState, currentUser, department }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(null);
  const [form, setForm] = useState(null);
  const [uploading, setUploading] = useState(false);

  function start({ source, mode = "ariza" } = {}) {
    const sourceLabel = source ? `${source.point.name}${source.location ? ` — ${source.location.label}` : ""}` : "";
    setForm({
      department, issueType: mode === "gorev" ? "Görev" : "Şikayet", priority: "Orta", status: "Yapılacak", description: "",
      requester: currentUser || "", assignee: "", dueDate: "", location: sourceLabel, hasPhoto: false, photoFile: null,
      mode, selfDo: mode === "gorev",
    });
    setOpen(true);
    setStep(sourceLabel ? "departman" : "kat");
  }
  function cancel() { setOpen(false); setStep(null); setForm(null); }
  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (file) setForm((f) => ({ ...f, photoFile: file, hasPhoto: true }));
  }
  // Kullanıcı teyidiyle bulunan hata (önceki oturum): "çekilen fotoğraf hiç
  // kaydedilmiyordu" — photoFile (File nesnesi) kayıttan önce URL'e çevrilir.
  async function save() {
    if (!form.description.trim()) return;
    const { photoFile, mode, selfDo, ...rest } = form;
    let photoUrl = null;
    if (photoFile) {
      setUploading(true);
      try { photoUrl = await uploadPhoto(photoFile, "gorev-fotograflari"); }
      catch (err) { console.error("Fotoğraf yüklenemedi:", err); alert("Fotoğraf yüklenemedi (kayıt yine de fotoğrafsız oluşturulacak): " + err.message); }
      finally { setUploading(false); }
    }
    const nextNo = Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1;
    let task = { id: `t_${Date.now()}`, ticketNo: nextNo, createdAt: new Date().toISOString(), company: "", viaMahal: true, ...rest, photoUrl };
    // "Görev Başlat" HER ZAMAN, "Arıza Kaydı Aç" sadece "Kendim yapacağım"
    // seçilirse kendine atanıp ANINDA başlatılır (stampStatusTiming ile
    // startedAt damgalanır); "sadece kayıt aç" seçilirse atanmadan havuzda
    // ("Yapılacak") kalır — isteyen departman personeli üstlenebilir.
    if (selfDo) task = stampStatusTiming(null, { ...task, status: "Üzr. Çalışılıyor", assignee: currentUser, assignees: [currentUser] });
    updateState({ tasks: [...state.tasks, task] });
    cancel();
  }
  return { open, step, setStep, form, setForm, uploading, start, cancel, handlePhoto, save };
}

// Tek amaçlı, genel bir liste popup'ı — Kat/Departman/Mod adımlarının üçü de
// bunu kullanır, tekrar yazılmadı.
function QuickStepPicker({ title, subtitle, options, onSelect, onClose }) {
  const T = useTheme();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(20,49,40,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "78vh", background: T.surface, borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.ink }}>{title}</p>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}><X size={18} /></button>
          </div>
          {subtitle && <p style={{ margin: "4px 0 0", fontSize: 12, color: T.dim }}>{subtitle}</p>}
        </div>
        <div style={{ overflowY: "auto", padding: "6px 0" }}>
          {options.length === 0 && <p style={{ margin: 0, padding: "16px 18px", fontSize: 12.5, color: T.dim }}>Seçenek yok.</p>}
          {options.map((opt) => (
            <button key={opt.value} onClick={() => onSelect(opt.value)}
              style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "block", width: "100%", padding: "13px 18px", fontSize: 14, color: T.ink, borderBottom: `1px solid ${T.line}` }}>
              {opt.label}
              {opt.sub && <span style={{ display: "block", fontSize: 11.5, color: T.dim, marginTop: 2 }}>{opt.sub}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Departman sayfalarının (Teknik/Güvenlik/Temizlik) render'ında
// `useQuickWorkFlow` çıktısını doğrudan gösteren tek bileşen — ekranın en
// dışında, hangi "mahal" alt-ekranı (MahalKontrol/MahalGridScreen) kullanılırsa
// kullanılsın sabit kalır, tab değişse bile popup'lar kaybolmaz.
export function QuickWorkFlowModals({ quick, state, currentUser }) {
  const T = useTheme();
  const { open, step, setStep, form, setForm, uploading, cancel, save } = quick;
  if (!open || !form) return null;

  if (step === "kat") {
    return (
      <QuickStepPicker title="Kat Seçin" subtitle={form.mode === "gorev" ? "Görev Başlat" : "Arıza Kaydı Aç"}
        options={state.piramitFloors.map((f) => ({ value: f.label, label: floorPhrase(f.label) }))}
        onSelect={(label) => { setForm((f) => ({ ...f, location: label })); setStep("departman"); }}
        onClose={cancel} />
    );
  }
  if (step === "departman") {
    return (
      <QuickStepPicker title="Departman Seçin" subtitle={form.location}
        options={state.departments.map((d) => ({ value: d, label: d }))}
        onSelect={(d) => { setForm((f) => ({ ...f, department: d })); setStep(form.mode === "ariza" ? "mod" : "form"); }}
        onClose={cancel} />
    );
  }
  // Kullanıcı teyidiyle: "arıza iş emri aç dediğinde işi kendide yapabilir
  // kayıtda açabilir şekilde organize et" — sadece Arıza Kaydı Aç akışında
  // sorulur, Görev Başlat zaten kendine atayıp başlatmak ÜZERE açılıyor.
  if (step === "mod") {
    return (
      <QuickStepPicker title="Bu işi kim yapacak?" subtitle={`${form.department} — ${form.location}`}
        options={[
          { value: "self", label: "Kendim yapacağım", sub: "İş hemen üzerinize atanır ve başlatılır." },
          { value: "log", label: "Sadece kayıt aç", sub: `${form.department} havuzuna düşer, isteyen üstlenir.` },
        ]}
        onSelect={(v) => { setForm((f) => ({ ...f, selfDo: v === "self" })); setStep("form"); }}
        onClose={cancel} />
    );
  }
  if (step === "form") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(20,49,40,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={cancel}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto" }}>
          <Card style={{ margin: 0, borderRadius: "16px 16px 0 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{form.mode === "gorev" ? "Görev Başlat" : "Arıza Kaydı Aç"}</div>
              <button onClick={cancel} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 11, color: T.dim, marginBottom: 12 }}>📱 {form.department} · {form.location} · kaydeden: {currentUser}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
              <Field label="Kayıt Türü"><Select value={form.issueType} onChange={(e) => setForm((f) => ({ ...f, issueType: e.target.value }))}>
                {TALEP_TYPES.map((t) => <option key={t}>{t}</option>)}
              </Select></Field>
              <Field label="Öncelik"><Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                {["Düşük", "Orta", "Yüksek", "Kritik"].map((p) => <option key={p}>{p}</option>)}
              </Select></Field>
              <Field label="Termin"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
            </div>
            <Field label="Açıklama" required><TextArea style={{ width: "100%", minHeight: 60 }} placeholder="Gördüğünüz uygunsuzluğu kısaca açıklayın." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 5 }}>Fotoğraf (opsiyonel)</label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${T.line}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", color: T.dim, fontSize: 12.5 }}>
                <Camera size={15} />
                {form.hasPhoto ? "Fotoğraf seçildi ✓" : "Fotoğraf çek / seç"}
                <input type="file" accept="image/*" capture="environment" onChange={quick.handlePhoto} style={{ display: "none" }} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={save} disabled={uploading}>{uploading ? "Fotoğraf yükleniyor…" : form.selfDo ? "Kaydet ve İşi Başlat" : "Kaydı Oluştur"}</Button>
              <Button variant="quiet" onClick={cancel}>Vazgeç</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }
  return null;
}
