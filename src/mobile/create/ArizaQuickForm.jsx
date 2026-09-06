import { useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight, Camera, Mic, MicOff, Zap, Wrench, Flame, HardHat, Sparkles, Package, Check } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { useSpeechDictation } from "../../lib/useSpeechDictation.js";

// Kullanıcı teyidiyle: "arıza kaydı aça tıkladın ekranda departman seçimi
// olsun örnek teknik zaten kattan arıza kaydı açtığı için arızanın olduğu
// alan belli. tür kısım seçenekleri ekrana gelsin elektrik mekanik teknik
// inşaat temizlik gibi birine tıkladığında alt kırımını varsa seçsin.
// açıklama yazdır sesli de yazılsın... sonra isteğe bağlı resim eklesin."
// — Departman/konum zaten ÇAĞIRAN (MahalGridScreen openFloorIssueAt) tarafından
// belirlenip buraya salt-okunur bağlam olarak geliyor (personel değiştiremez
// — kattan/departmandan açıldığı için zaten belli). Tür seçimi eskiden
// TaskForm içindeki küçük bir "Tür" düğmesinin açtığı ayrı bir ağaç
// modaldı (bkz. TypePicker.jsx) — burada KÖK kategoriler doğrudan ekranda
// büyük, dokunmalı kartlar olarak duruyor, birine dokununca (alt kırımı
// varsa) o kategorinin alt maddeleri aynı ekranda listeleniyor.
const ROOT_ICONS = {
  elektrik: Zap,
  mekanik: Wrench,
  "yangin-guvenlik": Flame,
  insaat: HardHat,
  "temizlik-tur": Sparkles,
};

