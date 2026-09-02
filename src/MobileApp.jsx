import { useEffect, useState } from "react";
import { GlobalStyle } from "./layout/GlobalStyle.jsx";
import { ToastHost } from "./components/ToastHost.jsx";
import { MobileBottomNav } from "./layout/MobileBottomNav.jsx";
import { MobileMoreSheet } from "./layout/MobileMoreSheet.jsx";
import { QrScannerModal } from "./layout/QrScannerModal.jsx";
import { Button } from "./components/ui.jsx";
import { T } from "./theme.js";
import { Dashboard } from "./pages/Dashboard.jsx";
import { Operasyonlar } from "./pages/Operasyonlar.jsx";
import { Teknik } from "./pages/Teknik.jsx";
import { Guvenlik } from "./pages/Guvenlik.jsx";
import { Temizlik } from "./pages/Temizlik.jsx";
import { DEPARTMENT_VIEW } from "./lib/departmentView.js";

// Kullanıcı teyidiyle: "mobilin data alışverişi web sayfası olacak ancak
// arayüz kullanıcı yetkileri farklı olacak... mobil arayüz webden özel
// olmalı". App.jsx'teki TÜM veri/kimlik doğrulama katmanı (state, updateState,
// Firestore aboneliği, QR mount-effect'i) burada AYNEN kullanılıyor — bu
// bileşen sadece App.jsx'in masaüstü Sidebar/TopBar/15-ekran kabuğu yerine,
// daha önce MobilTasarim.jsx'te (admin önizleme aracı) kanıtlanmış
// departman-odaklı deneyimi GERÇEK giriş noktası olarak render ediyor.
// mobileMode={true} zaten Teknik/Güvenlik/Temizlik/MahalKontrol/SayacOkuma'da
// tanım/düzenle/sil ekranlarını gizliyor (kullanıcı teyidiyle: "mobil
// uygulama sahada veri girdiği alan olmalı, formlarda değişiklik/silme
// olmamalı").
export function MobileApp({ state, updateState, currentUser, currentAccount, role, canWrite, branding, onLogout, qrDeepLink, onConsumeQrDeepLink, scannerOpen, setScannerOpen, handleQrDecoded }) {
  const [screen, setScreen] = useState("dashboard"); // "dashboard" | "page"
  const [activePage, setActivePage] = useState(null); // "Teknik" | "Güvenlik" | "Temizlik" | "operasyonlar"
  const [deepLink, setDeepLink] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pendingTaskAction, setPendingTaskAction] = useState(null);

  // Fiziksel QR etiketi ya da uygulama içi "QR Tara" ile gelen bir eşleşme —
  // App.jsx'in paylaşılan mahalDeepLink state'i (qrDeepLink prop'u) değişince
  // bu kabuğun KENDİ yerel ekran state'ine yansıtılır (masaüstünde bu App.jsx
  // `view`'ı doğrudan güncelliyor, burada karşılığı bu effect).
  useEffect(() => {
    if (!qrDeepLink) return;
    setActivePage(qrDeepLink.department);
    setDeepLink(qrDeepLink);
    setScreen("page");
    onConsumeQrDeepLink();
  }, [qrDeepLink]);

  function goHome() { setScreen("dashboard"); setActivePage(null); setDeepLink(null); }
  function goToDeptShortcut(department, tab, action) {
    setActivePage(department);
    setDeepLink({ department, tab, action });
    setScreen("page");
  }
  // Masaüstünde Yönetim'in kısayolları 15 ekranın herhangi birine gidebiliyor
  // (Ayarlar, Raporlar vb.) — mobil kabukta sadece "Tüm Görevler" (Operasyonlar)
  // anlamlı, geri kalanı tanım/rapor ekranları olduğu için burada yok (kullanıcı
  // teyidiyle: mobil = saha, admin ekranları değil). Karşılığı olmayan bir
  // kısayola dokunulursa güvenli varsayılan olarak Operasyonlar açılır.
  function goToView() { setActivePage("operasyonlar"); setScreen("page"); }
  function newTask(prefill) { setPendingTaskAction({ mode: "new", prefill }); setActivePage("operasyonlar"); setScreen("page"); }
  function editTask(task) { setPendingTaskAction({ mode: "edit", task }); setActivePage("operasyonlar"); setScreen("page"); }

  if (!currentAccount.mobileAccess) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 32 }}>
        <GlobalStyle /><ToastHost />
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Mobil erişiminiz yok</div>
        <p style={{ fontSize: 12.5, color: T.dim, maxWidth: 280, lineHeight: 1.5, marginBottom: 18 }}>
          {currentUser.name} için mobil uygulama erişimi kapalı. Yöneticinizden Yönetim &gt; personel kartındaki Yetkileri Düzenle'den erişim isteyin.
        </p>
        <Button variant="ghost" onClick={onLogout}>Çıkış Yap</Button>
      </div>
    );
  }

  function renderScreen() {
    if (screen === "dashboard") {
      return <Dashboard state={state} role={role} onGoTo={goToView} onNewTask={() => newTask()} onScan={() => setScannerOpen(true)} onOpenAlert={() => goToView()} onShortcut={goToDeptShortcut} />;
    }
    if (activePage === "operasyonlar") {
      return <Operasyonlar state={state} updateState={updateState} currentUser={currentUser.name} onOpenTask={editTask}
        pendingAction={pendingTaskAction} onConsumePending={() => setPendingTaskAction(null)} canWrite={canWrite("operasyonlar")} />;
    }
    const screenKey = DEPARTMENT_VIEW[activePage];
    const common = { state, updateState, currentUser: currentUser.name, deepLink, onConsumeDeepLink: () => setDeepLink(null), canWrite: canWrite(screenKey), mobileMode: true };
    if (activePage === "Teknik") return <Teknik {...common} />;
    if (activePage === "Güvenlik") return <Guvenlik {...common} />;
    if (activePage === "Temizlik") return <Temizlik {...common} />;
    return null;
  }

  const navView = screen === "dashboard" ? "dashboard" : "operasyonlar";

  return (
    <div className="mobile-shell">
      <GlobalStyle />
      <ToastHost />
      <main className="main-content">{renderScreen()}</main>
      <MobileBottomNav view={navView}
        setView={(v) => { if (v === "dashboard") goHome(); else goToView(); }}
        onScan={() => setScannerOpen(true)} onMore={() => setMoreOpen(true)} />
      {moreOpen && <MobileMoreSheet currentUser={currentUser.name} role={role} onClose={() => setMoreOpen(false)} onLogout={onLogout} />}
      {scannerOpen && <QrScannerModal onClose={() => setScannerOpen(false)} onDecoded={handleQrDecoded} />}
    </div>
  );
}
