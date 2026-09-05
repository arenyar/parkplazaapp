import { useEffect, useRef, useState } from "react";
import { GlobalStyle } from "./layout/GlobalStyle.jsx";
import { Sidebar } from "./layout/Sidebar.jsx";
import { TopBar } from "./layout/TopBar.jsx";
import { MobileBottomNav } from "./layout/MobileBottomNav.jsx";
import { CommandCenter } from "./layout/CommandCenter.jsx";
import { NotificationsSheet } from "./layout/NotificationsSheet.jsx";
import { QrScannerModal } from "./layout/QrScannerModal.jsx";
import { ToastHost } from "./components/ToastHost.jsx";
import { showToast } from "./lib/toast.js";
import { makeInitialState, migrateLegacyState } from "./mockData.js";
import { subscribeState, saveState, authListen, logout as fbLogout } from "./firebase.js";
import { saveVersionBackup } from "./lib/backup.js";
import { useIsMobile } from "./lib/useIsMobile.js";
import { DEPARTMENT_VIEW } from "./lib/departmentView.js";
import { resolveAssetScan } from "./lib/assetScan.js";
import { T } from "./theme.js";

import { Login } from "./pages/Login.jsx";
import { MobileLogin } from "./pages/MobileLogin.jsx";
import { MobileApp } from "./MobileApp.jsx";
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
import { MobilTasarim } from "./pages/MobilTasarim.jsx";
import { Duyurular } from "./pages/Duyurular.jsx";
import { Stok } from "./pages/Stok.jsx";
import { SuggestionsScreen } from "./mobile/suggestions/SuggestionsScreen.jsx";

// Mahal Kontrol QR'ı (bkz. MahalKontrol.jsx QrModal) hangi departman
// sayfasına düşer — hem uygulama içi kamera taramasında (handleQrDecoded)
// hem fiziksel etiketin telefonun kendi kamerasıyla doğrudan URL açmasında
// (bkz. aşağıdaki mount effect'i) AYNI eşleme kullanılır (bkz.
// lib/departmentView.js — MobileApp.jsx ile paylaşılıyor, dairesel import
// olmasın diye ayrı dosyada).

// Kullanıcı teyidiyle: "benim kullanıcıma özel departmanlar arası geçiş
// yapabilecek bir çalışma" — sadece test hesabı için (Mobil > Profil'de bir
// "Departman Görünümü" seçici), diğer TÜM hesaplar için hiçbir değişiklik
// yok. Firestore'daki `users` koleksiyonu mockData.js'in ilk seed'inden
// türediği ve buraya yeni bir alan eklemek zaten canlı kayıtları geriye
// dönük güncellemeyeceği için (bkz. migrateLegacyState notu), yetkilendirme
// var olan e-postayla eşleştirilir — kapsam SADECE mobil (masaüstü
// Operations Center'daki `role`/Sidebar/TopBar bundan etkilenmez).
const DEPT_SWITCH_TEST_EMAIL = "yonetim@parkplazamaslak.com";

