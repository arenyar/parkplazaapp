import { useState } from "react";
import { Plus, Trash2, AlertTriangle, X, ChevronRight, Pencil } from "lucide-react";
import { T, PRIORITY_STYLES } from "../theme.js";
import { PageHeader, Card, Button, Select, Input, Field, TextArea, Pagination } from "../components/ui.jsx";
import { MONTHS_TR } from "../mockData.js";
import { usePagination } from "../lib/usePagination.js";
import { EquipmentIcons } from "../components/EquipmentIcons.jsx";
import { AssetPicker } from "../components/AssetPicker.jsx";
import { fmtDate } from "../lib/format.js";
import { periodKeysForYear } from "../lib/periods.js";
import { EQUIPMENT_TASK_TEMPLATES } from "../lib/taskTemplates.js";
import { canCloseMaintenanceDirectly } from "../lib/escort.js";
import { showToast } from "../lib/toast.js";

const PERIODS = ["1 AY", "3 AY", "6 AY", "12 AY"];
const PRIORITIES = ["Düşük", "Orta", "Yüksek", "Kritik"];
const CUR_YEAR = new Date().getFullYear();

// Periyoda göre otomatik planlamanın uygun olduğu aylar — kullanıcı teyidiyle:
// "period ekledikleten sonra planlamayı otomatik yap tiki gelmeli her ay
// bakım olanlar otomatik planlanır". 1 AY -> her ay, 3 AY -> Mar/Haz/Eyl/Ara,
// 6 AY -> Haz/Ara, 12 AY -> yılda bir (Ara). Hesaplama artık lib/periods.js'te
// (bkz. periodKeysForYear) — üçüncü bir modül aynı mantığa ihtiyaç duyarsa
// tekrar yazmasın diye ortak yere taşındı.
function eligibleMonthsForPeriod(period) {
  return periodKeysForYear(period, MONTHS_TR);
}

// Bir hücrenin görünen durumu HER ZAMAN bağlı görevin durumundan hesaplanır —
// aynı bilgiyi takvimde ayrıca tutmuyoruz, tek doğruluk kaynağı görev kaydı.
function markStatus(item, month, tasks) {
  const mark = item.marks[month];
  if (!mark) return "";
  const task = tasks.find((t) => t.id === mark.taskId);
  if (!task) return "";
  return task.status === "Tamamlandı" ? "done" : "planned";
}

// Bir öğe + ay listesi için planlı bakım görevlerini ve marks yamasını
// TEK seferde üretir — döngü içinde ayrı ayrı updateState çağırmak, her
// çağrının aynı (bayat) state kapanışını kullanması yüzünden önceki
// eklemelerin üzerine yazılmasına yol açıyordu.
function buildAutoPlanTasks(item, months, startTicketNo, currentUser) {
  let ticketNo = startTicketNo;
  const newTasks = [];
  const marks = { ...item.marks };
  months.forEach((month) => {
    const monthIdx = MONTHS_TR.indexOf(month);
    const dueDate = new Date(CUR_YEAR, monthIdx + 1, 0).toISOString().slice(0, 10);
    const id = `t_${Date.now()}_${item.id}_${month}`;
    newTasks.push({
      id, ticketNo: ticketNo++, department: "Teknik", issueType: "Planlı Bakım", category: "Planlı Bakım",
      priority: "Orta", status: "Yapılacak", description: `${item.name} — ${month} planlı bakımı (${item.firma})`,
      requester: currentUser, assignee: currentUser, createdAt: new Date().toISOString(), dueDate, assetId: item.assetId || "",
      maintenanceItemId: item.id, maintenanceMonth: month,
    });
    marks[month] = { taskId: id };
  });
  return { newTasks, marks };
}

function CloseFromCalendarModal({ item, month, team, currentUser, onConfirm, onClose }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [personnel, setPersonnel] = useState(currentUser || (team[0] && team[0].name) || "");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 14, width: 380, maxWidth: "100%", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>Bakımı Kapat</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: T.dim, margin: "4px 0 16px" }}>{item.name} — {month} {CUR_YEAR}</p>
        <Field label="Kapanma Tarihi"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%" }} /></Field>
        <Field label="Kontrol Eden Personel">
          <Select value={personnel} onChange={(e) => setPersonnel(e.target.value)} style={{ width: "100%" }}>
            {team.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </Select>
        </Field>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Button onClick={() => onConfirm(date, personnel)}>Kapat ve İşaretle (✓)</Button>
          <Button variant="quiet" onClick={onClose}>Vazgeç</Button>
        </div>
      </div>
    </div>
  );
}

