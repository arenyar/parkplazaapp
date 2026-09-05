// Faz 7 İstatistik sekmesi — spec `userStats/{uid}` altında Cloud Functions
// tetikleyicisiyle güncellenen bir özet belge istiyordu. Bu projede HİÇ
// Cloud Functions yok (tek Firestore dokümanı, tamamen istemci taraflı
// yazma — bkz. firebase.js); yeni bir backend katmanı kurmak "Personel
// rehberi" alt işinin kapsamını fazlasıyla aşar. Bunun yerine AYNI sayıları
// `state.tasks`'tan CANLI hesaplıyoruz — Dashboard.jsx zaten tüm binayı bu
// şekilde (istemci taraflı agregasyon) özetliyor, aynı kalıp.
import { taskHasAssignee, taskIsUnassigned } from "../../lib/taskAssignees.js";

const DAY_MS = 86400000;

function isWithinLastDays(iso, days, now) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= now.getTime() - days * DAY_MS && t <= now.getTime();
}

function avgClosureDays(tasks) {
  const durations = tasks
    .filter((t) => t.completedAt && t.createdAt)
    .map((t) => (new Date(t.completedAt) - new Date(t.createdAt)) / DAY_MS)
    .filter((d) => d >= 0);
  if (durations.length === 0) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

export function computePersonStats(tasks, personName, { days = 30, now = new Date() } = {}) {
  const mine = (tasks || []).filter((t) => taskHasAssignee(t, personName) && !t.archived);
  const completedRecent = mine.filter((t) => t.status === "Tamamlandı" && isWithinLastDays(t.completedAt, days, now));
  const open = mine.filter((t) => t.status === "Yapılacak" || t.status === "Üzr. Çalışılıyor");
  const todayStr = now.toISOString().slice(0, 10);
  const overdue = open.filter((t) => t.dueDate && t.dueDate < todayStr);
  return {
    completedCount: completedRecent.length,
    avgClosureDays: avgClosureDays(completedRecent),
    openCount: open.length,
    overdueCount: overdue.length,
  };
}

export function computeDepartmentAvgClosureDays(tasks, department, { days = 30, now = new Date() } = {}) {
  const deptCompleted = (tasks || []).filter(
    (t) => t.department === department && !t.archived && t.status === "Tamamlandı" && isWithinLastDays(t.completedAt, days, now)
  );
  return avgClosureDays(deptCompleted);
}

export function lastCompletedTask(tasks, personName) {
  const done = (tasks || [])
    .filter((t) => taskHasAssignee(t, personName) && t.status === "Tamamlandı" && t.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  return done[0] || null;
}

// Kişiye atanmış, henüz kapanmamış kayıtlar — "Açık işler" sekmesi.
export function openTasksFor(tasks, personName) {
  return (tasks || []).filter((t) => taskHasAssignee(t, personName) && !t.archived && (t.status === "Yapılacak" || t.status === "Üzr. Çalışılıyor"));
}

// Kullanıcı teyidiyle: "personel ekranında görevler kısmında kategori olsun,
// kendi görevleri 'atanan görevler', ortak görevler, henüz atanmamış havuzda
// bekleyen görevler" — "Açık işler" artık tek düz liste değil, üç kategori:
//  - assigned: kişiye BİREBİR atanmış (openTasksFor ile aynı küme)
//  - teamOthers: aynı departmanda, BAŞKA birine atanmış — "ortak" (ekipte
//    olup biteni görmek için, atama başkasına ait olsa da)
//  - pool: aynı departmanda, HİÇ kimseye atanmamış — havuzda bekleyen,
//    isteyen üstlenebilir
function isOpen(t) { return !t.archived && (t.status === "Yapılacak" || t.status === "Üzr. Çalışılıyor"); }
// Kullanıcı teyidiyle: "aynı işe birden fazla kişi gidebiliyor iş
// emirlerine birden fazla personelde seçilebilsin" — bir görev artık HEM
// bu kişiye (assigned) HEM başka birine (o kişinin kendi "assigned"
// listesinde) birden görünebilir, ikisi birbirini dışlamaz; "teamOthers"
// sadece bu kişiyi İÇERMEYEN ama başka atananı olan işler.
// Kullanıcı teyidiyle: "gps etkisi gibi personel en son hangi katta takip
// edilebilir" — gerçek GPS/konum takibi bu uygulamada YOK (tarayıcı konum
// izni istemek kapsam dışı); bunun yerine dürüst bir vekil: kişinin EN SON
// tamamladığı mahal kontrol kaydının katı + zamanı (state.mahalRuns —
// Güvenlik'in devriye turları da AYNI veri modelini kullanıyor, bkz.
// findings.js'teki floor çözümleme deseniyle birebir aynı). Süre bir eşiği
// aşarsa (varsayılan 2 saat) "stale" işaretlenir — kişi hâlâ o katta mı
// yoksa çoktan ayrılmış mı belli olsun diye, uydurma bir "şu an orada"
// iddiası yapılmaz.
export function lastKnownFloor(state, personName, { staleAfterMinutes = 120, now = new Date() } = {}) {
  const runs = (state.mahalRuns || [])
    .filter((r) => r.completedBy === personName && r.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const latest = runs[0];
  if (!latest) return null;
  const point = (state.mahalPoints || []).find((p) => p.id === latest.pointId);
  const location = point?.locations?.find((l) => l.key === latest.locationKey);
  const floor = location?.floorLabel || point?.floorLabel || null;
  if (!floor) return null;
  const ageMin = (now.getTime() - new Date(latest.completedAt).getTime()) / 60000;
  return { floor, at: latest.completedAt, mahal: location?.label || point?.name || "", stale: ageMin > staleAfterMinutes };
}

// Kullanıcı teyidiyle bulunan hata: "havuzdaki işleri net göremiyorsun...
// tarih yok hangisi yeni iş hangisi eski iş" — üç kategori de artık EN YENİ
// üstte sıralı (createdAt'e göre); Ana Sayfa kartları (bkz. Dashboard.jsx)
// bu sırayı DEĞİŞTİRMEDEN gösterip yanına tarihi de basıyor.
function byNewest(tasks) {
  return [...tasks].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}
export function openTasksByCategory(tasks, person) {
  const deptTasks = (tasks || []).filter((t) => isOpen(t) && t.department === person.department);
  return {
    assigned: byNewest(deptTasks.filter((t) => taskHasAssignee(t, person.name))),
    teamOthers: byNewest(deptTasks.filter((t) => !taskIsUnassigned(t) && !taskHasAssignee(t, person.name))),
    pool: byNewest(deptTasks.filter((t) => taskIsUnassigned(t))),
  };
}