export default function App() {
  const [state, setState] = useState(makeInitialState);
  const [view, setView] = useState("dashboard");
  const [testDeptOverride, setTestDeptOverride] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [pendingTaskAction, setPendingTaskAction] = useState(null);
  const [mahalDeepLink, setMahalDeepLink] = useState(null);
  const [qrLinkPending, setQrLinkPending] = useState(false);
  // Kullanıcı teyidiyle: "mobil arayüz webden özel olmalı... farklı bir link
  // ile mobil uygulamaya giriş yapıyor gibi olmalı" ve devamında "telefon
  // tarayıcısından giriş yaptığında bu mobil kısım otomatik gelmeli". Ayrı
  // bir router kütüphanesi eklemeden (yok, netlify.toml zaten /* →
  // /index.html yönlendiriyor) — aşağıdaki tüm hook'lar (state/auth/
  // Firestore aboneliği) DEĞİŞMEDEN ikisi için de çalışır, sadece son render
  // kararı değişir. Üç durum: (1) /mobil — QR etiketleri/paylaşılan link,
  // her zaman mobil kabuk; (2) düz "/" bir TELEFONDAN açılırsa (dar
  // viewport) — personel her gün siteyi elle /mobil yazmadan, sadece siteyi
  // açarak mobil deneyime düşsün diye otomatik mobil kabuk; (3) "/" bir
  // bilgisayardan açılırsa — mevcut masaüstü Operations Center. ?masaustu=1
  // bu otomatik yönlendirmeyi bilinçli olarak atlamak için (bkz.
  // MobileMoreSheet "Masaüstü Sürümüne Geç" — o link olmasa telefondan
  // masaüstüne geçiş imkansız olurdu, hemen tekrar mobile döner). Mount'ta
  // bir kez okunur (SPA içi bir navigasyon yok, giriş noktası sabit;
  // viewport ileride daralsa/genişlese bile oturum ortasında kabuk
  // değişmez — bu useIsMobile()'ın CANLI, reaktif halinden BİLEREK farklı).
  const [isMobileRoute] = useState(() => {
    const path = window.location.pathname;
    if (path.startsWith("/mobil")) return true;
    const forcedDesktop = new URLSearchParams(window.location.search).get("masaustu") === "1";
    if (path === "/" && !forcedDesktop && window.innerWidth <= 900) return true;
    return false;
  });
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
  // Playbook talimatı (Faz 3): "son senkronizasyon zamanı ve bağlantı
  // durumu" — Firestore'un kendi snapshot metadata'sı (fromCache) en
  // güvenilir kaynak: sunucudan doğrulanmış her snapshot'ta lastSyncAt
  // güncellenir, önbellekten (çevrimdışı) geldiğinde online=false olur.
  const [syncStatus, setSyncStatus] = useState({ online: true, lastSyncAt: null });
  // Geçerli QR'ın "eşleşen mahal bulunamadı" hatasını, henüz Firestore'un
  // GERÇEK verisi gelmeden (state hâlâ makeInitialState() mock seed'iyken)
  // yanlışlıkla göstermemek için — bkz. pendingQr effect'i aşağıda.
  const [dataReady, setDataReady] = useState(false);
  useEffect(() => {
    if (!fbUser) { setState(makeInitialState()); return; }
    const unsub = subscribeState((remote, meta) => {
      setSyncStatus((s) => ({ online: !meta.fromCache, lastSyncAt: meta.fromCache ? s.lastSyncAt : new Date() }));
      if (remote) {
        setDataReady(true);
        // Firestore'daki veri bu personel/kullanıcı ayrımından önce
        // kaydedilmiş olabilir (users hiç yok, eski team şekli) — gerçek
        // veriyi kaybetmeden şekli güncelleyip geri yazıyoruz (bkz.
        // mockData.js migrateLegacyState). users zaten varsa dokunmuyor.
        const migrated = migrateLegacyState(remote);
        setState(migrated);
        // Kullanıcı teyidiyle: "her deployda versiyon bilgisi olsun. yanlış
        // düzenlemelere karşı deploy öncesi versiyona dönebilecek şekilde
        // yedek olsun." — migrateLegacyState yeni bir APP_VERSION'ı İLK KEZ
        // damgaladığı an (bkz. mockData.js) tam olarak "deploy anı"dır; o
        // andaki (henüz yeni sürümün dokunmadığı) `remote` burada ayrı bir
        // yedek belgesine kopyalanır (bkz. lib/backup.js). Sadece versiyon
        // değiştiğinde tetiklenir — her state değişikliğinde değil.
        if (migrated.appVersion?.latest !== remote.appVersion?.latest) {
          saveVersionBackup(remote, remote.appVersion?.latest);
        }
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
  // `opts.silent` — Faz 1b çevrimdışı kuyruğunun arka plan yeniden
  // denemeleri için (bkz. MobileApp.jsx safeUpdateState); dönüş değeri
  // (Promise<boolean>) aynı kuyruğun yazmanın gerçekten başarılı olup
  // olmadığını bilmesi için — mevcut çağıranlar bu değeri okumuyor,
  // davranışları değişmedi.
  function updateState(patch, opts) {
    setState((s) => ({ ...s, ...patch }));
    return saveState(patch, opts);
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
  // Varlık QR'ı (bkz. components/AssetQr.jsx, `?asset=<varlıkId>`) — AYNI
  // fiziksel-etiket/mount-effect deseni, `mahal` yerine `asset` parametresi.
  const [pendingAssetId, setPendingAssetId] = useState(null);
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const mahalId = url.searchParams.get("mahal");
      const assetId = url.searchParams.get("asset");
      if (mahalId) {
        setPendingQr({ mahalId, floorLabel: url.searchParams.get("floor") || null });
        window.history.replaceState({}, "", url.pathname);
      } else if (assetId) {
        setPendingAssetId(assetId);
        window.history.replaceState({}, "", url.pathname);
      }
    } catch { /* geçersiz/parametresiz URL — normal açılış */ }
  }, []);
  useEffect(() => {
    if (!pendingQr || !dataReady) return;
    const point = state.mahalPoints.find((p) => p.id === pendingQr.mahalId);
    if (!point) {
      // Playbook talimatı: "QR geçersizse kullanıcıya neden anlaşılmadığı ve
      // alternatif olarak manuel seçim yapabileceği gösterilmeli" — önceden
      // burada sessizce hiçbir şey olmuyordu (deep-link hiç kurulmuyordu),
      // kullanıcı giriş ekranını görüp sebebini anlamadan Ana Sayfa'ya
      // düşüyordu.
      showToast("Bu QR koduna ait bir mahal bulunamadı — Kontroller ekranından manuel seçebilirsiniz.", "error");
      setPendingQr(null);
      return;
    }
    setMahalDeepLink({ pointId: pendingQr.mahalId, department: point.department, floorLabel: pendingQr.floorLabel });
    if (DEPARTMENT_VIEW[point.department]) setView(DEPARTMENT_VIEW[point.department]);
    setQrLinkPending(true);
    setPendingQr(null);
  }, [pendingQr, dataReady, state.mahalPoints]);
  useEffect(() => {
    if (!pendingAssetId || !dataReady) return;
    const resolved = resolveAssetScan(state, pendingAssetId);
    if (!resolved) {
      showToast("Bu QR'a ait bir varlık bulunamadı — Varlıklar ekranından manuel seçebilirsiniz.", "error");
      setPendingAssetId(null);
      return;
    }
    setMahalDeepLink({ action: "assetScan", department: resolved.department, assetId: resolved.assetId, assetName: resolved.assetName, matchedPointId: resolved.matchedPointId, matchedPointFloorLabel: resolved.matchedPointFloorLabel });
    setView(DEPARTMENT_VIEW[resolved.department] || "varliklar");
    setQrLinkPending(true);
    setPendingAssetId(null);
  }, [pendingAssetId, dataReady, state]);

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
      const assetIdParam = url.searchParams.get("asset");
      if (mahalId) {
        const point = state.mahalPoints.find((p) => p.id === mahalId);
        if (point) {
          setMahalDeepLink({ pointId: mahalId, department: point.department, floorLabel: url.searchParams.get("floor") || null });
          if (DEPARTMENT_VIEW[point.department]) setView(DEPARTMENT_VIEW[point.department]);
          return;
        }
        // Playbook talimatı: geçersiz QR'da neden anlaşılmalı + manuel seçim
        // alternatifi sunulmalı — bu mahal etiketi silinmiş/taşınmış olabilir.
        showToast("Bu QR'a ait mahal artık tanımlı değil — Kontroller ekranından manuel seçebilirsiniz.", "error");
        setView("kontroller");
        return;
      }
      if (assetIdParam) {
        const resolved = resolveAssetScan(state, assetIdParam);
        if (resolved) {
          setMahalDeepLink({ action: "assetScan", department: resolved.department, assetId: resolved.assetId, assetName: resolved.assetName, matchedPointId: resolved.matchedPointId, matchedPointFloorLabel: resolved.matchedPointFloorLabel });
          setView(DEPARTMENT_VIEW[resolved.department] || "varliklar");
          return;
        }
        showToast("Bu QR'a ait varlık artık tanımlı değil (arşivlenmiş olabilir) — Varlıklar ekranından manuel seçebilirsiniz.", "error");
        setView("varliklar");
        return;
      }
    } catch { /* metin URL değil — eski usül varlık adı eşleşmesine devam */ }
    // Geriye dönük uyumluluk: eskiden (bu Faz'dan önce) basılmış olabilecek,
    // URL olmayan düz metin QR'lar için isim/eski-id eşleşmesi.
    const asset = state.assets.find((a) => text.toLowerCase().includes(a.name.toLowerCase()) || a.id === text);
    if (asset) {
      const resolved = resolveAssetScan(state, asset.id);
      setMahalDeepLink({ action: "assetScan", department: resolved.department, assetId: resolved.assetId, assetName: resolved.assetName, matchedPointId: resolved.matchedPointId, matchedPointFloorLabel: resolved.matchedPointFloorLabel });
      setView(DEPARTMENT_VIEW[resolved.department] || "varliklar");
    } else showToast(`QR okundu: "${text}" — eşleşen bir varlık bulunamadı.`, "error");
  }

  // Üç durum: fbUser henüz belirlenmedi (kısa an, boş ekran — Login'in
  // yanlışlıkla yanıp sönmesini önler), fbUser yok (Login ekranı), fbUser var
  // ama state.users/team eşleşmesi henüz gelmedi (Firestore senkron sürüyor
  // — kısa "Yükleniyor" ekranı, Login DEĞİL, çünkü giriş zaten başarılı oldu).
  if (fbUser === undefined) return <div style={{ minHeight: "100vh", background: T.bg }} />;
  if (!fbUser) {
    return isMobileRoute
      ? <MobileLogin branding={state.branding} onLoggedIn={() => { if (!qrLinkPending) setView("dashboard"); }} />
      : <Login branding={state.branding} onLoggedIn={() => { if (!qrLinkPending) setView("dashboard"); }} />;
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
  // Kullanıcı teyidiyle: "duyuru ve önerilerin web sayfasında bağlantısını
  // göremiyorum" — Duyurular/Öneriler mobildeki gibi ("screenKey yok,
  // herkese açık") izin haritasına bakılmadan her zaman erişilebilir; mevcut
  // 33 kişinin permissions kaydı geriye dönük migrate edilmeden de çalışsın.
  const OPEN_SCREENS = ["duyurular", "oneriler"];
  const allowedScreens = [...new Set([...Object.keys(permissions).filter((k) => permissions[k]?.view || permissions[k]?.read), ...OPEN_SCREENS])];
  const activeView = allowedScreens.includes(view) ? view : (allowedScreens[0] || "dashboard");
  const canWrite = (screenKey) => !!permissions[screenKey]?.write;
  const canSwitchDept = (currentAccount.username || "").toLowerCase() === DEPT_SWITCH_TEST_EMAIL;
  const mobileRole = canSwitchDept && testDeptOverride ? testDeptOverride : role;

  if (isMobileRoute) {
    return (
      <MobileApp state={state} updateState={updateState} currentUser={currentUser} currentAccount={currentAccount}
        role={mobileRole} canWrite={canWrite} branding={state.branding} onLogout={() => fbLogout()} dataReady={dataReady}
        qrDeepLink={mahalDeepLink} onConsumeQrDeepLink={() => setMahalDeepLink(null)}
        scannerOpen={scannerOpen} setScannerOpen={setScannerOpen} handleQrDecoded={handleQrDecoded}
        canSwitchDept={canSwitchDept} deptOverride={testDeptOverride} onSetDeptOverride={setTestDeptOverride} />
    );
  }

  const pages = {
    dashboard: <Dashboard state={state} role={role} currentUser={currentUser} onGoTo={goTo} onNewTask={newTask} onScan={() => setScannerOpen(true)} onOpenAlert={handleAlertClick} onShortcut={goToDeptShortcut} onOpenTicket={editTask} />,
    operasyonlar: <Operasyonlar state={state} updateState={updateState} currentUser={currentUser.name} onOpenTask={editTask} pendingAction={pendingTaskAction} onConsumePending={() => setPendingTaskAction(null)} canWrite={canWrite("operasyonlar")} />,
    katplani: <KatPlani state={state} updateState={updateState} canWrite={canWrite("katplani")} />,
    varliklar: <Varliklar state={state} updateState={updateState} selectedId={selectedAssetId} onSelect={setSelectedAssetId} canWrite={canWrite("varliklar")} />,
    stok: <Stok state={state} updateState={updateState} canWrite={canWrite("stok")} />,
    bakim: <Teknik state={state} updateState={updateState} currentUser={currentUser.name} currentUserObj={currentUser} role={role} deepLink={mahalDeepLink} onConsumeDeepLink={() => setMahalDeepLink(null)} canWrite={canWrite("bakim")} mobileMode={isMobile} />,
    kontroller: <Kontroller state={state} updateState={updateState} currentUser={currentUser.name} canWrite={canWrite("kontroller")} />,
    guvenlik: <Guvenlik state={state} updateState={updateState} currentUser={currentUser.name} deepLink={mahalDeepLink} onConsumeDeepLink={() => setMahalDeepLink(null)} canWrite={canWrite("guvenlik")} mobileMode={isMobile} />,
    temizlik: <Temizlik state={state} updateState={updateState} currentUser={currentUser.name} deepLink={mahalDeepLink} onConsumeDeepLink={() => setMahalDeepLink(null)} canWrite={canWrite("temizlik")} mobileMode={isMobile} />,
    enerji: <Enerji state={state} updateState={updateState} canWrite={canWrite("enerji")} />,
    riskler: <Riskler state={state} updateState={updateState} canWrite={canWrite("riskler")} />,
    dokumanlar: <Dokumanlar state={state} />,
    raporlar: <Raporlar state={state} />,
    kpi: <Kpi state={state} />,
    yonetim: <Yonetim state={state} updateState={updateState} canWrite={canWrite("yonetim")} />,
    mobiltasarim: <MobilTasarim state={state} updateState={updateState} />,
    ayarlar: <Ayarlar state={state} updateState={updateState} canWrite={canWrite("ayarlar")} currentUser={currentUser} />,
    duyurular: <Duyurular state={state} updateState={updateState} currentUser={currentUser} role={role} />,
    // Mobildeki <SuggestionsScreen> ile AYNI bileşen (canWrite hiç
    // gönderilmiyor, varsayılan true — mobildeki "herkes öneri verebilir"
    // davranışıyla birebir, izin sistemine bağlanmadı).
    oneriler: <SuggestionsScreen state={state} updateState={updateState} currentUser={currentUser} role={role} />,
  };

  return (
    <div className="app-shell">
      <GlobalStyle />
      <ToastHost />
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
          unreadCount={unreadCount} onOpenNotifications={() => setNotificationsOpen(true)} syncStatus={syncStatus}
          currentUser={currentUser.name} role={role} onLogout={() => fbLogout()}
          onToggleNav={() => setMobileNavOpen((s) => !s)} onOpenCommand={() => setCommandOpen(true)} />
        {allowedScreens.includes(view) ? pages[view] : (
          <div style={{ padding: 40, textAlign: "center", color: T.dim, fontSize: 13 }}>Bu ekrana erişim yetkiniz yok.</div>
        )}
      </main>

      <MobileBottomNav view={view} setView={goTo}
        onScan={() => setScannerOpen(true)} onMore={() => setMobileNavOpen(true)} />

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
