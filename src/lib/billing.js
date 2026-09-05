// Su/Doğalgaz faturalama — kullanıcı teyidiyle: bağımsız bölümlerin (kiracı)
// su sayaçlarını personel her ay okuyor, İSKİ faturasındaki toplam tutar /
// toplam tüketim = birim fiyat, bölümün kendi tüketimi × birim fiyat = o
// bölümün payı. Doğalgazda sayaç YOK — fatura toplam m²'ye bölünüp her bölüme
// kendi alanı oranında yansıtılıyor (piramitData.js'teki mevcut unit.area
// kullanılıyor, uydurma veri yok).
import { latestReading } from "./meterValidation.js";
import { newUnitId } from "../piramitData.js";

export const SIDE_ABBR = { "Beşiktaş": "B", "Sarıyer": "S" };

// Binadaki tüm bağımsız bölümleri (kat + kat içindeki unit) düz bir listeye
// çevirir — units dizisi olan HER kat (çoğunlukla type:"kat", ama artık
// otopark katlarında da tekil bölüm olabilir, bkz. 2B/İNCO-Gülman).
export function allUnits(floors) {
  const out = [];
  (floors || []).forEach((f) => {
    if (!f.units || f.units.length === 0) return;
    f.units.forEach((u) => out.push({ unit: u, floorId: f.id, floorLabel: f.label }));
  });
  return out;
}

export function metersForUnit(waterMeters, floorId, unitId) {
  return (waterMeters || []).filter((m) => !m.archived && m.unitRef && m.unitRef.floorId === floorId && m.unitRef.unitId === unitId);
}

// Kullanıcı teyidiyle: "Sayaç okumada ortak alan sayacı olan katlar
// gözüksün" — Enerji > Su Okuma'dan eklenen sayaçların hepsi bir bağımsız
// bölüme (unitRef) bağlı değil; kat geneli/ortak alan sayaçları sadece
// floorLabel taşır (bkz. Enerji.jsx onAddMeter). SayacOkuma.jsx'in mobil
// kat→bölüm akışı eskiden SADECE metersForUnit'e (unitRef zorunlu)
// bakıyordu, bu yüzden ortak alan sayaçlarına hiç ulaşılamıyordu.
export function commonMetersForFloor(waterMeters, floorLabel) {
  return (waterMeters || []).filter((m) => !m.archived && !m.unitRef && m.floorLabel === floorLabel);
}

// Algoritmik sayaç no'su — kullanıcı teyidiyle: "sayaç noda algoritmik
// blokblöm mantığında ilerlesin". SU_<kat>_<BlokHarfi><bölümNo>, ör. "SU_7_B19".
// Aynı bölüme ikinci sayaç eklenirse "_02" soneki eklenir.
export function generateMeterId(existingMeters, floorLabel, side, unitNo) {
  const base = `SU_${floorLabel}_${SIDE_ABBR[side] || ""}${unitNo ?? "?"}`;
  const existingIds = new Set((existingMeters || []).map((m) => m.id));
  if (!existingIds.has(base)) return base;
  let n = 2;
  while (existingIds.has(`${base}_${String(n).padStart(2, "0")}`)) n += 1;
  return `${base}_${String(n).padStart(2, "0")}`;
}

// Kullanıcı teyidiyle: "malikteki espriyi kiracıda da yapman lazımdı. malik
// ve kiracı bilgisini firma dizininden alması lazım... personel kartı gibi
// düşün, firma kodu firma adı e-mail gsm yetkili kişi bilgisinin de olduğu
// bir alan". TEK bir kalıcı Firma kimliği (state.companies) — hem malik hem
// kiracı aynı kart yapısını kullanır, biri birden fazla bölüme sahip/kiracı
// olabilir. Kat Planı ve Malik/Kiracı ekranı bu KART'a bağlanır, kendi kopya
// verisini tutmaz.
// { id, code, name, email, gsm, contactPerson, note, malikUnitIds:[], kiraciUnitIds:[] }
export function companiesForUnit(companies, unitId) {
  return (companies || []).filter((c) => (c.kiraciUnitIds || []).includes(unitId));
}
export function maliklarForUnit(companies, unitId) {
  return (companies || []).filter((c) => (c.malikUnitIds || []).includes(unitId));
}

// Güvenlik ağı: aynı isimdeki (baş/son boşluk ve büyük/küçük harf farkı
// gözetmeden) firma kartları TEK kayıtta birleştirilir — malik/kiracı bölüm
// bağlantıları birleştirilir (union), e-posta/GSM/yetkili kişi/not boş
// olmayan ilk değer korunur. Adı hiç girilmemiş (tamamen boş isim) kayıtlar
// (önceki hatalı bir birleştirmeden kalmış olabilir) temizlenir — sadece isim
// eksikse. Kullanıcı teyidiyle: Firma Dizini'nden "Yeni Firma" ile önce sadece
// isim girilip bölüm ataması SONRA yapılabilmeli ("firma önce tanımlanır,
// sonra atanır") — bu yüzden ismi olan ama henüz hiçbir bölüme atanmamış/
// iletişim bilgisi boş kartlar ARTIK silinmiyor. Kodlar sırayla yeniden
// üretilir. Her migrateLegacyState çağrısında çalışır — idempotent, veri
// kaybetmez.
export function dedupeFirms(companies) {
  const groups = new Map();
  (companies || []).forEach((c) => {
    const key = normalizeFirmKey(c.name);
    if (!key) return;
    if (!groups.has(key)) {
      groups.set(key, { ...c, malikUnitIds: [...(c.malikUnitIds || [])], kiraciUnitIds: [...(c.kiraciUnitIds || [])] });
    } else {
      const g = groups.get(key);
      g.malikUnitIds = [...new Set([...g.malikUnitIds, ...(c.malikUnitIds || [])])];
      g.kiraciUnitIds = [...new Set([...g.kiraciUnitIds, ...(c.kiraciUnitIds || [])])];
      g.email = g.email || c.email || "";
      g.gsm = g.gsm || c.gsm || "";
      g.contactPerson = g.contactPerson || c.contactPerson || "";
      g.note = g.note || c.note || "";
      // Arşivlenmiş bir kayıt, aynı isimle sonradan açılan aktif bir kayıtla
      // birleşirse "arşivlenmiş" etiketi kaybolmalı — aksi halde yeni/aktif
      // bölüm ataması yanlışlıkla Firma Dizini'nden gizlenir.
      if (!c.archived) { g.archived = false; g.archivedAt = undefined; }
    }
  });
  return [...groups.values()].map((c, i) => ({ ...c, code: `FRM_${String(i + 1).padStart(3, "0")}` }));
}

