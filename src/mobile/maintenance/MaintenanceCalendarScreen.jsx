import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { RecordCard } from "../list/RecordCard.jsx";

const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const WEEKDAYS_TR = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];

function toDateOnly(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
// Yerel Y/M/G bileşenlerinden DOĞRUDAN "YYYY-MM-DD" kurar. `d.toISOString()`
// UTC'ye çevirir — UTC'nin ÖNÜNDEKİ saat dilimlerinde (ör. İstanbul, UTC+3)
// yerel gece yarısı UTC'de bir önceki günün akşamına denk gelir, `.slice(0,10)`
// bu yüzden bir gün GERİ kayardı (30'a dokunup "29" hücresinin görevlerini
// görmek gibi — sadece görüntü değil, hangi günün task'larının eşleştiği de
// kayardı). Bu, hem hücre anahtarı hem "bugün" karşılaştırması için kullanılıyor.
function isoDay(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
// "YYYY-MM-DD" → yerel Date (gösterim için, bkz. yukarıdaki not).
function isoDayToLocalDate(isoStr) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Bir günün baskın rengi: gecikmiş varsa kiremit, bugünse ve iş varsa amber,
// hepsi tamamlandıysa yeşil, yoksa planlı (pine). Spec: "planlı / bugün /
// gecikmiş / tamamlandı".
function dayColor(tasksOfDay, dateStr, todayStr) {
  if (tasksOfDay.length === 0) return null;
  const hasOverdue = tasksOfDay.some((tk) => tk.status !== "Tamamlandı" && dateStr < todayStr);
  if (hasOverdue) return t.kiremit;
  if (dateStr === todayStr) return t.amber;
  if (tasksOfDay.every((tk) => tk.status === "Tamamlandı")) return t.ok;
  return t.pine;
}

function SectionList({ title, items, emptyText, onOpenTask }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ padding: "12px 16px 6px", fontSize: 11.5, fontWeight: 700, color: t.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>{title}</div>
      {items.length === 0 && <p style={{ margin: 0, padding: "0 16px 12px", fontSize: 12.5, color: t.muted }}>{emptyText}</p>}
      {items.map((tk) => <RecordCard key={tk.id} task={tk} onOpen={onOpenTask} />)}
    </div>
  );
}

// Sözleşme (bkz. faz-6-11-prompt.md Faz 8): varsayılan içinde bulunulan ay,
// gün hücresinde sayı+durum rengi, güne dokununca alt sayfada o günün
// listesi, ay üstünde Planlı/Tamamlandı/Gecikmiş özeti. Gerçek veride
// bakımın gün-hassasiyetli tek karşılığı `state.tasks` (category "Planlı
// Bakım") — `dueDate` üzerinden gruplanıyor, yeni bir alan gerekmedi.
//
// Kullanıcı teyidiyle: "bakımlar takvimdeki bugün üzerinde dursun... takvim
// altında yapılan bakım detayı gelsin ay sonunda yapılmayan bakımlar altına
// listelensin" — artık takvimin ALTINDA, dokunmadan görünen üç bölüm var:
// Bugün (o günün bakımları, ayrı bir sayfa açmadan), Yapılan Bakımlar (bu
// ay tamamlanan), Yapılmayan Bakımlar (bu ay hâlâ açık). Güne dokununca
// açılan alt sayfa (başka bir günü incelemek için) AYNEN duruyor.
export function MaintenanceCalendarScreen({ tasks, onOpenTask }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState(null);

  const todayStr = isoDay(toDateOnly(new Date()));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const viewingCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth();

  const monthTasks = useMemo(
    () => (tasks || []).filter((tk) => tk.category === "Planlı Bakım" && !tk.archived && tk.dueDate && new Date(tk.dueDate).getFullYear() === year && new Date(tk.dueDate).getMonth() === month),
    [tasks, year, month]
  );
  const byDay = useMemo(() => {
    const map = new Map();
    monthTasks.forEach((tk) => { const k = tk.dueDate; if (!map.has(k)) map.set(k, []); map.get(k).push(tk); });
    return map;
  }, [monthTasks]);

  const summary = {
    planned: monthTasks.filter((tk) => tk.status !== "Tamamlandı" && tk.dueDate >= todayStr).length,
    done: monthTasks.filter((tk) => tk.status === "Tamamlandı").length,
    overdue: monthTasks.filter((tk) => tk.status !== "Tamamlandı" && tk.dueDate < todayStr).length,
  };

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadBlanks = (firstOfMonth.getDay() + 6) % 7; // Pazartesi başlangıçlı
  const cells = [...Array(leadBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function changeMonth(delta) { setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1)); setSelectedDay(null); }

  const selectedTasks = selectedDay ? (byDay.get(selectedDay) || []) : [];
  const todayItems = viewingCurrentMonth ? (byDay.get(todayStr) || []) : [];
  const doneThisMonth = monthTasks.filter((tk) => tk.status === "Tamamlandı");
  const notDoneThisMonth = monthTasks.filter((tk) => tk.status !== "Tamamlandı");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: t.surface, borderBottom: `1px solid ${t.hairline}` }}>
        <button onClick={() => changeMonth(-1)} aria-label="Önceki ay" style={{ all: "unset", cursor: "pointer", color: t.ink, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><ChevronLeft size={20} aria-hidden="true" /></button>
        <span style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>{MONTHS_TR[month]} {year}</span>
        <button onClick={() => changeMonth(1)} aria-label="Sonraki ay" style={{ all: "unset", cursor: "pointer", color: t.ink, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><ChevronRight size={20} aria-hidden="true" /></button>
      </div>
      <p style={{ margin: 0, padding: "8px 16px", fontSize: 12.5, color: t.muted, background: t.surface, borderBottom: `1px solid ${t.hairline}` }}>
        Planlı: {summary.planned} · Tamamlandı: {summary.done} · Gecikmiş: {summary.overdue}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, padding: 12, background: t.surface }}>
        {WEEKDAYS_TR.map((w) => <div key={w} style={{ textAlign: "center", fontSize: 10.5, color: t.muted, fontWeight: 700 }}>{w}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`b${i}`} />;
          const dateStr = isoDay(new Date(year, month, day));
          const items = byDay.get(dateStr) || [];
          const color = dayColor(items, dateStr, todayStr);
          const allDone = items.length > 0 && items.every((tk) => tk.status === "Tamamlandı");
          return (
            <button
              key={dateStr}
              onClick={() => items.length > 0 && setSelectedDay(dateStr)}
              style={{
                all: "unset", boxSizing: "border-box", cursor: items.length > 0 ? "pointer" : "default", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 2, aspectRatio: "1", borderRadius: 4,
                background: dateStr === todayStr ? t.pineSoft : "transparent", minHeight: 44,
                border: dateStr === todayStr ? `1px solid ${t.pine}` : "1px solid transparent",
              }}
            >
              <span style={{ fontSize: 12.5, color: t.ink, fontWeight: dateStr === todayStr ? 700 : 400 }}>{day}</span>
              {items.length > 0 && (
                // Kullanıcı teyidiyle: "bakım ne zaman kapanırsa takvimde tik
                // işareti olsun" — gündeki TÜM bakımlar tamamlandıysa sayı
                // yerine ✓ ikonu (rengi hâlâ aynı yeşil, sadece ikon değişti).
                <span style={{ width: 16, height: 16, borderRadius: "50%", background: color, color: "#fff", fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {allDone ? <Check size={11} strokeWidth={3} /> : items.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {viewingCurrentMonth && (
        <div style={{ borderTop: `6px solid ${t.hairline}` }}>
          <SectionList title={`Bugün — ${isoDayToLocalDate(todayStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "long" })}`}
            items={todayItems} emptyText="Bugün için planlı bakım yok." onOpenTask={onOpenTask} />
        </div>
      )}

      <div style={{ borderTop: `6px solid ${t.hairline}` }}>
        <SectionList title="Bu Ay Yapılan Bakımlar" items={doneThisMonth} emptyText="Bu ay henüz tamamlanan bakım yok." onOpenTask={onOpenTask} />
      </div>
      <div style={{ borderTop: `6px solid ${t.hairline}`, paddingBottom: 8 }}>
        <SectionList title="Bu Ay Yapılmayan Bakımlar" items={notDoneThisMonth} emptyText="Bu ay için bekleyen bakım kalmadı." onOpenTask={onOpenTask} />
      </div>

      {selectedDay && (
        <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", alignItems: "flex-end" }} role="dialog" aria-modal="true" aria-label="Günün bakımları">
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,49,40,0.45)" }} onClick={() => setSelectedDay(null)} />
          <div style={{ position: "relative", width: "100%", maxWidth: 480, margin: "0 auto", maxHeight: "70vh", overflowY: "auto", background: t.surface, borderRadius: "16px 16px 0 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${t.hairline}`, position: "sticky", top: 0, background: t.surface }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.ink }}>{isoDayToLocalDate(selectedDay).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}</p>
              <button onClick={() => setSelectedDay(null)} aria-label="Kapat" style={{ all: "unset", cursor: "pointer", color: t.muted, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><X size={20} aria-hidden="true" /></button>
            </div>
            {selectedTasks.map((tk) => <RecordCard key={tk.id} task={tk} onOpen={(task) => { setSelectedDay(null); onOpenTask(task); }} />)}
          </div>
        </div>
      )}
    </div>
  );
}
