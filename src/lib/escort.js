// Faz 8 — refakat akışı (bkz. faz-6-11-prompt.md). Bu depoda hiç karşılığı
// yoktu; kullanıcı onayıyla YENİ alanlar sadece "Planlı Bakım" kategorili
// `state.tasks` kayıtlarının üzerinde: `task.escort = { assignedTo,
// startedAt, endedAt, note, photoUrl, observers }`. Ayrı bir kayıt/çapraz
// referans yok — "refakat kapanınca bağlı bakım da kapanır" kuralı AYNI
// dokümana yazıldığı için otomatik sağlanıyor, iki kaydı senkron tutmaya
// gerek kalmıyor. Bu modül hem yeni mobil ekranda hem masaüstü
// Bakim.jsx'teki mevcut CloseFromCalendarModal'da kullanılıyor (tek kaynak).

export function activeEscort(task) {
  return task?.escort && !task.escort.endedAt ? task.escort : null;
}

// Kullanıcı onayıyla: refakat tamamlanmadan (veya hiç başlamamışken) "Planlı
// Bakım" kaydı sadece Yönetim rolü kapatabilir (gerekçeyle) — bu kural
// masaüstünün ZATEN çalışan kapatma akışına da uygulanıyor.
export function canCloseMaintenanceDirectly(task, viewerRole) {
  if (task.category !== "Planlı Bakım") return true;
  if (task.escort && task.escort.endedAt) return true;
  return viewerRole === "Yönetim";
}

export function startEscort(task, personnelName) {
  return { ...task, escort: { assignedTo: personnelName, startedAt: new Date().toISOString(), observers: [] } };
}

// Refakat tamamlanınca bağlı bakım kaydı da kapanır (spec) — tek patch,
// aynı task üzerinde.
export function completeEscort(task, { note, photoUrl }) {
  const finishedNote = (note || "").trim() || "Not girilmedi";
  return {
    ...task,
    escort: { ...task.escort, endedAt: new Date().toISOString(), note: finishedNote, photoUrl: photoUrl || task.escort.photoUrl },
    status: "Tamamlandı",
    completedAt: new Date().toISOString(),
    completedBy: task.escort.assignedTo,
    resolution: task.resolution || `Refakat: ${task.escort.assignedTo} — ${finishedNote}`,
  };
}

export function addObserver(task, personnelName) {
  const observers = task.escort?.observers || [];
  if (observers.includes(personnelName)) return task;
  return { ...task, escort: { ...task.escort, observers: [...observers, personnelName] } };
}

// Yönetim'in gerekçeyle doğrudan kapatması — refakat hiç başlamamış/bitmemiş
// olsa da.
export function closeWithOverride(task, { closedBy, reason }) {
  return {
    ...task,
    status: "Tamamlandı",
    completedAt: new Date().toISOString(),
    completedBy: closedBy,
    resolution: `Yönetim gerekçesiyle kapatıldı (refakatsiz): ${(reason || "").trim() || "Gerekçe girilmedi"}`,
  };
}
