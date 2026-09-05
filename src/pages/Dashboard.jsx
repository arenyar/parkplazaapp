import { AlertTriangle, Plus, QrCode, Wrench, ClipboardList, ClipboardCheck, FileWarning, Gauge, FileText, Building2, ChevronRight } from "lucide-react";
import { STATUS, PRIORITY_STYLES, deptColor } from "../theme.js";
import { useTheme } from "../lib/ThemeContext.jsx";
import { Card, CardTitle, Button } from "../components/ui.jsx";
import { computeAlerts } from "../lib/alerts.js";
import { buildingStatusList, overallStatus } from "../lib/buildingStatus.js";
import { isOverdue } from "../lib/sla.js";
import { hasNonConformity } from "./MahalKontrol.jsx";
import { openTasksByCategory } from "../mobile/personnel/personStats.js";
import { PersonnelWorkBoard } from "../components/PersonnelWorkBoard.jsx";

const LEVEL_META = {
  normal: { label: "Normal", color: STATUS.normal.color },
  attention: { label: "Dikkat", color: STATUS.attention.color },
  warning: { label: "Uyarı", color: STATUS.warning.color },
  critical: { label: "Kritik", color: STATUS.critical.color },
};

// Ana Sayfa'daki departman kısayolları — kullanıcı teyidiyle: "3 departman
// da kendi ile ilgili görevler mahal kontrolleri görecek... teknikte birde
// sayaç okuması yapacak, güvenlik olay tutanağı ve devriye tur olacak ve
// arıza kaydıda açabilecek, temizlikte mahal kontrol ve arıza işi
// açabilecek". `tab` ilgili departman sayfasındaki (Teknik/Güvenlik/
// Temizlik) hangi sekmeye gidileceğini, `action` varsa orada otomatik
// açılacak formu belirtir (bkz. App.jsx goToDeptShortcut + o sayfaların
// deepLink effect'leri).
// Kullanıcı teyidiyle: "Tüm kısayollardaki görevleri kaldır zaten işlerim
// alanı açtık" — her üç departmanın "Görevler" kısayolu (departman
// sayfasındaki artık kaldırılmış mobil Görevler sekmesine gidiyordu)
// kaldırıldı; Ana Sayfa'daki İşlerim/Havuzda Bekleyen İşler kartları +
// "Görev Başlat" zaten aynı işlevi görüyor.
const DEPT_SHORTCUTS = {
  "Teknik": [
    { key: "mahal", label: "Mahal Kontrol", subtitle: "Mahalleri kontrol et", icon: ClipboardCheck, tab: "mahal" },
    { key: "sayac", label: "Sayaç Okuma", subtitle: "Sayaçları oku", icon: Gauge, tab: "sayacokuma" },
    { key: "ariza", label: "Arıza Kaydı Aç", subtitle: "Arıza bildir ve takip et", icon: AlertTriangle, tab: "mahal", action: "quickRequest" },
  ],
  "Güvenlik": [
    { key: "devriye", label: "Devriye Turu", subtitle: "Devriye turunu yap", icon: ClipboardCheck, tab: "mahal" },
    { key: "olay", label: "Olay Tutanağı", subtitle: "Tutanak oluştur", icon: FileWarning, tab: "devriye", action: "newIncident" },
    { key: "ariza", label: "Arıza Kaydı Aç", subtitle: "Arıza bildir ve takip et", icon: AlertTriangle, tab: "mahal", action: "quickRequest" },
  ],
  "Temizlik": [
    { key: "mahal", label: "Mahal Kontrol", subtitle: "Mahalleri kontrol et", icon: ClipboardCheck, tab: "mahal" },
    { key: "ariza", label: "Arıza Kaydı Aç", subtitle: "Arıza bildir ve takip et", icon: AlertTriangle, tab: "mahal", action: "quickRequest" },
  ],
  // Kullanıcı teyidiyle: "yönetim Ekle departmana bunun ana ekranında tüm
  // departmanların görev durum özeti olacak... sahada olan çalışmaları
  // planlı bakımları olay tutanaklarını anlık görebilecek" — Yönetim'in
  // kendi sekmeli departman sayfası yok, o yüzden kısayolları BAŞKA
  // departmanların gerçek sayfalarına (`department`) ya da genel bir üst
  // seviye ekrana (`view`, bkz. App.jsx onGoTo/goTo) yönlendirir — hepsi
  // zaten var olan, birden fazla yerde kullanılan gerçek ekranlar.
  "Yönetim": [
    { key: "gorevler", label: "Tüm Görevler", subtitle: "Tüm departmanları gör", icon: ClipboardList, view: "operasyonlar" },
    { key: "planli", label: "Planlı Bakımlar", subtitle: "Planlı işleri görüntüle", icon: Wrench, department: "Teknik", tab: "planli" },
    { key: "olay", label: "Olay Tutanakları", subtitle: "Güvenlik tutanaklarını gör", icon: FileWarning, department: "Güvenlik", tab: "devriye" },
    { key: "devriye", label: "Devriye Turları", subtitle: "Devriye kayıtlarını gör", icon: ClipboardCheck, department: "Güvenlik", tab: "mahal" },
  ],
};

