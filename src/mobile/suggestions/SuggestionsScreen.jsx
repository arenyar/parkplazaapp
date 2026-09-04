import { useState } from "react";
import { Plus } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { ListScreen } from "../list/ListScreen.jsx";
import { SuggestionCard } from "./SuggestionCard.jsx";
import { SuggestionForm } from "./SuggestionForm.jsx";
import { SuggestionDetailScreen } from "./SuggestionDetailScreen.jsx";
import { STATUS_ORDER, STATUS_COLORS, departmentForCategory } from "./suggestionModel.js";
import { emptyTask } from "../../components/TaskForm.jsx";

// Faz 9 — Liste (ListScreen, Faz 3'ün genelleştirilmiş hali — bkz.
// ListScreen.jsx notu) → Detay (destek/yorum/Yönetim durum değişikliği) →
// Oluşturma formu. "Bir kullanıcı bir öneriyi bir kez destekler" ve "gerekçe
// zorunlu" kuralları SuggestionDetailScreen'de uygulanıyor, burada sadece
// gerçek yazma (updateState) ve "Göreve dönüştür" köprüsü var.
export function SuggestionsScreen({ state, updateState, currentUser, role, canWrite = true }) {
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  function saveSuggestion(updated) {
    updateState({ suggestions: state.suggestions.map((s) => (s.id === updated.id ? updated : s)) });
    setDetail(updated);
  }

  function createSuggestion({ title, description, category, anonymous, photoUrl }) {
    const s = {
      id: `sg_${Date.now()}`, title, description, category, photoUrl, anonymous,
      authorName: currentUser.name, authorDepartment: role, status: "Yeni",
      createdAt: new Date().toISOString(), supporters: [], comments: [],
    };
    updateState({ suggestions: [...state.suggestions, s] });
    setFormOpen(false);
  }

  // Spec: "Kabul edilen öneri Göreve dönüştür ile Görevler modülüne
  // aktarılır, öneriye bağlı kalır." Bu depoda "Görevler" ayrı bir koleksiyon
  // değil (bkz. suggestionModel.js notu) — normal bir görev olarak
  // state.tasks'a eklenir, `sourceSuggestionId` ile öneriye bağlı kalır,
  // öneri de `convertedTaskId` ile görev tarafını tutar (iki yönlü, spec:
  // "iki tarafta da izlenebiliyor" — aynı Faz 8'in bakım↔arıza deseni).
  function convertToTask(s) {
    const nextNo = Math.max(3100, ...state.tasks.map((tk) => tk.ticketNo || 0)) + 1;
    const department = departmentForCategory(s.category);
    const task = {
      ...emptyTask(department, nextNo), description: `[Öneri] ${s.title}${s.description ? ` — ${s.description}` : ""}`,
      id: `t_${Date.now()}`, createdAt: new Date().toISOString(), createdBy: currentUser.name, requester: currentUser.name,
      sourceSuggestionId: s.id,
    };
    const updatedSuggestion = { ...s, convertedTaskId: task.id };
    updateState({ tasks: [...state.tasks, task], suggestions: state.suggestions.map((x) => (x.id === s.id ? updatedSuggestion : x)) });
    setDetail(updatedSuggestion);
  }

  if (formOpen) return <SuggestionForm onSave={createSuggestion} onCancel={() => setFormOpen(false)} />;

  if (detail) {
    const live = state.suggestions.find((s) => s.id === detail.id) || detail;
    return <SuggestionDetailScreen suggestion={live} currentUser={currentUser} viewerRole={role} onBack={() => setDetail(null)} onSave={saveSuggestion} onConvertToTask={convertToTask} />;
  }

  return (
    <div>
      {/* Genel FAB (AppShell) Talep/Görev/Temizlik/Güvenlik seçenekleri taşır,
          "Öneri oluştur" yok (Faz 1'in sabit CreateSheet'i) — o yüzden bu
          modülün TEK gerçek oluşturma girişi burada, listenin üstünde. */}
      {canWrite && (
        <button
          onClick={() => setFormOpen(true)}
          style={{
            all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            width: "calc(100% - 32px)", margin: "12px 16px 0", minHeight: 44, borderRadius: 4, background: t.pine, color: "#fff", fontSize: 13.5, fontWeight: 700,
          }}
        >
          <Plus size={17} aria-hidden="true" /> Yeni öneri
        </button>
      )}
      <ListScreen
        items={state.suggestions} currentUserName={currentUser.name} onOpenItem={setDetail}
        groupBy={{ field: (s) => s.status, order: STATUS_ORDER, colors: STATUS_COLORS, suffix: "" }}
        renderCard={(item, onOpen) => <SuggestionCard key={item.id} suggestion={item} onOpen={onOpen} />}
        getAssignee={(s) => (s.anonymous ? null : s.authorName)}
        kapsamLabels={["Tümü", "Benim gönderdiklerim"]}
        sortLabels={["En yeni", "En çok destek"]}
        sortFn={(list, mode) => {
          const copy = [...list];
          if (mode === "En çok destek") return copy.sort((a, b) => (b.supporters?.length || 0) - (a.supporters?.length || 0));
          return copy.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        }}
      />
    </div>
  );
}
