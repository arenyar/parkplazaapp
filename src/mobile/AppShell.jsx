import { useState } from "react";
import { Plus } from "lucide-react";
import { mobileTokens as t } from "./tokens.js";
import { TopBar } from "./nav/TopBar.jsx";
import { BottomTabs } from "./nav/BottomTabs.jsx";
import { NavDrawer } from "./nav/NavDrawer.jsx";
import { CreateSheet } from "./create/CreateSheet.jsx";

// Sözleşme (bkz. mobile-ops-ui SKILL.md): TopBar + BottomTabs + NavDrawer +
// FAB yuvasını sarar. Her mobil route bunun içinde açılır. Alt bar drawer
// açıkken de görünür (BottomTabs, drawer overlay'inden daha yüksek z-index).
//
// Faz 11 güncellemesi: içerik alanı artık ivory zemini ALIYOR. Mevcut
// sayfalar (Dashboard/Operasyonlar/Teknik/...) `components/ui.jsx`
// (Card/Button/Input/...) üzerinden ThemeContext'e bağlandı — MobileApp.jsx
// bu ağacı `mobileUiTheme` ile sarıyor (bkz. src/lib/ThemeContext.jsx),
// sayfa dosyaları tek satır değişmeden açık temaya geçiyor. Masaüstü
// (App.jsx → `.app-shell`) hiçbir Provider görmediği için `T` (koyu) ile
// aynı kalır — tek bileşen ağacı, iki yerleşim.
export function AppShell({
  topBar, activeTab, onTabChange, navUser, permissions, tasks, draftCount, activeNavKey,
  onNavigate, onLogout, onDesktopSwitch, onCreateSelect, onOpenProfile, onScan, children,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopBar
        baslik={topBar.baslik}
        kapsam={topBar.kapsam}
        bildirimSayisi={topBar.bildirimSayisi}
        bildirimKiremit={topBar.bildirimKiremit}
        onMenu={() => setDrawerOpen(true)}
        onSearch={topBar.onSearch}
      />

      {/* `.main-content` — GlobalStyle.jsx'teki `.mobile-shell .main-content`
          kuralından (16px yatay + eski bottom-nav yüksekliğine göre ayarlı alt
          boşluk) miras alınır; sayfalar (Dashboard/Operasyonlar/...) bu
          padding'e göre yazıldı, burada tekrar tanımlanmadı. */}
      <main className="main-content">{children}</main>

      {/* Sağdaki `.bottom-nav`/BottomTabs ile AYNI genişlik-kırpma tekniği
          (left:50%+translateX(-50%)+max-width:480) — 480px'den dar gerçek
          telefonlarda bu sarmalayıcı tam viewport genişliğine iner, FAB
          gerçek ekran kenarından 16px'de kalır. Düz `right:16px` (mobile-shell
          genişliğine göre) 480px'den geniş masaüstü önizlemesinde FAB'ı
          ekranın sağ kenarına, kabuğun dışına, iter — bu yüzden kaçınıldı. */}
      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 0, width: "100%", maxWidth: 480, height: 0, pointerEvents: "none", zIndex: 41 }}>
        <button
          onClick={() => setSheetOpen(true)}
          aria-label="Yeni kayıt"
          style={{
            all: "unset", cursor: "pointer", pointerEvents: "auto", position: "absolute", right: 16,
            bottom: "calc(72px + env(safe-area-inset-bottom))",
            width: 56, height: 56, borderRadius: "50%", background: t.pine, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(20,49,40,0.35)",
          }}
        >
          <Plus size={26} aria-hidden="true" />
        </button>
      </div>

      <BottomTabs active={activeTab} onChange={onTabChange} onScan={onScan} />

      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={navUser.name}
        deptLabel={navUser.deptLabel}
        siteName={navUser.siteName}
        photoUrl={navUser.photoUrl}
        permissions={permissions}
        tasks={tasks}
        draftCount={draftCount}
        currentUserName={navUser.name}
        activeKey={activeNavKey}
        onSelect={(item) => { setDrawerOpen(false); onNavigate(item); }}
        onLogout={() => { setDrawerOpen(false); onLogout(); }}
        onDesktopSwitch={onDesktopSwitch}
        onOpenProfile={onOpenProfile}
      />

      <CreateSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSelect={(prefill) => { setSheetOpen(false); onCreateSelect(prefill); }}
        role={navUser.deptLabel}
      />
    </div>
  );
}