// Ana Sayfa'nın (mobil) bölümleri — kullanıcı teyidiyle: "sürükle bırak ile
// ekranı dizayn edebilir miyim... tüm Ana Sayfa düzeni". Teknik/Güvenlik/
// Temizlik (yani DEPT_SHORTCUTS'ta karşılığı olan roller) için bu sıra/
// görünürlük state.mobileLayout[role]'den (bkz. Ayarlar > Mobil Tasarım,
// MobilTasarim.jsx'teki sürükle-bırak listesi) okunur; Yönetim/admin masaüstü
// görünümü buna dokunmadan mevcut sabit grid-3/grid-2 düzeninde kalır (bu
// özellik özellikle saha personelinin telefon Ana Sayfa'sını tasarlamak
// için — kullanıcı teyidiyle "ana sayfa mobil uygulama tasarlanıyor").
// Kullanıcı teyidiyle referans görsel ("Temizlik Operasyon" ekranı — başlık
// + 3 istatistik rozeti + ilerleme yüzdesi + 2 sütunlu zengin kısayol
// kartları + mahal durum listesi) örnek alınarak eklendi: "ozet" (başlık/
// istatistik/ilerleme) ve "mahallerDurum" (konum bazlı durum listesi) yeni
// bölümler. "ozet" eskiden ayrı olan binaDurumu+bugun'un departman-özel,
// daha kompakt hali olduğu için bunlar varsayılanda GİZLİ başlıyor (ama
// sürükle-bırak listesinde hâlâ var, göz ikonuyla geri açılabilir).
// "gorevler" (Departman Görevleri — Ana Sayfa'daki tam görev kartı listesi)
// mobil düzenden ÇIKARILDI — kullanıcı teyidiyle: "bunu mobilden kaldır
// artık görevler butonunu düzenledik bunun gözükmesine gerek yok" (Görevler
// kısayolu — bkz. DEPT_SHORTCUTS — zaten aynı listeye kendi ekranından
// erişim sağlıyor, Ana Sayfa'da tekrar göstermeye gerek yok). sectionNodes
// içindeki `gorevler` düğümü BİLEREK silinmedi — aşağıdaki masaüstü/rol-dışı
// sabit grid (DEPT_SHORTCUTS'ta karşılığı olmayan roller) hâlâ kullanıyor.
// Kullanıcı teyidiyle: "Durum Ekranında bölümler olsun: 1 İşlerim 2 Havuzda
// Bekleyen işler 3 Mahal Kontrol" — 3.'sü zaten var olan "mahallerDurum"
// bölümüyle karşılanıyor (aynı içerik, yeniden yazılmadı); yeni olan ikisi
// "islerim" (bana atanmış açık işler) ve "havuzdaBekleyen" (departmanda
// kimseye atanmamış, havuzda bekleyen açık işler) — ikisi de
// personStats.js'teki openTasksByCategory ile AYNI kaynaktan (PersonCard.jsx
// "Açık işler" sekmesiyle birebir aynı kategorizasyon, iki ayrı hesaplama
// yok). "ana ekranda tüm bölümler gizli filtre olsun" — üçü de diğerleri
// gibi Mobil Tasarım > Ana Sayfa Düzeni'nden aç/kapa + sürüklenebilir.
// Kullanıcı teyidiyle: "Mobil Yönetici anasayfasında personellerin listesi
// gelsin departman bazlı olacak akordion" — "personel" bölümü SADECE
// Yönetim/departman liderleri için anlamlı olduğundan (bkz.
// PersonnelAccordion.jsx kendi rol kontrolü) her rolün varsayılan
// sırasında/gizli listesinde DEĞİL — onOpenPerson prop'u verildiğinde
// (mobil) sectionNodes.personel zaten null dönebiliyor, gereksiz boş kart
// basılmasın diye visible filtresi ayrıca `sectionNodes[k]` doluluğuna
// bakıyor (bkz. aşağıdaki `order.filter`).
export const DEFAULT_SECTION_ORDER = ["ozet", "kisayollar", "personel", "islerim", "havuzdaBekleyen", "mahallerDurum", "dikkat", "canliAkis", "binaGenel", "oncelikler", "hizliIslemler", "binaDurumu", "bugun"];
export const DEFAULT_HIDDEN_SECTIONS = ["binaDurumu", "bugun"];
export const SECTION_LABELS = {
  ozet: "Özet (Başlık + İstatistik + İlerleme)",
  binaDurumu: "Bina Durumu",
  bugun: "Bugün",
  dikkat: "Dikkat Edilmesi Gerekenler",
  kisayollar: "Departman Kısayolları",
  personel: "Personel (Departman Bazlı)",
  islerim: "İşlerim",
  havuzdaBekleyen: "Havuzda Bekleyen İşler",
  mahallerDurum: "Mahallere Göre Durum (Mahal Kontrol)",
  canliAkis: "Canlı Operasyon Akışı",
  binaGenel: "Bina Genel Görünümü",
  oncelikler: "Bugünün Öncelikleri",
  hizliIslemler: "Hızlı İşlemler",
};

