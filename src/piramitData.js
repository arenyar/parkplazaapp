// Park Plaza "piramit" kat planından (PARK PLAZA PİRAMİT (2).xls) birebir aktarıldı.
// Kaynak dosyada her kat bir çerçeveli kutu (bölüm no + m² + kiracı) olarak
// çizilmiş; kutunun DIŞINDA kalan isim o bölümün MALİKİ, kutunun İÇİNDEKİ isim
// KİRACISI'dır. Bazı bölümler alt-süitlere ayrılmış (ör. unit 19 -> Marinvest/
// Vesline/Celtrion/Empharma) — bunlar tenants[] içinde birden fazla isim olarak
// tutulur. Malik bilgisi kaynakta yoksa owner: null bırakıldı (veri uydurulmadı).
// tier alanı Operasyonlar > Kat Planı'ndaki 4 kademeli (kule/orta/taban/yeraltı)
// gruplamayı belirler — yeni eklenen katlar da bir tier seçmek zorunda.
//
// Bina yapısı gereği ortadan ikiye bölünmüş: piramit görselinin başlığındaki
// "BEŞİKTAŞ TARAF" / "SARIYER TARAF" ile birebir örtüşüyor. Her katın SOL
// birimi Beşiktaş bloğunda, SAĞ birimi Sarıyer bloğunda (kullanıcı teyidi:
// Denthill = Beşiktaş, Dmonte = Sarıyer, ikisi de 1B katında karşılıklı
// birimlerde). Her iki blokta da bina boyunca devam eden bir Busbar Şaftı ve
// Mekanik Şaft var (bkz. SHAFT_NOTE, tüm binaya ait ortak dikey tesisat —
// tek bir kata özgü olmadığı için ayrı birim olarak değil, bilgi notu olarak
// tutuluyor). Ekipman artık her zaman gerçek varlık envanterinden
// (state.assets, PP-xxx) seçilir — serbest metin girişi yok, uydurma ekipman
// eklenemez.
//
// Ekipman yerleşimi dört ayrı seviyede tutulur (kullanıcı teyidiyle: "Kat
// Planında Bölümlere koyduğun klima santralleri katlarda olacak katlar içinde
// ekipman eklemen lazım" — yani ortak/teknik ekipman bir kiracının bölümüne
// değil, KATIN kendisine ait olmalı):
//  - unit.equipmentIds  -> bir bölüme (kiracıya) özgü ekipman (nadiren kullanılır)
//  - floor.teknikMahaller -> katın (Beşiktaş/Sarıyer bloğuna ait veya blok
//    ayrımı olmayan) adlandırılmış teknik mahalleri; her biri kendi
//    equipmentIds'ine sahip, bir bölüm gibi ayrı ayrı düzenlenebilir
//    (kullanıcı teyidiyle: "katlardaki teknik mahalleride bölüm gibi yap
//    içersine ekipman ekleyebilelim"). Kat tipi katlarda her blokta standart
//    olarak "Teknik Mahal" (klima santrali/fancoil + varsa ek ekipman — ör.
//    5. kat Beşiktaş'ta hidrofor odası) ve "Yangın Dolabı" (yangın dolabı +
//    tüpü) mahalleri var — bkz. besiktasRooms/sariyerRooms. Otopark/teknik
//    tipi katlarda (ör. 3B) daha zengin, iç içe olabilen mahaller var (ör.
//    "Isıtma Odası" -> "Kazan Dairesi" + "Hidrofor ve Yangın Pompası").
//  - floor.equipmentIds -> katın blok ayrımı olmayan ORTAK alanı (ör. Zemin
//    kat bahçesi — 2 jeneratör, road blocker, 2 bariyer; kullanıcı teyidiyle:
//    "2. zemin kata bahçede ekipmanlar var 2 jeneratör orda road blok var 2
//    variyer var")
//  - floor.elevators / elevatorsOtopark -> temsili asansör gösterimi (PP-xxx
//    bağlı ama Konum listesine dahil edilmiyor, sadece görsel)
let _seq = 0;
const fid = () => `fl_${++_seq}`;
const uid = () => `un_${++_seq}`;

// `_seq` sadece modül belleğinde tutulur — sayfa her yenilendiğinde 0'dan
// başlar, ama Firestore'da kalıcı olan state.piramitFloors o anda zaten
// _seq'in "geçmişte" ulaştığı değerden daha yüksek fl_/un_ id'leri
// içerebilir. Bu yüzden newFloorId/newUnitId artık (opsiyonel) mevcut
// floors listesini alır ve id üretmeden ÖNCE _seq'i, floors içindeki en
// büyük fl_/un_ numarasının bir fazlasına senkronize eder — aksi halde
// sayfa yenilenip "Bölümü Ayır"/"Bölüm Ekle" tekrar çağrıldığında sayaç
// baştan sayıp önceden persist edilmiş bir id ile ÇAKIŞIYORDU (ör. un_78'in
// iki farklı bölümde birden görünmesi — React "duplicate key" uyarısı).
function maxPersistedSeq(floors) {
  let max = 0;
  (floors || []).forEach((f) => {
    const fm = /^fl_(\d+)$/.exec(f.id || "");
    if (fm) max = Math.max(max, parseInt(fm[1], 10));
    (f.units || []).forEach((u) => {
      const um = /^un_(\d+)$/.exec(u.id || "");
      if (um) max = Math.max(max, parseInt(um[1], 10));
    });
  });
  return max;
}
function nextSeq(floors) {
  if (floors) _seq = Math.max(_seq, maxPersistedSeq(floors));
  return ++_seq;
}

