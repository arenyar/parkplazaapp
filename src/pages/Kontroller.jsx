import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { T } from "../theme.js";
import { PageHeader, Card, Input } from "../components/ui.jsx";
import { getLocations, runFor, scheduleLabel, FillModal, buildMahalFillPatch, resolveMeters, hasNonConformity, NonConformityPanel, isShiftVisible, useNow } from "./MahalKontrol.jsx";

// Kontroller — Teknik/Temizlik/Güvenlik'in TÜM Mahal Kontrol noktalarını tek
// bir iş akışı görünümünde toplar — kullanıcı teyidiyle: "Mahal Kontrolleri
// Hatta kontroller ekranına al iş akışı gibi teknik temizlik güvenlik olarak
// göster... planlandı yapıldı. uygunsuzluk var mı varsa görsel yanında
// kücük göster katagoriye alt alta yap burda da düzenleme yapılabilecek.
// tıklayınca düzenleme yapsın". Departman sütunu -> periyot (kategori)
// başlığı -> mahal satırları. Kaydetme mantığı MahalKontrol.jsx ile AYNI
// (buildMahalFillPatch, tek kaynak) — burada da tıklayınca aynı kontrol
// formu açılıp doldurulabilir.
//
// Bilinçli olarak Talep/Şikayet, Planlı Bakım ve Arıza Kayıtları'na hiç
// dokunmuyor — kullanıcı teyidiyle: "talep şikayetler ile mahal
// kontrollerini karıştırma Planlı bakımlar ile arıza kayıtlarıda ayrı
// olacak". Uygunsuzluk göstergesi sadece bu mahalden (mahalPointId) doğan,
// henüz kapanmamış görevlere bakar — Talep/Şikayet veya Planlı Bakım
// kayıtlarını hiç saymaz.
const DEPARTMENTS = ["Teknik", "Temizlik", "Güvenlik"];
const PERIOD_ORDER = ["Günlük", "Haftalık", "Aylık", "Yıllık"];
const LOCATION_PAGE_SIZE = 12;

// Vardiyalı noktalarda (bkz. point.shifts, ör. Güvenlik Devriyesi gündüz/
// gece — kullanıcı teyidiyle: "devriye saatleri değiştirilebilir") her
// konum×vardiya kombinasyonu kendi run'ını taşır, o yüzden toplam/tamamlanan
// sayısı buna göre çarpılır.
function pointStatus(point, state) {
  const shifts = point.shifts && point.shifts.length > 0 ? point.shifts : null;
  if (point.perFloor) {
    const locations = getLocations(point, state);
    const done = shifts
      ? locations.reduce((sum, loc) => sum + shifts.filter((s) => runFor(point, state.mahalRuns, loc.key, s.id)?.status === "Tamamlandı").length, 0)
      : locations.filter((loc) => runFor(point, state.mahalRuns, loc.key)?.status === "Tamamlandı").length;
    const total = shifts ? locations.length * shifts.length : locations.length;
    return { done, total, complete: total > 0 && done === total };
  }
  if (shifts) {
    const done = shifts.filter((s) => runFor(point, state.mahalRuns, undefined, s.id)?.status === "Tamamlandı").length;
    return { done, total: shifts.length, complete: done === shifts.length };
  }
  const run = runFor(point, state.mahalRuns);
  const done = run?.status === "Tamamlandı" ? 1 : 0;
  return { done, total: 1, complete: done === 1 };
}