function ArizaModal({ item, onConfirm, onClose }) {
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Yüksek");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 14, width: 420, maxWidth: "100%", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>Arıza Kaydı Oluştur</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: T.dim, margin: "4px 0 16px" }}>{item.name} ({item.firma})</p>
        <Field label="Açıklama" required><TextArea style={{ width: "100%", minHeight: 70 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Arızanın kısa açıklaması…" /></Field>
        <Field label="Öncelik"><Select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ width: "100%" }}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Button variant="ghost" onClick={() => description.trim() && onConfirm(description, priority)}>Arıza Kaydı Aç</Button>
          <Button variant="quiet" onClick={onClose}>Vazgeç</Button>
        </div>
      </div>
    </div>
  );
}

// AssetPicker kendi içinde modal değil (satır-içi çoklu seçim alanı) —
// bakım kartına ekipman bağlarken Kaydet/Vazgeç ile saran hafif bir kabuk.
export function EquipmentEditModal({ item, assets, onSave, onClose }) {
  const [ids, setIds] = useState(item.assetIds || []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 14, width: 420, maxWidth: "100%", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>Ekipman Bağla</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: T.dim, margin: "4px 0 16px" }}>{item.name}</p>
        <AssetPicker label="Ekipmanlar" assets={assets} selectedIds={ids} onChange={setIds} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Button onClick={() => onSave(ids)}>Kaydet</Button>
          <Button variant="quiet" onClick={onClose}>Vazgeç</Button>
        </div>
      </div>
    </div>
  );
}

// Satır-içi hücreler (periyot/kategori Select, ad/firma Input) zaten anlık
// düzenlenebiliyordu, ama kullanıcı teyidiyle bunu bulamadı/güvenmedi —
// "eklenen bakımların tekrar düzenlenebilmesi" isteği üzerine, tüm alanları
// tek bir formda toplayan, açıkça görünür bir "Düzenle" butonu/modalı eklendi.
function EditItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({ name: item.name, period: item.period, firma: item.firma, category: item.category === "Yasal" ? "Yasal" : "Planlı" });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 14, width: 420, maxWidth: "100%", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>Bakım Kaydını Düzenle</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><X size={16} /></button>
        </div>
        <Field label="Ekipman / Bakım Adı" required><Input style={{ width: "100%" }} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        <Field label="Periyot">
          <Select style={{ width: "100%" }} value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}>{PERIODS.map((p) => <option key={p}>{p}</option>)}</Select>
        </Field>
        <Field label="Firma"><Input style={{ width: "100%" }} value={form.firma} onChange={(e) => setForm((f) => ({ ...f, firma: e.target.value }))} /></Field>
        <Field label="Kategori">
          <Select style={{ width: "100%" }} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            <option value="Planlı">Planlı Bakım</option>
            <option value="Yasal">Yasal Bakım</option>
          </Select>
        </Field>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Button onClick={() => form.name.trim() && onSave(form)}>Kaydet</Button>
          <Button variant="quiet" onClick={onClose}>Vazgeç</Button>
        </div>
      </div>
    </div>
  );
}

// Katmanlı/gizlenebilir bölüm — kullanıcı teyidiyle: "Planlı Bakımlar Yasal
// Bakımlar ve Arıza Bakımları diye üç katagoriye ayır gizlemeli katmanlı olsun".
function Section({ title, subtitle, right, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ marginBottom: 16, padding: 0 }}>
      <button onClick={() => setOpen((s) => !s)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", width: "100%", padding: "14px 18px", boxSizing: "border-box", gap: 10 }}>
        <ChevronRight size={15} color={T.dim} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: T.dim, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {right}
      </button>
      {open && <div style={{ padding: "0 18px 18px" }}>{children}</div>}
    </Card>
  );
}