// PP-024/PP-030/PP-087/PP-088 her biri tek bir "×N" toplu kayıt değil, N ayrı
// varlık kaydı (PP-024-01..45 vb, bkz. mockData.js ASSETS) — her Kat Planı
// yerleşimi kendine özgü bir örneğe (instance) atanır, aynı id defalarca
// tekrarlanmaz. Binada fiilen var olan ama henüz hangi kata ait olduğu
// belirlenmemiş örnekler (ör. 45 klima santralinden sadece 32'si burada
// yerleştirildi) bilinçli olarak boş/atanmamış bırakıldı — uydurma yerleşim yok.
let _klimaSeq = 0;
function nextKlima() { _klimaSeq += 1; return [`PP-024-${String(_klimaSeq).padStart(2, "0")}`]; }
let _fancoilSeq = 0;
function nextFancoil() { _fancoilSeq += 1; return [`PP-030-${String(_fancoilSeq).padStart(2, "0")}`]; }
let _hoseSeq = 0;
function nextHose() { _hoseSeq += 1; return `PP-087-${String(_hoseSeq).padStart(2, "0")}`; }
let _extSeq = 0;
function nextExtinguisher() { _extSeq += 1; return `PP-088-${String(_extSeq).padStart(2, "0")}`; }
let _otoparkHoseSeq = 0;
function nextOtoparkHose() { _otoparkHoseSeq += 1; return `PP-093-${String(_otoparkHoseSeq).padStart(2, "0")}`; }
let _otoparkExtSeq = 0;
function nextOtoparkExt() { _otoparkExtSeq += 1; return `PP-094-${String(_otoparkExtSeq).padStart(2, "0")}`; }
// Otopark katlarında da (aynı ofis katları gibi) her blokta bir yangın
// dolabı odası var — kullanıcı teyidiyle: "otoparklarda aynı şaft ve yangın
// dolabı var oyüzden bölmen gerekiyor".
function otoparkYanginDolabiRooms() {
  return [
    { label: "Yangın Dolabı", side: "Beşiktaş", equipmentIds: [nextOtoparkHose(), nextOtoparkExt()] },
    { label: "Yangın Dolabı", side: "Sarıyer", equipmentIds: [nextOtoparkHose(), nextOtoparkExt()] },
  ];
}
// Kat Holü otopark katlarında da var — kullanıcı teyidiyle: "bu Kat holü
// otoparklarda da var otoparklarda kat holü ekle" — sonra düzeltme: "her
// otopark katında bir kat holü var 2 değil" — kat tipi katlardaki gibi TEK,
// blok ayrımı olmayan mahal (Beşiktaş/Sarıyer ayrımı ekipmanda değil,
// yalnızca görsel yerleşimde — bkz. TeknikMahalPanel'in ortadaki kümesi).
function otoparkKatHoluRoom() {
  return { label: "Kat Holü", equipmentIds: [] };
}
// "Otopark katlarına 50Kg ABC Kuru Tip Ekle" — koridordaki küçük tüpten
// (PP-093/094) ayrı, kat başına bir büyük tekerlekli tüp.
let _otoparkBuyukTupSeq = 0;
function nextOtoparkBuyukTup() { _otoparkBuyukTupSeq += 1; return `PP-096-${String(_otoparkBuyukTupSeq).padStart(2, "0")}`; }
function otoparkBuyukTupRoom() {
  return { label: "Yangın Söndürme Tüpü (50kg)", equipmentIds: [nextOtoparkBuyukTup()] };
}
// "Elektrik odalarına... Karbonmonoksit 6K ekle" — Trafo/OG Pano Odası,
// Kazan Dairesi, ADP Odası (jeneratörler de burada) için CO2 tipi tüp.
let _co2TupSeq = 0;
function nextCo2Tup() { _co2TupSeq += 1; return `PP-097-${String(_co2TupSeq).padStart(2, "0")}`; }
// Teknik Mahal'in kendi içinde de (koridordaki Yangın Dolabı'ndan ayrı) bir
// tüp var — kullanıcı teyidiyle: "Her Teknik Mahalede ekle 6kg Kuru Tip ABC".
let _teknikMahalTupSeq = 0;
function nextTeknikMahalTup() { _teknikMahalTupSeq += 1; return `PP-095-${String(_teknikMahalTupSeq).padStart(2, "0")}`; }
// Her ofis katında (kat tipi) her iki blokta da standart olarak "Teknik
// Mahal" (klima/fancoil, gerekirse ek ekipman) ve "Yangın Dolabı" (yangın
// dolabı + tüpü) diye iki ayrı, kendi başına düzenlenebilir mahal var —
// kullanıcı teyidiyle: "katlardaki teknik mahalleride bölüm gibi yap içersine
// ekipman ekleyebilelim" — bu yüzden tek bir düz equipmentIds listesi değil,
// otopark katlarındaki teknikMahaller yapısıyla aynı model kullanılıyor (her
// mahal kendi equipmentIds'ine sahip, Kat Planı'ndan tek tek düzenlenebilir).
function besiktasRooms(hvacIds, extraMekanik = []) {
  return [
    { label: "Teknik Mahal", side: "Beşiktaş", equipmentIds: [...hvacIds, ...extraMekanik, nextTeknikMahalTup()] },
    { label: "Yangın Dolabı", side: "Beşiktaş", equipmentIds: [nextHose(), nextExtinguisher()] },
  ];
}
function sariyerRooms(hvacIds, extraMekanik = []) {
  return [
    { label: "Teknik Mahal", side: "Sarıyer", equipmentIds: [...hvacIds, ...extraMekanik, nextTeknikMahalTup()] },
    { label: "Yangın Dolabı", side: "Sarıyer", equipmentIds: [nextHose(), nextExtinguisher()] },
  ];
}

function unit(no, area, owner, tenants, side, equipIds = []) {
  return { id: uid(), no, area, owner, tenants, side, equipmentIds: equipIds };
}

export const SHAFT_NOTE = "Beşiktaş ve Sarıyer bloklarının her ikisinde de bina boyunca devam eden bir Busbar Şaftı ve bir Mekanik Şaft bulunur (ortak dikey tesisat — tek bir kata özgü değildir). Isıtma/soğutma dağıtımı da aynı iki şaft üzerinden yürür — bkz. Isıtma & Soğutma Şeması.";

