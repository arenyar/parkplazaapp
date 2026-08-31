import { Card, Button, Select, Field, Input, TextArea } from "./ui.jsx";

export const TASK_STATUSES = ["Yapılacak", "Üzr. Çalışılıyor", "Tamamlandı", "İptal"];
export const TASK_PRIORITIES = ["Düşük", "Orta", "Yüksek", "Kritik"];

export function emptyTask(department, nextNo) {
  return { id: null, ticketNo: nextNo, department, issueType: "Talep", priority: "Orta", status: "Yapılacak", description: "", requester: "", assignee: "", dueDate: "" };
}

// Ortak görev oluşturma/düzenleme formu — Görevler sayfası ve Teknik modülünün
// "Görevler" alt sekmesi aynı formu kullanır. lockDepartment verilirse (örn.
// "Teknik") departman sabitlenir ve seçim kutusu yerine salt-okunur gösterilir.
export function TaskForm({ form, setForm, departments, lockDepartment, onSave, onCancel }) {
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
        <Field label="Öncelik"><Select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>{TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
        <Field label="Durum"><Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Termin"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
        <Field label="Atanan"><Input value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))} /></Field>
      </div>
      <Field label="Açıklama" required><TextArea style={{ width: "100%", minHeight: 60 }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={onSave}>Kaydet</Button>
        <Button variant="quiet" onClick={onCancel}>Vazgeç</Button>
      </div>
    </Card>
  );
}
