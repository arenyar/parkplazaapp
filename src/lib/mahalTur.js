import { getLocations } from "../pages/MahalKontrol.jsx";

// Faz 12 — "Tur" bir oturumda birden çok mahalın gezilmesi (ilerleme sayacı,
// yarım kalanın devamı, aynı mahalin ikinci kez okutulması uyarısı). mahalRuns
// (tekil nokta+periyot doldurma, bkz. MahalKontrol.jsx) DEĞİŞMEDEN kullanılır
// — tur sadece "bu oturumda hangi mahaller planlandı/gezildi"yi izler,
// checklist cevaplarını KENDİSİ taşımaz (facility-ops-schema ilkesi: aynı
// veriyi iki yerde tutma, referansla).

export function turKey(pointId, locationKey, shiftId) {
  return `${pointId}::${locationKey || ""}::${shiftId || ""}`;
}

// Bir noktanın (ve varsa tüm konum/vardiya kombinasyonlarının) plan
// anahtarlarını üretir — perFloor noktalarda her GERÇEK konum (bkz.
// getLocations, Kat Planı'ndan türeyebilir) ayrı bir anahtar.
function planKeysForPoints(points, state) {
  const keys = [];
  points.forEach((p) => {
    const shiftList = p.shifts && p.shifts.length > 0 ? p.shifts : [null];
    if (p.perFloor) {
      getLocations(p, state).forEach((loc) => {
        shiftList.forEach((shift) => keys.push({ key: turKey(p.id, loc.key, shift?.id), pointId: p.id, locationKey: loc.key, shiftId: shift?.id || null, label: `${p.name} — ${loc.label}` }));
      });
    } else {
      shiftList.forEach((shift) => keys.push({ key: turKey(p.id, null, shift?.id), pointId: p.id, locationKey: null, shiftId: shift?.id || null, label: p.name }));
    }
  });
  return keys;
}

// period=null → "Serbest kontrol": planlı liste yok (plannedPointKeys boş),
// ilerleme sayacı yerine sadece "kaç mahal gezildi" gösterilir.
export function buildTurPlan(state, department, period) {
  const points = state.mahalPoints.filter((p) => p.department === department && !p.archived && p.active !== false && (period ? p.period === period : true));
  return planKeysForPoints(points, state);
}

// Faz 13 — tek bir noktanın (ör. "guv_tur" kat devriyesi) SIRALI plan
// listesi. getLocations'ın döndürdüğü sıra (kat kat, Beşiktaş→Sarıyer)
// korunur — "sıra" kavramı bu sıralamadır, ayrı bir alan uydurulmadı.
export function buildTurPlanForPoint(state, pointId) {
  const point = state.mahalPoints.find((p) => p.id === pointId);
  if (!point) return [];
  return planKeysForPoints([point], state);
}

export function findActiveTur(state, department, inspector) {
  return (state.mahalTurRuns || []).find((t) => t.department === department && t.inspector === inspector && t.status === "Devam ediyor") || null;
}

// Faz 13 — sıralı devriye turlarında (guv_tur) tolerans hesaplaması için
// sabit varsayılan (kullanıcı teyidiyle: admin alanı değil, sabit değer).
export const PATROL_ESTIMATED_MINUTES = 60;
export const PATROL_TOLERANCE_MINUTES = 15;

// ordered:true + pointId verilirse (Faz 13 "Sıralı Kat Devriyesi") plan tek
// bir noktanın SIRALI konum listesinden kurulur; aksi halde eskisi gibi
// (Faz 12) department+period bazlı, sırasız bir küme.
export function startTurPatch(state, { department, inspector, period, scopeLabel, ordered = false, pointId = null }) {
  const plan = pointId ? buildTurPlanForPoint(state, pointId) : period ? buildTurPlan(state, department, period) : [];
  const tur = {
    id: `tur_${Date.now()}`,
    department, inspector, period: period || null, scopeLabel,
    status: "Devam ediyor",
    startedAt: new Date().toISOString(),
    closedAt: null,
    ordered,
    plannedPointKeys: plan.map((k) => k.key),
    visitedPointKeys: [],
    skippedPointKeys: [],
    late: false,
  };
  return { mahalTurRuns: [...(state.mahalTurRuns || []), tur], tur };
}

