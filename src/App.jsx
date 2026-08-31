import { useEffect, useRef, useState } from "react";
import { GlobalStyle } from "./layout/GlobalStyle.jsx";
import { Sidebar } from "./layout/Sidebar.jsx";
import { TopBar } from "./layout/TopBar.jsx";
import { MobileBottomNav } from "./layout/MobileBottomNav.jsx";
import { CommandCenter } from "./layout/CommandCenter.jsx";
import { NotificationsSheet } from "./layout/NotificationsSheet.jsx";
import { QrScannerModal } from "./layout/QrScannerModal.jsx";
import { makeInitialState, migrateLegacyState } from "./mockData.js";
import { subscribeState, saveState, authListen, logout as fbLogout } from "./firebase.js";
import { useIsMobile } from "./lib/useIsMobile.js";
import { T } from "./theme.js";

import { Login } from "./pages/Login.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Operasyonlar } from "./pages/Operasyonlar.jsx";
import { KatPlani } from "./pages/KatPlani.jsx";
import { Varliklar } from "./pages/Varliklar.jsx";
import { Teknik } from "./pages/Teknik.jsx";
import { Kontroller } from "./pages/Kontroller.jsx";
import { Guvenlik } from "./pages/Guvenlik.jsx";
import { Temizlik } from "./pages/Temizlik.jsx";
import { Enerji } from "./pages/Enerji.jsx";
import { Riskler } from "./pages/Riskler.jsx";
import { Dokumanlar } from "./pages/Dokumanlar.jsx";
import { Raporlar } from "./pages/Raporlar.jsx";
import { Kpi } from "./pages/Kpi.jsx";
import { Yonetim } from "./pages/Yonetim.jsx";
import { Ayarlar } from "./pages/Ayarlar.jsx";

// Mahal Kontrol QR'ı (bkz. MahalKontrol.jsx QrModal) hangi departman
// sayfasına düşer — hem uygulama içi kamera taramasında (handleQrDecoded)
// hem fiziksel etiketin telefonun kendi kamerasıyla doğrudan URL açmasında
// (bkz. aşağıdaki mount effect'i) AYNI eşleme kullanılır.
const DEPARTMENT_VIEW = { "Teknik": "bakim", "Güvenlik": "guvenlik", "Temizlik": "temizlik" };

