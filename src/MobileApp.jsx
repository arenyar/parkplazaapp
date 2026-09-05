import { useEffect, useRef, useState } from "react";
import { GlobalStyle } from "./layout/GlobalStyle.jsx";
import { ToastHost } from "./components/ToastHost.jsx";
import { QrScannerModal } from "./layout/QrScannerModal.jsx";
import { Button } from "./components/ui.jsx";
import { T } from "./theme.js";
import { ThemeContext } from "./lib/ThemeContext.jsx";
import { mobileUiTheme } from "./mobile/tokens.js";
import { AppShell } from "./mobile/AppShell.jsx";
import { KISISEL_ITEMS, ARACLAR_ITEMS, DAHAFAZLA_ITEMS, OPERASYONLAR_SCOPES, computeGlobalBadge } from "./mobile/nav/navConfig.js";
import { enqueueDraft, removeDraft, getDrafts, subscribeDrafts } from "./mobile/offline/draftQueue.js";
import { TaslaklarScreen } from "./mobile/offline/TaslaklarScreen.jsx";
import { TaskListScreen } from "./mobile/list/TaskListScreen.jsx";
import { MahalGridScreen } from "./mobile/grid/MahalGridScreen.jsx";
import { PersonnelScreen } from "./mobile/personnel/PersonnelScreen.jsx";
import { SuggestionsScreen } from "./mobile/suggestions/SuggestionsScreen.jsx";
import { ProfileScreen } from "./mobile/profile/ProfileScreen.jsx";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Teknik } from "./pages/Teknik.jsx";
import { Kontroller } from "./pages/Kontroller.jsx";
import { Guvenlik } from "./pages/Guvenlik.jsx";
import { Dokumanlar } from "./pages/Dokumanlar.jsx";
import { Raporlar } from "./pages/Raporlar.jsx";
import { Duyurular } from "./pages/Duyurular.jsx";
import { Ayarlar } from "./pages/Ayarlar.jsx";
import { DEPARTMENT_VIEW } from "./lib/departmentView.js";

const ALL_NAV_ITEMS = [...KISISEL_ITEMS, ...ARACLAR_ITEMS, ...DAHAFAZLA_ITEMS];
const BOTTOM_TAB_LABELS = { dashboard: "Anasayfa", akis: "Akış" };

function navLabel(navKey) {
  return ALL_NAV_ITEMS.find((i) => i.key === navKey)?.label || BOTTOM_TAB_LABELS[navKey] || "Park Plaza";
}

// Faz 1 kapsamı: menü mimarisi tam (bölüm 6.1.1), ama bazı satırların
// (Hatırlatmalar, Taslaklar, Duyurular...) henüz gerçek verisi/ekranı yok —
// ListScreen/DetailScreen fazlarına kadar dürüst, tek ortak bir "hazırlanıyor"
// içeriği gösterilir (spec'in Faturalandırma uyarısındaki mantık: boş/özür
// dileyen ekran yerine, en azından NEDEN boş olduğu açık).
function PlaceholderScreen({ baslik }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", color: T.dim, fontSize: 13 }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{baslik}</p>
      <p style={{ margin: 0, lineHeight: 1.5 }}>Bu bölüm hazırlanıyor.</p>
    </div>
  );
}

