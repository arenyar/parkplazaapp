import { useEffect, useRef } from "react";
import { taskHasAssignee, taskIsUnassigned } from "./taskAssignees.js";
import { playPoolSound, playAssignedSound } from "./notifySound.js";
import { isNativeApp } from "./platform.js";

function isOpenTask(t) { return !t.archived && t.status !== "Tamamlandı" && t.status !== "İptal"; }

// Kullanıcı teyidiyle: "havuza göre düşünde ses kendine iş atanınca farklı
// bir ses" — SADECE Android uygulaması açıkken (foreground) çalışır, telefon
// kilitliyken/uygulama kapalıyken ÇALMAZ (gerçek push bildirimi ayrı, daha
// büyük bir altyapı kararı — bkz. notifySound.js'teki not). İlk render'da
// (henüz bir "önceki" anlık görüntü yokken) SES ÇALINMAZ — yoksa uygulama her
// açılışta o an havuzda/üzerinde bekleyen TÜM işler için art arda çalardı;
// sadece bu oturumda GERÇEKTEN YENİ ortaya çıkan değişiklikler tetikler.
export function useTaskAlertSounds(tasks, currentUser) {
  const prevRef = useRef(null);
  useEffect(() => {
    if (!isNativeApp() || !currentUser) { prevRef.current = null; return; }
    const dept = currentUser.department;
    const name = currentUser.name;
    const snapshot = new Map();
    let newAssigned = false;
    let newPool = false;
    (tasks || []).forEach((t) => {
      if (!isOpenTask(t)) return;
      const assignedToMe = taskHasAssignee(t, name);
      const isPoolForMyDept = t.department === dept && taskIsUnassigned(t);
      snapshot.set(t.id, { assignedToMe, isPoolForMyDept });
      if (prevRef.current) {
        const prev = prevRef.current.get(t.id);
        if (assignedToMe && !prev?.assignedToMe) newAssigned = true;
        if (isPoolForMyDept && !prev?.isPoolForMyDept) newPool = true;
      }
    });
    // Kişiye özel atama, genel havuz bildiriminden ÖNCELİKLİ — ikisi aynı
    // anda olsa (nadiren) tek ses çalınır, iki ses üst üste binmesin diye.
    if (prevRef.current) {
      if (newAssigned) playAssignedSound();
      else if (newPool) playPoolSound();
    }
    prevRef.current = snapshot;
  }, [tasks, currentUser]);
}
