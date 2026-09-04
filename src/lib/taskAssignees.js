// Kullanıcı teyidiyle: "aynı işe birden fazla kişi gidebiliyor iş
// emirlerine birden fazla personelde seçilebilsin" — task.assignee (tek
// kişi, string) yerine `assignees` (dizi) artık kaynak; `assignee` geriye
// dönük uyumluluk için (RecordCard/DetailScreen gibi tek satır gösteren
// eski ekranlar, ve TEK atananlı eski kayıtlar) assignees'in virgülle
// birleşmiş hali olarak TÜRETİLİR — elle ayrı yazılmaz, tek yerde
// (buildAssigneeFields), iki alan birbirinden sapmaz.
export function buildAssigneeFields(assignees) {
  const list = [...new Set((assignees || []).filter(Boolean))];
  return { assignees: list, assignee: list.join(", ") };
}

// Bir görev şu kişiye mi ait? Yeni çoklu-atama kayıtları `assignees`
// dizisinden, eski tek-atamalı kayıtlar (assignees hiç yoksa) `assignee`
// string'inden kontrol edilir — geriye dönük veri kaybı olmadan.
export function taskHasAssignee(task, personName) {
  if (!personName) return false;
  if (Array.isArray(task.assignees)) return task.assignees.includes(personName);
  return task.assignee === personName;
}

export function taskIsUnassigned(task) {
  if (Array.isArray(task.assignees)) return task.assignees.length === 0;
  return !task.assignee;
}