// Firma adlarını karşılaştırırken kullanılan TEK normalize fonksiyonu —
// kullanıcı teyidiyle bulunan hata: düz `.toLowerCase()` Türkçe "İ" harfini
// "i" değil "i̇" (nokta + birleşik işaret) yapar, "I" ise "i" olur — yani
// "İNCO" ve "INCO"/"inco" aynı firma olduğu halde FARKLI kayıt olarak
// açılıyordu. İLK denemede `toLocaleLowerCase("tr-TR")` kullanıldı ama bu
// da YANLIŞ çıktı: Türkçe kuralında büyük "I" küçükte NOKTASIZ "ı" olur
// ("İ" ise noktalı "i") — yani "İNCO"→"inco" ama "INCO"/"Inco" (elle
// girilen veride neredeyse hep düz ASCII "I")→"ınco" olup YİNE eşleşmiyordu
// (bkz. malik/kiracıdan çıkarılan kayıt geri geliyor hatası: normalizeFirmKey
// unit.tenants'taki adla eşleşmeyince eski string hiç temizlenmiyordu).
// Doğru çözüm: "İ"/"I"/"ı" hepsini TEK harfe ("i") indirgeyip öyle
// küçültmek — dilbilgisel doğruluk değil, veri girişindeki tutarsız I/İ
// kullanımını tolere eden bir eşleştirme istiyoruz. Firma adı karşılaştırılan
// HER yerde (upsertFirmUnit, dedupeFirms, unassignFirmFromUnit, yeni firma
// açarken benzersizlik kontrolü) bu fonksiyon kullanılmalı.
export function normalizeFirmKey(name) {
  return (name || "").trim().replace(/[İIı]/g, "i").toLowerCase();
}

// Firma kendi kodu — bölümden BAĞIMSIZ, sabit kimlik (bir firma birden fazla
// bölüme sahip/kiracı olabildiği için tek bir "B14A_K" gibi bölüm koduna
// bağlanamaz). Sıralı: FRM_001, FRM_002...
export function nextFirmCode(companies) {
  const nums = (companies || []).map((c) => {
    const m = /^FRM_(\d+)$/.exec(c.code || "");
    return m ? parseInt(m[1], 10) : 0;
  });
  const next = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
  return `FRM_${String(next).padStart(3, "0")}`;
}

// İsme göre bul-ya-da-oluştur: aynı isimde firma zaten varsa unitId'yi ilgili
// rol dizisine ekler (tekrar eklemez), yoksa yeni firma kartı açar. Böylece
// aynı firma (malik ya da kiracı olarak) birden fazla bölüme/split işlemine
// tekrar tekrar atanınca kopya kayıt oluşmaz — tek kimlik altında birikir.
export function upsertFirmUnit(companies, name, unitId, role) {
  const trimmed = (name || "").trim();
  if (!trimmed) return companies || [];
  const list = companies || [];
  const key = role === "malik" ? "malikUnitIds" : "kiraciUnitIds";
  const idx = list.findIndex((c) => normalizeFirmKey(c.name) === normalizeFirmKey(trimmed));
  if (idx === -1) {
    const base = { id: `cmp_${Date.now()}_${list.length}`, code: nextFirmCode(list), name: trimmed, email: "", gsm: "", contactPerson: "", note: "", malikUnitIds: [], kiraciUnitIds: [] };
    base[key] = [unitId];
    return [...list, base];
  }
  if ((list[idx][key] || []).includes(unitId)) return list;
  return list.map((c, i) => (i === idx ? { ...c, [key]: [...(c[key] || []), unitId] } : c));
}

