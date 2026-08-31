import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Plus, Pencil, Trash2, QrCode, Camera, X, ClipboardCheck, AlertTriangle } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Card, Button, Select, Input, Field, TextArea } from "../components/ui.jsx";
import { TaskList } from "../components/TaskList.jsx";
import { TaskForm } from "../components/TaskForm.jsx";
import { periodKey } from "../lib/periods.js";
import { validateReading, latestReading } from "../lib/meterValidation.js";
import { MAHAL_PERIODS, TALEP_TYPES } from "../mockData.js";
import { locationLabel, collectFireEquipmentLocations, floorPhrase, firmsAtFloorSide } from "../piramitData.js";
import { EQUIPMENT_TASK_TEMPLATES } from "../lib/taskTemplates.js";

function emptyPoint(department) {
  return { id: null, department, role: "", name: "", assetId: "", assetDesc: "", period: "Aylık", scheduleDay: "", shifts: [], questions: [{ text: "", failOn: "Hayır" }] };
}

// Teknik departmanı Elektrik ve Mekanik personeli için ayrı checklist görür
// (kullanıcı teyidiyle: "Elektrik Personeli için Ayrı Teknik Personel İçin
// ayrı") — mahalPoints kaydındaki role alanına göre filtrelenir.
const MAHAL_ROLES = ["Elektrik", "Mekanik"];

// Haftalık/aylık kontrollerin hangi gün yapılacağını seçebilmek için —
// kullanıcı teyidiyle: "mahal kontrrollerde ayın hangi günü yada haftanın
// hangi günü onu seçebilmem lazım". Salt bilgilendirici/planlama alanı;
// periyodun tamamlanma penceresini (periodKey) değiştirmez.
const HAFTA_GUNLERI = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const AY_GUNLERI = Array.from({ length: 31 }, (_, i) => i + 1);

// Vardiyalı noktalarda (bkz. point.shifts) bir vardiya saati gelmeden
// personel o vardiyayı başlatamaz — kullanıcı teyidiyle: "vardiyalarda
// saati gelmeden devriye turu gözükmesin örnek 14 vardiyası 13:30 da
// görünür olsun" (14:00 vardiyası 30 dk önceden, 13:30'da açılıyor). Vardiya
// saatine ulaşana kadar o vardiyanın rozeti/butonu HİÇ render edilmiyor —
// mahal listesindeki her yerde bu filtre kullanılır (bkz. PerFloorCard,
// Kontroller.jsx PointRow), tek kaynak.
const SHIFT_VISIBILITY_LEAD_MINUTES = 30;
export function isShiftVisible(shift, now) {
  if (!shift.start) return true;
  const [h, m] = shift.start.split(":").map(Number);
  const startMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= startMinutes - SHIFT_VISIBILITY_LEAD_MINUTES;
}

// Sayfa açık kalırken vardiya saati gelince rozet otomatik belirsin diye
// (yeniden yükleme/gezinme beklemeden) — 30 saniyede bir "şimdi"yi tazeler.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// perFloor noktalarda konum listesi ya statik (point.locations) ya da Kat
// Planı'ndan canlı türetilir (point.deriveLocations) — kullanıcı teyidiyle:
// "yangın kontrolü kat yazmışsın ancak o katta ne olduğu kat planında mevcut
// ona göre yapmalısın", bu yüzden statik bir liste yerine state.piramitFloors
// üzerinden her render'da güncel hesaplanır.
export function getLocations(point, state) {
  let locations;
  if (point.locations) locations = point.locations;
  else if (point.deriveLocations === "fireEquipment") locations = collectFireEquipmentLocations(state.piramitFloors, state.assets);
  else return [];
  // Güvenlik devriyesine Kat Planı'ndaki gerçek firma isimleri eklenir —
  // kullanıcı teyidiyle: "Güvenlik Devriye için Kat Planında hangi firmalar
  // var görebilirsin ordan verileri al eklemeyi yap". Canlı hesaplanır (Kat
  // Planı'ndaki malik/kiracı değişince burası da güncellenir).
  if (point.enrichWithFirms) {
    locations = locations.map((loc) => ({ ...loc, firms: firmsAtFloorSide(state.piramitFloors, loc.floorLabel, loc.side) }));
  }
  return locations;
}

// Kullanıcı teyidiyle: "haftalıkta hangi gün seçilmişse her cuma gibi
// aylıkta hangi gün girilmişse ayın 27 si gibi uyarı olmalı" — mahal listesi
// filtrelenip zamanı gelmeyen işler gizlenmiyor (bu daha riskli — henüz
// vakti gelmemiş ama gecikmiş bir işi yanlışlıkla saklayabilir), bunun
// yerine her haftalık/aylık noktanın YANINDA ne zaman yapılacağı okunaklı
// yazıyor.
export function scheduleLabel(point) {
  if (!point.scheduleDay) return "";
  if (point.period === "Haftalık") return ` · Her ${point.scheduleDay}`;
  if (point.period === "Aylık") return ` · Ayın ${point.scheduleDay}'i`;
  return "";
}

// locationKey verilmemişse (perFloor olmayan noktalar) run.locationKey da
// boş olmalı — aksi halde perFloor bir noktanın konumlarından biriyle
// yanlışlıkla eşleşebilir. shiftId de aynı mantıkla: günde birden fazla
// vardiyası olan noktalarda (bkz. point.shifts, ör. Güvenlik Devriyesi
// gündüz/gece) her vardiyanın kendi run kaydı var — kullanıcı teyidiyle:
// "gündüz vardiyası 14:00 ile 18:00 da gece vardiyası 22:00 ile 04:00 da
// gibi devriye saatleri değiştirilebilir". shifts'i olmayan noktalarda
// shiftId hep null, davranış eskisiyle birebir aynı kalır.
export function runFor(point, runs, locationKey, shiftId) {
  const key = periodKey(point.period);
  return runs.find((r) => r.pointId === point.id && r.periodKey === key && (r.locationKey || null) === (locationKey || null) && (r.shiftId || null) === (shiftId || null));
}

// Daha önce sadece Kontroller.jsx içinde yerel tanımlıydı — Kat Planı'nda
// katın uygunsuzluk işareti göstermesi için de gerektiğinden paylaşılabilir
// hale getirildi (bkz. KatPlani.jsx). locationKey verilirse sadece o konuma
// bağlı açık iş emirlerine bakar, verilmezse noktanın tamamına.
export function hasNonConformity(point, state, locationKey) {
  return state.tasks.some((t) => t.mahalPointId === point.id && (locationKey === undefined || t.locationKey === locationKey) && t.status !== "Tamamlandı" && t.status !== "İptal");
}

