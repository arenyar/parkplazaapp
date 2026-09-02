import { Home, Workflow, QrCode, MoreHorizontal } from "lucide-react";

// Playbook Faz 2 talimatı: "Mobil alt navigasyonu dört öğe ile sınırla:
// Bugün, İşler, QR ile Başla, Daha Fazla." Önceki sürümde 5. bir öğe olarak
// ayrı bir "Uyarılar" butonu vardı — kaldırılmadı, sadece taşındı: bildirim
// zili zaten TopBar'da her genişlikte görünür kalıyor (bkz. TopBar.jsx,
// mobilde gizlenmiyor), o yüzden burada tekrar etmeye gerek yok. "Daha
// Fazla" (onMore) App.jsx'te zaten Sidebar'ın gruplu tam menüsünü açıyor —
// bkz. Sidebar.jsx NAV_GROUPS.
export function MobileBottomNav({ view, setView, onScan, onMore }) {
  return (
    <nav className="bottom-nav">
      <button onClick={() => setView("dashboard")} className="bn-btn" style={{ color: view === "dashboard" ? "#5B9BD9" : "#93A3B4" }} aria-label="Bugün — Ana Sayfa" aria-current={view === "dashboard" ? "page" : undefined}>
        <Home size={19} strokeWidth={1.8} aria-hidden="true" /><span>Bugün</span>
      </button>
      <button onClick={() => setView("operasyonlar")} className="bn-btn" style={{ color: view === "operasyonlar" ? "#5B9BD9" : "#93A3B4" }} aria-label="İşler — Operasyonlar" aria-current={view === "operasyonlar" ? "page" : undefined}>
        <Workflow size={19} strokeWidth={1.8} aria-hidden="true" /><span>İşler</span>
      </button>
      <button onClick={onScan} className="bn-scan" aria-label="QR ile Başla — tara">
        <span className="bn-scan-circle"><QrCode size={22} color="#0B1420" aria-hidden="true" /></span>
        <span style={{ color: "#93A3B4", marginTop: 1 }}>QR ile Başla</span>
      </button>
      <button onClick={onMore} className="bn-btn" style={{ color: "#93A3B4" }} aria-label="Daha Fazla — tüm menü">
        <MoreHorizontal size={19} strokeWidth={1.8} aria-hidden="true" /><span>Daha Fazla</span>
      </button>
    </nav>
  );
}
