import { useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { initials } from "../taskDisplay.js";

// Spec departman listesi (Teknik/Temizlik/Güvenlik/Yönetim/Muhasebe) bu
// depoyla eşleşmiyor — gerçek departman enum'u `state.departments`
// (Teknik/Güvenlik/Temizlik/İSG/Yönetim/Resepsiyon), "Muhasebe" diye bir
// departman hiç yok. Uydurmadık, gerçek listeyi kullanıyoruz.
function PersonRow({ person, onOpen }) {
  return (
    <button
      onClick={() => onOpen(person)}
      style={{
        all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "10px 16px", borderBottom: `1px solid ${t.hairline}`, background: t.surface, minHeight: 44,
      }}
    >
      {/* Fotoğraf alanı bu depoda yok (users kaydında photoURL hiç yok) — spec
          bunu zaten öngörmüş: "yoksa harf avatarı üretilir, jenerik silüet
          ikonu kullanılmaz." Harf avatarı her zaman devrede. */}
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: t.pineSoft, color: t.pine, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {initials(person.name)}
      </div>
      <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}</p>
        <p style={{ margin: "1px 0 0", fontSize: 12.5, color: t.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.role}</p>
      </div>
    </button>
  );
}

// Sözleşme (bkz. mobil-ui-prompt Faz 7): departman bazlı katlanabilir
// gruplar, varsayılan yalnız kullanıcının kendi departmanı açık. Üstte ad/
// görev/departmanda arayan arama.
// Kullanıcı teyidiyle: "Her kullanıcı tüm personeli görmesin. Yönetim
// Müdürü tüm personeli, Departman Müdürü kendi personelini görecek" —
// Dashboard.jsx/Kontroller.jsx'teki AYNI kalıp (`!role || role==="Yönetim"
// ? hepsi : role'e göre filtrele`) burada da uygulanıyor; ayrı bir rol
// eşlemesi uydurulmadı. Yönetim dışındaki her departman (şef/müdür dahil)
// yalnız kendi ekibini görür — arama da bu daralmış listenin İÇİNDE arar,
// diğer departmanları aratıp bulmaz.
export function PersonnelListScreen({ state, currentUser, viewerRole, onOpenPerson }) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState(() => new Set([viewerRole]));

  function toggle(dept) {
    setOpenGroups((s) => { const next = new Set(s); next.has(dept) ? next.delete(dept) : next.add(dept); return next; });
  }

  const scopedTeam = !viewerRole || viewerRole === "Yönetim" ? state.team : state.team.filter((p) => p.department === viewerRole);
  const q = query.trim().toLowerCase();
  const filtered = scopedTeam.filter((p) => !q || [p.name, p.role, p.department].some((v) => (v || "").toLowerCase().includes(q)));
  const groups = state.departments
    .filter((dept) => viewerRole === "Yönetim" || !viewerRole || dept === viewerRole)
    .map((dept) => ({ dept, items: filtered.filter((p) => p.department === dept).sort((a, b) => a.name.localeCompare(b.name, "tr")) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <div style={{ padding: "10px 16px", background: t.surface, borderBottom: `1px solid ${t.hairline}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${t.hairline}`, borderRadius: 4, padding: "8px 10px" }}>
          <Search size={15} color={t.muted} aria-hidden="true" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ad, görev veya departman ara"
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontSize: 13.5, color: t.ink }}
          />
        </div>
      </div>
      {groups.length === 0 ? (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: t.ink }}>Sonuç yok.</p>
        </div>
      ) : (
        groups.map((g) => {
          // Arama sırasında eşleşen gruplar otomatik açılır — kullanıcı
          // "Ahmet" yazıp sonucu kapalı bir grubun arkasında bulmasın.
          const isOpen = q ? true : openGroups.has(g.dept);
          return (
            <div key={g.dept}>
              <button
                onClick={() => toggle(g.dept)}
                style={{
                  all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", minHeight: 40, padding: "10px 16px", background: t.ivory,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>{g.dept} · {g.items.length}</span>
                <ChevronDown size={16} style={{ color: t.muted, transform: isOpen ? "none" : "rotate(-90deg)", transition: "transform .15s" }} aria-hidden="true" />
              </button>
              {isOpen && g.items.map((p) => <PersonRow key={p.id} person={p} onOpen={onOpenPerson} />)}
            </div>
          );
        })
      )}
    </div>
  );
}
