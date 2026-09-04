import { useState } from "react";
import { X, Wrench, ClipboardCheck, Gauge, Droplet, Flame, Zap, Percent, Sparkles, ShieldCheck, AlertTriangle } from "lucide-react";
import { getLocations, runFor, hasNonConformity, resolveMeters, buildMahalFillPatch, startMahalRun, NonConformityPanel, FillModal } from "../../pages/MahalKontrol.jsx";
import { validateReading, latestReading } from "../../lib/meterValidation.js";
import { MAHAL_PERIODS } from "../../mockData.js";
import { TaskForm, emptyTask } from "../../components/TaskForm.jsx";
import { SectionHeader } from "./SectionHeader.jsx";
import { mobileTokens as t } from "../tokens.js";

// Kullanıcı teyidiyle: "mahal kontrollerin iconlarına teknik için teknik
// işareti temizlik için temizlik güvenlik için güvenlik işareti koy... ben bu
// çatıdaki herşeyi görmek isterim" — NavDrawer'daki (navConfig.js) departman
// ikonlarıyla AYNI (Wrench/Sparkles/ShieldCheck), tekrar uydurulmadı.
const DEPT_ICON = { Teknik: Wrench, Temizlik: Sparkles, Güvenlik: ShieldCheck };
const DUE_COLOR = "#3FB37F"; // t.ok ile aynı — kontrol bekliyor, "gidilebilir"
const NOT_DUE_COLOR = "#C0504D"; // Günlük'te: bu dönem zaten tamamlandı
const NOT_YET_COLOR = "#3B7FC9"; // Haftalık/Aylık'ta: kontrol günü henüz gelmedi

// Kullanıcı teyidiyle: "haftalık ve aylıkta kontrol günü gelince yeşil olsun
// gün gelmeden mavi olsun yanıp sönmesine gerek yok" — Günlük'ün aksine
// Haftalık/Aylık'ta "kontrol bekliyor" tek başına yetmez (periyot başından
// beri zaten pending'dir), asıl belirleyici point.scheduleDay'in (bkz.
// MahalKontrol.jsx scheduleLabel — "Her Cuma"/"Ayın 27'si") gelip gelmediği.
// scheduleDay hiç girilmemişse eskisi gibi sadece bekleyen olup olmadığına
// bakılır (uydurma bir varsayılan gün seçilmez).
const HAFTA_GUNLERI_ORDER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
function isScheduleDayReached(point, now) {
  if (!point.scheduleDay) return true;
  if (point.period === "Haftalık") {
    const todayIdx = (now.getDay() + 6) % 7; // getDay(): 0=Paz..6=Cmt -> 0=Pzt..6=Paz
    const targetIdx = HAFTA_GUNLERI_ORDER.indexOf(point.scheduleDay);
    return targetIdx === -1 ? true : todayIdx >= targetIdx;
  }
  if (point.period === "Aylık") {
    const targetDay = Number(point.scheduleDay);
    return Number.isFinite(targetDay) ? now.getDate() >= targetDay : true;
  }
  return true;
}

// Kullanıcı teyidiyle: "teknikte mahal kontrollerden sayaçları çıkar katlara
// sayaçları ekle... su sayaçlarını su işareti ile elektrikleri elektrik
// işareti ile göster" — sayaçlar artık Mahal Kontrol checklist'ine değil,
// doğrudan katına gömülü (bkz. mockData.js waterMeters/gasMeters/
// electricMeters'daki floorLabel/side). Su/Gaz/Elektrik AYNI desen
// (meters+readings, meterId ile ilişki, bkz. Enerji.jsx) — burada sadece tür
// başına ikon/renk ve hangi üst-seviye state alanına yazılacağı tanımlanır.
const METER_TYPES = [
  { type: "water", metersKey: "waterMeters", readingsKey: "waterReadings", valueField: "meterM3", unit: "m³", label: "Su Sayacı", icon: Droplet, color: "#3B7FC9", idPrefix: "wtr" },
  { type: "gas", metersKey: "gasMeters", readingsKey: "gasReadings", valueField: "value", unit: "m³", label: "Doğalgaz Sayacı", icon: Flame, color: "#C08A2E", idPrefix: "gr" },
  { type: "electric", metersKey: "electricMeters", readingsKey: "electricReadings", valueField: "value", unit: "kWh", label: "Elektrik Sayacı", icon: Zap, color: "#B5892E", idPrefix: "er" },
];