// screenKey → gerçek sayfa bileşeni. Sadece NavDrawer'da (navConfig.js) gerçek
// bir menü satırı olan screenKey'ler burada — Kat Planı/Varlıklar/Enerji/
// Riskler/KPI/Yönetim BİLİNÇLİ olarak yok: spec'in 6.1.1 menü mimarisinde de
// adı geçmiyorlar ve kod tabanının kendi kuralıyla örtüşüyor (bkz. eski
// MobileMoreSheet yorumu: "mobil = saha, admin/tanım ekranları değil" —
// parkplaza-operations skill: "mobil saha personeline yönetim tanım
// eylemleri verme"). Masaüstüne "Masaüstü sürümüne geç" ile erişilebilirler.
function renderScreen(screenKey, p) {
  switch (screenKey) {
    // DÜZELTME (kullanıcı teyidiyle bulunan hata): "havuzdaki işleri net
    // göremiyorsun" — onOpenAlert argümanını (goTo/ref) yok sayıp HER ZAMAN
    // genel "operasyonlar" listesine gidiyordu; İşlerim/Havuzda Bekleyen
    // İşler'de bir karta dokunmak o kaydın DETAYINI açmıyordu. Artık
    // goTo==="operasyonlar" + gerçek bir görev ref'i varsa doğrudan o
    // kaydın detayı açılır (openTicket ile AYNI, Personel bölümündeki
    // mekanizma); değilse alert'in kendi hedef ekranına gidilir.
    case "dashboard": return <Dashboard state={p.state} role={p.role} currentUser={p.currentUser} onGoTo={p.goToScreen} onNewTask={() => p.newTask()} onScan={p.onScan}
      onOpenAlert={(a) => (a?.goTo === "operasyonlar" && a?.ref ? p.openTicket(a.ref) : p.goToScreen(a?.goTo || "operasyonlar"))}
      onShortcut={p.goToDeptShortcut} onOpenPerson={p.goToPerson} onOpenTicket={p.openTicket} />;
    case "operasyonlar": return (
      <TaskListScreen
        state={p.state} updateState={p.updateState} currentUserName={p.currentUserName}
        scope={OPERASYONLAR_SCOPES[p.activeNavKey] || OPERASYONLAR_SCOPES.operasyonlar}
        pendingAction={p.pendingTaskAction} onConsumePending={p.onConsumePending} canWrite={p.canWrite("operasyonlar")}
      />
    );
    // Kullanıcı teyidiyle bulunan hata: "bakım takvimine tıklayınca mahal
    // kontrol görevler ekranı geliyor" — "Teknik bakım" ve "Bakım takvimi"
    // AYNI screenKey'i ("bakim") paylaştığı için React ikisi arasında geçişte
    // Teknik'i YENİDEN MOUNT ETMİYORDU, iç `tab` state'i bir önceki
    // ziyaretten kalıyordu (deepLink null olduğunda sıfırlanmıyor, bkz.
    // Teknik.jsx deepLink effect'i — QR/mahal deepLink'i tüketildiğinde de
    // null olduğu için orada bilerek sıfırlamıyor). `key={activeNavKey}` bu
    // iki giriş noktası arasında HER ZAMAN taze bir mount garanti eder; tab
    // yine `useState` varsayılanından başlar, doğru deepLink varsa hemen
    // üzerine yazılır.
    case "bakim": return <Teknik key={p.activeNavKey} state={p.state} updateState={p.updateState} currentUser={p.currentUserName} currentUserObj={p.currentUser} role={p.role} deepLink={p.deepLink} onConsumeDeepLink={p.onConsumeDeepLink} canWrite={p.canWrite("bakim")} mobileMode />;
    case "kontroller": return <Kontroller state={p.state} updateState={p.updateState} currentUser={p.currentUserName} canWrite={p.canWrite("kontroller")} />;
    case "guvenlik": return <Guvenlik state={p.state} updateState={p.updateState} currentUser={p.currentUserName} deepLink={p.deepLink} onConsumeDeepLink={p.onConsumeDeepLink} canWrite={p.canWrite("guvenlik")} mobileMode />;
    case "temizlik": return (
      <MahalGridScreen
        state={p.state} updateState={p.updateState} currentUserName={p.currentUserName}
        department="Temizlik" canWrite={p.canWrite("temizlik")}
      />
    );
    case "dokumanlar": return <Dokumanlar state={p.state} />;
    case "raporlar": return <Raporlar state={p.state} />;
    case "ayarlar": return <Ayarlar state={p.state} updateState={p.updateState} canWrite={p.canWrite("ayarlar")} />;
    default:
      if (p.activeNavKey === "taslaklar") return <TaslaklarScreen drafts={p.drafts} syncing={p.syncing} onRetry={p.onRetryDraft} onRetryAll={p.onRetryAllDrafts} />;
      if (p.activeNavKey === "personel") return <PersonnelScreen state={p.state} currentUser={p.currentUser} role={p.role} initialPerson={p.personDeepLink} onConsumeInitialPerson={p.onConsumePersonDeepLink} />;
      if (p.activeNavKey === "oneriler") return <SuggestionsScreen state={p.state} updateState={p.updateState} currentUser={p.currentUser} role={p.role} />;
      // Kullanıcı teyidiyle: "duyuru... web sayfasında bağlantısını
      // göremiyorum" — Duyurular artık gerçek bir ekran (bkz. pages/
      // Duyurular.jsx, App.jsx ile PAYLAŞILIYOR), placeholder'dan çıktı.
      if (p.activeNavKey === "duyurular") return <Duyurular state={p.state} updateState={p.updateState} currentUser={p.currentUser} role={p.role} />;
      return <PlaceholderScreen baslik={navLabel(p.activeNavKey)} />;
  }
}

