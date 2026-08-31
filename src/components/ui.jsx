import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { T } from "../theme.js";

export function Card({ children, style, className }) {
  return <div className={className} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "18px 20px", ...style }}>{children}</div>;
}

export function CardTitle({ num, right, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      {num && <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: T.accent }}>{num}</span>}
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink, textTransform: "uppercase", letterSpacing: 0.5, flex: 1 }}>{children}</h2>
      {right}
    </div>
  );
}

export function Pill({ children, color, bg }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "3px 9px", color, background: bg, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: T.ink }}>{title}</h1>
        {subtitle && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: T.dim }}>{subtitle}</p>}
      </div>
      {right && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{right}</div>}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", icon: Icon, style, type = "button", title }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
  const variants = {
    primary: { background: T.accent, color: "#0B1420" },
    ghost: { background: T.surface2, color: T.ink, border: `1px solid ${T.line}` },
    quiet: { background: "none", color: T.dim, border: `1px solid ${T.line}` },
  };
  return (
    <button type={type} title={title} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {Icon && <Icon size={14} />}{children}
    </button>
  );
}

export function Input(props) {
  return <input {...props} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, color: T.ink, ...props.style }} />;
}
export function Select({ children, ...props }) {
  return <select {...props} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, color: T.ink, ...props.style }}>{children}</select>;
}
export function TextArea(props) {
  return <textarea {...props} style={{ background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, color: T.ink, resize: "vertical", ...props.style }} />;
}

export function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 5 }}>
        {label}{required && <span style={{ color: "#E2685A" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

export function EmptyState({ children }) {
  return <p style={{ color: T.dim, fontSize: 13, padding: "20px 0" }}>{children}</p>;
}

// Uzun listelerin (Görevler, Varlıklar, Riskler, Dokümanlar) taşmasını önlemek
// için ortak sayfalama kontrolü — bkz. lib/usePagination.js.
export function Pagination({ page, setPage, pageSize, setPageSize, total }) {
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const navBtn = { background: "none", border: `1px solid ${T.line}`, borderRadius: 7, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: T.dim, cursor: "pointer" };
  const navBtnDisabled = { ...navBtn, opacity: 0.35, cursor: "default" };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 2px 2px" }}>
      <span style={{ fontSize: 12, color: T.dim }}>{start}–{end} / {total} kayıt</span>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <label style={{ fontSize: 12, color: T.dim, display: "flex", alignItems: "center", gap: 6 }}>
          Sayfa başına
          <Select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ padding: "5px 8px" }}>
            {[10, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </label>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={page === 1 ? navBtnDisabled : navBtn} title="İlk sayfa"><ChevronsLeft size={14} /></button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={page === 1 ? navBtnDisabled : navBtn} title="Önceki"><ChevronLeft size={14} /></button>
          <span style={{ fontSize: 12, color: T.ink, padding: "0 8px", display: "flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}>{page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={page === totalPages ? navBtnDisabled : navBtn} title="Sonraki"><ChevronRight size={14} /></button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={page === totalPages ? navBtnDisabled : navBtn} title="Son sayfa"><ChevronsRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}

export function AvatarInitials({ name, size = 30, bg }) {
  const initials = name ? name.split(" ").map((p) => p[0]).slice(0, 2).join("") : "?";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg || T.accent, color: "#0B1420", fontSize: size * 0.4, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {initials}
    </div>
  );
}
