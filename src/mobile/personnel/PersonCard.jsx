import { useState } from "react";
import { ArrowLeft, Phone, MessageSquare } from "lucide-react";
import { mobileTokens as t } from "../tokens.js";
import { initials, formatDateOnlyTR } from "../taskDisplay.js";
import { RecordCard } from "../list/RecordCard.jsx";
import { PriorityGroup } from "../list/PriorityGroup.jsx";
import { computePersonStats, computeDepartmentAvgClosureDays, openTasksByCategory, lastKnownFloor } from "./personStats.js";
import { taskHasAssignee } from "../../lib/taskAssignees.js";

const TABS = [{ key: "ozet", label: "Özet" }, { key: "acik", label: "Açık işler" }, { key: "istatistik", label: "İstatistik" }];

function fmtDays(d) {
  if (d == null) return "—";
  if (d < 1) return `${Math.round(d * 24)} sa`;
  return `${d.toFixed(1)} gün`;
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${t.hairline}` }}>
      <p style={{ margin: 0, fontSize: 11.5, color: t.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontSize: 14, color: t.ink }}>{value}</p>
    </div>
  );
}

function Bar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.muted, marginBottom: 4 }}>
        <span>{label}</span><span>{fmtDays(value)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: t.hairline, overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// Sözleşme (bkz. mobil-ui-prompt Faz 7): Özet · Açık işler · İstatistik.
// "Açık işler" YENİ bir kart tipi yazmıyor, Faz 3'ün RecordCard'ını aynen
// kullanıyor (spec'in kendi talimatı). Gizlilik: kişisel telefon ve
// İstatistik sekmesi sadece Yönetim + kişinin kendisine görünür (bkz.
// canSeePrivate) — yetkisiz sekme SEKME OLARAK BİLE GÖSTERİLMEZ (spec:
// "kilitli gösterilmez").
export function PersonCard({ person, currentUser, viewerRole, state, onBack, onOpenTask }) {
  const isSelf = person.id === currentUser?.id;
  const canSeePrivate = isSelf || viewerRole === "Yönetim";
  const availableTabs = TABS.filter((tb) => tb.key !== "istatistik" || canSeePrivate);
  const [tab, setTab] = useState("ozet");
  const activeTab = availableTabs.some((tb) => tb.key === tab) ? tab : "ozet";

  const [openCatGroups, setOpenCatGroups] = useState(() => new Set(["assigned"]));
  function toggleCatGroup(key) {
    setOpenCatGroups((s) => { const next = new Set(s); next.has(key) ? next.delete(key) : next.add(key); return next; });
  }
  const categories = openTasksByCategory(state.tasks, person);
  const lastSeen = lastKnownFloor(state, person.name);
  // Kullanıcı teyidiyle: "personelin üzerindeki işler sıralandığında kırmızı
  // olsun bittiğinde yeşil arka plan olsun" — RecordCard artık task.status'a
  // göre otomatik renkleniyor (bkz. RecordCard.jsx), ama bu ekranda YEŞİL
  // hiç görünmüyordu çünkü sadece açık işler listeleniyordu — son
  // tamamlanan birkaç iş de eklendi (kırmızı+yeşil bir arada görülsün).
  const recentCompleted = (state.tasks || [])
    .filter((t) => taskHasAssignee(t, person.name) && t.status === "Tamamlandı" && t.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, 5);
  const stats = canSeePrivate ? computePersonStats(state.tasks, person.name) : null;
  const deptAvg = canSeePrivate ? computeDepartmentAvgClosureDays(state.tasks, person.department) : null;

  return (
    <div>
      <div style={{ background: t.surface, borderBottom: `1px solid ${t.hairline}`, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <button onClick={onBack} aria-label="Geri" style={{ all: "unset", cursor: "pointer", color: t.ink, display: "flex", width: 32, height: 32, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          {/* Spec: "Fotoğraf yoksa harf avatarı üretilir, jenerik silüet ikonu
              kullanılmaz." Bu depoda hiçbir personelin fotoğrafı yok (users
              kaydında photoURL alanı hiç yok) — harf avatarı her zaman devrede. */}
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: t.pineSoft, color: t.pine, fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {initials(person.name)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: t.ink }}>{person.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: t.muted }}>{person.role} · {person.department}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 12, borderBottom: `1px solid ${t.hairline}`, marginLeft: -12, marginRight: -12, paddingLeft: 12, overflowX: "auto" }}>
          {availableTabs.map((tb) => (
            <button
              key={tb.key} onClick={() => setTab(tb.key)}
              style={{
                all: "unset", cursor: "pointer", padding: "8px 12px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                color: activeTab === tb.key ? t.pine : t.muted, borderBottom: activeTab === tb.key ? `2px solid ${t.pine}` : "2px solid transparent",
              }}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "4px 16px 16px" }}>
        {activeTab === "ozet" && (
          <div>
            <Row label="Görev" value={person.role} />
            <Row label="Departman" value={person.department} />
            <Row label="Son Görülen" value={lastSeen ? `${lastSeen.floor} · ${new Date(lastSeen.at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${lastSeen.stale ? " (bir süre önce)" : ""}` : null} />
            {/* Kişisel telefon — spec: "yalnız Yönetim rolüne görünür, diğer
                roller dahili numarayı görür." Bu depoda tek bir `phone` alanı
                var (ayrı bir dahili-numara alanı yok) — o yüzden yetkisiz
                görüntüleyene HİÇ gösterilmiyor (uydurma bir "dahili" değeri
                göstermek yerine). */}
            {canSeePrivate ? <Row label="Telefon" value={person.phone || "Kayıtlı değil"} /> : null}
            <Row label="E-posta" value={person.email} />
            <Row label="Başlangıç" value={formatDateOnlyTR(person.startDate)} />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <a
                href={person.phone ? `tel:${person.phone}` : undefined}
                aria-disabled={!person.phone}
                style={{
                  flex: 1, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  minHeight: 44, borderRadius: 4, border: `1px solid ${t.pine}`, color: person.phone ? t.pine : t.muted,
                  fontSize: 13.5, fontWeight: 700, pointerEvents: person.phone ? "auto" : "none", opacity: person.phone ? 1 : 0.5,
                }}
              >
                <Phone size={15} aria-hidden="true" /> Ara
              </a>
              <button
                disabled
                title="Bu özellik hazırlanıyor"
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, borderRadius: 4, border: `1px solid ${t.hairline}`, color: t.muted, fontSize: 13.5, fontWeight: 700, background: "none", cursor: "default" }}
              >
                <MessageSquare size={15} aria-hidden="true" /> Mesaj gönder
              </button>
            </div>
          </div>
        )}

        {activeTab === "acik" && (
          <div>
            {categories.assigned.length === 0 && categories.teamOthers.length === 0 && categories.pool.length === 0 ? (
              <p style={{ fontSize: 13, color: t.muted, marginTop: 8 }}>Açık kaydı yok.</p>
            ) : (
              <div style={{ margin: "8px -16px 0" }}>
                <PriorityGroup label="Atanan Görevler" count={categories.assigned.length} color={t.pine} bg={t.pineSoft}
                  open={openCatGroups.has("assigned")} onToggle={() => toggleCatGroup("assigned")}>
                  <div style={{ background: t.surface, borderTop: `1px solid ${t.hairline}` }}>
                    {categories.assigned.length === 0
                      ? <p style={{ fontSize: 12.5, color: t.muted, padding: "10px 16px", margin: 0 }}>Bu kategoride kayıt yok.</p>
                      : categories.assigned.map((task) => <RecordCard key={task.id} task={task} onOpen={onOpenTask} />)}
                  </div>
                </PriorityGroup>
                <PriorityGroup label="Ortak Görevler" count={categories.teamOthers.length} color={t.amber} bg={t.amberSoft}
                  open={openCatGroups.has("teamOthers")} onToggle={() => toggleCatGroup("teamOthers")}>
                  <div style={{ background: t.surface, borderTop: `1px solid ${t.hairline}` }}>
                    {categories.teamOthers.length === 0
                      ? <p style={{ fontSize: 12.5, color: t.muted, padding: "10px 16px", margin: 0 }}>Bu kategoride kayıt yok.</p>
                      : categories.teamOthers.map((task) => <RecordCard key={task.id} task={task} onOpen={onOpenTask} />)}
                  </div>
                </PriorityGroup>
                <PriorityGroup label="Havuzda Bekleyen Görevler" count={categories.pool.length} color={t.kiremit} bg={t.kiremitSoft}
                  open={openCatGroups.has("pool")} onToggle={() => toggleCatGroup("pool")}>
                  <div style={{ background: t.surface, borderTop: `1px solid ${t.hairline}` }}>
                    {categories.pool.length === 0
                      ? <p style={{ fontSize: 12.5, color: t.muted, padding: "10px 16px", margin: 0 }}>Bu kategoride kayıt yok.</p>
                      : categories.pool.map((task) => <RecordCard key={task.id} task={task} onOpen={onOpenTask} />)}
                  </div>
                </PriorityGroup>
              </div>
            )}
            {recentCompleted.length > 0 && (
              <div style={{ margin: "16px -16px 0" }}>
                <PriorityGroup label="Son Tamamlanan İşler" count={recentCompleted.length} color={t.ok} bg="rgba(78,138,70,0.10)"
                  open={openCatGroups.has("completed")} onToggle={() => toggleCatGroup("completed")}>
                  <div style={{ background: t.surface, borderTop: `1px solid ${t.hairline}` }}>
                    {recentCompleted.map((task) => <RecordCard key={task.id} task={task} onOpen={onOpenTask} />)}
                  </div>
                </PriorityGroup>
              </div>
            )}
          </div>
        )}

        {activeTab === "istatistik" && canSeePrivate && stats && (
          <div>
            <p style={{ margin: "8px 0 14px", fontSize: 12, color: t.muted }}>Son 30 gün</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              <div style={{ background: t.surface, border: `1px solid ${t.hairline}`, borderRadius: 4, padding: "12px 14px" }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.ok }}>{stats.completedCount}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: t.muted }}>Tamamlanan</p>
              </div>
              <div style={{ background: t.surface, border: `1px solid ${t.hairline}`, borderRadius: 4, padding: "12px 14px" }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.pine }}>{stats.openCount}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: t.muted }}>Açık{stats.overdueCount > 0 ? ` · ${stats.overdueCount} gecikmiş` : ""}</p>
              </div>
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 11.5, color: t.muted, textTransform: "uppercase", letterSpacing: 0.3 }}>Ortalama kapanış süresi</p>
            <Bar label={person.name.split(" ")[0]} value={stats.avgClosureDays ?? 0} max={Math.max(stats.avgClosureDays || 0, deptAvg || 0, 1)} color={t.pine} />
            <Bar label={`${person.department} ortalaması`} value={deptAvg ?? 0} max={Math.max(stats.avgClosureDays || 0, deptAvg || 0, 1)} color={t.muted} />
            {stats.avgClosureDays == null && <p style={{ fontSize: 12.5, color: t.muted, marginTop: 4 }}>Son 30 günde kapanan kaydı yok.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
