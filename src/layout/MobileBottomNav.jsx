import { Home, Workflow, QrCode, Bell, MoreHorizontal } from "lucide-react";

export function MobileBottomNav({ view, setView, unreadCount, onScan, onAlerts, onMore }) {
  return (
    <nav className="bottom-nav">
      <button onClick={() => setView("dashboard")} className="bn-btn" style={{ color: view === "dashboard" ? "#5B9BD9" : "#93A3B4" }}>
        <Home size={19} strokeWidth={1.8} /><span>Ana Sayfa</span>
      </button>
      <button onClick={() => setView("operasyonlar")} className="bn-btn" style={{ color: view === "operasyonlar" ? "#5B9BD9" : "#93A3B4" }}>
        <Workflow size={19} strokeWidth={1.8} /><span>Operasyon</span>
      </button>
      <button onClick={onScan} className="bn-scan">
        <span className="bn-scan-circle"><QrCode size={22} color="#0B1420" /></span>
        <span style={{ color: "#93A3B4", marginTop: 1 }}>Tara</span>
      </button>
      <button onClick={onAlerts} className="bn-btn" style={{ color: "#93A3B4", position: "relative" }}>
        <Bell size={19} strokeWidth={1.8} />
        <span>Uyarılar</span>
        {unreadCount > 0 && <span style={{ position: "absolute", top: -2, right: "22%", background: "#E2685A", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 999, minWidth: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{unreadCount}</span>}
      </button>
      <button onClick={onMore} className="bn-btn" style={{ color: "#93A3B4" }}>
        <MoreHorizontal size={19} strokeWidth={1.8} /><span>Diğer</span>
      </button>
    </nav>
  );
}