// Kullanıcı teyidiyle paylaşılan referans görseldeki 2 sütunlu, ikon+başlık+
// alt yazı+ok şeklindeki zengin kısayol kartları — mor tema yerine (kullanıcı
// teyidiyle) departmanın kendi rengi (deptColor) kullanılıyor.
function DeptShortcuts({ role, onShortcut, onGoTo }) {
  const T = useTheme();
  const items = DEPT_SHORTCUTS[role];
  if (!items) return null;
  const accent = deptColor(role);
  function handleClick(s) {
    if (s.view) onGoTo(s.view);
    else onShortcut(s.department || role, s.tab, s.action);
  }
  return (
    <Card>
      <CardTitle>{role} Kısayolları</CardTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10 }}>
        {items.map((s) => (
          <button key={s.key} onClick={() => handleClick(s)}
            style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px", background: T.surface2 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}26`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <s.icon size={18} color={accent} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{s.label}</div>
              <div style={{ fontSize: 10.5, color: T.dim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.subtitle}</div>
            </div>
            <ChevronRight size={15} color={T.dimmer} style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </Card>
  );
}

function StatChip({ icon: Icon, color, value, label }) {
  const T = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 6px", borderRadius: 10, background: T.surface2 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}26`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={15} color={color} strokeWidth={2} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 9, color: T.dim, textAlign: "center", lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}

// Bir mahal kontrol noktasının GERÇEK durumu — uydurma bir "canlı" veri
// değil: hasNonConformity (MahalKontrol.jsx, zaten Kontroller ekranında da
// kullanılıyor) uygunsuzluk varsa "Arıza", yoksa en son Tamamlandı run'a
// (state.mahalRuns) bakılır, hiç yoksa "Bekliyor".
function mahalPointStatus(point, state) {
  if (hasNonConformity(point, state)) return { label: "Arıza", color: STATUS.critical.color, bg: STATUS.critical.bg };
  const runs = (state.mahalRuns || []).filter((r) => r.pointId === point.id && r.status === "Tamamlandı" && r.completedAt);
  if (runs.length > 0) {
    const latest = runs.reduce((a, b) => (new Date(b.completedAt) > new Date(a.completedAt) ? b : a));
    return { label: "Tamamlandı", color: STATUS.normal.color, bg: STATUS.normal.bg, at: latest.completedAt };
  }
  return { label: "Bekliyor", color: STATUS.attention.color, bg: STATUS.attention.bg };
}

function StatusDot({ level }) {
  const m = LEVEL_META[level] || LEVEL_META.normal;
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.color, display: "inline-block" }} />;
}

export function Dashboard({ state, role, currentUser, onGoTo, onNewTask, onScan, onOpenAlert, onShortcut = () => {}, onOpenPerson, onOpenTicket }) {
  const T = useTheme();
  const scopedTasks = (!role || role === "Yönetim" ? state.tasks : state.tasks.filter((t) => t.department === role)).filter((t) => !t.archived);
  const openTasks = scopedTasks.filter((t) => t.status !== "Tamamlandı" && t.status !== "İptal");
  const critical = openTasks.filter((t) => t.priority === "Kritik");
  const overdue = openTasks.filter(isOverdue);
  const todaysInspections = state.inspectionRuns.length + state.patrols.length;

  const alerts = computeAlerts(state);
  const statusList = buildingStatusList(state);
  const overall = overallStatus(statusList);

  const liveFeed = [
    ...state.tasks.filter((t) => !t.archived && (t.status === "Üzr. Çalışılıyor" || t.priority === "Kritik")).map((t) => ({ at: t.createdAt, dept: t.department, text: `${t.description}` })),
    ...state.inspectionRuns.map((r) => ({ at: r.completedAt, dept: r.department, text: `${r.pointName} kontrolü ${r.result === "PASS" ? "tamamlandı" : "başarısız oldu"}` })),
    ...state.patrols.map((p) => ({ at: p.completedAt, dept: "Güvenlik", text: `${p.pointName} devriye kontrolü tamamlandı` })),
  ].filter((x) => x.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 7);

  const totalPoints = state.inspectionTemplates.length + 8; // varlık + kontrol noktası kabaca

  // "ozet" ve "mahallerDurum" bölümleri için — kullanıcı teyidiyle paylaşılan
  // referans görsele göre eklendi, uydurma veri değil: mahal noktası sayısı
  // ve "bekleyen arıza" (viaMahal saha kaydı ya da Arıza Bakım kategorisi)
  // gerçek state'ten, "bugünkü ilerleme" ise createdAt'i bugün olan görevler
  // üzerinden hesaplanıyor (görev "bugün için planlanan" alanı yok, en yakın
  // gerçek karşılık bu).
  const deptMahalPoints = (!role || role === "Yönetim" ? state.mahalPoints : state.mahalPoints.filter((p) => p.department === role)).filter((p) => !p.archived);
  // "İşlerim" / "Havuzda Bekleyen İşler" bölümleri — PersonCard.jsx'teki
  // "Açık işler" sekmesiyle AYNI kategorizasyon (bkz. personStats.js
  // openTasksByCategory), currentUser yoksa (ör. Yönetim'in kendi hesabı
  // bir personel kaydına bağlı olmayabilir) boş kategori döner, bölüm o
  // durumda "kayıt yok" gösterir, hata vermez.
  const taskCategories = currentUser ? openTasksByCategory(state.tasks, currentUser) : { assigned: [], teamOthers: [], pool: [] };
  const pendingArizaCount = openTasks.filter((t) => t.viaMahal || t.category === "Arıza Bakım").length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTasks = scopedTasks.filter((t) => (t.createdAt || "").slice(0, 10) === todayStr);
  const todayDone = todayTasks.filter((t) => t.status === "Tamamlandı");
  const todayPct = todayTasks.length > 0 ? Math.round((todayDone.length / todayTasks.length) * 100) : null;
  // Güvenlik'te 3. rozet arıza yerine olay kaydı — state.incidents'te bir
  // "çözüldü/açık" alanı yok (sadece tutanak günlüğü), o yüzden "açık olay"
  // diye uydurma bir sayı göstermiyoruz; dürüstçe "kayıt sayısı" olarak
  // etiketleniyor.
  const incidentLogCount = state.incidents.length;

  const sectionNodes = {
    binaDurumu: (
      <Card key="binaDurumu">
        <CardTitle num="01">Bina Durumu</CardTitle>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 78, height: 78, borderRadius: "50%", border: `5px solid ${LEVEL_META[overall].color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: LEVEL_META[overall].color, textTransform: "uppercase" }}>{LEVEL_META[overall].label}</span>
          </div>
          <div style={{ flex: 1 }}>
            {statusList.map((d) => (
              <div key={d.dept} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0", fontSize: 12.5 }}>
                <span style={{ color: T.dim }}>{d.dept}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, color: LEVEL_META[d.level].color, fontWeight: 600 }}>
                  <StatusDot level={d.level} />{LEVEL_META[d.level].label}{d.note ? ` (${d.note})` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    ),
    bugun: (
      <Card key="bugun">
        <CardTitle num="02">Bugün</CardTitle>
        {[["Açık Görevler", openTasks.length], ["Kritik İşler", critical.length], ["Geciken", overdue.length], ["Bugünkü Saha Kontrolleri", todaysInspections]].map(([label, val]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.line}`, fontSize: 13 }}>
            <span style={{ color: T.dim }}>{label}</span>
            <span style={{ fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{val}</span>
          </div>
        ))}
      </Card>
    ),
    dikkat: (
      <Card key="dikkat">
        <CardTitle num="03">Dikkat Edilmesi Gerekenler</CardTitle>
        {alerts.length === 0 && <p style={{ color: T.dim, fontSize: 13 }}>Şu anda öne çıkan bir durum yok.</p>}
        {alerts.slice(0, 4).map((a, i) => (
          <button key={i} onClick={() => onOpenAlert(a)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
            <AlertTriangle size={13} color={LEVEL_META[a.severity].color} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12.5, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: LEVEL_META[a.severity].color, textTransform: "uppercase", flexShrink: 0 }}>{LEVEL_META[a.severity].label}</span>
          </button>
        ))}
      </Card>
    ),
    // Kullanıcı teyidiyle paylaşılan referans görsel ("Temizlik Operasyon" —
    // başlık, 3 istatistik rozeti, ilerleme çubuğu+yüzde halkası) örnek
    // alınarak — departman rolü için binaDurumu+bugun'un daha kompakt,
    // departman-özel hali.
    ozet: DEPT_SHORTCUTS[role] ? (
      <Card key="ozet" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 4px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{role} Operasyon</div>
          <div style={{ fontSize: 11.5, color: T.dim, marginTop: 2 }}>Günün özeti</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, padding: "14px 18px" }}>
          <StatChip icon={ClipboardList} color={deptColor(role)} value={openTasks.length} label="Açık Görev" />
          <StatChip icon={ClipboardCheck} color={deptColor(role)} value={deptMahalPoints.length} label={role === "Güvenlik" ? "Devriye Noktası" : "Mahal"} />
          {role === "Güvenlik"
            ? <StatChip icon={FileWarning} color={STATUS.warning.color} value={incidentLogCount} label="Olay Kaydı" />
            : <StatChip icon={AlertTriangle} color={STATUS.critical.color} value={pendingArizaCount} label="Bekleyen Arıza" />}
        </div>
        {todayPct != null ? (
          <div style={{ padding: "0 18px 18px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: T.dim, marginBottom: 6 }}>{todayDone.length}/{todayTasks.length} bugünkü görev tamamlandı</div>
              <div style={{ height: 6, borderRadius: 999, background: T.surface3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${todayPct}%`, background: deptColor(role), borderRadius: 999 }} />
              </div>
            </div>
            <div style={{ width: 50, height: 50, borderRadius: "50%", border: `4px solid ${deptColor(role)}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{todayPct}%</span>
            </div>
          </div>
        ) : (
          <p style={{ padding: "0 18px 16px", margin: 0, fontSize: 11.5, color: T.dimmer }}>Bugün için henüz görev oluşturulmadı.</p>
        )}
      </Card>
    ) : null,
    kisayollar: DEPT_SHORTCUTS[role] ? <DeptShortcuts key="kisayollar" role={role} onShortcut={onShortcut} onGoTo={onGoTo} /> : null,
    personel: <PersonnelWorkBoard key="personel" state={state} role={role} currentUser={currentUser} onOpenPerson={onOpenPerson} onOpenTicket={onOpenTicket} />,
    // Kullanıcı teyidiyle: "Durum Ekranında bölümler olsun: 1 İşlerim 2
    // Havuzda Bekleyen işler" — PersonCard.jsx "Açık işler" sekmesindeki AYNI
    // iki kategori (assigned/pool), burada Ana Sayfa'nın kendi bölümü olarak.
    islerim: DEPT_SHORTCUTS[role] ? (
      <Card key="islerim">
        <CardTitle right={<Button variant="ghost" icon={Plus} onClick={() => onNewTask({ department: role })}>Görev Başlat</Button>}>İşlerim</CardTitle>
        {taskCategories.assigned.length === 0 && <p style={{ color: T.dim, fontSize: 13 }}>Size atanmış açık iş yok.</p>}
        {taskCategories.assigned.slice(0, 8).map((t) => {
          const ps = PRIORITY_STYLES[t.priority] || {};
          return (
            <button key={t.id} onClick={() => onOpenAlert({ goTo: "operasyonlar", ref: t })}
              style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 0", borderBottom: `1px solid ${T.line}`, boxSizing: "border-box" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>#{t.ticketNo} · {t.description}</div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 1 }}>{t.department}{t.status ? ` · ${t.status}` : ""}</div>
              </span>
              <span style={{ background: ps.bg, color: ps.fg, fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: "2px 8px", textTransform: "uppercase", flexShrink: 0 }}>{t.priority}</span>
            </button>
          );
        })}
        {taskCategories.assigned.length > 8 && <p style={{ fontSize: 11.5, color: T.dimmer, margin: "8px 0 0" }}>+{taskCategories.assigned.length - 8} tane daha.</p>}
      </Card>
    ) : null,
    havuzdaBekleyen: DEPT_SHORTCUTS[role] ? (
      <Card key="havuzdaBekleyen">
        <CardTitle>Havuzda Bekleyen İşler</CardTitle>
        {taskCategories.pool.length === 0 && <p style={{ color: T.dim, fontSize: 13 }}>Havuzda bekleyen iş yok.</p>}
        {taskCategories.pool.slice(0, 8).map((t) => {
          const ps = PRIORITY_STYLES[t.priority] || {};
          return (
            <button key={t.id} onClick={() => onOpenAlert({ goTo: "operasyonlar", ref: t })}
              style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 0", borderBottom: `1px solid ${T.line}`, boxSizing: "border-box" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>#{t.ticketNo} · {t.description}</div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 1 }}>{t.department}{t.status ? ` · ${t.status}` : ""}</div>
              </span>
              <span style={{ background: ps.bg, color: ps.fg, fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: "2px 8px", textTransform: "uppercase", flexShrink: 0 }}>{t.priority}</span>
            </button>
          );
        })}
        {taskCategories.pool.length > 8 && <p style={{ fontSize: 11.5, color: T.dimmer, margin: "8px 0 0" }}>+{taskCategories.pool.length - 8} tane daha.</p>}
      </Card>
    ) : null,
    // Referans görseldeki "Mahallere göre durum" listesi — gerçek mahal
    // kontrol noktaları + gerçek durumları (bkz. mahalPointStatus).
    mahallerDurum: DEPT_SHORTCUTS[role] && deptMahalPoints.length > 0 ? (
      <Card key="mahallerDurum">
        <CardTitle right={<button onClick={() => (role === "Yönetim" ? onGoTo("kontroller") : onShortcut(role, "mahal"))} style={{ background: "none", border: "none", color: T.accent, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Tümünü gör</button>}>
          Mahallere Göre Durum
        </CardTitle>
        {deptMahalPoints.slice(0, 6).map((p) => {
          const st = mahalPointStatus(p, state);
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.line}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: T.dim, marginTop: 1 }}>
                  {p.floorLabel ? `Kat ${p.floorLabel}` : "Tüm katlar"}
                  {st.at ? ` · Son kontrol ${new Date(st.at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 999, padding: "3px 9px", textTransform: "uppercase", flexShrink: 0 }}>{st.label}</span>
            </div>
          );
        })}
        {deptMahalPoints.length > 6 && <p style={{ fontSize: 11, color: T.dimmer, margin: "8px 0 0" }}>+{deptMahalPoints.length - 6} nokta daha.</p>}
      </Card>
    ) : null,
    // Departman bazlı görevler — kullanıcı teyidiyle: "Mobil Uygulamada, Ana
    // ekranda departman bazlı görevler gösterim olacak. Onun dışında görev
    // başlatma olacak." Giriş yapan kişinin departmanının TÜM açık
    // (Yapılacak/Üzr. Çalışılıyor) görevleri (openTasks zaten role'e göre
    // filtreli, üstteki "Açık Görevler" sayısıyla aynı kaynak).
    gorevler: (
      <Card key="gorevler">
        <CardTitle right={<Button variant="ghost" icon={Plus} onClick={() => onNewTask({ department: role })}>Görev Başlat</Button>}>
          {role ? `${role} Görevleri` : "Görevlerim"}
        </CardTitle>
        {openTasks.length === 0 && <p style={{ color: T.dim, fontSize: 13 }}>Açık görev yok.</p>}
        {openTasks.slice(0, 8).map((t) => {
          const ps = PRIORITY_STYLES[t.priority] || {};
          return (
            <button key={t.id} onClick={() => onOpenAlert({ goTo: "operasyonlar", ref: t })}
              style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 0", borderBottom: `1px solid ${T.line}`, boxSizing: "border-box" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>#{t.ticketNo} · {t.description}</div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 1 }}>{t.department}{t.status ? ` · ${t.status}` : ""}</div>
              </span>
              <span style={{ background: ps.bg, color: ps.fg, fontSize: 9.5, fontWeight: 700, borderRadius: 999, padding: "2px 8px", textTransform: "uppercase", flexShrink: 0 }}>{t.priority}</span>
            </button>
          );
        })}
        {openTasks.length > 8 && <p style={{ fontSize: 11.5, color: T.dimmer, margin: "8px 0 0" }}>+{openTasks.length - 8} tane daha — Operasyonlar'dan tümünü görün.</p>}
      </Card>
    ),
    canliAkis: (
      <Card key="canliAkis">
        <CardTitle num="04">Canlı Operasyon Akışı</CardTitle>
        {liveFeed.length === 0 && <p style={{ color: T.dim, fontSize: 13 }}>Henüz kayıt yok.</p>}
        {liveFeed.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 11.5, color: T.dim, width: 44, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{new Date(r.at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, textTransform: "uppercase" }}>{r.dept}</div>
              <div style={{ fontSize: 13, color: T.ink }}>{r.text}</div>
            </div>
          </div>
        ))}
      </Card>
    ),
    binaGenel: (
      <Card key="binaGenel">
        <CardTitle>Bina Genel Görünümü</CardTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{state.assets.length}</div><div style={{ fontSize: 11, color: T.dim }}>İzlenen Varlık</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{totalPoints}</div><div style={{ fontSize: 11, color: T.dim }}>Kontrol Noktası</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: critical.length ? LEVEL_META.critical.color : T.ink, fontVariantNumeric: "tabular-nums" }}>{critical.length}</div><div style={{ fontSize: 11, color: T.dim }}>Açık Kritik İş</div></div>
          <div><div style={{ fontSize: 20, fontWeight: 700, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{(state.energySummary.thisMonth / 1000).toFixed(1)}k</div><div style={{ fontSize: 11, color: T.dim }}>Bu Ay kWh</div></div>
        </div>
      </Card>
    ),
    oncelikler: (
      <Card key="oncelikler">
        <CardTitle>Bugünün Öncelikleri</CardTitle>
        {alerts.length === 0 && <p style={{ color: T.dim, fontSize: 13 }}>Öncelikli bir iş yok.</p>}
        {alerts.slice(0, 4).map((a, i) => (
          <button key={i} onClick={() => onOpenAlert(a)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "7px 0", borderBottom: `1px solid ${T.line}` }}>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: T.dim, width: 18 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ flex: 1, fontSize: 12.5, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: LEVEL_META[a.severity].color, textTransform: "uppercase", flexShrink: 0 }}>{LEVEL_META[a.severity].label}</span>
          </button>
        ))}
      </Card>
    ),
    hizliIslemler: (
      <Card key="hizliIslemler">
        <CardTitle>Hızlı İşlemler</CardTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 8 }}>
          <Button variant="ghost" icon={Plus} onClick={onNewTask}>Yeni Görev</Button>
          <Button variant="ghost" icon={QrCode} onClick={onScan}>QR Tara</Button>
          <Button variant="ghost" icon={Wrench} onClick={() => onNewTask({ issueType: "Arıza" })}>Arıza Bildir</Button>
          <Button variant="ghost" icon={ClipboardList} onClick={() => onGoTo("bakim")}>Bakım Planla</Button>
          <Button variant="ghost" icon={Building2} onClick={() => onGoTo("kontroller")}>Kontrol Listesi</Button>
          <Button variant="ghost" icon={FileText} onClick={() => onGoTo("raporlar")}>Rapor Oluştur</Button>
        </div>
      </Card>
    ),
  };

  // Teknik/Güvenlik/Temizlik: sürükle-bırak ile tasarlanan sıra/görünürlük
  // (bkz. Ayarlar > Mobil Tasarım) devreye girer — tek sütun, telefon
  // ekranına özgü liste. Diğer roller (Yönetim/admin masaüstü): mevcut sabit
  // grid-3 / grid-2 düzeni değişmeden kalır.
  if (DEPT_SHORTCUTS[role]) {
    const layout = state.mobileLayout && state.mobileLayout[role];
    const savedOrder = layout && layout.order && layout.order.length > 0 ? layout.order : DEFAULT_SECTION_ORDER;
    // Kaydedilmiş bir düzen, DEFAULT_SECTION_ORDER'a SONRADAN eklenen yeni
    // bölüm anahtarlarını (ör. "ozet"/"mahallerDurum") içermeyebilir — eski
    // bir kayıt bu yüzden yeni bölümleri sessizce gizlemesin diye,
    // eksik olan yeni anahtarlar sona eklenir (kullanıcı sürükleyerek
    // istediği yere taşıyabilir).
    const order = [...savedOrder, ...DEFAULT_SECTION_ORDER.filter((k) => !savedOrder.includes(k))];
    // Hiç kaydedilmiş düzen yoksa (layout null/undefined) varsayılan gizli
    // bölümler (bkz. DEFAULT_HIDDEN_SECTIONS) uygulanır; kullanıcı bir kez
    // düzen kaydettiyse (layout var, hidden boş bile olsa) ondan sonra HER
    // ZAMAN kullanıcının kendi hidden listesine güvenilir.
    const hidden = new Set(layout ? layout.hidden || [] : DEFAULT_HIDDEN_SECTIONS);
    // "gorevler" daha önce kaydedilmiş bir düzende hâlâ geçiyor olabilir
    // (bkz. DEFAULT_SECTION_ORDER'daki not) — kalıcı olarak kaldırıldığı
    // için burada da açıkça dışlanır, sadece varsayılandan çıkarmak yetmez.
    const visible = order.filter((k) => sectionNodes[k] && !hidden.has(k) && k !== "gorevler");
    return <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{visible.map((k) => sectionNodes[k])}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="grid-3">
        {sectionNodes.binaDurumu}
        {sectionNodes.bugun}
        {sectionNodes.dikkat}
      </div>

      {sectionNodes.gorevler}

      <div className="grid-2">
        {sectionNodes.canliAkis}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {sectionNodes.binaGenel}
          {sectionNodes.oncelikler}
        </div>
      </div>

      {sectionNodes.hizliIslemler}
    </div>
  );
}
