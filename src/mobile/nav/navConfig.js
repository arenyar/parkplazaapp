import {
  Home, Clock, Wrench, ClipboardList, Sparkles, ShieldCheck,
  Megaphone, Lightbulb, CalendarDays, BarChart3,
  Settings2, Users, LogOut,
} from "lucide-react";

// Gerçek `state.tasks` alanları (bkz. src/mockData.js, src/components/TaskForm.jsx)
// — mobil-ui-prompt.md'nin varsaydığı `stpu_records_v2` / durum-öncelik
// enum'ları bu depoda yok; buradaki değerler koddaki GERÇEK enum'lar.
export const OPEN_STATUSES = ["Yapılacak", "Üzr. Çalışılıyor"];
export const URGENT_PRIORITY = "Kritik"; // PRIORITY_STYLES'taki en üst kademe (bkz. theme.js) — spec'in "Acil"i değil

function isOpenTask(t) {
  return !t.archived && OPEN_STATUSES.includes(t.status);
}

// Faz 3 — "Talep yönetimi" screenKey'ini paylaşan üç NavDrawer satırının
// (aynı ekran, farklı kapsam — bkz. mobil-ui-prompt 6.1.1 "Kiracı talepleri
// kararı") kapsam filtresi TEK yerde tanımlı: hem rozet sayımı (aşağıda)
// hem ListScreen'in gösterdiği liste (bkz. MobileApp.jsx) AYNI filtreyi
// kullanır — ikisi arasında sessizce sapma riski olmaz.
export const OPERASYONLAR_SCOPES = {
  operasyonlar: { title: "Talep yönetimi", filter: null },
  gorevler: { title: "Görevler", filter: (t) => t.category === "Planlı Bakım" },
  kiracitalepleri: { title: "Kiracı talepleri", filter: (t) => !!t.company || t.viaMahal },
};

// Bir menü satırının rozetini hesaplar: SADECE bana atanan açık kayıt sayısı
// (mobil-ui-prompt 6.1.1 "Rozet kuralları" — modüldeki toplam kayıt değil).
// extraFilter modüle özel kapsamı daraltır (department, category, kiracı...).
export function countAssignedOpen(tasks, userName, extraFilter) {
  const mine = (tasks || []).filter((t) => isOpenTask(t) && t.assignee === userName && (!extraFilter || extraFilter(t)));
  return { count: mine.length, urgent: mine.some((t) => t.priority === URGENT_PRIORITY) };
}

// Kişisel — sabit sıra, rol/izinle filtrelenmez (herkesin kendi işi).
// Kullanıcı teyidiyle: "Yer imleri, Taslaklar, Vardiya devri, İşletme
// kitabı, Destek" menüden kaldırıldı (kullanılmıyordu). Taslaklar'ın
// ARKASINDAKİ çevrimdışı kuyruk mekanizması (mobile/offline/draftQueue.js,
// MobileApp.jsx safeUpdateState) BİLEREK dokunulmadı — sinyalsiz kaydedilen
// bir işlemin kaybolmaması hâlâ garanti, sadece kuyruğu ayrıca gözden
// geçirmek için ayrı bir menü satırı yok; bağlantı gelince otomatik
// gönderilir (bkz. `online` event listener).
export const KISISEL_ITEMS = [
  { key: "dashboard", label: "Anasayfa", icon: Home, screenKey: "dashboard" },
  { key: "hatirlatmalar", label: "Hatırlatmalar", icon: Clock, kind: "placeholder" },
];

