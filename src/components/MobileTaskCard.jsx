import { useState } from "react";
import { X, Camera } from "lucide-react";
import { T } from "../theme.js";
import { Field, Select, TextArea, Button } from "./ui.jsx";
import { TASK_STATUSES } from "./TaskForm.jsx";

// Kullanıcı teyidiyle: "Görevlere Tıkladığında sadece ilgili görevin kartı
// gelmeli ve burda kart üzerinde yapacağı değişiklikler durumu açıklaması
// isterse fotoğraf ekleyebilmeli... 1. görseldeki alanlar gelmemeli" —
// masaüstündeki genel TaskForm'un (Departman/Öncelik/Termin/Atanan gibi
// idari alanları olan) mobil karşılığı DEĞİL, kasıtlı olarak çok dar: sadece
// Açıklama + Durum + opsiyonel fotoğraf düzenlenebilir, geri kalan alanlar
// (bilet no, firma/konum, termin) salt-okunur bağlam olarak gösterilir.
export function MobileTaskCard({ task, onSave, onClose }) {
  const [status, setStatus] = useState(task.status);
  const [description, setDescription] = useState(task.description);
  const [hasPhoto, setHasPhoto] = useState(!!task.hasPhoto);

  function handlePhoto(e) {
    if (e.target.files?.[0]) setHasPhoto(true);
  }
  function save() {
    onSave({ ...task, status, description, hasPhoto });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, width: 420, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ fontSize: 11.5, color: T.dim, fontWeight: 700 }}>#{task.ticketNo} · {task.issueType}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><X size={18} /></button>
        </div>
        <p style={{ margin: "6px 0 16px", fontSize: 12, color: T.dimmer }}>
          {task.company ? `Firma: ${task.company}` : ""}{task.location ? `${task.company ? " · " : ""}${task.location}` : ""}
          {task.dueDate ? `${task.company || task.location ? " · " : ""}Termin: ${task.dueDate}` : ""}
        </p>
        <Field label="Açıklama"><TextArea style={{ width: "100%", minHeight: 70 }} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Durum"><Select value={status} onChange={(e) => setStatus(e.target.value)}>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Fotoğraf (opsiyonel)">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: hasPhoto ? "#3FB37F" : T.accent }}>
            <Camera size={15} /> {hasPhoto ? "Fotoğraf eklendi" : "Fotoğraf ekle"}
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
          </label>
        </Field>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Button onClick={save}>Kaydet</Button>
          <Button variant="quiet" onClick={onClose}>Kapat</Button>
        </div>
      </div>
    </div>
  );
}