// Malik/Kiracı ekranından bir bağlantıyı kaldırınca kaydın "geri gelmesi"
// hatası — kullanıcı teyidiyle bulundu: unassign sadece companies'i
// güncelliyordu, ama unit.owner/unit.tenants (piramitData.js'ten gelen ESKİ
// string alanları) hiç temizlenmiyordu. backfillFirms HER migrateLegacyState
// çağrısında (yani hemen her Firestore senkronunda) bu eski string'leri
// tarayıp eksik bağlantıyı otomatik geri ekliyordu. Artık ikisi ATOMIK
// güncellenir: companies'ten unitId çıkar VE aynı unit'in owner/tenants
// alanından o firmanın adı çıkar — owner "İNCO / Gülman" gibi birleşik
// olabilir, sadece eşleşen parça çıkarılır (kalan parça korunur).
export function unassignFirmFromUnit(floors, companies, unitId, companyId, role) {
  const company = (companies || []).find((c) => c.id === companyId);
  const key = role === "malik" ? "malikUnitIds" : "kiraciUnitIds";
  const nextCompanies = (companies || []).map((c) => (c.id === companyId ? { ...c, [key]: (c[key] || []).filter((id) => id !== unitId) } : c));
  if (!company) return { floors, companies: nextCompanies };
  const nameKey = normalizeFirmKey(company.name);
  const nextFloors = (floors || []).map((f) => {
    if (!f.units || !f.units.some((u) => u.id === unitId)) return f;
    return {
      ...f,
      units: f.units.map((u) => {
        if (u.id !== unitId) return u;
        if (role === "malik") {
          const parts = (u.owner || "").split(" / ").filter((p) => normalizeFirmKey(p) !== nameKey);
          return { ...u, owner: parts.length > 0 ? parts.join(" / ") : null };
        }
        return { ...u, tenants: (u.tenants || []).filter((t) => normalizeFirmKey(t) !== nameKey) };
      }),
    };
  });
  return { floors: nextFloors, companies: nextCompanies };
}

// Firma Dizini'nden bir firmayı TAMAMEN silme — kullanıcı teyidiyle bulunan
// hata: "bağlantısı olmayan kartı sildiğimde tekrar eski bölümlere
// atanıyor". Sebep: companies'te malikUnitIds/kiraciUnitIds boş görünse
// bile (Firma Dizini'nde "bağlantı yok" yazsa bile), o firmanın adı hâlâ
// piramitFloors'daki ham owner/tenants string'lerinde bir yerde kalmış
// olabilir (unassignFirmFromUnit sadece TEK bir bölümden çıkarırken o
// bölümün string'ini temizliyordu — ama bu fonksiyon çağrılmadan, ör. eski
// bir sürümde veya hiç dokunulmamış bir birleşik owner'da, isim string'te
// kalmaya devam edebilir). Silme sırasında sadece companies'ten değil,
// TÜM katlardaki owner/tenants alanlarından da bu isim temizlenmezse,
// bir sonraki backfillFirms geçişi (her Firestore senkronunda çalışır) o
// ismi "yeni" bir firma sanıp companies'e GERİ EKLER — silinen kart, eski
// bölümleriyle birlikte diriliyormuş gibi görünür. Bu fonksiyon o kaynağı
// kurutur: firma HEM companies'ten HEM de tüm birimlerin owner/tenants
// string'lerinden aynı anda silinir.
export function removeFirmEverywhere(floors, companies, companyId) {
  const company = (companies || []).find((c) => c.id === companyId);
  const nextCompanies = (companies || []).filter((c) => c.id !== companyId);
  if (!company) return { floors, companies: nextCompanies };
  const nameKey = normalizeFirmKey(company.name);
  const nextFloors = (floors || []).map((f) => {
    if (!f.units || f.units.length === 0) return f;
    return {
      ...f,
      units: f.units.map((u) => {
        let owner = u.owner;
        if (owner) {
          const parts = owner.split(" / ").filter((p) => normalizeFirmKey(p) !== nameKey);
          owner = parts.length > 0 ? parts.join(" / ") : null;
        }
        const tenants = (u.tenants || []).filter((t) => normalizeFirmKey(t) !== nameKey);
        return { ...u, owner, tenants };
      }),
    };
  });
  return { floors: nextFloors, companies: nextCompanies };
}

// Firma Dizini'ndeki HER firma için kod/e-posta/GSM/yetkili kişi girilebilsin
// diye — mevcut owner/tenants string'lerinden henüz firma kartı olmayanlar
// için otomatik, idempotent kayıt üretir (var olanı asla değiştirmez/silmez
// — her yüklemede güvenle tekrar çalıştırılabilir). Kaynak veride birden
// fazla malik aynı "İNCO / Gülman" gibi TEK bir owner string'inde birleşik
// olabilir (bkz. 2B otoparkı, piramitData.js) — kullanıcı teyidiyle bu İKİ
// AYRI malik'tir, tek bir "İNCO / Gülman" adında hayalet firma değil; " / "
// ile bölünüp her biri kendi firma kartına ayrı ayrı malik olarak eklenir
// (firmsAtFloorSide'daki aynı bölme mantığıyla tutarlı).
export function backfillFirms(floors, companies) {
  let next = companies || [];
  allUnits(floors).forEach(({ unit }) => {
    if (unit.owner) unit.owner.split(" / ").forEach((name) => { if (name.trim()) next = upsertFirmUnit(next, name.trim(), unit.id, "malik"); });
    (unit.tenants || []).forEach((name) => { if (name) next = upsertFirmUnit(next, name, unit.id, "kiraci"); });
  });
  return next;
}

// Bölünmüş/atanmış bir bölümde kiracı firma kartı varsa oradaki isimler
// kullanılır (kiracı varsa kiracının adı öncelikli — faturayı fiilen kullanan
// taraf), yoksa eski tenants string alanına düşülür. Kiracı hiç yoksa MALİK
// gösterilir (önce yeni firma kartı, sonra eski owner string) — kullanıcı
// teyidiyle: "malik varsa maliğin adı gelir kiracı varsa kiracının adı
// gelir". Önceki sürüm malik firma kartlarına hiç bakmıyordu, bu yüzden
// sadece Malik/Kiracı'dan malik atanmış (kiracısız) bölümler fatura
// dökümünde "—" görünüyordu.
export function unitDisplayName(unit, companies) {
  const tenants = companiesForUnit(companies, unit.id);
  if (tenants.length > 0) return tenants.map((c) => c.name).join(", ");
  if ((unit.tenants || []).length > 0) return unit.tenants.join(", ");
  const owners = maliklarForUnit(companies, unit.id);
  if (owners.length > 0) return owners.map((c) => c.name).join(", ");
  return unit.owner || "—";
}