function metersForFloor(state, floorLabel) {
  const out = [];
  METER_TYPES.forEach((cfg) => {
    (state[cfg.metersKey] || []).filter((m) => !m.archived && m.floorLabel === floorLabel).forEach((m) => out.push({ cfg, meter: m }));
  });
  return out;
}

// Kompanzasyon artık Mahal Kontrol'den bağımsız, kendi katına bağlı bir kayıt
// — kullanıcı teyidiyle: "kompanzasyonlarıda ayrı belirt" (bkz. mockData.js
// COMPENSATION_PANELS).
function compensationPanelsForFloor(state, floorLabel) {
  return (state.compensationPanels || []).filter((p) => p.floorLabel === floorLabel);
}

// S = √(P²+Q²), cosφ = P/S — Enerji.jsx'teki powerFactor ile AYNI, kasıtlı
// küçük tekrar (o dosyanın kendi iç fonksiyonu, dışa aktarılmıyor).
function powerFactor(activeKw, reactiveKvar) {
  const apparentKva = Math.sqrt(activeKw * activeKw + reactiveKvar * reactiveKvar);
  return { apparentKva, cosPhi: apparentKva > 0 ? activeKw / apparentKva : 0 };
}

// Faz 5 — "Mahal ızgarası" (bkz. mobil-ui-prompt 6.6). Kontrol doldurma
// (FillModal/buildMahalFillPatch) ve arıza kaydı (TaskForm/emptyTask) TEK
// KAYNAK: MahalKontrol.jsx ile Kontroller.jsx'in kullandığı AYNI fonksiyon
// ve bileşenler — burada üçüncü bir kaydetme mantığı icat edilmedi.
function buildCells(points, state) {
  const cells = [];
  points.forEach((point) => {
    const locs = getLocations(point, state);
    if (locs.length === 0) {
      cells.push({ key: point.id, label: point.name, point, loc: null, floor: point.floorLabel || "Diğer" });
      return;
    }
    locs.forEach((loc) => {
      cells.push({ key: `${point.id}_${loc.key}`, label: loc.label, point, loc, floor: loc.floorLabel || "Diğer" });
    });
  });
  return cells.map((c) => {
    const nonconforming = hasNonConformity(c.point, state, c.loc?.key);
    const run = runFor(c.point, state.mahalRuns, c.loc?.key, null);
    const status = nonconforming ? "nonconforming" : run?.status === "Tamamlandı" ? "done" : "pending";
    return { ...c, status };
  });
}

// Kullanıcı teyidiyle: "temizlikte kat planına göre katları ekleyip
// belirttiğim şekilde yapmamışsın" — önceki sürüm SADECE Temizlik'in ZATEN
// bir mahal kontrol noktası tanımladığı katları gösteriyordu (o an 6 kat).
// Artık kat listesi Kat Planı'nın GERÇEK, tam kat listesinden (bkz.
// piramitData.js → state.piramitFloors — Operasyonlar > Kat Planı ile AYNI
// tek kaynak, PH'den 6B'ye TÜM bina) geliyor; henüz mahal kontrol noktası
// olmayan bir katta bile "Arıza İş Emri Aç" çalışır, sadece "Mahal Kontrol"
// kutusu (o katta hiç nokta yoksa) gizli kalır.
function groupByFloor(cells, allFloors) {
  const byFloor = new Map();
  cells.forEach((c) => { if (!byFloor.has(c.floor)) byFloor.set(c.floor, []); byFloor.get(c.floor).push(c); });
  const labels = allFloors && allFloors.length > 0 ? allFloors.map((f) => f.label) : [...byFloor.keys()];
  // Kat Planı etiketiyle eşleşmeyen (yazım farkı vb.) bir mahal noktası
  // varsa sessizce kaybolmasın diye listenin sonuna eklenir.
  const extra = [...byFloor.keys()].filter((floor) => !labels.includes(floor));
  return [...labels, ...extra].map((floor) => ({ floor, items: byFloor.get(floor) || [] }));
}