export function ArizaQuickForm({ department, location, types, onSave, onCancel }) {
  const byId = useMemo(() => new Map(types.map((tp) => [tp.id, tp])), [types]);
  const roots = useMemo(() => types.filter((tp) => !tp.parentId).sort((a, b) => (a.order || 0) - (b.order || 0)), [types]);
  // Kullanıcı teyidiyle bulunan hata (kendi testimde): "WC" gibi TEK
  // seviyeli değil, kendi altında da alt maddeleri (WC kapağı arızalı vb.)
  // olan bir kategoriye dokununca eskiden doğrudan seçili sayılıyordu, o
  // alt maddeler hiç gösterilmiyordu — `openRootId` sadece TEK seviye
  // derinliği destekliyordu. Artık `path` bir YIĞIN (dizi) — kaç seviye
  // olursa olsun (bkz. mockData.js TASK_TYPES "WC" > "WC kapağı arızalı"),
  // bir düğüm yaprak olana kadar derinleşmeye devam eder.
  const [path, setPath] = useState([]); // dizi: [rootId, childId, ...]
  const [typeId, setTypeId] = useState(null);
  const [typeLabel, setTypeLabel] = useState("");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  const parentId = path.length > 0 ? path[path.length - 1] : null;
  const parentNode = parentId ? byId.get(parentId) : null;
  const currentItems = useMemo(() => types.filter((tp) => (tp.parentId || null) === parentId).sort((a, b) => (a.order || 0) - (b.order || 0)), [types, parentId]);

  const dictation = useSpeechDictation({
    onFinalText: (text) => setDescription((d) => (d ? `${d} ${text}` : text)),
  });

  function pickItem(item) {
    if (!item.isLeaf) { setPath((p) => [...p, item.id]); return; }
    const labelParts = [...path.map((id) => byId.get(id)?.label).filter(Boolean), item.label];
    setTypeId(item.id);
    setTypeLabel(labelParts.join(" — "));
    setPath([]);
  }
  function goBack() { setPath((p) => p.slice(0, -1)); }

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  const canSave = !!typeId && description.trim().length > 0 && !saving;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    await onSave({ typeId, typePath: typeLabel, description: description.trim(), photoFile });
  }

  return (
    <div style={{ padding: 16, background: t.ivory, minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.ink }}>Arıza Kaydı</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: t.muted }}>{department}{location ? ` · ${location}` : ""}</p>
        </div>
        <button onClick={onCancel} aria-label="Vazgeç" style={{ all: "unset", cursor: "pointer", color: t.muted, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <p style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, margin: "0 0 8px" }}>Tür</p>

      {typeId && path.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px", borderRadius: 12, background: t.pineSoft, marginBottom: 14 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600, color: t.pine }}><Check size={15} aria-hidden="true" /> {typeLabel}</span>
          <button onClick={() => { setTypeId(null); setTypeLabel(""); }} style={{ all: "unset", cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: t.pine, textDecoration: "underline" }}>Değiştir</button>
        </div>
      )}

      {!typeId && path.length === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 8, marginBottom: 14 }}>
          {roots.map((root) => {
            const Icon = ROOT_ICONS[root.id] || Package;
            return (
              <button key={root.id} onClick={() => pickItem(root)}
                style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", borderRadius: 14, background: t.surface, textAlign: "center" }}>
                <span style={{ width: 40, height: 40, borderRadius: "50%", background: t.pineSoft, color: t.pine, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: t.ink, lineHeight: 1.25 }}>{root.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {!typeId && path.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={goBack} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, color: t.pine, marginBottom: 8 }}>
            <ChevronLeft size={15} aria-hidden="true" /> {parentNode?.label}
          </button>
          <div style={{ background: t.surface, borderRadius: 14, overflow: "hidden" }}>
            {currentItems.map((item) => (
              <button key={item.id} onClick={() => pickItem(item)}
                style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: 46, padding: "10px 14px", borderBottom: `1px solid ${t.hairline}`, color: t.ink, fontSize: 13.5 }}>
                {item.label} {!item.isLeaf && <ChevronRight size={15} color={t.muted} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <label style={{ fontSize: 12.5, fontWeight: 700, color: t.ink }}>Açıklama</label>
        <button type="button" onClick={dictation.toggle} title={dictation.listening ? "Dikteyi durdur" : "Sesle anlat"}
          style={{ display: "flex", alignItems: "center", gap: 5, border: "none", borderRadius: 999, padding: "5px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer", background: dictation.listening ? "#DC5A34" : t.pineSoft, color: dictation.listening ? "#fff" : t.pine }}>
          {dictation.listening ? <MicOff size={13} aria-hidden="true" /> : <Mic size={13} aria-hidden="true" />}
          {dictation.listening ? "Dinliyor…" : "Sesle anlat"}
        </button>
      </div>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Arızayı kısaca açıklayın…"
        style={{ width: "100%", minHeight: 90, boxSizing: "border-box", padding: 10, borderRadius: 12, border: `1px solid ${t.hairline}`, fontSize: 13.5, fontFamily: "inherit", resize: "vertical", background: t.surface }} />
      {dictation.listening && (
        <p style={{ fontSize: 12, color: t.muted, fontStyle: "italic", margin: "6px 0 0" }}>🎤 Dinleniyor… {dictation.interimText && `"${dictation.interimText}"`}</p>
      )}

      <p style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, margin: "16px 0 8px" }}>Fotoğraf (opsiyonel)</p>
      <label style={{ display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${t.hairline}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", color: t.muted, fontSize: 13, background: t.surface }}>
        <Camera size={16} aria-hidden="true" /> {photoFile ? "Fotoğraf seçildi ✓" : "Fotoğraf çek / seç"}
        <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
      </label>
      {photoPreviewUrl && <img src={photoPreviewUrl} alt="Önizleme" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 12, marginTop: 8 }} />}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button onClick={submit} disabled={!canSave}
          style={{ all: "unset", boxSizing: "border-box", cursor: canSave ? "pointer" : "default", flex: 1, textAlign: "center", padding: "13px 0", borderRadius: 999, fontSize: 14, fontWeight: 700, color: "#fff", background: canSave ? t.pine : "#B7C4BE" }}>
          {saving ? "Kaydediliyor…" : "Kaydı Oluştur"}
        </button>
        <button onClick={onCancel} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", padding: "13px 18px", borderRadius: 999, fontSize: 14, fontWeight: 700, color: t.muted, border: `1px solid ${t.hairline}`, textAlign: "center" }}>
          Vazgeç
        </button>
      </div>
    </div>
  );
}
