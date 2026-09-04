import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Smartphone, Home, GripVertical, Eye, EyeOff, RotateCcw, Users } from "lucide-react";
import { T, deptColor } from "../theme.js";
import { PageHeader, Card, CardTitle, Button } from "../components/ui.jsx";
import { GlobalStyle } from "../layout/GlobalStyle.jsx";
import { ThemeContext } from "../lib/ThemeContext.jsx";
import { mobileUiTheme } from "../mobile/tokens.js";
import { BottomTabs } from "../mobile/nav/BottomTabs.jsx";
import { TopBar } from "../mobile/nav/TopBar.jsx";
import { NavDrawer } from "../mobile/nav/NavDrawer.jsx";
import { ARACLAR_ITEMS, DAHAFAZLA_ITEMS } from "../mobile/nav/navConfig.js";
import { ALL_PERMISSION_SCREENS } from "../mockData.js";
import { Dashboard, DEFAULT_SECTION_ORDER, DEFAULT_HIDDEN_SECTIONS, SECTION_LABELS } from "./Dashboard.jsx";
import { Teknik } from "./Teknik.jsx";
import { Guvenlik } from "./Guvenlik.jsx";
import { Temizlik } from "./Temizlik.jsx";
import { Operasyonlar } from "./Operasyonlar.jsx";

// Kullanıcı teyidiyle: "Mobil uygulamanın tasarlandığı... departman seçtiğimde
// hangi ekran gelecek gerçekte telefonda ne görecek ordan bakalım tasarlayalım
// ... asıl iş mahal kontrol iş emri açma gibi olduğundan bu senaryoya göre" —
// ve devamında: "3 departman da kendi ile ilgili görevler mahal kontrolleri
// görecek... teknikte sayaç okuması, güvenlik olay tutanağı ve devriye tur,
// arıza kaydı, temizlikte mahal kontrol ve arıza". Bu ekran AYRI bir mockup
// ÇİZMİYOR — gerçek Dashboard/Teknik/Güvenlik/Temizlik bileşenlerini, gerçek
// state/updateState ile, bir <iframe>'in KENDİ (dar) viewport'una
// portal'layarak gösteriyor. @media (max-width:900px) kuralları
// (GlobalStyle.jsx) bu yüzden GERÇEKTEN devreye giriyor. Navigasyon da
// App.jsx'teki goToDeptShortcut ile BİREBİR aynı mekanizma (deepLink{tab,
// action} + DEPARTMENT_VIEW) — telefonda Ana Sayfa'daki kısayola dokunmak
// ile buradakinin davranışı aynı koddan geçer.
// Kullanıcı teyidiyle: "yönetim Ekle departmana bunun ana ekranında tüm
// departmanların görev durum özeti olacak... sahada olan çalışmaları
// planlı bakımları olay tutanaklarını anlık görebilecek" — Yönetim'in
// kısayolları KENDİ sayfası değil BAŞKA departmanların (Teknik/Güvenlik)
// gerçek sayfalarına ya da Operasyonlar gibi üst seviye bir ekrana
// gidiyor (bkz. Dashboard.jsx DEPT_SHORTCUTS "Yönetim" satırı — `view` ya
// da `department`+`tab`).
const DEPTS = ["Teknik", "Güvenlik", "Temizlik", "Yönetim"];