// Kullanıcı teyidiyle: "iş emri açarken kat bilgisi otomatik gelmeli ama
// katta ne yapıyor hangi ofis hangi mahal onları da seçmesi lazım" —
// Temizlik'in KENDİ mahal kontrol noktaları (WC/Teras gibi) çoğu katta hiç
// tanımlı değil (bkz. groupByFloor notu), o yüzden SADECE onlara dayanan
// bir seçici çoğu katta boş kalırdı. Gerçek "hangi ofis" (kiracı/malik) ve
// "hangi mahal" (Teknik Mahal, Yangın Dolabı, Kat Holü gibi ortak alanlar)
// bilgisi zaten Kat Planı'nda var (bkz. piramitData.js floor.units/
// teknikMahaller, Operasyonlar > Kat Planı ile AYNI kaynak) — burada
// TEKRAR uydurulmadı, doğrudan oradan okunuyor.
function buildFloorAddressOptions(piramitFloor) {
  if (!piramitFloor) return [];
  const options = [];
  (piramitFloor.units || []).forEach((u) => {
    if (u.tenants && u.tenants.length > 0) {
      u.tenants.forEach((name) => options.push({ key: `unit_${u.id}_${name}`, label: u.side ? `${name} — ${u.side}` : name, company: name }));
    } else if (u.owner) {
      options.push({ key: `unit_${u.id}_owner`, label: u.side ? `${u.owner} (Malik) — ${u.side}` : `${u.owner} (Malik)`, company: u.owner });
    }
  });
  (piramitFloor.teknikMahaller || []).forEach((m, i) => {
    options.push({ key: `teknik_${i}`, label: m.side ? `${m.label} — ${m.side}` : m.label, company: null });
  });
  return options;
}