// Kuyruğa gönderilecek kaydın Taslaklar ekranında görüneceği kısa açıklama —
// bu depoda `updateState` her zaman `{ üstSeviyeAlan: yeniDizi }` şeklinde
// çağrılıyor (bkz. Operasyonlar.jsx/Teknik.jsx/...), o yüzden hangi üst
// alanın değiştiğine bakmak yeterli.
function describePatch(patch) {
  if (patch.tasks) return "Görev / talep kaydı";
  if (patch.mahalRuns) return "Mahal kontrol kaydı";
  if (patch.mahalTurRuns) return "Mahal kontrol turu";
  if (patch.patrols) return "Devriye kaydı";
  if (patch.incidents) return "Güvenlik olay kaydı";
  return `Kayıt (${Object.keys(patch).join(", ")})`;
}

// Kuyruğa alınmış ESKİ bir `{tasks:[...]}` patch'ini, kuyrukta beklediği
// süre boyunca başka bir istemcinin (ör. az önce senkron olmuş bir cihaz)
// eklediği/değiştirdiği kayıtları EZMEDEN, canlı diziyle id bazlı birleştirir
// — App.jsx'teki üst-seviye-alan "sadece değişeni yaz" ilkesinin aynısını
// bir seviye derinde (dizi elemanı) uyguluyoruz. Bilinen sınır: kuyruktaki
// istemci offline'ken BAŞKA bir istemci aynı id'li kaydı SİLERSE, bu birleştirme
// o kaydı geri getirir (silme zaten bu depoda güvenilir çalışmıyor — bkz.
// mobil-ui-prompt.md "bilinen açık sorun"; bu Faz 1b'nin çözeceği bir konu değil).
function reconcilePatch(patch, liveState) {
  if (!patch.tasks || !liveState?.tasks) return patch;
  const byId = new Map(liveState.tasks.map((t) => [t.id, t]));
  patch.tasks.forEach((t) => byId.set(t.id, t));
  return { ...patch, tasks: [...byId.values()] };
}