// Uygunsuzluk bilgi ekranı — kullanıcı teyidiyle: "uygunsuzluk işareti olan
// mahal kontrollerde bilgi ekranı çıksın". Hangi soru(lar) başarısız oldu
// (run.failedQuestions, bkz. buildMahalFillPatch) ve hangi iş emri/emirleri
// hâlâ açık, tek panelde gösterir.
export function NonConformityPanel({ point, location, state, onClose }) {
  // Vardiyalı noktalarda (bkz. point.shifts) bir konumun birden fazla run'ı
  // olabilir (gündüz + gece) — tek bir runFor() yerine konuma ait TÜM
  // run'lar taranır, her birinin başarısız soruları vardiya etiketiyle
  // birlikte listelenir.
  const locationRuns = state.mahalRuns.filter((r) => r.pointId === point.id && (r.locationKey || null) === (location?.key || null));
  const failedItems = locationRuns.flatMap((r) => (r.failedQuestions || []).map((f) => (r.shiftLabel ? `${r.shiftLabel}: ${f}` : f)));
  const openTasks = state.tasks.filter((t) => t.mahalPointId === point.id && (location ? t.locationKey === location.key : true) && t.status !== "Tamamlandı" && t.status !== "İptal");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: 420, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#132A20" }}>{point.name}{location ? ` — ${location.label}` : ""}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8a8879" }}><X size={18} /></button>
        </div>
        <div style={{ display: "inline-block", marginTop: 8, fontSize: 11, fontWeight: 700, color: "#DC5A34", background: "rgba(220,90,52,0.10)", borderRadius: 999, padding: "3px 10px" }}>Uygunsuzluk</div>

        <div style={{ marginTop: 16, marginBottom: 4, fontSize: 11, fontWeight: 700, color: "#8a8879", textTransform: "uppercase", letterSpacing: 0.3 }}>Başarısız Kontroller</div>
        {failedItems.length > 0 ? (
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, color: "#132A20" }}>
            {failedItems.map((f, i) => <li key={i} style={{ marginBottom: 4 }}>{f}</li>)}
          </ul>
        ) : (
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#8a8879" }}>Kontrol kaydında ayrıntı bulunamadı — açık iş emrinin açıklamasına bakın.</p>
        )}

        <div style={{ marginTop: 16, marginBottom: 4, fontSize: 11, fontWeight: 700, color: "#8a8879", textTransform: "uppercase", letterSpacing: 0.3 }}>Açık İş Emirleri</div>
        {openTasks.length === 0 && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#8a8879" }}>Açık iş emri yok.</p>}
        {openTasks.map((t) => (
          <div key={t.id} style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid #E3DFD1" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#132A20" }}>#{t.ticketNo} · {t.status}</div>
            <div style={{ fontSize: 12, color: "#5a5850", marginTop: 2 }}>{t.description}</div>
            <div style={{ fontSize: 11, color: "#8a8879", marginTop: 3 }}>Öncelik: {t.priority} · Atanan: {t.assignee || "—"}</div>
          </div>
        ))}

        <button onClick={onClose} style={{ width: "100%", marginTop: 18, border: "none", borderRadius: 999, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer", background: "#F1EFE7", color: "#132A20" }}>Kapat</button>
      </div>
    </div>
  );
}

// Sayaç Okuma bir mahale "gömülür" — kullanıcı teyidiyle: "mahale göm".
// Enerji.jsx'te bir sayaç Kat Planı'ndaki gerçek bir mahale bağlanınca
// (bkz. Enerji.jsx buildMahalCatalog/mahalKey) o mahalin kontrol formunda
// otomatik bir "Sayaç Okuma" alanı belirir — ayrı bir "sayaç oku" ekranına/
// göreve gerek kalmaz, kontrolü yapan personel checklist'i doldururken
// sayacı da okur. point.meter sabit/eski kayıtlar için geriye dönük
// desteklenir (ör. elle tanımlanmış noktalar); asıl kaynak artık
// waterMeters/gasMeters üzerindeki mahalKey alanı.
// Bir mahale birden fazla sayaç bağlanabilir (kullanıcı teyidiyle: "1 Mahale
// 1 sayaç geliyor 1 den fazla sayaç gelebilmeli") — bu yüzden .find() değil
// .filter() ile TÜM eşleşen su/gaz sayaçları döner (dizi, tekil obje değil).
export function resolveMeters(state, point, location) {
  if (location?.meter) return [location.meter];
  if (point.meter && !point.perFloor) return [point.meter];
  const key = location ? `loc_${point.id}_${location.key}` : `pt_${point.id}`;
  const water = state.waterMeters.filter((m) => !m.archived && m.mahalKey === key).map((m) => ({ type: "water", meterId: m.id, name: m.name, unit: "m³" }));
  const gas = state.gasMeters.filter((m) => !m.archived && m.mahalKey === key).map((m) => ({ type: "gas", meterId: m.id, name: m.name, unit: "m³" }));
  return [...water, ...gas];
}

// FillModal'ın onSubmit payload'unu state patch'ine çevirir — MahalKontrol.jsx
// ve Kontroller.jsx (çapraz departman genel görünüm) AYNI kaydetme mantığını
// kullanır, tek kaynak (kullanıcı teyidiyle: "burda da düzenleme
// yapılabilecek. tıklayınca düzenleme yapsın" — Kontroller ekranından da
// aynı kontrol formuyla düzenlenebilmeli). Mahal Kontrol ile Talep/Şikayet
// KARIŞTIRILMAZ (kullanıcı teyidiyle: "talep şikayetler ile mahal
// kontrollerini karıştırma") — burada açılan iş emri sadece başarısız
// kontrolden doğan "Mahal Kontrol" tipi arıza kaydıdır, Talep/Şikayet
// modülüyle ilgisi yok.
export function buildMahalFillPatch(state, point, location, { inspector, answers, note, photo, meterReadings, compensation, expiryDates, shift }) {
  // Kayıt her zaman var olduğu varsayılmaz — bekleyen "Bekliyor" plasehoder'ı
  // sadece MahalKontrol.jsx'in kendi effect'i o departman sayfası açıldığında
  // üretir. Kontroller.jsx (çapraz departman genel görünüm) o sayfa hiç
  // açılmadan da düzenleme yapabilmeli, o yüzden kayıt yoksa burada oluşturulur
  // (aksi halde state.mahalRuns.map boş dizide hiç çalışmaz ve kayıt sessizce kaybolur).
  const key = periodKey(point.period);
  const existing = runFor(point, state.mahalRuns, location?.key, shift?.id);

  // İlk kontrolde tüp/hortum son kullanma tarihi girilmesi — kullanıcı
  // teyidiyle: "yangın tüplerine ilk bakımda tarih girelim". Varlıklar
  // kaydındaki expiryDate alanı doğrudan güncellenir (Varlıklar'daki "Son
  // Kullanma Tarihi" ile aynı alan, tek kaynak).
  let assets = state.assets;
  if (expiryDates && Object.keys(expiryDates).length > 0) {
    assets = state.assets.map((a) => (expiryDates[a.id] ? { ...a, expiryDate: expiryDates[a.id] } : a));
  }

  // Sayısal aralık soruları aralık dışına (özellikle yükseğe) çıkarsa da
  // arıza kaydı otomatik açılır — kullaıncı teyidiyle: "kontrol etmeleri
  // gereken değer aralıkları var ise onları standarda al yükse çıkarsa
  // arıza kaydı otomatik açılacak şekilde olsun".
  const failed = (location?.questions || point.questions)
    .map((q, i) => ({ q, i }))
    .filter(({ q, i }) => {
      if (q.type === "sayi") {
        const v = Number(answers[i]);
        return Number.isNaN(v) || v < q.min || v > q.max;
      }
      return answers[i] === q.failOn;
    })
    .map(({ q, i }) => (q.type === "sayi" ? `${q.text}: ${answers[i]} ${q.unit} (beklenen ${q.min}-${q.max})` : q.text));

  let compFail = false;
  let compensationReadings = state.compensationReadings;
  if (point.compensation && compensation) {
    const apparentKva = Math.sqrt(compensation.activeKw ** 2 + compensation.reactiveKvar ** 2);
    const cosPhi = apparentKva > 0 ? compensation.activeKw / apparentKva : 0;
    compFail = cosPhi < 0.95;
    compensationReadings = [...state.compensationReadings, {
      id: `cmp_${Date.now()}`, date: new Date().toISOString().slice(0, 10), activeKw: compensation.activeKw, reactiveKvar: compensation.reactiveKvar,
      note: `${point.name} günlük Mahal Kontrol — ${inspector}`, pointId: point.id,
    }];
    if (compFail) failed.push(`Kompanzasyon cosφ ${cosPhi.toFixed(3)} (beklenen ≥ 0.95)`);
  }

  // Bir mahale artık birden fazla sayaç bağlanabiliyor — kullanıcı teyidiyle:
  // "1 Mahale 1 sayaç geliyor 1 den fazla sayaç gelebilmeli". meterReadings
  // her eşleşen sayaç için { [meterId]: number } şeklinde geliyor (bkz.
  // FillModal), her biri kendi tipine (gas/water) göre ayrı ayrı yazılır.
  let gasReadings = state.gasReadings;
  let waterReadings = state.waterReadings;
  const meters = resolveMeters(state, point, location);
  if (meterReadings) {
    const label = location ? `${point.name} (${location.label})` : point.name;
    meters.forEach((meter) => {
      const val = meterReadings[meter.meterId];
      if (val == null) return;
      if (meter.type === "gas") {
        gasReadings = [...gasReadings, { id: `gr_${Date.now()}_${meter.meterId}`, meterId: meter.meterId, date: new Date().toISOString().slice(0, 10), value: val, note: `${label} — ${inspector}` }];
      } else if (meter.type === "water") {
        waterReadings = [...waterReadings, { id: `wtr_${Date.now()}_${meter.meterId}`, meterId: meter.meterId, date: new Date().toISOString().slice(0, 10), meterM3: val, note: `${label} — ${inspector}` }];
      }
    });
  }

  // Uygunsuzluk bilgi ekranı bu listeyi doğrudan okuyabilsin diye (task
  // açıklama metnini geri ayrıştırmak yerine) hangi soruların başarısız
  // olduğu run kaydına da yazılır — kullanıcı teyidiyle: "uygunsuzluk işareti
  // olan mahal kontrollerde bilgi ekranı çıksın".
  const runPatch = { status: "Tamamlandı", completedBy: inspector, completedAt: new Date().toISOString(), answers, note, photo: photo ? true : false, failedQuestions: failed, shiftId: shift?.id || null, shiftLabel: shift?.label || null };
  const mahalRuns = existing
    ? state.mahalRuns.map((r) => (r.id === existing.id ? { ...r, ...runPatch } : r))
    : [...state.mahalRuns, { id: `mr_${point.id}_${location?.key || "x"}_${key}${shift ? `_${shift.id}` : ""}`, pointId: point.id, department: point.department, periodKey: key, locationKey: location?.key, createdAt: new Date().toISOString(), ...runPatch }];

  let tasks = state.tasks;
  if (failed.length > 0) {
    const nextNo = Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1;
    const pointLabel = location ? `${point.name} (${location.label})${shift ? ` — ${shift.label}` : ""}` : `${point.name}${shift ? ` — ${shift.label}` : ""}`;
    const task = {
      id: `t_${Date.now()}`, ticketNo: nextNo, department: point.department, issueType: "Mahal Kontrol",
      category: point.department === "Teknik" ? "Arıza Bakım" : "", priority: "Yüksek", status: "Yapılacak",
      description: `${pointLabel} kontrolünde sorun tespit edildi: ${failed.join(", ")}`,
      requester: inspector, assignee: "", createdAt: new Date().toISOString(), dueDate: "", assetId: point.assetId || "",
      mahalPointId: point.id, locationKey: location?.key,
    };
    tasks = [...state.tasks, task];
  }
  return { mahalRuns, tasks, compensationReadings, gasReadings, waterReadings, assets };
}

// floorGroup verilmişse (perFloor kart, bkz. PerFloorCard) QR o katın TÜM
// konumlarını listeleyen görünüme gider (?floor=), location verilmişse tekil
// bir konuma (?loc=) — kullanıcı teyidiyle: "5. Katta qr okuttun 5. kattaki
// yangın tüpleri sıralı şekilde gelirdi içine girip cheklisti yapardı".
export function QrModal({ point, location, floorGroup, onClose }) {
  const canvasRef = useRef(null);
  const [dataUrl, setDataUrl] = useState("");
  const param = floorGroup ? `&floor=${encodeURIComponent(floorGroup.floorLabel)}` : location ? `&loc=${location.key}` : "";
  const suffix = floorGroup ? `-${floorGroup.floorLabel}` : location ? `-${location.key}` : "";
  const titleSuffix = floorGroup ? ` — ${floorGroup.label}` : location ? ` — ${location.label}` : "";
  useEffect(() => {
    const url = `${window.location.origin}${window.location.pathname}?mahal=${point.id}${param}`;
    QRCode.toDataURL(url, { width: 260, margin: 1, color: { dark: "#12202E", light: "#FFFFFF" } }).then(setDataUrl);
  }, [point.id, param]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: 320, maxWidth: "100%", padding: "22px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b6a61" }}><X size={18} /></button>
        </div>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#132A20" }}>{point.name}{titleSuffix}</h3>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "#8a8879" }}>{floorGroup ? "Bu QR'ı o katın girişine/mahal panosuna asın — okutulunca bu katın tüm kontrol noktaları listelenir." : "Bu QR kodu mahalde asın — okutulunca kontrol formu doğrudan açılır."}</p>
        {dataUrl && <img src={dataUrl} alt={`${point.name} QR`} style={{ width: 220, height: 220 }} />}
        {dataUrl && (
          <a href={dataUrl} download={`mahal-${point.id}${suffix}-qr.png`} style={{ display: "inline-block", marginTop: 14, fontSize: 12.5, fontWeight: 700, color: "#2F6FAE", textDecoration: "none" }}>
            PNG olarak indir
          </a>
        )}
      </div>
    </div>
  );
}

