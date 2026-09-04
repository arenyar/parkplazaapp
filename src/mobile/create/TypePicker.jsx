import { useMemo, useState } from "react";
import { X, ChevronRight, ChevronDown } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";

// Düz `taskTypes` dizisinden (bkz. mockData.js TASK_TYPES, state.taskTypes)
// parentId ile ağaç kurar, her seviyeyi `order` ile sıralar.
function buildTree(types) {
  const byParent = new Map();
  [...types].sort((a, b) => (a.order || 0) - (b.order || 0)).forEach((t) => {
    const key = t.parentId || null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(t);
  });
  function attach(parentId) {
    return (byParent.get(parentId) || []).map((node) => ({ ...node, children: attach(node.id) }));
  }
  return attach(null);
}

function typePathFor(typeId, types) {
  const byId = new Map(types.map((t) => [t.id, t]));
  const parts = [];
  let cur = byId.get(typeId);
  while (cur) { parts.unshift(cur.label); cur = cur.parentId ? byId.get(cur.parentId) : null; }
  return parts.join(" > ");
}

function Node({ node, depth, expanded, onToggle, selectedId, onSelectLeaf }) {
  const isOpen = expanded.has(node.id);
  const isSelected = node.id === selectedId;
  return (
    <div>
      <button
        onClick={() => (node.isLeaf ? onSelectLeaf(node.id) : onToggle(node.id))}
        style={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
          width: "100%", minHeight: 44, padding: `8px 16px 8px ${16 + depth * 18}px`, color: t.ink, fontSize: 14.5,
        }}
      >
        {!node.isLeaf && (isOpen ? <ChevronDown size={16} style={{ color: t.muted, flexShrink: 0 }} /> : <ChevronRight size={16} style={{ color: t.muted, flexShrink: 0 }} />)}
        <span style={{
          flex: 1, textAlign: "left", fontWeight: isSelected ? 700 : 400,
          textDecoration: isSelected ? `underline ${t.pine}` : "none", textUnderlineOffset: 3,
          color: isSelected ? t.pine : t.ink,
        }}>
          {node.label}
        </span>
      </button>
      {!node.isLeaf && isOpen && node.children.map((child) => (
        <Node key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} selectedId={selectedId} onSelectLeaf={onSelectLeaf} />
      ))}
    </div>
  );
}

// Sözleşme (bkz. mobil-ui-prompt 6.5, mobile-ops-ui SKILL.md): hiyerarşik
// ağaç, her düğüm kendi seviyesinde açılır/kapanır. Seçili yaprak altı
// çizili. Alt barda Vazgeç/Seç — Seç yalnız bir YAPRAK seçiliyken etkin
// (ara düğüme dokunmak sadece açar/kapatır, seçim sayılmaz).
export function TypePicker({ open, types, valueTypeId, onCancel, onSelect }) {
  const tree = useMemo(() => buildTree(types), [types]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(valueTypeId || null);

  if (!open) return null;

  function toggle(id) {
    setExpanded((s) => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function confirm() {
    if (!selectedId) return;
    onSelect(selectedId, typePathFor(selectedId, types));
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", background: t.surface }} role="dialog" aria-modal="true" aria-label="Tür seç">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${t.hairline}` }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: t.ink }}>Tür seç</p>
        <button onClick={onCancel} aria-label="Kapat" style={{ all: "unset", cursor: "pointer", color: t.muted, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
        {tree.map((node) => (
          <Node key={node.id} node={node} depth={0} expanded={expanded} onToggle={toggle} selectedId={selectedId} onSelectLeaf={setSelectedId} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "10px 16px calc(10px + env(safe-area-inset-bottom))", borderTop: `1px solid ${t.hairline}` }}>
        <button
          onClick={onCancel}
          style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", flex: 1, minHeight: 44, textAlign: "center", borderRadius: 4, border: `1px solid ${t.hairline}`, color: t.ink, fontSize: 14, fontWeight: 600 }}
        >
          Vazgeç
        </button>
        <button
          onClick={confirm}
          disabled={!selectedId}
          style={{
            all: "unset", boxSizing: "border-box", cursor: selectedId ? "pointer" : "default", flex: 1, minHeight: 44, textAlign: "center",
            borderRadius: 4, background: selectedId ? t.pine : t.hairline, color: selectedId ? "#fff" : t.muted, fontSize: 14, fontWeight: 700,
          }}
        >
          Seç
        </button>
      </div>
    </div>
  );
}