// Kullanıcı teyidiyle: "mobilin data alışverişi web sayfası olacak ancak
// arayüz kullanıcı yetkileri farklı olacak... mobil arayüz webden özel
// olmalı". App.jsx'teki TÜM veri/kimlik doğrulama katmanı (state, updateState,
// Firestore aboneliği, QR mount-effect'i) burada AYNEN kullanılıyor.
//
// mobil-ui-prompt.md Faz 1: eski MobileBottomNav/MobileMoreSheet kabuğu
// yerine Hotelkit esintili AppShell (TopBar+BottomTabs+NavDrawer+FAB+
// CreateSheet, bkz. src/mobile/) — menü mimarisi ve rol filtresi bölüm 6.1.1,
// yetki kaynağı `currentAccount.permissions` (users/{uid}.roles bu depoda
// yok, bkz. onaylanan envanter). mobileMode zaten Teknik/Güvenlik/Temizlik/
// MahalKontrol/SayacOkuma'da tanım/düzenle/sil ekranlarını gizliyor
// (kullanıcı teyidiyle: "mobil uygulama sahada veri girdiği alan olmalı,
// formlarda değişiklik/silme olmamalı").
export function MobileApp({ state, updateState, currentUser, currentAccount, role, canWrite, branding, onLogout, dataReady, qrDeepLink, onConsumeQrDeepLink, scannerOpen, setScannerOpen, handleQrDecoded, canSwitchDept, deptOverride, onSetDeptOverride }) {
  const [activeNavKey, setActiveNavKey] = useState("dashboard");
  const [deepLink, setDeepLink] = useState(null);
  const [personDeepLink, setPersonDeepLink] = useState(null);
  const [pendingTaskAction, setPendingTaskAction] = useState(null);
  const [drafts, setDrafts] = useState(getDrafts);
  const [syncing, setSyncing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // Flush/retry, mount effect'inde bir kere kaydedilen 'online' dinleyicisi
  // İÇİNDEN çağrılıyor — en güncel `state`/`updateState`'i (App.jsx'ten her
  // render'da yeni referans gelir) stale closure yerine ref'ten okuyoruz.
  const stateRef = useRef(state);
  stateRef.current = state;
  const updateStateRef = useRef(updateState);
  updateStateRef.current = updateState;

  useEffect(() => subscribeDrafts(setDrafts), []);

  // GÜVENLİK KRİTİK: `stateRef.current` mount anında henüz Firestore'un
  // GERÇEK verisi değil, App.jsx'in `useState(makeInitialState)` ile
  // başlattığı YEREL MOCK olabilir (Firestore aboneliği asenkron, ilk
  // snapshot gelene kadar birkaç render sürer). Faz 1b'nin ilk sürümünde bu
  // kontrol yoktu: mount'ta hemen tetiklenen flushDrafts, taslağı mock'un
  // ~107 kayıtlık `tasks` dizisiyle uzlaştırıp bunu GERÇEK production
  // verisinin (193 kayıt) ÜZERİNE yazdı — canlı ortamda ~85 gerçek kayıt
  // kaybına yol açtı. `dataReady` (bkz. App.jsx, ilk gerçek snapshot
  // gelince true olur) bu yüzden flush'ı KOŞULSUZ kilitler; hiçbir taslak
  // gerçek veri doğrulanmadan senkronlanmaz.
  async function flushDrafts(onlyId) {
    if (!dataReady) return;
    const pending = onlyId ? getDrafts().filter((d) => d._draftId === onlyId) : getDrafts();
    if (pending.length === 0) return;
    setSyncing(true);
    for (const draft of pending) {
      const patch = reconcilePatch(draft.patch, stateRef.current);
      const ok = await updateStateRef.current(patch, { silent: true });
      if (ok) removeDraft(draft._draftId);
      else if (!onlyId) break;
    }
    setSyncing(false);
  }
  useEffect(() => {
    flushDrafts(); // dataReady olunca (mount'ta zaten öyleyse hemen, değilse bu effect dataReady değişince tekrar çalışır) bekleyen taslak varsa dener
    window.addEventListener("online", () => flushDrafts());
    return () => window.removeEventListener("online", flushDrafts);
  }, [dataReady]);

  function retryDraft(draftId) { flushDrafts(draftId); }
  function retryAllDrafts() { flushDrafts(); }

  // Faz 1b: bu kabuktaki TÜM mobil yazmalar (yeni kayıt dahil, tek chokepoint
  // — bkz. draftQueue.js üstündeki not) buradan geçer, ekranlara `updateState`
  // yerine bu geçirilir. Yazma başarısız olursa (asıl sebep offline/timeout/
  // vs. fark etmez) hem mevcut hata toast'ı gösterilir (saveState'in normal
  // davranışı, silent değil) HEM DE aynı patch kuyruğa alınır — spec: "sessiz
  // veri kaybı olmamalı".
  async function safeUpdateState(patch) {
    const ok = await updateState(patch);
    if (!ok) enqueueDraft(patch, describePatch(patch));
    return ok;
  }

  const permissions = currentAccount.permissions || {};
  const navItem = ALL_NAV_ITEMS.find((i) => i.key === activeNavKey);
  const screenKey = navItem?.screenKey || (activeNavKey === "dashboard" ? "dashboard" : null);
  const activeTab = ["dashboard", "akis"].includes(activeNavKey) ? activeNavKey : null;

  // Fiziksel QR etiketi ya da uygulama içi "QR Tara" ile gelen bir eşleşme —
  // App.jsx'in paylaşılan mahalDeepLink state'i (qrDeepLink prop'u) değişince
  // bu kabuğun kendi yerel ekran state'ine yansıtılır.
  useEffect(() => {
    if (!qrDeepLink) return;
    const target = DEPARTMENT_VIEW[qrDeepLink.department]; // "Teknik"→"bakim" vb.
    if (target) { setActiveNavKey(target); setDeepLink(qrDeepLink); }
    onConsumeQrDeepLink();
  }, [qrDeepLink]);

  function goHome() { setActiveNavKey("dashboard"); setDeepLink(null); }
  // Kullanıcı teyidiyle bulunan hata: Dashboard'un "Tümünü gör" gibi
  // butonları `onGoTo("kontroller")` çağırıyordu ama bu fonksiyon argümanı
  // YOK SAYIP her zaman "operasyonlar"a gidiyordu — artık gerçekten
  // parametreyle gelen ekrana gider (aynı NavDrawer screenKey'leri).
  function goToScreen(key) { setDeepLink(null); setActiveNavKey(key || "operasyonlar"); }
  function goToOperasyonlar() { setActiveNavKey("operasyonlar"); }
  function goToDeptShortcut(department, tab, action) {
    const target = DEPARTMENT_VIEW[department];
    setActiveNavKey(target || "operasyonlar");
    setDeepLink(target ? { department, tab, action } : null);
  }
  // Kullanıcı teyidiyle: "Mobil Yönetici anasayfasında personellerin listesi
  // gelsin... basınca personel detayı gelecek" — Dashboard > PersonnelAccordion
  // bir kişiye tıklayınca buraya gelir, "Personel" ekranına o kişi seçili
  // açılır (bkz. PersonnelScreen.jsx initialPerson).
  function goToPerson(person) { setPersonDeepLink(person); setActiveNavKey("personel"); }
  function newTask(prefill) { setPendingTaskAction({ mode: "new", prefill }); setActiveNavKey("operasyonlar"); }
  // Kullanıcı teyidiyle: "personellerin üzerindeki işler neler burda iş
  // emri no varsa ona tıkladığımda detay görürüz" — Dashboard > Personel
  // bölümündeki bir iş emri rozetine dokununca buraya gelir. TaskListScreen
  // hâlâ `pendingAction.mode === "edit"`i destekliyor (bkz. o dosyadaki
  // useEffect), sadece kart dokunmaları için ARTIK kullanılmıyordu — burada
  // yeniden kullanıldı, yeni bir mekanizma icat edilmedi.
  function openTicket(task) { setPendingTaskAction({ mode: "edit", task }); setActiveNavKey("operasyonlar"); }

  // Kullanıcı teyidiyle: "Bakım takvimi tekniğin ekranına getirilebilsin" —
  // artık kendi ayrı ekranı YOK, Teknik'in ("bakim" screenKey) deepLink
  // yönlendirmesiyle "takvim" sekmesi seçili açılıyor — App.jsx'teki
  // goToDeptShortcut ile AYNI mekanizma (bkz. Teknik.jsx deepLink effect'i).
  function handleNavSelect(item) {
    if (item.key === "bakimtakvimi") {
      setDeepLink({ department: "Teknik", tab: "takvim" });
      setActiveNavKey(item.key);
      return;
    }
    setDeepLink(null);
    setActiveNavKey(item.key);
  }
  function handleTabChange(tab) {
    if (tab === "dashboard") { goHome(); return; }
    setDeepLink(null);
    setActiveNavKey(tab);
  }

  // FAB → CreateSheet seçimini mevcut GERÇEK yazma yoluna (Operasyonlar >
  // TaskForm) departman ön-doluyla yönlendirir — yeni bir form Faz 1
  // kapsamında değil (bkz. component ağacı, RecordForm Faz 2/3).
  function handleCreateSelect({ department, category, issueType }) {
    const prefill = {};
    if (department || role) prefill.department = department || role;
    if (category) prefill.category = category;
    if (issueType) prefill.issueType = issueType;
    newTask(prefill);
  }

  if (!currentAccount.mobileAccess) {
    return (
      <ThemeContext.Provider value={mobileUiTheme}>
        <div style={{ minHeight: "100vh", background: mobileUiTheme.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 32 }}>
          <GlobalStyle /><ToastHost />
          <div style={{ fontSize: 15, fontWeight: 700, color: mobileUiTheme.ink, marginBottom: 6 }}>Mobil erişiminiz yok</div>
          <p style={{ fontSize: 12.5, color: mobileUiTheme.dim, maxWidth: 280, lineHeight: 1.5, marginBottom: 18 }}>
            {currentUser.name} için mobil uygulama erişimi kapalı. Yöneticinizden Yönetim &gt; personel kartındaki Yetkileri Düzenle'den erişim isteyin.
          </p>
          <Button variant="ghost" onClick={onLogout}>Çıkış Yap</Button>
        </div>
      </ThemeContext.Provider>
    );
  }

  if (profileOpen) {
    return (
      <ThemeContext.Provider value={mobileUiTheme}>
        <div className="mobile-shell">
          <GlobalStyle />
          <ToastHost />
          <ProfileScreen
            state={state} updateState={safeUpdateState} currentUser={currentUser} currentAccount={currentAccount}
            role={role} branding={branding} onLogout={onLogout} onBack={() => setProfileOpen(false)}
            canSwitchDept={canSwitchDept} deptOverride={deptOverride} onSetDeptOverride={onSetDeptOverride}
          />
        </div>
      </ThemeContext.Provider>
    );
  }

  const badge = computeGlobalBadge(state.tasks, currentUser.name);
  const screenProps = {
    state, updateState: safeUpdateState, role, canWrite, deepLink, activeNavKey, personDeepLink,
    currentUserName: currentUser.name, currentUser, pendingTaskAction,
    onConsumeDeepLink: () => setDeepLink(null), onConsumePending: () => setPendingTaskAction(null),
    onConsumePersonDeepLink: () => setPersonDeepLink(null),
    onScan: () => setScannerOpen(true), goToOperasyonlar, goToScreen, goToDeptShortcut, goToPerson, newTask, openTicket,
    drafts, syncing, onRetryDraft: retryDraft, onRetryAllDrafts: retryAllDrafts,
  };

  return (
    <ThemeContext.Provider value={mobileUiTheme}>
      <div className="mobile-shell">
        <GlobalStyle />
        <ToastHost />
        <AppShell
          topBar={{ baslik: navLabel(activeNavKey), kapsam: branding.siteName, bildirimSayisi: badge.count, bildirimKiremit: badge.urgent, onSearch: () => {} }}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          navUser={{ name: currentUser.name, deptLabel: role, siteName: branding.siteName, photoUrl: currentUser.photoUrl }}
          permissions={permissions}
          tasks={state.tasks}
          draftCount={drafts.length}
          activeNavKey={activeNavKey}
          onNavigate={handleNavSelect}
          onLogout={onLogout}
          onScan={() => setScannerOpen(true)}
          onDesktopSwitch={() => { window.location.href = "/?masaustu=1"; }}
          onCreateSelect={handleCreateSelect}
          onOpenProfile={() => setProfileOpen(true)}
        >
          {renderScreen(screenKey, screenProps)}
        </AppShell>
        {scannerOpen && <QrScannerModal onClose={() => setScannerOpen(false)} onDecoded={handleQrDecoded} />}
      </div>
    </ThemeContext.Provider>
  );
}
