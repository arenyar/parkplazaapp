// Mock / örnek veri katmanı. Firebase entegrasyonu yapılınca bu dosyanın yerini
// gerçek bir veri katmanı (firebase.js benzeri) alacak — component'ler zaten
// bu dosyanın export ettiği ARRAY/OBJECT şekillerine göre yazıldı, geçiş kolay olur.

import { clonePiramitFloors, floorPhrase, healDuplicateUnitIds } from "./piramitData.js";
import { APP_VERSION } from "./version.js";
import { isNativeApp } from "./lib/platform.js";
import { backfillFirms, upsertFirmUnit, dedupeFirms, normalizeFirmKey } from "./lib/billing.js";

export const BRANDING = {
  orgName: "PARK PLAZA",
  siteName: "Park Plaza Maslak",
  tagline: "Dijital Operasyon Merkezi",
  icon: null, // gerçek logo eklenince buraya data-uri veya /icon.png yolu
};

export const DEPARTMENTS = ["Teknik", "Güvenlik", "Temizlik", "İSG", "Yönetim", "Resepsiyon"];

// Faz 2 — hiyerarşik talep türü taksonomisi (bkz. mobil-ui-prompt.md bölüm
// 6.5, örnek ağaç). Koda gömülü sabit bir liste değil gibi davranılır:
// `parentId` ile ağaç kurulur, `order` ile sıralanır, `isLeaf` sadece
// seçilebilir yapraklarda true — TypePicker.jsx bu şekli okur. Bu depoda
// ayrı bir Firestore koleksiyonu yok (appdata tek doküman, bkz. firebase.js);
// o yüzden `taskTypes/{id}` yerine diğer tüm referans verilerle (DEPARTMENTS,
// MAINTENANCE_FIRMS...) aynı yerde, `state.taskTypes` dizisi olarak tutulur.
export const TASK_TYPES = [
  { id: "elektrik", parentId: null, order: 1, label: "Elektrik", isLeaf: true },
  { id: "mekanik", parentId: null, order: 2, label: "Mekanik / Tesisat", isLeaf: false },
  { id: "mekanik-atiksu", parentId: "mekanik", order: 1, label: "Atık su borusu arızalı", isLeaf: true },
  { id: "mekanik-isitma", parentId: "mekanik", order: 2, label: "Isıtma", isLeaf: true },
  { id: "mekanik-lavabo", parentId: "mekanik", order: 3, label: "Lavabo", isLeaf: true },
  { id: "mekanik-suborusu", parentId: "mekanik", order: 4, label: "Su borusu arızalı", isLeaf: true },
  { id: "mekanik-subaskini", parentId: "mekanik", order: 5, label: "Su baskını", isLeaf: true },
  { id: "mekanik-wc", parentId: "mekanik", order: 6, label: "WC", isLeaf: false },
  { id: "mekanik-wc-kapak-arizali", parentId: "mekanik-wc", order: 1, label: "WC kapağı arızalı", isLeaf: true },
  { id: "mekanik-wc-kapak-gevsek", parentId: "mekanik-wc", order: 2, label: "WC kapağı gevşek", isLeaf: true },
  { id: "mekanik-wc-rezervuar", parentId: "mekanik-wc", order: 3, label: "Rezervuar akıtıyor", isLeaf: true },
  { id: "mekanik-wc-tikali", parentId: "mekanik-wc", order: 4, label: "WC tıkalı", isLeaf: true },
  { id: "yangin-guvenlik", parentId: null, order: 3, label: "Yangın ve güvenlik", isLeaf: true },
  { id: "asansor", parentId: null, order: 4, label: "Asansör", isLeaf: true },
  { id: "bilgi-islem", parentId: null, order: 5, label: "Bilgi işlem", isLeaf: true },
  { id: "mobilya-donanim", parentId: null, order: 6, label: "Mobilya / Donanım", isLeaf: true },
  { id: "boya-tadilat", parentId: null, order: 7, label: "Boya / Tadilat", isLeaf: true },
  { id: "peyzaj", parentId: null, order: 8, label: "Peyzaj", isLeaf: true },
  // Kullanıcı teyidiyle: "tür kısım seçenekleri ekrana gelsin elektrik
  // mekanik teknik inşaat temizlik gibi" — İnşaat (Boya/Tadilat'tan ayrı,
  // yapısal/inşai işler) ve Temizlik (bir Teknik arızası aslında bir
  // temizlik meselesiyse) eksikti, eklendi.
  { id: "insaat", parentId: null, order: 9, label: "İnşaat", isLeaf: false },
  { id: "insaat-siva-boya", parentId: "insaat", order: 1, label: "Sıva / Duvar hasarı", isLeaf: true },
  { id: "insaat-tavan", parentId: "insaat", order: 2, label: "Tavan hasarı", isLeaf: true },
  { id: "insaat-zemin", parentId: "insaat", order: 3, label: "Zemin / Fayans hasarı", isLeaf: true },
  { id: "insaat-cati-cephe", parentId: "insaat", order: 4, label: "Çatı / Cephe hasarı", isLeaf: true },
  { id: "temizlik-tur", parentId: null, order: 10, label: "Temizlik", isLeaf: false },
  { id: "temizlik-genel", parentId: "temizlik-tur", order: 1, label: "Genel temizlik", isLeaf: true },
  { id: "temizlik-atik", parentId: "temizlik-tur", order: 2, label: "Atık / Çöp", isLeaf: true },
  { id: "temizlik-leke-koku", parentId: "temizlik-tur", order: 3, label: "Leke / Koku", isLeaf: true },
];

// Bakım Takvimi'ndeki (MAINTENANCE_ITEMS) "firma" alanlarında geçen bakım
// yüklenicileri — Ayarlar > Bakımlar sekmesinden yönetilir.
export const MAINTENANCE_FIRMS = ["Otis", "Trak", "Hertz Jeneratör", "Schneider", "EKA", "Nalco", "İnform"];

// Personel tablosu — kullanıcının verdiği gerçek personel listesiyle (Ad
// Soyad / Departman / İşe Giriş Tarihi) birleştirildi (kullanıcı teyidiyle:
// "Kayıtlı Olan personeller kalsın olmayanları ekle, personel tablosuna adı
// soy adı departmanı işe giriş tarihi mail adresi telefon no gibi alanlar
// ekle. Rolde ekle"). Önceden kayıtlı 5 kişi (u1-u5) korunuyor ve listede
// adı geçenler işe giriş tarihiyle zenginleştirildi; Fatma Yıldız listede
// yoktu, kayıtlı personel olduğu için silinmedi, sadece işe giriş tarihi
// bilinmediğinden boş bırakıldı (uydurulmadı). Telefon numarası hiçbir
// kaynakta verilmediği için herkeste boş — ileride gerçek veriyle
// doldurulabilir. E-posta, yeni eklenen personel için kurumsal
// ad.soyad@parkplazamaslak.com deseniyle türetildi (mevcut 5 kişinin
// e-postası değiştirilmedi). Rol alanı gerçek unvan bilgisi verilmediği
// için departmana göre jenerik bir görev tanımı taşıyor (şef/müdür gibi
// kıdem uydurulmadı) — mevcut 5 kişinin gerçek unvanları (Teknik Şef,
// Güvenlik Şefi vb.) korundu.
// Web erişim yetkilendirmesi — kullanıcı teyidiyle: "Web Kullanıcı
// yetkilendirmesini ayarladan yapalım hangi personel hangi ekranları
// görebilecek. Mobil uygulamayı kimler kullanabilecek." Departmana göre
// makul varsayılan ekran setleri (Ayarlar > Kullanıcı Yetkilendirme'den kişi
// bazında değiştirilebilir — bkz. Ayarlar.jsx). Şef/Sorumlu unvanındaki
// departman liderlerine Kontroller/Raporlar/KPI gibi yönetimsel ekranlar da
// varsayılan olarak açık; Yönetim departmanı (Facility Manager + Yönetim
// Personeli) tüm ekranlara erişir.
const ALL_SCREENS = ["dashboard", "operasyonlar", "katplani", "varliklar", "stok", "bakim", "kontroller", "guvenlik", "temizlik", "enerji", "riskler", "dokumanlar", "raporlar", "kpi", "yonetim", "ayarlar", "mobiltasarim"];
const DEPARTMENT_DEFAULT_SCREENS = {
  "Teknik": ["dashboard", "operasyonlar", "katplani", "varliklar", "stok", "bakim", "enerji", "riskler", "dokumanlar"],
  "Güvenlik": ["dashboard", "operasyonlar", "katplani", "guvenlik", "dokumanlar"],
  "Temizlik": ["dashboard", "operasyonlar", "katplani", "temizlik", "dokumanlar"],
  "İSG": ["dashboard", "operasyonlar", "katplani", "riskler", "dokumanlar", "raporlar"],
  "Yönetim": ALL_SCREENS,
  "Resepsiyon": ["dashboard", "operasyonlar", "katplani", "dokumanlar"],
};
const LEAD_EXTRA_SCREENS = ["kontroller", "raporlar", "kpi"];
export function isLeadRole(role) { return /şef|sorumlu|müdür/i.test(role || ""); }
function defaultWebScreens(t) {
  const base = DEPARTMENT_DEFAULT_SCREENS[t.department] || ["dashboard", "operasyonlar", "katplani", "dokumanlar"];
  if (t.department === "Yönetim") return base;
  return isLeadRole(t.role) ? [...new Set([...base, ...LEAD_EXTRA_SCREENS])] : base;
}

// Kullanıcı teyidiyle: "olay tutanağını güvenlik müdürüne atsın", "günlük
// departman müdürüne mail atsın" — bu depoda "müdür" ayrı bir alan/rol
// değil, personelin `role` metninde geçen Şef/Sorumlu/Müdür ifadesi
// (isLeadRole ile AYNI kalıp, LEAD_EXTRA_SCREENS'in zaten kullandığı).
// Departmanda birden fazla lead varsa e-postası olan İLK kişi alınır —
// yeni bir "müdür" alanı uydurulmadı.
export function findDeptManager(team, department) {
  return (team || []).find((t) => t.department === department && isLeadRole(t.role) && t.email) || null;
}
export const ALL_PERMISSION_SCREENS = ALL_SCREENS;
// Ekran listesinden { view, read, write } üçlüsü içeren bir izin haritası
// üretir — kullanıcı teyidiyle: "yetkilerde yazma okuma görüntüleme
// parametreleri olmalı". allWrite=true seed'deki mevcut 33 kişi için
// kullanılıyor (bugüne kadar zaten tam erişimleri vardı, davranış değişmiyor);
// Yönetim > "Kullanıcı Aç" ile yeni açılan hesaplar da aynı varsayılanı alır,
// admin sonra Yetkileri Düzenle'den daraltabilir.
export function buildPermissions(screens, allWrite = true) {
  const perms = {};
  // Verilen listede OLMAYAN ekranlar için de AÇIKÇA {false,false,false}
  // yazılır (undefined bırakılmaz) — yoksa migrateLegacyState'teki geriye
  // dönük "eksik anahtarı olan hesaba tam erişim ver" migrasyonları (ör.
  // stok) bu YENİ hesaba da yanlışlıkla tam erişim enjekte eder, admin'in
  // Yetkileri Düzenle'de bilinçli olarak dışarıda bıraktığı ekranı geri
  // açmış olur. Bkz. ALL_PERMISSION_SCREENS ve stok migrasyonu notu.
  ALL_PERMISSION_SCREENS.forEach((s) => { perms[s] = { view: false, read: false, write: false }; });
  screens.forEach((s) => { perms[s] = { view: true, read: true, write: allWrite }; });
  return perms;
}
// Bu bir prototip/mock katman — gerçek bir kimlik doğrulama sunucusu yok,
// bu yüzden herkese aynı basit varsayılan şifre atanıyor (kullanıcı adı:
// kurumsal e-posta). Personel Ayarlar > Kullanıcı Yetkilendirme'den kişi
// bazında değiştirebilir.
export const DEFAULT_PASSWORD = "ParkPlaza2026!";

const RAW_TEAM = [
  { id: "u1", name: "Ahmet Karayat", role: "Teknik Şef", department: "Teknik", email: "ahmet@parkplazamaslak.com", phone: "", startDate: "2024-11-04" },
  { id: "u2", name: "Selçuk Ertuğrul", role: "Güvenlik Şefi", department: "Güvenlik", email: "selcuk@parkplazamaslak.com", phone: "", startDate: "2025-01-22" },
  { id: "u3", name: "Ümit Asak", role: "Güvenlik Görevlisi", department: "Güvenlik", email: "umit@parkplazamaslak.com", phone: "", startDate: "2018-01-06" },
  { id: "u4", name: "Fatma Yıldız", role: "Temizlik Sorumlusu", department: "Temizlik", email: "fatma@parkplazamaslak.com", phone: "", startDate: null },
  { id: "u5", name: "Yasin Yar", role: "Facility Manager", department: "Yönetim", email: "yonetim@parkplazamaslak.com", phone: "", startDate: "2026-05-04" },
  { id: "u6", name: "Vedat İpek", role: "Güvenlik Görevlisi", department: "Güvenlik", email: "vedat.ipek@parkplazamaslak.com", phone: "", startDate: "2015-10-29" },
  { id: "u7", name: "Gökmen Akbulut", role: "Güvenlik Görevlisi", department: "Güvenlik", email: "gokmen.akbulut@parkplazamaslak.com", phone: "", startDate: "2017-10-20" },
  { id: "u8", name: "Reyhani Güner", role: "Güvenlik Görevlisi", department: "Güvenlik", email: "reyhani.guner@parkplazamaslak.com", phone: "", startDate: "2023-11-06" },
  { id: "u9", name: "Aydın Cebeci", role: "Güvenlik Görevlisi", department: "Güvenlik", email: "aydin.cebeci@parkplazamaslak.com", phone: "", startDate: "2015-04-21" },
  { id: "u10", name: "Yıldız Çelik", role: "Güvenlik Görevlisi", department: "Güvenlik", email: "yildiz.celik@parkplazamaslak.com", phone: "", startDate: "2025-04-08" },
  { id: "u11", name: "Emin Arslan", role: "Güvenlik Görevlisi", department: "Güvenlik", email: "emin.arslan@parkplazamaslak.com", phone: "", startDate: "2026-02-09" },
  { id: "u12", name: "Şanver Çetinkaya", role: "Güvenlik Görevlisi", department: "Güvenlik", email: "sanver.cetinkaya@parkplazamaslak.com", phone: "", startDate: "2016-06-06" },
  { id: "u13", name: "Bilgutay Hakan Özel", role: "Güvenlik Görevlisi", department: "Güvenlik", email: "bilgutay.ozel@parkplazamaslak.com", phone: "", startDate: "2025-06-05" },
  { id: "u14", name: "Cenk Türkdoğan", role: "Güvenlik Görevlisi", department: "Güvenlik", email: "cenk.turkdogan@parkplazamaslak.com", phone: "", startDate: "2025-07-23" },
  { id: "u15", name: "Veysel Karani Korkmaz", role: "Güvenlik Görevlisi", department: "Güvenlik", email: "veysel.korkmaz@parkplazamaslak.com", phone: "", startDate: "2026-06-10" },
  { id: "u16", name: "Ahmet Kabadayı", role: "Teknik Personel", department: "Teknik", email: "ahmet.kabadayi@parkplazamaslak.com", phone: "", startDate: "2025-01-14" },
  { id: "u17", name: "Rifat Çavdar", role: "Teknik Personel", department: "Teknik", email: "rifat.cavdar@parkplazamaslak.com", phone: "", startDate: "2024-10-07" },
  { id: "u18", name: "Ekrem Kargın", role: "Teknik Personel", department: "Teknik", email: "ekrem.kargin@parkplazamaslak.com", phone: "", startDate: "2018-12-04" },
  { id: "u19", name: "Selçuk Arslan", role: "Teknik Personel", department: "Teknik", email: "selcuk.arslan@parkplazamaslak.com", phone: "", startDate: "2022-09-27" },
  { id: "u20", name: "İshak Turan", role: "Teknik Personel", department: "Teknik", email: "ishak.turan@parkplazamaslak.com", phone: "", startDate: "2024-10-23" },
  { id: "u21", name: "Mustafa Sarı", role: "Temizlik Personeli", department: "Temizlik", email: "mustafa.sari@parkplazamaslak.com", phone: "", startDate: "2015-04-02" },
  { id: "u22", name: "Sezgin Sarı", role: "Temizlik Personeli", department: "Temizlik", email: "sezgin.sari@parkplazamaslak.com", phone: "", startDate: "2019-06-11" },
  { id: "u23", name: "Adem Kale", role: "Temizlik Personeli", department: "Temizlik", email: "adem.kale@parkplazamaslak.com", phone: "", startDate: "2015-04-01" },
  { id: "u24", name: "Aysel Aydoğan", role: "Temizlik Personeli", department: "Temizlik", email: "aysel.aydogan@parkplazamaslak.com", phone: "", startDate: "2018-03-14" },
  { id: "u25", name: "Mehmet Kabakçı", role: "Temizlik Personeli", department: "Temizlik", email: "mehmet.kabakci@parkplazamaslak.com", phone: "", startDate: "2022-09-20" },
  { id: "u26", name: "Dursun Kaya", role: "Temizlik Personeli", department: "Temizlik", email: "dursun.kaya@parkplazamaslak.com", phone: "", startDate: "2015-04-01" },
  { id: "u27", name: "Ozan Kural", role: "Yönetim Personeli", department: "Yönetim", email: "ozan.kural@parkplazamaslak.com", phone: "", startDate: "2019-08-01" },
  { id: "u28", name: "Kübra Er", role: "Yönetim Personeli", department: "Yönetim", email: "kubra.er@parkplazamaslak.com", phone: "", startDate: "2024-03-04" },
  { id: "u29", name: "Esra Baltayev", role: "Yönetim Personeli", department: "Yönetim", email: "esra.baltayev@parkplazamaslak.com", phone: "", startDate: "2024-01-04" },
  { id: "u30", name: "Pınar Uğur", role: "Yönetim Personeli", department: "Yönetim", email: "pinar.ugur@parkplazamaslak.com", phone: "", startDate: "2023-02-14" },
  { id: "u31", name: "Gülsen Bilgili", role: "Yönetim Personeli", department: "Yönetim", email: "gulsen.bilgili@parkplazamaslak.com", phone: "", startDate: "2025-09-25" },
  { id: "u32", name: "Belma Demir", role: "Yönetim Personeli", department: "Yönetim", email: "belma.demir@parkplazamaslak.com", phone: "", startDate: "2022-06-21" },
  { id: "u33", name: "Ebru Koç", role: "Resepsiyon Görevlisi", department: "Resepsiyon", email: "ebru.koc@parkplazamaslak.com", phone: "", startDate: "2026-04-13" },
];

