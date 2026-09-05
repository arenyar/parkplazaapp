import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Droplet } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Card, Button, Field, Input, TextArea } from "../components/ui.jsx";
import { floorPhrase } from "../piramitData.js";
import { validateReading, latestReading } from "../lib/meterValidation.js";
import { allUnits, metersForUnit, commonMetersForFloor, generateMeterId, unitDisplayName } from "../lib/billing.js";

function unitSubLabel(unit, floorLabel) {
  return `${floorPhrase(floorLabel)}${unit.side ? ` — ${unit.side}` : ""}${unit.no ? ` — No: ${unit.no}` : ""}`;
}

// Bağımsız bölüm sayaç okuma — mobil odaklı, kullanıcı teyidiyle: "bağımsız
// bölüm listelen bağımsız bölümdeki sayaçları seçer ve son okumayı girer...
// personel mobilden sayaç okurken ilgili bağımsız bölümü seçip sayacıda
// seçmesi lazım... sayaç listelemesi kat kat olsun gittiği kattaki sayaçlar
// listelensin". Akış üç adım: önce KAT (sahadaki personel hangi kata
// çıktıysa onu seçer), sonra o kattaki bağımsız bölüm, sonra sayaç/okuma.
// Sayaç TANIMLAMA (yeni sayaç ekleme) idari bir işlem — canWrite ile
// kapatılır (Enerji > Su Okuma ile aynı kural); OKUMA GİRME sahadaki
// personelin günlük operasyonel işi — Mahal Kontrol'deki checklist doldurma
// ile aynı mantıkla hep açık kalır.
export function SayacOkuma({ state, updateState, canWrite = true, mobileMode = false }) {
  const [query, setQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [activeMeterId, setActiveMeterId] = useState(null);
  const [newMeterName, setNewMeterName] = useState("");
  const [readingValue, setReadingValue] = useState("");
  const [readingNote, setReadingNote] = useState("");

  // Kullanıcı teyidiyle: "Teknikte sayaç okuma ekranı açtığında sadece
  // sayacı olan katlar gelecek" — mobilde (data-entry alanı) sayacı hiç
  // olmayan kat/bölümler listelenip kullanıcıyı çıkmaz sokağa sokmasın.
  // Masaüstünde (mobileMode=false, admin tanım/kontrol amaçlı) tüm liste
  // görünmeye devam eder.
  const allUnitsList = allUnits(state.piramitFloors);
  const units = mobileMode ? allUnitsList.filter(({ unit, floorId }) => metersForUnit(state.waterMeters, floorId, unit.id).length > 0) : allUnitsList;
  // Kullanıcı teyidiyle: "Sayaç okumada ortak alan sayacı olan katlar
  // gözüksün" — bir bağımsız bölüme değil doğrudan kata bağlı (ortak alan)
  // sayacı olan katlar da listeye girer, sadece bölüm sayaçlı katlar değil.
  const commonFloorLabels = [...new Set((state.waterMeters || []).filter((m) => !m.archived && !m.unitRef && m.floorLabel).map((m) => m.floorLabel))];
  const floorLabels = [];
  units.forEach(({ floorLabel }) => { if (!floorLabels.includes(floorLabel)) floorLabels.push(floorLabel); });
  commonFloorLabels.forEach((f) => { if (!floorLabels.includes(f)) floorLabels.push(f); });
  const todayStr = new Date().toISOString().slice(0, 10);

  // Adım 1 — Kat seç
  if (!selectedFloor) {
    const q = query.trim().toLowerCase();
    const filteredFloors = q ? floorLabels.filter((f) => `${f} ${floorPhrase(f)}`.toLowerCase().includes(q)) : floorLabels;
    return (
      <div>
        <PageHeader title="Sayaç Okuma" subtitle="Önce kat seçin, ardından o kattaki bağımsız bölüm ve sayacı seçip son okumayı girin" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kat ara..." style={{ width: "100%", marginBottom: 12 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredFloors.map((f) => {
            const count = units.filter((u) => u.floorLabel === f).length;
            return (
              <div key={f} onClick={() => { setSelectedFloor(f); setQuery(""); }}
                style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{floorPhrase(f)}</div>
                  <div style={{ fontSize: 11.5, color: T.dim }}>{count} bağımsız bölüm</div>
                </div>
                <ChevronRight size={16} color={T.dimmer} />
              </div>
            );
          })}
          {filteredFloors.length === 0 && <p style={{ fontSize: 12.5, color: T.dim }}>Eşleşen kat yok.</p>}
        </div>
      </div>
    );
  }

  // Adım 2 — Katın bağımsız bölümlerinden birini (veya ortak alanı) seç
  if (!selected) {
    const floorUnits = units.filter((u) => u.floorLabel === selectedFloor);
    const commonMeters = commonMetersForFloor(state.waterMeters, selectedFloor);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? floorUnits.filter(({ unit }) => `${unitDisplayName(unit, state.companies)} ${unit.no ?? ""}`.toLowerCase().includes(q))
      : floorUnits;
    return (
      <div>
        <button onClick={() => { setSelectedFloor(null); setQuery(""); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: T.accent, fontSize: 12.5, fontWeight: 700, padding: 0, marginBottom: 10 }}>
          <ChevronLeft size={16} /> Kat Listesine Dön
        </button>
        <PageHeader title={floorPhrase(selectedFloor)} subtitle="Bağımsız bölüm seçin" />
        {commonMeters.length > 0 && (
          <div onClick={() => { setSelected({ unit: null, floorId: null, floorLabel: selectedFloor, common: true }); setQuery(""); setActiveMeterId(null); setReadingValue(""); setReadingNote(""); }}
            style={{ background: `${T.accent}14`, border: `1px solid ${T.accent}`, borderRadius: 14, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>Ortak Alan (Kat Geneli)</div>
              <div style={{ fontSize: 11.5, color: T.dim }}>Belirli bir bağımsız bölüme değil, katın ortak alanına ait sayaçlar</div>
            </div>
            <div style={{ fontSize: 11, color: T.accent, fontWeight: 700, whiteSpace: "nowrap" }}>{commonMeters.length} sayaç</div>
          </div>
        )}
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kiracı adına göre ara..." style={{ width: "100%", marginBottom: 12 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(({ unit, floorId, floorLabel }) => {
            const meterCount = metersForUnit(state.waterMeters, floorId, unit.id).length;
            return (
              <div key={unit.id} onClick={() => { setSelected({ unit, floorId, floorLabel }); setQuery(""); setActiveMeterId(null); setReadingValue(""); setReadingNote(""); }}
                style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{unitDisplayName(unit, state.companies)}</div>
                  <div style={{ fontSize: 11.5, color: T.dim }}>{unitSubLabel(unit, floorLabel)}</div>
                </div>
                <div style={{ fontSize: 11, color: meterCount > 0 ? T.accent : T.dimmer, fontWeight: 700, whiteSpace: "nowrap" }}>{meterCount} sayaç</div>
              </div>
            );
          })}
          {filtered.length === 0 && commonMeters.length === 0 && <p style={{ fontSize: 12.5, color: T.dim }}>Eşleşen bağımsız bölüm yok.</p>}
        </div>
      </div>
    );
  }

  // Adım 3 — Sayaç seç, okuma gir
  const { unit, floorId, floorLabel, common } = selected;
  const meters = common ? commonMetersForFloor(state.waterMeters, floorLabel) : metersForUnit(state.waterMeters, floorId, unit.id);
  const currentMeter = meters.find((m) => m.id === activeMeterId) || null;
  const previous = currentMeter ? latestReading(state.waterReadings, currentMeter.id, "meterM3") : null;
  const check = currentMeter && readingValue !== "" ? validateReading(Number(readingValue), previous, state.meterWarningThresholdPct) : null;
  const nextGeneratedId = common ? `SU_${floorLabel}_ORTAK` : generateMeterId(state.waterMeters, floorLabel, unit.side, unit.no);

  // Ortak alan seçiliyken (unit yok) buradan yeni sayaç eklenmez — ortak
  // alan sayaçları zaten Enerji > Su Okuma'dan (unitRef'siz, bkz. Enerji.jsx
  // onAddMeter) tanımlanıyor; bu form sadece BAĞIMSIZ BÖLÜM sayacı ekler.
  function addMeter() {
    if (common) return;
    const meter = { id: nextGeneratedId, name: newMeterName.trim() || `Su Sayacı${meters.length > 0 ? ` ${meters.length + 1}` : ""}`, floorLabel, side: unit.side, room: null, mahalKey: null, unitRef: { floorId, unitId: unit.id } };
    updateState({ waterMeters: [...state.waterMeters, meter] });
    setNewMeterName("");
    setActiveMeterId(meter.id);
  }

  function saveReading() {
    if (!currentMeter || readingValue === "") return;
    if (validateReading(Number(readingValue), previous, state.meterWarningThresholdPct).blocked) return;
    const reading = { id: `wtr_${Date.now()}`, meterId: currentMeter.id, date: new Date().toISOString().slice(0, 10), meterM3: Number(readingValue), note: readingNote };
    updateState({ waterReadings: [...state.waterReadings, reading] });
    setReadingValue(""); setReadingNote("");
  }

  return (
    <div>
      <button onClick={() => setSelected(null)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: T.accent, fontSize: 12.5, fontWeight: 700, padding: 0, marginBottom: 10 }}>
        <ChevronLeft size={16} /> {floorPhrase(selectedFloor)} Bölümlerine Dön
      </button>
      <PageHeader title={common ? "Ortak Alan (Kat Geneli)" : unitDisplayName(unit, state.companies)} subtitle={common ? floorPhrase(floorLabel) : unitSubLabel(unit, floorLabel)} />

      <div style={{ fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>Sayaçlar</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {meters.map((m) => {
          const last = latestReading(state.waterReadings, m.id, "meterM3");
          // Kullanıcı teyidiyle: "onlar hergün okunacak şekilde görev olsun"
          // — tam bir Mahal Kontrol tipi periyodik görev altyapısı kurmadan,
          // en somut karşılığı: bugün henüz okunmamışsa açıkça uyarı rozeti.
          const readToday = state.waterReadings.some((r) => r.meterId === m.id && !r.archived && r.date === todayStr);
          return (
            <button key={m.id} onClick={() => { setActiveMeterId(m.id); setReadingValue(""); setReadingNote(""); }}
              style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${activeMeterId === m.id ? T.accent : T.line}`, background: activeMeterId === m.id ? `${T.accent}22` : T.surface2, color: activeMeterId === m.id ? T.accent : T.ink, borderRadius: 999, padding: "8px 14px", cursor: "pointer", textAlign: "left" }}>
              <Droplet size={13} style={{ flexShrink: 0 }} />
              <span>
                <span style={{ fontSize: 12.5, fontWeight: 700, display: "block" }}>{m.name} <span style={{ opacity: 0.65, fontWeight: 600 }}>({m.id})</span></span>
                <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, display: "block" }}>
                  {last != null ? `Son okuma: ${last.toLocaleString("tr-TR")} m³` : "Henüz okuma yok"}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 800, display: "block", color: readToday ? "#4E8A46" : "#DC5A34" }}>
                  {readToday ? "✓ Bugün okundu" : "⚠ Bugün henüz okunmadı"}
                </span>
              </span>
            </button>
          );
        })}
        {meters.length === 0 && <span style={{ fontSize: 12.5, color: T.dim }}>Bu bölüm için henüz sayaç tanımlanmadı.</span>}
      </div>

      {canWrite && !mobileMode && !common && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <Input value={newMeterName} onChange={(e) => setNewMeterName(e.target.value)} placeholder="Yeni sayaç adı (ops., ör. Su Sayacı 2)" />
            <Button variant="ghost" icon={Plus} onClick={addMeter}>Sayaç Ekle</Button>
          </div>
          <div style={{ fontSize: 11, color: T.dimmer, marginTop: 6 }}>Sayaç no otomatik oluşturulur: <b>{nextGeneratedId}</b></div>
        </Card>
      )}
      {canWrite && !mobileMode && common && (
        <p style={{ fontSize: 11.5, color: T.dimmer, margin: "0 0 14px" }}>Ortak alan sayaçları buradan eklenmez — Enerji &gt; Su Okuma sekmesinden tanımlayın.</p>
      )}

      {currentMeter && (
        <Card>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 4 }}>{currentMeter.name} — Son Okuma</div>
          <div style={{ fontSize: 11.5, color: T.dim, marginBottom: 10 }}>{previous != null ? `Önceki okuma: ${previous.toLocaleString("tr-TR")} m³` : "Önceki okuma yok — ilk okuma girilecek."}</div>
          <Field label="Sayaç Değeri (m³)"><Input type="number" value={readingValue} onChange={(e) => setReadingValue(e.target.value)} /></Field>
          <Field label="Not"><TextArea style={{ width: "100%", minHeight: 44 }} value={readingNote} onChange={(e) => setReadingNote(e.target.value)} /></Field>
          {check?.warning && <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, color: check.blocked ? "#DC5A34" : "#B4551E" }}>{check.blocked ? "⛔" : "⚠"} {check.warning}</div>}
          <Button icon={Plus} onClick={saveReading}>Okumayı Kaydet</Button>
        </Card>
      )}
    </div>
  );
}