// Kullanıcı teyidiyle: "tüm katları koyup akordion mantığı ile ilgili kata
// tıkla iki kutu olsun arıza iş emri aç anahtar ikonu diğeri katta mahal
// kontrol var ise cheklist ikonu" — Temizlik'te demo olarak başladı, sonra
// "aynı yapıyı teknik ve güvenliğede istiyorum" ile Teknik/Güvenlik'e de
// açıldı. Teknik'te ayrıca sayaç/kompanzasyon kutuları da olabildiğinden
// (bkz. MahalGridScreen), kutu sayısı artık sabit 2 değil — `tiles` bir
// dizi, sıra bozulmadan flex-wrap ile dizilir.
function FloorQuickActions({ tiles }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 16px" }}>
      <style>{"@keyframes ppMahalBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }"}</style>
      {tiles.map((tile) => (
        <button key={tile.key} onClick={tile.onClick} style={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", position: "relative", flex: "1 1 40%", minWidth: 120, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          padding: "14px 8px", borderRadius: 8, background: tile.bg, border: `1px solid ${t.hairline}`,
        }}>
          {tile.badge && (
            <span style={{ position: "absolute", top: 6, right: 6, width: 17, height: 17, borderRadius: "50%", background: "#fff", border: `1px solid ${t.hairline}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <tile.badge.icon size={9.5} color={tile.badge.color} />
            </span>
          )}
          <tile.icon size={20} color={tile.color} style={tile.blink ? { animation: "ppMahalBlink 1.4s ease-in-out infinite" } : undefined} />
          <span style={{ fontSize: 12, fontWeight: 700, color: t.ink, textAlign: "center" }}>{tile.label}</span>
        </button>
      ))}
    </div>
  );
}

const numberInputStyle = {
  boxSizing: "border-box", width: "100%", border: `1px solid ${t.hairline}`, borderRadius: 8, padding: "9px 10px", fontSize: 13.5, color: t.ink, background: t.surface,
};

// Kullanıcı teyidiyle: "katlara sayaçları ekle sayaçlar için görev yap" —
// katın hızlı aksiyon kutusundan açılan, o kattaki TÜM su/gaz/elektrik
// sayaçlarını (bkz. metersForFloor) tek seferde listeleyen bir alt sayfa.
// Su Okuma (SayacOkuma.jsx) ile AYNI doğrulama mantığı (validateReading) —
// azalan okuma engellenir, %eşik üstü artış uyarı verir.
function MeterReadingSheet({ target, state, onSave, onClose }) {
  const [entries, setEntries] = useState({});
  function setEntry(meterId, patch) {
    setEntries((e) => ({ ...e, [meterId]: { value: "", note: "", ...e[meterId], ...patch } }));
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "flex-end" }} role="dialog" aria-modal="true" aria-label="Sayaç Oku">
      <div style={{ position: "absolute", inset: 0, background: "rgba(20,49,40,0.45)" }} onClick={onClose} />
      <div style={{ position: "relative", width: "100%", maxWidth: 480, margin: "0 auto", maxHeight: "82vh", overflowY: "auto", background: t.surface, borderRadius: "16px 16px 0 0", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${t.hairline}` }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.ink }}>{target.group.floor} — Sayaç Oku</p>
          <button onClick={onClose} aria-label="Kapat" style={{ all: "unset", cursor: "pointer", color: t.muted, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><X size={20} aria-hidden="true" /></button>
        </div>
        {target.meters.map(({ cfg, meter }) => {
          const previous = latestReading(state[cfg.readingsKey] || [], meter.id, cfg.valueField);
          const entry = entries[meter.id] || { value: "", note: "" };
          const check = entry.value !== "" ? validateReading(Number(entry.value), previous, state.meterWarningThresholdPct) : null;
          return (
            <div key={meter.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${t.hairline}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <cfg.icon size={16} color={cfg.color} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{meter.name}{meter.side ? ` — ${meter.side}` : ""}</span>
              </div>
              <div style={{ fontSize: 11.5, color: t.muted, marginBottom: 8 }}>{previous != null ? `Önceki okuma: ${previous.toLocaleString("tr-TR")} ${cfg.unit}` : "Önceki okuma yok — ilk okuma girilecek."}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <input type="number" placeholder={`Değer (${cfg.unit})`} value={entry.value} onChange={(e) => setEntry(meter.id, { value: e.target.value })} style={{ ...numberInputStyle, flex: 1 }} />
                <button onClick={() => { if (entry.value === "" || check?.blocked) return; onSave(cfg, meter, entry.value, entry.note); setEntry(meter.id, { value: "", note: "" }); }}
                  disabled={entry.value === "" || check?.blocked}
                  style={{ all: "unset", cursor: entry.value === "" || check?.blocked ? "default" : "pointer", opacity: entry.value === "" || check?.blocked ? 0.4 : 1, background: t.pine, color: "#fff", fontSize: 12.5, fontWeight: 700, borderRadius: 8, padding: "9px 14px", flexShrink: 0 }}>
                  Kaydet
                </button>
              </div>
              {check?.warning && <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: check.blocked ? "#DC5A34" : "#B4551E" }}>{check.blocked ? "⛔" : "⚠"} {check.warning}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Kompanzasyon artık Mahal Kontrol'e gömülü değil — katın kendi hızlı
// aksiyonundan, Enerji > Kompanzasyon Ölçümü ile AYNI hesap (S=√(P²+Q²),
// cosφ=P/S) ile okunur.
function CompensationReadingSheet({ target, onSave, onClose }) {
  const [entries, setEntries] = useState({});
  function setEntry(panelId, patch) {
    setEntries((e) => ({ ...e, [panelId]: { activeKw: "", reactiveKvar: "", note: "", ...e[panelId], ...patch } }));
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "flex-end" }} role="dialog" aria-modal="true" aria-label="Kompanzasyon Ölçümü">
      <div style={{ position: "absolute", inset: 0, background: "rgba(20,49,40,0.45)" }} onClick={onClose} />
      <div style={{ position: "relative", width: "100%", maxWidth: 480, margin: "0 auto", maxHeight: "82vh", overflowY: "auto", background: t.surface, borderRadius: "16px 16px 0 0", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${t.hairline}` }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.ink }}>{target.group.floor} — Kompanzasyon</p>
          <button onClick={onClose} aria-label="Kapat" style={{ all: "unset", cursor: "pointer", color: t.muted, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><X size={20} aria-hidden="true" /></button>
        </div>
        {target.panels.map((panel) => {
          const entry = entries[panel.id] || { activeKw: "", reactiveKvar: "", note: "" };
          const canPreview = entry.activeKw !== "" && entry.reactiveKvar !== "";
          const preview = canPreview ? powerFactor(Number(entry.activeKw), Number(entry.reactiveKvar)) : null;
          return (
            <div key={panel.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${t.hairline}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Percent size={16} color="#7A5FB0" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>{panel.name}{panel.side ? ` — ${panel.side}` : ""}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input type="number" step="0.1" placeholder="Aktif Güç (kW)" value={entry.activeKw} onChange={(e) => setEntry(panel.id, { activeKw: e.target.value })} style={numberInputStyle} />
                <input type="number" step="0.1" placeholder="Reaktif Güç (kVAr)" value={entry.reactiveKvar} onChange={(e) => setEntry(panel.id, { reactiveKvar: e.target.value })} style={numberInputStyle} />
              </div>
              {preview && (
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: t.muted, marginBottom: 8 }}>
                  <span>Görünür Güç: <b style={{ color: t.ink }}>{preview.apparentKva.toFixed(1)} kVA</b></span>
                  <span>Cosφ: <b style={{ color: preview.cosPhi < 0.95 ? "#B4551E" : "#3FB37F" }}>{preview.cosPhi.toFixed(3)}</b></span>
                </div>
              )}
              <button onClick={() => { if (!canPreview) return; onSave(panel, entry.activeKw, entry.reactiveKvar, entry.note); setEntry(panel.id, { activeKw: "", reactiveKvar: "", note: "" }); }}
                disabled={!canPreview}
                style={{ all: "unset", cursor: canPreview ? "pointer" : "default", opacity: canPreview ? 1 : 0.4, display: "block", width: "100%", textAlign: "center", boxSizing: "border-box", background: t.pine, color: "#fff", fontSize: 12.5, fontWeight: 700, borderRadius: 8, padding: "10px 0" }}>
                Kaydet
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MahalGridScreen({ state, updateState, currentUserName, department, canWrite = true }) {
  const [fillTarget, setFillTarget] = useState(null);
  const [issueForm, setIssueForm] = useState(null);
  // Kullanıcı teyidiyle: "arıza kaydı açıldığında o kattaki mahalleri
  // seçenek olarak sunarsan adresleme süper olur" — katta birden fazla oda
  // varsa "hangi oda" seçici HEM Mahal Kontrol HEM Arıza için aynı sheet
  // (mode ile ayrılıyor, iki ayrı bileşen yazılmadı).
  const [roomPicker, setRoomPicker] = useState(null); // { group, mode: "kontrol" | "ariza" }
  const [openFloors, setOpenFloors] = useState(() => new Set());
  // Teknik'e özel — kullanıcı teyidiyle: "katlara sayaçları ekle... kompanzasyonlarıda ayrı belirt".
  const [meterTarget, setMeterTarget] = useState(null); // { group, meters }
  const [compTarget, setCompTarget] = useState(null); // { group, panels }
  // Kullanıcı teyidiyle: "mahal kontrollerde uygunsuzluk ve resim girilmişse
  // detayına girildiğinde resimle birlikte uygunsuzluğu pdf olarak
  // gösterebilirsin" — NonConformityPanel MahalKontrol.jsx ile PAYLAŞILIYOR.
  const [ncTarget, setNcTarget] = useState(null); // { point, location }

  // Mobilde tanım-dışı (admin'in "Mobilde gizli" işaretlediği) noktalar
  // gösterilmez — Teknik/Güvenlik/Temizlik sayfalarının mobileMode'uyla
  // AYNI kural (bkz. MahalKontrol.jsx `p.active !== false`).
  const points = state.mahalPoints.filter((p) => p.department === department && p.active !== false);
  const groups = groupByFloor(buildCells(points, state), state.piramitFloors);

  function toggleFloor(floor) {
    setOpenFloors((s) => { const next = new Set(s); next.has(floor) ? next.delete(floor) : next.add(floor); return next; });
  }
  // Kat seviyesinde hızlı aksiyonlar — belirli bir oda önceden seçilmeden.
  // Arıza: kat OTOMATİK gelir (group.floor), ama "hangi ofis / hangi mahal"
  // her zaman seçilir (kullanıcı teyidiyle: "kat bilgisi otomatik gelmeli
  // ama katta ne yapıyor hangi ofis hangi mahal onları da seçmesi lazım") —
  // seçenekler Temizlik'in kendi mahal kontrol noktaları VARSA onlar +
  // HER ZAMAN Kat Planı'ndaki gerçek kiracı/ortak alan listesi (bkz.
  // buildFloorAddressOptions). Mahal Kontrol ise SADECE Temizlik'in kendi
  // checklist noktalarına gider (Kat Planı'ndaki bir kiracı ofisi için
  // "kontrol" kavramı yok, sadece arıza/talep var).
  function openFloorIssueAt(group, addr) {
    const nextNo = Math.max(3100, ...state.tasks.map((tk) => tk.ticketNo || 0)) + 1;
    setIssueForm({
      ...emptyTask(department, nextNo),
      location: addr ? addr.label : group.floor,
      company: addr?.company || "",
      mahalPointId: addr?.point?.id || null,
      locationKey: addr?.loc?.key || null,
    });
    setRoomPicker(null);
  }
  function openFloorIssue(group) {
    const piramitFloor = state.piramitFloors.find((f) => f.label === group.floor);
    const addressOptions = [...group.items, ...buildFloorAddressOptions(piramitFloor)];
    if (addressOptions.length === 0) { openFloorIssueAt(group, null); return; }
    setRoomPicker({ group, mode: "ariza", addressOptions });
  }
  // Kullanıcı teyidiyle: "kendi iş başlatıp bitirebilmeli" — checklist'i
  // açar açmaz run hemen "Üzr. Çalışılıyor" olarak KAYDEDİLİR (startMahalRun);
  // FillModal kapatılıp tamamlanmasa bile bu "başladım" izi kalıcıdır,
  // submit (buildMahalFillPatch) aynı run'ı bulup TAMAMLAR.
  function startAndOpenFill(point, location) {
    updateState(startMahalRun(state, point, location, currentUserName));
    setFillTarget({ point, location });
  }
  // Kullanıcı teyidiyle: "teknikte özellikle katlardaki mahal kontrolleri
  // günlük ayrı haftalık ayrı aylık ayrı olarak aç" — tek "Mahal Kontrol"
  // kutusu yerine katta hangi periyotlar VARSA (bkz. buildTiles) o kadar ayrı
  // kutu; her kutu SADECE kendi periyodunun kalemlerini gösterir.
  function openFloorMahalKontrolPeriod(group, period, periodItems) {
    if (periodItems.length === 1) {
      const only = periodItems[0];
      // Uygunsuz bir tek kalem varsa direkt checklist'i yeniden açmak yerine
      // önce bilgi/PDF panelini göster (bkz. NonConformityPanel) — çok
      // kalemli katlarda aynı ayrım roomPicker satırındaki uyarı ikonuyla.
      if (only.status === "nonconforming") { setNcTarget({ point: only.point, location: only.loc }); return; }
      startAndOpenFill(only.point, only.loc);
      return;
    }
    setRoomPicker({ group, mode: "kontrol", items: periodItems, periodLabel: period });
  }
  function submitFill(payload) {
    updateState(buildMahalFillPatch(state, fillTarget.point, fillTarget.location, payload));
    setFillTarget(null);
  }
  function saveIssue() {
    if (!(issueForm.description || "").trim()) return;
    const id = `t_${Date.now()}`;
    const payload = { ...issueForm, id, createdAt: new Date().toISOString(), createdBy: currentUserName, updatedAt: new Date().toISOString(), updatedBy: currentUserName };
    updateState({ tasks: [...state.tasks, payload] });
    setIssueForm(null);
  }
  function saveMeterReading(cfg, meter, value, note) {
    const reading = { id: `${cfg.idPrefix}_${Date.now()}`, meterId: meter.id, date: new Date().toISOString().slice(0, 10), [cfg.valueField]: Number(value), note: note || `${currentUserName} — kat sayaç okuma` };
    updateState({ [cfg.readingsKey]: [...(state[cfg.readingsKey] || []), reading] });
  }
  function saveCompensation(panel, activeKw, reactiveKvar, note) {
    const reading = { id: `cmp_${Date.now()}`, date: new Date().toISOString().slice(0, 10), activeKw: Number(activeKw), reactiveKvar: Number(reactiveKvar), note: note || `${currentUserName} — kat kompanzasyon ölçümü`, pointId: panel.id };
    updateState({ compensationReadings: [...state.compensationReadings, reading] });
  }
  // Kat kartındaki hızlı aksiyon kutuları — Arıza her zaman, Mahal Kontrol
  // katta hangi periyot(lar) VARSA o kadar ayrı kutu (kullanıcı teyidiyle:
  // "teknikte özellikle katlardaki mahal kontrolleri günlük ayrı haftalık
  // ayrı aylık ayrı olarak aç"), Sayaç/Kompanzasyon SADECE Teknik'te.
  // Renk mantığı periyoda göre FARKLI (kullanıcı teyidiyle, iki ayrı tur):
  //  - Günlük: "zamanı gelmeyen icon kırmızı olsun, zamanı gelince yeşil
  //    olsun yanıp sönüyorsa olur" — her gün sıfırlandığı için "bekliyor mu"
  //    tek başına yeterli (KIRMIZI=bu gün tamam, YEŞİL+yanıp söner=bekliyor).
  //  - Haftalık/Aylık: "kontrol günü gelince yeşil olsun gün gelmeden mavi
  //    olsun yanıp sönmesine gerek yok" — dönem başından beri zaten
  //    "bekliyor" olduğundan tek başına yetmez, asıl belirleyici
  //    point.scheduleDay'in (bkz. isScheduleDayReached) gelip gelmediği
  //    (MAVİ=gün gelmedi, YEŞİL sabit=gün geldi, henüz yapılmadı).
  // Departman rozeti (bkz. DEPT_ICON) her kutunun köşesinde — "yönetici
  // olarak ben bu çatıdaki herşeyi görmek isterim" (hangi departmana ait
  // olduğu tek bakışta belli).
  function buildTiles(group) {
    const tiles = [{ key: "ariza", icon: Wrench, color: t.kiremit, bg: t.kiremitSoft, label: "Arıza İş Emri Aç", onClick: () => openFloorIssue(group) }];
    const deptIcon = DEPT_ICON[department];
    const badge = deptIcon ? { icon: deptIcon, color: t.pine } : null;
    const now = new Date();
    MAHAL_PERIODS.forEach((period) => {
      const periodItems = group.items.filter((c) => c.point.period === period);
      if (periodItems.length === 0) return;
      const needsAction = (c) => c.status === "pending" || c.status === "nonconforming";
      let due, color, bg, blink;
      if (period === "Haftalık" || period === "Aylık") {
        due = periodItems.some((c) => needsAction(c) && isScheduleDayReached(c.point, now));
        color = due ? DUE_COLOR : NOT_YET_COLOR;
        bg = due ? "rgba(63,179,127,0.12)" : "rgba(59,127,201,0.12)";
        blink = false;
      } else {
        due = periodItems.some(needsAction);
        color = due ? DUE_COLOR : NOT_DUE_COLOR;
        bg = due ? "rgba(63,179,127,0.12)" : "rgba(192,80,77,0.10)";
        blink = due;
      }
      tiles.push({
        key: `mahal_${period}`, icon: ClipboardCheck, badge, color, bg, blink,
        label: `${period} Kontrol`,
        onClick: () => openFloorMahalKontrolPeriod(group, period, periodItems),
      });
    });
    if (department === "Teknik") {
      const meters = metersForFloor(state, group.floor);
      if (meters.length > 0) {
        tiles.push({ key: "sayac", icon: Gauge, color: "#3B7FC9", bg: "#E7EFF7", label: "Sayaç Oku", onClick: () => setMeterTarget({ group, meters }) });
      }
      const panels = compensationPanelsForFloor(state, group.floor);
      if (panels.length > 0) {
        tiles.push({ key: "kompanzasyon", icon: Percent, color: "#7A5FB0", bg: "#EFEAF7", label: "Kompanzasyon", onClick: () => setCompTarget({ group, panels }) });
      }
    }
    return tiles;
  }

  if (issueForm) {
    return (
      <div style={{ padding: 16, background: t.ivory, minHeight: "100%" }}>
        <TaskForm form={issueForm} setForm={setIssueForm} departments={state.departments} types={state.taskTypes} team={state.team} onSave={saveIssue} onCancel={() => setIssueForm(null)} />
      </div>
    );
  }

  return (
    <div>
      {groups.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: t.ink }}>Bu bölümde mahal tanımı yok.</p>
        </div>
      ) : (
        groups.map((g) => {
          const expanded = openFloors.has(g.floor);
          return (
            <div key={g.floor}>
              <SectionHeader
                label={g.floor}
                done={g.items.filter((c) => c.status === "done").length}
                pending={g.items.filter((c) => c.status === "pending").length}
                nonConforming={g.items.filter((c) => c.status === "nonconforming").length}
                periods={[...new Set(g.items.map((c) => c.point.period).filter(Boolean))]}
                expanded={expanded}
                onToggle={() => toggleFloor(g.floor)}
              />
              {/* Kullanıcı teyidiyle: "bunlara gerek yok artık" (oda ızgarası
                  ekran görüntüsü) — kat açılınca artık sadece iki hızlı
                  aksiyon kutusu var, altındaki tek tek oda kartları (RoomGrid)
                  kaldırıldı; "hangi mahal?" seçimi zaten bu kutulardan
                  (roomPicker sheet) yapılıyor. */}
              {expanded && canWrite && (
                <FloorQuickActions tiles={buildTiles(g)} />
              )}
            </div>
          );
        })
      )}

      {roomPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "flex-end" }} role="dialog" aria-modal="true" aria-label="Hangi mahal?">
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,49,40,0.45)" }} onClick={() => setRoomPicker(null)} />
          <div style={{ position: "relative", width: "100%", maxWidth: 480, margin: "0 auto", maxHeight: "70vh", overflowY: "auto", background: t.surface, borderRadius: "16px 16px 0 0", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${t.hairline}` }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.ink }}>{roomPicker.group.floor}{roomPicker.periodLabel ? ` · ${roomPicker.periodLabel}` : ""} — hangi mahal?</p>
              <button onClick={() => setRoomPicker(null)} aria-label="Kapat" style={{ all: "unset", cursor: "pointer", color: t.muted, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><X size={20} aria-hidden="true" /></button>
            </div>
            {roomPicker.mode === "ariza" && (
              <>
                <button onClick={() => openFloorIssueAt(roomPicker.group, null)}
                  style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", minHeight: 48, padding: "12px 16px", fontSize: 14.5, color: t.muted, borderBottom: `1px solid ${t.hairline}` }}>
                  Genel (kat geneli, belirli bir mahal değil)
                </button>
                {roomPicker.addressOptions.map((addr) => (
                  <button key={addr.key} onClick={() => openFloorIssueAt(roomPicker.group, addr)}
                    style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", minHeight: 48, padding: "12px 16px", fontSize: 14.5, color: t.ink, borderBottom: `1px solid ${t.hairline}` }}>
                    {addr.label}
                  </button>
                ))}
              </>
            )}
            {roomPicker.mode === "kontrol" && (roomPicker.items || roomPicker.group.items).map((c) => (
              <div key={c.key} style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${t.hairline}` }}>
                <button onClick={() => startAndOpenFill(c.point, c.loc)}
                  style={{ all: "unset", cursor: "pointer", flex: 1, minWidth: 0, boxSizing: "border-box", minHeight: 48, padding: "12px 16px", fontSize: 14.5, color: t.ink }}>
                  {c.label}
                </button>
                {c.status === "nonconforming" && (
                  <button onClick={() => setNcTarget({ point: c.point, location: c.loc })} title="Uygunsuzluk bilgisi"
                    style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", padding: "0 16px", height: 48, color: "#DC5A34", flexShrink: 0 }}>
                    <AlertTriangle size={17} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {fillTarget && (
        <FillModal
          point={fillTarget.point} location={fillTarget.location} shift={null}
          meters={resolveMeters(state, fillTarget.point, fillTarget.location)} state={state}
          run={runFor(fillTarget.point, state.mahalRuns, fillTarget.location?.key, null)}
          team={state.team.filter((tm) => tm.department === department)} currentUser={currentUserName} assets={state.assets}
          onSubmit={submitFill} onClose={() => setFillTarget(null)}
        />
      )}

      {meterTarget && (
        <MeterReadingSheet target={meterTarget} state={state} onSave={saveMeterReading} onClose={() => setMeterTarget(null)} />
      )}

      {compTarget && (
        <CompensationReadingSheet target={compTarget} onSave={saveCompensation} onClose={() => setCompTarget(null)} />
      )}

      {ncTarget && (
        <NonConformityPanel point={ncTarget.point} location={ncTarget.location} state={state} onClose={() => setNcTarget(null)} />
      )}
    </div>
  );
}