// Bir sayaç grubunun (birden fazla olabilir) belirli bir dönemdeki tüketimi:
// dönem başlangıcından ÖNCEKİ en son okuma = ilk okuma (yoksa bu sayaç hesaba
// katılmaz), dönem sonuna kadarki en son okuma = son okuma, fark toplanır.
export function meterGroupConsumption(readings, meterIds, valueField, periodStart, periodEnd) {
  let total = 0;
  let hasData = false;
  meterIds.forEach((meterId) => {
    const before = (readings || []).filter((r) => r.meterId === meterId && !r.archived && r.date < periodStart);
    const upTo = (readings || []).filter((r) => r.meterId === meterId && !r.archived && r.date <= periodEnd);
    if (upTo.length === 0 || before.length === 0) return;
    const son = upTo.reduce((a, b) => (a.date >= b.date ? a : b));
    const ilk = before.reduce((a, b) => (a.date >= b.date ? a : b));
    total += son[valueField] - ilk[valueField];
    hasData = true;
  });
  return { consumption: total, hasData };
}

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

// Su/doğalgaz okuma tablosundaki ay sütunları — kullanıcının paylaştığı Excel
// gibi ("Ara.25, Ocak.26, Şubat.26...") sabit değil, mevcut okuma verisindeki
// EN ERKEN ve EN GEÇ tarih arasındaki her ay otomatik üretilir (yeni ay
// okuması eklendikçe tablo kendiliğinden genişler).
export function buildMonthlyPeriods(readings) {
  if (!readings || readings.length === 0) return [];
  const dates = readings.map((r) => r.date).sort();
  let [y, m] = dates[0].slice(0, 7).split("-").map(Number);
  const [ly, lm] = dates[dates.length - 1].slice(0, 7).split("-").map(Number);
  const periods = [];
  while (y < ly || (y === ly && m <= lm)) {
    const mm = String(m).padStart(2, "0");
    const lastDay = new Date(y, m, 0).getDate();
    periods.push({ key: `${y}-${mm}`, label: `${TR_MONTHS[m - 1]}.${String(y).slice(2)}`, start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, "0")}` });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return periods;
}

// Doğalgaz faturası sayaç okumasına dayanmaz (m²'ye bölünür) — kullanıcı
// teyidiyle: "doğalgaz faturası m2 göre bölünüyor o yüzden ilk okuma son
// okuma yok". Bu yüzden dönem seçimi buildMonthlyPeriods (okuma verisinden
// türetilen) yerine bugünden geriye doğru sabit bir takvim listesi kullanır —
// okuma girilmiş olsun olmasın her zaman dönem seçilebilir.
export function buildCalendarPeriods(monthsBack = 24) {
  const now = new Date();
  let y = now.getFullYear(), m = now.getMonth() + 1 - (monthsBack - 1);
  while (m < 1) { m += 12; y -= 1; }
  const endY = now.getFullYear(), endM = now.getMonth() + 1;
  const periods = [];
  while (y < endY || (y === endY && m <= endM)) {
    const mm = String(m).padStart(2, "0");
    const lastDay = new Date(y, m, 0).getDate();
    periods.push({ key: `${y}-${mm}`, label: `${TR_MONTHS[m - 1]}.${String(y).slice(2)}`, start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, "0")}` });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return periods;
}

// Bir sayacın verilen dönem içindeki EN SON okuması (dönemin "son okuma"sı —
// bir sonraki dönemin de "ilk okuma"sı budur, kümülatif sayaç mantığında).
export function meterReadingInPeriod(readings, meterId, periodStart, periodEnd, valueField = "meterM3") {
  const inRange = (readings || []).filter((r) => r.meterId === meterId && !r.archived && r.date >= periodStart && r.date <= periodEnd);
  if (inRange.length === 0) return null;
  return inRange.reduce((a, b) => (a.date >= b.date ? a : b))[valueField];
}

// Kullanıcı teyidiyle: "sayaçları bölüm bazlı listeleyip exceldeki gibi ilk
// okuma son okuma göstermen lazım, sayaç adı, ocak şubat mart gibi
// dönemlerdeki son okuma verisi". Her sayaç için bir satır, bölüm/kat'a göre
// sıralı, her ay sütununda o ayki son okuma. Bölüme bağlı olmayan (ortak
// alan) sayaçlar en altta ayrı gösterilir.
export function buildMeterReadingTable(state, meters, valueField = "meterM3") {
  const readings = meters === state.gasMeters ? state.gasReadings : state.waterReadings;
  const periods = buildMonthlyPeriods(readings);
  const unitByMeter = new Map();
  allUnits(state.piramitFloors).forEach(({ unit, floorId, floorLabel }) => {
    metersForUnit(meters, floorId, unit.id).forEach((m) => unitByMeter.set(m.id, { unit, floorId, floorLabel }));
  });
  const rows = (meters || []).map((m) => {
    const loc = unitByMeter.get(m.id);
    const tenant = loc ? unitDisplayName(loc.unit, state.companies) : null;
    return {
      meterId: m.id,
      meterName: m.name,
      floorLabel: loc ? loc.floorLabel : m.floorLabel || "—",
      unitNo: loc ? loc.unit.no : null,
      tenant: tenant || (loc ? "—" : "Ortak Alan"),
      isCommon: !loc,
      values: periods.map((p) => meterReadingInPeriod(readings, m.id, p.start, p.end, valueField)),
    };
  });
  rows.sort((a, b) => {
    if (a.isCommon !== b.isCommon) return a.isCommon ? 1 : -1;
    const na = parseUnitNo(a.unitNo), nb = parseUnitNo(b.unitNo);
    if (na !== nb) return na - nb;
    return a.meterName.localeCompare(b.meterName, "tr");
  });
  return { periods, rows };
}
export function parseUnitNo(no) {
  if (no == null || no === "") return Infinity;
  const n = parseInt(String(no), 10);
  return Number.isNaN(n) ? Infinity : n;
}

