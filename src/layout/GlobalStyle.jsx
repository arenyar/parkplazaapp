import { T } from "../theme.js";
import { mobileUiTheme as M } from "../mobile/tokens.js";

export function GlobalStyle() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      body { margin: 0; }
      ::selection { background: ${T.accent}; color: #0B1420; }
      input:focus, select:focus, textarea:focus { outline: 2px solid ${T.accent}; outline-offset: 1px; }
      .app-shell { display: flex; min-height: 100vh; background: ${T.bg}; font-family: 'Segoe UI', Inter, system-ui, sans-serif; }
      .sidebar { display: flex; flex-direction: column; }
      .sidebar-nav { display: flex; flex-direction: column; }
      .sidebar-nav-desktop { display: block; width: 100%; }
      .nav-item:hover { background: rgba(255,255,255,0.06); }
      .nav-item.active { background: rgba(91,155,217,0.14); color: #fff; border-left: 3px solid ${T.accent}; }
      .cmd-row:hover, .search-row:hover { background: rgba(255,255,255,0.07); }
      .card-btn:hover { border-color: ${T.accent} !important; }
      .hamburger { display: none; }
      .bottom-nav { display: none; }
      .mobile-block-overlay { display: none; }
      .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
      .grid-2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; }
      .invoice-print-area { display: none; }
      /* /mobil — kullanıcı teyidiyle: "mobil arayüz webden özel olmalı".
         MobileApp.jsx'in kabuğu (.mobile-shell), telefon genişliğinde bir
         kart gibi HER viewport genişliğinde (masaüstünde de) aynı görünsün
         diye — @media (max-width:900px)'e bağlı olmadan, her zaman etkin. */
      .mobile-shell { min-height: 100vh; max-width: 480px; margin: 0 auto; background: ${M.bg}; color: ${M.ink}; font-family: 'Segoe UI', Inter, system-ui, sans-serif; position: relative; }
      .mobile-shell .main-content { padding: 16px; padding-bottom: calc(78px + env(safe-area-inset-bottom)); box-sizing: border-box; }
      .mobile-shell .grid-3, .mobile-shell .grid-2 { grid-template-columns: 1fr !important; }
      .mobile-shell .bottom-nav {
        display: flex; align-items: flex-end; position: fixed; left: 50%; transform: translateX(-50%); bottom: 0; width: 100%; max-width: 480px; z-index: 45;
        background: ${M.surface}; border-top: 1px solid ${M.line}; padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
      }
      .mobile-shell .bn-btn, .mobile-shell .bn-scan { all: unset; cursor: pointer; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; color: ${M.dim}; }
      .mobile-shell .bn-btn span, .mobile-shell .bn-scan span:last-child { font-size: 10px; font-weight: 600; }
      .mobile-shell .bn-scan-circle {
        width: 50px; height: 50px; border-radius: 50%; background: ${M.accent}; display: flex; align-items: center;
        justify-content: center; margin-top: -30px; border: 3px solid ${M.surface}; box-shadow: 0 4px 14px rgba(30,74,61,0.28);
      }
      .mobile-shell input:focus, .mobile-shell select:focus, .mobile-shell textarea:focus { outline: 2px solid ${M.accent}; }
      .mobile-shell ::selection { background: ${M.accent}; color: #fff; }
      @media print {
        body * { visibility: hidden; }
        .invoice-print-area, .invoice-print-area * { visibility: visible; }
        .invoice-print-area { display: block; position: absolute; top: 0; left: 0; width: 100%; margin: 0; }
        .fatura-sayfa { page-break-after: always; box-shadow: none !important; }
        .fatura-sayfa:last-child { page-break-after: auto; }
        .no-print { display: none !important; }
      }
      @media (max-width: 900px) {
        .app-shell { flex-direction: column; }
        .sidebar { width: 100% !important; flex-direction: row; align-items: center; padding: 10px 12px !important; position: static !important; height: auto !important; }
        .sidebar-nav { flex-direction: row; overflow-x: auto; flex: 1; }
        .sidebar-footer, .sidebar-brand-text { display: none; }
        .hamburger { display: flex; }
        /* Playbook Faz 2: mobilde sabit alt navigasyon (bottom-nav) ve
           "Diğer" ile açılan gruplu çekmece TEK gezinme yüzeyi olsun diye —
           üstteki yatay kaydırmalı ikon şeridi (sidebar-nav-desktop) artık
           mobilde tekrar eden/gereksiz olduğu için gizleniyor. */
        .sidebar-nav-desktop { display: none; }
        .sync-label { display: none; }
        .main-content { padding: 16px !important; padding-bottom: calc(78px + env(safe-area-inset-bottom)) !important; }
        .grid-3 { grid-template-columns: 1fr !important; }
        .grid-2 { grid-template-columns: 1fr !important; }
        .bottom-nav {
          display: flex; align-items: flex-end; position: fixed; left: 0; right: 0; bottom: 0; z-index: 45;
          background: ${T.surface2}; border-top: 1px solid ${T.line}; padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
        }
        .bn-btn, .bn-scan { all: unset; cursor: pointer; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .bn-btn span, .bn-scan span:last-child { font-size: 10px; font-weight: 600; }
        .bn-scan-circle {
          width: 50px; height: 50px; border-radius: 50%; background: ${T.accent}; display: flex; align-items: center;
          justify-content: center; margin-top: -30px; border: 3px solid ${T.surface2}; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .mobile-block-overlay {
          display: flex; position: fixed; inset: 0; z-index: 500; background: ${T.bg};
          flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 32px;
        }
      }
    `}</style>
  );
}
