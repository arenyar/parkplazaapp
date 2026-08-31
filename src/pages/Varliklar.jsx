import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { T, PRIORITY_STYLES } from "../theme.js";
import { PageHeader, Card, Button, Select, Field, Input, TextArea, Pagination } from "../components/ui.jsx";
import { fmtDate } from "../lib/format.js";
import { ASSET_CATEGORIES } from "../mockData.js";
import { assetIconFor } from "../lib/assetIcons.js";
import { usePagination } from "../lib/usePagination.js";
import { findAssetLocations, locationLabel } from "../piramitData.js";

const STATUSES = ["Aktif", "Bakımda", "Arızalı", "Devre Dışı"];
const CRITICALITY = ["Düşük", "Orta", "Yüksek", "Kritik"];
function empty() { return { id: null, name: "", category: ASSET_CATEGORIES[0], location: "", model: "", serial: "", manufacturer: "", power: "", quantity: "", installDate: "", criticality: "Orta", status: "Aktif", notes: "", kw: "", kcalH: "", airflowM3h: "", dailyHours: "", expiryDate: "" }; }

export function Varliklar({ state, updateState, selectedId, onSelect, canWrite = true }) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(empty());
  const [filterCat, setFilterCat] = useState("");

  function startNew() { setForm(empty()); setFormOpen(true); onSelect(null); }
  function startEdit(a) { setForm({ ...a, kw: a.kw ?? "", kcalH: a.kcalH ?? "", airflowM3h: a.airflowM3h ?? "", dailyHours: a.dailyHours ?? "", expiryDate: a.expiryDate ?? "" }); setFormOpen(true); }
  function save() {
    if (!form.name.trim()) return;
    const id = form.id || `a_${Date.now()}`;
    const numOrNull = (v) => (v === "" || v == null ? null : Number(v));
    const payload = { ...form, id, kw: numOrNull(form.kw), kcalH: numOrNull(form.kcalH), airflowM3h: numOrNull(form.airflowM3h), dailyHours: numOrNull(form.dailyHours), expiryDate: form.expiryDate || null };
    const assets = form.id ? state.assets.map((a) => (a.id === id ? payload : a)) : [...state.assets, payload];
    updateState({ assets });
    setFormOpen(false);
  }
  function remove(id) {
    const a = state.assets.find((x) => x.id === id);
    if (!window.confirm(`"${a?.name || "Bu varlık"}" silinsin mi? Kayıt arşivlenecek, bağlı geçmiş kayıtlar (görev, doküman) etkilenmeyecek.`)) return;
    updateState({ assets: state.assets.map((x) => (x.id === id ? { ...x, archived: true, archivedAt: new Date().toISOString() } : x)) });
    if (selectedId === id) onSelect(null);
  }

  const filtered = (filterCat ? state.assets.filter((a) => a.category === filterCat) : state.assets).filter((a) => !a.archived);
  const { page, setPage, pageSize, setPageSize, startIndex } = usePagination(filtered.length, 30);
  useEffect(() => { setPage(1); }, [filterCat]); // eslint-disable-line react-hooks/exhaustive-deps
  const paged = filtered.slice(startIndex, startIndex + pageSize);
  const selected = state.assets.find((a) => a.id === selectedId);
  const linkedTasks = selected ? state.tasks.filter((t) => t.assetId === selected.id) : [];
  const linkedDocs = selected ? state.documents.filter((d) => d.linkedTo === selected.id) : [];
  const selectedLocations = selected ? findAssetLocations(state.piramitFloors, selected.id) : [];

  // Bu sayfadaki (mevcut sayfa) varlıklar kategoriye göre gruplanıyor — ayrı
  // bir gruplama verisi tutmuyoruz, sadece görünüm katmanında sıralanıyor.
  // Sayfalama düz listeye göre çalışmaya devam ediyor (grup sınırları
  // sayfalamayı bölmez, her sayfa içinde gruplar oluşur).
  const groups = [];
  const groupIndex = new Map();
  paged.forEach((a) => {
    if (!groupIndex.has(a.category)) { groupIndex.set(a.category, groups.length); groups.push({ category: a.category, items: [] }); }
    groups[groupIndex.get(a.category)].items.push(a);
  });

  return (
    <div>
      <PageHeader title="Varlıklar" subtitle={`${state.assets.length} kayıtlı ekipman`}
        right={<>
          <Select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}><option value="">Tüm kategoriler</option>{ASSET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
          {canWrite && <Button icon={Plus} onClick={startNew}>Yeni Varlık</Button>}
        </>} />

      {formOpen && canWrite && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            <Field label="Ad" required><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Kategori"><Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>{ASSET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Model"><Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} /></Field>
            <Field label="Seri No"><Input value={form.serial} onChange={(e) => setForm((f) => ({ ...f, serial: e.target.value }))} /></Field>
            <Field label="Üretici"><Input value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} /></Field>
            <Field label="Güç / Kapasite"><Input value={form.power} onChange={(e) => setForm((f) => ({ ...f, power: e.target.value }))} /></Field>
            <Field label="Adet"><Input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} /></Field>
            <Field label="Kritiklik"><Select value={form.criticality} onChange={(e) => setForm((f) => ({ ...f, criticality: e.target.value }))}>{CRITICALITY.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Durum"><Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>{STATUSES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Son Kullanma Tarihi"><Input type="date" value={form.expiryDate || ""} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} /></Field>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.3, margin: "4px 0" }}>Enerji Verileri — Enerji sayfasındaki analizde kullanılır</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            <Field label="Elektrik Gücü (kW)"><Input type="number" step="0.1" value={form.kw} onChange={(e) => setForm((f) => ({ ...f, kw: e.target.value }))} placeholder="Tüketim" /></Field>
            <Field label="Isı/Soğutma Kapasitesi (kcal/h)"><Input type="number" value={form.kcalH} onChange={(e) => setForm((f) => ({ ...f, kcalH: e.target.value }))} placeholder="Üretim" /></Field>
            <Field label="Hava Debisi (m³/h)"><Input type="number" value={form.airflowM3h} onChange={(e) => setForm((f) => ({ ...f, airflowM3h: e.target.value }))} placeholder="Taze hava" /></Field>
            <Field label="Günlük Çalışma Süresi (saat)"><Input type="number" step="0.5" value={form.dailyHours} onChange={(e) => setForm((f) => ({ ...f, dailyHours: e.target.value }))} /></Field>
          </div>
          <Field label="Not"><TextArea style={{ width: "100%", minHeight: 60 }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
          {form.id && (() => {
            const locs = findAssetLocations(state.piramitFloors, form.id);
            return (
              <div style={{ margin: "4px 0 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>Konum — Kat Planı</div>
                {locs.length === 0
                  ? <p style={{ fontSize: 12, color: T.dimmer, margin: 0 }}>Henüz bir kata/bölüme bağlanmamış. Kat Planı sekmesinden ilgili katın/bölümün ekipman listesine eklenebilir.</p>
                  : <p style={{ fontSize: 12.5, color: T.ink, margin: 0 }}>{locs.map((l) => locationLabel(l)).join(", ")} <span style={{ color: T.dimmer }}>— Kat Planı sekmesinden değiştirilir</span></p>}
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: 8 }}><Button onClick={save}>Kaydet</Button><Button variant="quiet" onClick={() => setFormOpen(false)}>Vazgeç</Button></div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1.3fr 1fr" : "1fr", gap: 16 }}>
        <div>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {groups.map((g) => (
            <div key={g.category}>
              <div style={{ padding: "9px 16px", background: T.surface2, borderBottom: `1px solid ${T.line}` }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#E0B354", textTransform: "uppercase", letterSpacing: 0.4 }}>{g.category}</span>
                <span style={{ fontSize: 10.5, color: T.dimmer, marginLeft: 8 }}>{g.items.length} kayıt</span>
              </div>
              {g.items.map((a) => {
                const crit = PRIORITY_STYLES[a.criticality] || {};
                const { icon: Icon, color: iconColor } = assetIconFor(a.category);
                const detailLine = [a.manufacturer, a.model].filter(Boolean).join(" · ");
                const maint = state.maintenance.find((m) => (m.assetIds || []).includes(a.id));
                const locs = findAssetLocations(state.piramitFloors, a.id);
                return (
                  <button key={a.id} onClick={() => onSelect(a.id)}
                    style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 16px", borderBottom: `1px solid ${T.line}`, boxSizing: "border-box", background: selectedId === a.id ? T.surface2 : "transparent" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${iconColor}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={16} color={iconColor} strokeWidth={1.8} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{a.quantity > 1 ? `${a.quantity} × ` : ""}{a.name}</div>
                      <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
                        {detailLine || "—"}
                        {" · "}
                        <span style={{ color: locs.length > 0 ? T.accent : T.dimmer }}>
                          Konum: {locs.length > 0 ? locs.map((l) => locationLabel(l)).join(", ") : "Kat Planı'na henüz bağlanmadı"}
                        </span>
                      </div>
                    </div>
                    <span style={{ background: crit.bg, color: crit.fg, fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: "2px 7px", flexShrink: 0 }}>{a.criticality}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: a.status === "Arızalı" ? "#E2685A" : a.status === "Bakımda" ? "#E0B354" : "#3FB37F", width: 62, flexShrink: 0 }}>{a.status}</span>
                    <span style={{ fontSize: 10, color: T.dimmer, width: 100, flexShrink: 0, textAlign: "right" }}>{maint ? `Bakım: ${maint.firma}` : a.id}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </Card>
        <Pagination page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} total={filtered.length} />
        </div>
        {selected && (() => {
          const { icon: SelIcon, color: selColor } = assetIconFor(selected.category);
          return (
          <Card style={{ alignSelf: "start" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 2 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${selColor}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <SelIcon size={20} color={selColor} strokeWidth={1.8} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.ink }}>{selected.name}</h3>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#E0B354", marginTop: 3, textTransform: "uppercase", letterSpacing: 0.3 }}>{selected.category}</div>
                </div>
              </div>
              {canWrite && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => startEdit(selected)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, padding: "5px 8px", cursor: "pointer", color: T.dim }}><Pencil size={13} /></button>
                <button onClick={() => remove(selected.id)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}><Trash2 size={13} color="#E2685A" /></button>
              </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: T.dimmer, margin: "8px 0 8px 52px", fontFamily: "ui-monospace, monospace" }}>{selected.id}</div>
            <div style={{ fontSize: 12.5, color: T.dim, lineHeight: 1.8 }}>
              <div>Model: <b style={{ color: T.ink }}>{selected.model || "—"}</b> · Seri: <b style={{ color: T.ink }}>{selected.serial || "—"}</b></div>
              <div>Üretici: <b style={{ color: T.ink }}>{selected.manufacturer || "—"}</b> · Kurulum: <b style={{ color: T.ink }}>{fmtDate(selected.installDate)}</b></div>
              <div>Güç/Kapasite: <b style={{ color: T.ink }}>{selected.power || "—"}</b> · Adet: <b style={{ color: T.ink }}>{selected.quantity ?? "—"}</b></div>
              {selected.category === "Yangın Söndürme Ekipmanı" && (
                <div>Son Kullanma Tarihi: <b style={{ color: selected.expiryDate && new Date(selected.expiryDate) < new Date() ? "#E2685A" : T.ink }}>{selected.expiryDate ? fmtDate(selected.expiryDate) : "—"}</b></div>
              )}
              {(selected.kw || selected.kcalH || selected.airflowM3h || selected.dailyHours) && (
                <div>
                  Enerji:{" "}
                  {selected.kw && <b style={{ color: T.ink }}>{selected.kw} kW</b>}
                  {selected.kcalH && <b style={{ color: T.ink }}>{selected.kw ? " · " : ""}{selected.kcalH.toLocaleString("tr-TR")} kcal/h</b>}
                  {selected.airflowM3h && <b style={{ color: T.ink }}>{(selected.kw || selected.kcalH) ? " · " : ""}{selected.airflowM3h.toLocaleString("tr-TR")} m³/h</b>}
                  {selected.dailyHours && <span style={{ color: T.dimmer }}> · {selected.dailyHours} sa/gün</span>}
                </div>
              )}
              {selected.notes && <div style={{ marginTop: 6 }}>{selected.notes}</div>}
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>Konum — Kat Planı ({selectedLocations.length})</div>
              {selectedLocations.length === 0 && <p style={{ fontSize: 12, color: T.dimmer }}>Henüz bir kata/bölüme bağlanmamış. Kat Planı sekmesinden bir bölüme/kata ekipman olarak eklenebilir.</p>}
              {selectedLocations.map((l, i) => (
                <div key={i} style={{ fontSize: 12, color: T.ink, padding: "5px 0", borderTop: `1px solid ${T.line}` }}>
                  {locationLabel(l)}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>Bağlı Görevler ({linkedTasks.length})</div>
              {linkedTasks.length === 0 && <p style={{ fontSize: 12, color: T.dimmer }}>Yok.</p>}
              {linkedTasks.map((t) => <div key={t.id} style={{ fontSize: 12, color: T.ink, padding: "5px 0", borderTop: `1px solid ${T.line}` }}>#{t.ticketNo} · {t.description}</div>)}
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", marginBottom: 6 }}>Dokümanlar ({linkedDocs.length})</div>
              {linkedDocs.length === 0 && <p style={{ fontSize: 12, color: T.dimmer }}>Yok.</p>}
              {linkedDocs.map((doc) => <div key={doc.id} style={{ fontSize: 12, color: T.ink, padding: "5px 0", borderTop: `1px solid ${T.line}` }}>{doc.name}</div>)}
            </div>
          </Card>
          );
        })()}
      </div>
    </div>
  );
}