export default function App() {
  const [state, setState] = useState(makeInitialState);
  const [view, setView] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [pendingTaskAction, setPendingTaskAction] = useState(null);
  const [mahalDeepLink, setMahalDeepLink] = useState(null);
  const [qrLinkPending, setQrLinkPending] = useState(false);
  // Kullanıcı teyidiyle: "Mobil uygulama son kullanıcının sahada veri
  // girdiği alan olmalı burda formlar üzerinde değişiklik yapmak yada
  // silmek olmamalı" — Teknik/Güvenlik/Temizlik sayfalarına, admin/tanım
  // ekranlarını (üst sekme şeridi, Yeni Mahal, düzenle/sil, Sayaç Ekle)
  // gizlemeleri için iletilir (bkz. Teknik.jsx/Guvenlik.jsx/Temizlik.jsx/
  // MahalKontrol.jsx/SayacOkuma.jsx mobileMode). Hook, erken return'lerden
  // ÖNCE çağrılmalı (Hooks kuralı).
  const isMobile = useIsMobile();
  // Gerçek kimlik doğrulama — kullanıcı teyidiyle bulunan sorun: "database
  // güvenliğini uçtan uca kontrol etmelisin... veriler kaydolmuyor ve
  // kolaylıkla silinebiliyor" — Firestore artık `request.auth != null`
  // istiyor (bkz. firestore.rules), giriş de eskiden state.users içindeki
  // düz-metin şifreyle karşılaştıran sahte kontrol yerine gerçek Firebase
  // Authentication (bkz. Login.jsx, firebase.js authListen/login). `fbUser`
  // ÜÇ durumlu: `undefined` = ilk kontrol henüz sonuçlanmadı (kısa an, login
  // ekranının yanlışlıkla yanıp sönmesini önler), `null` = giriş yapılmamış,
  // obje = giriş yapılmış. state.users kaydı artık personelin GİRİŞ
  // hesabından değil, Firebase Auth'un e-postasından eşleşir.
  const [fbUser, setFbUser] = useState(undefined);
  useEffect(() => authListen(setFbUser), []);
  const currentAccount = fbUser ? state.users.find((u) => (u.username || "").toLowerCase() === (fbUser.email || "").toLowerCase()) || null : null;
  const currentUser = currentAccount ? state.team.find((t) => t.id === currentAccount.personnelId) || null : null;

  // Firebase (Firestore) kalıcılık katmanı — kullanıcı teyidiyle: "yine aynı
  // klasörde firebase bağlantısını yap daha sonradan netlify taşıyacağız".
  // Kritik: bu abonelik artık SADECE giriş yapılmışken başlar (bkz. yukarıdaki
  // not) — Firestore kuralı auth istiyor, girişten önce okumaya çalışmak
  // sessizce reddedilirdi. Çıkış yapılınca abonelik durur ve yerel state
  // ilk (mock) haline döner — bir sonraki kullanıcı öncekinin verisini bir an
  // için bile görmez.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!fbUser) { setState(makeInitialState()); return; }
    const unsub = subscribeState((remote) => {
      if (remote) {
        // Firestore'daki veri bu personel/kullanıcı ayrımından önce
        // kaydedilmiş olabilir (users hiç yok, eski team şekli) — gerçek
        // veriyi kaybetmeden şekli güncelleyip geri yazıyoruz (bkz.
        // mockData.js migrateLegacyState). users zaten varsa dokunmuyor.
        const migrated = migrateLegacyState(remote);
        setState(migrated);
        // Kullanıcı teyidiyle bulunan hata: "güvenlikte sildiğim görevler
        // silinmiyor" (silinen bir mahal kontrol noktası geri geliyor) — kök
        // neden burasıydı: migrateLegacyState HERHANGİ bir alanı düzeltince
        // (ör. başka bir cihazda hâlâ eksik bir varsayılan alan), buradaki eski
        // kod TÜM `migrated` nesnesini saveState'e gönderiyordu — updateState'in
        // "sadece değişen alan(lar) yazılır" garantisini (bkz. yukarıdaki not,
        // firebase.js saveState `{merge:true}`) burada çiğniyordu. Bu, o anda bu
        // istemcinin belleğindeki (başka bir cihazda AZ ÖNCE yapılmış bir
        // silme/değişikliği henüz almamış olabilecek) mahalPoints gibi TÜM
        // alanları geri yazıp az önceki silmeyi geri getirebiliyordu. Artık
        // sadece migrateLegacyState'in GERÇEKTEN değiştirdiği üst seviye
        // alan(lar) (migrateLegacyState idempotent olduğundan ve değişmeyen her
        // alanı AYNI referansla döndürdüğünden, referans eşitsizliği güvenilir
        // bir fark tespiti) gönderiliyor.
        if (migrated !== remote) {
          const changedKeys = Object.keys(migrated).filter((k) => migrated[k] !== remote[k]);
          const diffPatch = Object.fromEntries(changedKeys.map((k) => [k, migrated[k]]));
          saveState(diffPatch);
        }
      }
      else if (!seededRef.current) { seededRef.current = true; saveState(makeInitialState()); }
    });
    return unsub;
  }, [fbUser]);

  // Firestore'a artık SADECE değişen üst seviye alan(lar) (patch) yazılır —
  // bkz. firebase.js saveState. Yerel React state ekranın anında güncellenmesi
  // için hâlâ tam birleşmiş halde tutulur, değişen sadece Firestore'a giden
  // yazmanın kapsamı.
  function updateState(patch) {
    setState((s) => ({ ...s, ...patch }));
    saveState(patch);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandOpen((s) => !s); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fiziksel QR etiketi telefonun KENDİ kamerasıyla (uygulama içi "QR Tara"
  // değil) okutulunca tarayıcı doğrudan bu URL'i açar — kullanıcı teyidiyle:
  // "qr personeller dışında başka biri okuttuğunda ne olacak... evet son
  // önerini yap". Sayfa ilk yüklendiğinde bir kere okunur; giriş yapılmamışsa
  // aşağıdaki early return Login ekranını gösterir (dışarıdan biri hiçbir
  // veri göremez), view state kalıcı olduğu için giriş yapılınca personel
  // otomatik doğru departman sayfasına/checklist'e düşer. URL SADECE burada
  // okunur (mount'ta, state'ten bağımsız) — asıl eşleştirme aşağıdaki ayrı
  // effect'te, gerçek Firestore verisi (girişten SONRA) gelince yapılır;
  // artık subscribeState girişten önce çalışmadığı için state.mahalPoints
  // girişten önce hâlâ ilk mock veri olurdu, gerçek nokta ID'siyle eşleşmezdi.
  const [pendingQr, setPendingQr] = useState(null);
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const mahalId = url.searchParams.get("mahal");
      if (!mahalId) return;
      setPendingQr({ mahalId, floorLabel: url.searchParams.get("floor") || null });
      window.history.replaceState({}, "", url.pathname);
    } catch { /* geçersiz/parametresiz URL — normal açılış */ }
  }, []);
  useEffect(() => {
    if (!pendingQr) return;
    const point = state.mahalPoints.find((p) => p.id === pendingQr.mahalId);
    if (!point) return;
    setMahalDeepLink({ pointId: pendingQr.mahalId, department: point.department, floorLabel: pendingQr.floorLabel });
    if (DEPARTMENT_VIEW[point.department]) setView(DEPARTMENT_VIEW[point.department]);
    setQrLinkPending(true);
    setPendingQr(null);
  }, [pendingQr, state.mahalPoints]);

  function goTo(key) { setView(key); setMobileNavOpen(false); }
  // Ana Sayfa'daki departman kısayolları (bkz. Dashboard.jsx DEPT_SHORTCUTS)
  // — QR deep-link ile aynı mekanizmayı (mahalDeepLink + DEPARTMENT_VIEW)
  // kullanır, sadece belirli bir mahal noktasına değil bir sekmeye (ve
  // opsiyonel bir otomatik aksiyona) yönlendirir.
  function goToDeptShortcut(department, tab, action) {
    setMahalDeepLink({ department, tab, action });
    if (DEPARTMENT_VIEW[department]) setView(DEPARTMENT_VIEW[department]);
  }
  function newTask(prefill) { setPendingTaskAction({ mode: "new", prefill }); setView("operasyonlar"); }
  function editTask(task) { setPendingTaskAction({ mode: "edit", task }); setView("operasyonlar"); }

  function handleResultClick(type, ref) {
    if (type === "task") editTask(ref);
    else if (type === "asset") { setSelectedAssetId(ref.id); setView("varliklar"); }
    else if (type === "incident") setView("guvenlik");
    else if (type === "risk") setView("riskler");
    else if (type === "document") setView("dokumanlar");
    setSearch("");
  }

  function handleAlertClick(alertItem) {
    if (alertItem.goTo === "operasyonlar") editTask(alertItem.ref);
    else if (alertItem.goTo === "varliklar") { setSelectedAssetId(alertItem.ref.id); setView("varliklar"); }
    else setView(alertItem.goTo);
  }

  // Mahal Kontrol QR'ı (bkz. MahalKontrol.jsx QrModal) — kullanıcı teyidiyle:
  // "5. Katta qr okuttun 5. kattaki yangın tüpleri sıralı şekilde gelirdi
  // içine girip cheklisti yapardı böylece kullanımı kolay olurdu". QR içeriği
  // ?mahal=<noktaId>&floor=<katEtiketi> formatında bir URL — doğru departman
  // sayfasına geçilir ve o katın konum listesi ön filtrelenir/açılır. Bu,
  // uygulama içi kamerayla ("QR Tara") okutulduğunda çalışır; fiziksel
  // etiketin telefonun kendi kamerasıyla okutulması yukarıdaki mount
  // effect'inden geçer (aynı DEPARTMENT_VIEW eşlemesi, modül kapsamında).
  function handleQrDecoded(text) {
    setScannerOpen(false);
    try {
      const url = new URL(text);
      const mahalId = url.searchParams.get("mahal");
      if (mahalId) {
        const point = state.mahalPoints.find((p) => p.id === mahalId);
        if (point) {
          setMahalDeepLink({ pointId: mahalId, department: point.department, floorLabel: url.searchParams.get("floor") || null });
          if (DEPARTMENT_VIEW[point.department]) setView(DEPARTMENT_VIEW[point.department]);
          return;
        }
      }
    } catch { /* metin URL değil — varlık eşleşmesine devam */ }
    const asset = state.assets.find((a) => text.toLowerCase().includes(a.name.toLowerCase()) || a.id === text);
    if (asset) { setSelectedAssetId(asset.id); setView("varliklar"); }
    else window.alert(`QR okundu: "${text}" — eşleşen bir varlık bulunamadı.`);
  }

  // Üç durum: fbUser henüz belirlenmedi (kısa an, boş ekran — Login'in
  // yanlışlıkla yanıp sönmesini önler), fbUser yok (Login ekranı), fbUser var
  // ama state.users/team eşleşmesi henüz gelmedi (Firestore senkron sürüyor
  // — kısa "Yükleniyor" ekranı, Login DEĞİL, çünkü giriş zaten başarılı oldu).
  if (fbUser === undefined) return <div style={{ minHeight: "100vh", background: T.bg }} />;
  if (!fbUser) {
    return <Login branding={state.branding} onLoggedIn={() => { if (!qrLinkPending) setView("dashboard"); }} />;
  }
  if (!currentAccount || !currentUser) {
    return <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", color: T.dim, fontSize: 13 }}>Yükleniyor…</div>;
  }

  const unreadCount = state.notifications.filter((n) => !n.read).length;
  const searchData = { tasks: state.tasks, assets: state.assets, risks: state.risks, incidents: state.incidents, documents: state.documents };
  const role = currentUser.department;
  // Web Kullanıcı Yetkilendirmesi — kullanıcı teyidiyle: "hangi personel
  // hangi ekranları görebilecek... yetkilerde yazma okuma görüntüleme
  // parametreleri olmalı". Artık her ekran için ayrı {view,read,write}
  // (bkz. mockData.js buildPermissions, Yonetim.jsx "Yetkileri Düzenle").
  // Menü/erişim view VEYA read true ise açık; write ayrıca sayfalara
  // geçilip "+ Ekle"/"Düzenle"/"Sil" gibi eylemleri göstermek/gizlemek için
  // kullanılabilir (bkz. canWrite) — bu uygulamada hiçbir zaman sunucu
  // tarafı yetki kontrolü olmadı (Firestore appdata koleksiyonu tamamen
  // açık), bu bayraklar bugüne kadarki webScreens modeliyle aynı güven
  // seviyesinde: istemci taraflı bir kullanılabilirlik kontrolü.
  const permissions = currentAccount.permissions || {};
  const allowedScreens = Object.keys(permissions).filter((k) => permissions[k]?.view || permissions[k]?.read);
  const activeView = allowedScreens.includes(view) ? view : (allowedScreens[0] || "dashboard");
  const canWrite = (screenKey) => !!permissions[screenKey]?.write;

  const pages = {
    dashboard: <Dashboard state={state} role={role} onGoTo={goTo} onNewTask={newTask} onScan={() => setScannerOpen(true)} onOpenAlert={handleAlertClick} onShortcut={goToDeptShortcut} />,
    operasyonlar: <Operasyonlar state={state} updateState={updateState} currentUser={currentUser.name} onOpenTask={editTask} pendingAction={pendingTaskAction} onConsumePending={() => setPendingTaskAction(null)} canWrite={canWrite("operasyonlar")} />,
    katplani: <KatPlani state={state} updateState={updateState} canWrite={canWrite("katplani")} />,
    varliklar: <Varliklar state={state} updateState={updateState} selectedId={selectedAssetId} onSelect={setSelectedAssetId} canWrite={canWrite("varliklar")} />,
    bakim: <Teknik state={state} updateState={updateState} currentUser={currentUser.name} deepLink={mahalDeepLink} onConsumeDeepLink={() => setMahalDeepLink(null)} canWrite={canWrite("bakim")} mobileMode={isMobile} />,
    kontroller: <Kontroller state={state} updateState={updateState} currentUser={currentUser.name} canWrite={canWrite("kontroller")} />,
    guvenlik: <Guvenlik state={state} updateState={updateState} currentUser={currentUser.name} deepLink={mahalDeepLink} onConsumeDeepLink={() => setMahalDeepLink(null)} canWrite={canWrite("guvenlik")} mobileMode={isMobile} />,
    temizlik: <Temizlik state={state} updateState={updateState} currentUser={currentUser.name} deepLink={mahalDeepLink} onConsumeDeepLink={() => setMahalDeepLink(null)} canWrite={canWrite("temizlik")} mobileMode={isMobile} />,
    enerji: <Enerji state={state} updateState={updateState} canWrite={canWrite("enerji")} />,
    riskler: <Riskler state={state} updateState={updateState} canWrite={canWrite("riskler")} />,
    dokumanlar: <Dokumanlar state={state} />,
    raporlar: <Raporlar state={state} />,
    kpi: <Kpi state={state} />,
    yonetim: <Yonetim state={state} updateState={updateState} canWrite={canWrite("yonetim")} />,
    ayarlar: <Ayarlar state={state} updateState={updateState} canWrite={canWrite("ayarlar")} />,
  };

  return (
    <div className="app-shell">
      <GlobalStyle />
      {!currentAccount.mobileAccess && (
        <div className="mobile-block-overlay">
          <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Mobil erişiminiz yok</div>
          <p style={{ fontSize: 12.5, color: T.dim, maxWidth: 280, lineHeight: 1.5 }}>{currentUser.name} için mobil uygulama erişimi kapalı. Bu ekranı bir bilgisayardan açın veya yöneticinizden Yönetim &gt; personel kartındaki Yetkileri Düzenle'den erişim isteyin.</p>
        </div>
      )}
      <Sidebar view={activeView} setView={goTo} branding={state.branding} currentUser={currentUser.name} role={role} allowedKeys={allowedScreens}
        mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} />
      <main className="main-content" style={{ flex: 1, padding: "24px 30px", minWidth: 0 }}>
        <TopBar branding={state.branding} search={search} setSearch={setSearch} data={searchData} onResultClick={handleResultClick}
          unreadCount={unreadCount} onOpenNotifications={() => setNotificationsOpen(true)}
          currentUser={currentUser.name} role={role} onLogout={() => fbLogout()}
          onToggleNav={() => setMobileNavOpen((s) => !s)} onOpenCommand={() => setCommandOpen(true)} />
        {allowedScreens.includes(view) ? pages[view] : (
          <div style={{ padding: 40, textAlign: "center", color: T.dim, fontSize: 13 }}>Bu ekrana erişim yetkiniz yok.</div>
        )}
      </main>

      <MobileBottomNav view={view} setView={goTo} unreadCount={unreadCount}
        onScan={() => setScannerOpen(true)} onAlerts={() => setNotificationsOpen(true)} onMore={() => setMobileNavOpen(true)} />

      {commandOpen && (
        <CommandCenter onClose={() => { setCommandOpen(false); setSearch(""); }} onGoTo={goTo} onNewTask={newTask} onScan={() => setScannerOpen(true)}
          data={searchData} search={search} setSearch={setSearch} onResultClick={handleResultClick} />
      )}
      {notificationsOpen && (
        <NotificationsSheet notifications={state.notifications} onClose={() => setNotificationsOpen(false)}
          onMarkAllRead={() => updateState({ notifications: state.notifications.map((n) => ({ ...n, read: true })) })} />
      )}
      {scannerOpen && <QrScannerModal onClose={() => setScannerOpen(false)} onDecoded={handleQrDecoded} />}
    </div>
  );
}
