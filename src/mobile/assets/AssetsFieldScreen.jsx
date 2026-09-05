import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "../../lib/ThemeContext.jsx";
import { PageHeader, Card, Button, Field, Input, Select, TextArea } from "../../components/ui.jsx";
import { assetIdsForFloor, floorPhrase } from "../../piramitData.js";
import { assetIconFor } from "../../lib/assetIcons.js";

const STATUSES = ["Aktif", "Bakımda", "Arızalı", "Devre Dışı"];

// Kullanıcı teyidiyle: "teknikde varlıkları güncelleyebileceğimiz bir alan
// olsun... benim amacım sahada personel gezerken ilgili kattaki ekipmanı
// güncellesin... örnek jeneratör ile ilgili bilgileri güncellesin
// silemesin. burdaki amacım varlıkların seri no ve voltaj güclerini
// öğrenmek." — Kat Planı'ndaki (piramitData.js) GERÇEK ekipman-konum
// bağlantısını (assetIdsForFloor, findAssetLocations'ın tersi) kullanır;
// uydurma bir eşleme yok. Silme YOK (masaüstü Varlıklar.jsx'te zaten var,
// admin oradan siler); isim/kategori de sabit — sadece teknik detaylar
// (model/seri/üretici/güç/durum/not) güncellenebilir.
export function AssetsFieldScreen({ state, updateState, canWrite = true }) {
  const T = useTheme();
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);

  const floorLabels = state.piramitFloors.map((f) => f.label);

  function openAsset(a) {
    setEditing(a.id);
    setForm({ model: a.model || "", serial: a.serial || "", manufacturer: a.manufacturer || "", power: a.power || "", status: a.status || "Aktif", notes: a.notes || "" });
  }
  function save() {
    updateState({ assets: state.assets.map((a) => (a.id === editing ? { ...a, ...form } : a)) });
    setEditing(null);
    setForm(null);
  }

  // Adım 1 — Kat seç
  if (!selectedFloor) {
    return (
      <div>
        <PageHeader title="Varlıklar" subtitle="Önce kat seçin, ardından o kattaki ekipmanın bilgilerini güncelleyin" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {floorLabels.map((f) => {
            const count = assetIdsForFloor(state.piramitFloors, f).length;
            return (
              <div key={f} onClick={() => setSelectedFloor(f)}
                style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{floorPhrase(f)}</div>
                  <div style={{ fontSize: 11.5, color: T.dim }}>{count} ekipman</div>
                </div>
                <ChevronRight size={16} color={T.dimmer} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const floorAssets = assetIdsForFloor(state.piramitFloors, selectedFloor)
    .map((id) => state.assets.find((a) => a.id === id))
    .filter((a) => a && !a.archived);

  // Adım 2 — Katın ekipmanlarından birini seç / düzenle
  return (
    <div>
      <button onClick={() => { setSelectedFloor(null); setEditing(null); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: T.accent, fontSize: 12.5, fontWeight: 700, padding: 0, marginBottom: 10 }}>
        <ChevronLeft size={16} /> Kat Listesine Dön
      </button>
      <PageHeader title={floorPhrase(selectedFloor)} subtitle={`${floorAssets.length} ekipman`} />

      {floorAssets.length === 0 && <Card><p style={{ margin: 0, fontSize: 12.5, color: T.dim }}>Bu kata Kat Planı'ndan henüz ekipman bağlanmamış.</p></Card>}

      {floorAssets.map((a) => {
        const { icon: Icon, color: iconColor } = assetIconFor(a.category);
        const isEditing = editing === a.id;
        return (
          <Card key={a.id} style={{ marginBottom: 12 }}>
            <div onClick={() => (isEditing ? null : openAsset(a))} style={{ display: "flex", alignItems: "center", gap: 12, cursor: isEditing ? "default" : "pointer" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${iconColor}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={17} color={iconColor} strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: T.dim, marginTop: 2 }}>
                  {[a.manufacturer, a.model].filter(Boolean).join(" · ") || "Model/üretici girilmemiş"} · Seri: {a.serial || "—"} · Güç: {a.power || "—"}
                </div>
              </div>
              {!isEditing && <ChevronRight size={15} color={T.dimmer} />}
            </div>
            {isEditing && canWrite && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
                  <Field label="Model"><Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} /></Field>
                  <Field label="Seri No"><Input value={form.serial} onChange={(e) => setForm((f) => ({ ...f, serial: e.target.value }))} /></Field>
                  <Field label="Üretici"><Input value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))} /></Field>
                  <Field label="Güç / Voltaj / Kapasite"><Input value={form.power} onChange={(e) => setForm((f) => ({ ...f, power: e.target.value }))} placeholder="ör. 380V, 620 kVA" /></Field>
                  <Field label="Durum"><Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
                </div>
                <Field label="Not"><TextArea style={{ width: "100%", minHeight: 50 }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={save}>Kaydet</Button>
                  <Button variant="quiet" onClick={() => { setEditing(null); setForm(null); }}>Vazgeç</Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