export function markVisitedPatch(state, tur, key) {
  if (tur.visitedPointKeys.includes(key)) return {};
  const mahalTurRuns = (state.mahalTurRuns || []).map((t) => (t.id === tur.id ? { ...t, visitedPointKeys: [...t.visitedPointKeys, key] } : t));
  return { mahalTurRuns };
}

// Faz 13 — sıralı bir turda beklenen bir sonraki nokta: plannedPointKeys
// içinde henüz ne ziyaret edilmiş ne atlanmış olarak işaretlenen İLK anahtar.
export function nextExpectedIndex(tur) {
  const done = new Set([...(tur.visitedPointKeys || []), ...(tur.skippedPointKeys || [])]);
  return (tur.plannedPointKeys || []).findIndex((k) => !done.has(k));
}

// Kullanıcı sıradaki noktadan daha ilerideki bir noktayı seçerse aradaki
// noktalar "atlandı" olarak işaretlenir (kullanıcı teyidiyle: "atlama
// engellenmez, kayda geçer" — sessizce geçilmez, ayrı bir liste tutulur).
export function markSkippedPatch(state, tur, keys) {
  const toAdd = keys.filter((k) => !tur.skippedPointKeys.includes(k) && !tur.visitedPointKeys.includes(k));
  if (toAdd.length === 0) return {};
  const mahalTurRuns = (state.mahalTurRuns || []).map((t) => (t.id === tur.id ? { ...t, skippedPointKeys: [...t.skippedPointKeys, ...toAdd] } : t));
  return { mahalTurRuns };
}

export function closeTurPatch(state, tur) {
  const startedAt = new Date(tur.startedAt);
  const elapsedMin = (Date.now() - startedAt.getTime()) / 60000;
  // "Gecikmiş" işareti sadece sıralı (devriye) turlarda anlamlı — Faz 12'nin
  // sırasız/serbest kontrol turlarında bir "tahmini süre" beklentisi yok.
  const late = tur.ordered && elapsedMin > PATROL_ESTIMATED_MINUTES + PATROL_TOLERANCE_MINUTES;
  const mahalTurRuns = (state.mahalTurRuns || []).map((t) => (t.id === tur.id ? { ...t, status: "Tamamlandı", closedAt: new Date().toISOString(), late } : t));
  return { mahalTurRuns, late };
}

// Bitir ekranı özeti — hangi ziyaret edilen anahtarların uygunsuz çıktığı
// mahalRuns'taki failedQuestions'a bakılarak hesaplanır (ayrı bir sayaç
// tutulmuyor, tek kaynak mahalRuns).
export function turSummary(state, tur) {
  const visited = tur.visitedPointKeys.length;
  const planned = tur.plannedPointKeys.length; // 0 → serbest kontrol, sınır yok
  const skipped = (tur.skippedPointKeys || []).length;
  let uygun = 0;
  let arizali = 0;
  tur.visitedPointKeys.forEach((key) => {
    const [pointId, locationKey] = key.split("::");
    const run = state.mahalRuns.find((r) => r.pointId === pointId && (r.locationKey || "") === locationKey && r.status === "Tamamlandı");
    if (run && (run.failedQuestions || []).length > 0) arizali += 1;
    else uygun += 1;
  });
  const startedAt = new Date(tur.startedAt);
  const endedAt = tur.closedAt ? new Date(tur.closedAt) : new Date();
  const durationMin = Math.max(0, Math.round((endedAt - startedAt) / 60000));
  return { visited, planned, skipped, uygun, arizali, durationMin };
}

// Yönetim için: departmanda uzun süredir açık kalmış (vardiya bitmiş olabilir)
// turlar — gerçek bir bildirim/push sistemi yok (bkz. profil tercihleri
// notu), bu yüzden burada sadece görünürlük sağlanır: Mahal Kontrol ekranını
// açan bir yönetici bunu görür.
export function staleOpenTurs(state, department, hoursThreshold = 10) {
  const cutoff = Date.now() - hoursThreshold * 3600 * 1000;
  return (state.mahalTurRuns || []).filter((t) => t.department === department && t.status === "Devam ediyor" && new Date(t.startedAt).getTime() < cutoff);
}