// Araçlar — kullanım sıklığına göre sıralı (bkz. mobil-ui-prompt 6.1.1).
// `screenKey` verilen satırlar `currentAccount.permissions[screenKey]` ile
// gate'lenir (bkz. NavDrawer.jsx) — bu izinler zaten personelin department'ına
// göre seed'leniyor (mockData.js defaultWebScreens), o yüzden ör. Temizlik
// personeli zaten "bakim"/"guvenlik" görmüyor; ayrı bir rol eşlemesi
// UYDURULMADI. Placeholder (screenKey'siz) satırlar henüz backend'i olmayan
// yeni modüller — spec'in rol tablosunda her rolde göründükleri için
// herkese açık. Faturalandırma kasıtlı olarak burada YOK (spec: "modül
// gerçekten çalışana kadar menüde gösterme").
// Kullanıcı teyidiyle: "teknikten sonra temizlik daha sonra bakım takvimi
// alakasız olmuş oluyor" — sıra departman bazlı gruplanıyor: Teknik'e ait
// ikisi (Teknik bakım + Bakım takvimi) YAN YANA, sonra Temizlik, Güvenlik,
// çapraz-departman Kontroller, en sonda Duyurular/Öneriler/Raporlar.
//
// Kullanıcı teyidiyle (devamında): "Talep yönetimi ile Görevler arasında ne
// fark var" → açıklandıktan sonra "tek menü + ekran içi filtre sekmesi yap"
// — Görevler ve Kiracı talepleri (ikisi de aynı "operasyonlar" ekranının
// sadece farklı filtrelenmiş hali, bkz. OPERASYONLAR_SCOPES) artık AYRI
// NavDrawer satırı DEĞİL; TaskListScreen.jsx içinde bir sekme çubuğuna
// taşındı (bkz. o dosyadaki SCOPE_TABS) — filtreleme kaybolmadı, menüden
// ekranın içine indi.
export const ARACLAR_ITEMS = [
  {
    key: "operasyonlar", label: "Talep yönetimi", icon: Wrench, screenKey: "operasyonlar",
    badge: (ctx) => countAssignedOpen(ctx.tasks, ctx.userName, OPERASYONLAR_SCOPES.operasyonlar.filter),
  },
  {
    key: "bakim", label: "Teknik bakım", icon: Wrench, screenKey: "bakim",
    badge: (ctx) => countAssignedOpen(ctx.tasks, ctx.userName, (t) => t.department === "Teknik"),
  },
  // Faz 8 — kendi ekranı var (MaintenanceScreen, takvim+refakat), ama
  // görünürlüğü "Teknik bakım" ile AYNI izne bağlı (screenKey "bakim") —
  // MobileApp.jsx renderScreen bu satırı activeNavKey'e bakarak ayrı render
  // eder, "bakim" screenKey'i sadece izin kontrolü için burada. Teknik
  // bakım'ın HEMEN altında — ikisi de aynı departmanın aracı.
  { key: "bakimtakvimi", label: "Bakım takvimi", icon: CalendarDays, screenKey: "bakim" },
  {
    key: "temizlik", label: "Temizlik", icon: Sparkles, screenKey: "temizlik",
    badge: (ctx) => countAssignedOpen(ctx.tasks, ctx.userName, (t) => t.department === "Temizlik"),
  },
  {
    key: "guvenlik", label: "Güvenlik", icon: ShieldCheck, screenKey: "guvenlik",
    badge: (ctx) => countAssignedOpen(ctx.tasks, ctx.userName, (t) => t.department === "Güvenlik"),
  },
  // Kontroller.jsx: Teknik/Temizlik/Güvenlik'in TÜM Mahal Kontrol
  // noktalarını tek iş akışında toplayan, spec'in Araçlar tablosunda ayrı
  // satır olarak ADI GEÇMEYEN ama gerçek, çapraz-departman bir ekran —
  // üç departmanın da altına gömülmedi çünkü hiçbirine ait değil, üçünü de
  // kapsıyor (izin zaten sadece şef/sorumlu rollere açık, mockData.js
  // LEAD_EXTRA_SCREENS) — departman grupları BİTTİKTEN sonra durur.
  { key: "kontroller", label: "Kontroller", icon: ClipboardList, screenKey: "kontroller" },
  { key: "duyurular", label: "Duyurular", icon: Megaphone, kind: "placeholder" },
  // Faz 9 — gerçek ekran (Personel'le aynı desen: screenKey yok, herkese
  // açık — spec'in rol tablosunda da her rolde geçiyor).
  { key: "oneriler", label: "Öneriler", icon: Lightbulb, kind: "screen" },
  { key: "raporlar", label: "Raporlar", icon: BarChart3, screenKey: "raporlar" },
];

export const DAHAFAZLA_ITEMS = [
  { key: "ayarlar", label: "Ayarlar", icon: Settings2, screenKey: "ayarlar" },
  // Faz 7 — gerçek ekran (Taslaklar'la aynı desen: screenKey'i yok, herkese
  // açık, MobileApp.jsx renderScreen'in "default" dalında activeNavKey'e
  // bakılarak render edilir).
  { key: "personel", label: "Personel", icon: Users, kind: "screen" },
  { key: "cikis", label: "Çıkış yap", icon: LogOut, kind: "logout" },
];

// Bir satır bu hesaba görünür mü? screenKey'i olan satırlar mevcut
// permissions modeliyle (view veya read) gate'lenir — route seviyesinde de
// aynı kontrol zaten App.jsx/MobileApp.jsx'te var, burada SADECE menüden
// gizleme. Placeholder ve çıkış her zaman görünür.
export function isItemVisible(item, permissions) {
  if (!item.screenKey) return true;
  const p = permissions?.[item.screenKey];
  return !!(p?.view || p?.read);
}

// Global bildirim rozeti (TopBar) — tüm departmanlarda bana atanan açık
// kayıt sayısı (bkz. mobil-ui-prompt 6.1.1 TopBar tanımı). Taslak sayısını
// KATMAZ — TopBar zaten Firestore'daki gerçek kayıtları temsil eder, kuyruk
// kendi rozetini (Kişisel > Taslaklar) taşır.
export function computeGlobalBadge(tasks, userName) {
  return countAssignedOpen(tasks, userName);
}
