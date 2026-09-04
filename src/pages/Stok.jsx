import { useState } from "react";
import { Plus, X, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { useTheme } from "../lib/ThemeContext.jsx";
import { PageHeader, Card, CardTitle, Button, Field, Input, Select } from "../components/ui.jsx";
import { recomputeStockLeaf, nextStockOrder, categoryPath } from "../lib/stock.js";
import { fmtDateTime } from "../lib/format.js";

const TABS = [
  { key: "kategoriler", label: "Kategoriler" },
  { key: "kalemler", label: "Stok Kalemleri" },
  { key: "hareketler", label: "Hareketler" },
];

// Kategori ağacı düğümü — Ayarlar.jsx'teki TaskTypeNode ile AYNI etkileşim
// deseni (satır içi yeniden adlandırma, "+ Alt" ile çocuk ekleme, sil),
// tekrar yazılmadı, sadece stockCategories'e uyarlandı.
function CategoryNode({ node, depth, categories, onAdd, onRemove, onRename, canWrite }) {
  const T = useTheme();
  const [addingChild, setAddingChild] = useState(false);
  const [childLabel, setChildLabel] = useState("");
  const children = categories.filter((c) => c.parentId === node.id).sort((a, b) => (a.order || 0) - (b.order || 0));

  function confirmAddChild() {
    if (!childLabel.trim()) return;
    onAdd(node.id, childLabel.trim());
    setChildLabel("");
    setAddingChild(false);
  }

  return (
    <div style={{ marginLeft: depth * 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
        <Input value={node.label} disabled={!canWrite} onChange={(e) => onRename(node.id, e.target.value)} style={{ flex: 1, fontSize: 12.5, padding: "6px 8px" }} />
        <span style={{ fontSize: 10, color: T.dimmer, flexShrink: 0 }}>{node.isLeaf ? "seçilebilir" : "kategori"}</span>
        {canWrite && (
          <>
            <button onClick={() => setAddingChild((s) => !s)} title="Alt kırılım ekle" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", color: T.accent, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>+ Alt</button>
            {depth > 0 && <button onClick={() => onRemove(node.id)} title="Sil" style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex", flexShrink: 0 }}><X size={14} /></button>}
          </>
        )}
      </div>
      {addingChild && (
        <div style={{ display: "flex", gap: 6, marginLeft: 18, marginTop: 6, marginBottom: 6 }}>
          <Input value={childLabel} onChange={(e) => setChildLabel(e.target.value)} placeholder="Alt kırılım adı… (ör. Klima Santrali, Aydınlatma)" style={{ flex: 1, fontSize: 12.5 }} autoFocus />
          <Button variant="ghost" onClick={confirmAddChild}>Ekle</Button>
        </div>
      )}
      {children.map((child) => (
        <CategoryNode key={child.id} node={child} depth={depth + 1} categories={categories} onAdd={onAdd} onRemove={onRemove} onRename={onRename} canWrite={canWrite} />
      ))}
    </div>
  );
}

function CategoriesTab({ state, updateState, canWrite }) {
  const T = useTheme();
  const categories = state.stockCategories || [];
  // Üç ana dal (Elektrik/Mekanik/İnşaat) SABİT kök — kullanıcı teyidiyle:
  // "elektrik mekanik inşaat olacak şekilde altında kırılımlanacak". Yeni
  // bir kök eklenmiyor, sadece bu üçünün altına serbestçe kırılım eklenir.
  const roots = categories.filter((c) => !c.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));

  function addCategory(parentId, label) {
    const id = `stc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const next = [...categories, { id, parentId: parentId || null, order: nextStockOrder(categories, parentId), label, isLeaf: true }];
    updateState({ stockCategories: recomputeStockLeaf(next) });
  }
  function removeCategory(id) {
    const toRemove = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      categories.forEach((c) => { if (c.parentId && toRemove.has(c.parentId) && !toRemove.has(c.id)) { toRemove.add(c.id); grew = true; } });
    }
    if ((state.stockItems || []).some((it) => toRemove.has(it.categoryId))) {
      window.alert("Bu kategoride (veya alt kırılımlarında) tanımlı stok kalemi var — önce onları başka bir kategoriye taşıyın veya silin.");
      return;
    }
    updateState({ stockCategories: recomputeStockLeaf(categories.filter((c) => !toRemove.has(c.id))) });
  }
  function renameCategory(id, label) {
    updateState({ stockCategories: categories.map((c) => (c.id === id ? { ...c, label } : c)) });
  }

  return (
    <Card>
      <CardTitle>Stok Kategorileri</CardTitle>
      <p style={{ fontSize: 11.5, color: T.dimmer, margin: "0 0 12px" }}>
        Elektrik / Mekanik / İnşaat sabit ana dallar — altlarına ekipman/malzeme kırılımı ekleyin (ör. Mekanik → Klima Santrali, Elektrik → Aydınlatma). Stok kalemleri en alttaki kırılıma bağlanır.
      </p>
      {roots.map((node) => (
        <CategoryNode key={node.id} node={node} depth={0} categories={categories} onAdd={addCategory} onRemove={removeCategory} onRename={renameCategory} canWrite={canWrite} />
      ))}
    </Card>
  );
}

const UNITS = ["adet", "metre", "kg", "litre", "paket", "kutu", "rulo"];

function ItemsTab({ state, updateState, canWrite }) {
  const T = useTheme();
  const categories = state.stockCategories || [];
  const items = state.stockItems || [];
  const leafCategories = categories.filter((c) => c.isLeaf);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", categoryId: "", unit: "adet", quantity: "", minQuantity: "" });
  const [categoryFilter, setCategoryFilter] = useState("");

  function startNew() { setEditingId(null); setForm({ name: "", categoryId: leafCategories[0]?.id || "", unit: "adet", quantity: "", minQuantity: "" }); setFormOpen(true); }
  function startEdit(it) { setEditingId(it.id); setForm({ name: it.name, categoryId: it.categoryId, unit: it.unit, quantity: String(it.quantity ?? ""), minQuantity: String(it.minQuantity ?? "") }); setFormOpen(true); }
  function save() {
    if (!form.name.trim() || !form.categoryId) return;
    const payload = { name: form.name.trim(), categoryId: form.categoryId, unit: form.unit, quantity: form.quantity === "" ? 0 : Number(form.quantity), minQuantity: form.minQuantity === "" ? 0 : Number(form.minQuantity) };
    if (editingId) updateState({ stockItems: items.map((it) => (it.id === editingId ? { ...it, ...payload } : it)) });
    else updateState({ stockItems: [...items, { id: `sti_${Date.now()}`, ...payload }] });
    setFormOpen(false);
  }
  function remove(id) {
    if (!window.confirm("Bu stok kalemini silmek istediğinize emin misiniz?")) return;
    updateState({ stockItems: items.filter((it) => it.id !== id) });
  }

  const filtered = categoryFilter ? items.filter((it) => it.categoryId === categoryFilter) : items;

  return (
    <div>
      <PageHeader title="Stok Kalemleri" subtitle={`${items.length} kalem`}
        right={canWrite && leafCategories.length > 0 && <Button icon={Plus} onClick={startNew}>Yeni Kalem</Button>} />
      {leafCategories.length === 0 && (
        <Card><p style={{ margin: 0, fontSize: 12.5, color: T.dim }}>Önce Kategoriler sekmesinden en az bir kırılım ekleyin (ör. Mekanik → Klima Santrali).</p></Card>
      )}
      {leafCategories.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ maxWidth: 320 }}>
            <option value="">Tüm kategoriler</option>
            {leafCategories.map((c) => <option key={c.id} value={c.id}>{categoryPath(categories, c.id)}</option>)}
          </Select>
        </div>
      )}

      {formOpen && canWrite && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            <Field label="Malzeme Adı"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ör. LED Ampul 12W" /></Field>
            <Field label="Kategori">
              <Select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
                {leafCategories.map((c) => <option key={c.id} value={c.id}>{categoryPath(categories, c.id)}</option>)}
              </Select>
            </Field>
            <Field label="Birim">
              <Select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
            <Field label="Miktar"><Input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} /></Field>
            <Field label="Kritik Seviye (opsiyonel)"><Input type="number" value={form.minQuantity} onChange={(e) => setForm((f) => ({ ...f, minQuantity: e.target.value }))} placeholder="Bu seviyenin altında uyarı gösterilir" /></Field>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Button onClick={save}>Kaydet</Button>
            <Button variant="quiet" onClick={() => setFormOpen(false)}>Vazgeç</Button>
          </div>
        </Card>
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 && <p style={{ margin: 0, padding: 16, fontSize: 12.5, color: T.dim }}>Henüz stok kalemi yok.</p>}
        {filtered.map((it, i) => {
          const low = it.minQuantity > 0 && it.quantity <= it.minQuantity;
          return (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${T.line}` : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}>
                  {it.name}
                  {low && <span title="Kritik seviyenin altında" style={{ display: "flex" }}><AlertTriangle size={13} color="#DC5A34" /></span>}
                </div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>{categoryPath(categories, it.categoryId)}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: low ? "#DC5A34" : T.ink, flexShrink: 0 }}>{it.quantity} {it.unit}</div>
              {canWrite && (
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => startEdit(it)} title="Düzenle" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.dim }}><Pencil size={13} /></button>
                  <button onClick={() => remove(it.id)} title="Sil" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={13} color="#E2685A" /></button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function MovementsTab({ state }) {
  const T = useTheme();
  const items = state.stockItems || [];
  const movements = [...(state.stockMovements || [])].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  const itemName = (id) => items.find((it) => it.id === id)?.name || id;

  return (
    <div>
      <PageHeader title="Hareketler" subtitle={`${movements.length} kayıt — bakım/arıza görevlerinde kullanılan malzemeler`} />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {movements.length === 0 && <p style={{ margin: 0, padding: 16, fontSize: 12.5, color: T.dim }}>Henüz malzeme kullanımı kaydedilmedi.</p>}
        {movements.map((m, i) => (
          <div key={m.id} style={{ padding: "10px 16px", borderBottom: i < movements.length - 1 ? `1px solid ${T.line}` : "none" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{itemName(m.itemId)} — {m.quantity} adet kullanıldı</div>
            <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
              {m.taskTicketNo ? `#${m.taskTicketNo} — ${m.taskDescription}` : "—"} · {m.by} · {fmtDateTime(m.at)}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// Stok modülü — kullanıcı teyidiyle: "bakımlarda kullanılan yedek parçalar...
// stok modülü kur". Üç sekme: Kategoriler (ağaç, Elektrik/Mekanik/İnşaat
// sabit kök), Stok Kalemleri (miktar takibi, kritik seviye uyarısı),
// Hareketler (hangi görevde ne kullanıldı — bkz. lib/stock.js
// consumeStockPatch, TaskForm.jsx'teki "Kullanılan Malzemeler" ile besleniyor).
export function Stok({ state, updateState, canWrite = true }) {
  const T = useTheme();
  const [tab, setTab] = useState("kategoriler");
  return (
    <div>
      <div style={{ background: "#0B1420", borderRadius: 14, padding: "16px 20px 18px", marginBottom: 18 }}>
        <h1 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: "#fff" }}>Stok</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TABS.map((tb) => (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              style={{ border: "none", borderRadius: 999, padding: "9px 18px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                background: tab === tb.key ? T.accent : "#fff", color: tab === tb.key ? "#0B1420" : "#132A20" }}>
              {tb.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "kategoriler" && <CategoriesTab state={state} updateState={updateState} canWrite={canWrite} />}
      {tab === "kalemler" && <ItemsTab state={state} updateState={updateState} canWrite={canWrite} />}
      {tab === "hareketler" && <MovementsTab state={state} />}
    </div>
  );
}