// Personel (HR) kaydı — SADECE kişi bilgisi. Giriş/yetki bilgisi artık ayrı
// bir `users` kaydında (bkz. USERS altında) — kullanıcı teyidiyle: "Personel
// ile kullanıcı ilişkisi olmalı. Personel kartında kullanıcı aç dedikten
// sonra yetkiler verilmeli". Bu ayrım, Yonetim.jsx'ten eklenen bir personelin
// hiç giriş bilgisi oluşmadan kalması (giremiyor) sorununu da kalıcı çözüyor —
// artık "Kullanıcı Aç" bilinçli bir adım, unutulan bir alan değil.
export const TEAM = RAW_TEAM;

// Kullanıcı (giriş hesabı) kaydı — bir personele (personnelId) bağlı, ayrı
// username/password/mobileAccess/permissions taşır. Seed'deki her personelin
// zaten bir hesabı var (mevcut davranışla birebir aynı — hepsi tam yetkiliydi).
// Güvenlik notu: bu obje BİLEREK bir `password` alanı taşımıyor. Gerçek
// giriş her zaman Firebase Authentication üzerinden (bkz. firebase.js
// login() → signInWithEmailAndPassword) — burada tutulan herhangi bir şifre
// metni hiçbir zaman doğrulama için OKUNMAZ, sadece ölü ağırlık olurdu. Ve
// bu obje `users` dizisinin bir parçası olarak TEK paylaşılan Firestore
// state dokümanına yazılır — o doküman GİRİŞ YAPMIŞ HER istemciye tam
// olarak indiriliyor (bkz. firebase.js subscribeState, "tüm istemciler
// state dokümanını her senkronda TAMAMEN indiriyor"). Yani buraya bir şifre
// metni koymak, en düşük yetkili sahadaki personelin bile tarayıcısında
// (React state/DevTools) Yönetim'in şifresini görebilmesi anlamına gelirdi
// — bulunup düzeltilen bir güvenlik açığıydı (bkz. migrateLegacyState'teki
// geriye dönük temizleme adımı, zaten Firestore'a yazılmış eski kayıtları da
// temizliyor).
export const USERS = RAW_TEAM.map((t) => ({
  id: `usr_${t.id}`,
  personnelId: t.id,
  username: t.email,
  mobileAccess: true,
  permissions: buildPermissions(defaultWebScreens(t)),
}));

const now = Date.now();
const h = (n) => new Date(now - n * 3600 * 1000).toISOString();
const d = (n) => new Date(now - n * 86400 * 1000).toISOString().slice(0, 10);

export const SLA_HOURS = { "Kritik": 1, "Yüksek": 4, "Orta": 24, "Düşük": 72 };

export const INITIAL_TASKS = [
  { id: "t1", ticketNo: 3101, department: "Teknik", issueType: "Yangın Sistemi", priority: "Kritik", status: "Yapılacak", description: "Jeneratör (PP-002) bakım gecikmesi — planlanan tarih geçti", requester: "Sistem", assignee: "Ahmet Karayat", createdAt: h(76), dueDate: d(-1), assetId: "PP-002" },
  { id: "t2", ticketNo: 3102, department: "Teknik", issueType: "Mekanik", priority: "Kritik", status: "Üzr. Çalışılıyor", description: "Chiller (PP-034-01) arızası — soğutma kapasitesi düştü", requester: "Ahmet Karayat", assignee: "Ahmet Karayat", createdAt: h(2), dueDate: d(0), assetId: "PP-034-01" },
  { id: "t3", ticketNo: 3103, department: "Teknik", issueType: "Elektrik", priority: "Yüksek", status: "Yapılacak", description: "Trafo (PP-001-01) kompanzasyon panosunda ısınma tespit edildi", requester: "Selçuk Ertuğrul", assignee: "Ahmet Karayat", createdAt: h(3), dueDate: d(0), assetId: "PP-001-01" },
  { id: "t4", ticketNo: 3104, department: "Güvenlik", issueType: "Güvenlik", priority: "Orta", status: "Yapılacak", description: "Kollu bariyer (PP-079-01) motoru gürültü yapıyor", requester: "Ümit Asak", assignee: "Selçuk Ertuğrul", createdAt: h(20), dueDate: d(1), assetId: "PP-079-01" },
  { id: "t5", ticketNo: 3105, department: "Temizlik", issueType: "Temizlik", priority: "Düşük", status: "Yapılacak", description: "15. kat WC sabunluk dolumu", requester: "Fatma Yıldız", assignee: "Fatma Yıldız", createdAt: h(10), dueDate: d(2) },
  { id: "t6", ticketNo: 3106, department: "Teknik", issueType: "Asansör", priority: "Yüksek", status: "Tamamlandı", description: "İnsan asansörü (PP-005-01) periyodik bakımı", requester: "Ahmet Karayat", assignee: "Ahmet Karayat", createdAt: h(96), dueDate: d(3), completedAt: h(90), assetId: "PP-005-01" },
  { id: "t7", ticketNo: 3107, department: "İSG", issueType: "İdari", priority: "Orta", status: "Yapılacak", description: "Yangın tatbikatı planlaması", requester: "Yasin Yar", assignee: "", createdAt: h(48), dueDate: d(5) },
  { id: "t8", ticketNo: 3108, department: "Teknik", issueType: "Talep", company: "Akbank Genel Müdürlük", location: "12. Kat", priority: "Orta", status: "Yapılacak", description: "Toplantı odası klimasından su damlıyor, kontrol edilmesini rica ederiz.", requester: "Akbank Genel Müdürlük — İdari İşler", assignee: "", createdAt: h(6), dueDate: "" },
  { id: "t9", ticketNo: 3109, department: "Temizlik", issueType: "Şikayet", company: "Getir Türkiye", location: "8. Kat", priority: "Düşük", status: "Yapılacak", description: "Kat mutfağı iki gündür temizlenmedi, çöp kutuları taşıyor.", requester: "Getir Türkiye — Ofis Yöneticisi", assignee: "", createdAt: h(1), dueDate: "" },
];

// Talep/Şikayet modülü — kiracı firmalardan gelen kayıtlar da normal görev
// (state.tasks) olarak tutulur, sadece `company`/`location` alanları ekler.
// Böylece departmanların görev ekranlarında ayrı bir veri kopyası olmadan,
// aynı listede (oluşturulma sırasına göre en altta) görünürler.
export const TALEP_TYPES = ["Talep", "Şikayet"];

// Gerçek varlık envanteri — "Park_Plaza_Makine_Elektronik_Techizat_Asset_List.xlsx"
// dosyasındaki "Asset Listesi" sekmesinden (85 kayıt) birebir aktarıldı. Kaynak
// dosyada "Mahal" (konum) sütunu henüz doldurulmamış, bu yüzden location boş —
// uydurma konum yazılmadı. Kritiklik, ekipman grubuna göre (Trafo/Jeneratör/
// Yangın/Chiller/Asansör/UPS = Kritik vb.) sonradan çıkarıldı; kaynak dosyada
// durum (Aktif/Arızalı/Bakımda) bilgisi yok, bu yüzden hepsi "Aktif" varsayıldı.
//
// Kat Planı'na tek tek yerleştirilebilen ekipmanlar (Trafo, Klima Santrali,
// Fancoil) "quantity: N" ile tek bir toplu kayıt yerine N ayrı varlık kaydı
// olarak tutulur (id'ler "PP-024-01".."PP-024-45" gibi) — böylece her Kat
// Planı yerleşimi kendine özgü, gerçek bir varlık kaydına karşılık gelir.
function expandInstances(baseId, count, base) {
  return Array.from({ length: count }, (_, i) => ({ ...base, id: `${baseId}-${String(i + 1).padStart(2, "0")}`, quantity: 1 }));
}

