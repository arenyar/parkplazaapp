import { useState } from "react";
import { Plus, Trash2, X, Pencil } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Card, CardTitle, Button, Field, Input, Select, TextArea } from "../components/ui.jsx";
import { floorPhrase } from "../piramitData.js";
import { validateReading, latestReading } from "../lib/meterValidation.js";
import { buildMeterReadingTable } from "../lib/billing.js";

const TR_MONTHS_FULL = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function fullPeriodLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${TR_MONTHS_FULL[m - 1]} ${y}`;
}

const TABS = [
  { key: "genel", label: "Genel" },
  { key: "kompanzasyon", label: "Kompanzasyon Ölçümü" },
  { key: "su", label: "Su Okuma" },
  { key: "dogalgaz", label: "Doğalgaz Okuma" },
];

// Sayaçlar artık düz Kat/Blok seçimi yerine gerçek Mahal Kontrol konum
// kataloğundan seçilir — kullanıcı teyidiyle: "kat planında ilgili mahale
// eklemek isterdim. örnek 3b ısıtma odası. zemin kat bahçe gibi". Sadece
// isimli/somut mahalleri içerir: Teknik'in sabit teknik odaları (Isıtma
// Odası, Soğutma Odası, ADP Odası, Hidrofor Odası, Çatı Katı, Jeneratör/
// Yangın Pompası test noktaları) + Temizlik'in tek mahal kontrolündeki
// adlandırılmış konumları (Lobi, Bahçe, Teraslar, WC'ler). Güvenlik'in
// devriye noktaları ve yangın ekipmanı türetilmiş konumları hariç — hepsi
// "Devriye" gibi tekrarlayan, sayaç yeri olarak anlamsız isimler.
function catalogLabel(entry) {
  const floor = entry.floorLabel ? `${floorPhrase(entry.floorLabel)}${entry.side ? ` — ${entry.side}` : ""} — ` : "";
  return `${floor}${entry.room}`;
}
function meterLocationLabel(m) {
  if (m.room) return catalogLabel(m);
  if (m.floorLabel) return `${floorPhrase(m.floorLabel)}${m.side ? ` — ${m.side}` : ""}`;
  return "";
}

function buildMahalCatalog(mahalPoints) {
  const items = [];
  mahalPoints.forEach((point) => {
    if (point.department === "Teknik" && !point.perFloor) {
      items.push({ key: `pt_${point.id}`, dept: "Teknik", floorLabel: point.floorLabel, side: point.side, room: point.name });
    } else if (point.id === "mtd_temizlik") {
      (point.locations || []).forEach((loc) => {
        items.push({ key: `loc_${point.id}_${loc.key}`, dept: "Temizlik", floorLabel: loc.floorLabel, side: loc.side, room: loc.label });
      });
    }
  });
  return items;
}

function Sparkline({ data }) {
  const max = Math.max(...data.map((d) => d.kwh));
  const min = Math.min(...data.map((d) => d.kwh));
  const w = 600, h = 140, pad = 8;
  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d.kwh - min) / (max - min || 1)) * (h - pad * 2);
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const areaPath = `${path} L${pts[pts.length - 1][0]},${h - pad} L${pts[0][0]},${h - pad} Z`;
  const anomalyIdx = data.findIndex((d) => d.kwh === max);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id="egrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={T.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)} stroke={T.line} strokeWidth="1" />)}
      <path d={areaPath} fill="url(#egrad)" />
      <path d={path} fill="none" stroke={T.accent} strokeWidth="2" />
      <circle cx={pts[anomalyIdx][0]} cy={pts[anomalyIdx][1]} r="4" fill="#E08A3E" />
    </svg>
  );
}

function StatCard({ label, value, unit, sub }) {
  return (
    <Card>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>{value.toLocaleString("tr-TR")} <span style={{ fontSize: 13, color: T.dim, fontWeight: 600 }}>{unit}</span></div>
      {sub && <div style={{ fontSize: 11, color: T.dimmer, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

// Varlık kartlarındaki yapılandırılmış enerji alanlarından (bkz. mockData.js
// parsePower — gerçek Excel "power" metninden mekanik çıkarım, uydurma yok)
// binanın toplam elektrik yükü / ısıtma-soğutma kapasitesi / taze hava debisi
// hesaplanır. dailyHours girilen varlıklar için tahmini günlük/aylık kWh de
// eklenir — kaynakta çalışma saati olmadığı için bu alan varsayılan boş,
// Varlıklar sayfasından girilince burada otomatik hesaba katılır.
function EnergyFromAssets({ assets }) {
  const kwAssets = assets.filter((a) => a.kw);
  const kcalAssets = assets.filter((a) => a.kcalH);
  const airAssets = assets.filter((a) => a.airflowM3h);
  const hoursAssets = assets.filter((a) => a.kw && a.dailyHours);

  const totalKw = kwAssets.reduce((s, a) => s + a.kw, 0);
  const totalKcal = kcalAssets.reduce((s, a) => s + a.kcalH, 0);
  const totalAir = airAssets.reduce((s, a) => s + a.airflowM3h, 0);
  const dailyKwh = hoursAssets.reduce((s, a) => s + a.kw * a.dailyHours, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 16 }}>
        <StatCard label="Toplam Elektrik Yükü" value={totalKw} unit="kW" sub={`${kwAssets.length} varlıktan`} />
        <StatCard label="Isıtma / Soğutma Kapasitesi" value={totalKcal} unit="kcal/h" sub={`${kcalAssets.length} varlıktan (kazan, chiller, eşanjör)`} />
        <StatCard label="Taze Hava Debisi" value={totalAir} unit="m³/h" sub={`${airAssets.length} varlıktan — çoğu havalandırma ekipmanında debi verisi henüz girilmedi`} />
        <StatCard label="Tahmini Günlük Tüketim" value={Math.round(dailyKwh)} unit="kWh/gün" sub={hoursAssets.length > 0 ? `${hoursAssets.length} varlığın çalışma süresi girilmiş` : "Çalışma süresi girilen varlık yok — Varlıklar sayfasından ekleyin"} />
      </div>
      <p style={{ fontSize: 11.5, color: T.dimmer, margin: "0 0 4px" }}>
        Bu değerler Varlıklar sayfasındaki her ekipmanın Elektrik Gücü / Isı-Soğutma Kapasitesi / Hava Debisi / Günlük Çalışma Süresi alanlarından canlı hesaplanır — ayrı bir veri kopyası tutulmuyor.
      </p>
    </div>
  );
}

// Kompanzasyon panosunda ölçülen değerler Aktif Güç (kW) ve Reaktif Güç
// (kVAr)'dır — Görünür Güç (kVA) ve Güç Faktörü (cosφ) bunlardan hesaplanır,
// elle girilmez (S = √(P²+Q²), cosφ = P/S). BEDAŞ/dağıtım şirketleri genelde
// cosφ ≥ 0.95 şartı arar, altında kalanlar burada uyarı rengiyle işaretlenir.
function powerFactor(activeKw, reactiveKvar) {
  const apparentKva = Math.sqrt(activeKw * activeKw + reactiveKvar * reactiveKvar);
  return { apparentKva, cosPhi: apparentKva > 0 ? activeKw / apparentKva : 0 };
}

// İki ayrı kompanzasyon panosu var — kullanıcı teyidiyle: "kompanzasyon 2
// adet var" (ADP Odası Beşiktaş/mtd2 ve Sarıyer/mtd2b). Okumalar artık
// panoya göre (pointId) ayrılıyor — MeterLog'daki sayaç seçici ile aynı
// desen (chip'e tıkla, o panonun geçmişini gör).
function CompensationLog({ items, points, onAdd, onRemove, canWrite = true }) {
  const [activePointId, setActivePointId] = useState(points[0]?.id || null);
  const [form, setForm] = useState({ date: "", activeKw: "", reactiveKvar: "", note: "" });
  const filtered = items.filter((r) => (activePointId ? r.pointId === activePointId : !r.pointId));
  const sorted = [...filtered].sort((a, b) => (a.date < b.date ? 1 : -1));
  const canPreview = form.activeKw !== "" && form.reactiveKvar !== "";
  const preview = canPreview ? powerFactor(Number(form.activeKw), Number(form.reactiveKvar)) : null;

  return (
    <div>
      <PageHeader title="Kompanzasyon Ölçümü" subtitle={`${points.length} pano · ${items.length} kayıt — aktif ve reaktif güç girilir, görünür güç ve cosφ otomatik hesaplanır`} />
      {points.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {points.map((p) => (
            <button key={p.id} onClick={() => setActivePointId(p.id)}
              style={{ border: `1px solid ${activePointId === p.id ? T.accent : T.line}`, background: activePointId === p.id ? `${T.accent}22` : T.surface2, color: activePointId === p.id ? T.accent : T.ink, borderRadius: 999, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      <Card style={{ marginBottom: 16 }}>
        {activePointId && <div style={{ fontSize: 11, color: T.accent, marginBottom: 10 }}>Bu ölçüm ilgili panonun Mahal Kontrol'üne gömülü — kontrolü yapan personel checklist'i doldururken aktif/reaktif gücü de girebilir, burası manuel/geriye dönük giriş içindir.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          <Field label="Tarih"><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
          <Field label="Aktif Güç (kW)"><Input type="number" step="0.1" value={form.activeKw} onChange={(e) => setForm((f) => ({ ...f, activeKw: e.target.value }))} /></Field>
          <Field label="Reaktif Güç (kVAr)"><Input type="number" step="0.1" value={form.reactiveKvar} onChange={(e) => setForm((f) => ({ ...f, reactiveKvar: e.target.value }))} /></Field>
        </div>
        {preview && (
          <div style={{ display: "flex", gap: 20, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, color: T.dim }}>Görünür Güç: <b style={{ color: T.ink }}>{preview.apparentKva.toFixed(1)} kVA</b></span>
            <span style={{ fontSize: 12.5, color: T.dim }}>Cosφ: <b style={{ color: preview.cosPhi < 0.95 ? "#E0B354" : "#3FB37F" }}>{preview.cosPhi.toFixed(3)}</b></span>
          </div>
        )}
        <Field label="Not"><TextArea style={{ width: "100%", minHeight: 50 }} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
        <Button icon={Plus} onClick={() => {
          if (!form.date || !canPreview) return;
          onAdd({ date: form.date, activeKw: Number(form.activeKw), reactiveKvar: Number(form.reactiveKvar), note: form.note, pointId: activePointId });
          setForm({ date: "", activeKw: "", reactiveKvar: "", note: "" });
        }}>Kayıt Ekle</Button>
      </Card>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {sorted.length === 0 && <p style={{ fontSize: 12.5, color: T.dim, padding: 16 }}>Henüz kayıt yok.</p>}
        {sorted.map((r, i) => {
          const { apparentKva, cosPhi } = powerFactor(r.activeKw, r.reactiveKvar);
          return (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", borderBottom: i < sorted.length - 1 ? `1px solid ${T.line}` : "none", flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: T.dim, width: 90, flexShrink: 0 }}>{r.date}</div>
              <div style={{ flex: 1, fontSize: 12.5, color: T.ink, fontWeight: 600, minWidth: 220 }}>
                Aktif: {r.activeKw} kW · Reaktif: {r.reactiveKvar} kVAr · Görünür: {apparentKva.toFixed(1)} kVA
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "3px 9px", flexShrink: 0, color: cosPhi < 0.95 ? "#E0B354" : "#3FB37F", background: cosPhi < 0.95 ? "rgba(224,179,84,0.14)" : "rgba(63,179,127,0.14)" }}>
                Cosφ {cosPhi.toFixed(3)}
              </span>
              {r.note && <div style={{ fontSize: 11.5, color: T.dim, flex: 1, minWidth: 140 }}>{r.note}</div>}
              {canWrite && <button onClick={() => onRemove(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E2685A", flexShrink: 0 }}><Trash2 size={13} /></button>}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// Sayaç Okuma (Su/Doğalgaz ortak) — binada birden fazla sayaç olabileceği
// için okumalar tek bir listede değil, sayaç bazlı tutulur (meterId).
// Sayaçlar burada tanımlanır (kullanıcı genişletir) ve artık Kat Planı'ndaki
// gerçek bir kat/blokla ilişkilendirilebilir — kullanıcı teyidiyle: "birde
// sayaçları kat planına bağlayalım". Bilinmeyen konum uydurulmaz, sayaç
// "— Belirtilmedi —" ile konumsuz kalabilir (ör. WATER_METERS'daki "Ana
// Sayaç" — gerçek yeri elimizde yok).
// Sayaç Ekle formuyla, mevcut bir sayacı düzenlerken AYNI mahal listesi
// kullanılır — kullanıcı teyidiyle: "düzenleme yapamıyorum. mevcut gömülü
// olan mahali değiştirebilmeliyim".
function MahalSelect({ value, onChange, mahalCatalog }) {
  return (
    <Select value={value} onChange={onChange}>
      <option value="">Mahal yok / opsiyonel</option>
      <optgroup label="Teknik">
        {mahalCatalog.filter((c) => c.dept === "Teknik").map((c) => <option key={c.key} value={c.key}>{catalogLabel(c)}</option>)}
      </optgroup>
      <optgroup label="Temizlik">
        {mahalCatalog.filter((c) => c.dept === "Temizlik").map((c) => <option key={c.key} value={c.key}>{catalogLabel(c)}</option>)}
      </optgroup>
    </Select>
  );
}

// Kullanıcı teyidiyle: "sayaçları bölüm bazlı listeleyip exceldeki gibi ilk
// okuma son okuma göstermen lazım sayaç adı ocak şubat mart gibi
// dönemlerdeki son okuma verisi". Paylaştığı Excel ile aynı düzen: her sayaç
// bir satır (bölüme göre sıralı), her ay bir sütun, hücrede o ayın son
// okuması. Ay sütunları mevcut okuma verisinden otomatik türetilir.
function MeterReadingTable({ state, meters, valueField, unit }) {
  const { periods, rows } = buildMeterReadingTable(state, meters, valueField);
  if (rows.length === 0) return null;
  return (
    <Card style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.line}` }}>
        <CardTitle>Bölüm Bazlı Okuma Tablosu ({unit})</CardTitle>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
          <thead>
            <tr style={{ textAlign: "left", background: T.surface2 }}>
              <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase", whiteSpace: "nowrap" }}>Kat</th>
              <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase", whiteSpace: "nowrap" }}>Bölüm</th>
              <th style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase" }}>Firma / Sayaç</th>
              {periods.map((p) => (
                <th key={p.key} style={{ padding: "8px 10px", fontSize: 10.5, color: T.dim, textTransform: "uppercase", textAlign: "right", whiteSpace: "nowrap" }}>{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.meterId} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={{ padding: "6px 10px", color: T.dim, whiteSpace: "nowrap" }}>{r.floorLabel}</td>
                <td style={{ padding: "6px 10px", color: T.dim, whiteSpace: "nowrap" }}>{r.unitNo ?? "—"}</td>
                <td style={{ padding: "6px 10px", color: T.ink, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {r.tenant}
                  {r.tenant !== r.meterName && <span style={{ color: T.dimmer, fontWeight: 500 }}> · {r.meterName}</span>}
                </td>
                {r.values.map((v, i) => (
                  <td key={i} style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: v == null ? T.dimmer : T.ink }}>
                    {v == null ? "—" : v.toLocaleString("tr-TR")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MeterLog({ title, unit, valueField, meters, readings, mahalCatalog, thresholdPct, onAddMeter, onRemoveMeter, onUpdateMeter, onAdd, onRemove, canWrite = true }) {
  const [activeMeterId, setActiveMeterId] = useState(meters[0]?.id || null);
  const [newMeterName, setNewMeterName] = useState("");
  const [newMeterMahalKey, setNewMeterMahalKey] = useState("");
  const [newMeterInitial, setNewMeterInitial] = useState("");
  const [editingMeterId, setEditingMeterId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editMahalKey, setEditMahalKey] = useState("");
  const [form, setForm] = useState({ date: "", value: "", note: "" });

  function startEditMeter(m) {
    setEditingMeterId(m.id);
    setEditName(m.name);
    setEditMahalKey(m.mahalKey || "");
  }
  function saveEditMeter() {
    if (!editName.trim()) return;
    const entry = mahalCatalog.find((c) => c.key === editMahalKey);
    onUpdateMeter(editingMeterId, { name: editName.trim(), floorLabel: entry?.floorLabel || null, side: entry?.side || null, room: entry?.room || null, mahalKey: entry?.key || null });
    setEditingMeterId(null);
  }

  const currentMeter = meters.find((m) => m.id === activeMeterId) || meters[0] || null;
  const meterReadings = currentMeter ? readings.filter((r) => r.meterId === currentMeter.id).sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
  const withDelta = meterReadings.map((r, i) => {
    const older = meterReadings[i + 1];
    return { ...r, delta: older ? r[valueField] - older[valueField] : null };
  });

  return (
    <div>
      <PageHeader title={title} subtitle={`${meters.length} sayaç · ${readings.length} kayıt`} />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>Sayaçlar</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {meters.map((m) => (
            <span key={m.id} onClick={() => setActiveMeterId(m.id)}
              style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${currentMeter?.id === m.id ? T.accent : T.line}`, background: currentMeter?.id === m.id ? `${T.accent}22` : T.surface2, color: currentMeter?.id === m.id ? T.accent : T.ink, borderRadius: 999, padding: "6px 6px 6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              <span>
                {m.name}
                {(m.room || m.floorLabel) && <span style={{ display: "block", fontSize: 9.5, fontWeight: 600, opacity: 0.75 }}>{meterLocationLabel(m)}</span>}
              </span>
              {canWrite && <button onClick={(e) => { e.stopPropagation(); startEditMeter(m); }} title="Düzenle" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "inherit", opacity: 0.7 }}><Pencil size={12} /></button>}
              {canWrite && <button onClick={(e) => { e.stopPropagation(); onRemoveMeter(m.id); }} title="Sil" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "inherit", opacity: 0.7 }}><X size={12} /></button>}
            </span>
          ))}
          {meters.length === 0 && <span style={{ fontSize: 12.5, color: T.dim }}>Henüz sayaç tanımlanmadı.</span>}
        </div>

        {editingMeterId && canWrite && (
          <div style={{ background: T.surface2, border: `1px solid ${T.accent}`, borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>Sayacı Düzenle</div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.6fr", gap: 8, marginBottom: 8 }}>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Sayaç adı" />
              <MahalSelect value={editMahalKey} onChange={(e) => setEditMahalKey(e.target.value)} mahalCatalog={mahalCatalog} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={saveEditMeter}>Kaydet</Button>
              <Button variant="quiet" onClick={() => setEditingMeterId(null)}>Vazgeç</Button>
            </div>
          </div>
        )}

        {canWrite && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.6fr 0.8fr auto", gap: 8 }}>
          <Input value={newMeterName} onChange={(e) => setNewMeterName(e.target.value)} placeholder="Yeni sayaç adı (ör. Kule Sayacı)" />
          <MahalSelect value={newMeterMahalKey} onChange={(e) => setNewMeterMahalKey(e.target.value)} mahalCatalog={mahalCatalog} />
          <Input type="number" value={newMeterInitial} onChange={(e) => setNewMeterInitial(e.target.value)} placeholder={`İlk okuma (${unit}, ops.)`} />
          <Button variant="ghost" onClick={() => {
            if (!newMeterName.trim()) return;
            const entry = mahalCatalog.find((c) => c.key === newMeterMahalKey);
            onAddMeter(newMeterName.trim(), entry?.floorLabel || null, entry?.side || null, entry?.room || null, entry?.key || null, newMeterInitial === "" ? null : Number(newMeterInitial));
            setNewMeterName(""); setNewMeterMahalKey(""); setNewMeterInitial("");
          }}>Sayaç Ekle</Button>
        </div>
        )}
      </Card>

      {currentMeter ? (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 2 }}>{currentMeter.name} — Yeni Okuma</div>
            {(currentMeter.room || currentMeter.floorLabel) && <div style={{ fontSize: 11, color: T.dim, marginBottom: 2 }}>Konum: {meterLocationLabel(currentMeter)}</div>}
            {currentMeter.mahalKey && <div style={{ fontSize: 11, color: T.accent, marginBottom: 10 }}>Bu sayaç ilgili Mahal Kontrol'e gömülü — kontrolü yapan personel checklist'i doldururken okumayı da girebilir, burası manuel/geriye dönük giriş içindir.</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
              <Field label="Tarih"><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
              <Field label={`Sayaç Değeri (${unit})`}><Input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} /></Field>
            </div>
            <Field label="Not"><TextArea style={{ width: "100%", minHeight: 50 }} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
            {form.value !== "" && (() => {
              const previous = latestReading(readings, currentMeter.id, valueField);
              const check = validateReading(Number(form.value), previous, thresholdPct);
              return check.warning ? <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, color: check.blocked ? "#DC5A34" : "#B4551E" }}>{check.blocked ? "⛔" : "⚠"} {check.warning}</div> : null;
            })()}
            <Button icon={Plus} onClick={() => {
              if (!form.date || form.value === "") return;
              const previous = latestReading(readings, currentMeter.id, valueField);
              if (validateReading(Number(form.value), previous, thresholdPct).blocked) return;
              onAdd({ meterId: currentMeter.id, date: form.date, [valueField]: Number(form.value), note: form.note });
              setForm({ date: "", value: "", note: "" });
            }}>Kayıt Ekle</Button>
          </Card>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {withDelta.length === 0 && <p style={{ fontSize: 12.5, color: T.dim, padding: 16 }}>Bu sayaç için henüz kayıt yok.</p>}
            {withDelta.map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", borderBottom: i < withDelta.length - 1 ? `1px solid ${T.line}` : "none", flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: T.dim, width: 90, flexShrink: 0 }}>{r.date}</div>
                <div style={{ flex: 1, fontSize: 12.5, color: T.ink, fontWeight: 600, minWidth: 140 }}>{r[valueField].toLocaleString("tr-TR")} {unit}</div>
                {r.delta != null && <span style={{ fontSize: 11.5, color: T.accent, fontWeight: 700, flexShrink: 0 }}>+{r.delta.toLocaleString("tr-TR")} {unit} tüketim</span>}
                {r.note && <div style={{ fontSize: 11.5, color: T.dim, flex: 1, minWidth: 120 }}>{r.note}</div>}
                {canWrite && <button onClick={() => onRemove(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E2685A", flexShrink: 0 }}><Trash2 size={13} /></button>}
              </div>
            ))}
          </Card>
        </>
      ) : (
        <p style={{ fontSize: 12.5, color: T.dim }}>Önce yukarıdan bir sayaç ekleyin.</p>
      )}
    </div>
  );
}

export function Enerji({ state, updateState, canWrite = true }) {
  const [tab, setTab] = useState("genel");
  const { thisMonth, lastMonth } = state.energySummary;
  const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  const spikeDay = state.energyDaily.reduce((max, d) => (d.kwh > max.kwh ? d : max), state.energyDaily[0]);
  const mahalCatalog = buildMahalCatalog(state.mahalPoints);
  const compensationPoints = state.mahalPoints.filter((p) => p.compensation).map((p) => ({ id: p.id, label: p.name }));

  return (
    <div>
      <div style={{ background: "#0B1420", borderRadius: 14, padding: "16px 20px 18px", marginBottom: 18 }}>
        <h1 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700, color: "#fff" }}>Enerji</h1>
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

      {tab === "genel" && (
        <div>
          <PageHeader title="Genel" subtitle="Elektrik tüketimi — son 30 gün ve varlık bazlı enerji analizi" />
          <EnergyFromAssets assets={state.assets} />
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Card>
              <CardTitle>Günlük Tüketim (kWh)</CardTitle>
              <Sparkline data={state.energyDaily} />
            </Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card>
                <CardTitle>Bu Ay</CardTitle>
                <div style={{ fontSize: 26, fontWeight: 700, color: T.ink }}>{thisMonth.toLocaleString("tr-TR")} kWh</div>
                <div style={{ fontSize: 12.5, color: pct > 0 ? "#E08A3E" : "#3FB37F", marginTop: 4 }}>{pct > 0 ? "+" : ""}{pct}% geçen aya göre</div>
              </Card>
              <Card>
                <CardTitle>Anomali Tespiti</CardTitle>
                <p style={{ margin: 0, fontSize: 12.5, color: T.dim }}>
                  <b style={{ color: "#E08A3E" }}>{spikeDay.date}</b> tarihinde tüketim ortalamanın belirgin şekilde üzerinde — kontrol önerilir.
                </p>
              </Card>
            </div>
          </div>
        </div>
      )}

      {tab === "kompanzasyon" && (
        <CompensationLog items={state.compensationReadings.filter((r) => !r.archived)} points={compensationPoints} canWrite={canWrite}
          onAdd={(r) => updateState({ compensationReadings: [...state.compensationReadings, { id: `cmp_${Date.now()}`, ...r }] })}
          onRemove={(id) => { if (window.confirm("Bu kompanzasyon okumasını silmek istediğinize emin misiniz? Kayıt arşivlenecek.")) updateState({ compensationReadings: state.compensationReadings.map((r) => (r.id === id ? { ...r, archived: true, archivedAt: new Date().toISOString() } : r)) }); }}
        />
      )}

      {tab === "su" && (
        <>
        <MeterReadingTable state={state} meters={state.waterMeters.filter((m) => !m.archived)} valueField="meterM3" unit="m³" />
        <MeterLog title="Su Okuma" unit="m³" valueField="meterM3" meters={state.waterMeters.filter((m) => !m.archived)} readings={state.waterReadings.filter((r) => !r.archived)} mahalCatalog={mahalCatalog} thresholdPct={state.meterWarningThresholdPct} canWrite={canWrite}
          onAddMeter={(name, floorLabel, side, room, mahalKey, initialReading) => {
            const id = `wm_${Date.now()}`;
            const waterMeters = [...state.waterMeters, { id, name, floorLabel, side, room, mahalKey }];
            const waterReadings = initialReading != null ? [...state.waterReadings, { id: `wtr_${Date.now()}`, meterId: id, date: new Date().toISOString().slice(0, 10), meterM3: initialReading, note: "İlk okuma" }] : state.waterReadings;
            updateState({ waterMeters, waterReadings });
          }}
          onRemoveMeter={(id) => { if (window.confirm("Bu su sayacını silmek istediğinize emin misiniz? Sayaç arşivlenecek, geçmiş okumaları raporlarda kalmaya devam edecek.")) updateState({ waterMeters: state.waterMeters.map((m) => (m.id === id ? { ...m, archived: true, archivedAt: new Date().toISOString() } : m)) }); }}
          onUpdateMeter={(id, patch) => updateState({ waterMeters: state.waterMeters.map((m) => (m.id === id ? { ...m, ...patch } : m)) })}
          onAdd={(r) => updateState({ waterReadings: [...state.waterReadings, { id: `wtr_${Date.now()}`, ...r }] })}
          onRemove={(id) => { if (window.confirm("Bu okumayı silmek istediğinize emin misiniz? Kayıt arşivlenecek.")) updateState({ waterReadings: state.waterReadings.map((r) => (r.id === id ? { ...r, archived: true, archivedAt: new Date().toISOString() } : r)) }); }}
        />
        </>
      )}

      {tab === "dogalgaz" && (
        <>
        <MeterReadingTable state={state} meters={state.gasMeters.filter((m) => !m.archived)} valueField="value" unit="m³" />
        <MeterLog title="Doğalgaz Okuma" unit="m³" valueField="value" meters={state.gasMeters.filter((m) => !m.archived)} readings={state.gasReadings.filter((r) => !r.archived)} mahalCatalog={mahalCatalog} thresholdPct={state.meterWarningThresholdPct} canWrite={canWrite}
          onAddMeter={(name, floorLabel, side, room, mahalKey, initialReading) => {
            const id = `gm_${Date.now()}`;
            const gasMeters = [...state.gasMeters, { id, name, floorLabel, side, room, mahalKey }];
            const gasReadings = initialReading != null ? [...state.gasReadings, { id: `gr_${Date.now()}`, meterId: id, date: new Date().toISOString().slice(0, 10), value: initialReading, note: "İlk okuma" }] : state.gasReadings;
            updateState({ gasMeters, gasReadings });
          }}
          onRemoveMeter={(id) => { if (window.confirm("Bu doğalgaz sayacını silmek istediğinize emin misiniz? Sayaç arşivlenecek, geçmiş okumaları raporlarda kalmaya devam edecek.")) updateState({ gasMeters: state.gasMeters.map((m) => (m.id === id ? { ...m, archived: true, archivedAt: new Date().toISOString() } : m)) }); }}
          onUpdateMeter={(id, patch) => updateState({ gasMeters: state.gasMeters.map((m) => (m.id === id ? { ...m, ...patch } : m)) })}
          onAdd={(r) => updateState({ gasReadings: [...state.gasReadings, { id: `gr_${Date.now()}`, ...r }] })}
          onRemove={(id) => { if (window.confirm("Bu okumayı silmek istediğinize emin misiniz? Kayıt arşivlenecek.")) updateState({ gasReadings: state.gasReadings.map((r) => (r.id === id ? { ...r, archived: true, archivedAt: new Date().toISOString() } : r)) }); }}
        />
        </>
      )}
    </div>
  );
}
