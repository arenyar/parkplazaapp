import { useState } from "react";
import { mobileTokens as t } from "../tokens.js";
import { FilterBar } from "./FilterBar.jsx";
import { PriorityGroup } from "./PriorityGroup.jsx";
import { RecordCard } from "./RecordCard.jsx";

const PRIORITY_ORDER = ["Kritik", "Yüksek", "Orta", "Düşük"];
const PRIORITY_COLORS = {
  "Kritik": { color: t.kiremit, bg: t.kiremitSoft },
  "Yüksek": { color: t.amber, bg: t.amberSoft },
  "Orta": { color: t.pine, bg: t.pineSoft },
  "Düşük": { color: t.muted, bg: t.ivory },
};

function defaultSort(list, mode) {
  const copy = [...list];
  if (mode === "Termine göre") {
    return copy.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }
  return copy.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

// Sözleşme (bkz. mobile-ops-ui SKILL.md ListScreen): tüm modüller bu
// bileşeni paylaşır — sıra filtre çubuğu → katlanabilir gruplar → kart
// listesi → FAB (FAB, AppShell'de zaten global). Varsayılan davranış Faz 3'te
// olduğu gibi görev/öncelik (task/priority) — Faz 9 (Öneriler) gibi FARKLI
// bir kayıt/grup tipi kullanan çağıranlar `groupBy`/`renderCard`/`getAssignee`
// ile bu varsayılanları değiştirir; TaskListScreen hiçbirini geçmediği için
// davranışı birebir aynı kaldı.
export function ListScreen({
  title, tasks, items, currentUserName, onOpenTask, onOpenItem,
  groupBy, renderCard, getAssignee,
  kapsamLabels = ["Tümü", "Bana atananlar"], sortLabels = ["En yeni", "Termine göre"], sortFn,
}) {
  const list = items || tasks || [];
  const openItem = onOpenItem || onOpenTask;
  const assigneeOf = getAssignee || ((it) => it.assignee);
  const groupField = groupBy?.field || ((it) => it.priority);
  const groupOrder = groupBy?.order || PRIORITY_ORDER;
  const groupColors = groupBy?.colors || PRIORITY_COLORS;
  const groupSuffix = groupBy?.suffix ?? "öncelik";
  const sort = sortFn || defaultSort;
  const card = renderCard || ((item, onOpen) => <RecordCard key={item.id} task={item} onOpen={onOpen} />);

  const [kapsam, setKapsam] = useState(kapsamLabels[0]);
  const [sortMode, setSortMode] = useState(sortLabels[0]);
  const [openGroups, setOpenGroups] = useState(() => new Set(groupOrder));

  function toggleGroup(label) {
    setOpenGroups((s) => { const next = new Set(s); next.has(label) ? next.delete(label) : next.add(label); return next; });
  }

  const scoped = list.filter((it) => !it.archived && (kapsam === kapsamLabels[0] || assigneeOf(it) === currentUserName));
  const groups = groupOrder
    .map((label) => ({ label, items: sort(scoped.filter((it) => groupField(it) === label), sortMode) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <FilterBar
        kapsam={kapsam} onToggleKapsam={() => setKapsam((k) => (k === kapsamLabels[0] ? kapsamLabels[1] : kapsamLabels[0]))}
        sort={sortMode} onToggleSort={() => setSortMode((s) => (s === sortLabels[0] ? sortLabels[1] : sortLabels[0]))}
      />
      {groups.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: t.ink }}>Bu filtrede kayıt yok.</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: t.muted, lineHeight: 1.5 }}>
            Filtreyi genişlet veya sağ alttaki "+" ile yeni kayıt aç.
          </p>
        </div>
      ) : (
        groups.map((g) => {
          const style = groupColors[g.label] || PRIORITY_COLORS["Orta"];
          return (
            <PriorityGroup
              key={g.label} label={groupSuffix ? `${g.label} ${groupSuffix}` : g.label} count={g.items.length}
              color={style.color} bg={style.bg} open={openGroups.has(g.label)} onToggle={() => toggleGroup(g.label)}
            >
              {g.items.map((item) => card(item, openItem))}
            </PriorityGroup>
          );
        })
      )}
    </div>
  );
}
