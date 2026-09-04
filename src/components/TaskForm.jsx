import { useState } from "react";
import { Card, Button, Select, Field, Input, TextArea } from "./ui.jsx";
import { TypePicker } from "../mobile/create/TypePicker.jsx";
import { useTheme } from "../lib/ThemeContext.jsx";

export const TASK_STATUSES = ["Yapılacak", "Üzr. Çalışılıyor", "Tamamlandı", "İptal"];
export const TASK_PRIORITIES = ["Düşük", "Orta", "Yüksek", "Kritik"];

export function emptyTask(department, nextNo) {
  return { id: null, ticketNo: nextNo, department, issueType: "Talep", typeId: null, typePath: "", priority: "Orta", status: "Yapılacak", description: "", requester: "", assignee: "", dueDate: "", resolution: "" };
}

// Ortak görev oluşturma/düzenleme formu — Görevler sayfası ve Teknik modülünün
// "Görevler" alt sekmesi aynı formu kullanır. lockDepartment verilirse (örn.
// "Teknik") departman sabitlenir ve seçim kutusu yerine salt-okunur gösterilir.
// Kullanıcı teyidiyle: "arıza kaydında tamamlandı dediğinde açıklama girilsin
// tamamlandı ama ne yapıldıda tamamlandı gibi" — Durum "Tamamlandı" seçilince
// "Çözüm / Ne Yapıldı" alanı zorunlu hale gelir (Kaydet, boşsa engellenir).
// Faz 2 — `types` (bkz. mockData.js TASK_TYPES / state.taskTypes) verilirse
// hiyerarşik Tür seçici görünür (bkz. mobil-ui-prompt 6.5); verilmezse bu
// alan hiç render edilmez (geriye dönük uyumlu — çağıran güncellenmeden de
// form eskisi gibi çalışır).
// Kullanıcı teyidiyle: "görevlerde personel atama olsun" — "Atanan" serbest
// metin DEĞİL artık, `team` (state.team) verilirse gerçek personel listesinden
// seçilen bir açılır menü; görevin departmanına göre daraltılır (bir Teknik
// kaydına Güvenlik personeli atanmaz) — böylece personStats.js/navConfig.js
// gibi yerlerdeki `assignee === personName` eşleşmesi yazım hatasıyla
// bozulmaz. `team` verilmezse (geriye dönük uyumlu) eski serbest metin kutusu
// kullanılır.
export function TaskForm({ form, setForm, departments, lockDepartment, types = [], team, onSave, onCancel }) {
  const T = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const completing = form.status === "Tamamlandı";
  function handleSave() {
    if (completing && !(form.resolution || "").trim()) {
      alert("Görevi Tamamlandı olarak kaydetmeden önce ne yapıldığını (çözüm) açıklayın.");
      return;
    }
    onSave();
  }
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
        <Field label="Departman">
          {lockDepartment ? (
            <Input value={lockDepartment} disabled style={{ opacity: 0.7 }} />
          ) : (
            <Select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </Select>
          )}
        </Field>
        {types.length > 0 && (
          <Field label="Tür">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              style={{
                width: "100%", textAlign: "left", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8,
                padding: "8px 10px", color: form.typePath ? T.ink : T.dim, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {form.typePath || "Seç…"}
            </button>
          </Field>
        )}
        <Field label="Öncelik"><Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>{TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
        <Field label="Durum"><Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Termin"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
        <Field label="Atanan">
          {team ? (
            <Select value={form.assignee || ""} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}>
              <option value="">Atanmadı — havuzda bekliyor</option>
              {team.filter((p) => !form.department || p.department === form.department).map((p) => (
                <option key={p.id} value={p.name}>{p.name} · {p.role}</option>
              ))}
            </Select>
          ) : (
            <Input value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))} />
          )}
        </Field>
      </div>
      <Field label="Açıklama" required><TextArea style={{ width: "100%", minHeight: 60 }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
      {completing && (
        <Field label="Çözüm / Ne Yapıldı" required>
          <TextArea style={{ width: "100%", minHeight: 60 }} placeholder="Tamamlandı olarak işaretlemeden önce yapılan işi açıklayın." value={form.resolution || ""} onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value }))} />
        </Field>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={handleSave}>Kaydet</Button>
        <Button variant="quiet" onClick={onCancel}>Vazgeç</Button>
      </div>
      {pickerOpen && (
        <TypePicker
          open
          types={types}
          valueTypeId={form.typeId}
          onCancel={() => setPickerOpen(false)}
          onSelect={(typeId, typePath) => { setForm((f) => ({ ...f, typeId, typePath })); setPickerOpen(false); }}
        />
      )}
    </Card>
  );
}