// Planlı/Yasal bakım grupları aynı takvim tablosunu paylaşır — tek fark
// yeni öğelerin category alanı ve filtrelenen liste.
function MaintenanceGroup({ category, state, updateState, currentUser, canWrite = true }) {
  const [closeTarget, setCloseTarget] = useState(null); // { item, month }
  const [arizaTarget, setArizaTarget] = useState(null); // item
  const [newName, setNewName] = useState("");
  const [newPeriod, setNewPeriod] = useState(PERIODS[0]);
  const [newFirma, setNewFirma] = useState("");
  const [newAutoplan, setNewAutoplan] = useState(false);
  const [equipEditId, setEquipEditId] = useState(null);
  const [editTarget, setEditTarget] = useState(null); // item

  const items = state.maintenance.filter((m) => !m.archived && (category === "Yasal" ? m.category === "Yasal" : (m.category || "Planlı") !== "Yasal"));

  function nextTicketNo() { return Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1; }

  function createPlannedTask(item, month) {
    const { newTasks, marks } = buildAutoPlanTasks(item, [month], nextTicketNo(), currentUser);
    const maintenance = state.maintenance.map((m) => (m.id === item.id ? { ...m, marks } : m));
    updateState({ tasks: [...state.tasks, ...newTasks], maintenance });
  }

  // Faz 8 — kullanıcı onayıyla: refakat tamamlanmadan (veya hiç
  // başlamamışken) bir "Planlı Bakım" kaydı sadece Yönetim rolü kapatabilir.
  // Refakat'ın kendisi mobil "Bakım takvimi" ekranında (bkz.
  // src/mobile/maintenance/) — burada sadece kapatma kapısı uygulanıyor,
  // masaüstünde ayrı bir refakat UI'ı YOK (kapsam kullanıcı onayıyla
  // sadece bu kapıyla sınırlı tutuldu).
  function handleCellClick(item, month) {
    const status = markStatus(item, month, state.tasks);
    if (status === "") createPlannedTask(item, month);
    else if (status === "planned") {
      const mark = item.marks[month];
      const linkedTask = state.tasks.find((t) => t.id === mark?.taskId);
      if (linkedTask && !canCloseMaintenanceDirectly(linkedTask, role)) {
        showToast("Bu kayıt refakat tamamlanmadan kapatılamaz — mobil Bakım takvimi'nden refakat başlatın, veya Yönetim rolüyle kapatın.", "error");
        return;
      }
      setCloseTarget({ item, month });
    }
    else if (status === "done") {
      const marks = { ...item.marks }; delete marks[month];
      const maintenance = state.maintenance.map((m) => (m.id === item.id ? { ...m, marks } : m));
      updateState({ maintenance });
    }
  }

  function confirmClose(date, personnel) {
    const { item, month } = closeTarget;
    const mark = item.marks[month];
    const tasks = state.tasks.map((t) => (t.id === mark.taskId ? { ...t, status: "Tamamlandı", completedAt: new Date(date + "T14:00").toISOString(), completedBy: personnel } : t));
    updateState({ tasks });
    setCloseTarget(null);
  }

  function confirmAriza(description, priority) {
    const item = arizaTarget;
    const id = `t_${Date.now()}`;
    const task = {
      id, ticketNo: nextTicketNo(), department: "Teknik", issueType: "Arıza", category: "Arıza Bakım",
      priority, status: "Yapılacak", description: `${item.name}: ${description}`, requester: currentUser, assignee: "",
      createdAt: new Date().toISOString(), dueDate: "", assetId: item.assetId || "", maintenanceItemId: item.id,
    };
    updateState({ tasks: [...state.tasks, task] });
    setArizaTarget(null);
  }

  function addItem() {
    if (!newName.trim()) return;
    const id = `mi_${Date.now()}`;
    let item = { id, name: newName.trim(), period: newPeriod, firma: newFirma.trim(), category, assetId: "", assetIds: [], marks: {}, autoplan: newAutoplan };
    if (newAutoplan) {
      const months = eligibleMonthsForPeriod(newPeriod);
      const { newTasks, marks } = buildAutoPlanTasks(item, months, nextTicketNo(), currentUser);
      item = { ...item, marks };
      updateState({ maintenance: [...state.maintenance, item], tasks: [...state.tasks, ...newTasks] });
    } else {
      updateState({ maintenance: [...state.maintenance, item] });
    }
    setNewName(""); setNewFirma(""); setNewAutoplan(false);
  }
  function removeItem(id) {
    const m = state.maintenance.find((x) => x.id === id);
    if (!window.confirm(`"${m?.name || "Bu bakım kaydı"}" silinsin mi? Kayıt arşivlenecek, geçmiş bakım işaretleri raporlarda kalmaya devam edecek.`)) return;
    updateState({ maintenance: state.maintenance.map((x) => (x.id === id ? { ...x, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser } : x)) });
  }

  function toggleAutoplan(item) {
    if (!item.autoplan) {
      const months = eligibleMonthsForPeriod(item.period).filter((month) => !item.marks[month]);
      const { newTasks, marks } = buildAutoPlanTasks(item, months, nextTicketNo(), currentUser);
      const maintenance = state.maintenance.map((m) => (m.id === item.id ? { ...m, autoplan: true, marks } : m));
      updateState({ maintenance, tasks: [...state.tasks, ...newTasks] });
    } else {
      updateState({ maintenance: state.maintenance.map((m) => (m.id === item.id ? { ...m, autoplan: false } : m)) });
    }
  }

  function updateItemField(id, field, value) {
    const item = state.maintenance.find((m) => m.id === id);
    if (field === "period" && item?.autoplan) {
      const months = eligibleMonthsForPeriod(value).filter((month) => !item.marks[month]);
      const { newTasks, marks } = buildAutoPlanTasks({ ...item, period: value }, months, nextTicketNo(), currentUser);
      const maintenance = state.maintenance.map((m) => (m.id === id ? { ...m, period: value, marks } : m));
      updateState({ maintenance, tasks: [...state.tasks, ...newTasks] });
      return;
    }
    updateState({ maintenance: state.maintenance.map((m) => (m.id === id ? { ...m, [field]: value } : m)) });
  }

  function saveEditedItem(form) {
    const item = editTarget;
    const periodChanged = form.period !== item.period;
    if (periodChanged && item.autoplan) {
      const months = eligibleMonthsForPeriod(form.period).filter((month) => !item.marks[month]);
      const { newTasks, marks } = buildAutoPlanTasks({ ...item, period: form.period }, months, nextTicketNo(), currentUser);
      const maintenance = state.maintenance.map((m) => (m.id === item.id ? { ...m, ...form, marks } : m));
      updateState({ maintenance, tasks: [...state.tasks, ...newTasks] });
    } else {
      updateState({ maintenance: state.maintenance.map((m) => (m.id === item.id ? { ...m, ...form } : m)) });
    }
    setEditTarget(null);
  }

  const allMarks = items.flatMap((m) => Object.entries(m.marks || {}).map(([month, mark]) => ({ m, month, mark })));
  const doneCount = allMarks.filter(({ mark }) => state.tasks.find((t) => t.id === mark.taskId)?.status === "Tamamlandı").length;
  const pct = allMarks.length ? Math.round((doneCount / allMarks.length) * 100) : 0;

  const cellSym = { "": "–", planned: "X", done: "✓" };
  const cellColor = { "": T.dimmer, planned: "#E0B354", done: "#3FB37F" };

  const { page, setPage, pageSize, setPageSize, startIndex } = usePagination(items.length, 20);
  const pagedItems = items.slice(startIndex, startIndex + pageSize);
  const equipEditItem = equipEditId ? state.maintenance.find((m) => m.id === equipEditId) : null;

  return (
    <div>
      {canWrite && (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr auto auto", gap: 8, alignItems: "center" }}>
          <Input placeholder="Yeni ekipman / bakım adı" value={newName} onChange={(e) => {
            const v = e.target.value;
            setNewName(v);
            // Referans kütüphanesi: yazılan ada bilinen bir ekipman kategorisi
            // geçiyorsa (ör. "80 kVA dizel jeneratör" -> "Jeneratör"), periyot
            // önerilir — kullanıcı henüz elle periyot seçmemişse (varsayılan
            // "1 AY" duruyorsa) doldurulur, seçtiyse asla üzerine yazılmaz.
            if (newPeriod === PERIODS[0]) {
              const match = Object.keys(EQUIPMENT_TASK_TEMPLATES).find((cat) => v.toLowerCase().includes(cat.toLowerCase()));
              if (match) setNewPeriod(EQUIPMENT_TASK_TEMPLATES[match].period);
            }
          }} />
          <Select value={newPeriod} onChange={(e) => setNewPeriod(e.target.value)}>{PERIODS.map((p) => <option key={p}>{p}</option>)}</Select>
          <Input placeholder="Firma" value={newFirma} onChange={(e) => setNewFirma(e.target.value)} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.dim, whiteSpace: "nowrap", cursor: "pointer" }}>
            <input type="checkbox" checked={newAutoplan} onChange={(e) => setNewAutoplan(e.target.checked)} />
            Otomatik Planla
          </label>
          <Button icon={Plus} onClick={addItem}>Ekle</Button>
        </div>
      </Card>
      )}

      <Card style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1140 }}>
          <thead>
            <tr style={{ background: T.surface2 }}>
              {["No", "Ekipman", "PRD", "Firma", "Kategori", "Oto."].map((h) => (
                <th key={h} style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.4, padding: "10px 12px", borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>{h}</th>
              ))}
              {MONTHS_TR.map((mo) => (
                <th key={mo} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: T.dim, padding: "10px 4px", borderBottom: `1px solid ${T.line}`, width: 40 }}>{mo.slice(0, 3)}</th>
              ))}
              <th style={{ borderBottom: `1px solid ${T.line}` }} />
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((item, i) => (
              <tr key={item.id}>
                <td style={{ padding: "9px 12px", fontSize: 12, color: T.dim, borderBottom: `1px solid ${T.line}` }}>{startIndex + i + 1}</td>
                <td style={{ padding: "9px 12px", fontSize: 12.5, color: T.ink, fontWeight: 600, borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>
                  <Input disabled={!canWrite} value={item.name} onChange={(e) => updateItemField(item.id, "name", e.target.value)} style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 6px", width: 160 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                    <EquipmentIcons ids={item.assetIds} assets={state.assets} compact />
                    {canWrite && <button onClick={() => setEquipEditId(item.id)} style={{ background: "none", border: "none", color: T.accent, fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>{item.assetIds && item.assetIds.length > 0 ? "Düzenle" : "+ Ekipman Ekle"}</button>}
                  </div>
                </td>
                <td style={{ padding: "9px 8px", borderBottom: `1px solid ${T.line}` }}>
                  <Select disabled={!canWrite} value={item.period} onChange={(e) => updateItemField(item.id, "period", e.target.value)} style={{ fontSize: 11.5, padding: "5px 6px" }}>{PERIODS.map((p) => <option key={p}>{p}</option>)}</Select>
                </td>
                <td style={{ padding: "9px 8px", borderBottom: `1px solid ${T.line}` }}>
                  <Input disabled={!canWrite} value={item.firma} onChange={(e) => updateItemField(item.id, "firma", e.target.value)} style={{ fontSize: 11.5, padding: "5px 6px", width: 110 }} />
                </td>
                <td style={{ padding: "9px 8px", borderBottom: `1px solid ${T.line}` }}>
                  <Select disabled={!canWrite} value={item.category === "Yasal" ? "Yasal" : "Planlı"} onChange={(e) => updateItemField(item.id, "category", e.target.value)} style={{ fontSize: 11.5, padding: "5px 6px" }}>
                    <option value="Planlı">Planlı Bakım</option>
                    <option value="Yasal">Yasal Bakım</option>
                  </Select>
                </td>
                <td style={{ padding: "9px 8px", borderBottom: `1px solid ${T.line}`, textAlign: "center" }}>
                  <input type="checkbox" disabled={!canWrite} checked={!!item.autoplan} onChange={() => toggleAutoplan(item)} title="Periyoda göre otomatik planla" />
                </td>
                {MONTHS_TR.map((month) => {
                  const status = markStatus(item, month, state.tasks);
                  return (
                    <td key={month} style={{ borderBottom: `1px solid ${T.line}`, textAlign: "center" }}>
                      <button onClick={() => handleCellClick(item, month)} title={`${item.name} — ${month}`}
                        style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", padding: "9px 0", fontWeight: 700, fontSize: 12.5, color: cellColor[status] }}>
                        {cellSym[status]}
                      </button>
                    </td>
                  );
                })}
                <td style={{ borderBottom: `1px solid ${T.line}`, padding: "9px 10px", display: "flex", gap: 6 }}>
                  {canWrite && <button onClick={() => setEditTarget(item)} title="Bakım kaydını düzenle" style={{ background: "none", border: "none", cursor: "pointer", color: T.accent }}><Pencil size={14} /></button>}
                  <button onClick={() => setArizaTarget(item)} title="Arıza kaydı oluştur" style={{ background: "none", border: "none", cursor: "pointer", color: "#E08A3E" }}><AlertTriangle size={14} /></button>
                  {canWrite && <button onClick={() => removeItem(item.id)} title="Sil" style={{ background: "none", border: "none", cursor: "pointer", color: "#E2685A" }}><Trash2 size={14} /></button>}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={19} style={{ padding: 20, fontSize: 12.5, color: T.dimmer }}>Henüz kayıt yok.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      {items.length > 0 && <Pagination page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={items.length} />}
      <div style={{ fontSize: 11.5, color: T.dim, marginTop: 6 }}>Tamamlanma: <b style={{ color: T.ink }}>%{pct}</b></div>

      {closeTarget && (
        <CloseFromCalendarModal item={closeTarget.item} month={closeTarget.month} team={state.team} currentUser={currentUser}
          onConfirm={confirmClose} onClose={() => setCloseTarget(null)} />
      )}
      {arizaTarget && <ArizaModal item={arizaTarget} onConfirm={confirmAriza} onClose={() => setArizaTarget(null)} />}
      {editTarget && <EditItemModal item={editTarget} onSave={saveEditedItem} onClose={() => setEditTarget(null)} />}
      {equipEditItem && (
        <EquipmentEditModal item={equipEditItem} assets={state.assets}
          onSave={(ids) => { updateState({ maintenance: state.maintenance.map((m) => (m.id === equipEditId ? { ...m, assetIds: ids, assetId: ids[0] || "" } : m)) }); setEquipEditId(null); }}
          onClose={() => setEquipEditId(null)} />
      )}
    </div>
  );
}

// Arıza Bakımları — Teknik > Arıza Kayıtları sekmesiyle aynı veri kaynağı
// (state.tasks, category==="Arıza Bakım"); burada salt-okunur özet olarak,
// takvimle birlikte katmanlı görünür (kullanıcı teyidiyle üç kategoriye ayırma isteği).
function ArizaSummary({ state }) {
  const items = state.tasks.filter((t) => t.category === "Arıza Bakım");
  const { page, setPage, pageSize, setPageSize, startIndex } = usePagination(items.length, 20);
  const paged = items.slice(startIndex, startIndex + pageSize);
  return (
    <div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {items.length === 0 && <p style={{ color: T.dim, fontSize: 13, padding: 20 }}>Arıza kaydı yok.</p>}
        {paged.map((t) => {
          const pr = PRIORITY_STYLES[t.priority] || {};
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${T.line}`, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>#{t.ticketNo} · {t.description}</div>
                <div style={{ fontSize: 11, color: T.dimmer, marginTop: 2 }}>Oluşturma: {fmtDate(t.createdAt)} · Atanan: {t.assignee || "—"}</div>
              </div>
              <span style={{ background: `${T.accent}22`, color: T.accent, fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "3px 9px" }}>{t.status}</span>
              <span style={{ background: pr.bg, color: pr.fg, fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "3px 9px", textTransform: "uppercase" }}>{t.priority}</span>
            </div>
          );
        })}
      </Card>
      {items.length > 0 && <Pagination page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={items.length} />}
    </div>
  );
}

export function Bakim({ state, updateState, currentUser, role, canWrite = true }) {
  const planliCount = state.maintenance.filter((m) => !m.archived && (m.category || "Planlı") !== "Yasal").length;
  const yasalCount = state.maintenance.filter((m) => !m.archived && m.category === "Yasal").length;
  const arizaCount = state.tasks.filter((t) => t.category === "Arıza Bakım").length;

  return (
    <div>
      <PageHeader title={`Park Plaza — ${CUR_YEAR} Firma Bakımları Yıllık İş Planı`}
        subtitle="Hücreye tıklayınca sırayla: boş → Planlı (X) → Gerçekleşti (✓) → boş. Otomatik Planla işaretlenirse periyoda uyan aylar kendiliğinden planlanır." />

      <Section title="Planlı Bakımlar" subtitle={`${planliCount} kayıt`}>
        <MaintenanceGroup category="Planlı" state={state} updateState={updateState} currentUser={currentUser} canWrite={canWrite} />
      </Section>

      <Section title="Yasal Bakımlar" subtitle={`${yasalCount} kayıt — mevzuat gereği zorunlu periyodik kontroller`}>
        <MaintenanceGroup category="Yasal" state={state} updateState={updateState} currentUser={currentUser} canWrite={canWrite} />
      </Section>

      <Section title="Arıza Bakımları" subtitle={`${arizaCount} kayıt`}>
        <ArizaSummary state={state} />
      </Section>
    </div>
  );
}