// Ana Sayfa'nın (mobil) düzenini departman bazlı sürükle-bırak ile
// düzenleme — kullanıcı teyidiyle: "sürükle bırak ile ekranı dizayn
// edebilir miyim... tüm Ana Sayfa düzeni". state.mobileLayout[dept] =
// { order: [sectionKey...], hidden: [sectionKey...] } — Dashboard.jsx bunu
// doğrudan okuyup GERÇEK mobil Ana Sayfa'da uyguluyor (bkz. Dashboard.jsx),
// bu yüzden burada yapılan bir değişiklik hem telefon önizlemesine hem
// üretimdeki gerçek mobil ekrana anında yansır. Yeni bir kütüphane
// eklenmedi — HTML5 native sürükle-bırak (draggable) kullanıldı.
function LayoutEditor({ dept, state, updateState }) {
  const [dragIdx, setDragIdx] = useState(null);
  const layoutExists = !!(state.mobileLayout && state.mobileLayout[dept]);
  const layout = (state.mobileLayout && state.mobileLayout[dept]) || {};
  const savedOrder = layout.order && layout.order.length > 0 ? layout.order : DEFAULT_SECTION_ORDER;
  // Dashboard.jsx'teki ile AYNI birleştirme — eski bir kayıtta olmayan
  // yeni bölüm anahtarları (bkz. Dashboard.jsx) sona eklenir, sessizce
  // kaybolmazlar.
  // "gorevler" kalıcı olarak kaldırıldı (bkz. Dashboard.jsx) — eski
  // kaydedilmiş bir düzende hâlâ geçiyorsa editörde ölü bir satır olarak
  // görünmesin diye burada da açıkça dışlanır.
  const order = [...savedOrder, ...DEFAULT_SECTION_ORDER.filter((k) => !savedOrder.includes(k))].filter((k) => k !== "gorevler");
  // Dashboard.jsx'teki ile AYNI varsayılan: hiç kayıtlı düzen yoksa
  // DEFAULT_HIDDEN_SECTIONS gizli başlar (editördeki göz ikonları gerçek
  // Ana Sayfa'nın ilk haliyle tutarlı olsun diye).
  const hidden = new Set(layoutExists ? layout.hidden || [] : DEFAULT_HIDDEN_SECTIONS);

  function persist(nextOrder, nextHidden) {
    updateState({ mobileLayout: { ...(state.mobileLayout || {}), [dept]: { order: nextOrder, hidden: nextHidden } } });
  }
  function move(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const next = [...order];
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    persist(next, [...hidden]);
  }
  function toggleHidden(key) {
    const nextHidden = hidden.has(key) ? [...hidden].filter((k) => k !== key) : [...hidden, key];
    persist(order, nextHidden);
  }
  function resetDefault() { persist([...DEFAULT_SECTION_ORDER], []); }

  return (
    <Card>
      <CardTitle num="02" right={<button onClick={resetDefault} title="Varsayılana dön" style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}><RotateCcw size={14} /></button>}>
        Ana Sayfa Düzeni
      </CardTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {order.map((key, i) => (
          <div key={key} draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); }}
            onDragEnd={() => setDragIdx(null)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}`, cursor: "grab",
              background: dragIdx === i ? "rgba(91,155,217,0.14)" : T.surface2, opacity: hidden.has(key) ? 0.5 : 1 }}>
            <GripVertical size={14} color={T.dimmer} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: T.ink }}>{SECTION_LABELS[key] || key}</span>
            <button onClick={() => toggleHidden(key)} title={hidden.has(key) ? "Göster" : "Gizle"}
              style={{ background: "none", border: "none", cursor: "pointer", color: hidden.has(key) ? T.dimmer : T.accent, display: "flex", flexShrink: 0 }}>
              {hidden.has(key) ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10.5, color: T.dimmer, margin: "10px 0 0" }}>Sürükleyerek sırasını değiştirin, göz ikonuyla gizleyin — sağdaki önizlemeye ve {dept} ekibinin gerçek mobil Ana Sayfa'sına anında yansır.</p>
    </Card>
  );
}

// iframe'in KENDİ document'ine gerçek uygulama bileşenlerini portal'lar —
// URL/route değişikliği ya da ayrı bir login/bypass YOK (güvenlik: QR
// derinbağlantı çalışmasıyla ilgili oturum kapısı bozulmaz), zaten giriş
// yapmış yöneticinin state/updateState'i doğrudan kullanılır. iframe'in
// genişliği sabit (375px) olduğu için @media (max-width:900px) kuralları
// bu belge içinde HER ZAMAN devrede — üst pencere ne kadar geniş olursa
// olsun telefon görünümü doğru tetiklenir.
function PhoneFrame({ children }) {
  const iframeRef = useRef(null);
  const [mountNode, setMountNode] = useState(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    function setup() {
      const idoc = iframe.contentDocument;
      if (!idoc || !idoc.body) return;
      idoc.body.style.margin = "0";
      idoc.body.style.background = mobileUiTheme.bg;
      idoc.body.style.fontFamily = "'Segoe UI', Inter, system-ui, sans-serif";
      setMountNode(idoc.body);
    }
    if (iframe.contentDocument && iframe.contentDocument.readyState === "complete") setup();
    iframe.addEventListener("load", setup);
    return () => iframe.removeEventListener("load", setup);
  }, []);

  // Gerçek telefonda kullanılan CSS yolu ile AYNI (`.mobile-shell`, bkz.
  // GlobalStyle.jsx) — önceden burada masaüstünün daraltılmış `.app-shell`
  // hali kullanılıyordu, bu da önizlemenin gerçek mobil deneyimden (kabuk
  // rengi, bottom-nav stili) sapmasına yol açıyordu.
  return (
    <div style={{ width: 375, flexShrink: 0, borderRadius: 40, padding: 12, background: "#12202E", border: "1px solid #24313F", boxShadow: "0 20px 50px rgba(0,0,0,0.45)" }}>
      <div style={{ width: 120, height: 20, background: "#12202E", border: "1px solid #24313F", borderRadius: 12, margin: "0 auto 8px" }} />
      <div style={{ width: "100%", height: 740, borderRadius: 26, overflow: "hidden", background: mobileUiTheme.bg }}>
        <iframe ref={iframeRef} title="Mobil Önizleme" src="about:blank" style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
      </div>
      {mountNode && createPortal(
        <ThemeContext.Provider value={mobileUiTheme}>
          <GlobalStyle />
          <div className="mobile-shell">{children}</div>
        </ThemeContext.Provider>,
        mountNode
      )}
    </div>
  );
}

// Kullanıcı teyidiyle: "1 hamburger menuyu düzenleyemiyorum mobil dizaynda
// yok" — önceki sürüm sadece <main> + BottomTabs gösteriyordu, TopBar/
// hamburger/NavDrawer önizlemede hiç yoktu. Gerçek NavDrawer'ı burada da
// açıyoruz. Drawer satırlarının hepsi bu önizlemede ayrı bir sayfaya
// gitmiyor (ör. Raporlar/Ayarlar) — sadece dept sayfalarına (Teknik/
// Güvenlik/Temizlik/Talep yönetimi) giden satırlar burada da gerçekten
// gezinir, geri kalanı sessizce kapanır.
//
// Kullanıcı teyidiyle (devamında): "gözden geçirebiliyorum ama kim ne
// görebilir yetkilendiremiyorum" — önceki sürüm önizlemeyi HER ZAMAN tam
// yetkiyle gösteriyordu (gerçek kısıtlama yansımıyordu) ve yetkiyi
// değiştirecek bir kontrol yoktu. Aşağıdaki iki fonksiyon, seçili
// departmanın GERÇEK hesaplarından (state.users, personelin department'ına
// göre) o departmanın şu an neyi görebildiğini hesaplıyor — uydurma bir
// önizleme değil. `MenuPermissions` bunu değiştirebiliyor: departmandaki
// TÜM hesaplara birden uygulanır (bkz. bileşenin kendi yorumu) ve bu ekranın
// dışında da (masaüstü sidebar, Ayarlar > Kullanıcı Yetkilendirme) aynı
// `state.users[].permissions` alanını kullandığı için değişiklik HER YERE
// anında yansır — ayrı bir "mobil menü yetkisi" icat edilmedi.
function deptAccountsFor(dept, state) {
  return state.users.filter((u) => {
    const person = state.team.find((t) => t.id === u.personnelId);
    return person && person.department === dept;
  });
}
function computeDeptPermissions(dept, state) {
  const accounts = deptAccountsFor(dept, state);
  const perms = {};
  ALL_PERMISSION_SCREENS.forEach((key) => {
    const checked = accounts.length > 0 && accounts.every((u) => u.permissions[key]?.view || u.permissions[key]?.read);
    perms[key] = { view: checked, read: checked, write: checked };
  });
  return perms;
}
// Sürükle-bırak (LayoutEditor) ile aynı üslupta — çift satırı önlemek için
// aynı screenKey'e sahip satırlardan (ör. "Talep yönetimi"/"Görevler" ikisi
// de "operasyonlar") yalnız ilki listelenir; ikisi de aynı yetkiyi paylaştığı
// için tek checkbox yeterli.
const MENU_PERMISSION_ITEMS = [...ARACLAR_ITEMS, ...DAHAFAZLA_ITEMS].filter(
  (item, idx, arr) => item.screenKey && arr.findIndex((x) => x.screenKey === item.screenKey) === idx
);

function MenuPermissions({ dept, state, updateState }) {
  const accounts = deptAccountsFor(dept, state);
  const perms = computeDeptPermissions(dept, state);
  function toggle(screenKey) {
    if (accounts.length === 0) return;
    const next = !perms[screenKey].view;
    const ids = new Set(accounts.map((u) => u.id));
    updateState({
      users: state.users.map((u) => (ids.has(u.id) ? { ...u, permissions: { ...u.permissions, [screenKey]: { view: next, read: next, write: next } } } : u)),
    });
  }
  return (
    <Card>
      <CardTitle num="04" right={<Users size={14} color={T.dim} />}>Menü Yetkileri — {dept}</CardTitle>
      {accounts.length === 0 ? (
        <p style={{ fontSize: 11.5, color: T.dimmer, margin: 0 }}>{dept} departmanında giriş hesabı olan personel yok — önce Yönetim'den "Kullanıcı Aç" gerekir.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {MENU_PERMISSION_ITEMS.map((item) => {
            const checked = perms[item.screenKey].view;
            const Icon = item.icon;
            return (
              <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 8, cursor: "pointer", background: T.surface2 }}>
                <input type="checkbox" checked={checked} onChange={() => toggle(item.screenKey)} />
                <Icon size={14} color={T.dim} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: T.ink }}>{item.label}</span>
              </label>
            );
          })}
        </div>
      )}
      <p style={{ fontSize: 10.5, color: T.dimmer, margin: "10px 0 0" }}>
        {dept} departmanındaki {accounts.length} hesabın tümüne birden uygulanır — hem telefon menüsüne hem masaüstü menüsüne (aynı ekranlar paylaşılıyor) anında yansır.
        Tek bir kişiye özel istisna için Ayarlar &gt; Kullanıcı Yetkilendirme'yi kullanın.
      </p>
    </Card>
  );
}

export function MobilTasarim({ state, updateState }) {
  const [dept, setDept] = useState("Teknik");
  const [screen, setScreen] = useState("dashboard"); // "dashboard" | "page"
  // activePage: hangi GERÇEK sayfa gösteriliyor — dept'ten BAĞIMSIZ, çünkü
  // Yönetim'in kısayolları kendi sayfasını değil başka departmanların (ör.
  // Güvenlik) sayfasını açabiliyor.
  const [activePage, setActivePage] = useState(null); // "Teknik" | "Güvenlik" | "Temizlik" | "operasyonlar"
  const [deepLink, setDeepLink] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const previewUser = "Saha Personeli (Önizleme)";

  function selectDept(d) { setDept(d); setScreen("dashboard"); setActivePage(null); setDeepLink(null); }
  function goHome() { setScreen("dashboard"); setActivePage(null); setDeepLink(null); }
  // App.jsx'teki goToDeptShortcut ile birebir aynı: sadece view yerine
  // burada iç ekran state'i değişiyor. `department` kısayolun HEDEFİ —
  // Yönetim'den tetiklense bile ("Olay Tutanakları" → Güvenlik) doğru
  // sayfaya gider.
  function goToDeptShortcut(department, tab, action) {
    setActivePage(department);
    setDeepLink({ department, tab, action });
    setScreen("page");
  }
  // Yönetim'in "Tüm Görevler" gibi departman-sayfası olmayan, üst seviye
  // bir ekrana giden kısayolları için (bkz. App.jsx goTo).
  function goToView(view) {
    setActivePage(view);
    setScreen("page");
  }

  // NavDrawer, gerçek MobileApp.jsx'teki gibi screenKey üretiyor (navConfig.js)
  // — burada dept/screen/activePage'e çeviriyoruz. Desteklenmeyen satırlar
  // (Kontroller/Raporlar/Ayarlar/Personel/Öneriler...) bu önizlemede ayrı
  // bir bileşene sahip değil, sessizce kapanır.
  function handleDrawerSelect(item) {
    setDrawerOpen(false);
    const key = item.screenKey || item.key;
    if (key === "dashboard") { goHome(); return; }
    if (key === "bakim") { goToDeptShortcut("Teknik"); return; }
    if (key === "guvenlik") { goToDeptShortcut("Güvenlik"); return; }
    if (key === "temizlik") { goToDeptShortcut("Temizlik"); return; }
    if (key === "operasyonlar") { goToView("operasyonlar"); return; }
  }
  const drawerActiveKey =
    screen === "dashboard" ? "dashboard" :
    activePage === "Teknik" ? "bakim" :
    activePage === "Güvenlik" ? "guvenlik" :
    activePage === "Temizlik" ? "temizlik" :
    activePage === "operasyonlar" ? "operasyonlar" : null;
  const topBarLabel = screen === "dashboard" ? "Anasayfa" : activePage === "operasyonlar" ? "Talep yönetimi" : (activePage || dept);

  function renderScreen() {
    if (screen === "dashboard") {
      return <Dashboard state={state} role={dept} onGoTo={goToView} onNewTask={() => goToView("operasyonlar")} onScan={() => goToView("operasyonlar")} onOpenAlert={() => goToView("operasyonlar")} onShortcut={goToDeptShortcut} />;
    }
    if (activePage === "operasyonlar") {
      return <Operasyonlar state={state} updateState={updateState} currentUser={previewUser} onOpenTask={() => {}} pendingAction={null} onConsumePending={() => {}} canWrite={true} />;
    }
    // deepLink burada null da olabilir (ör. departman yeni seçildiğinde) —
    // Teknik/Güvenlik/Temizlik bunu zaten güvenle karşılıyor (kendi
    // varsayılan sekmesinde kalır). ÖNCEDEN buraya `|| { department: dept }`
    // gibi sahte bir dolgu nesnesi konuyordu — bu, tüketilen (consume
    // edilen, yani null'a dönen) gerçek bir deepLink'ten SONRAKI render'da
    // HER SEFERİNDE yeni bir referans üretip deepLink effect'ini tekrar
    // tetikliyor, "tab" alanı olmadığı için sekmeyi sessizce "mahal"a geri
    // sıfırlıyordu (kullanıcı teyidiyle bulunan hata: "Olay Tutanağı"
    // kısayoluna basınca Devriye & Olaylar yerine Güvenlik Devriye açılıyordu).
    // mobileMode: true — bu araç TANIM GEREĞİ mobil deneyimi önizliyor
    // (kullanıcı teyidiyle: "mobil uygulama son kullanıcının sahada veri
    // girdiği alan olmalı, formlar üzerinde değişiklik/silme olmamalı") —
    // App.jsx'teki gibi viewport genişliğine göre otomatik algılamaya
    // gerek yok, zaten telefon çerçevesinin İÇİNDEYİZ.
    const common = { state, updateState, currentUser: previewUser, deepLink, onConsumeDeepLink: () => setDeepLink(null), canWrite: true, mobileMode: true };
    if (activePage === "Teknik") return <Teknik {...common} />;
    if (activePage === "Güvenlik") return <Guvenlik {...common} />;
    if (activePage === "Temizlik") return <Temizlik {...common} />;
    return null;
  }

  return (
    <div>
      <PageHeader title="Mobil Tasarım" subtitle="Ayrı bir mockup değil — gerçek uygulama bileşenleri, gerçek veriyle, telefon genişliğinde canlı önizleme. Ana Sayfa'daki kısayollara doğrudan telefonun içinden dokunun." />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 260, flex: "0 0 260px" }}>
          <Card>
            <CardTitle num="01">Departman</CardTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {DEPTS.map((d) => (
                <button key={d} onClick={() => selectDept(d)}
                  style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${dept === d ? T.accent : T.line}`, borderRadius: 10, padding: "9px 12px", cursor: "pointer", textAlign: "left",
                    background: dept === d ? "rgba(91,155,217,0.12)" : "transparent" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: deptColor(d), flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{d}</span>
                </button>
              ))}
            </div>
            {screen !== "dashboard" && <Button variant="ghost" icon={Home} onClick={goHome} style={{ width: "100%", marginTop: 10, justifyContent: "center" }}>Ana Sayfa'ya Dön</Button>}
          </Card>

          <LayoutEditor dept={dept} state={state} updateState={updateState} />

          <MenuPermissions dept={dept} state={state} updateState={updateState} />

          <Card>
            <CardTitle num="03" right={<Smartphone size={14} color={T.dim} />}>Senaryo</CardTitle>
            <p style={{ fontSize: 11.5, color: T.dim, margin: "0 0 8px" }}>
              Ana Sayfa'da her departmanın kendi kısayol grid'i var — Teknik: Görevler / Mahal Kontrol / Sayaç Okuma. Güvenlik: Görevler / Devriye Turu / Olay Tutanağı / Arıza Kaydı Aç. Temizlik: Görevler / Mahal Kontrol / Arıza Kaydı Aç. Yönetim: Tüm Görevler / Planlı Bakımlar / Olay Tutanakları / Devriye Turları — sahada olanı anlık izler.
            </p>
            <p style={{ fontSize: 11.5, color: T.dim, margin: "0 0 8px" }}>
              Mahal Kontrol içinde checklist doldururken "▶ Görev Başlat" / "⚠ Arıza Kaydı Oluştur" (Teknik'te ayrıca "🔧 Ekipman Güncelle") ile de iş emri açılabiliyor.
            </p>
            <p style={{ fontSize: 11, color: T.dimmer, margin: 0 }}>
              Bu, üretimdeki bileşenlerin canlı hali — burada yapılan bir işlem gerçek veriye yazılır. Alt bar önizlemede pasiftir.
            </p>
          </Card>
        </div>

        <PhoneFrame>
          <TopBar baslik={topBarLabel} kapsam={state.branding.siteName} bildirimSayisi={0} bildirimKiremit={false} onMenu={() => setDrawerOpen(true)} onSearch={() => {}} />
          <main className="main-content">{renderScreen()}</main>
          <BottomTabs active={screen === "dashboard" ? "dashboard" : null} onChange={(v) => { if (v === "dashboard") goHome(); }} onScan={() => {}} />
          <NavDrawer
            open={drawerOpen} onClose={() => setDrawerOpen(false)}
            userName={previewUser} deptLabel={dept} siteName={state.branding.siteName} photoUrl={null}
            permissions={computeDeptPermissions(dept, state)} tasks={state.tasks} currentUserName={previewUser} draftCount={0}
            activeKey={drawerActiveKey} onSelect={handleDrawerSelect} onLogout={() => {}} onDesktopSwitch={() => {}} onOpenProfile={() => {}}
          />
        </PhoneFrame>
      </div>
    </div>
  );
}