// Her bağımsız bölümün, verilen dönemdeki su tüketimi — sadece en az bir
// sayacı olan VE o dönemde okuma verisi bulunan bölümler listelenir.
export function unitWaterConsumptionRows(state, periodStart, periodEnd) {
  const rows = [];
  allUnits(state.piramitFloors).forEach(({ unit, floorId, floorLabel }) => {
    const meters = metersForUnit(state.waterMeters, floorId, unit.id);
    if (meters.length === 0) return;
    const { consumption, hasData } = meterGroupConsumption(state.waterReadings, meters.map((m) => m.id), "meterM3", periodStart, periodEnd);
    if (!hasData) return;
    rows.push({ floorId, unitId: unit.id, floorLabel, unitNo: unit.no, tenant: unitDisplayName(unit, state.companies), consumption, meterCount: meters.length });
  });
  return rows;
}

// Bir bölümün su sayaçlarının, verilen dönemdeki ilk/son okuma detayı —
// gerçek okuma tarih/değerlerini göstermek için. meterGroupConsumption ile
// AYNI eşleşme mantığı (dönem başından önceki
// son okuma = ilk okuma, dönem sonuna kadarki son okuma = son okuma) ama
// toplam yerine ham okuma kayıtlarını (tarih+değer) döner — uydurma veri yok.
export function unitWaterMeterDetail(waterMeters, waterReadings, floorId, unitId, periodStart, periodEnd) {
  const meters = metersForUnit(waterMeters, floorId, unitId);
  const rows = [];
  meters.forEach((m) => {
    const before = (waterReadings || []).filter((r) => r.meterId === m.id && !r.archived && r.date < periodStart);
    const upTo = (waterReadings || []).filter((r) => r.meterId === m.id && !r.archived && r.date <= periodEnd);
    if (upTo.length === 0 || before.length === 0) return;
    const son = upTo.reduce((a, b) => (a.date >= b.date ? a : b));
    const ilk = before.reduce((a, b) => (a.date >= b.date ? a : b));
    rows.push({ meterId: m.id, meterName: m.name, ilkTarih: ilk.date, ilkDeger: ilk.meterM3, sonTarih: son.date, sonDeger: son.meterM3, tuketim: son.meterM3 - ilk.meterM3 });
  });
  return rows;
}

// Su faturası hesaplaması: birim fiyat = totalAmount / totalConsumptionM3
// (fatura üzerinde manuel override yoksa tüm bölüm sayaçlarının o dönemki
// tüketim toplamı kullanılır). Bölüm tutarı = kendi tüketimi × birim fiyat.
export function computeWaterBilling(state, invoice) {
  const rows = unitWaterConsumptionRows(state, invoice.periodStart, invoice.periodEnd);
  const totalConsumption = rows.reduce((s, r) => s + r.consumption, 0);
  const denom = invoice.totalConsumptionM3 != null && invoice.totalConsumptionM3 !== "" ? Number(invoice.totalConsumptionM3) : totalConsumption;
  const pricePerM3 = denom > 0 ? invoice.totalAmount / denom : 0;
  return {
    pricePerM3,
    totalConsumption,
    denom,
    lines: rows.map((r) => ({ ...r, charge: r.consumption * pricePerM3 })),
  };
}

// Bir bölümün doğalgaz faturalamasına dahil olup olmadığı — kullanıcı
// isteğiyle: "bölümlerde doğalgaz faturalama tiki olsun, tik olanların m2
// toplamına göre faturalandırsın". Alan varsayılan TRUE (geriye dönük uyumlu
// — mevcut bölümlerin hiçbiri elle "hariç" işaretlenmediği sürece davranış
// değişmez), Kat Planı > Malik/Kiracı'dan kişi bazında false yapılabilir
// (ör. doğalgazı olmayan/kendi ısıtmasını kullanan bir bölüm için).
export function isGasBillable(unit) {
  return unit.gasBillable !== false;
}