const RAW_ASSETS = [
  ...expandInstances("PP-001", 2, { name: "Trafo", category: "Elektrik Sistemi", location: "", model: "", serial: "", manufacturer: "AEG Eti", power: "1.600 kVA", installDate: "", criticality: "Kritik", status: "Aktif", notes: "OG/AG hücreleri, kompanzasyon panoları, ana/tali panolar vb. tesisat dahil" }),
  { id: "PP-002", name: "Jeneratör", category: "Jeneratör", location: "", model: "ÇJ620", serial: "S/N C068633/02 - 1997", manufacturer: "Çukurova", power: "620 kVA", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "Kabinsiz" },
  { id: "PP-003", name: "Jeneratör", category: "Jeneratör", location: "", model: "ÇJ620", serial: "S/N C069810/02 - 1998", manufacturer: "Çukurova", power: "620 kVA", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "Kabinsiz" },
  { id: "PP-004-01", name: "Jeneratör", category: "Jeneratör", location: "", model: "AC710", serial: "S/N 25249775 - 2000", manufacturer: "Aksa", power: "", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "Kabinli; transfer panosu, yedek yakıt tankı, pompa grubu ve tesisatı dahil" },
  { id: "PP-004-02", name: "Jeneratör", category: "Jeneratör", location: "", model: "AC710", serial: "S/N 25265234 - 2000", manufacturer: "Aksa", power: "", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "Kabinli; transfer panosu, yedek yakıt tankı, pompa grubu ve tesisatı dahil" },
  ...expandInstances("PP-005", 2, { name: "İnsan asansörü", category: "Asansör", location: "", model: "13 kişilik", serial: "", manufacturer: "Otis", power: "800 kg / 13 durak", installDate: "", criticality: "Kritik", status: "Aktif", notes: "" }),
  { id: "PP-006", name: "İnsan asansörü", category: "Asansör", location: "", model: "13 kişilik", serial: "", manufacturer: "Otis", power: "1000 kg / 13 durak", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "" },
  ...expandInstances("PP-007", 2, { name: "İnsan asansörü", category: "Asansör", location: "", model: "10 kişilik", serial: "", manufacturer: "Otis", power: "800 kg / 11 durak", installDate: "", criticality: "Kritik", status: "Aktif", notes: "" }),
  { id: "PP-008", name: "İnsan asansörü", category: "Asansör", location: "", model: "10 kişilik", serial: "", manufacturer: "Otis", power: "800 kg / 7 durak", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "" },
  { id: "PP-009", name: "İnsan asansörü", category: "Asansör", location: "", model: "10 kişilik", serial: "", manufacturer: "Otis", power: "800 kg / 6 durak", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "" },
  { id: "PP-010", name: "Sedye asansörü", category: "Asansör", location: "", model: "13 kişilik", serial: "1996", manufacturer: "Otis", power: "1000 kg / 22 durak", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "2024-2025 döneminde kısmen revize edilmiş; çağırma panelleri ve tesisatı dahil" },
  { id: "PP-011", name: "Cephe temizleme asansörü", category: "Cephe Temizleme Asansörü", location: "", model: "Junior213-A", serial: "S/N 97.04.634 - 1997", manufacturer: "Secalt/Tractel", power: "200 kg", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Tüm pano ve tesisatları ile" },
  { id: "PP-012", name: "Cephe temizleme asansörü", category: "Cephe Temizleme Asansörü", location: "", model: "X300P", serial: "S/N 10926 - 2022", manufacturer: "Trak", power: "450 kg", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Tüm pano ve tesisatları ile" },
  ...expandInstances("PP-013", 3, { name: "Sıcak su kazanı", category: "Isıtma Sistemi", location: "", model: "Paromat-Simplex", serial: "", manufacturer: "Viessmann", power: "750.000 kcal/h", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Yer tipi doğalgazlı" }),
  ...expandInstances("PP-014", 3, { name: "Doğalgaz brülör", category: "Isıtma Sistemi", location: "", model: "GL7/1-D", serial: "", manufacturer: "Weishaupt", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" }),
  ...expandInstances("PP-015", 2, { name: "Plakalı eşanjör", category: "Isıtma Sistemi", location: "", model: "16 bar", serial: "", manufacturer: "Alfa Laval", power: "16 bar", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Eşanjörler, boyler, genleşme tankları, pompalar, baca sistemi ve panolar dahil" }),
  { id: "PP-016", name: "Üst zone elektrik motorlu yangın pompası", category: "Yangın Suyu Basınçlandırma Sistemi", location: "", model: "", serial: "", manufacturer: "Patterson", power: "2 x 40 HP", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "" },
  { id: "PP-017", name: "Üst zone elektrik motorlu joker pompa", category: "Yangın Suyu Basınçlandırma Sistemi", location: "", model: "", serial: "", manufacturer: "Franklin Electric", power: "1 HP", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "" },
  { id: "PP-018", name: "Alt zone elektrik motorlu yangın pompası", category: "Yangın Suyu Basınçlandırma Sistemi", location: "", model: "", serial: "", manufacturer: "Patterson", power: "2 x 150 HP", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "" },
  { id: "PP-019", name: "Alt zone joker pompa", category: "Yangın Suyu Basınçlandırma Sistemi", location: "", model: "", serial: "", manufacturer: "Franklin Electric", power: "2 HP", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "Yangın tesisatları, tanklar, kollektörler, vanalar, kompresörler, hidrant/sprinkler dahil" },
  { id: "PP-020", name: "Elektrik pompalı hidrofor", category: "Basınçlı Su Sistemi", location: "", model: "", serial: "", manufacturer: "Wilo", power: "3 x 2,2 kW", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" },
  ...expandInstances("PP-021", 2, { name: "Elektrik pompalı hidrofor", category: "Basınçlı Su Sistemi", location: "", model: "", serial: "", manufacturer: "Wilo", power: "3 x 5,5 kW", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" }),
  ...expandInstances("PP-022", 2, { name: "Drenaj pompası", category: "Basınçlı Su Sistemi", location: "", model: "", serial: "", manufacturer: "", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" }),
  ...expandInstances("PP-023", 2, { name: "Garaj rögar atık su pompası", category: "Basınçlı Su Sistemi", location: "", model: "", serial: "", manufacturer: "", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Bahçe sulama tesisatı, kumanda panosu, arıtma/yumuşatma sistemi, UV filtresi vb. dahil" }),
  ...expandInstances("PP-024", 45, { name: "Klima santrali", category: "Havalandırma ve Klima Santrali", location: "", model: "", serial: "", manufacturer: "Ciat", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" }),
  ...expandInstances("PP-025", 20, { name: "Otopark havalandırma fanı", category: "Havalandırma ve Klima Santrali", location: "", model: "", serial: "", manufacturer: "Matthew&Yates", power: "Çift fanlı / çift motorlu", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" }),
  ...expandInstances("PP-026", 38, { name: "Basınçlandırma fanı", category: "Havalandırma ve Klima Santrali", location: "", model: "", serial: "", manufacturer: "Matthew&Yates", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" }),
  ...expandInstances("PP-027", 2, { name: "Yangın merdiveni basınçlandırma fanı", category: "Havalandırma ve Klima Santrali", location: "", model: "", serial: "", manufacturer: "Matthew&Yates", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" }),
  ...expandInstances("PP-028", 2, { name: "WC aspiratör fanı", category: "Havalandırma ve Klima Santrali", location: "", model: "", serial: "", manufacturer: "Matthew&Yates", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" }),
  { id: "PP-029", name: "Egzoz fanı", category: "Havalandırma ve Klima Santrali", location: "", model: "", serial: "", manufacturer: "Aldağ", power: "9.000 m³/h", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" },
  ...expandInstances("PP-030", 25, { name: "Fancoil", category: "Havalandırma ve Klima Santrali", location: "", model: "UTA305 / UTA370", serial: "", manufacturer: "Ciat", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Hücre aspiratör/ventilatör, kanal tipi fanlar, damper motorları, hava kanalları dahil" }),
  ...expandInstances("PP-031", 2, { name: "Otomatik garaj kapısı", category: "Otomatik Kapı", location: "", model: "", serial: "", manufacturer: "", power: "", installDate: "", criticality: "Orta", status: "Aktif", notes: "" }),
  { id: "PP-032", name: "Otomatik döner kapı", category: "Otomatik Kapı", location: "", model: "", serial: "", manufacturer: "", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-033", name: "Hidrolik yol kesici platformu", category: "Otomatik Kapı", location: "", model: "", serial: "", manufacturer: "", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "Alt yapı sistemi ile" },
  { id: "PP-034-01", name: "Chiller", category: "Chiller Sistemi", location: "", model: "YSDACAS35CGO", serial: "S/N BCFM014489", manufacturer: "York", power: "920.000 kcal/h", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "" },
  { id: "PP-034-02", name: "Chiller", category: "Chiller Sistemi", location: "", model: "YSDACAS35CGO", serial: "S/N BCFM014490", manufacturer: "York", power: "920.000 kcal/h", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "" },
  { id: "PP-035", name: "Eşanjör", category: "Chiller Sistemi", location: "", model: "", serial: "", manufacturer: "Alfa Laval", power: "175.000 kcal/h / 16 bar", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "" },
  ...expandInstances("PP-036", 2, { name: "Eşanjör", category: "Chiller Sistemi", location: "", model: "", serial: "", manufacturer: "Alfa Laval", power: "630.000 kcal/h", installDate: "", criticality: "Kritik", status: "Aktif", notes: "Elektrik/kontrol panoları, sirkülasyon pompaları ve tesisatı dahil" }),
  { id: "PP-037-01", name: "Soğutma kulesi", category: "Soğutma Kulesi", location: "", model: "LSTE-8P212", serial: "S/N 16-781205 - 2016", manufacturer: "Evapco", power: "30 kW", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Kule suyu otomatik şartlandırma ve biocid cihazı, sirkülasyon pompaları dahil" },
  { id: "PP-037-02", name: "Soğutma kulesi", category: "Soğutma Kulesi", location: "", model: "LSTE-8P212", serial: "S/N 16-781206 - 2016", manufacturer: "Evapco", power: "30 kW", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Kule suyu otomatik şartlandırma ve biocid cihazı, sirkülasyon pompaları dahil" },
  { id: "PP-037-03", name: "Soğutma kulesi", category: "Soğutma Kulesi", location: "", model: "LSTE-8P212", serial: "S/N 16-781207 - 2016", manufacturer: "Evapco", power: "30 kW", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Kule suyu otomatik şartlandırma ve biocid cihazı, sirkülasyon pompaları dahil" },
  { id: "PP-038", name: "Chiller", category: "Chiller Sistemi", location: "", model: "YVWAUDUDGFDE1103SAX", serial: "S/N PMFM 010297 - 2018", manufacturer: "York", power: "", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "Elektrik/kontrol panoları, sirkülasyon pompaları ve tesisatı dahil" },
  { id: "PP-039", name: "Zemin temizleme otomatı", category: "Temizlik Ekipmanı", location: "", model: "1250", serial: "2010", manufacturer: "Taski", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-040", name: "Cila makinesi", category: "Temizlik Ekipmanı", location: "", model: "Roto165", serial: "2010", manufacturer: "Taski", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-041", name: "Islak kuru elektrikli süpürge", category: "Temizlik Ekipmanı", location: "", model: "Vento44", serial: "2010", manufacturer: "Taski", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-042", name: "Kuru tip vakum makinesi", category: "Temizlik Ekipmanı", location: "", model: "Vetro15", serial: "2010", manufacturer: "Taski", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-043", name: "Adı listelenmeyen diğer makine ve teçhizat", category: "Diğer Makine ve Teçhizat", location: "", model: "", serial: "", manufacturer: "", power: "", quantity: null, installDate: "", criticality: "Düşük", status: "Aktif", notes: "" },
  { id: "PP-044", name: "Sunucu", category: "Bilgisayar Sistemi", location: "", model: "DL 380P Gen8", serial: "", manufacturer: "HP", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  ...expandInstances("PP-045", 7, { name: "Masaüstü bilgisayar ve yan donanımları", category: "Bilgisayar Sistemi", location: "", model: "", serial: "", manufacturer: "Muhtelif", power: "", installDate: "", criticality: "Orta", status: "Aktif", notes: "" }),
  { id: "PP-046", name: "Kart baskı cihazı", category: "Bilgisayar Sistemi", location: "", model: "Presto Direct Card300", serial: "", manufacturer: "Fargo", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-047", name: "Fotokopi cihazı", category: "Bilgisayar Sistemi", location: "", model: "1536 DNF", serial: "", manufacturer: "HP", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-048", name: "Faks cihazı", category: "Bilgisayar Sistemi", location: "", model: "222", serial: "", manufacturer: "Brother", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-049", name: "Lazer yazıcı", category: "Bilgisayar Sistemi", location: "", model: "ML1660", serial: "", manufacturer: "Samsung", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-050", name: "Lazer yazıcı", category: "Bilgisayar Sistemi", location: "", model: "1020", serial: "", manufacturer: "HP", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-051", name: "Lazer yazıcı", category: "Bilgisayar Sistemi", location: "", model: "1018", serial: "", manufacturer: "HP", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-052", name: "Yazıcı", category: "Bilgisayar Sistemi", location: "", model: "FX-890", serial: "", manufacturer: "Epson", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-053", name: "Tarayıcı", category: "Bilgisayar Sistemi", location: "", model: "Scanjet 200", serial: "", manufacturer: "HP", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "Muhtelif lazer/nokta vuruşlu/mürekkep/barcod yazıcılar ve network ekipmanları dahil" },
  { id: "PP-054", name: "UPS", category: "Kesintisiz Güç Kaynağı", location: "", model: "ETR 33040", serial: "S/N 1403P0190002", manufacturer: "Inform", power: "40 kVA", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "Akü seti ile birlikte" },
  ...expandInstances("PP-055", 96, { name: "Sabit/hareketli kamera", category: "Kapalı Devre Kamera ve Güvenlik Sistemi", location: "", model: "", serial: "", manufacturer: "Hikvision", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "İç ve dış kameralar" }),
  ...expandInstances("PP-056", 8, { name: "Kamera kayıt cihazı / sistem donanımı", category: "Kapalı Devre Kamera ve Güvenlik Sistemi", location: "", model: "", serial: "", manufacturer: "Hikvision / Dahua", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Sabit diskler, bilgisayar, monitör, switch tesisatı dahil" }),
  { id: "PP-057", name: "Plaka tanıma sistemi", category: "Kapalı Devre Kamera ve Güvenlik Sistemi", location: "", model: "", serial: "", manufacturer: "", power: "", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Monitör, bilgisayar, tesisat ve teçhizat dahil" },
  { id: "PP-058", name: "Kart okuma sistemi", category: "Kapalı Devre Kamera ve Güvenlik Sistemi", location: "", model: "", serial: "", manufacturer: "", power: "", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" },
  { id: "PP-059", name: "Kapı tipi metal dedektör", category: "Kapalı Devre Kamera ve Güvenlik Sistemi", location: "", model: "", serial: "", manufacturer: "EIA", power: "", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" },
  { id: "PP-060", name: "Tünel tipi X-Ray cihazı", category: "Kapalı Devre Kamera ve Güvenlik Sistemi", location: "", model: "XRC 50-30P", serial: "", manufacturer: "XRC", power: "", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" },
  { id: "PP-061", name: "Alarm sistemi", category: "Kapalı Devre Kamera ve Güvenlik Sistemi", location: "", model: "", serial: "", manufacturer: "Paradox", power: "", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Kontrol paneli, siren, sensörler ve tesisatı ile" },
  { id: "PP-062", name: "Duman algılama paneli ve ekipmanları", category: "Yangın / Gaz Algılama ve İkaz Sistemi", location: "", model: "", serial: "", manufacturer: "Siemens", power: "", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "Eş paneller, dedektörler, tesisatlar, switchler ve ikaz sistemleri dahil" },
  { id: "PP-063", name: "Gaz algılama paneli ve ekipmanları", category: "Yangın / Gaz Algılama ve İkaz Sistemi", location: "", model: "", serial: "", manufacturer: "Karbonmonoksit", power: "", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "Eş paneller, gaz dedektörleri, tesisatlar, switchler ve ikaz sistemleri dahil" },
  { id: "PP-064", name: "Kanal tipi klima", category: "Klima", location: "", model: "", serial: "2020", manufacturer: "Olefine", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  ...expandInstances("PP-065", 2, { name: "Uzun tip hava perdesi", category: "Klima", location: "", model: "", serial: "", manufacturer: "Niva", power: "", installDate: "", criticality: "Orta", status: "Aktif", notes: "" }),
  { id: "PP-066", name: "TV yayın dağıtım sistemi", category: "TV Yayın Sistemi", location: "", model: "", serial: "", manufacturer: "", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "Yükselticiler, çanaklar, LNB ve ara dağıtıcılar dahil" },
  ...expandInstances("PP-067", 2, { name: "LED TV", category: "Televizyon", location: "", model: "", serial: "", manufacturer: "LG", power: "", installDate: "", criticality: "Düşük", status: "Aktif", notes: "" }),
  { id: "PP-068", name: "CD çalar", category: "Ses ve Anons Sistemi", location: "", model: "SL-PD887", serial: "", manufacturer: "Technics", power: "5 diskli", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-069", name: "Tuner", category: "Ses ve Anons Sistemi", location: "", model: "ST-GT350", serial: "", manufacturer: "Technics", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-070", name: "Kaset çalar", category: "Ses ve Anons Sistemi", location: "", model: "RS-TR474", serial: "", manufacturer: "Technics", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  ...expandInstances("PP-071", 8, { name: "Power amplifer", category: "Ses ve Anons Sistemi", location: "", model: "Series 4000", serial: "", manufacturer: "Paso", power: "", installDate: "", criticality: "Orta", status: "Aktif", notes: "" }),
  ...expandInstances("PP-072", 4, { name: "Power amplifer", category: "Ses ve Anons Sistemi", location: "", model: "Series 8000", serial: "", manufacturer: "Paso", power: "", installDate: "", criticality: "Orta", status: "Aktif", notes: "" }),
  { id: "PP-073", name: "Preamplifer mixer", category: "Ses ve Anons Sistemi", location: "", model: "Series 4000", serial: "", manufacturer: "Paso", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "" },
  { id: "PP-074", name: "Dijital message generator", category: "Ses ve Anons Sistemi", location: "", model: "DMG 9000", serial: "", manufacturer: "Paso", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "Anfi, mikser, mikrofon, hoparlör, siren, ikaz butonu vb. dahil" },
  { id: "PP-075", name: "IP santral", category: "Telefon Santrali", location: "", model: "Hipath 3800", serial: "", manufacturer: "Siemens", power: "", quantity: 1, installDate: "", criticality: "Orta", status: "Aktif", notes: "Sabit/telsiz tip aparyeller, FCT terminali ve tesisatı dahil" },
  { id: "PP-076", name: "Çift geçişli boy turnike", category: "Kapı ve Geçiş Sistemi", location: "", model: "", serial: "", manufacturer: "", power: "", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" },
  ...expandInstances("PP-077", 6, { name: "Üç kollu turnike / geçiş okuyucu modülleri", category: "Kapı ve Geçiş Sistemi", location: "", model: "LTT303", serial: "", manufacturer: "Tansa", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" }),
  { id: "PP-078", name: "Kanatlı swing gate turnike", category: "Kapı ve Geçiş Sistemi", location: "", model: "", serial: "", manufacturer: "", power: "", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" },
  ...expandInstances("PP-079", 3, { name: "Kollu bariyer", category: "Kapı ve Geçiş Sistemi", location: "", model: "", serial: "", manufacturer: "", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Tüm ekipman, pano ve donanımları ile" }),
  { id: "PP-080", name: "Adı listelenmeyen diğer elektronik cihazlar", category: "Diğer Elektronik Cihaz", location: "", model: "", serial: "", manufacturer: "", power: "", quantity: null, installDate: "", criticality: "Düşük", status: "Aktif", notes: "" },
  { id: "PP-081", name: "Laptop", category: "Dizüstü Bilgisayar", location: "", model: "", serial: "", manufacturer: "HP", power: "", quantity: 1, installDate: "", criticality: "Düşük", status: "Aktif", notes: "" },
  { id: "PP-082", name: "Dijital mobil radyo ana modülü", category: "Telsizler", location: "", model: "", serial: "", manufacturer: "Hytera", power: "", quantity: 1, installDate: "", criticality: "Düşük", status: "Aktif", notes: "" },
  ...expandInstances("PP-083", 3, { name: "Telsiz", category: "Telsizler", location: "", model: "PD 375", serial: "", manufacturer: "Hytera", power: "", installDate: "", criticality: "Düşük", status: "Aktif", notes: "" }),
  ...expandInstances("PP-084", 10, { name: "Telsiz", category: "Telsizler", location: "", model: "PD 405", serial: "", manufacturer: "Hytera", power: "", installDate: "", criticality: "Düşük", status: "Aktif", notes: "" }),
  ...expandInstances("PP-085", 3, { name: "El dedektörü", category: "El Dedektörü", location: "", model: "", serial: "", manufacturer: "Muhtelif", power: "", installDate: "", criticality: "Düşük", status: "Aktif", notes: "" }),
  { id: "PP-086", name: "Road blocker", category: "Kapı ve Geçiş Sistemi", location: "", model: "", serial: "", manufacturer: "", power: "", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "Giriş bahçesi araç kontrol bariyeri" },
  // Yangın dolabı (hortum) ve yangın söndürme tüpü — her kattaki Beşiktaş ve
  // Sarıyer bloklarında birer adet (kullanıcı teyidiyle: "her katta beşiktaş
  // ve sarıyer tarafında yangın hortumu ve yangın tüpü var"). 23 bölümlü kat ×
  // 2 blok = 46 adet; Kat Planı'nda ilgili kat/blok başına bir örnek atanır.
  ...expandInstances("PP-087", 46, { name: "Yangın dolabı (hortum)", category: "Yangın Söndürme Ekipmanı", location: "", model: "", serial: "", manufacturer: "", power: "", installDate: "", criticality: "Kritik", status: "Aktif", notes: "" }),
  ...expandInstances("PP-088", 46, { name: "Yangın söndürme tüpü", category: "Yangın Söndürme Ekipmanı", location: "", model: "6 KG Kuru Kimyevi Tozlu (ABC)", serial: "", manufacturer: "", power: "", installDate: "", criticality: "Kritik", status: "Aktif", notes: "" }),
  // 3B — Hidrofor ve Yangın Pompası Odası. Kullanıcı teyidiyle: "1 Arıtma
  // Sistemi 3 Adet Su deposu 200 Tonluk". Daha önce sadece mi13 bakım
  // kartında adı geçen "Arıtma Sistemi"nin gerçek envanter karşılığı yoktu —
  // burada eklendi.
  { id: "PP-089", name: "Arıtma sistemi", category: "Basınçlı Su Sistemi", location: "", model: "", serial: "", manufacturer: "", power: "", quantity: 1, installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" },
  ...expandInstances("PP-090", 3, { name: "Su deposu", category: "Su Deposu", location: "", model: "", serial: "", manufacturer: "", power: "200 ton", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" }),
  // ÇATI1 — Yangın Pompası Odası. Kullanıcı teyidiyle: "burda da yangın
  // pompası ve 1 yangın deposu var". PP-090 (Su Deposu, 3B) genel/kullanım
  // suyu deposu — bu ayrı, yangın suyu için tek bir depo.
  { id: "PP-091", name: "Yangın deposu", category: "Yangın Suyu Basınçlandırma Sistemi", location: "", model: "", serial: "", manufacturer: "", power: "", quantity: 1, installDate: "", criticality: "Kritik", status: "Aktif", notes: "" },
  // 4B — ADP (Ana Dağıtım Panosu) Odası. Kullanıcı teyidiyle: "ADP odası
  // Kompanzasyon Panosunu koy" + "kompanzasyon 2 adet var" (biri Beşiktaş,
  // biri Sarıyer tarafındaki ADP Odası'nda — bkz. TEKNIK_MEKANIK_GUNLUK
  // mtd2/mtd2b). PP-001 (Trafo) notunda geçen kompanzasyon panosundan ayrı,
  // ADP odalarının kendi ana kompanzasyon panoları.
  ...expandInstances("PP-092", 2, { name: "Kompanzasyon panosu", category: "Elektrik Sistemi", location: "", model: "", serial: "", manufacturer: "", power: "", installDate: "", criticality: "Yüksek", status: "Aktif", notes: "" }),
  // Otopark katlarında (2B-6B) da her blokta (Beşiktaş/Sarıyer) birer yangın
  // dolabı ve tüpü var — kullanıcı teyidiyle: "otoparklarda aynı şaft ve
  // yangın dolabı var" (ofis katlarındaki PP-087/088 ile AYNI kurulum
  // deseni). 5 otopark katı × 2 blok = 10 adet.
  ...expandInstances("PP-093", 10, { name: "Yangın dolabı (hortum)", category: "Yangın Söndürme Ekipmanı", location: "", model: "", serial: "", manufacturer: "", power: "", installDate: "", criticality: "Kritik", status: "Aktif", notes: "" }),
  ...expandInstances("PP-094", 10, { name: "Yangın söndürme tüpü", category: "Yangın Söndürme Ekipmanı", location: "", model: "6 KG Kuru Kimyevi Tozlu (ABC)", serial: "", manufacturer: "", power: "", installDate: "", criticality: "Kritik", status: "Aktif", notes: "" }),
  // Kullanıcı teyidiyle: "yangın dolaplarındaki tüpler Kuru Tip ABC 6KG. Her
  // Teknik Mahalede ekle 6kg Kuru Tip ABC" — koridordaki yangın dolabı
  // tüpünden (PP-088/094) AYRI olarak, her Teknik Mahal'in (klima santrali/
  // fancoil odası) kendi içinde de bir tüp var (23 kat × 2 blok = 46 adet),
  // + 4 adet çatı/mekanik oda (kullanıcı teyidiyle: "yangın dolaplarının
  // dışında mahallerede koymuştuk... çatı katındaki mekanik odalarda var" —
  // Yangın Pompası Odası, Soğutma Kulesi Odası (ÇATI1), Hidrofor ve Yangın
  // Pompası, Soğutma Odası (3B)). Toplam 50.
  ...expandInstances("PP-095", 50, { name: "Yangın söndürme tüpü", category: "Yangın Söndürme Ekipmanı", location: "", model: "6 KG Kuru Kimyevi Tozlu (ABC)", serial: "", manufacturer: "", power: "", installDate: "", criticality: "Kritik", status: "Aktif", notes: "Teknik mahal içi" }),
  // "Otopark katlarına 50Kg ABC Kuru Tip Ekle" — 5 otopark katı (2B-6B),
  // tekerlekli/büyük kapasiteli tip.
  ...expandInstances("PP-096", 5, { name: "Yangın söndürme tüpü", category: "Yangın Söndürme Ekipmanı", location: "", model: "50 KG Kuru Kimyevi Tozlu (ABC) — Tekerlekli", serial: "", manufacturer: "", power: "", installDate: "", criticality: "Kritik", status: "Aktif", notes: "" }),
  // "Elektrik odalarına ADP Panosu, Kazan Dairesi ve Jeneratör Odası,
  // Trafonun olduğu yere Karbonmonoksit 6K ekle" — CO2 tipi, elektrikli/
  // panolu mahallerde yangın söndürme ekipmanına zarar vermeden kullanılır.
  // 3 mahal (Trafo/OG Pano Odası 3B, Kazan Dairesi 3B, ADP Odası 4B) + 6 adet
  // daha (kullanıcı teyidiyle ile revize: Santral Odası 3B, Atık Su Odası 6B,
  // Asansör Makine Daireleri 5B/6B/ÇATI1×2 — elektrik motoru/pano barındıran
  // mahaller). Toplam 9.
  ...expandInstances("PP-097", 9, { name: "Yangın söndürme tüpü", category: "Yangın Söndürme Ekipmanı", location: "", model: "6 KG Karbondioksit (CO2)", serial: "", manufacturer: "", power: "", installDate: "", criticality: "Kritik", status: "Aktif", notes: "Elektrikli pano/mahal — CO2 tipi" }),
];

// Enerji analizi (Enerji sayfası) için varlık kartlarına yapılandırılmış enerji
// alanları — mevcut serbest metin "power" alanından (kaynak Excel'deki haliyle,
// ör. "750.000 kcal/h", "1.600 kVA", "9.000 m³/h") MEKANİK olarak çıkarılır,
// uydurulmaz. Eşleşen sayı yoksa alan null kalır (ör. çoğu klima santrali/fan
// kaydında kaynakta power boş, bu yüzden airflowM3h de boş kalıyor).
// - kw: elektriksel güç/kapasite (kVA/kW → kW)
// - kcalH: ısıtma/soğutma kapasitesi (kazan, chiller, eşanjör)
// - airflowM3h: taze hava/egzoz debisi (havalandırma ekipmanı)
// dailyHours (günlük çalışma saati) kaynakta yok, uydurulmadı — null bırakıldı;
// gerçek değer bilindiğinde Varlıklar formundan girilebilir, Enerji sayfası o
// zaman kWh/kcal/m³ toplamlarını hesaplar.
function parseTrNumber(s) { return Number(s.replace(/\./g, "").replace(",", ".")); }
function parsePower(power) {
  if (!power) return { kw: null, kcalH: null, airflowM3h: null };
  let m;
  const out = { kw: null, kcalH: null, airflowM3h: null };
  if ((m = power.match(/([\d.,]+)\s*kVA/)) || (m = power.match(/([\d.,]+)\s*kW/))) out.kw = parseTrNumber(m[1]);
  if ((m = power.match(/([\d.,]+)\s*kcal\/h/))) out.kcalH = parseTrNumber(m[1]);
  if ((m = power.match(/([\d.,]+)\s*m³\/h/))) out.airflowM3h = parseTrNumber(m[1]);
  return out;
}
// expiryDate (son kullanma tarihi) — özellikle yangın tüpleri için kritik
// (kullanıcı teyidiyle: "yangın tüplerinde tüplerin son kullanma tarihi
// önemli onuda varlığa ekle"); kaynakta gerçek dolum/kontrol tarihi
// bilinmediği için uydurulmadı, boş bırakıldı — Varlıklar formundan
// doldurulabilir.
export const ASSETS = RAW_ASSETS.map((a) => ({ ...a, ...parsePower(a.power), dailyHours: null, expiryDate: null }));
export const ASSET_CATEGORIES = [...new Set(ASSETS.map((a) => a.category))].sort();

// ---------------------------------------------------------------------------
// Bakım Takvimi — her satır bir ekipman/bakım kalemi, her ay hücresi bağlı bir
// Planlı Bakım görevine işaret eder (marks[ay] = { taskId }). Hücrenin görünen
// durumu (Planlı X / Gerçekleşti ✓) doğrudan bağlı görevin durumuna bakılarak
// hesaplanır — aynı bilgi iki yerde ayrı ayrı tutulmaz (bkz. Bakim.jsx).
// ---------------------------------------------------------------------------
export const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const NOW_D = new Date();
const CUR_YEAR = NOW_D.getFullYear();

let _mtSeq = 0;
const MAINTENANCE_SEED_TASKS = [];
function seedMaintTask(monthIdx, name, firma, assetId, done) {
  _mtSeq += 1;
  const dueDate = new Date(CUR_YEAR, monthIdx + 1, 0).toISOString().slice(0, 10);
  const createdAt = new Date(CUR_YEAR, monthIdx, 1, 9, 0).toISOString();
  const task = {
    id: `mt_${_mtSeq}`, ticketNo: 3200 + _mtSeq, department: "Teknik", issueType: "Planlı Bakım", category: "Planlı Bakım",
    priority: "Orta", description: `${name} — ${MONTHS_TR[monthIdx]} planlı bakımı (${firma})`,
    requester: "Sistem", assignee: "Ahmet Karayat", createdAt, dueDate, assetId: assetId || "",
    status: done ? "Tamamlandı" : "Yapılacak",
    ...(done ? { completedAt: new Date(CUR_YEAR, monthIdx, 25, 14, 0).toISOString(), completedBy: "Ahmet Karayat" } : {}),
  };
  MAINTENANCE_SEED_TASKS.push(task);
  return task.id;
}
function marksFrom(entries) {
  const marks = {};
  entries.forEach(([monthIdx, name, firma, assetId, done]) => {
    marks[MONTHS_TR[monthIdx]] = { taskId: seedMaintTask(monthIdx, name, firma, assetId, done) };
  });
  return marks;
}

// assetIds — o bakım kalemini oluşturan gerçek varlık (ASSETS, PP-xxx)
// kayıtlarının listesi; sadece adet/isim net eşleştiğinde dolduruldu (ör.
// "Ofis ve garaj asansörleri (8 adet)" → 6 asansör kaydı, quantity toplamı
// tam 8). Muayene/danışmanlık gibi tek bir ekipmana indirgenemeyen ya da
// ASSETS'te net karşılığı olmayan kalemler (Road blocker, Su şartlandırma,
// Bina otomasyonu, Trafo işletme sorumlusu vb.) boş bırakıldı — uydurma
// eşleme yapılmadı.
function idRange(prefix, from, to) {
  const out = [];
  for (let i = from; i <= to; i++) out.push(`${prefix}-${String(i).padStart(2, "0")}`);
  return out;
}

// Gerçek bakım/muayene planı — kullanıcının paylaştığı firma bakım tablosundan
// birebir aktarıldı (Ekipman / Firma / PRD). Geçmiş işaretler (marks) periyoda
// göre otomatik üretilir: 1 AY → yılbaşından bugüne kadar her ay (son ay
// bekliyor), 6 AY / 12 AY → periyoda göre round-robin bir "vade ayı" atanır,
// vade ayı geçtiyse tamamlandı, bu ay ise bekliyor, henüz gelmediyse boş.
const CUR_MONTH = NOW_D.getMonth();
let _semiSeq = 0;
let _annualSeq = 0;
function genMarks(name, firma, period, assetId) {
  const rep = assetId || "";
  if (period === "1 AY") {
    const entries = [];
    for (let m = 0; m <= CUR_MONTH; m++) entries.push([m, name, firma, rep, m < CUR_MONTH]);
    return marksFrom(entries);
  }
  if (period === "6 AY") {
    const due = _semiSeq % 6; _semiSeq += 1;
    const entries = [];
    if (due <= CUR_MONTH) entries.push([due, name, firma, rep, due < CUR_MONTH]);
    if (due + 6 <= CUR_MONTH) entries.push([due + 6, name, firma, rep, due + 6 < CUR_MONTH]);
    return marksFrom(entries);
  }
  const due = _annualSeq % 12; _annualSeq += 1;
  return marksFrom(due <= CUR_MONTH ? [[due, name, firma, rep, due < CUR_MONTH]] : []);
}

function mi(id, name, firma, period, assetIds, category) {
  const ids = assetIds || [];
  return { id, name, firma, period, assetId: ids[0] || "", assetIds: ids, marks: genMarks(name, firma, period, ids[0]), category };
}

export const MAINTENANCE_ITEMS = [
  mi("mi1", "Ofis ve garaj asansörleri (8 adet)", "BUGA OTİS ASANSÖR SAN.AŞ.", "1 AY", ["PP-005-01", "PP-005-02", "PP-006", "PP-007-01", "PP-007-02", "PP-008", "PP-009", "PP-010"]),
  mi("mi2", "Cephe asansörleri (2 adet)", "NRY TEMİZLİK VE DIŞ TİC.", "1 AY", ["PP-011", "PP-012"]),
  mi("mi3", "Jeneratörler (4 adet)", "HERTZ JENARATÖR ELEKTR", "1 AY", ["PP-002", "PP-003", "PP-004-01", "PP-004-02"]),
  mi("mi4", "Yangın pompası", "EKA Mekanik", "6 AY", ["PP-016", "PP-017", "PP-018", "PP-019"]),
  mi("mi5", "Yangın algılama ve otomasyonu", "SIEMENS AŞ.", "6 AY", ["PP-062"]),
  mi("mi6", "Kesintisiz güç kaynağı (1 adet)", "İnform", "12 AY", ["PP-054"]),
  mi("mi7", "Bina otomasyon sistemi", "DİNAMİK ELEKTR.VE BİLİŞİM", "12 AY", []),
  mi("mi8", "Trafo bakımı (2 adet)", "Schneider", "12 AY", ["PP-001-01", "PP-001-02"]),
  mi("mi9", "Kazan bakım", "Aykutlu Isı Teknik", "6 AY", idRange("PP-013", 1, 3)),
  mi("mi10", "Brülörler (3 adet)", "Denko", "6 AY", idRange("PP-014", 1, 3)),
  mi("mi11", "Su soğutmalı chiller (3 adet)", "COLL-TECH CEMİL YILMAZ", "1 AY", ["PP-034-01", "PP-034-02", "PP-038"]),
  mi("mi12", "Su şartlandırma ve analizler", "NALCO ANADOLU KİMYA SAN.AŞ.", "1 AY", []),
  mi("mi13", "Arıtma sistemi bakım", "ELİT ARITMA SİSTEMLERİ", "1 AY", ["PP-089"]),
  mi("mi14", "Lejyonella bakterisi tablet", "NALCO ANADOLU KİMYA SAN.AŞ.", "6 AY", []),
  mi("mi15", "Kullanım suyu depo temizliği", "İstaş", "12 AY", []),
  mi("mi16", "Elektrik sayaç otomasyonu", "Aktif", "6 AY", []),
  mi("mi17", "Road blocker", "ARMA KONTROL SİSTEMLERİ", "6 AY", ["PP-086"]),
  mi("mi18", "Tesis topraklama ve Faraday kafesi ölçümleri", "MODA ENERJİ MÜHENDİSLİK HİZ.DIŞ TİC.LTD.ŞTİ.", "12 AY", [], "Yasal"),
  mi("mi19", "Elektrik içi tesisat kontrolü", "MODA ENERJİ MÜHENDİSLİK HİZ.DIŞ TİC.LTD.ŞTİ.", "12 AY", [], "Yasal"),
  mi("mi20", "Jeneratör uygunluk kontrolleri", "MODA ENERJİ MÜHENDİSLİK HİZ.DIŞ TİC.LTD.ŞTİ.", "12 AY", ["PP-002", "PP-003", "PP-004-01", "PP-004-02"], "Yasal"),
  mi("mi21", "Basınçlı kaplar fenni muayene", "MODA ENERJİ MÜHENDİSLİK HİZ.DIŞ TİC.LTD.ŞTİ.", "12 AY", [], "Yasal"),
  mi("mi22", "Şahıs asansörleri fenni muayene (8 adet)", "D KARE GÖZETİM TES.VE.BELG.ŞTİ.", "12 AY", ["PP-005-01", "PP-005-02", "PP-006", "PP-007-01", "PP-007-02", "PP-008", "PP-009", "PP-010"], "Yasal"),
  mi("mi23", "Cephe asansörleri muayenesi (2 adet)", "TMMOB MAKİNA MÜHENDİSLERİ ODASI", "6 AY", ["PP-011", "PP-012"]),
  mi("mi24", "Yangın algılama ve uyarı sistemi muayenesi", "AND ULUSLARARASI DENETİM VE GÖZETİM HİZ.A.Ş.", "12 AY", ["PP-062", "PP-063"], "Yasal"),
  mi("mi25", "Yangın mekanik tesisat kontrol muayenesi", "AND ULUSLARARASI DENETİM VE GÖZETİM HİZ.A.Ş.", "12 AY", ["PP-016", "PP-017", "PP-018", "PP-019"], "Yasal"),
  mi("mi26", "Havalandırma ve klima tesisatı muayenesi", "AND ULUSLARARASI DENETİM VE GÖZETİM HİZ.A.Ş.", "12 AY", [], "Yasal"),
  mi("mi27", "Kazanlar ve ısıtma tesisatları muayenesi", "AND ULUSLARARASI DENETİM VE GÖZETİM HİZ.A.Ş.", "12 AY", idRange("PP-013", 1, 3), "Yasal"),
  mi("mi28", "Hidrofor ve sirkülasyon pompaları", "Aytaç", "12 AY", ["PP-020", "PP-021-01", "PP-021-02"]),
  mi("mi29", "Klima santralleri 44 temiz hava 4x14 egzost fan", "Teknik", "1 AY", []),
  mi("mi30", "Fancoiller", "Teknik", "1 AY", idRange("PP-030", 1, 25)),
  mi("mi31", "Trafo işletme sorumlusu", "Özer Elektrik", "12 AY", []),
  mi("mi32", "Enerji verimliliği danışmanı", "Özer Elektrik", "12 AY", []),
];

export const INSPECTION_TEMPLATES = [
  { id: "insp1", name: "Kat Kontrolü", department: "Teknik", items: ["Aydınlatma çalışıyor mu?", "Acil çıkış işaretleri görünür mü?", "Yangın dolabı dolu mu?"] },
  { id: "insp2", name: "Jeneratör Kontrolü", department: "Teknik", items: ["Yağ seviyesi normal mi?", "Akü şarj durumu uygun mu?", "Otomatik devreye girme testi başarılı mı?"] },
  { id: "insp3", name: "Güvenlik Turu", department: "Güvenlik", items: ["Tüm kapılar kilitli mi?", "CCTV kayıt alıyor mu?", "Acil durum aydınlatması çalışıyor mu?"] },
];

export const INSPECTION_RUNS = [
  { id: "r1", templateId: "insp1", pointName: "22. Kat", department: "Teknik", completedBy: "Ahmet Karayat", completedAt: h(1.5), result: "PASS" },
  { id: "r2", templateId: "insp3", pointName: "Ana Giriş", department: "Güvenlik", completedBy: "Ümit Asak", completedAt: h(2.3), result: "PASS" },
  { id: "r3", templateId: "insp1", pointName: "15. Kat", department: "Temizlik", completedBy: "Fatma Yıldız", completedAt: h(3.6), result: "FAIL" },
  { id: "r4", templateId: "insp2", pointName: "B3 Kazan Dairesi", department: "Teknik", completedBy: "Ahmet Karayat", completedAt: h(4.8), result: "PASS" },
];

// ---------------------------------------------------------------------------
// Mahal Kontrol — her mahal (konum) kendi ekipman açıklaması ve özel Evet/Hayır
// sorularına sahip; her sorunun hangi cevabının "hatalı" sayılacağı (failOn)
// tanımlı, böylece bir kontrol başarısız olduğunda otomatik iş emri açılabilir
// (master prompt madde 40: Kontrol → FAIL → Görev). period alanı otomatik
// hatırlatma/oluşturma sıklığını belirler. Aynı yapı Temizlik ve Güvenlik'te
// de kullanılacak (department alanına göre ayrışıyor).
// ---------------------------------------------------------------------------
export const MAHAL_PERIODS = ["Günlük", "Haftalık", "Aylık", "Yıllık"];

// Teknik mahal kontrolleri — kullanıcının verdiği kesin listeye göre baştan
// kuruldu (kullanıcı teyidiyle: "Teknik Mahal Kontrolü ben sana sıralayım
// ona göre ilerleyelim... teknik ile ilgili bunun dışında olan mahal
// kontrolleri kaldır"). Günlük ve haftalık kontroller role: "Mekanik" (şu an
// aktif Elektrik listesi yok — kullanıcı ayrıca tanımlayana kadar). Aylık tüp/
// hortum ve Exit Armatürü kontrolleri role belirtilmez (genel teknik/yangın
// güvenliği görevi, Tümü sekmesinde görünür). Mobil QR akışı zaten var (bkz.
// MahalKontrol.jsx QrModal).
//
// Sayısal aralık soruları — { text, type: "sayi", unit, min, max } — cevap
// aralık dışına (özellikle yükseğe) çıkarsa MahalKontrol.jsx otomatik arıza
// kaydı açar (bkz. submitFill). Boole sorular eskisi gibi { text, failOn }.
//
// Sayaç okuma — kullanıcı teyidiyle: "Günlük mahal kontrollere sayaç okumada
// ekleyelim ilgili mahal ile sayaç ilişkilendirilsin. Doğalgaz sayacıda
// ekle." Isıtma Odası'nın doğalgaz brülörleri tükettiği için doğalgaz sayacı
// (bkz. GAS_METERS) sadece o mahal ile ilişkilendirildi — binada başka hangi
// mahalde ayrı sayaç olduğu bilinmediğinden uydurulmadı (bkz. WATER_METERS'ın
// da tek "Ana Sayaç" ile başlaması). Kompanzasyon ölçümü (ADP Odası) zaten var
// olan compensationReadings/powerFactor mekanizmasını kullanır (bkz.
// Enerji.jsx) — cosφ hesaplaması burada tekrar edilmiyor.
const TEKNIK_MEKANIK_GUNLUK = [
  {
    id: "mtd1", department: "Teknik", role: "Mekanik", name: "Atık Su Odası", assetId: "PP-023-01", floorLabel: "6B", side: "Beşiktaş",
    assetDesc: "2x garaj rögar atık su dalgıç pompası ve panosu", period: "Günlük",
    questions: [
      { text: "Pompalar otomatik modda çalışıyor mu?", failOn: "Hayır" },
      { text: "Rezervuarda taşma/yüksek seviye alarmı var mı?", failOn: "Evet" },
      { text: "Pompa gövdesi/boru hattında sızıntı var mı?", failOn: "Evet" },
      { text: "Anormal ses/koku var mı?", failOn: "Evet" },
    ],
  },
  {
    id: "mtd2", department: "Teknik", role: "Mekanik", name: "ADP Odası (Jeneratör + Kompanzasyon)", assetId: "PP-092-01", floorLabel: "4B", side: "Beşiktaş",
    assetDesc: "2x Çukurova jeneratör (620 kVA), ADP panoları, kompanzasyon panosu — kompanzasyon ölçümü artık ayrı (bkz. COMPENSATION_PANELS, katın kendi 'Kompanzasyon' hızlı aksiyonu)", period: "Günlük",
    questions: [
      { text: "Jeneratör akü voltajı (V)", type: "sayi", unit: "V", min: 12, max: 14 },
      { text: "Jeneratör yakıt seviyesi yeterli mi (%50 üzeri)?", failOn: "Hayır" },
      { text: "ADP pano arıza/alarm ledi yanıyor mu?", failOn: "Evet" },
    ],
  },
  // Kullanıcı teyidiyle: "kompanzasyon 2 adet var" — ADP Odası'nın Sarıyer
  // tarafındaki eşi, kendi kompanzasyon panosuyla (PP-092-02).
  {
    id: "mtd2b", department: "Teknik", role: "Mekanik", name: "ADP Odası (Kompanzasyon) — Sarıyer", assetId: "PP-092-02", floorLabel: "4B", side: "Sarıyer",
    assetDesc: "ADP Odası'nın Sarıyer tarafı — kompanzasyon panosu (Beşiktaş ADP Odası'nın eşi). Kompanzasyon ölçümü artık ayrı (bkz. COMPENSATION_PANELS, katın kendi 'Kompanzasyon' hızlı aksiyonu).", period: "Günlük",
    questions: [
      { text: "ADP pano arıza/alarm ledi yanıyor mu?", failOn: "Evet" },
    ],
  },
  {
    // Kullanıcı teyidiyle: "önce kazanlar ile ilgili soru 1 2 3 nolu kazan
    // var... bu kazanlara bağlı brülörler var... içlerinden biri arızalı
    // olduğunda ona özel bir veri olabilmeli... ısıtma odası bakımını
    // açtım önce kazanlar ile ilgili sorular geldi sonra brülör sonra kazan
    // panoları sürkülasyon pompaları ve eşanjörler" — TEK ortak soru seti
    // yerine `perFloor:true, groupByFloor:false` (Temizlik'in tek mahal
    // kontrolündeki AYNI desen, bkz. PerFloorCard) + her ekipman için AYRI
    // `location` (kendi `questions` VE `assetId`'siyle) kullanılıyor.
    // Böylece "Kazan 2 arızalı" gerçekten PP-013-02'ye bağlı bir kayıt
    // üretir, oda geneline değil. Kazan panosu sorusu her kazanın kendi
    // grubuna, sirkülasyon pompası sorusu ilgili eşanjörün grubuna
    // eklendi (PP-015'in kendi notu: "...pompalar... panolar dahil" — ayrı
    // bir varlık kaydı olmadığı için uydurma bir id eklenmedi). Yangın
    // pompası/hidrofor (bu odanın Kat Planı equipmentIds'inde YOK, ayrıca
    // hâlâ doğrulanmadı) tek bir "Genel" grubunda, önceki haliyle kaldı.
    id: "mtd3", department: "Teknik", role: "Mekanik", name: "Isıtma Odası (Kazan Dairesi, Yangın Pompası, Hidroforlar)",
    assetId: "PP-013-01", assetIds: ["PP-013-01", "PP-013-02", "PP-013-03", "PP-014-01", "PP-014-02", "PP-014-03", "PP-015-01", "PP-015-02"],
    floorLabel: "3B", side: "Sarıyer", perFloor: true, groupByFloor: false,
    assetDesc: "3x Viessmann Paromat-Simplex kazan + 3x Weishaupt doğalgaz brülör + 2x Alfa Laval eşanjör, alt zone yangın pompası + joker pompa, hidrofor ünitesi", period: "Günlük",
    questions: [],
    locations: [
      { key: "kazan1", label: "Kazan 1", assetId: "PP-013-01", questions: [
        { text: "Kazan 1 çıkış suyu sıcaklığı (°C)", type: "sayi", unit: "°C", min: 60, max: 82 },
        { text: "Kazan 1 panosu arıza/alarm ledi yanıyor mu?", failOn: "Evet" },
      ] },
      { key: "kazan2", label: "Kazan 2", assetId: "PP-013-02", questions: [
        { text: "Kazan 2 çıkış suyu sıcaklığı (°C)", type: "sayi", unit: "°C", min: 60, max: 82 },
        { text: "Kazan 2 panosu arıza/alarm ledi yanıyor mu?", failOn: "Evet" },
      ] },
      { key: "kazan3", label: "Kazan 3", assetId: "PP-013-03", questions: [
        { text: "Kazan 3 çıkış suyu sıcaklığı (°C)", type: "sayi", unit: "°C", min: 60, max: 82 },
        { text: "Kazan 3 panosu arıza/alarm ledi yanıyor mu?", failOn: "Evet" },
      ] },
      { key: "brulor1", label: "Brülör 1 (Kazan 1)", assetId: "PP-014-01", questions: [
        { text: "Brülör 1 alev/ateşleme normal mi?", failOn: "Hayır" },
        { text: "Brülör 1'de doğalgaz kaçağı/kokusu var mı?", failOn: "Evet" },
      ] },
      { key: "brulor2", label: "Brülör 2 (Kazan 2)", assetId: "PP-014-02", questions: [
        { text: "Brülör 2 alev/ateşleme normal mi?", failOn: "Hayır" },
        { text: "Brülör 2'de doğalgaz kaçağı/kokusu var mı?", failOn: "Evet" },
      ] },
      { key: "brulor3", label: "Brülör 3 (Kazan 3)", assetId: "PP-014-03", questions: [
        { text: "Brülör 3 alev/ateşleme normal mi?", failOn: "Hayır" },
        { text: "Brülör 3'te doğalgaz kaçağı/kokusu var mı?", failOn: "Evet" },
      ] },
      { key: "esanjor1", label: "Eşanjör 1 (+ Sirkülasyon Pompası)", assetId: "PP-015-01", questions: [
        { text: "Eşanjör 1'de sızıntı var mı?", failOn: "Evet" },
        { text: "Eşanjör 1 sirkülasyon pompası otomatik çalışıyor mu?", failOn: "Hayır" },
        { text: "Genleşme tankı basıncı normal mi? (Eşanjör 1 hattı)", failOn: "Hayır" },
      ] },
      { key: "esanjor2", label: "Eşanjör 2 (+ Sirkülasyon Pompası)", assetId: "PP-015-02", questions: [
        { text: "Eşanjör 2'de sızıntı var mı?", failOn: "Evet" },
        { text: "Eşanjör 2 sirkülasyon pompası otomatik çalışıyor mu?", failOn: "Hayır" },
        { text: "Genleşme tankı basıncı normal mi? (Eşanjör 2 hattı)", failOn: "Hayır" },
      ] },
      { key: "genel", label: "Genel (Sistem Basıncı, Yangın Pompası, Hidrofor)", questions: [
        { text: "Sistem/kazan dairesi su basıncı (bar)", type: "sayi", unit: "bar", min: 1.5, max: 3 },
        { text: "Yangın pompası otomatik/hazır konumda mı?", failOn: "Hayır" },
        { text: "Hidrofor basınç şalteri normal çalışıyor mu?", failOn: "Hayır" },
      ] },
    ],
  },
  {
    // Kullanıcı teyidiyle: "bu birbirine bağlı tüm ekipmanlar için geçerli
    // olan bir durum olmalı" — mtd3'teki (Isıtma Odası) AYNI ekipman-bazlı
    // grup deseni Chiller odasına da uygulandı (önceki "tek soru seti,
    // hangi chiller olduğu belirsiz" hâli, bkz. bu noktadaki önceki not).
    id: "mtd4", department: "Teknik", role: "Mekanik", name: "Soğutma Odası (Chiller)",
    assetId: "PP-034-01", assetIds: ["PP-034-01", "PP-034-02", "PP-038", "PP-035", "PP-036-01", "PP-036-02"],
    floorLabel: "3B", side: "Sarıyer", perFloor: true, groupByFloor: false,
    assetDesc: "3x York chiller + 3x Alfa Laval eşanjör, sirkülasyon pompaları", period: "Günlük",
    questions: [],
    locations: [
      { key: "chiller1", label: "Chiller 1", assetId: "PP-034-01", questions: [
        { text: "Chiller 1 çıkış suyu sıcaklığı (°C)", type: "sayi", unit: "°C", min: 6, max: 12 },
        { text: "Chiller 1 kompresör basıncı (bar)", type: "sayi", unit: "bar", min: 4, max: 12 },
        { text: "Chiller 1'de anormal titreşim/ses var mı?", failOn: "Evet" },
      ] },
      { key: "chiller2", label: "Chiller 2", assetId: "PP-034-02", questions: [
        { text: "Chiller 2 çıkış suyu sıcaklığı (°C)", type: "sayi", unit: "°C", min: 6, max: 12 },
        { text: "Chiller 2 kompresör basıncı (bar)", type: "sayi", unit: "bar", min: 4, max: 12 },
        { text: "Chiller 2'de anormal titreşim/ses var mı?", failOn: "Evet" },
      ] },
      { key: "chiller3", label: "Chiller 3", assetId: "PP-038", questions: [
        { text: "Chiller 3 çıkış suyu sıcaklığı (°C)", type: "sayi", unit: "°C", min: 6, max: 12 },
        { text: "Chiller 3 kompresör basıncı (bar)", type: "sayi", unit: "bar", min: 4, max: 12 },
        { text: "Chiller 3'te anormal titreşim/ses var mı?", failOn: "Evet" },
      ] },
      { key: "esanjor1", label: "Eşanjör 1 (+ Sirkülasyon Pompası)", assetId: "PP-035", questions: [
        { text: "Eşanjör 1'de sızıntı var mı?", failOn: "Evet" },
        { text: "Eşanjör 1 sirkülasyon pompası otomatik çalışıyor mu?", failOn: "Hayır" },
        { text: "Genleşme tankı basıncı normal mi? (Eşanjör 1 hattı)", failOn: "Hayır" },
      ] },
      { key: "esanjor2", label: "Eşanjör 2 (+ Sirkülasyon Pompası)", assetId: "PP-036-01", questions: [
        { text: "Eşanjör 2'de sızıntı var mı?", failOn: "Evet" },
        { text: "Eşanjör 2 sirkülasyon pompası otomatik çalışıyor mu?", failOn: "Hayır" },
        { text: "Genleşme tankı basıncı normal mi? (Eşanjör 2 hattı)", failOn: "Hayır" },
      ] },
      { key: "esanjor3", label: "Eşanjör 3 (+ Sirkülasyon Pompası)", assetId: "PP-036-02", questions: [
        { text: "Eşanjör 3'te sızıntı var mı?", failOn: "Evet" },
        { text: "Eşanjör 3 sirkülasyon pompası otomatik çalışıyor mu?", failOn: "Hayır" },
        { text: "Genleşme tankı basıncı normal mi? (Eşanjör 3 hattı)", failOn: "Hayır" },
      ] },
    ],
  },
  {
    // Kullanıcı teyidiyle: "hidraforlarda pano var genleşme tankları var" —
    // bu odadaki hidrofor SETİ (mi28 bakım planının da grupladığı) 3 pompa
    // içeriyor, tek pompa değil (bkz. mtd4'teki aynı not, MAINTENANCE_ITEMS
    // deseni). Panosu/genleşme tankı ayrı bir varlık kaydına sahip değil —
    // uydurma bir id eklenmedi.
    id: "mtd5", department: "Teknik", role: "Mekanik", name: "Hidrofor Odası", assetId: "PP-020", assetIds: ["PP-020", "PP-021-01", "PP-021-02"], floorLabel: "5", side: "Beşiktaş",
    assetDesc: "5. Kat Beşiktaş Teknik Mahal içindeki hidrofor seti (3 pompa)", period: "Günlük",
    questions: [
      { text: "Hidrofor basıncı (bar)", type: "sayi", unit: "bar", min: 3, max: 6 },
      { text: "Pompa otomatik devreye giriyor mu?", failOn: "Hayır" },
      { text: "Sızıntı/nem var mı?", failOn: "Evet" },
    ],
  },
  {
    id: "mtd6", department: "Teknik", role: "Mekanik", name: "Çatı Katı (Tüm Teknik Ekipman)", assetId: "PP-016", floorLabel: "ÇATI1",
    assetDesc: "Su depoları, soğutma kuleleri, çatı yangın pompası, klima santralleri, yangın vantilatörü (ÇATI1 + ÇATI2)", period: "Günlük",
    questions: [
      { text: "Su depoları seviyesi normal mi?", failOn: "Hayır" },
      { text: "Soğutma kulesi su sıcaklığı (°C)", type: "sayi", unit: "°C", min: 27, max: 32 },
      { text: "Çatı yangın pompası hazır/otomatik konumda mı?", failOn: "Hayır" },
      { text: "Klima santrali / egzoz fanları normal çalışıyor mu?", failOn: "Hayır" },
      { text: "Yangın vantilatörü arızasız mı?", failOn: "Hayır" },
    ],
  },
];

const JENERATOR_TEST_SORULARI = [
  { text: "Jeneratör otomatik start (ATS) testi başarılı mı?", failOn: "Hayır" },
  { text: "Yükte çalışma sırasında anormal ses/duman var mı?", failOn: "Evet" },
  { text: "Yağ/soğutma suyu seviyesi yeterli mi?", failOn: "Hayır" },
];
const YANGIN_POMPASI_TEST_SORULARI = [
  { text: "Yangın pompası otomatik start testi başarılı mı?", failOn: "Hayır" },
  { text: "Test sırasında basınç düşüşü normal aralıkta mı?", failOn: "Hayır" },
  { text: "Jokey pompa normal çalışıyor mu?", failOn: "Hayır" },
];
// Kullanıcı teyidiyle: "haftalık kontrollerde jeneratör test ve yangın
// pompası testlerde çalışma zorunluluğu koy 10dk teknik olarak kaç dakika
// ise ona göre yap bu süre dolmadan mahal kontrol formunu kapattırma" —
// minRunMinutes: FillModal (bkz. MahalKontrol.jsx) run.startedAt'tan bu
// kadar dakika geçmeden "Kontrolü Tamamla"yı tıklanamaz kılar. 10 dk somut
// bir örnek olarak verildi, gerçek yük altında çalıştırma süresi teknik
// ekibin kendi standardına göre (jeneratör ~10 dk, yangın pompası testi de
// aynı) — burada uydurma bir başka değer kullanılmadı.
const TEKNIK_MEKANIK_HAFTALIK = [
  {
    id: "mtw1", department: "Teknik", role: "Mekanik", name: "Jeneratör Testi — Zemin", assetId: "PP-004-01", floorLabel: "Zemin",
    assetDesc: "2x jeneratör (bahçe, kabinli)", period: "Haftalık", questions: JENERATOR_TEST_SORULARI, minRunMinutes: 10,
  },
  {
    id: "mtw2", department: "Teknik", role: "Mekanik", name: "Jeneratör Testi — 4B", assetId: "PP-002", floorLabel: "4B", side: "Beşiktaş",
    assetDesc: "2x Çukurova jeneratör (620 kVA)", period: "Haftalık", questions: JENERATOR_TEST_SORULARI, minRunMinutes: 10,
  },
  {
    id: "mtw3", department: "Teknik", role: "Mekanik", name: "Yangın Pompası Testi — 3B", assetId: "PP-018", floorLabel: "3B", side: "Sarıyer",
    assetDesc: "Alt zone yangın pompası + joker pompa", period: "Haftalık", questions: YANGIN_POMPASI_TEST_SORULARI, minRunMinutes: 10,
  },
  {
    id: "mtw4", department: "Teknik", role: "Mekanik", name: "Yangın Pompası Testi — Çatı", assetId: "PP-016", floorLabel: "ÇATI1",
    assetDesc: "Üst zone yangın pompası + joker pompa, yangın deposu", period: "Haftalık", questions: YANGIN_POMPASI_TEST_SORULARI, minRunMinutes: 10,
  },
];

// Aylık, kat bazlı — kullanıcı teyidiyle: "Yangın Tüplerinin kontrolleri buda
// kat bazlı olacak kat planında nerde hangi tüp var belli" (blok ayrımı
// yapılmıyor, tek kontrolcü kat plandaki tüm tüp/hortumları tek seferde
// gezer) + "aynı chek liste yangın hortumlarınıda ekle" + "tüp kontrolünde
// ilk bakımda tüp son kullanma tarihi girilsin" — expiryDate zaten Varlıklar
// kaydında var (bkz. Varliklar.jsx "Son Kullanma Tarihi"), burada ayrıca
// tekrarlanmıyor, ilk kontrolde oraya girilmesi istenir.
//
// TEK mahal kontrolü, çok konum — kullanıcı düzeltmesiyle: "aylık yangın
// tüpü ve yangın hortumu yönetilemez olmuş tek mahal kontrolü içinde katları
// seçebilirdi" (28/46 ayrı kart yerine TEK kart, kontrol edilecek kat/blok
// FillModal'da seçilir). point.perFloor + point.locations = [{key,label,
// floorLabel,side?}] — her location kendi periyot/tamamlanma durumunu ayrı
// tutar (bkz. MahalKontrol.jsx runFor'un locationKey parametresi).
const KAT_FLOOR_LABELS = ["PH", "20", "19", "18", "17", "16", "15", "14", "13", "12", "11", "10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "Zemin", "1B"];
const OTOPARK_FLOOR_LABELS = ["2B", "3B", "4B", "5B", "6B"];
const TUP_HORTUM_SORULARI = [
  { text: "Tüp basınç göstergesi yeşil bölgede mi?", failOn: "Hayır" },
  { text: "Tüp gövdesi hasarsız mı (pas, çatlak, ezik yok)?", failOn: "Hayır" },
  { text: "Pin/mühür sağlam mı?", failOn: "Hayır" },
  { text: "Son kullanma tarihi geçmiş mi? (İlk kontrolde tarihi Varlıklar kaydına girin)", failOn: "Evet" },
  { text: "Yangın hortumu ve bağlantıları sağlam, sızıntı yok mu?", failOn: "Hayır" },
];
// Aylık, kat bazlı, her katta 2 (Beşiktaş/Sarıyer) — kullanıcı teyidiyle:
// "aylık kontrolde Exit Armatürleri kontrol etsinler kat bazlı olsun. her kat
// için 2 tane planlayabilirsin." Gerçek envanterde ayrı PP-xxx kaydı yok
// (temsili, Şaft Boşluğu/Yangın Merdiveni gibi yapısal kontrol noktası).
const EXIT_ARMATUR_SORULARI = [
  { text: "Armatür yanıyor mu (aydınlatma çalışıyor)?", failOn: "Hayır" },
  { text: "Acil durum (batarya) modunda çalışıyor mu?", failOn: "Hayır" },
  { text: "Yönlendirme ibaresi/okunabilirlik net mi?", failOn: "Hayır" },
];
const TEKNIK_AYLIK_PERFLOOR = [
  {
    id: "mtm_tup", department: "Teknik", name: "Yangın Tüpü & Hortum Kontrolü", assetId: "",
    assetDesc: "Kat Planı'ndaki GERÇEK yangın söndürme tüpü/hortum mahalleri (yangın dolabı VE mahal içi tüpler) — kontrol edilecek mahali seçin", period: "Aylık",
    perFloor: true, deriveLocations: "fireEquipment",
    questions: TUP_HORTUM_SORULARI,
  },
  {
    id: "mtm_exit", department: "Teknik", name: "Exit Armatürü Kontrolü", assetId: "",
    assetDesc: "LED Exit yönlendirme armatürleri (temsili, envanterde ayrı takip edilmiyor) — kontrol edilecek kat/bloğu seçin", period: "Aylık",
    perFloor: true,
    locations: KAT_FLOOR_LABELS.flatMap((label) => (
      ["Beşiktaş", "Sarıyer"].map((side) => ({ key: `${label}_${side}`, label: `${floorPhrase(label)} — ${side}`, floorLabel: label, side, room: "Exit Armatürü" }))
    )),
    questions: EXIT_ARMATUR_SORULARI,
  },
];

// Güvenlik kat devriyesi — kullaıncı teyidiyle: "katların kapısı açık kapalı
// kontrolünü yapsınlar holleri genel kontrol edecekler". Otopark katlarında
// (2B-6B) ofis/kapı kavramı yok, onun yerine aydınlatma + teknik oda erişim
// kontrolü var. 3B'nin Beşiktaş/Sarıyer tarafları kendi teknik mahalleriyle
// (Trafo/OG Pano Odası — Beşiktaş; Kazan Dairesi/Soğutma Odası — Sarıyer)
// eşleştiği için ayrı, genişletilmiş soru seti alır (kullanıcı teyidiyle:
// "katlardaki mahllaeride kontrol ediyorlar özellikle 3.Bodrum kat").
const KAT_DEVRIYE_SORULARI = [
  { text: "Ofis kapıları kilitli/kapalı mı?", failOn: "Hayır" },
  { text: "Kat holü/ortak alan düzenli ve engelsiz mi?", failOn: "Hayır" },
  { text: "Şüpheli kişi/durum var mı?", failOn: "Evet" },
];
const OTOPARK_DEVRIYE_SORULARI = [
  { text: "Aydınlatma yeterli mi?", failOn: "Hayır" },
  { text: "Teknik oda kapıları kilitli mi?", failOn: "Hayır" },
  { text: "Şüpheli kişi/araç var mı?", failOn: "Evet" },
];
const OTOPARK_3B_BESIKTAS_SORULARI = [
  ...OTOPARK_DEVRIYE_SORULARI,
  { text: "Trafo / OG Pano Odası kapısı kilitli mi?", failOn: "Hayır" },
];
const OTOPARK_3B_SARIYER_SORULARI = [
  ...OTOPARK_DEVRIYE_SORULARI,
  { text: "Kazan Dairesi / Soğutma Odası kapıları kilitli mi?", failOn: "Hayır" },
];
const DEFAULT_GUVENLIK_SHIFTS = [
  { id: "gunduz", label: "Gündüz Vardiyası", start: "14:00", end: "18:00" },
  { id: "gece", label: "Gece Vardiyası", start: "22:00", end: "04:00" },
];
function genGuvenlikTurLocations() {
  const katItems = KAT_FLOOR_LABELS.flatMap((label) => (
    ["Beşiktaş", "Sarıyer"].map((side) => ({ key: `${label}_${side}`, label: `${floorPhrase(label)} — ${side}`, floorLabel: label, side, room: "Devriye", questions: KAT_DEVRIYE_SORULARI }))
  ));
  const otoparkItems = OTOPARK_FLOOR_LABELS.flatMap((label) => (
    ["Beşiktaş", "Sarıyer"].map((side) => ({
      key: `${label}_${side}`, label: `${floorPhrase(label)} — ${side}`, floorLabel: label, side, room: "Devriye",
      questions: label === "3B" ? (side === "Beşiktaş" ? OTOPARK_3B_BESIKTAS_SORULARI : OTOPARK_3B_SARIYER_SORULARI) : OTOPARK_DEVRIYE_SORULARI,
    }))
  ));
  return [...katItems, ...otoparkItems];
}

// Kullanıcı teyidiyle: "Teknikteki mahal kontrol sorularına panolarıda ekle
// ... örnek Chiller 1 Pano kontrolü gibi sorular basit Pano görünümü, koku,
// ses, ısınma, alarm/trip, erişim gibi. Birde tüm panolar için aylık bir
// pano kontrolü yapacağız bu detaylı olacak Detaylı pano kontrolü + termal
// kamera + bağlantı/ısınma değerlendirmesi gibi. bu ortak alandaki panolar
// için geçerli." — iki ayrı periyot, aynı pano listesi: haftalık BASİT
// (görsel/duyusal) + aylık DETAYLI (+ termal kamera + bağlantı/ısınma).
// Floor/side sadece GERÇEKTEN bilinen eşleşmeler için verildi (ör. Jeneratör
// Çıkış Panosu → 4B, aynı mtw2 jeneratörünün yanı) — emin olunmayanlar
// (Ana Dağıtım, Soğutma Kulesi, Kat Elektrik Panoları) floorLabel:null,
// uydurma bir kat atanmadı; admin Ayarlar'dan ileride netleştirebilir.
const PANO_BASIT_SORULARI = [
  { text: "Pano görünümü normal mi (hasar/kir/pas yok)?", failOn: "Hayır" },
  { text: "Anormal koku yok mu?", failOn: "Hayır" },
  { text: "Anormal ses yok mu?", failOn: "Hayır" },
  { text: "Aşırı ısınma yok mu?", failOn: "Hayır" },
  { text: "Alarm/Trip durumu yok mu?", failOn: "Hayır" },
  { text: "Erişim engelsiz mi?", failOn: "Hayır" },
];
const PANO_DETAYLI_SORULARI = [
  ...PANO_BASIT_SORULARI,
  { text: "Termal kamera taramasında anormal bir sıcaklık farkı yok mu?", failOn: "Hayır" },
  { text: "Bağlantı noktaları sıkı, gevşeklik/renk değişimi yok mu?", failOn: "Hayır" },
];
const PANO_LISTESI = [
  { id: "ep01", name: "EP-01 Ana Dağıtım Panosu", floorLabel: null },
  { id: "ep02", name: "EP-02 Jeneratör Çıkış Panosu", floorLabel: "4B", side: "Beşiktaş" },
  { id: "ep03", name: "EP-03 Chiller Panosu", floorLabel: "3B", side: "Sarıyer" },
  { id: "ep04", name: "EP-04 Soğutma Kulesi Panosu", floorLabel: "ÇATI1" },
  { id: "ep05", name: "EP-05 Hidrofor Panosu", floorLabel: "5", side: "Beşiktaş" },
  { id: "ep06", name: "EP-06 Yangın Pompa Panosu", floorLabel: "3B", side: "Sarıyer" },
  { id: "ep07", name: "EP-07 Kat Elektrik Panosu - 1", floorLabel: null },
  { id: "ep08", name: "EP-08 Kat Elektrik Panosu - 2", floorLabel: null },
];
const TEKNIK_PANO_HAFTALIK = PANO_LISTESI.map((p) => ({
  id: `mtp_w_${p.id}`, department: "Teknik", role: "Elektrik", name: p.name, assetId: "", floorLabel: p.floorLabel, side: p.side || null,
  assetDesc: "Ortak alan elektrik panosu — basit görsel/duyusal kontrol", period: "Haftalık", questions: PANO_BASIT_SORULARI,
}));
const TEKNIK_PANO_AYLIK = PANO_LISTESI.map((p) => ({
  id: `mtp_m_${p.id}`, department: "Teknik", role: "Elektrik", name: `${p.name} — Aylık Detaylı Kontrol`, assetId: "", floorLabel: p.floorLabel, side: p.side || null,
  assetDesc: "Detaylı pano kontrolü + termal kamera + bağlantı/ısınma değerlendirmesi", period: "Aylık", questions: PANO_DETAYLI_SORULARI,
}));

export const MAHAL_POINTS = [
  ...TEKNIK_MEKANIK_GUNLUK,
  ...TEKNIK_MEKANIK_HAFTALIK,
  ...TEKNIK_PANO_HAFTALIK,
  ...TEKNIK_PANO_AYLIK,
  ...TEKNIK_AYLIK_PERFLOOR,
  // ---- TEMİZLİK — TEK mahal kontrolü, çok konum — kullanıcı teyidiyle:
  // "Temizliğin Mahal kontrolü tek olacak. ayrı yaptığın mahalleri tek
  // mahale ekle" (eskiden mp5/mp6/mp7/mp22/mp23/mp24/mp25 diye 7 ayrı kart
  // vardı). groupByFloor:false — bu konumlar (Lobi, WC, Otopark, Bahçe,
  // Teraslar) fire-equipment örneğindeki gibi kat başına çoğullanmıyor,
  // zaten her biri kendi başına tek bir mahal, o yüzden düz liste (bkz.
  // PerFloorCard). Her location kendi questions'ını taşır (mahal tipine göre
  // farklı — WC ile teras aynı checklist'i paylaşmaz), point.questions genel
  // fallback. Not: "Otopark ve Ortak Merdivenler" eskiden Haftalık'tı, tek
  // mahalde tüm konumlar aynı periyodu (Günlük) paylaştığı için o da Günlük'e
  // alındı.
  {
    id: "mtd_temizlik", department: "Temizlik", name: "Mahal Kontrol", assetId: "",
    assetDesc: "Kat/alan bazlı temizlik kontrol listesi — kontrol edilecek alanı seçin", period: "Günlük",
    perFloor: true, groupByFloor: false,
    locations: [
      {
        key: "lobi", label: "Lobi / Giriş Katı", floorLabel: "Zemin",
        assetDesc: "Ana giriş, resepsiyon ve zemin kat ortak alanları",
        questions: [
          { text: "Zemin temiz ve kuru mu?", failOn: "Hayır" },
          { text: "Cam ve aynalar temiz mi?", failOn: "Hayır" },
          { text: "Çöp kutuları boşaltıldı mı?", failOn: "Hayır" },
        ],
      },
      {
        key: "ofis_wc", label: "Ofis Katları — WC/Mutfak",
        assetDesc: "Kat ofisleri ıslak hacim ve mutfak alanları (genel, her kat için uygulanır)",
        questions: [
          { text: "Sarf malzeme (sabun, kağıt havlu) dolu mu?", failOn: "Hayır" },
          { text: "Koku/hijyen sorunu var mı?", failOn: "Evet" },
          { text: "Zemin ve armatürler temiz mi?", failOn: "Hayır" },
        ],
      },
      {
        key: "otopark", label: "Otopark ve Ortak Merdivenler", floorLabel: "2B",
        assetDesc: "Kapalı otopark katları (2B-6B) ve acil merdiven kovaları",
        questions: [
          { text: "Zemin ve duvarlar temiz mi?", failOn: "Hayır" },
          { text: "Atık/moloz birikimi var mı?", failOn: "Evet" },
        ],
      },
      {
        key: "yonetim_wc", label: "Yönetim Odası WC (Bay/Bayan)", floorLabel: "1B",
        assetDesc: "Yönetim Odası içindeki WC Bay ve WC Bayan",
        questions: [
          { text: "Sarf malzeme (sabun, kağıt havlu) dolu mu?", failOn: "Hayır" },
          { text: "Koku/hijyen sorunu var mı?", failOn: "Evet" },
          { text: "Zemin ve armatürler temiz mi?", failOn: "Hayır" },
        ],
      },
      {
        key: "bahce", label: "Bahçe (Zemin Ortak Alan)", floorLabel: "Zemin",
        assetDesc: "Zemin kat dış bahçe/otopark giriş alanı",
        questions: [
          { text: "Çevre temiz, yaprak/çöp birikimi yok mu?", failOn: "Hayır" },
          { text: "Peyzaj/bitki alanları düzenli mi?", failOn: "Hayır" },
        ],
      },
      {
        key: "teras20", label: "20. Teras (Ortak Alan)", floorLabel: "20",
        assetDesc: "20. kat teras ortak alanı",
        questions: [
          { text: "Zemin temiz mi?", failOn: "Hayır" },
          { text: "Su birikintisi/tıkalı gider var mı?", failOn: "Evet" },
        ],
      },
      {
        key: "teras5", label: "5. Teras (Ortak Alan)", floorLabel: "5",
        assetDesc: "5. kat teras ortak alanı",
        questions: [
          { text: "Zemin temiz mi?", failOn: "Hayır" },
          { text: "Su birikintisi/tıkalı gider var mı?", failOn: "Evet" },
        ],
      },
    ],
  },
  // ---- GÜVENLİK — tur devriyesi her noktada ----
  {
    id: "mp8", department: "Güvenlik", name: "Ana Giriş / Turnike", assetId: "PP-076", floorLabel: "Zemin",
    assetDesc: "Bina ana giriş turnike ve X-ray/kart okuma sistemi", period: "Günlük",
    questions: [
      { text: "Turnike / erişim kontrol sistemi çalışıyor mu?", failOn: "Hayır" },
      { text: "Kamera sistemi çalışıyor mu?", failOn: "Hayır" },
      { text: "Şüpheli kişi/araç var mı?", failOn: "Evet" },
    ],
  },
  {
    id: "mp9", department: "Güvenlik", name: "Kamera Kontrol Odası", assetId: "PP-056-01", floorLabel: "1B",
    assetDesc: "Merkezi CCTV izleme ve kayıt sistemi", period: "Haftalık",
    questions: [
      { text: "Tüm kameralar canlı görüntü veriyor mu?", failOn: "Hayır" },
      { text: "Kayıt sistemi (NVR/DVR) dolu/arızalı mı?", failOn: "Evet" },
    ],
  },
  {
    id: "mp10", department: "Güvenlik", name: "Acil Çıkış Kapıları", assetId: "",
    assetDesc: "Tüm katlardaki acil çıkış kapı ve merdivenleri", period: "Aylık",
    questions: [
      { text: "Kapılar engelsiz ve açılabilir durumda mı?", failOn: "Hayır" },
      { text: "Acil aydınlatma/yönlendirme çalışıyor mu?", failOn: "Hayır" },
    ],
  },
  {
    id: "mp26", department: "Güvenlik", name: "Yangın Merdiveni (Zemin - 6B)", assetId: "", floorLabel: "Zemin",
    assetDesc: "Beşiktaş ve Sarıyer bloklarındaki teknik odaların yanındaki acil kaçış merdivenleri — Zemin'den 6B otoparka kadar iniyor, kaçış katı Zemin", period: "Haftalık",
    questions: [
      { text: "Merdiven önü engelsiz mi?", failOn: "Hayır" },
      { text: "Acil aydınlatma/yönlendirme levhaları çalışıyor mu?", failOn: "Hayır" },
      { text: "Kaçış kapısı Zemin'de açılabilir durumda mı?", failOn: "Hayır" },
    ],
  },
  // ---- GÜVENLİK — TEK kat devriyesi noktası, çok konum — kullanıcı
  // teyidiyle: "Güvenliğin Tur sistemi kat bazlı olmalı her katta 1qr olacak
  // Beşiktaş Sarıyer olarak kontrol edecekler... katların kapısı açık kapalı
  // kontrolünü yapsınlar holleri genel kontrol edecekler. Güvenlik sadece
  // Çatı katına çıkamıyor onun dışında 20. Katta Teras var orayı kontrol
  // ediyorlar. bununla birlikte katlardaki mahllaeride kontrol ediyorlar
  // özellikle 3.Bodrum kat". Eski mp27/mp28/mp29/mp30/mp31 (parçalı otopark/
  // teknik/ofis turları) buraya birleşti — mp30 (ÇATI1 turu) tamamen
  // kaldırıldı çünkü güvenlik çatı katlarına erişemiyor. Kat bazlı, her katta
  // TEK QR (bkz. PerFloorCard groupByFloor), açılınca Beşiktaş/Sarıyer ayrı
  // ayrı listelenir. mp8/mp9/mp10/mp26 (Ana Giriş, Kamera Odası, Acil Çıkış,
  // Yangın Merdiveni) kendine özgü ekipman/konu olduğu için ayrı kalıyor.
  {
    id: "guv_tur", department: "Güvenlik", name: "Kat Devriyesi (Tur)", assetId: "",
    assetDesc: "Kat bazlı güvenlik turu — Beşiktaş/Sarıyer ayrı ayrı kontrol edilir. Ofis kapıları ve ortak alan/hol genel kontrolü, otopark katlarında teknik oda erişim kontrolü (özellikle 3. Bodrum Kat — Trafo/Kazan Dairesi/Soğutma Odası). Çatı katları (ÇATI1/ÇATI2) güvenlik erişimi dışında; 20. Kat terası kapsam içinde.",
    period: "Günlük",
    perFloor: true, enrichWithFirms: true,
    // Devriye günde birden fazla kez, belirli saat aralıklarında tekrarlanır
    // — kullanıcı teyidiyle: "Güvenlik Devriyesi Hergün Belirli Saatlerde
    // tekrar edecek örnek. gündüz vardiyası 14:00 ile 18:00 da gece vardiyası
    // 22:00 ile 04:00 da gibi devriye saatleri değiştirilebilir." Her vardiya
    // her konum için AYRI bir kontrol kaydı üretir (bkz. MahalKontrol.jsx'teki
    // eksik-run oluşturma effect'i) — admin bu listeyi Düzenle formundan
    // (Vardiyalar bölümü) değiştirebilir, sadece "Günlük" periyotlu noktalarda
    // gösterilir.
    shifts: DEFAULT_GUVENLIK_SHIFTS,
    locations: genGuvenlikTurLocations(),
    questions: KAT_DEVRIYE_SORULARI,
  },
];

export const MAHAL_RUNS = [];

export const PATROLS = [
  { id: "p1", pointName: "Otopark Girişi", completedBy: "Ümit Asak", completedAt: h(0.4), note: "" },
  { id: "p2", pointName: "22. Kat Koridor", completedBy: "Selçuk Ertuğrul", completedAt: h(2.1), note: "" },
  { id: "p3", pointName: "Teras", completedBy: "Ümit Asak", completedAt: h(5.5), note: "" },
];

export const INCIDENTS = [
  { id: "i1", type: "İzinsiz Giriş", location: "9. Kat Ofis Kapısı", description: "Vardiya sırasında ofis kapısının açık olduğu tespit edildi, firma yetkilisine bilgi verildi.", reportedBy: "Ümit Asak", at: h(18) },
];

export const RISKS = [
  { id: "rk1", title: "Jeneratör yakıt tankı korozyon riski", location: "B3 Kazan Dairesi", probability: 3, impact: 4, owner: "Ahmet Karayat", dueDate: d(-10), status: "Açık", action: "Tank iç yüzey kontrolü ve gerekiyorsa kaplama yenileme." },
  { id: "rk2", title: "Çatı su yalıtımında zayıflama", location: "Çatı", probability: 2, impact: 3, owner: "Ahmet Karayat", dueDate: d(20), status: "İnceleniyor", action: "Yağmur mevsimi öncesi yalıtım kontrolü planlandı." },
  { id: "rk3", title: "Otopark aydınlatma yetersizliği", location: "B2 Otopark", probability: 3, impact: 2, owner: "Selçuk Ertuğrul", dueDate: d(15), status: "Açık", action: "Ek aydınlatma armatürü talebi oluşturuldu." },
];

// kWh — son 30 gün, basit sentetik seri (gerçek sayaç entegrasyonu sonra)
export const ENERGY_DAILY = Array.from({ length: 30 }, (_, i) => {
  const base = 1800 + Math.sin(i / 4) * 220;
  const spike = i === 27 ? 650 : 0;
  return { date: d(29 - i), kwh: Math.round(base + spike) };
});
export const ENERGY_SUMMARY = { thisMonth: 54200, lastMonth: 51100, unit: "kWh" };

// Kompanzasyon panosu ölçümü — aktif (kW) ve reaktif (kVAr) güç ölçülür,
// görünür güç (kVA) ve güç faktörü (cosφ) bunlardan HESAPLANIR (bkz.
// Enerji.jsx computePowerFactor) — elle cosφ girilmez, tek kaynak aktif/reaktif.
// pointId — kullanıcı teyidiyle: "kompanzasyon 2 adet var" (Beşiktaş/mtd2 ve
// Sarıyer/mtd2b), okumalar artık hangi panoya ait olduğu belli olacak şekilde
// etiketleniyor. Bu ilk iki kayıt tarihsel/tek panoluyken girilmişti — mevcut
// panoya (mtd2, Beşiktaş) ait olarak devam ediyor.
export const COMPENSATION_READINGS = [
  { id: "cmp1", date: d(30), activeKw: 115, reactiveKvar: 42, note: "Aylık rutin ölçüm", pointId: "mtd2" },
  { id: "cmp2", date: d(1), activeKw: 114, reactiveKvar: 28, note: "Kondansatör bankı bakımı sonrası", pointId: "mtd2" },
];

// Kompanzasyon panoları — kullanıcı teyidiyle: "kompanzasyonlarıda ayrı
// belirt" (Mahal Kontrol'den ayrı, kendi başına bir kayıt). Eskiden
// mahalPoints üzerindeki `compensation:true` bayrağıyla ADP Odası'nın günlük
// checklist'ine gömülüydü (bkz. TEKNIK_MEKANIK_GUNLUK mtd2/mtd2b) — artık
// checklist'ten bağımsız, katına göre kendi kaydı var. id'ler eski
// pointId'lerle (mtd2/mtd2b) AYNI bırakıldı ki yukarıdaki COMPENSATION_READINGS
// geçmişi kopmasın (pointId hâlâ bu id'lere referans veriyor).
export const COMPENSATION_PANELS = [
  { id: "mtd2", name: "ADP Odası (Jeneratör + Kompanzasyon)", floorLabel: "4B", side: "Beşiktaş", assetId: "PP-092-01" },
  { id: "mtd2b", name: "ADP Odası (Kompanzasyon) — Sarıyer", floorLabel: "4B", side: "Sarıyer", assetId: "PP-092-02" },
];

// Su Okuma — binada birden fazla sayaç var (ör. ana giriş, kule, otopark vb.);
// her sayaç ayrı tanımlanır (waterMeters, Ayarlar'daki tanım listeleri gibi
// kullanıcı tarafından genişletilir) ve okumalar meterId ile o sayaca bağlanır.
// Gerçek binada kaç/hangi sayaç olduğu elimizde yok — tek bir "Ana Sayaç" ile
// başlatıldı, diğerleri Enerji > Su Okuma sekmesinden eklenir.
export const WATER_METERS = [
  { id: "wm1", name: "Ana Sayaç", floorLabel: null, side: null },
];
export const WATER_READINGS = [
  { id: "wtr1", meterId: "wm1", date: d(30), meterM3: 18420, note: "Aylık rutin okuma" },
  { id: "wtr2", meterId: "wm1", date: d(1), meterM3: 18705, note: "" },
];

// Doğalgaz Sayacı — kullanıcı teyidiyle: "Doğalgaz sayacıda ekle" — Su
// Okuma ile aynı desen (meters + readings, meterId ile ilişki). Eskiden
// mahalKey ile Isıtma Odası'nın günlük Mahal Kontrol'üne "gömülüydü" —
// kullanıcı teyidiyle: "teknikte mahal kontrollerden sayaçları çıkar katlara
// sayaçları ekle" ile artık checklist'ten bağımsız, doğrudan katına (bkz.
// floorLabel/side) bağlı; okuma mobilde o katın "Sayaç Oku" hızlı aksiyonundan
// girilir (bkz. MahalGridScreen.jsx).
export const GAS_METERS = [
  { id: "gm1", name: "Doğalgaz Ana Sayacı (Kazan Dairesi)", floorLabel: "3B", side: "Sarıyer", room: "Isıtma Odası (Kazan Dairesi, Yangın Pompası, Hidroforlar)", mahalKey: null },
];
export const GAS_READINGS = [];

// Elektrik Sayacı — Su/Doğalgaz Okuma ile AYNI desen (meters + readings,
// meterId ile ilişki, floorLabel/side ile katına bağlanabilir). Kullanıcı
// teyidiyle: "su sayaçlarını su işareti ile elektrikleri elektrik işareti ile
// göster" — bu yüzden su/gaz'dan ayrı bir liste (ikon/tür ayrımı MahalGridScreen
// ve Enerji.jsx'te type="electric" ile yapılır). Gerçek binada kaç/hangi ayrı
// elektrik sayacı olduğu elimizde yok — WATER_METERS'daki gibi tek bir "Ana
// Sayaç" ile başlatıldı, diğerleri Enerji > Elektrik Okuma'dan eklenir.
export const ELECTRIC_METERS = [
  { id: "em1", name: "Ana Elektrik Sayacı", floorLabel: null, side: null, room: null, mahalKey: null },
];
export const ELECTRIC_READINGS = [];

export const DOCUMENTS = [
  { id: "doc1", name: "Chiller Servis Raporu — Ağustos", type: "PDF", linkedTo: "PP-034-01", uploadedAt: d(3) },
  { id: "doc2", name: "Jeneratör Kullanım Kılavuzu", type: "PDF", linkedTo: "PP-002", uploadedAt: d(200) },
  { id: "doc3", name: "Yangın Tatbikatı Tutanağı", type: "PDF", linkedTo: null, uploadedAt: d(40) },
];

export const NOTIFICATIONS = [
  { id: "n1", level: "critical", title: "Chiller arızası (PP-034-01)", body: "Soğutma kapasitesi düştü, acil müdahale gerekli.", at: h(2), read: false },
  { id: "n2", level: "critical", title: "Jeneratör bakım gecikmesi", body: "Planlanan bakım tarihi 5 gün geçti.", at: h(6), read: false },
  { id: "n3", level: "warning", title: "SLA yaklaşıyor", body: "#3103 kaydı SLA süresine 1 saat kaldı.", at: h(1), read: false },
  { id: "n4", level: "info", title: "Kontrol tamamlandı", body: "22. kat kontrolü Ahmet Karayat tarafından tamamlandı.", at: h(1.5), read: true },
];

// Stok modülü — kullanıcı teyidiyle: "bakımlarda kullanılan yedek parçalar,
// planlı bakımlarda ve arıza bakımlarda yedek malzeme kullanılıyor stok
// modülü kur... stok takip sistemi elektrik mekanik inşaat olacak şekilde
// altında kırılımlanacak, örneğin mekanik[te] klima santrali malzemesi,
// elektrik[te] sarf malzeme/aydınlatma/led ampul gibi". TASK_TYPES ile AYNI
// hiyerarşik desen (id/parentId/order/label/isLeaf — bkz. Ayarlar.jsx
// recomputeLeaf), tekrar icat edilmedi. Üç ana dal SABİT kök (Elektrik/
// Mekanik/İnşaat); altındaki kırılım (Klima Santrali, Aydınlatma, Sarf
// Malzeme...) Stok ekranından serbestçe genişletilir. STOCK_ITEMS kendi
// kategoriye categoryId ile bağlı ayrı bir liste — kullanıcı teyidiyle
// "stokları daha sonra ekleriz" BİLEREK boş başlatıldı, sadece yapı hazır.
// STOCK_MOVEMENTS: hangi görevde ne kadar malzeme tüketildiğinin izi (bkz.
// lib/stock.js consumeStockPatch) — ayrı bir "hangi bakımda ne kullanıldı"
// sorgusu icat edilmesin diye tek kaynak.
export const STOCK_CATEGORIES = [
  { id: "stc_elektrik", parentId: null, order: 1, label: "Elektrik", isLeaf: true },
  { id: "stc_mekanik", parentId: null, order: 2, label: "Mekanik", isLeaf: true },
  { id: "stc_insaat", parentId: null, order: 3, label: "İnşaat", isLeaf: true },
];
export const STOCK_ITEMS = [];
export const STOCK_MOVEMENTS = [];

// Duyurular — kullanıcı teyidiyle: "duyuru ve önerilerin web sayfasında
// bağlantısını göremiyorum" — Öneriler (suggestions) gibi bu depoda hiç
// karşılığı yoktu (bkz. navConfig.js eski `kind:"placeholder"`), gerçek bir
// veri modeli/ekran olarak eklendi (bkz. pages/Duyurular.jsx). Yayınlama
// (post/sil) Yönetim/Şef-Sorumlu rolleriyle sınırlı (yukarıdan aşağıya
// duyuru, Öneriler'in aksine — o herkesten yukarı, bu yönetimden aşağı),
// OKUMA herkese açık (Öneriler ile aynı "screenKey izniyle sınırlı değil"
// ilkesi, bkz. App.jsx OPEN_SCREENS). Şekil: { id, title, body, pinned,
// authorName, authorDepartment, createdAt }.
export const ANNOUNCEMENTS = [];

export function makeInitialState() {
  return {
    branding: BRANDING,
    departments: DEPARTMENTS,
    maintenanceFirms: MAINTENANCE_FIRMS,
    users: USERS,
    meterWarningThresholdPct: 10,
    buildingTotalM2: 26036,
    waterInvoices: [],
    gasInvoices: [],
    invoicePayments: [],
    climateRequests: [],
    climateInvoices: [],
    normalOperatingHours: { weekday: 12, saturday: 5 },
    coolingKwhPerHour: 122,
    invoiceSettings: { logoUrl: "", bankName: "", iban: "", signerName: "", signerTitle: "", dueDays: 10 },
    companies: [],
    taskTypes: TASK_TYPES,
    stockCategories: STOCK_CATEGORIES,
    stockItems: STOCK_ITEMS,
    stockMovements: STOCK_MOVEMENTS,
    // Faz 9 — Öneriler modülü (bkz. faz-6-11-prompt.md). Bu depoda hiç
    // karşılığı yoktu, yeni bir alan. Şekil: { id, title, description,
    // category, photoUrl, anonymous, authorName, authorDepartment, status,
    // createdAt, supporters:[isim], comments:[{author,text,at}],
    // statusReason, statusChangedBy, statusChangedAt, convertedTaskId }.
    suggestions: [],
    announcements: ANNOUNCEMENTS,
    // Ana Sayfa'nın (mobil) bölüm sırası/görünürlüğü, departman bazlı —
    // kullanıcı teyidiyle: "sürükle bırak ile ekranı dizayn edebilir miyim"
    // (Ayarlar > Mobil Tasarım). { [departman]: { order: [sectionKey...],
    // hidden: [sectionKey...] } } — bkz. Dashboard.jsx SECTION_DEFS.
    mobileLayout: {},
    piramitFloors: clonePiramitFloors(),
    team: TEAM,
    tasks: [...INITIAL_TASKS, ...MAINTENANCE_SEED_TASKS],
    assets: ASSETS,
    maintenance: MAINTENANCE_ITEMS,
    inspectionTemplates: INSPECTION_TEMPLATES,
    inspectionRuns: INSPECTION_RUNS,
    mahalPoints: MAHAL_POINTS,
    mahalRuns: MAHAL_RUNS,
    mahalTurRuns: [],
    patrols: PATROLS,
    incidents: INCIDENTS,
    risks: RISKS,
    energyDaily: ENERGY_DAILY,
    energySummary: ENERGY_SUMMARY,
    compensationReadings: COMPENSATION_READINGS,
    compensationPanels: COMPENSATION_PANELS,
    waterMeters: WATER_METERS,
    waterReadings: WATER_READINGS,
    gasMeters: GAS_METERS,
    gasReadings: GAS_READINGS,
    electricMeters: ELECTRIC_METERS,
    electricReadings: ELECTRIC_READINGS,
    documents: DOCUMENTS,
    notifications: NOTIFICATIONS,
  };
}

// Firestore'daki GERÇEK, birikmiş veri (personel, görevler, mahal kontrol
// kayıtları, sayaç okumaları...) bu personel/kullanıcı ayrımından ÖNCE
// kaydedilmiş olabilir — eski `team` kaydı hâlâ username/password/webScreens/
// mobileAccess'i kendi üzerinde taşıyor, ayrı bir `users` koleksiyonu hiç
// yok. Bu durumda uygulamayı yeniden tohumlamak (mevcut veriyi silip
// makeInitialState() ile değiştirmek) gerçek veriyi kaybettirir — bunun
// yerine App.jsx, Firestore'dan gelen her state'i bu fonksiyondan geçirir:
// `users` zaten varsa dokunmadan aynen döner, yoksa eski `team` kayıtlarından
// (şifreleri DEĞİŞTİRİLMEMİŞ haliyle) türetir ve `team`'i personel-only hale
// getirir. Böylece var olan hesaplar/şifreler/izinler korunur, sadece şekli
// değişir — kullanıcı hiçbir şeyin sıfırlandığını fark etmez.
export function migrateLegacyState(state) {
  if (!state) return state;
  let next = state;
  if (!Array.isArray(state.users)) {
    const users = (state.team || []).map((t) => ({
      id: `usr_${t.id}`,
      personnelId: t.id,
      username: t.username || t.email,
      mobileAccess: t.mobileAccess !== false,
      permissions: buildPermissions(t.webScreens && t.webScreens.length > 0 ? t.webScreens : defaultWebScreens(t)),
    }));
    const team = (state.team || []).map((t) => {
      const { username, password, webScreens, mobileAccess, ...personnel } = t;
      return personnel;
    });
    next = { ...next, users, team };
  }
  // Daha sonra eklenen alanlar — eski Firestore anlık görüntülerinde bulunmayabilir,
  // eksikse varsayılan değerle tamamlanır (yoksa yeni ekranlar undefined üzerinde patlar).
  if (next.meterWarningThresholdPct == null) next = { ...next, meterWarningThresholdPct: 10 };
  if (next.buildingTotalM2 == null) next = { ...next, buildingTotalM2: 26036 };
  if (!Array.isArray(next.waterInvoices)) next = { ...next, waterInvoices: [] };
  if (!Array.isArray(next.gasInvoices)) next = { ...next, gasInvoices: [] };
  if (!Array.isArray(next.invoicePayments)) next = { ...next, invoicePayments: [] };
  // Ek soğutma/ısıtma talepleri TEK dizide (climateRequests, kind alanıyla
  // ayrılır) — ama İKİ FARKLI hesap yöntemiyle: kullanıcı teyidiyle,
  // "soğutmalar için ne kadar elektrik kullandığımızı ölçemiyoruz, ek
  // soğutma kW değeri üzerinden gidecek" (sabit oran: hours×kWh×pricePerKwh,
  // talep girilirken elle girilen ₺/kWh ile), "ek ısıtma ise... bizim
  // hesapladığımız saat mantığı üzerinden gidecek" (fatura÷toplam saat =
  // birim fiyat, climateInvoices ile — SADECE kind:"heating" için).
  if (!Array.isArray(next.climateRequests)) next = { ...next, climateRequests: [] };
  if (!Array.isArray(next.climateInvoices)) next = { ...next, climateInvoices: [] };
  if (!next.normalOperatingHours) next = { ...next, normalOperatingHours: { weekday: 12, saturday: 5 } };
  if (next.coolingKwhPerHour == null) next = { ...next, coolingKwhPerHour: 122 };
  if (!next.invoiceSettings) next = { ...next, invoiceSettings: { logoUrl: "", bankName: "", iban: "", signerName: "", signerTitle: "", dueDays: 10 } };
  if (!Array.isArray(next.companies)) next = { ...next, companies: [] };
  // Faz 2 — mevcut (bu alan eklenmeden önce kaydedilmiş) Firestore
  // dokümanlarına taksonomiyi geriye dönük ekler; sonraki her açılışta
  // dokunmaz (ör. ileride Ayarlar'dan düzenlenirse üzerine yazmaz).
  if (!Array.isArray(next.taskTypes)) next = { ...next, taskTypes: TASK_TYPES };
  // Kullanıcı teyidiyle: "tür kısım seçenekleri ekrana gelsin elektrik
  // mekanik teknik inşaat temizlik gibi" — İnşaat/Temizlik kökleri
  // TASK_TYPES'a SONRADAN eklendi; yukarıdaki satır sadece dizi TAMAMEN
  // yoksa dolduruyor, var olan (zaten seed'lenmiş) bir Firestore
  // dokümanındaki taskTypes dizisine bu YENİ kökleri eklemiyordu — bu
  // yüzden eksik id'ler tek tek (var olanlara dokunmadan, admin'in
  // Ayarlar'dan yaptığı düzenlemeleri bozmadan) tamamlanıyor.
  if (Array.isArray(next.taskTypes)) {
    const existingIds = new Set(next.taskTypes.map((tt) => tt.id));
    const missing = TASK_TYPES.filter((tt) => !existingIds.has(tt.id));
    if (missing.length > 0) next = { ...next, taskTypes: [...next.taskTypes, ...missing] };
  }
  // Faz 9 — mevcut Firestore dokümanlarına geriye dönük ekler.
  if (!Array.isArray(next.suggestions)) next = { ...next, suggestions: [] };
  // Faz 12 — mahal kontrol "tur" (bir oturumda birden çok mahal gezme)
  // kayıtları. mahalRuns'a (tekil nokta+periyot doldurma) hiç dokunmaz, ayrı
  // bir üst-seviye alan (bkz. src/lib/mahalTur.js).
  if (!Array.isArray(next.mahalTurRuns)) next = { ...next, mahalTurRuns: [] };
  // Faz 15 — kişi bazlı profil alanları (fotoğraf, bildirim tercihleri,
  // varsayılan blok, dil, vardiya durumu, telefon görünürlüğü). Hiçbiri bu
  // depoda yoktu; eksik olan KİŞİYE göre tamamlanır, var olanlara dokunulmaz.
  if ((next.team || []).some((t) => t.photoUrl === undefined || t.notificationPrefs === undefined)) {
    next = {
      ...next,
      team: next.team.map((t) => ({
        photoUrl: null,
        notificationPrefs: { atama: true, yorum: true, mesaj: true, duyuru: true },
        defaultBlock: "",
        language: "tr",
        shiftStatus: "Vardiya dışı",
        phoneVisible: true,
        ...t,
      })),
    };
  }
  // Güvenlik düzeltmesi: `users[].password` daha önce yazılmış GERÇEK
  // Firestore kayıtlarında hâlâ duruyor olabilir (bkz. USERS/yukarıdaki
  // migrasyon artık bu alanı hiç yazmıyor) — bu alan tüm giriş yapmış
  // istemcilere indirilen paylaşılan state dokümanının bir parçası
  // olduğundan (bkz. firebase.js subscribeState), varlığının kendisi bir
  // açık — gerçek giriş zaten Firebase Authentication'dan geçiyor, bu metin
  // hiç okunmuyordu. Burada tek seferlik, kendi kendini onaran bir temizlik:
  // herhangi bir kullanıcıda hâlâ varsa tüm dizi password'süz olarak geri
  // yazılır (App.jsx'teki referans-eşitsizliği kontrolü bunu otomatik
  // Firestore'a persist eder).
  if (Array.isArray(next.users) && next.users.some((u) => "password" in u)) {
    next = { ...next, users: next.users.map((u) => { const { password, ...rest } = u; return rest; }) };
  }
  if (!next.mobileLayout || typeof next.mobileLayout !== "object") next = { ...next, mobileLayout: {} };
  // Kullanıcı teyidiyle: "teknikte mahal kontrollerden sayaçları çıkar
  // katlara sayaçları ekle... kompanzasyonlarıda ayrı belirt" — yeni üst
  // seviye alanlar, önceden kaydedilmiş Firestore dokümanlarında yok.
  if (!Array.isArray(next.electricMeters)) next = { ...next, electricMeters: ELECTRIC_METERS };
  if (!Array.isArray(next.electricReadings)) next = { ...next, electricReadings: ELECTRIC_READINGS };
  if (!Array.isArray(next.compensationPanels)) next = { ...next, compensationPanels: COMPENSATION_PANELS };
  // Kullanıcı teyidiyle: "duyuru... web sayfasında bağlantısını göremiyorum"
  // — önceden hiç karşılığı olmayan yeni bir üst seviye alan.
  if (!Array.isArray(next.announcements)) next = { ...next, announcements: ANNOUNCEMENTS };
  // Kullanıcı teyidiyle: "stok modülü kur" — önceden hiç karşılığı olmayan
  // yeni üst seviye alanlar.
  if (!Array.isArray(next.stockCategories)) next = { ...next, stockCategories: STOCK_CATEGORIES };
  if (!Array.isArray(next.stockItems)) next = { ...next, stockItems: STOCK_ITEMS };
  if (!Array.isArray(next.stockMovements)) next = { ...next, stockMovements: STOCK_MOVEMENTS };
  // "stok" ekranı ALL_SCREENS'e yeni eklendi — var olan hesapların
  // permissions'ı bu ekran hiç yokken oluşturulmuştu, geriye dönük
  // eklenmezse kimse Sidebar'da göremez. Diğer 33 kişilik seed'in ilk
  // açılışta aldığı "tam erişim" varsayımıyla AYNI (bkz. buildPermissions
  // allWrite=true notu) — admin isterse sonra Yetkileri Düzenle'den daraltır.
  if (Array.isArray(next.users) && next.users.some((u) => !u.permissions?.stok)) {
    next = { ...next, users: next.users.map((u) => (u.permissions?.stok ? u : { ...u, permissions: { ...u.permissions, stok: { view: true, read: true, write: true } } })) };
  }
  // Daha önce kaydedilmiş bir doğalgaz sayacı (gm1) hâlâ eski mahalKey
  // ("pt_mtd3") ile Isıtma Odası'nın günlük checklist'ine gömülü olabilir —
  // artık bağımsız/katına bağlı olması gerektiğinden tek seferlik temizlenir.
  if (Array.isArray(next.gasMeters) && next.gasMeters.some((m) => m.mahalKey)) {
    next = { ...next, gasMeters: next.gasMeters.map((m) => (m.mahalKey ? { ...m, mahalKey: null } : m)) };
  }
  // Aynı şekilde ADP Odası noktalarındaki eski `compensation:true` bayrağı —
  // artık kompanzasyon COMPENSATION_PANELS üzerinden, checklist'ten bağımsız.
  if (Array.isArray(next.mahalPoints) && next.mahalPoints.some((p) => p.compensation)) {
    next = { ...next, mahalPoints: next.mahalPoints.map((p) => (p.compensation ? { ...p, compensation: false } : p)) };
  }
  // Güvenlik Devriyesi'nin vardiya (gündüz/gece) saatleri — kullanıcı
  // teyidiyle: "Güvenlik Devriyesi Hergün Belirli Saatlerde tekrar edecek...
  // devriye saatleri değiştirilebilir". Daha önce kaydedilmiş Firestore
  // durumunda guv_tur noktasının `shifts` alanı hiç yok — sadece o alan HİÇ
  // migrate edilmemişse (undefined) varsayılan iki vardiya eklenir; admin
  // sonradan Düzenle formundan hepsini silerse ([]) bir daha geri gelmez.
  if (Array.isArray(next.mahalPoints)) {
    const idx = next.mahalPoints.findIndex((p) => p.id === "guv_tur");
    if (idx !== -1 && next.mahalPoints[idx].shifts === undefined) {
      const points = [...next.mahalPoints];
      points[idx] = { ...points[idx], shifts: DEFAULT_GUVENLIK_SHIFTS };
      next = { ...next, mahalPoints: points };
    }
  }
  // Kullanıcı teyidiyle eklenen "Pano kontrolleri" (EP-01..EP-08, haftalık
  // basit + aylık detaylı) — canlı Firestore'daki mahalPoints seed
  // sabitinden çoktan ayrışmış olduğu için sadece MAHAL_POINTS'i güncellemek
  // mevcut kurulumlara hiçbir şey kazandırmaz; burada eksik olan yeni
  // noktalar id'ye göre (tekrar eklenmesin diye) bir kereye mahsus eklenir.
  if (Array.isArray(next.mahalPoints)) {
    const existingIds = new Set(next.mahalPoints.map((p) => p.id));
    const missingPanoPoints = [...TEKNIK_PANO_HAFTALIK, ...TEKNIK_PANO_AYLIK].filter((p) => !existingIds.has(p.id));
    if (missingPanoPoints.length > 0) {
      next = { ...next, mahalPoints: [...next.mahalPoints, ...missingPanoPoints] };
    }
  }
  // Kullanıcı teyidiyle: "chillerlerde sürkülasyon pompalarıda var...
  // hidraforlarda pano var genleşme tankları var — birbirine bağlı
  // ekipmanları kontrolü atlamak için" — mtd4/mtd5'e eklenen `assetIds`
  // (bkz. bu noktaların tanımı) canlı Firestore'daki ZATEN PERSİST edilmiş
  // eski kayıtlara (assetIds hiç yok) otomatik yansımaz — seed sabiti
  // değiştirmek tek başına hiçbir şey kazandırmaz (Pano kontrolleri'ndeki
  // AYNI sorun/çözüm). Sadece bu iki noktanın `assetIds` alanı eksikse
  // (idempotent — tekrar tekrar üzerine yazmaz) MAHAL_POINTS'teki güncel
  // haliyle senkronlanır.
  if (Array.isArray(next.mahalPoints)) {
    const assetIdsById = new Map(MAHAL_POINTS.filter((p) => p.assetIds).map((p) => [p.id, p.assetIds]));
    if (assetIdsById.size > 0) {
      let changed = false;
      const points = next.mahalPoints.map((p) => {
        const wanted = assetIdsById.get(p.id);
        if (wanted && !p.assetIds) { changed = true; return { ...p, assetIds: wanted }; }
        return p;
      });
      if (changed) next = { ...next, mahalPoints: points };
    }
  }
  // Kullanıcı teyidiyle: "ısıtma odası bakımını açtım... önce kazanlar
  // ile ilgili sorular geldi sonra brülör sonra kazan panoları
  // sirkülasyon pompaları ve eşanjörler bu birbirine bağlı tüm ekipmanlar
  // için geçerli olan bir durum olmalı" — mtd3/mtd4 artık TEK ortak
  // `questions` yerine ekipman-bazlı `locations` kullanıyor (bkz. bu
  // noktaların güncel tanımı). Zaten Firestore'a persist edilmiş ESKİ
  // kayıtlarda henüz `locations` yok — seed sabiti değiştirmek tek başına
  // hiçbir şey kazandırmaz (Pano kontrolleri/assetIds'teki AYNI sorun/
  // çözüm). Persisted kayıtta `locations` yoksa (idempotent) MAHAL_POINTS'
  // teki güncel `perFloor`/`groupByFloor`/`locations`/`assetIds`/
  // `assetDesc` ile senkronlanır — eski düz `questions` alanı (artık []
  // olan) bilerek üzerine yazılır, çünkü yeni yapıda kullanılmıyor.
  if (Array.isArray(next.mahalPoints)) {
    const restructuredIds = new Set(["mtd3", "mtd4"]);
    const freshById = new Map(MAHAL_POINTS.filter((p) => restructuredIds.has(p.id)).map((p) => [p.id, p]));
    if (freshById.size > 0) {
      let changed = false;
      const points = next.mahalPoints.map((p) => {
        const fresh = freshById.get(p.id);
        if (fresh && !p.locations) {
          changed = true;
          return { ...p, perFloor: fresh.perFloor, groupByFloor: fresh.groupByFloor, locations: fresh.locations, assetIds: fresh.assetIds, assetDesc: fresh.assetDesc, questions: fresh.questions };
        }
        return p;
      });
      if (changed) next = { ...next, mahalPoints: points };
    }
  }
  // Güvenlik ağı: newUnitId()'nin modül içi sayacı sayfa yenilendiğinde
  // sıfırlanıyordu (bkz. piramitData.js), bu yüzden "Bölümü Ayır"/"Bölüm
  // Ekle" ile üretilen yeni bir unit id, daha önce aynı reload öncesinde
  // zaten persist edilmiş bir id ile çakışabiliyordu (React "duplicate key"
  // uyarısı — aynı id'ye sahip iki ayrı bölüm kaydı). id üretimi artık
  // çakışmaya karşı korumalı (nextSeq mevcut floors'a göre senkronize
  // ediliyor), ama Firestore'da bu düzeltmeden ÖNCE oluşmuş çakışmalar hâlâ
  // durabilir — burada tek seferlik, idempotent bir onarım yapılır: her
  // tekrar eden id'nin İLK görülen kaydı kendi id'sini korur (equipmentIds/
  // su sayacı/firma bağlantıları kopmasın), sonraki kopyalar yeni id alır.
  // equipmentIds/tenants/owner/area gibi diğer tüm alanlar dokunulmadan
  // kalır (sadece `id` değişir). companies.malikUnitIds/kiraciUnitIds sadece
  // unitId tutar (floorId yok) — hangi kopyaya ait olduğu ayırt edilemez,
  // bu yüzden veri kaybetmemek için yeni id de aynı listeye EKLENİR (eski id
  // çıkarılmaz). waterMeters.unitRef ise {floorId, unitId} tuttuğu için tam
  // olarak hangi kopyaya ait olduğu bellidir — orada eski id yenisiyle
  // DEĞİŞTİRİLİR (çakışma yoksa hiçbir şey değişmez).
  const healed = healDuplicateUnitIds(next.piramitFloors);
  if (healed.changed) {
    let companies = next.companies;
    let waterMeters = Array.isArray(next.waterMeters) ? next.waterMeters : [];
    healed.remaps.forEach(({ floorId, oldId, newId }) => {
      companies = companies.map((c) => {
        const patch = {};
        if ((c.malikUnitIds || []).includes(oldId) && !(c.malikUnitIds || []).includes(newId)) patch.malikUnitIds = [...c.malikUnitIds, newId];
        if ((c.kiraciUnitIds || []).includes(oldId) && !(c.kiraciUnitIds || []).includes(newId)) patch.kiraciUnitIds = [...c.kiraciUnitIds, newId];
        return Object.keys(patch).length > 0 ? { ...c, ...patch } : c;
      });
      waterMeters = waterMeters.map((m) => (m.unitRef && m.unitRef.floorId === floorId && m.unitRef.unitId === oldId ? { ...m, unitRef: { ...m.unitRef, unitId: newId } } : m));
    });
    next = { ...next, piramitFloors: healed.floors, companies, waterMeters };
  }
  // Kullanıcı teyidiyle bulunan/düzeltilen sorun: "daha önceden böldüğüm
  // alanlarıda ayrıca bölüm ayır eklemişsin" — splitUnit (bkz. billing.js)
  // artık her yeni bölünmede isSplitPart:true yazıyor, ama bu alan
  // eklenmeden ÖNCE (yani bu koddan önce) yapılmış gerçek bölünmelerde bu
  // işaret hiç yok. Orijinal piramitData.js seed'inde HİÇ harfli bölüm no'su
  // yok (ör. "14A") — bu yüzden bugün canlı veride harfle biten bir no
  // görülüyorsa (14A/19B/6C gibi) bu kesinlikle geçmişte yapılmış bir
  // bölünmenin sonucu, tek seferlik/idempotent olarak işaretlenir.
  const SPLIT_NO_RE = /^\d+[A-Za-z]$/;
  let splitBackfillChanged = false;
  const splitBackfilledFloors = (next.piramitFloors || []).map((f) => {
    if (!f.units || f.units.length === 0) return f;
    let floorChanged = false;
    const units = f.units.map((u) => {
      if (u.isSplitPart || u.no == null || !SPLIT_NO_RE.test(String(u.no))) return u;
      floorChanged = true;
      return { ...u, isSplitPart: true };
    });
    if (!floorChanged) return f;
    splitBackfillChanged = true;
    return { ...f, units };
  });
  if (splitBackfillChanged) next = { ...next, piramitFloors: splitBackfilledFloors };
  // Kullanıcı teyidiyle: "malikteki espriyi kiracıda da yapman lazımdı, malik
  // ve kiracı bilgisini firma dizininden alması lazım" — malik VE kiracı artık
  // TEK bir kalıcı Firma kartı (state.companies, {malikUnitIds, kiraciUnitIds})
  // üzerinden, bölümden bağımsız bir kimlik olarak tutuluyor. Daha önceki
  // yüklemelerde yazılmış İKİ eski şekil varsa (a) companies içinde bölüm
  // başına ayrı {unitId, role} kaydı, (b) ayrı bir state.maliklar dizisi —
  // ikisi de burada bire bir kaybolmadan (e-posta/GSM/not korunarak) yeni
  // Firma kartlarına taşınır, tek seferlik ve idempotent.
  const legacyUnitCompanies = next.companies.filter((c) => c.unitId !== undefined);
  const legacyMaliklar = Array.isArray(next.maliklar) ? next.maliklar : [];
  if (legacyUnitCompanies.length > 0 || legacyMaliklar.length > 0) {
    let migrated = next.companies.filter((c) => c.unitId === undefined);
    function mergeContact(list, name, patch) {
      const idx = list.findIndex((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (idx === -1) return list;
      return list.map((c, i) => (i === idx ? { ...c, email: c.email || patch.email || "", gsm: c.gsm || patch.gsm || "", note: c.note || patch.note || "" } : c));
    }
    legacyUnitCompanies.forEach((c) => {
      migrated = upsertFirmUnit(migrated, c.name, c.unitId, c.role === "malik" ? "malik" : "kiraci");
      migrated = mergeContact(migrated, c.name, c);
    });
    legacyMaliklar.forEach((m) => {
      (m.unitIds || []).forEach((unitId) => { migrated = upsertFirmUnit(migrated, m.name, unitId, "malik"); });
      migrated = mergeContact(migrated, m.name, m);
    });
    const { maliklar, ...rest } = next;
    next = { ...rest, companies: migrated };
  } else if (Array.isArray(next.maliklar)) {
    const { maliklar, ...rest } = next;
    next = rest;
  }
  const backfilled = backfillFirms(next.piramitFloors, next.companies);
  if (backfilled.length !== next.companies.length) next = { ...next, companies: backfilled };
  // Güvenlik ağı: aynı isimde birden fazla firma kartı ya da adı hiç
  // girilmemiş (tamamen boş isimli) hayalet kayıt varsa (ör. art arda kod
  // değişiklikleri sırasında oluşmuş olabilir) otomatik temizlenir — sadece
  // gerçekten gerekince çalışır, temiz veride her yüklemede gereksiz yazma
  // yapmaz. İsmi olan ama henüz bölüm ataması/iletişim bilgisi olmayan
  // kartlar (Firma Dizini'nden "Yeni Firma" ile az önce açılmış olabilir)
  // BURADA orphan sayılmaz — dedupeFirms artık onları silmiyor.
  const nameSet = new Set(next.companies.map((c) => normalizeFirmKey(c.name)));
  const hasDuplicateNames = nameSet.size !== next.companies.length;
  const hasNamelessGhosts = next.companies.some((c) => !(c.name || "").trim());
  if (hasDuplicateNames || hasNamelessGhosts) next = { ...next, companies: dedupeFirms(next.companies) };
  // Kullanıcı teyidiyle: "sürüm güncellendiğinde android uygulamalara
  // güncelleme yap uyarısı" — bkz. src/version.js'teki not. Web sitesi HER
  // ziyarette Netlify'dan taze kodla açıldığı için kendi APP_VERSION'ı her
  // zaman en günceldir; burada state.appVersion.latest'ten daha yeniyse
  // (sözlük sırasıyla) paylaşılan duruma kendini yazar — telefondaki eski
  // APK'lar bunu canlı senkrondan görüp MobileApp.jsx'teki güncelleme
  // uyarısını gösterir. Sadece web açılışında yazılır (isNativePlatform
  // false), yoksa eski bir APK kendi (eski) sürümünü "en son" diye
  // yazabilir ve uyarı hiç çıkmazdı.
  if (!isNativeApp() && (!next.appVersion || next.appVersion.latest < APP_VERSION)) {
    next = { ...next, appVersion: { latest: APP_VERSION, updatedAt: new Date().toISOString() } };
  }
  return next;
}
