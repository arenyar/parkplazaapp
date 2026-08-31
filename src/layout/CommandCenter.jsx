import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { T } from "../theme.js";
import { searchAcrossData } from "../lib/search.js";
import { NAV_ITEMS } from "./navItems.js";

export function CommandCenter({ onClose, onGoTo, onNewTask, onScan, data, search, setSearch, onResultClick }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const staticCommands = [
    { label: "Yeni Görev Oluştur", action: () => onNewTask() },
    { label: "QR Tara", action: () => onScan() },
    ...NAV_ITEMS.map((it) => ({ label: it.label, action: () => onGoTo(it.key) })),
  ];
  const query = search.trim().toLowerCase();
  const matchedCommands = query ? staticCommands.filter((c) => c.label.toLowerCase().includes(query)) : staticCommands.slice(0, 8);
  const dataResults = query ? searchAcrossData(search, data) : [];
  function run(action) { action(); onClose(); }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "12vh 16px 16px" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 14, width: 560, maxWidth: "100%", maxHeight: "70vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${T.line}` }}>
          <Search size={16} color={T.dim} />
          <input ref={inputRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            placeholder="Bir komut yazın veya arayın… (ör. 'Chiller', 'yeni görev', 'geciken işler')"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: 14.5 }} />
          <span style={{ fontSize: 11, color: T.dim, fontFamily: "ui-monospace, monospace" }}>ESC</span>
        </div>
        <div style={{ overflowY: "auto", padding: 8 }}>
          {matchedCommands.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ padding: "6px 12px 2px", fontSize: 10.5, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 0.4 }}>İşlemler</div>
              {matchedCommands.map((c) => (
                <button key={c.label} onClick={() => run(c.action)} className="cmd-row" style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13, color: "#fff", boxSizing: "border-box" }}>{c.label}</button>
              ))}
            </div>
          )}
          {dataResults.map((g) => (
            <div key={g.label} style={{ marginBottom: 6 }}>
              <div style={{ padding: "6px 12px 2px", fontSize: 10.5, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 0.4 }}>{g.label}</div>
              {g.items.map((it) => (
                <button key={it.id} onClick={() => run(() => onResultClick(g.type, it.ref))} className="cmd-row" style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", padding: "9px 12px", borderRadius: 8, boxSizing: "border-box" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{it.title}</div>
                  {it.sub && <div style={{ fontSize: 11.5, color: T.dim }}>{it.sub}</div>}
                </button>
              ))}
            </div>
          ))}
          {matchedCommands.length === 0 && dataResults.length === 0 && <div style={{ padding: "14px 12px", fontSize: 12.5, color: T.dim }}>Sonuç bulunamadı.</div>}
        </div>
      </div>
    </div>
  );
}