// Doğalgaz faturası hesaplaması: sayaç yok — sadece isGasBillable=true VE
// alanı tanımlı bölümler hesaba katılır. Birim fiyat (m²) = totalAmount /
// totalM2 (fatura üzerinde override yoksa dahil edilen bölümlerin m²
// toplamı — kullanıcı teyidiyle: "tik olanların m2 toplamına göre").
// Bölüm tutarı = unit.area × birim fiyat m².
export function computeGasBilling(state, invoice) {
  const billable = allUnits(state.piramitFloors).filter(({ unit }) => unit.area != null && isGasBillable(unit));
  const billableM2Sum = billable.reduce((s, { unit }) => s + unit.area, 0);
  const totalM2 = invoice.totalM2 != null && invoice.totalM2 !== "" ? Number(invoice.totalM2) : billableM2Sum;
  const pricePerM2 = totalM2 > 0 ? invoice.totalAmount / totalM2 : 0;
  const lines = billable.map(({ unit, floorId, floorLabel }) => ({
    floorId, unitId: unit.id, floorLabel, unitNo: unit.no, tenant: unitDisplayName(unit, state.companies),
    area: unit.area, charge: unit.area * pricePerM2,
  }));
  return { pricePerM2, totalM2, billableM2Sum, lines };
}

// Bir FİRMA'nın (ya da tekil unit_<id> grubunun) TEK bir dönemdeki ödenen
// tutarı — kullanıcı teyidiyle: "fatura başına tek ödenen tutar alanı...
// bir firmanın birden fazla bağımsız bölümde olduğunda hepsini tek bir
// faturada toplayacaksın" — bu yüzden `key` artık companyId (ya da
// unassigned birim için unit_<id>), unitId DEĞİL. Kayıt yoksa 0 döner.
export function invoicePaymentFor(payments, key, periodStart) {
  const rec = (payments || []).find((p) => p.key === key && p.periodStart === periodStart);
  return rec ? rec.paidAmount : 0;
}

// Ek soğutma/ısıtma bedeli — kullanıcı teyidiyle: "fatura toplamı / toplam
// saat = birim fiyat, birim fiyat × ekstra saat = bedel — böylelikle hem
// ısıtmayı hemde soğutmayı aynı mantıkla yapmış oluruz ve hak geçmemiş
// olur". Su/gaz ile BİREBİR aynı yöntem (fatura toplamı ÷ tüketim = birim
// fiyat) — burada "tüketim" = TOPLAM ÇALIŞMA SAATİ (bina normal saatleri +
// o dönemdeki tüm ekstra talepler). Normal saatlerin payı hiçbir firmaya
// yansıtılmıyor (ortak gider), sadece ekstra talep eden firma kendi
// saatinin bedelini öder — ama birim fiyat TÜM saate (normal+ekstra)
// bölünerek bulunuyor, bu da normal saatlerin de payını "sulandırıp" adil
// bir ortalama çıkarıyor. Kullanıcı teyidiyle doğrulandı: chiller/pompa
// sistemi ZON bazlı (tek kat için bile o zonun tüm pompaları çalışıyor),
// bu yüzden tek kata özel indirimli bir oran YOK — aynı birim fiyat.
export const DEFAULT_NORMAL_HOURS = { weekday: 12, saturday: 5 };

// Verilen dönemdeki (periodStart-periodEnd, dahil) bina NORMAL çalışma
// saatlerini takvimden hesaplar — hafta içi (Pzt-Cuma) × weekday saat,
// Cumartesi × saturday saat, Pazar 0. Kullanıcı teyidiyle: "Hafta içi
// 06:00–18:00 (12 saat), Cumartesi 09:00–14:00 (5 saat)".
export function normalOperatingHours(periodStart, periodEnd, hoursConfig) {
  const cfg = hoursConfig || DEFAULT_NORMAL_HOURS;
  let total = 0;
  const d = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);
  while (d <= end) {
    const day = d.getUTCDay();
    if (day >= 1 && day <= 5) total += cfg.weekday;
    else if (day === 6) total += cfg.saturday;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return total;
}

// invoice: { id, kind:"cooling"|"heating", periodStart, periodEnd,
// totalAmount, normalHours (opsiyonel manuel override), note }
export function climateRequestsInInvoice(requests, invoice) {
  return (requests || []).filter((r) => !r.archived && r.kind === invoice.kind && r.date >= invoice.periodStart && r.date <= invoice.periodEnd);
}
export function computeClimateBilling(state, invoice, hoursConfig) {
  const normalHours = invoice.normalHours != null && invoice.normalHours !== "" ? Number(invoice.normalHours) : normalOperatingHours(invoice.periodStart, invoice.periodEnd, hoursConfig || state.normalOperatingHours);
  const requests = climateRequestsInInvoice(state.climateRequests, invoice);
  const extraHoursTotal = requests.reduce((s, r) => s + Number(r.hours), 0);
  const totalHours = normalHours + extraHoursTotal;
  const pricePerHour = totalHours > 0 ? invoice.totalAmount / totalHours : 0;
  const lines = requests.map((r) => ({ requestId: r.id, unitId: r.unitId, floorId: r.floorId, date: r.date, hours: Number(r.hours), charge: Number(r.hours) * pricePerHour }));
  return { normalHours, extraHoursTotal, totalHours, pricePerHour, lines };
}
// Bir bölümün, belirli bir dönem+tür (soğutma/ısıtma) için toplam ek bedeli
// — o dönemde birden fazla talebi olabilir (aynı ayda 2 kez ekstra istemiş
// gibi), hepsi toplanır.
export function unitClimateCharge(state, unitId, invoice, hoursConfig) {
  if (!invoice) return 0;
  const result = computeClimateBilling(state, invoice, hoursConfig);
  return result.lines.filter((l) => l.unitId === unitId).reduce((s, l) => s + l.charge, 0);
}

