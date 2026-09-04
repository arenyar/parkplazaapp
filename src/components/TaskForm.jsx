import { useState } from "react";
import { MessageCircle, Plus, X } from "lucide-react";
import { Card, Button, Select, Field, Input, TextArea } from "./ui.jsx";
import { TypePicker } from "../mobile/create/TypePicker.jsx";
import { useTheme } from "../lib/ThemeContext.jsx";
import { buildAssigneeFields } from "../lib/taskAssignees.js";
import { buildWhatsAppLink } from "../lib/whatsapp.js";
import { AiEditButton } from "./AiEditButton.jsx";
import { categoryPath } from "../lib/stock.js";

export const TASK_STATUSES = ["Yapılacak", "Üzr. Çalışılıyor", "Tamamlandı", "İptal"];
export const TASK_PRIORITIES = ["Düşük", "Orta", "Yüksek", "Kritik"];

export function emptyTask(department, nextNo) {
  return { id: null, ticketNo: nextNo, department, issueType: "Talep", typeId: null, typePath: "", priority: "Orta", status: "Yapılacak", description: "", requester: "", assignee: "", assignees: [], dueDate: "", resolution: "", materialsUsed: [] };
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
export function TaskForm({ form, setForm, departments, lockDepartment, types = [], team, stockItems, stockCategories, onSave, onCancel }) {
  const T = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState(null);
  const completing = form.status === "Tamamlandı";
  // Kullanıcı teyidiyle: "tekniğe düşen görevde de yedek malzeme
  // kullanabilir" — sadece Teknik görevlerinde, ve sadece çağıran taraf
  // stockItems verdiyse (geriye dönük uyumlu, TaskForm'un diğer tüm
  // kullanıcıları hiçbir şey değiştirmeden çalışmaya devam eder).
  const effectiveDepartment = lockDepartment || form.department;
  const showMaterials = effectiveDepartment === "Teknik" && Array.isArray(stockItems);
  // Kullanıcı teyidiyle bulunan sorun: "mobilden yaptığı değişiklikler kayıt
  // olmuyor" — kök nedenlerden biri buradaki native `alert()` idi: mobil
  // tarayıcılarda/otomasyonda kolayca fark edilmeden kapatılabiliyor, kişi
  // "Kaydet"e bastım ama hiçbir şey olmadı sanıyordu. Artık aynı uyarı,
  // Kaydet butonunun HEMEN ÜSTÜNDE kalıcı bir metin olarak duruyor —
  // kapatılamaz, "Çözüm" alanı doldurulup tekrar Kaydet'e basılana kadar
  // görünür kalır.
  function handleSave() {
    if (completing && !(form.resolution || "").trim()) {
      setBlockedMsg("Görevi Tamamlandı olarak kaydetmeden önce ne yapıldığını (çözüm) açıklayın.");
      return;
    }
    setBlockedMsg(null);
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
            <MultiAssigneePicker
              team={team.filter((p) => !form.department || p.department === form.department)}
              selected={form.assignees && form.assignees.length > 0 ? form.assignees : (form.assignee ? [form.assignee] : [])}
              onChange={(names) => setForm((f) => ({ ...f, ...buildAssigneeFields(names) }))}
            />
          ) : (
            <Input value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))} />
          )}
        </Field>
      </div>
      {team && <WhatsAppNotifyRow team={team} form={form} />}
      <Field label="Açıklama" required right={<AiEditButton value={form.description} onChange={(text) => setForm((f) => ({ ...f, description: text }))} />}>
        <TextArea style={{ width: "100%", minHeight: 60 }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </Field>
      {completing && (
        <Field label="Çözüm / Ne Yapıldı" required right={<AiEditButton value={form.resolution} onChange={(text) => setForm((f) => ({ ...f, resolution: text }))} />}>
          <TextArea style={{ width: "100%", minHeight: 60 }} placeholder="Tamamlandı olarak işaretlemeden önce yapılan işi açıklayın." value={form.resolution || ""} onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value }))} />
        </Field>
      )}
      {showMaterials && (
        <MaterialsUsedPicker stockItems={stockItems} stockCategories={stockCategories || []}
          selected={form.materialsUsed || []} onChange={(materialsUsed) => setForm((f) => ({ ...f, materialsUsed }))} />
      )}
      {blockedMsg && (
        <div style={{ fontSize: 12, fontWeight: 600, color: "#DC5A34", background: "rgba(220,90,52,0.10)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>{blockedMsg}</div>
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

// Kullanıcı teyidiyle: "personelde cep telefonu olan personele iş emri
// açıldığında whatsappdan link gönder o link üzerinden iş başlatıp
// kapatabilsin" — atanan kişilerden telefonu kayıtlı olanlar için wa.me
// click-to-chat linki (bkz. lib/whatsapp.js). Telefonu boş olan kişi için
// buton hiç gösterilmez (uydurma numara yok); gerçek bir arka planda
// otomatik gönderim YOK, kişi kendi WhatsApp'ında "Gönder"e basar.
function WhatsAppNotifyRow({ team, form }) {
  const T = useTheme();
  const names = form.assignees && form.assignees.length > 0 ? form.assignees : (form.assignee ? [form.assignee] : []);
  const recipients = names
    .map((name) => team.find((t) => t.name === name))
    .filter((p) => p && p.phone);
  if (recipients.length === 0) return null;
  const message = `Yeni iş emri #${form.ticketNo || ""} — ${form.description || form.typePath || "detay için uygulamayı kontrol edin"}\nUygulamadan işi başlatıp kapatabilirsiniz: ${window.location.origin}/mobil`;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "-6px 0 10px" }}>
      {recipients.map((p) => {
        const link = buildWhatsAppLink(p.phone, message);
        if (!link) return null;
        return (
          <a key={p.id} href={link} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#25D366", textDecoration: "none", border: `1px solid ${T.line}`, borderRadius: 999, padding: "4px 10px" }}>
            <MessageCircle size={12} /> {p.name}'a WhatsApp gönder
          </a>
        );
      })}
    </div>
  );
}

// Kullanıcı teyidiyle: "bakımlarda kullanılan yedek parçalar... tekniğe
// düşen görevde de yedek malzeme kullanabilir" — satır satır kalem+miktar
// seçimi. Gerçek stok düşümü/hareket kaydı BURADA yapılmaz (bu form
// state'i bilmiyor) — sadece `form.materialsUsed`e yazılır, asıl düşüm
// görevi KAYDEDEN taraf (bkz. lib/stock.js consumeStockPatch, Teknik.jsx/
// TaskListScreen.jsx save()) updateState ile uygular.
// Kullanıcı teyidiyle: "malzeme eklemede arama olsun... en azından kategori
// seçilerek aranacak malzeme daha kolay bulunur malzeme adedide o popupda
// yazar" — düz açılır menü (uzun listede kaydırmak zor) yerine, kategori
// filtresi + arama kutusu olan bir seçim penceresi; her satırda mevcut
// stok miktarı görünür.
function MaterialPickerModal({ stockItems, stockCategories, onSelect, onClose }) {
  const T = useTheme();
  const leafCategories = stockCategories.filter((c) => c.isLeaf);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [q, setQ] = useState("");
  const filtered = stockItems.filter((it) => {
    if (categoryFilter && it.categoryId !== categoryFilter) return false;
    if (q.trim() && !it.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  });
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: T.surface, borderRadius: 14, width: "100%", maxWidth: 440, maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${T.line}` }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink }}>Malzeme Seç</p>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8, borderBottom: `1px solid ${T.line}` }}>
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Malzeme ara…" />
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Tüm kategoriler</option>
            {leafCategories.map((c) => <option key={c.id} value={c.id}>{categoryPath(stockCategories, c.id)}</option>)}
          </Select>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 && <p style={{ margin: 0, padding: 16, fontSize: 12, color: T.dim }}>Sonuç bulunamadı.</p>}
          {filtered.map((it) => {
            const low = it.minQuantity > 0 && it.quantity <= it.minQuantity;
            return (
              <button key={it.id} type="button" onClick={() => onSelect(it.id)}
                style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 16px", borderBottom: `1px solid ${T.line}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{it.name}</div>
                  <div style={{ fontSize: 10.5, color: T.dim, marginTop: 2 }}>{categoryPath(stockCategories, it.categoryId)}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: low ? "#DC5A34" : T.dim, flexShrink: 0, marginLeft: 8, textAlign: "right" }}>{it.quantity} {it.unit}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MaterialsUsedPicker({ stockItems, stockCategories, selected, onChange }) {
  const T = useTheme();
  // null = kapalı, "new" = yeni satır ekleniyor, sayı = o satırın malzemesi değiştiriliyor
  const [pickerRow, setPickerRow] = useState(null);
  function updateRow(i, patch) {
    onChange(selected.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i) {
    onChange(selected.filter((_, idx) => idx !== i));
  }
  function handleSelectItem(itemId) {
    if (pickerRow === "new") onChange([...selected, { itemId, quantity: 1 }]);
    else updateRow(pickerRow, { itemId });
    setPickerRow(null);
  }
  return (
    <Field label="Kullanılan Malzemeler (opsiyonel)">
      {stockItems.length === 0 ? (
        <p style={{ margin: 0, fontSize: 11.5, color: T.dim }}>Henüz stok kalemi tanımlanmadı — Stok ekranından ekleyin.</p>
      ) : (
        <>
          {selected.map((row, i) => {
            const item = stockItems.find((it) => it.id === row.itemId);
            return (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <button type="button" onClick={() => setPickerRow(i)}
                  style={{ flex: 1, minWidth: 0, textAlign: "left", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, color: item ? T.ink : T.dim, cursor: "pointer", fontFamily: "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item ? `${item.name} — ${categoryPath(stockCategories, item.categoryId)} (${item.quantity} ${item.unit} mevcut)` : "Malzeme seç…"}
                </button>
                <Input type="number" min="0" step="1" value={row.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })} style={{ width: 70, flexShrink: 0 }} />
                {item && <span style={{ fontSize: 11, color: T.dim, flexShrink: 0, width: 40 }}>{item.unit}</span>}
                <button type="button" onClick={() => removeRow(i)} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex", flexShrink: 0 }}><X size={14} /></button>
              </div>
            );
          })}
          <Button type="button" variant="ghost" icon={Plus} onClick={() => setPickerRow("new")}>Malzeme Ekle</Button>
        </>
      )}
      {pickerRow !== null && (
        <MaterialPickerModal stockItems={stockItems} stockCategories={stockCategories} onSelect={handleSelectItem} onClose={() => setPickerRow(null)} />
      )}
    </Field>
  );
}

// Kullanıcı teyidiyle: "aynı işe birden fazla kişi gidebiliyor iş
// emirlerine birden fazla personelde seçilebilsin" — tek seçimlik <Select>
// yerine açılır bir onay-kutusu listesi (birden fazla kişi işaretlenebilir).
// Kapalıyken seçili kişi(ler) özet olarak görünür, tıklanınca liste açılır.
function MultiAssigneePicker({ team, selected, onChange }) {
  const T = useTheme();
  const [open, setOpen] = useState(false);
  function toggle(name) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  }
  const summary = selected.length === 0 ? "Atanmadı — havuzda bekliyor" : selected.length === 1 ? selected[0] : `${selected.length} kişi seçili`;
  return (
    <div>
      <button type="button" onClick={() => setOpen((s) => !s)} style={{
        width: "100%", boxSizing: "border-box", textAlign: "left", background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8,
        padding: "8px 10px", color: selected.length > 0 ? T.ink : T.dim, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
      }}>
        {summary}
      </button>
      {open && (
        <div style={{ marginTop: 4, border: `1px solid ${T.line}`, borderRadius: 8, maxHeight: 160, overflowY: "auto", background: T.surface }}>
          {team.length === 0 && <div style={{ padding: "8px 10px", fontSize: 12, color: T.dim }}>Bu departmanda personel yok.</div>}
          {team.map((p) => (
            <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", cursor: "pointer", borderBottom: `1px solid ${T.line}`, fontSize: 12.5, color: T.ink }}>
              <input type="checkbox" checked={selected.includes(p.name)} onChange={() => toggle(p.name)} />
              {p.name} · {p.role}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
