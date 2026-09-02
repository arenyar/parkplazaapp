import { LogOut, Monitor, X } from "lucide-react";
import { T, deptColor } from "../theme.js";
import { AvatarInitials, Button } from "../components/ui.jsx";

// Masaüstündeki tam Sidebar çekmecesinin (App.jsx/Sidebar.jsx, 15 ekranlı
// gruplu menü) mobil kabuktaki karşılığı DEĞİL — kullanıcı teyidiyle "mobil
// arayüz webden özel olmalı", personel burada tanım/yönetim ekranlarına değil
// sadece hesap bilgisine, çıkışa ve isterse masaüstü sürümüne erişir.
export function MobileMoreSheet({ currentUser, role, onClose, onLogout }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: T.surface2, width: "100%", maxWidth: 480, borderRadius: "18px 18px 0 0", padding: "18px 18px calc(18px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button onClick={onClose} aria-label="Kapat" style={{ background: "none", border: "none", cursor: "pointer", color: T.dim, display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <AvatarInitials name={currentUser} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{currentUser}</div>
            <div style={{ fontSize: 11.5, color: deptColor(role), fontWeight: 600 }}>{role}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a href="/?masaustu=1" style={{ textDecoration: "none" }}>
            <Button variant="ghost" icon={Monitor} style={{ width: "100%", justifyContent: "center" }}>Masaüstü Sürümüne Geç</Button>
          </a>
          <Button variant="ghost" icon={LogOut} onClick={onLogout} style={{ width: "100%", justifyContent: "center", color: "#E2685A" }}>Çıkış Yap</Button>
        </div>
      </div>
    </div>
  );
}