// EK SOĞUTMA — kullanıcı teyidiyle: "soğutmalar için ne kadar elektrik
// kullandığımızı ölçemiyoruz, bu yüzden ek soğutma kW değeri üzerinden
// gidecek" — eski sabit-oran modeline dönüldü (fatura-tabanlı yöntem SADECE
// ısıtmada kalıyor). hours × kwhPerHour (state.coolingKwhPerHour, varsayılan
// 122) × pricePerKwh (talep girilirken elle girilir — o ayın bilinen
// elektrik ₺/kWh birim fiyatı, izole tüketim değil).
export function coolingRequestCharge(request, kwhPerHour) {
  return Number(request.hours) * (kwhPerHour || 122) * Number(request.pricePerKwh || 0);
}
export function unitCoolingChargeTotal(state, unitId, periodStart, periodEnd) {
  const kwhPerHour = state.coolingKwhPerHour || 122;
  return (state.climateRequests || [])
    .filter((r) => !r.archived && r.kind === "cooling" && r.unitId === unitId && r.date >= periodStart && r.date <= periodEnd)
    .reduce((s, r) => s + coolingRequestCharge(r, kwhPerHour), 0);
}

// Bir bölümün belirli bir dönemdeki TÜM ek çalışma satırları (soğutma +
// ısıtma karışık) — basılan faturada "bu ek taleplerin hepsi ayrıca
// gösterilecek" (kullanıcı teyidi) için kullanılır.
export function unitClimateLinesForPeriod(state, unitId, periodStart, periodEnd) {
  const lines = [];
  (state.climateRequests || []).forEach((r) => {
    if (r.archived || r.unitId !== unitId || r.date < periodStart || r.date > periodEnd) return;
    if (r.kind === "cooling") {
      const kwhPerHour = state.coolingKwhPerHour || 122;
      lines.push({ requestId: r.id, kind: "cooling", date: r.date, hours: Number(r.hours), charge: coolingRequestCharge(r, kwhPerHour), detail: `${kwhPerHour} kWh × ${r.pricePerKwh} ₺/kWh` });
    } else {
      const invoice = (state.climateInvoices || []).find((i) => !i.archived && i.kind === "heating" && r.date >= i.periodStart && r.date <= i.periodEnd);
      if (!invoice) { lines.push({ requestId: r.id, kind: "heating", date: r.date, hours: Number(r.hours), charge: 0, detail: "Isıtma faturası henüz girilmedi" }); return; }
      const b = computeClimateBilling(state, invoice);
      const line = b.lines.find((l) => l.requestId === r.id);
      lines.push({ requestId: r.id, kind: "heating", date: r.date, hours: Number(r.hours), charge: line ? line.charge : 0, detail: `${b.pricePerHour.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺/saat` });
    }
  });
  return lines;
}
export function unitClimateChargeTotal(state, unitId, periodStart, periodEnd) {
  return unitClimateLinesForPeriod(state, unitId, periodStart, periodEnd).reduce((s, l) => s + l.charge, 0);
}

// Kullanıcı teyidiyle: "bir firmanın birden fazla bağımsız bölümde olduğunda
// hepsini tek bir faturada toplayacaksın" — bölümleri KİRACI FİRMA'ya göre
// gruplar (companiesForUnit — bir firma birden fazla bölümün kiracısı
// olabilir). Firma kartı yoksa (henüz atanmamış eski bölüm) her biri kendi
// başına bir grup olur (tek bölümlük "firma").
export function groupUnitsByCompany(state, unitRows) {
  const byCompany = new Map();
  unitRows.forEach((u) => {
    const kiraci = companiesForUnit(state.companies, u.unitId);
    if (kiraci.length === 0) {
      byCompany.set(`unit_${u.unitId}`, { companyId: null, companyName: u.tenant, units: [u] });
      return;
    }
    kiraci.forEach((c) => {
      if (!byCompany.has(c.id)) byCompany.set(c.id, { companyId: c.id, companyName: c.name, units: [] });
      byCompany.get(c.id).units.push(u);
    });
  });
  return [...byCompany.values()].sort((a, b) => (a.companyName || "").localeCompare(b.companyName || "", "tr"));
}

// Bir FİRMA'nın (companyId ya da tekil unit_<id> grubu), verilen dönemdeki
// TÜM bölümlerinin toplam su+gaz+ek soğutma/ısıtma bedeli — kullanıcı
// teyidiyle: "hepsini tek bir faturada toplayacaksın... dipte toplam
// olacak". `unitIds`: o firmaya ait bölüm id listesi (groupUnitsByCompany
// çıktısından — malik değil, kiracı bağlantısı üzerinden).
export function companyChargeForPeriod(state, unitIds, period) {
  let charge = 0;
  const waterInvoice = (state.waterInvoices || []).find((i) => !i.archived && i.periodStart === period.periodStart);
  const gasInvoice = (state.gasInvoices || []).find((i) => !i.archived && i.periodStart === period.periodStart);
  const waterB = waterInvoice ? computeWaterBilling(state, waterInvoice) : null;
  const gasB = gasInvoice ? computeGasBilling(state, gasInvoice) : null;
  unitIds.forEach((unitId) => {
    if (waterB) { const l = waterB.lines.find((x) => x.unitId === unitId); if (l) charge += l.charge; }
    if (gasB) { const l = gasB.lines.find((x) => x.unitId === unitId); if (l) charge += l.charge; }
    charge += unitClimateChargeTotal(state, unitId, period.periodStart, period.periodEnd);
  });
  return charge;
}