export const PIRAMIT_FLOORS_SEED = [
  // Kullanıcı teyidiyle: "44 tanesi katlardaydı 45. olan 21. katta" — 45
  // klima santralinden 44'ü ofis katlarında (bkz. besiktasBlockEquip/
  // sariyerBlockEquip), sonuncusu (PP-024-45) ÇATI2'de. WC Egzoz Fanı
  // (PP-028 ×2) ve Yangın Basınçlandırma Fanı (PP-027, "Yangın merdiveni
  // basınçlandırma fanı" ×2) daha önce hiçbir kata bağlanmamıştı.
  { id: fid(), label: "ÇATI2", type: "teknik", tier: "teras20", desc: "20.Kat Klima Santrali, WC Egzoz Fanı, Yangın Vantilatörü",
    equipmentIds: ["PP-024-45", "PP-028-01", "PP-028-02", "PP-027-01", "PP-027-02"] },
  // Kullanıcı teyidiyle (Üst zone yangın pompası burada — bkz. mi4/mi25'te
  // PP-016/017 zaten "Üst zone"): Yangın Pompası Odası, Soğutma Kulesi Odası,
  // Asansör Makine Dairesi yan yana ayrı teknik mahaller.
  { id: fid(), label: "ÇATI1", type: "teknik", tier: "teras20", desc: "Su Depoları, Soğutma Kuleleri, Hidrofor, Yangın Pompası, Asansör Makine Dairesi",
    teknikMahaller: [
      { label: "Yangın Pompası Odası", equipmentIds: ["PP-016", "PP-017", "PP-091", nextTeknikMahalTup()] },
      { label: "Soğutma Kulesi Odası", equipmentIds: ["PP-037-01", "PP-037-02", "PP-037-03", nextTeknikMahalTup()] },
      // Kullanıcı teyidiyle: "asansörleri asansör makine dairelerinde göster"
      // + "asansörleri beşiktaş sarıyer olarak ayır" — 6 yolcu asansörü,
      // diğer her yerdeki gibi blok bazında ikiye ayrıldı: Beşiktaş yüksek
      // blok (PP-005-01/02, 13-20 kat) + yük asansörü (PP-010, tüm katlara —
      // Beşiktaş lobi grubunun parçası); Sarıyer blok (PP-006/007-01/007-02,
      // Zemin-11 kat). Garaj asansörleri kendi makine dairelerinde (bkz. 5B/6B).
      { label: "Asansör Makine Dairesi", side: "Beşiktaş", equipmentIds: ["PP-005-01", "PP-005-02", "PP-010", nextCo2Tup()] },
      { label: "Asansör Makine Dairesi", side: "Sarıyer", equipmentIds: ["PP-006", "PP-007-01", "PP-007-02", nextCo2Tup()] },
    ] },
  { id: fid(), label: "PH", type: "kat", tier: "teras20",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    // Asansör erişimi (temsili, salt-okunur — gerçek konum değil, o katın
    // hangi asansörle ulaşıldığını gösterir; bkz. AsansorErisimBox).
    elevators: { besiktas: ["PP-010"] },
    units: [
      unit(null, null, "İNCO", ["Veskim Kimya (Ves Deri)"], "Beşiktaş"),
      unit(null, null, null, ["Park Paz."], "Sarıyer"),
    ] },
  { id: fid(), label: "20", type: "kat", tier: "teras20",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-005-01", "PP-005-02", "PP-010"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(44, 270, "İNCO", ["Veskim Kimya (Ves Deri)"], "Beşiktaş"),
      unit(45, 246, null, ["Park Paz."], "Sarıyer"),
    ] },
  { id: fid(), label: "19", type: "kat", tier: "teras20",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-005-01", "PP-005-02", "PP-010"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(42, 558, "Duygun Yarsuvat", ["Boyner Büyük Mağazacılık A.Ş."], "Beşiktaş"),
      unit(43, 504, "Gülman", ["PKF Aday Bağımsız Denetim A.Ş."], "Sarıyer"),
    ] },
  { id: fid(), label: "18", type: "kat", tier: "teras20",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-005-01", "PP-005-02", "PP-010"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(40, 558, "Gülman", ["Movimiento Çağrı Hizmetleri A.Ş."], "Beşiktaş"),
      unit(41, 504, "Gülman", ["Movimiento Çağrı Hizmetleri A.Ş."], "Sarıyer"),
    ] },
  { id: fid(), label: "17", type: "kat", tier: "teras20",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-005-01", "PP-005-02", "PP-010"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(38, 558, "Martur Fompak Holding A.Ş.", ["Martur Fompak Holding A.Ş."], "Beşiktaş"),
      unit(39, 504, "Martur Fompak Holding A.Ş.", ["Martur Fompak Holding A.Ş."], "Sarıyer"),
    ] },
  { id: fid(), label: "16", type: "kat", tier: "teras20",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-005-01", "PP-005-02", "PP-010"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(36, 558, "Boyner Holding A.Ş.", ["Boyner Holding A.Ş."], "Beşiktaş"),
      unit(37, 504, "Boyner Holding A.Ş.", ["Boyner Holding A.Ş."], "Sarıyer"),
    ] },
  { id: fid(), label: "15", type: "kat", tier: "teras20",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-005-01", "PP-005-02", "PP-010"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(34, 558, "Boyner A.Ş.", ["Eren Bağımsız Denetim A.Ş."], "Beşiktaş"),
      unit(35, 504, "Boyner A.Ş.", ["Av. Mahmut Barlas (Barlas & Karabucak Hukuk)"], "Sarıyer"),
    ] },
  { id: fid(), label: "14", type: "kat", tier: "teras20",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-005-01", "PP-005-02", "PP-010"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(32, 558, "Gülman", ["GCM Menkul (C 135)", "GCM Menk A-B 423"], "Beşiktaş"),
      unit(33, 504, "Gülman", ["GCM Yatırım Menkul Değerler A.Ş."], "Sarıyer"),
    ] },
  { id: fid(), label: "13", type: "kat", tier: "teras13",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-005-01", "PP-005-02", "PP-010"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(30, 558, "Gülman", ["Gülman Gayrimenkul"], "Beşiktaş"),
      unit(31, 504, "Gülman", ["Gülman Gayrimenkul"], "Sarıyer"),
    ] },
  { id: fid(), label: "12", type: "kat", tier: "teras13",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-010"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(28, 594, "Gülman", ["ADM Wild Gıda"], "Beşiktaş"),
      unit(29, 534, "Gülman", ["Av. Mahmut Barlas (Barlas & Karabucak Hukuk)"], "Sarıyer"),
    ] },
  { id: fid(), label: "11", type: "kat", tier: "teras13",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(26, 546, "Enver Alcan", ["Düzgit Vapur Hiz. Tic. A.Ş."], "Beşiktaş"),
      unit(27, 576, "Duygun Yarsuvat", ["Yarsuvat & Yarsuvat Hukuk Bürosu"], "Sarıyer"),
    ] },
  { id: fid(), label: "10", type: "kat", tier: "teras13",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(24, 546, "S. Evyap", ["Eren Bağımsız Denetleme"], "Beşiktaş"),
      unit(25, 576, "S. Evyap", ["Eren Bağımsız Denetleme"], "Sarıyer"),
    ] },
  { id: fid(), label: "9", type: "kat", tier: "teras13",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(22, 594, "Punto Yapı", ["Punto Yapı"], "Beşiktaş"),
      unit(23, 534, "Punto Yapı", ["Punto Yapı"], "Sarıyer"),
    ] },
  { id: fid(), label: "8", type: "kat", tier: "teras13",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(20, 594, "Deik", ["Movimiento Çağrı Hizmetleri A.Ş."], "Beşiktaş"),
      unit(21, 534, "Deik", ["Movimiento Çağrı Hizmetleri A.Ş."], "Sarıyer"),
    ] },
  { id: fid(), label: "7", type: "kat", tier: "teras13",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(18, 594, "Gülman", ["Termo Teknik Tic. ve San. A.Ş."], "Beşiktaş"),
      unit(19, 534, "Gülman", ["Marinvest SMMM (A/B 136)", "Vesline (19/C)", "Celtrion (19/D)", "Empharma İlaç (19/E)"], "Sarıyer"),
    ] },
  { id: fid(), label: "6", type: "kat", tier: "teras13",
    teknikMahaller: [...besiktasRooms(nextKlima()), ...sariyerRooms(nextKlima()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(16, 600, "Haluk Dayıgil", ["Eren Bağımsız Denetim A.Ş."], "Beşiktaş"),
      unit(17, 522, "Haluk Dayıgil", ["ADM Besin ve Tarım A.Ş. — İstanbul Şb."], "Sarıyer"),
    ] },
  { id: fid(), label: "5", type: "kat", tier: "teras1",
    // Beşiktaş tarafında fancoilden sonra Hidrofor Odası var — kullanıcı
    // teyidiyle: "5. katta Beşiktaş tarafında klima santralinden sonra
    // hidrofor odası var". PP-020/PP-021-01/PP-021-02 daha önce hiçbir kata
    // bağlanmamıştı (sadece mi28 bakım kartında), gerçek envanterden buraya
    // atandı.
    teknikMahaller: [...besiktasRooms(nextFancoil(), ["PP-020", "PP-021-01", "PP-021-02"]), ...sariyerRooms(nextFancoil()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(14, 552, null, ["İNCO", "İNCO/C", "PNR Yapı (14/A)"], "Beşiktaş"),
      unit(15, 528, "Haluk Dayıgil", ["JRO (BWO) İnşaat Yatırımları A.Ş."], "Sarıyer"),
    ] },
  { id: fid(), label: "4", type: "kat", tier: "teras1",
    teknikMahaller: [...besiktasRooms(nextFancoil()), ...sariyerRooms(nextFancoil()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(12, 786, "Punto", ["BDO Denet"], "Beşiktaş"),
      unit(13, 738, "Punto", ["BDO Denet"], "Sarıyer"),
    ] },
  { id: fid(), label: "3", type: "kat", tier: "teras1",
    teknikMahaller: [...besiktasRooms(nextFancoil()), ...sariyerRooms(nextFancoil()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(10, 798, "Gülman", ["Aday Bağımsız Denetim A.Ş."], "Beşiktaş"),
      unit(11, 744, "Gülman", ["PKF Aday Bağımsız Denetim ve SMMM A.Ş."], "Sarıyer"),
    ] },
  { id: fid(), label: "2", type: "kat", tier: "teras1",
    teknikMahaller: [...besiktasRooms(nextFancoil()), ...sariyerRooms(nextFancoil()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(8, 786, "Gülman", ["Air Liquide"], "Beşiktaş"),
      unit(9, 732, "İNCO", ["Delta Dış Ticaret A.Ş."], "Sarıyer"),
    ] },
  { id: fid(), label: "1", type: "kat", tier: "teras1",
    teknikMahaller: [...besiktasRooms(nextFancoil()), ...sariyerRooms(nextFancoil()), { label: "Kat Holü", equipmentIds: [] }],
    elevators: { besiktas: ["PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(6, 780, "Gülman", ["Lüx Properties / D", "6/C Respa Kimya Boya", "KHS Makine"], "Beşiktaş"),
      unit(7, 732, "İNCO", ["Boyner Holding A.Ş.", "QNB Bank A.Ş. — Maslak Şubesi"], "Sarıyer"),
    ] },
  { id: fid(), label: "Zemin", type: "kat", tier: "teras1",
    // Bahçe ekipmanları (equipmentIds — blok ayrımı yok, açık alanda ortak):
    // 2 jeneratör (kabinli, dışarıda kalabilir — PP-004-01/02), road blocker
    // (PP-086) ve 2 kollu bariyer (PP-079-01/02). Kullanıcı teyidiyle: "2.
    // zemin kata bahçede ekipmanlar var 2 jeneratör orda road blok var 2
    // variyer var". (Trafolar PP-001-01/02 gerçek yerine, 3B Trafo/OG Pano
    // Odası'na taşındı — bkz. 3B, mp3 Mahal Kontrol noktasıyla da örtüşüyor.)
    // Lobi — kat holünün Zemin'deki karşılığı, blok ayrımı yok (tek alan).
    // Kullanıcı teyidiyle: "kat holünü tek alan gibi göster... zemin kata
    // lobi var oraya ekipman olarak turnikeler boy dedektörü xray cihazı
    // ekleyeceğiz" — mp8 Mahal Kontrol noktasıyla ("Ana Giriş / Turnike")
    // örtüşüyor, PP-059/060/076/077/078 daha önce hiçbir kata bağlanmamıştı.
    teknikMahaller: [...besiktasRooms(nextFancoil()), ...sariyerRooms(nextFancoil()),
      { label: "Lobi", equipmentIds: ["PP-059", "PP-060", "PP-076", "PP-077-01", "PP-077-02", "PP-077-03", "PP-077-04", "PP-077-05", "PP-077-06", "PP-078"] },
    ],
    ortakAlanLabel: "Bahçe",
    equipmentIds: ["PP-004-01", "PP-004-02", "PP-086", "PP-079-01", "PP-079-02"],
    // Asansör erişimi (temsili) — Zemin'de 8 kabinin tamamı biner; kullanıcı
    // teyidiyle: "asansör görsellerini neden kaldırdın katlara hangi
    // asansörler ulaşıyor onu görüyorduk" — makine dairesi konumu (bkz.
    // ÇATI1/5B/6B) ayrı, bu sadece "hangi kata hangi asansör erişiyor" görseli.
    elevators: { besiktas: ["PP-005-01", "PP-005-02", "PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    elevatorsOtopark: { besiktas: ["PP-008"], sariyer: ["PP-009"] },
    // Yangın merdiveni — kullanıcı teyidiyle: "yangın merdivenlerini sağlı
    // sollu kat holünün yanındaki asansörlerin sonuna koy. 20. kattan 6b
    // kata kadar olacak" — 20. kattan (kat "20") 6B otoparka kadar tüm
    // katlarda, Kat Holü'nün yanındaki asansörlerin bittiği noktada, temsili
    // (gerçek bir PP-xxx ekipmanı değil, yapısal eleman).
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(4, 792, "Gülman", ["Defne Kimyevi (4/A)", "TEB — Maslak Şb. (4/B)"], "Beşiktaş"),
      unit(5, 696, "İNCO", ["Vakıfbank", "QNB Bank A.Ş. — Maslak Şubesi"], "Sarıyer"),
    ] },
  { id: fid(), label: "1B", type: "kat", tier: "teras1",
    // Kullanıcı teyidiyle: "Lobideki asansörler 1b da olacak" — Zemin-11
    // arası lobi grubu (yük asansörü + Sarıyer 3'lü) 1B'yi de kapsıyor.
    teknikMahaller: [...besiktasRooms(nextFancoil()), ...sariyerRooms(nextFancoil()), { label: "Kat Holü", equipmentIds: [] },
      // Yönetim Odası — kullanıcı teyidiyle: "1B kata Yönetim Odası ekle
      // 500m2 bu alanda Mutfak, CCTV Sistem Odası, Yönetim Ofisleri,
      // Toplantı Salonu, WC Bay WC Bayan Ekle". Bölümlerdeki "Yönetim"
      // kiracısından ayrı, binanın kendi yönetim ofis alanı — blok ayrımı
      // yok. CCTV Sistem Odası'na PP-056 (kamera kayıt cihazı) ×8 bağlandı
      // (mp9 "Kamera Kontrol Odası" ile örtüşüyor, daha önce hiçbir kata
      // bağlı değildi); diğer odalar (mutfak, ofis, toplantı, WC) için
      // ayrıca izlenen bir ekipman kaydı yok, temsili gösteriliyor.
      { label: "Yönetim Odası", area: 500, rooms: [
        { label: "Mutfak", equipmentIds: [] },
        { label: "CCTV Sistem Odası", equipmentIds: ["PP-056-01", "PP-056-02", "PP-056-03", "PP-056-04", "PP-056-05", "PP-056-06", "PP-056-07", "PP-056-08"] },
        { label: "Yönetim Ofisleri", equipmentIds: [] },
        { label: "Toplantı Salonu", equipmentIds: [] },
        { label: "WC Bay", equipmentIds: [] },
        { label: "WC Bayan", equipmentIds: [] },
      ] },
    ],
    elevators: { besiktas: ["PP-010"], sariyer: ["PP-006", "PP-007-01", "PP-007-02"] },
    // Otopark asansörleri (PP-008 Beşiktaş->6B, PP-009 Sarıyer->5B) buradan
    // geçiyor — kullanıcı teyidiyle: "1B katta da otopark asansörü var. ve
    // otoparklarda da asansörü göstermelisin". 5B/6B'de zaten gerçek makine
    // dairesi ekipmanı olarak gösteriliyor, o yüzden orada tekrar edilmiyor.
    elevatorsOtopark: { besiktas: ["PP-008"], sariyer: ["PP-009"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(2, 702, "Aslıhan Güneş", ["Denthill (512 m²)", "Yönetim"], "Beşiktaş"),
      unit(3, 732, "İNCO", ["Yönetim", "Dmonte Mobilya Ürünleri ve Yatırım A.Ş."], "Sarıyer"),
    ] },
  // Otopark katları (2B–6B) da kat tipi katlar gibi Beşiktaş/Sarıyer olarak
  // bölünüyor ve her blokta bir Yangın Dolabı mahali var — kullanıcı
  // teyidiyle: "otoparklarıda beşiktaş sarıyer olarak böl, otoparklarda
  // aynı şaft ve yangın dolabı var oyüzden bölmen gerekiyor". 2B ve 3B
  // fiziksel olarak birleşik/tek bir alan (kullanıcı teyidi: "2B ve 3B
  // birleşik alanta bu iki alanı tek yapmışlar") — iki ayrı kat kaydı olarak
  // tutuluyor ama içerikleri aynı birleşik mekanik alanın parçası.
  // Kullanıcının paylaştığı kaynak tabloda (PARK PLAZA PİRAMİT) 2B satırında
  // "1  İNCO  GÜLMAN" olarak tek bir bağımsız bölüm (Özel Otopark) geçiyor —
  // daha önce sadece kat seviyesinde owner string'i olarak tutuluyordu, artık
  // gerçek bir `unit` kaydı (su sayacı atanabilsin diye — kullanıcı teyidiyle:
  // "ona sayaç ataması yapacağız her bölümün sayacı ayrı"). m² kaynakta
  // verilmemiş, uydurulmadı (null).
  { id: fid(), label: "2B", type: "otopark", tier: "otopark", desc: "Özel Otopark / Turkcell", note: "Yakıt Tankı — 3B ile birleşik mekanik alan", owner: "İNCO / Gülman",
    teknikMahaller: [...otoparkYanginDolabiRooms(), otoparkKatHoluRoom(), otoparkBuyukTupRoom()],
    elevatorsOtopark: { besiktas: ["PP-008"], sariyer: ["PP-009"] },
    yanginMerdiveni: { besiktas: true, sariyer: true },
    units: [
      unit(1, null, "İNCO / Gülman", [], null),
    ] },
  // 3B — kullanıcı teyidiyle: Trafolar/jeneratörler/atıksu hattı Beşiktaş
  // tarafında, ısıtma ve soğutma mahalleri Sarıyer tarafında. Trafo/OG Pano
  // Odası (PP-001-01/02 — mp3 ile örtüşüyor) zaten Beşiktaş'ta; Isıtma Odası
  // (Kazan Dairesi + Hidrofor ve Yangın Pompası) ve Soğutma Odası Sarıyer'e
  // taşındı. Santral Odası (Telefon Santrali/PP-075) blok ayrımı olmadan
  // kalıyor — kullanıcı bir taraf belirtmedi.
  { id: fid(), label: "3B", type: "otopark", tier: "otopark", desc: "Chiller, Sirkülasyon Pompaları, Hidroforlar, Yangın Pompaları, Telefon Santrali, Trafolar, Orta Gerilim Hücresi — 2B ile birleşik mekanik alan",
    teknikMahaller: [
      { label: "Trafo / OG Pano Odası", side: "Beşiktaş", equipmentIds: ["PP-001-01", "PP-001-02", nextCo2Tup()] },
      { label: "Isıtma Odası", side: "Sarıyer", rooms: [
        { label: "Kazan Dairesi", equipmentIds: ["PP-013-01", "PP-013-02", "PP-013-03", "PP-014-01", "PP-014-02", "PP-014-03", nextCo2Tup()] },
        { label: "Hidrofor ve Yangın Pompası", equipmentIds: ["PP-018", "PP-019", "PP-089", "PP-090-01", "PP-090-02", "PP-090-03", nextTeknikMahalTup()] },
      ] },
      { label: "Soğutma Odası", side: "Sarıyer", equipmentIds: ["PP-034-01", "PP-034-02", "PP-038", "PP-035", "PP-036-01", "PP-036-02", nextTeknikMahalTup()] },
      { label: "Santral Odası", equipmentIds: ["PP-075", nextCo2Tup()] },
      ...otoparkYanginDolabiRooms(),
      otoparkKatHoluRoom(),
      otoparkBuyukTupRoom(),
    ],
    elevatorsOtopark: { besiktas: ["PP-008"], sariyer: ["PP-009"] },
    yanginMerdiveni: { besiktas: true, sariyer: true } },
  // 4B — kullanıcı teyidiyle: "Jeneratörler çukurova olanlar burda... yanına
  // iki jeneratörü ekle" + "trafolar jeneratörler atıksu hattı beşiktaş
  // tarafında" — ADP Odası Beşiktaş'a alındı. Kompanzasyon panosu 2 adet
  // (kullanıcı teyidiyle: "kompanzasyon 2 adet var") — ikincisi Sarıyer
  // tarafındaki ADP Odası'nın eşinde (bkz. mockData.js mtd2b).
  { id: fid(), label: "4B", type: "otopark", tier: "otopark", desc: "Ana Dağıtım Panoları ve Jeneratörler",
    teknikMahaller: [
      { label: "ADP Odası", side: "Beşiktaş", equipmentIds: ["PP-092-01", "PP-002", "PP-003", nextCo2Tup()] },
      { label: "ADP Odası (Kompanzasyon)", side: "Sarıyer", equipmentIds: ["PP-092-02", nextCo2Tup()] },
      ...otoparkYanginDolabiRooms(), otoparkKatHoluRoom(), otoparkBuyukTupRoom(),
    ],
    elevatorsOtopark: { besiktas: ["PP-008"], sariyer: ["PP-009"] },
    yanginMerdiveni: { besiktas: true, sariyer: true } },
  // 5B — "BJK" (Beşiktaş) garaj asansörünün makine dairesi. Kullanıcı
  // teyidiyle: "sarıyer tarafının asansörü 5.Bodrum Kata kadar iniyor
  // Beşiktaş tarafı 6. bodrum kata kadar" — Sarıyer asansörü (PP-009) burada
  // son buluyor, Beşiktaş asansörü (PP-008) 6B'ye inmek için buradan geçiyor
  // — ikisi de bu katta erişilebilir.
  { id: fid(), label: "5B", type: "otopark", tier: "otopark", desc: "Yakıt Tankı ve BJK Garaj Asansör Makine Dairesi",
    teknikMahaller: [{ label: "Asansör Makine Dairesi", side: "Beşiktaş", equipmentIds: ["PP-008", nextCo2Tup()] }, ...otoparkYanginDolabiRooms(), otoparkKatHoluRoom(), otoparkBuyukTupRoom()],
    elevatorsOtopark: { besiktas: ["PP-008"], sariyer: ["PP-009"] },
    yanginMerdiveni: { besiktas: true, sariyer: true } },
  // 6B — kullanıcı teyidiyle: "Atık Su teknik Mahalini yap... trafolar
  // jeneratörler atıksu hattı beşiktaş tarafında" — Atık Su Odası Beşiktaş'a
  // alındı. Sarıyer garaj asansörünün makine dairesi Sarıyer tarafında.
  // Sarıyer asansörü (PP-009) 5B'de sona erdiği için buraya (6B) İNMİYOR —
  // sadece Beşiktaş asansörü (PP-008) buraya kadar iniyor.
  { id: fid(), label: "6B", type: "otopark", tier: "otopark", desc: "Atık Su Tankı ile Pompaları ve Sarıyer Garaj Asansör Makine Dairesi",
    teknikMahaller: [
      { label: "Atık Su Odası", side: "Beşiktaş", equipmentIds: ["PP-023-01", "PP-023-02", nextCo2Tup()] },
      { label: "Asansör Makine Dairesi", side: "Sarıyer", equipmentIds: ["PP-009", nextCo2Tup()] },
      ...otoparkYanginDolabiRooms(),
      otoparkKatHoluRoom(),
      otoparkBuyukTupRoom(),
    ],
    elevatorsOtopark: { besiktas: ["PP-008"] },
    yanginMerdiveni: { besiktas: true, sariyer: true } },
];

export const TIERS = [
  { key: "teras20", title: "20. TERAS (14 – ÇATI2)" },
  { key: "teras13", title: "13. TERAS (6 – 13)" },
  { key: "teras1", title: "1. TERAS (Zemin, 1B – 5)" },
  { key: "otopark", title: "OTOPARK ALANI (2B – 6B)" },
];

export const SIDES = ["Beşiktaş", "Sarıyer"];

// `floors` opsiyonel: verilirse yukarıdaki senkronizasyon çalışır (bkz.
// nextSeq notu). Çağıran taraf (KatPlani.jsx, billing.js splitUnit) elindeki
// güncel state.piramitFloors'u geçmeli — geçmezse eski (senkronsuz) davranışa
// düşer.
export function newFloorId(floors) { return `fl_${nextSeq(floors)}`; }
export function newUnitId(floors) { return `un_${nextSeq(floors)}`; }

// Zaten persist edilmiş state.piramitFloors'da (yukarıdaki senkronizasyon
// eklenmeden ÖNCE oluşmuş) aynı id'yi paylaşan birden fazla unit kaydı
// varsa bunları tek seferlik, veri kaybetmeden ayrıştırır — bkz.
// mockData.js migrateLegacyState. İLK karşılaşılan kayıt kendi id'sini
// korur (o id'ye zaten bağlı equipmentIds/su sayacı/firma referansları
// kopmasın diye), sonraki her kopya yeni bir id alır; hangi (floorId,
// eskiId) çiftinin hangi yeni id'ye taşındığı `remaps` içinde döner ki
// çağıran taraf companies.malikUnitIds/kiraciUnitIds ve waterMeters.unitRef
// gibi ayrı yerlerde tutulan referansları da güncelleyebilsin.
export function healDuplicateUnitIds(floors) {
  const seen = new Set();
  const remaps = []; // { floorId, oldId, newId }
  let changed = false;
  const nextFloors = (floors || []).map((f) => {
    if (!f.units || f.units.length === 0) return f;
    const units = f.units.map((u) => {
      if (!seen.has(u.id)) { seen.add(u.id); return u; }
      changed = true;
      const newId = newUnitId(floors);
      remaps.push({ floorId: f.id, oldId: u.id, newId });
      return { ...u, id: newId };
    });
    return { ...f, units };
  });
  return { floors: nextFloors, remaps, changed };
}

// state.piramitFloors ilk yüklemede bu tohum veriden türetilir (deep clone —
// aynı dizi/obj referansları paylaşılmasın diye).
function cloneTeknikMahal(m) {
  return { ...m, equipmentIds: m.equipmentIds ? [...m.equipmentIds] : undefined, rooms: m.rooms ? m.rooms.map(cloneTeknikMahal) : undefined };
}
export function clonePiramitFloors() {
  return PIRAMIT_FLOORS_SEED.map((f) => ({
    ...f,
    units: f.units ? f.units.map((u) => ({ ...u, tenants: [...u.tenants], equipmentIds: [...(u.equipmentIds || [])] })) : undefined,
    equipmentIds: [...(f.equipmentIds || [])],
    equipmentBesiktasIds: [...(f.equipmentBesiktasIds || [])],
    equipmentSariyerIds: [...(f.equipmentSariyerIds || [])],
    teknikMahaller: f.teknikMahaller ? f.teknikMahaller.map(cloneTeknikMahal) : undefined,
    // elevators/elevatorsOtopark: salt-okunur, temsili "hangi kata hangi
    // asansör erişiyor" görseli — teknikMahaller'in bir parçası DEĞİL,
    // bilinçli olarak ayrı tutuluyor ki gerçek asansör konumu (Asansör
    // Makine Dairesi, bkz. ÇATI1/5B/6B) ile karışmasın / Varlıklar'daki
    // Konum listesinde tekrarlanmasın.
    elevators: f.elevators ? { besiktas: [...(f.elevators.besiktas || [])], sariyer: [...(f.elevators.sariyer || [])] } : undefined,
    elevatorsOtopark: f.elevatorsOtopark ? { besiktas: [...(f.elevatorsOtopark.besiktas || [])], sariyer: [...(f.elevatorsOtopark.sariyer || [])] } : undefined,
  }));
}

// Bir varlığın (PP-xxx) Kat Planı'ndaki tüm yerleşimlerini bulur — Varlıklar
// sayfasında "bu ekipman hangi katta/blokta" göstermek için. Ayrı bir konum
// alanı tutulmuyor, tek kaynak state.piramitFloors'daki equipmentIds
// referansları. Kat tipi katlarda hem bölüm (unit) hem de kat/blok seviyesi
// (ortak teknik ekipman) kontrol edilir; diğer tiplerde sadece kat seviyesi.
function findInTeknikMahaller(mahaller, assetId, floorLabel, parentSide, parentRoom, locs) {
  (mahaller || []).forEach((m) => {
    const roomLabel = parentRoom ? `${parentRoom} — ${m.label}` : m.label;
    const side = m.side || parentSide || null;
    if ((m.equipmentIds || []).includes(assetId)) locs.push({ floor: floorLabel, side, unit: null, room: roomLabel });
    if (m.rooms) findInTeknikMahaller(m.rooms, assetId, floorLabel, side, roomLabel, locs);
  });
}
// Kullanıcı teyidiyle: "teknikde varlıkları güncelleyebileceğimiz bir alan
// olsun... sahada personel gezerken ilgili kattaki ekipmanı güncellesin" —
// findAssetLocations'ın (asset→konumlar) TERSİ: bir kata bağlı TÜM
// ekipman kimliklerini döner. Aynı gezinme (units/teknikMahaller/rooms),
// tek fark: tek bir assetId'yi aramak yerine hepsini topluyor.
function collectMahalEquipment(mahaller, ids) {
  (mahaller || []).forEach((m) => {
    (m.equipmentIds || []).forEach((id) => ids.add(id));
    if (m.rooms) collectMahalEquipment(m.rooms, ids);
  });
}
export function assetIdsForFloor(floors, floorLabel) {
  const floor = (floors || []).find((f) => f.label === floorLabel);
  if (!floor) return [];
  const ids = new Set();
  if (floor.type === "kat") {
    (floor.units || []).forEach((u) => (u.equipmentIds || []).forEach((id) => ids.add(id)));
  }
  (floor.equipmentIds || []).forEach((id) => ids.add(id));
  (floor.equipmentBesiktasIds || []).forEach((id) => ids.add(id));
  (floor.equipmentSariyerIds || []).forEach((id) => ids.add(id));
  if (floor.teknikMahaller) collectMahalEquipment(floor.teknikMahaller, ids);
  return [...ids];
}

export function findAssetLocations(floors, assetId) {
  const locs = [];
  floors.forEach((f) => {
    if (f.type === "kat") {
      f.units.forEach((u) => {
        if ((u.equipmentIds || []).includes(assetId)) locs.push({ floor: f.label, side: u.side || null, unit: u.no ?? null });
      });
    }
    if ((f.equipmentIds || []).includes(assetId)) locs.push({ floor: f.label, side: null, unit: null });
    if ((f.equipmentBesiktasIds || []).includes(assetId)) locs.push({ floor: f.label, side: "Beşiktaş", unit: null });
    if ((f.equipmentSariyerIds || []).includes(assetId)) locs.push({ floor: f.label, side: "Sarıyer", unit: null });
    if (f.teknikMahaller) findInTeknikMahaller(f.teknikMahaller, assetId, f.label, null, null, locs);
  });
  return locs;
}

// Kat etiketini okunaklı bir ifadeye çevirir (ör. "5" -> "5. Kat", "1B" ->
// "1. Bodrum Kat", "Zemin" -> "Zemin Kat"). Varlıklar ve Mahal Kontrol'de
// "Konum" gösterimi tek bir yerden, tutarlı biçimde üretilsin diye tek
// kaynak burada tutuluyor (kullanıcı teyidiyle: "5. Kat Beşiktaş Tarafı" /
// "Zemin Kat Beşiktaş" gibi).
export function floorPhrase(label) {
  if (/^\d+$/.test(label)) return `${label}. Kat`;
  const bodrum = label.match(/^(\d+)B$/);
  if (bodrum) return `${bodrum[1]}. Bodrum Kat`;
  if (label === "Zemin") return "Zemin Kat";
  return `${label} Kat`;
}

// side/unit bilgisiyle birlikte tam "Konum" metnini üretir — Varlıklar ve
// Mahal Kontrol aynı formatı kullanır (bkz. yukarıdaki not).
export function locationLabel({ floor, side, unit, room }) {
  let s = floorPhrase(floor);
  if (side) s += ` ${side} Tarafı`;
  if (unit != null) s += ` — Bölüm ${unit}`;
  if (room) s += ` — ${room}`;
  return s;
}

// Kat Planı'ndaki GERÇEK teknik mahallerden Mahal Kontrol'ün yangın tüpü/
// hortumu kontrol noktalarını türetir — kullanıcı düzeltmesiyle: "yangın
// kontrolü kat yazmışsın ancak o katta ne olduğu kat planında mevcut ona göre
// yapmalısın" + "yangın dolaplarının dışında mahallerede koymuştuk o
// mahallere de eklemen lazım". Statik bir liste tutulmuyor — floors/assets
// değişince (Kat Planı düzenlemesi, yeni ekipman) bu liste de otomatik
// güncellenir. İç içe odalar (ör. "Isıtma Odası" -> "Kazan Dairesi")
// recursive gezilir, side üst gruptan miras alınır.
export function collectFireEquipmentLocations(floors, assets) {
  const fireIds = new Set(assets.filter((a) => a.category === "Yangın Söndürme Ekipmanı").map((a) => a.id));
  const out = [];
  function walk(floor, mahal, path, inheritedSide) {
    const side = mahal.side || inheritedSide;
    if (mahal.rooms) {
      mahal.rooms.forEach((r, i) => walk(floor, r, [...path, i], side));
      return;
    }
    const ids = (mahal.equipmentIds || []).filter((id) => fireIds.has(id));
    if (ids.length === 0) return;
    out.push({
      key: `${floor.id}_${path.join("-")}`,
      label: `${floorPhrase(floor.label)} — ${mahal.label}${side ? ` (${side})` : ""}`,
      floorLabel: floor.label, side, room: mahal.label, equipmentIds: ids,
    });
  }
  floors.forEach((floor) => {
    (floor.teknikMahaller || []).forEach((m, i) => walk(floor, m, [i], undefined));
  });
  return out;
}

// Bir kat + blok için Kat Planı'ndaki GERÇEK firma isimlerini döner —
// kullanıcı teyidiyle: "Güvenlik Devriye için Kat Planında hangi firmalar
// var görebilirsin ordan verileri al eklemeyi yap". Kiracı varsa kiracı
// isimleri, yoksa malik esas alınır; otopark katlarında (owner alanı sadece
// 2B'de var — "İNCO / Gülman") side ayrımı yapılmadan aynı isim döner. Bilgi
// yoksa boş dizi (uydurulmuz).
export function firmsAtFloorSide(floors, floorLabel, side) {
  const floor = floors.find((f) => f.label === floorLabel);
  if (!floor) return [];
  if (floor.type === "kat") {
    const units = (floor.units || []).filter((u) => u.side === side);
    const names = units.flatMap((u) => (u.tenants && u.tenants.length > 0 ? u.tenants : (u.owner ? [u.owner] : [])));
    return [...new Set(names)];
  }
  if (floor.type === "otopark" && floor.owner) return floor.owner.split(" / ");
  return [];
}

// Kat planından türetilen firma dizini — malik/kiracı rolleri ve hangi
// kat/bölümlerde geçtiği otomatik çıkarılır (ayrı bir elle bakım gerektiren
// liste tutulmuyor, tek kaynak state.piramitFloors). Editable state üzerinde
// çalışsın diye artık floors parametre olarak alınıyor.
export function buildFirmalar(floors) {
  const map = new Map();
  function touch(name, role, floorLabel, unitNo) {
    if (!name) return;
    const key = name.trim();
    if (!key) return;
    if (!map.has(key)) map.set(key, { name: key, roles: new Set(), locations: [] });
    const rec = map.get(key);
    rec.roles.add(role);
    rec.locations.push({ floor: floorLabel, unit: unitNo ?? null, role });
  }
  floors.forEach((f) => {
    if (f.type !== "kat") return;
    f.units.forEach((u) => {
      touch(u.owner, "Malik", f.label, u.no);
      u.tenants.forEach((t) => touch(t, "Kiracı", f.label, u.no));
    });
  });
  return [...map.values()]
    .map((r) => ({ name: r.name, roles: [...r.roles], locations: r.locations }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