// Kompanzasyon panosu ölçümü — aktif (kW) ve reaktif (kVAr) güçten cosφ
// hesaplanır (bkz. Enerji.jsx powerFactor, aynı formül burada tekrarlanır —
// tek kaynak compensationReadings üzerinden yeniden hesaplanabilir olduğu
// için ayrı bir state tutulmuyor). BEDAŞ/dağıtım şirketleri cosφ ≥ 0.95 şartı
// arar.
function powerFactor(activeKw, reactiveKvar) {
  const apparentKva = Math.sqrt(activeKw * activeKw + reactiveKvar * reactiveKvar);
  return { apparentKva, cosPhi: apparentKva > 0 ? activeKw / apparentKva : 0 };
}

export function FillModal({ point, location, shift, meters, state, run, team, currentUser, assets, onSubmit, onClose, onQuickRequest, onStartTask, onUpdateEquipment }) {
  const [inspector, setInspector] = useState(currentUser || "");
  const [answers, setAnswers] = useState({});
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [meterReadings, setMeterReadings] = useState({});
  const [expiryDates, setExpiryDates] = useState({});
  const [activeKw, setActiveKw] = useState("");
  const [reactiveKvar, setReactiveKvar] = useState("");
  const now = new Date();
  const dateLabel = now.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" }) + " · " + now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  // Konum kendi questions/assetDesc'ini taşıyabilir (ör. Temizlik'in tek
  // mahalindeki WC ile Teras farklı checklist kullanır) — kullanıcı
  // teyidiyle: "ayrı yaptığın mahalleri tek mahale ekle". Yoksa noktanın
  // genel questions'ı kullanılır.
  const questions = location?.questions || point.questions;
  const desc = location?.assetDesc || point.assetDesc;
  const thresholdPct = state?.meterWarningThresholdPct ?? 10;
  // Her sayaç için: bir önceki okuma + yeni değerin doğrulaması (azalma sert
  // engel, %eşik aşımı yumuşak uyarı) — kullanıcı teyidiyle: "sayaç okuma
  // değeri bir öncekinden küçük olamaz... fark %10 dan fazla ise uyarı ver".
  const meterChecks = (meters || []).map((m) => {
    const valueField = m.type === "water" ? "meterM3" : "value";
    const readings = m.type === "water" ? state?.waterReadings : state?.gasReadings;
    const previous = readings ? latestReading(readings, m.meterId, valueField) : null;
    const raw = meterReadings[m.meterId];
    const val = raw === undefined || raw === "" ? null : Number(raw);
    const check = val != null ? validateReading(val, previous, thresholdPct) : { blocked: false, warning: null };
    return { ...m, previous, val, ...check };
  });
  const meterReadingsBlocked = meterChecks.some((m) => m.blocked);
  const allAnswered = questions.every((q, i) => (q.type === "sayi" ? answers[i] !== undefined && answers[i] !== "" : answers[i]))
    && meterChecks.every((m) => m.val != null) && !meterReadingsBlocked
    && (!point.compensation || (activeKw !== "" && reactiveKvar !== ""));
  const compPreview = activeKw !== "" && reactiveKvar !== "" ? powerFactor(Number(activeKw), Number(reactiveKvar)) : null;

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: 420, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ fontSize: 11.5, color: "#8a8879", fontWeight: 600 }}>{dateLabel}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#8a8879" }}><X size={18} /></button>
        </div>
        <h2 style={{ margin: "6px 0 2px", fontSize: 19, fontWeight: 700, color: "#132A20" }}>{point.name}</h2>
        {location && <div style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, color: "#2F6FAE", background: "rgba(47,111,174,0.10)", borderRadius: 999, padding: "2px 10px", marginBottom: 6, marginRight: 6 }}>{location.label}</div>}
        {shift && <div style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, color: "#B4551E", background: "rgba(224,179,84,0.14)", borderRadius: 999, padding: "2px 10px", marginBottom: 6 }}>{shift.label} · {shift.start}–{shift.end}</div>}
        {location?.firms?.length > 0 && <div style={{ fontSize: 11.5, color: "#132A20", marginBottom: 4 }}>Firma: {location.firms.join(", ")}</div>}
        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "#8a8879" }}>{desc}</p>
        {(onStartTask || onQuickRequest || onUpdateEquipment) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {onStartTask && (
              <button onClick={onStartTask} style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(47,111,174,0.10)", color: "#2F6FAE", fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "5px 12px" }}>
                ▶ Görev Başlat
              </button>
            )}
            {onQuickRequest && (
              <button onClick={onQuickRequest} style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(220,90,52,0.10)", color: "#DC5A34", fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "5px 12px" }}>
                ⚠ Arıza Kaydı Oluştur
              </button>
            )}
            {onUpdateEquipment && (
              <button onClick={onUpdateEquipment} style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(63,179,127,0.10)", color: "#2E7D4F", fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "5px 12px" }}>
                🔧 Ekipman Güncelle
              </button>
            )}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#132A20", marginBottom: 6 }}>Kontrolü yapan</label>
          <select value={inspector} onChange={(e) => setInspector(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E3DFD1", fontSize: 13.5, color: "#132A20", background: "#fff" }}>
            <option value="">Personel seçin</option>
            {team.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>

        {location?.equipmentIds?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#132A20", marginBottom: 6 }}>Son Kullanma Tarihleri (ilk kontrolde girin)</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {location.equipmentIds.map((id) => {
                const asset = assets.find((a) => a.id === id);
                if (!asset) return null;
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#132A20", flex: 1 }}>{asset.name} <span style={{ color: "#8a8879" }}>({id})</span></span>
                    <input type="date" value={expiryDates[id] ?? asset.expiryDate ?? ""} onChange={(e) => setExpiryDates((d) => ({ ...d, [id]: e.target.value }))}
                      style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #E3DFD1", fontSize: 12.5 }} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {meterChecks.map((m) => (
          <div key={m.meterId} style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#132A20", marginBottom: 6 }}>
              Sayaç Okuma{m.name ? ` — ${m.name}` : ""} ({m.unit}){m.previous != null && <span style={{ fontWeight: 400, color: "#8a8879" }}> · önceki: {m.previous}</span>}
            </label>
            <input type="number" step="0.01" value={meterReadings[m.meterId] ?? ""} onChange={(e) => setMeterReadings((r) => ({ ...r, [m.meterId]: e.target.value }))}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${m.blocked ? "#DC5A34" : "#E3DFD1"}`, fontSize: 13.5, boxSizing: "border-box" }} />
            {m.warning && <div style={{ marginTop: 5, fontSize: 11.5, color: m.blocked ? "#DC5A34" : "#B4551E", fontWeight: 600 }}>{m.blocked ? "⛔" : "⚠"} {m.warning}</div>}
          </div>
        ))}

        {point.compensation && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#132A20", marginBottom: 6 }}>Kompanzasyon Ölçümü</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" step="0.1" placeholder="Aktif Güç (kW)" value={activeKw} onChange={(e) => setActiveKw(e.target.value)}
                style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #E3DFD1", fontSize: 13, boxSizing: "border-box" }} />
              <input type="number" step="0.1" placeholder="Reaktif Güç (kVAr)" value={reactiveKvar} onChange={(e) => setReactiveKvar(e.target.value)}
                style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #E3DFD1", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            {compPreview && (
              <div style={{ marginTop: 6, fontSize: 12, color: compPreview.cosPhi < 0.95 ? "#B4551E" : "#2E7D4F" }}>
                Görünür güç {compPreview.apparentKva.toFixed(1)} kVA · Cosφ {compPreview.cosPhi.toFixed(3)}{compPreview.cosPhi < 0.95 ? " (düşük — arıza kaydı açılacak)" : ""}
              </div>
            )}
          </div>
        )}

        {questions.map((q, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13.5, color: "#132A20", flex: 1 }}>{q.text}</span>
              {q.type === "sayi" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <input type="number" step="0.1" value={answers[i] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                    style={{ width: 84, padding: "6px 8px", borderRadius: 8, border: "1px solid #E3DFD1", fontSize: 13 }} />
                  <span style={{ fontSize: 12, color: "#8a8879" }}>{q.unit}</span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {["Evet", "Hayır"].map((opt) => (
                    <button key={opt} onClick={() => setAnswers((a) => ({ ...a, [i]: opt }))}
                      style={{
                        border: `1px solid ${answers[i] === opt ? "#132A20" : "#E3DFD1"}`, borderRadius: 999, padding: "6px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                        background: answers[i] === opt ? "#132A20" : "#fff", color: answers[i] === opt ? "#fff" : "#132A20",
                      }}>
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {q.type === "sayi" && <div style={{ fontSize: 11, color: "#8a8879", marginTop: 3 }}>Beklenen aralık: {q.min}–{q.max} {q.unit}</div>}
          </div>
        ))}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#132A20", marginBottom: 6 }}>Not (opsiyonel)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%", minHeight: 70, padding: "10px 12px", borderRadius: 10, border: "1px solid #E3DFD1", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#132A20", marginBottom: 6 }}>Fotoğraf (opsiyonel)</label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px dashed #C7C4B4", borderRadius: 10, padding: "12px 14px", cursor: "pointer", color: "#8a8879", fontSize: 13 }}>
            <Camera size={16} />
            {photo ? "Fotoğraf seçildi ✓" : "Fotoğraf çek / seç"}
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
          </label>
        </div>

        <button disabled={!allAnswered || !inspector} onClick={() => {
          const meterReadingsPayload = {};
          meterChecks.forEach((m) => { if (m.val != null) meterReadingsPayload[m.meterId] = m.val; });
          onSubmit({ inspector, answers, note, photo, meterReadings: meterReadingsPayload, compensation: point.compensation ? { activeKw: Number(activeKw), reactiveKvar: Number(reactiveKvar) } : null, expiryDates, shift });
        }}
          style={{ width: "100%", border: "none", borderRadius: 999, padding: "13px 0", fontSize: 14, fontWeight: 700, cursor: allAnswered && inspector ? "pointer" : "default", background: "#DC5A34", color: "#fff", opacity: allAnswered && inspector ? 1 : 0.5 }}>
          Kontrolü Tamamla
        </button>
      </div>
    </div>
  );
}

// perFloor noktalar (ör. Yangın Tüpü & Hortum, Exit Armatürü) TEK kart olarak
// gösterilir, kontrol edilecek kat/konum listeden seçilir — kullanıcı
// düzeltmesiyle: "aylık yangın tüpü ve yangın hortumu yönetilemez olmuş tek
// mahal kontrolü içinde katları seçebilirdi" (28/46 ayrı karttan TEK karta).
// Konumlar kat bazında gruplanır, her grup başlığında TEK bir QR var —
// kullanıcı teyidiyle: "5. Katta qr okuttun 5. kattaki yangın tüpleri
// sıralı şekilde gelirdi içine girip cheklisti yapardı böylece kullanımı
// kolay olurdu" (tek tek mahal QR'ı yerine, o kata asılan TEK QR okutulunca
// o katın tüm kontrol noktaları listelenir, oradan içine girilir).
// groupByFloor=false olan noktalarda (ör. Temizlik'in tek mahal kontrolü —
// kullanıcı teyidiyle: "Temizliğin Mahal kontrolü tek olacak. ayrı yaptığın
// mahalleri tek mahale ekle") konumlar kat başına çoğullanmadığı için (her
// biri zaten kendi başına tek bir mahal) düz liste + konum başına QR
// gösterilir; groupByFloor=true (varsayılan, ör. yangın tüpü/exit armatürü)
// kat bazında gruplanır, kat başına TEK QR.
export function PerFloorCard({ point, locations, runs, tasks, onFill, onQrFloor, onQr, onEdit, onDelete, onOpenNonConformity, initialQuery, canWrite = true }) {
  const [q, setQ] = useState(initialQuery || "");
  const cardRef = useRef(null);
  const grouped = point.groupByFloor !== false;
  useEffect(() => {
    if (initialQuery) { setQ(initialQuery); cardRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }
  }, [initialQuery]);
  const filtered = locations.filter((loc) => loc.label.toLowerCase().includes(q.toLowerCase()));
  const hasShifts = point.shifts && point.shifts.length > 0;
  const now = useNow();
  const visibleShifts = hasShifts ? point.shifts.filter((s) => isShiftVisible(s, now)) : [];
  const doneCount = hasShifts
    ? locations.reduce((sum, loc) => sum + point.shifts.filter((s) => runFor(point, runs, loc.key, s.id)?.status === "Tamamlandı").length, 0)
    : locations.filter((loc) => runFor(point, runs, loc.key)?.status === "Tamamlandı").length;
  const totalCount = hasShifts ? locations.length * point.shifts.length : locations.length;
  const groups = [];
  if (grouped) {
    const byFloor = new Map();
    filtered.forEach((loc) => {
      if (!byFloor.has(loc.floorLabel)) { const g = { floorLabel: loc.floorLabel, label: loc.label.split(" — ")[0], items: [] }; byFloor.set(loc.floorLabel, g); groups.push(g); }
      byFloor.get(loc.floorLabel).items.push(loc);
    });
  }
  return (
    <div ref={cardRef} style={{ gridColumn: "span 2" }}>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${T.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ClipboardCheck size={17} color={T.accent} strokeWidth={1.8} />
        </div>
        {canWrite && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={onEdit} title="Düzenle" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.dim }}><Pencil size={13} /></button>
            <button onClick={onDelete} title="Sil" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={13} color="#E2685A" /></button>
          </div>
        )}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{point.name}</div>
      <div style={{ fontSize: 11.5, color: T.dim, marginTop: 2 }}>{point.assetDesc}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: T.accent, textTransform: "uppercase" }}>{point.period}{grouped ? " · Kat Bazlı" : ""}{scheduleLabel(point)}{hasShifts ? ` · ${point.shifts.length} vardiya/gün` : ""}</span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: T.dim }}>{doneCount}/{totalCount} tamamlandı</span>
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kat/konum ara…" style={{ width: "100%", marginTop: 10, boxSizing: "border-box" }} />
      <div style={{ maxHeight: 320, overflowY: "auto", marginTop: 8, display: "flex", flexDirection: "column", gap: grouped ? 10 : 4 }}>
        {grouped ? groups.map((g) => (
          <div key={g.floorLabel}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: T.dim, flex: 1 }}>{g.label}</span>
              <button onClick={() => onQrFloor(g)} title="Bu katın QR'ı — mahalde asılıp okutulunca listeyi açar" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 6, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.dim, flexShrink: 0 }}><QrCode size={11} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {g.items.map((loc) => {
                const nc = tasks && hasNonConformity(point, { tasks }, loc.key);
                // Vardiyalı noktalarda (ör. Güvenlik Devriyesi gündüz/gece —
                // kullanıcı teyidiyle: "devriye saatleri değiştirilebilir")
                // tek durum/buton yerine her vardiya kendi rozet+butonuyla
                // ayrı gösterilir, her biri kendi run'ını doldurur.
                if (hasShifts) {
                  return (
                    <div key={loc.key} style={{ padding: "6px 8px", borderRadius: 8, background: T.surface2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: T.ink }}>{loc.room}{loc.side ? ` (${loc.side})` : ""}</div>
                          {loc.firms && loc.firms.length > 0 && <div style={{ fontSize: 10, color: T.dimmer, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.firms.join(", ")}</div>}
                        </div>
                        {nc && <button onClick={() => onOpenNonConformity(loc)} title="Uygunsuzluk var — bilgi için tıklayın" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexShrink: 0, padding: 0 }}><AlertTriangle size={12} color="#E2685A" /></button>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        {visibleShifts.length === 0 && <span style={{ fontSize: 10.5, color: T.dimmer, fontStyle: "italic" }}>Vardiya saati henüz gelmedi</span>}
                        {visibleShifts.map((shift) => {
                          const run = runFor(point, runs, loc.key, shift.id);
                          const done = run?.status === "Tamamlandı";
                          return (
                            <button key={shift.id} onClick={() => onFill(loc, shift)} title={`${shift.start}–${shift.end}`}
                              style={{
                                all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999, padding: "4px 10px", flexShrink: 0,
                                background: done ? "rgba(63,179,127,0.14)" : "rgba(224,179,84,0.14)", color: done ? "#3FB37F" : "#B4551E",
                              }}>
                              <span style={{ fontSize: 10.5, fontWeight: 700 }}>{done ? "✓" : "○"} {shift.label}</span>
                              <span style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.75 }}>{shift.start}–{shift.end}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                const run = runFor(point, runs, loc.key);
                const done = run?.status === "Tamamlandı";
                return (
                  <div key={loc.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: T.surface2 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: T.ink }}>{loc.room}{loc.side ? ` (${loc.side})` : ""}</div>
                      {loc.firms && loc.firms.length > 0 && <div style={{ fontSize: 10, color: T.dimmer, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.firms.join(", ")}</div>}
                    </div>
                    {nc && <button onClick={() => onOpenNonConformity(loc)} title="Uygunsuzluk var — bilgi için tıklayın" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexShrink: 0, padding: 0 }}><AlertTriangle size={12} color="#E2685A" /></button>}
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: done ? "#3FB37F" : "#E0B354", flexShrink: 0 }}>{done ? "✓" : "Bekliyor"}</span>
                    <Button variant="ghost" style={{ padding: "4px 10px", fontSize: 11, flexShrink: 0 }} onClick={() => onFill(loc)}>{done ? "Görüntüle" : "Kontrol Et"}</Button>
                  </div>
                );
              })}
            </div>
          </div>
        )) : filtered.map((loc) => {
          const run = runFor(point, runs, loc.key);
          const done = run?.status === "Tamamlandı";
          const nc = tasks && hasNonConformity(point, { tasks }, loc.key);
          return (
            <div key={loc.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: T.surface2 }}>
              <div style={{ fontSize: 12, color: T.ink, flex: 1 }}>{loc.label}</div>
              {nc && <button onClick={() => onOpenNonConformity(loc)} title="Uygunsuzluk var — bilgi için tıklayın" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexShrink: 0, padding: 0 }}><AlertTriangle size={12} color="#E2685A" /></button>}
              <span style={{ fontSize: 9.5, fontWeight: 700, color: done ? "#3FB37F" : "#E0B354", flexShrink: 0 }}>{done ? "✓" : "Bekliyor"}</span>
              <button onClick={() => onQr(loc)} title="QR kodu" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 6, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.dim, flexShrink: 0 }}><QrCode size={11} /></button>
              <Button variant="ghost" style={{ padding: "4px 10px", fontSize: 11, flexShrink: 0 }} onClick={() => onFill(loc)}>{done ? "Görüntüle" : "Kontrol Et"}</Button>
            </div>
          );
        })}
        {(grouped ? groups.length === 0 : filtered.length === 0) && <p style={{ fontSize: 11.5, color: T.dimmer, padding: "6px 0" }}>Eşleşen kat/konum yok.</p>}
      </div>
    </Card>
    </div>
  );
}

// Ekipman Güncelle — kullanıcı düzeltmesiyle: "ekipman güncellemeden kastım
// var olan ekipmanın adını kw gücü güncelleme" — bu mahale bağlı zaten var
// olan ekipman(lar)ın kendi kaydındaki (state.assets) Ad ve Elektrik Gücü
// (kW) alanlarını düzenler; yeni ekipman bağlamaz/kaldırmaz (o Bakım
// Takvimi'ndeki "+ Ekipman Ekle" ile yapılır, ayrı bir akış).
function EquipmentQuickEditModal({ point, assets, onSave, onClose }) {
  const ids = point.equipmentIds && point.equipmentIds.length > 0 ? point.equipmentIds : (point.assetId ? [point.assetId] : []);
  const items = ids.map((id) => assets.find((a) => a.id === id)).filter(Boolean);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(items.map((a) => [a.id, { name: a.name, kw: a.kw ?? "" }])));

  function update(id, field, value) { setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } })); }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 14, width: 420, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>Ekipman Bilgilerini Güncelle</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.dim }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 12.5, color: T.dim, margin: "4px 0 16px" }}>{point.name}</p>
        {items.length === 0 && <p style={{ fontSize: 12.5, color: T.dim }}>Bu mahale bağlı ekipman kaydı yok.</p>}
        {items.map((a, i) => (
          <div key={a.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < items.length - 1 ? `1px solid ${T.line}` : "none" }}>
            <div style={{ fontSize: 10.5, color: T.dimmer, marginBottom: 6 }}>{a.id}</div>
            <Field label="Ad"><Input value={drafts[a.id].name} onChange={(e) => update(a.id, "name", e.target.value)} style={{ width: "100%" }} /></Field>
            <Field label="Elektrik Gücü (kW)"><Input type="number" step="0.1" value={drafts[a.id].kw} onChange={(e) => update(a.id, "kw", e.target.value)} style={{ width: "100%" }} /></Field>
          </div>
        ))}
        {items.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => onSave(drafts)}>Kaydet</Button>
            <Button variant="quiet" onClick={onClose}>Vazgeç</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Kullanıcı teyidiyle: "Mahal kontrol kart olarak kalmış liste bazlı
// görünüm yaparsan ve günlük haftalık aylık olarak katogorize edersen daha
// iyi olur" — mobilde (dar kart grid'i yerine) tek sütunlu, periyoda göre
// gruplanmış (Günlük/Haftalık/Aylık/Yıllık — bkz. MAHAL_PERIODS) kompakt
// bir satır listesi. perFloor noktalar (Devriye, Teknik Mahal gibi çok
// konumlu olanlar) kendi PerFloorCard'ını korur — o zaten arama+liste
// içeriyor, tek satıra sığmaz.
function MobileMahalRow({ point: p, state, onFill }) {
  const run = runFor(p, state.mahalRuns);
  const done = run?.status === "Tamamlandı";
  const nc = hasNonConformity(p, state);
  return (
    <button onClick={() => onFill(p, null)}
      style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%",
        border: `1px solid ${T.line}`, borderRadius: 12, padding: "11px 14px", background: T.surface2 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${T.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <ClipboardCheck size={14} color={T.accent} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
        <div style={{ fontSize: 10.5, color: T.dim, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {p.floorLabel ? locationLabel({ floor: p.floorLabel, side: p.side, unit: p.unitNo }) : (p.assetDesc || "—")}
        </div>
        {/* Kullanıcı teyidiyle: "haftalıkta hangi gün seçilmişse her cuma
            gibi aylıkta hangi gün girilmişse ayın 27 si gibi uyarı olmalı" */}
        {scheduleLabel(p) && <div style={{ fontSize: 10, color: T.accent, fontWeight: 700, marginTop: 1 }}>{scheduleLabel(p).replace(" · ", "")}</div>}
      </div>
      {nc && <AlertTriangle size={13} color="#E2685A" style={{ flexShrink: 0 }} />}
      <span style={{ fontSize: 9.5, fontWeight: 700, color: done ? "#3FB37F" : "#E0B354", flexShrink: 0, whiteSpace: "nowrap" }}>{done ? "✓ Tamam" : "Bekliyor"}</span>
    </button>
  );
}

function MobileMahalList({ points, state, onFill, onQrFloor, onQr, onOpenNonConformity }) {
  const groups = MAHAL_PERIODS
    .map((period) => ({ period, items: points.filter((p) => p.period === period) }))
    .filter((g) => g.items.length > 0);
  const other = points.filter((p) => !MAHAL_PERIODS.includes(p.period));
  if (other.length > 0) groups.push({ period: "Diğer", items: other });

  if (points.length === 0) return <p style={{ color: T.dim, fontSize: 13 }}>Henüz mahal tanımlanmadı.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {groups.map((g) => (
        <div key={g.period}>
          <div style={{ fontSize: 11, fontWeight: 800, color: T.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            {g.period} <span style={{ color: T.dimmer, fontWeight: 600 }}>· {g.items.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {g.items.map((p) => (
              p.perFloor ? (
                <PerFloorCard key={p.id} point={p} locations={getLocations(p, state)} runs={state.mahalRuns} tasks={state.tasks}
                  onFill={(loc, shift) => onFill(p, loc, shift)} onQrFloor={(fg) => onQrFloor(p, fg)} onQr={(loc) => onQr(p, loc)}
                  onEdit={() => {}} onDelete={() => {}} onOpenNonConformity={(loc) => onOpenNonConformity(p, loc)} canWrite={false} />
              ) : (
                <MobileMahalRow key={p.id} point={p} state={state} onFill={onFill} />
              )
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Mahal Kontrol — Teknik/Temizlik/Güvenlik'in ortak kullanacağı konum bazlı
// kontrol sistemi. Her nokta kendi periyoduna göre (Günlük/Haftalık/Aylık/
// Yıllık) otomatik olarak "Bekliyor" durumunda bir kontrol kaydı üretir —
// personelin ayrıca "yeni kontrol oluştur" demesine gerek yok, QR okutunca
// veya buradan tıklayınca doldurulmayı bekleyen kayıt zaten hazır.
export function MahalKontrol({ state, updateState, currentUser, department, title = "Mahal Kontrol", deepLink, onConsumeDeepLink, canWrite = true, mobileMode = false }) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyPoint(department));
  const [fillPoint, setFillPoint] = useState(null);
  const [qrPoint, setQrPoint] = useState(null);
  const [ncTarget, setNcTarget] = useState(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [floorFocus, setFloorFocus] = useState(null);
  // Mahal Kontrol yapılırken hızlı Talep/Şikayet kaydı — kullanıcı teyidiyle:
  // "Mahal kontrol yapılırken Talep Şikayet Kaydı açılabilsin Arıza kaydı
  // gibi basit olmalı" + sonradan: "teknik, temizlik ve güvenlik mahal
  // kontrol noktalarında uygunsuzluk gördüğünde talep şikayet açabilmeli...
  // departman seçip açıklama yapıp resim ekleyerek talep kaydı
  // oluşturabilsin. bu kayıtlar mobilden açıldığı belli olacak şekilde talep
  // şikayet ekranına düşecek". mahalPointId HİÇ set edilmez (Mahal Kontrol
  // verisiyle karışmasın diye) ama viaMahal:true ile işaretlenir — bu sayede
  // Operasyonlar > Talep/Şikayet listesine düşer (bkz. Operasyonlar.jsx
  // TalepSikayet "requests" filtresi) ve saha kaydı olduğu rozetle belli
  // olur. Departman, gören kişinin kendi departmanına sabit DEĞİL — "PH
  // katında çöp var" örneğinde Güvenlik personeli Temizlik'e atayabilmeli.
  const [quickRequestOpen, setQuickRequestOpen] = useState(false);
  const [quickRequestForm, setQuickRequestForm] = useState(null);
  // Mahal kontrol yaparken doğrudan görev başlatma — kullanıcı teyidiyle:
  // "Mahal kontrol qr okutulduğunda görev başlat... olmalı". Arıza Kaydı'ndan
  // (basit form) farklı olarak TAM TaskForm kullanılır (öncelik/atanan/termin)
  // — departman gören kişinin kendi departmanına kilitli, kendi ekibine iş
  // atamak için. mahalPointId set edilmez (Mahal Kontrol'ün kendi otomatik
  // arıza takibiyle karışmasın diye — bkz. buildMahalFillPatch).
  // Ekipman güncelleme — kullanıcı teyidiyle: "sadece teknikte mahal
  // kontrolde ekipman güncelleme olsun" + düzeltme: "ekipman güncellemeden
  // kastım var olan ekipmanın adını kw gücü güncelleme" — yeni ekipman
  // bağlamaz, sadece sabit (perFloor olmayan) Teknik noktalarında zaten
  // bağlı ekipman(lar)ın Ad/kW'ını düzenler (bkz. EquipmentQuickEditModal).
  const [equipEditPoint, setEquipEditPoint] = useState(null);

  const allPoints = state.mahalPoints.filter((p) => p.department === department && !p.archived);
  const points = department === "Teknik" && roleFilter ? allPoints.filter((p) => p.role === roleFilter) : allPoints;

  // Mahal Kontrol QR'ı okutulunca (bkz. App.jsx handleQrDecoded) buraya
  // yönlendirilir — perFloor bir noktaysa o katın konum listesi ön filtrelenir
  // ve karta kaydırılır, tekil bir noktaysa doğrudan kontrol formu açılır.
  useEffect(() => {
    if (!deepLink) return;
    // Ana Sayfa'daki "Arıza Kaydı Aç" departman kısayolu (bkz. Dashboard.jsx)
    // — belirli bir noktaya değil, sayfa geneline ait hızlı talep formunu
    // doğrudan açar (üstteki "+ Talep/Şikayet Aç" ile aynı akış).
    if (deepLink.action === "quickRequest" && deepLink.department === department) {
      startQuickRequest();
      onConsumeDeepLink();
      return;
    }
    const point = state.mahalPoints.find((p) => p.id === deepLink.pointId && p.department === department);
    if (point) {
      if (point.perFloor) setFloorFocus({ pointId: point.id, floorLabel: deepLink.floorLabel });
      else setFillPoint({ point, location: null });
    }
    onConsumeDeepLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  useEffect(() => {
    const missing = [];
    points.forEach((p) => {
      const key = periodKey(p.period);
      // Vardiyalı noktalarda (bkz. point.shifts) her vardiya için AYRI bir
      // "Bekliyor" run üretilir — kullanıcı teyidiyle: "Güvenlik Devriyesi
      // Hergün Belirli Saatlerde tekrar edecek... devriye saatleri
      // değiştirilebilir". Vardiyası olmayan noktalarda shiftList tek bir
      // null elemanlı dizi olduğu için davranış eskisiyle birebir aynı kalır.
      const shiftList = p.shifts && p.shifts.length > 0 ? p.shifts : [null];
      if (p.perFloor) {
        getLocations(p, state).forEach((loc) => {
          shiftList.forEach((shift) => {
            const exists = state.mahalRuns.some((r) => r.pointId === p.id && r.periodKey === key && r.locationKey === loc.key && (r.shiftId || null) === (shift?.id || null));
            if (!exists) missing.push({ id: `mr_${p.id}_${loc.key}_${key}${shift ? `_${shift.id}` : ""}`, pointId: p.id, department: p.department, periodKey: key, locationKey: loc.key, shiftId: shift?.id || null, status: "Bekliyor", createdAt: new Date().toISOString() });
          });
        });
        return;
      }
      shiftList.forEach((shift) => {
        const exists = state.mahalRuns.some((r) => r.pointId === p.id && r.periodKey === key && !r.locationKey && (r.shiftId || null) === (shift?.id || null));
        if (!exists) missing.push({ id: `mr_${p.id}_${key}${shift ? `_${shift.id}` : ""}`, pointId: p.id, department: p.department, periodKey: key, shiftId: shift?.id || null, status: "Bekliyor", createdAt: new Date().toISOString() });
      });
    });
    if (missing.length > 0) updateState({ mahalRuns: [...state.mahalRuns, ...missing] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length, state.mahalRuns.length]);

  function startNew() { setForm(emptyPoint(department)); setFormOpen(true); }
  function startEdit(p) { setForm(p); setFormOpen(true); }
  function savePoint() {
    if (!form.name.trim() || form.questions.some((q) => !q.text.trim())) return;
    const shifts = (form.shifts || []).filter((s) => s.label.trim() && s.start && s.end);
    const id = form.id || `mp_${Date.now()}`;
    const payload = { ...form, id, shifts };
    const points2 = form.id ? state.mahalPoints.map((p) => (p.id === id ? payload : p)) : [...state.mahalPoints, payload];
    updateState({ mahalPoints: points2 });
    setFormOpen(false);
  }
  // Kalıcı silme yerine arşivleme — kullanıcı teyidiyle: "mahal kontrol
  // formları... geçmişe dönük raporlamalarda kullanılabilecek veriler".
  // mahalRuns'a HİÇ dokunulmuyor (eskiden noktayla birlikte siliniyordu) —
  // geçmiş kontrol kayıtları point.id ile referans veriyor, nokta arşivlense
  // bile runFor/Kontroller.jsx onu bulmaya devam eder (adı da kaybolmaz).
  function removePoint(id) {
    const p = state.mahalPoints.find((mp) => mp.id === id);
    if (!window.confirm(`"${p?.name || "Bu mahal"}" silinsin mi? Kayıt arşivlenecek, geçmiş kontrol verileri raporlarda kalmaya devam edecek.`)) return;
    updateState({ mahalPoints: state.mahalPoints.map((mp) => (mp.id === id ? { ...mp, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser } : mp)) });
  }
  function addQuestion() { setForm((f) => ({ ...f, questions: [...f.questions, { text: "", failOn: "Hayır" }] })); }
  function updateQuestion(i, patch) { setForm((f) => ({ ...f, questions: f.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) })); }
  function removeQuestion(i) { setForm((f) => ({ ...f, questions: f.questions.filter((_, idx) => idx !== i) })); }
  // Vardiyalar — kullanıcı teyidiyle: "gündüz vardiyası 14:00 ile 18:00 da
  // gece vardiyası 22:00 ile 04:00 da gibi devriye saatleri değiştirilebilir".
  // Sadece "Günlük" periyotlu noktalarda anlamlı (bkz. form altındaki JSX).
  function addShift() { setForm((f) => ({ ...f, shifts: [...(f.shifts || []), { id: `sh_${Date.now()}`, label: "", start: "", end: "" }] })); }
  function updateShift(i, patch) { setForm((f) => ({ ...f, shifts: f.shifts.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })); }
  function removeShift(i) { setForm((f) => ({ ...f, shifts: f.shifts.filter((_, idx) => idx !== i) })); }

  function submitFill(payload) {
    const { point, location } = fillPoint;
    updateState(buildMahalFillPatch(state, point, location, payload));
    setFillPoint(null);
  }

  // Bu mahallerden (kontrol başarısız olunca) açılan iş emirleri — Görevler/Arıza
  // Kayıtları'na gitmeden aynı sayfada takip edilebilsin diye burada da listelenir.
  const pointIds = new Set(points.map((p) => p.id));
  const mahalTasks = state.tasks.filter((t) => t.mahalPointId && pointIds.has(t.mahalPointId) && !t.archived);
  function startEditTask(t) { setTaskForm(t); setTaskFormOpen(true); }
  function startMahalTask(source) {
    const sourceLabel = source ? `${source.point.name}${source.location ? ` — ${source.location.label}` : ""}` : "";
    const nextNo = Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1;
    setTaskForm({ id: null, ticketNo: nextNo, department, issueType: "Talep", priority: "Orta", status: "Yapılacak", description: "", requester: currentUser || "", assignee: "", dueDate: "", location: sourceLabel });
    setFillPoint(null);
    setTaskFormOpen(true);
  }
  function saveTask() {
    if (!taskForm.description.trim()) return;
    if (taskForm.id) {
      const tasks = state.tasks.map((t) => (t.id === taskForm.id ? taskForm : t));
      updateState({ tasks });
    } else {
      const task = { ...taskForm, id: `t_${Date.now()}`, createdAt: new Date().toISOString() };
      updateState({ tasks: [...state.tasks, task] });
    }
    setTaskFormOpen(false);
  }
  function removeTask(id) { updateState({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, archived: true, archivedAt: new Date().toISOString(), archivedBy: currentUser } : t)) }); }

  function saveEquipment(drafts) {
    const assets = state.assets.map((a) => (drafts[a.id] ? { ...a, name: drafts[a.id].name.trim() || a.name, kw: drafts[a.id].kw === "" ? null : Number(drafts[a.id].kw) } : a));
    updateState({ assets });
    setEquipEditPoint(null);
  }

  function startQuickRequest(source) {
    const sourceLabel = source ? `${source.point.name}${source.location ? ` — ${source.location.label}` : ""}` : "";
    setQuickRequestForm({
      department, issueType: "Şikayet", priority: "Orta", status: "Yapılacak", description: "",
      requester: currentUser || "", assignee: "", dueDate: "", location: sourceLabel, hasPhoto: false,
    });
    setFillPoint(null);
    setQuickRequestOpen(true);
  }
  function handleQuickPhoto(e) {
    if (e.target.files?.[0]) setQuickRequestForm((f) => ({ ...f, hasPhoto: true }));
  }
  function saveQuickRequest() {
    if (!quickRequestForm.description.trim()) return;
    const nextNo = Math.max(3100, ...state.tasks.map((t) => t.ticketNo || 0)) + 1;
    const task = { id: `t_${Date.now()}`, ticketNo: nextNo, createdAt: new Date().toISOString(), company: "", viaMahal: true, ...quickRequestForm };
    updateState({ tasks: [...state.tasks, task] });
    setQuickRequestOpen(false);
  }

  return (
    <div>
      <PageHeader title={title} subtitle={`${points.length} tanımlı mahal — periyoduna göre otomatik kontrol kaydı oluşur`}
        right={<>
          <Button variant="quiet" onClick={() => startQuickRequest()}>+ Talep/Şikayet Aç</Button>
          {canWrite && !mobileMode && <Button icon={Plus} onClick={startNew}>Yeni Mahal</Button>}
        </>} />

      {quickRequestOpen && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 2 }}>Talep / Şikayet Aç</div>
          <div style={{ fontSize: 11, color: T.dim, marginBottom: 12 }}>📱 Saha kaydı — kaydeden: {currentUser}{quickRequestForm.location ? ` · ${quickRequestForm.location}` : ""}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            <Field label="Departman" required>
              <Select value={quickRequestForm.department} onChange={(e) => setQuickRequestForm((f) => ({ ...f, department: e.target.value }))}>
                {state.departments.map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Kayıt Türü"><Select value={quickRequestForm.issueType} onChange={(e) => setQuickRequestForm((f) => ({ ...f, issueType: e.target.value }))}>
              {TALEP_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select></Field>
            <Field label="Öncelik"><Select value={quickRequestForm.priority} onChange={(e) => setQuickRequestForm((f) => ({ ...f, priority: e.target.value }))}>
              {["Düşük", "Orta", "Yüksek", "Kritik"].map((p) => <option key={p}>{p}</option>)}
            </Select></Field>
            <Field label="Termin"><Input type="date" value={quickRequestForm.dueDate} onChange={(e) => setQuickRequestForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
          </div>
          {!quickRequestForm.location && (
            <Field label="Kat / Lokasyon"><Input value={quickRequestForm.location} onChange={(e) => setQuickRequestForm((f) => ({ ...f, location: e.target.value }))} placeholder="ör. PH Katı" /></Field>
          )}
          <Field label="Açıklama" required><TextArea style={{ width: "100%", minHeight: 60 }} placeholder="Gördüğünüz uygunsuzluğu kısaca açıklayın." value={quickRequestForm.description} onChange={(e) => setQuickRequestForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 5 }}>Fotoğraf (opsiyonel)</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${T.line}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", color: T.dim, fontSize: 12.5 }}>
              <Camera size={15} />
              {quickRequestForm.hasPhoto ? "Fotoğraf seçildi ✓" : "Fotoğraf çek / seç"}
              <input type="file" accept="image/*" capture="environment" onChange={handleQuickPhoto} style={{ display: "none" }} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={saveQuickRequest}>Kaydı Oluştur</Button>
            <Button variant="quiet" onClick={() => setQuickRequestOpen(false)}>Vazgeç</Button>
          </div>
        </Card>
      )}

      {department === "Teknik" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <Button variant={roleFilter === "" ? "primary" : "quiet"} onClick={() => setRoleFilter("")}>Tümü ({allPoints.length})</Button>
          {MAHAL_ROLES.map((r) => (
            <Button key={r} variant={roleFilter === r ? "primary" : "quiet"} onClick={() => setRoleFilter(r)}>
              {r} ({allPoints.filter((p) => p.role === r).length})
            </Button>
          ))}
        </div>
      )}

      {formOpen && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            <Field label="Mahal Adı" required><Input value={form.name} onChange={(e) => {
              const v = e.target.value;
              setForm((f) => {
                const next = { ...f, name: v };
                // Referans kütüphanesi: mahal adında bilinen bir ekipman
                // kategorisi geçiyorsa (ör. "Jeneratör Odası"), checklist
                // soruları önerilir — SADECE form hâlâ dokunulmamış (boş tek
                // soru) haldeyse doldurulur, kullanıcı zaten soru yazdıysa
                // üzerine yazılmaz. Periyot buraya taşınmıyor: taskTemplates.js
                // Bakım'ın "1 AY/3 AY/6 AY/12 AY" sözlüğünü kullanıyor, Mahal
                // Kontrol'ün "Günlük/Haftalık/Aylık/Yıllık" sözlüğüyle temiz
                // eşleşmiyor — yanlış bir eşleme yapmaktansa periyodu
                // kullanıcının kendi seçimine bırakmak daha güvenli.
                const pristine = f.questions.length === 1 && !f.questions[0].text.trim();
                if (pristine) {
                  const match = Object.keys(EQUIPMENT_TASK_TEMPLATES).find((cat) => v.toLowerCase().includes(cat.toLowerCase()));
                  if (match) next.questions = EQUIPMENT_TASK_TEMPLATES[match].questions.map((q) => ({ ...q }));
                }
                return next;
              });
            }} /></Field>
            <Field label="Ekipman Açıklaması"><Input value={form.assetDesc} onChange={(e) => setForm((f) => ({ ...f, assetDesc: e.target.value }))} /></Field>
            <Field label="Periyot"><Select value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value, scheduleDay: "", shifts: e.target.value === "Günlük" ? f.shifts : [] }))}>{MAHAL_PERIODS.map((p) => <option key={p}>{p}</option>)}</Select></Field>
            {form.period === "Haftalık" && (
              <Field label="Haftanın Günü"><Select value={form.scheduleDay || ""} onChange={(e) => setForm((f) => ({ ...f, scheduleDay: e.target.value }))}>
                <option value="">— Belirtilmedi —</option>
                {HAFTA_GUNLERI.map((g) => <option key={g}>{g}</option>)}
              </Select></Field>
            )}
            {form.period === "Aylık" && (
              <Field label="Ayın Günü"><Select value={form.scheduleDay || ""} onChange={(e) => setForm((f) => ({ ...f, scheduleDay: e.target.value }))}>
                <option value="">— Belirtilmedi —</option>
                {AY_GUNLERI.map((g) => <option key={g} value={g}>{g}</option>)}
              </Select></Field>
            )}
            {department === "Teknik" && (
              <Field label="Ekip"><Select value={form.role || ""} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="">— Belirtilmedi —</option>
                {MAHAL_ROLES.map((r) => <option key={r}>{r}</option>)}
              </Select></Field>
            )}
          </div>
          {form.period === "Günlük" && (
            <div style={{ marginTop: 10 }}>
              <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.3 }}>Vardiyalar (opsiyonel)</div>
              <p style={{ margin: "0 0 8px", fontSize: 11.5, color: T.dimmer }}>Günde birden fazla kez tekrar eden kontrol için — ör. Güvenlik Devriyesi'nde gündüz/gece vardiyası. Boş bırakılırsa günde tek kontrol yeterli olur.</p>
              {(form.shifts || []).map((s, i) => (
                <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <Input value={s.label} onChange={(e) => updateShift(i, { label: e.target.value })} placeholder="Vardiya adı (ör. Gündüz Vardiyası)" style={{ flex: 1 }} />
                  <Input type="time" value={s.start} onChange={(e) => updateShift(i, { start: e.target.value })} style={{ width: 110 }} />
                  <span style={{ color: T.dim, fontSize: 12 }}>–</span>
                  <Input type="time" value={s.end} onChange={(e) => updateShift(i, { end: e.target.value })} style={{ width: 110 }} />
                  <button onClick={() => removeShift(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E2685A", flexShrink: 0 }}><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={addShift} style={{ background: "none", border: "none", color: T.accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "4px 0 12px" }}>+ Vardiya Ekle</button>
            </div>
          )}
          <div style={{ marginTop: 6, marginBottom: 4, fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.3 }}>Kontrol Soruları</div>
          {form.questions.map((q, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <Input value={q.text} onChange={(e) => updateQuestion(i, { text: e.target.value })} placeholder="Soru metni…" style={{ flex: 1 }} />
              <Select value={q.failOn} onChange={(e) => updateQuestion(i, { failOn: e.target.value })} style={{ width: 150 }}>
                <option value="Hayır">Hatalı cevap: Hayır</option>
                <option value="Evet">Hatalı cevap: Evet</option>
              </Select>
              <button onClick={() => removeQuestion(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E2685A", flexShrink: 0 }}><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={addQuestion} style={{ background: "none", border: "none", color: T.accent, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: "4px 0 12px" }}>+ Soru Ekle</button>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={savePoint}>Kaydet</Button>
            <Button variant="quiet" onClick={() => setFormOpen(false)}>Vazgeç</Button>
          </div>
        </Card>
      )}

      {mobileMode ? (
        <MobileMahalList points={points} state={state}
          onFill={(p, loc, shift) => setFillPoint({ point: p, location: loc, shift })}
          onQrFloor={(p, g) => setQrPoint({ point: p, floorGroup: g })}
          onQr={(p, loc) => setQrPoint({ point: p, location: loc })}
          onOpenNonConformity={(p, loc) => setNcTarget({ point: p, location: loc })} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 12 }}>
          {points.length === 0 && <p style={{ color: T.dim, fontSize: 13 }}>Henüz mahal tanımlanmadı.</p>}
          {points.map((p) => (
            p.perFloor ? (
              <PerFloorCard key={p.id} point={p} locations={getLocations(p, state)} runs={state.mahalRuns} tasks={state.tasks}
                onFill={(loc, shift) => setFillPoint({ point: p, location: loc, shift })} onQrFloor={(g) => setQrPoint({ point: p, floorGroup: g })} onQr={(loc) => setQrPoint({ point: p, location: loc })}
                onEdit={() => startEdit(p)} onDelete={() => removePoint(p.id)} onOpenNonConformity={(loc) => setNcTarget({ point: p, location: loc })} canWrite={canWrite}
                initialQuery={floorFocus?.pointId === p.id ? floorPhrase(floorFocus.floorLabel) : undefined} />
            ) : (() => {
              const run = runFor(p, state.mahalRuns);
              const done = run?.status === "Tamamlandı";
              const nc = hasNonConformity(p, state);
              return (
                <Card key={p.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: `${T.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <ClipboardCheck size={17} color={T.accent} strokeWidth={1.8} />
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => setQrPoint({ point: p, location: null })} title="QR kodu" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.dim }}><QrCode size={13} /></button>
                      {canWrite && <button onClick={() => startEdit(p)} title="Düzenle" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.dim }}><Pencil size={13} /></button>}
                      {canWrite && <button onClick={() => removePoint(p.id)} title="Sil" style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={13} color="#E2685A" /></button>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{p.name}</div>
                    {p.role && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, borderRadius: 999, padding: "2px 7px", textTransform: "uppercase", letterSpacing: 0.3,
                        color: p.role === "Elektrik" ? "#E0B354" : "#5B9BD9", background: p.role === "Elektrik" ? "rgba(224,179,84,0.14)" : "rgba(91,155,217,0.14)",
                      }}>{p.role}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.dim, marginTop: 2 }}>{p.assetDesc || "—"}</div>
                  {p.floorLabel && <div style={{ fontSize: 10.5, color: T.dimmer, marginTop: 3 }}>Kat Planı: <span style={{ color: T.dim, fontWeight: 700 }}>{locationLabel({ floor: p.floorLabel, side: p.side, unit: p.unitNo })}</span></div>}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: T.accent, textTransform: "uppercase" }}>{p.period}{scheduleLabel(p)}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {nc && <button onClick={() => setNcTarget({ point: p, location: null })} title="Uygunsuzluk var — bilgi için tıklayın" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}><AlertTriangle size={13} color="#E2685A" /></button>}
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: done ? "#3FB37F" : "#E0B354" }}>{done ? `✓ ${run.completedBy}` : "Bekliyor"}</span>
                    </span>
                  </div>
                  <Button variant="ghost" style={{ width: "100%", marginTop: 10, justifyContent: "center" }} onClick={() => setFillPoint({ point: p, location: null })}>{done ? "Tekrar Görüntüle" : "Kontrol Et"}</Button>
                </Card>
              );
            })()
          ))}
        </div>
      )}

      {/* Kullanıcı teyidiyle: "mahal kontrol ekranına tıkladığında sadece
          mahal kontrol formları gelmeli ki başka alanlara giriş olmasın" —
          bu iş emri listesi (düzenleme/silme dahil) admin/masaüstü alanı,
          mobilde hiç gösterilmiyor (Görevler zaten Ana Sayfa kısayolundan
          kendi mobil ekranında, sadece kart açarak erişilebiliyor). */}
      {!mobileMode && (
        <div style={{ marginTop: 28 }}>
          <PageHeader title="Mahal Kontrol İş Emirleri" subtitle={`${mahalTasks.length} kayıt — bu mahallerdeki başarısız kontrollerden otomatik açılır`} />
          {taskFormOpen && canWrite && (
            <TaskForm form={taskForm} setForm={setTaskForm} lockDepartment={department} onSave={saveTask} onCancel={() => setTaskFormOpen(false)} />
          )}
          <TaskList tasks={mahalTasks} onEdit={startEditTask} onDelete={removeTask} showDept={false} emptyText="Henüz bu mahallerden açılmış bir iş emri yok." canWrite={canWrite} />
        </div>
      )}

      {fillPoint && (
        <FillModal point={fillPoint.point} location={fillPoint.location} shift={fillPoint.shift} meters={resolveMeters(state, fillPoint.point, fillPoint.location)} state={state}
          run={runFor(fillPoint.point, state.mahalRuns, fillPoint.location?.key, fillPoint.shift?.id)} team={state.team.filter((t) => t.department === fillPoint.point.department)} currentUser={currentUser} assets={state.assets}
          onSubmit={submitFill} onClose={() => setFillPoint(null)} onQuickRequest={() => startQuickRequest(fillPoint)} onStartTask={() => startMahalTask(fillPoint)}
          onUpdateEquipment={canWrite && fillPoint.point.department === "Teknik" && !fillPoint.point.perFloor ? () => { setEquipEditPoint(fillPoint.point); setFillPoint(null); } : null} />
      )}
      {qrPoint && <QrModal point={qrPoint.point} location={qrPoint.location} floorGroup={qrPoint.floorGroup} onClose={() => setQrPoint(null)} />}
      {ncTarget && <NonConformityPanel point={ncTarget.point} location={ncTarget.location} state={state} onClose={() => setNcTarget(null)} />}
      {equipEditPoint && (
        <EquipmentQuickEditModal point={equipEditPoint} assets={state.assets} onSave={saveEquipment} onClose={() => setEquipEditPoint(null)} />
      )}
    </div>
  );
}