// unitPastDebt'in FİRMA bazlı hali — kullanıcı teyidiyle: "geçmişten gelen
// borcu... hangi ayın ödemesini yapmadıysa... toplam borcunuz X TL'dir
// desin". invoicePayments artık companyId+periodStart ile anahtarlanır
// (bir firma birden fazla bölümü olsa da TEK ödeme yapar).
export function companyPastDebt(state, unitIds, currentPeriodStart, periods, paymentKey) {
  let debt = 0;
  const details = [];
  periods.filter((p) => p.periodStart < currentPeriodStart).forEach((p) => {
    const charge = companyChargeForPeriod(state, unitIds, p);
    if (charge <= 0.005) return;
    const paid = invoicePaymentFor(state.invoicePayments, paymentKey, p.periodStart);
    const balance = charge - paid;
    if (balance > 0.01) { debt += balance; details.push({ periodLabel: p.label, charge, paid, balance }); }
  });
  return { debt, details };
}

// Kat Planı > Malik/Kiracı'daki tik için — bir bölümün gasBillable
// bayrağını tersine çevirir (undefined/true -> false -> true).
export function toggleGasBillable(floors, floorId, unitId) {
  return (floors || []).map((f) => {
    if (f.id !== floorId) return f;
    return { ...f, units: (f.units || []).map((u) => (u.id !== unitId ? u : { ...u, gasBillable: !isGasBillable(u) })) };
  });
}

// Enerji > Faturalama raporlama bloğu için: bölüm sayaçlarının tüketimi
// (firma bazlı) ile mevcut teknik/ortak-alan sayaçlarının aynı dönemdeki
// tüketimi ayrı ayrı, karıştırılmadan döner. Su VE doğalgaz teknik/ortak-alan
// sayaçları aynı şekilde çalışır (sadece değer alanı farklı).
export function commonAreaConsumption(meters, readings, valueField, periodStart, periodEnd) {
  return (meters || [])
    .filter((m) => !m.unitRef)
    .map((m) => {
      const { consumption, hasData } = meterGroupConsumption(readings, [m.id], valueField, periodStart, periodEnd);
      return { meterId: m.id, name: m.name, consumption: hasData ? consumption : null };
    });
}

// Bir bölümü (unit) birden fazla bağımsız bölüme ayırır — kullanıcı
// teyidiyle: "bir bağımsız bölümün birden fazla sayacı var... bunların
// hepsinin ayrı bir bölüm olarak tanımlanması lazım". İlk parça orijinal
// unit.id'yi devralır (o id'ye zaten bağlı su sayaçları/equipmentIds
// kopmasın diye), diğer parçalar yeni id alır. `parts`: [{no, name, area}]
// — her biri bir kiracı firmayı temsil eder (upsertFirmUnit, rol: kiraci).
// `sharedOwner`: kullanıcı teyidiyle: "malik aynı işte aynı maliği
// atamasını yap" — verilirse (ya da orijinalin owner'ı varsa) TEK bir firma
// kartı (upsertFirmUnit, rol: malik) tüm yeni parçaların unitId'lerine
// bağlanır.
export function splitUnit(floors, companies, floorId, unitId, parts, sharedOwner) {
  // İlk parça orijinal unitId'yi devraldığı için, o id'ye bağlı ESKİ (bölünme
  // öncesi, tüm bölümü temsil eden) malik/kiracı ilişkileri temizlenir —
  // yoksa ör. "İNCO" hem eski B14 kaydında hem yeni 14A kaydında iki kez
  // görünür. Firma KARTLARI silinmez, sadece bu unitId'ye olan bağlantıları.
  let newCompanies = (companies || []).map((c) => ({
    ...c,
    malikUnitIds: (c.malikUnitIds || []).filter((id) => id !== unitId),
    kiraciUnitIds: (c.kiraciUnitIds || []).filter((id) => id !== unitId),
  }));
  const ownerName = (sharedOwner && sharedOwner.trim()) || null;
  const fallbackOwner = !ownerName;
  const newFloors = floors.map((f) => {
    if (f.id !== floorId) return f;
    const original = (f.units || []).find((u) => u.id === unitId);
    if (!original) return f;
    const effectiveOwner = ownerName || original.owner;
    const newUnits = [];
    (f.units || []).forEach((u) => {
      if (u.id !== unitId) { newUnits.push(u); return; }
      parts.forEach((part, i) => {
        const id = i === 0 ? original.id : newUnitId(floors);
        // isSplitPart: bu bölüm artık kendi başına atomik/nihai bir birim —
        // kullanıcı teyidiyle: "blok zaten iki kısma ayrılmış... daha önceden
        // böldüğüm alanlarıda ayrıca bölüm ayır eklemişsin" — bölünmeden
        // doğan alt-bölümlerde "Bölümü Ayır" bir daha görünmesin diye
        // (bkz. KatPlani.jsx UnitCard canSplit).
        const newUnit = { id, no: part.no, area: part.area === "" || part.area == null ? null : Number(part.area), owner: null, tenants: [], side: original.side, equipmentIds: i === 0 ? [...(original.equipmentIds || [])] : [], isSplitPart: true };
        newUnits.push(newUnit);
        if (effectiveOwner && (!fallbackOwner || i === 0)) {
          newCompanies = upsertFirmUnit(newCompanies, effectiveOwner, id, "malik");
        }
        if (part.name && part.name.trim()) {
          newCompanies = upsertFirmUnit(newCompanies, part.name.trim(), id, "kiraci");
        }
      });
    });
    return { ...f, units: newUnits };
  });
  return { floors: newFloors, companies: newCompanies };
}

export { latestReading };