function PointRow({ point, state, isExpanded, onToggle, onOpenFill, onOpenNonConformity }) {
  const [q, setQ] = useState("");
  const st = pointStatus(point, state);
  const nc = hasNonConformity(point, state);
  const locations = point.perFloor ? getLocations(point, state) : null;
  const filtered = locations ? (q ? locations.filter((l) => l.label.toLowerCase().includes(q.toLowerCase())) : locations.slice(0, LOCATION_PAGE_SIZE)) : null;
  const now = useNow();
  const visibleShifts = point.shifts && point.shifts.length > 0 ? point.shifts.filter((s) => isShiftVisible(s, now)) : null;

  return (
    <div>
      <button onClick={onToggle}
        style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%", display: "flex", alignItems: "center", gap: 8, background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 11px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{point.name}</div>
          <div style={{ fontSize: 10, color: T.dim, marginTop: 1 }}>{st.total > 1 ? `${st.done}/${st.total} tamamlandı` : (st.complete ? "Yapıldı" : "Planlandı")}{scheduleLabel(point)}</div>
        </div>
        {nc && (
          <span role="button" title="Uygunsuzluk var — bilgi için tıklayın" onClick={(e) => { e.stopPropagation(); onOpenNonConformity(point); }}
            style={{ display: "flex", flexShrink: 0, cursor: "pointer" }}>
            <AlertTriangle size={13} color="#E2685A" />
          </span>
        )}
        <span title={st.complete ? "Yapıldı" : "Planlandı"} style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: st.complete ? "#3FB37F" : "#E0B354" }} />
        <ChevronRight size={14} color={T.dimmer} style={{ flexShrink: 0, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {isExpanded && (
        <div style={{ marginTop: 6, marginLeft: 4, display: "flex", flexDirection: "column", gap: 4 }}>
          {locations && locations.length > LOCATION_PAGE_SIZE && (
            <div style={{ position: "relative", marginBottom: 2 }}>
              <Search size={12} color={T.dimmer} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kat/konum ara…" style={{ width: "100%", boxSizing: "border-box", paddingLeft: 26, fontSize: 11.5 }} />
            </div>
          )}
          {(locations ? filtered : [null]).map((loc, i) => {
            // Vardiyalı noktalarda tek satır yerine her vardiya kendi
            // rozet+butonuyla ayrı gösterilir — bkz. MahalKontrol.jsx
            // PerFloorCard'daki aynı desen (tek kaynak, aynı davranış).
            if (visibleShifts) {
              return (
                <div key={loc?.key || i} style={{ padding: "6px 10px", borderRadius: 8, background: T.surface, border: `1px solid ${T.line}` }}>
                  <div style={{ fontSize: 11.5, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc?.label || point.name}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
                    {visibleShifts.length === 0 && <span style={{ fontSize: 10, color: T.dimmer, fontStyle: "italic" }}>Vardiya saati henüz gelmedi</span>}
                    {visibleShifts.map((shift) => {
                      const run = runFor(point, state.mahalRuns, loc?.key, shift.id);
                      const done = run?.status === "Tamamlandı";
                      return (
                        <button key={shift.id} onClick={() => onOpenFill(point, loc, shift)} title={`${shift.start}–${shift.end}`}
                          style={{
                            all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999, padding: "3px 9px", flexShrink: 0,
                            background: done ? "rgba(63,179,127,0.14)" : "rgba(224,179,84,0.14)", color: done ? "#3FB37F" : "#B4551E",
                          }}>
                          <span style={{ fontSize: 10, fontWeight: 700 }}>{done ? "✓" : "○"} {shift.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
            const run = runFor(point, state.mahalRuns, loc?.key);
            const done = run?.status === "Tamamlandı";
            return (
              <button key={loc?.key || i} onClick={() => onOpenFill(point, loc)}
                style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: T.surface, border: `1px solid ${T.line}` }}>
                <span style={{ flex: 1, fontSize: 11.5, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc?.label || "Kontrol Et"}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: done ? "#3FB37F" : "#E0B354", flexShrink: 0 }}>{done ? "✓" : "Bekliyor"}</span>
              </button>
            );
          })}
          {locations && locations.length > LOCATION_PAGE_SIZE && !q && (
            <p style={{ fontSize: 10.5, color: T.dimmer, margin: "2px 0 0" }}>+{locations.length - LOCATION_PAGE_SIZE} tane daha — aramak için yukarı yazın.</p>
          )}
        </div>
      )}
    </div>
  );
}

const TR_MONTHS_FULL = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const HAFTA_BASLIKLARI = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

function trTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function trDateLong(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${TR_MONTHS_FULL[m - 1]} ${y}`;
}
function locationLabelForRun(point, state, run) {
  if (!run.locationKey) return "";
  const loc = getLocations(point, state).find((l) => l.key === run.locationKey);
  return loc ? ` — ${loc.label}` : "";
}

// Kontroller Takvimi — kullanıcı teyidiyle: "Kontroller sayfasına takvim koy
// seçilen günde mahal kontrol yapılmış mı görebilelim. dönem seçilir günler
// seçilir". Ay bazlı gezinme (dönem) + gün tıklama (o gün tamamlanan
// kontrolleri listeler) — mahalRuns'daki GERÇEK completedAt zaman damgasına
// göre, uydurma/planlanan veri yok. Departman filtresi opsiyonel.
function ControlCalendar({ state, onOpenFill }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });
  const [deptFilter, setDeptFilter] = useState("");
  const [selectedDay, setSelectedDay] = useState(todayStr);

  const runsByDay = useMemo(() => {
    const map = new Map();
    (state.mahalRuns || []).forEach((r) => {
      if (r.status !== "Tamamlandı" || !r.completedAt) return;
      if (deptFilter && r.department !== deptFilter) return;
      const day = r.completedAt.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(r);
    });
    return map;
  }, [state.mahalRuns, deptFilter]);

  const { y, m } = cursor;
  const daysInMonth = new Date(y, m, 0).getDate();
  const startWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Pazartesi = 0
  const cells = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function shiftMonth(delta) {
    let nm = m + delta, ny = y;
    if (nm < 1) { nm = 12; ny -= 1; } else if (nm > 12) { nm = 1; ny += 1; }
    setCursor({ y: ny, m: nm });
    setSelectedDay(null);
  }

  const selectedRuns = selectedDay ? (runsByDay.get(selectedDay) || []) : [];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => shiftMonth(-1)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", color: T.ink, cursor: "pointer" }}><ChevronLeft size={14} /></button>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, minWidth: 130, textAlign: "center" }}>{TR_MONTHS_FULL[m - 1]} {y}</div>
            <button onClick={() => shiftMonth(1)} style={{ background: "none", border: `1px solid ${T.line}`, borderRadius: 7, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", color: T.ink, cursor: "pointer" }}><ChevronRight size={14} /></button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["", ...DEPARTMENTS].map((d) => (
              <button key={d || "all"} onClick={() => setDeptFilter(d)}
                style={{ border: `1px solid ${deptFilter === d ? T.accent : T.line}`, background: deptFilter === d ? `${T.accent}22` : "none", color: deptFilter === d ? T.accent : T.dim, borderRadius: 999, padding: "4px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {d || "Tümü"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
          {HAFTA_BASLIKLARI.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: T.dimmer, padding: "2px 0" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {cells.map((d, i) => {
            if (d == null) return <div key={i} />;
            const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const runs = runsByDay.get(dateStr) || [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDay;
            return (
              <button key={i} onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                style={{
                  aspectRatio: "1", border: `1px solid ${isSelected ? T.accent : isToday ? T.accentDim : T.line}`,
                  background: runs.length > 0 ? "rgba(63,179,127,0.14)" : T.surface2, borderRadius: 8, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, padding: 2,
                }}>
                <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: T.ink }}>{d}</span>
                {runs.length > 0 && <span style={{ fontSize: 8.5, fontWeight: 700, color: "#3FB37F" }}>{runs.length}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      {selectedDay && (
        <Card>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 10 }}>
            {trDateLong(selectedDay)} — {selectedRuns.length} kontrol tamamlandı
          </div>
          {selectedRuns.length === 0 && <p style={{ fontSize: 12, color: T.dim }}>Bu gün tamamlanan mahal kontrolü yok.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {selectedRuns.map((r) => {
              const point = state.mahalPoints.find((p) => p.id === r.pointId);
              const shift = point?.shifts?.find((s) => s.id === r.shiftId) || null;
              return (
                <button key={r.id} onClick={() => point && onOpenFill(point, r.locationKey ? getLocations(point, state).find((l) => l.key === r.locationKey) : null, shift)}
                  style={{ all: "unset", boxSizing: "border-box", cursor: point ? "pointer" : "default", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: T.surface2, border: `1px solid ${T.line}`, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, width: 68, flexShrink: 0 }}>{r.department}</span>
                  <span style={{ flex: 1, fontSize: 12, color: T.ink, minWidth: 140 }}>{point ? point.name : r.pointId}{point ? locationLabelForRun(point, state, r) : ""}{r.shiftLabel ? ` — ${r.shiftLabel}` : ""}</span>
                  <span style={{ fontSize: 11, color: T.dim }}>{r.completedBy}</span>
                  <span style={{ fontSize: 11, color: T.dimmer, fontVariantNumeric: "tabular-nums" }}>{trTime(r.completedAt)}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

export function Kontroller({ state, updateState, currentUser }) {
  const [view, setView] = useState("liste");
  const [expandedId, setExpandedId] = useState(null);
  const [fillTarget, setFillTarget] = useState(null);
  const [ncPoint, setNcPoint] = useState(null);

  function submitFill(payload) {
    const { point, location } = fillTarget;
    updateState(buildMahalFillPatch(state, point, location, payload));
    setFillTarget(null);
  }
  function openFill(point, location, shift) { setFillTarget({ point, location, shift }); }

  return (
    <div>
      <PageHeader title="Kontroller" subtitle="Departman bazlı Mahal Kontrol iş akışı — planlandı/yapıldı durumu ve uygunsuzluklar tek görünümde"
        right={
          <div style={{ display: "flex", gap: 6 }}>
            {[{ key: "liste", label: "Liste" }, { key: "takvim", label: "Takvim" }].map((v) => (
              <button key={v.key} onClick={() => setView(v.key)}
                style={{ border: `1px solid ${view === v.key ? T.accent : T.line}`, background: view === v.key ? `${T.accent}22` : "none", color: view === v.key ? T.accent : T.dim, borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {v.label}
              </button>
            ))}
          </div>
        }
      />

      {view === "takvim" && <ControlCalendar state={state} onOpenFill={openFill} />}

      {view === "liste" && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, alignItems: "start" }}>
        {DEPARTMENTS.map((dept) => {
          const points = state.mahalPoints.filter((p) => p.department === dept && !p.archived);
          const byPeriod = new Map();
          points.forEach((p) => {
            if (!byPeriod.has(p.period)) byPeriod.set(p.period, []);
            byPeriod.get(p.period).push(p);
          });
          const periods = [...byPeriod.keys()].sort((a, b) => {
            const ia = PERIOD_ORDER.indexOf(a), ib = PERIOD_ORDER.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
          });
          return (
            <div key={dept}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>
                {dept} <span style={{ color: T.dimmer, fontWeight: 600 }}>· {points.length}</span>
              </div>
              {points.length === 0 && <p style={{ fontSize: 12, color: T.dimmer }}>Tanımlı mahal yok.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {periods.map((period) => (
                  <div key={period}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: T.dim, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6 }}>{period}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {byPeriod.get(period).map((p) => (
                        <PointRow key={p.id} point={p} state={state}
                          isExpanded={expandedId === p.id} onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                          onOpenFill={openFill}
                          onOpenNonConformity={(point) => setNcPoint(point)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {fillTarget && (
        <FillModal point={fillTarget.point} location={fillTarget.location} shift={fillTarget.shift} meters={resolveMeters(state, fillTarget.point, fillTarget.location)} state={state}
          run={runFor(fillTarget.point, state.mahalRuns, fillTarget.location?.key, fillTarget.shift?.id)}
          team={state.team.filter((t) => t.department === fillTarget.point.department)} currentUser={currentUser} assets={state.assets} onSubmit={submitFill} onClose={() => setFillTarget(null)} />
      )}
      {ncPoint && <NonConformityPanel point={ncPoint} state={state} onClose={() => setNcPoint(null)} />}
    </div>
  );
}
