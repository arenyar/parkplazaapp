import { db } from "../firebase.js";
import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, doc, serverTimestamp } from "firebase/firestore";

const BACKUPS_COLLECTION = "appdata_backups";
const MAX_BACKUPS = 15;

// Kullanıcı teyidiyle: "bundan sonra her deployda versiyon bilgisi olsun.
// yanlış düzenlemelere karşı deploy öncesi versiyona dönebilecek şekilde
// yedek olsun." — App.jsx'teki tek noktada (yeni bir APP_VERSION ilk kez
// canlıya damgalanırken, bkz. App.jsx subscribeState effect'i) o ANDAKİ
// (henüz yeni sürümün dokunmadığı) TAM state burada ayrı bir belgeye
// kopyalanır. Her updateState'te DEĞİL — sadece versiyon başına BİR kere,
// gereksiz depolama/maliyet yaratmadan "bir önceki deploy'un verisi" garanti
// altına alınmış olur. `restoreLiveState` ile Ayarlar > Yedekler'den bu
// belgelerden biri canlı duruma TAMAMEN geri yazılabilir (bkz. firebase.js).
export async function saveVersionBackup(state, fromVersion) {
  try {
    await addDoc(collection(db, BACKUPS_COLLECTION), {
      state,
      fromVersion: fromVersion || null,
      toVersion: state?.appVersion?.latest || null,
      savedAt: serverTimestamp(),
    });
    await pruneOldBackups();
  } catch (err) {
    console.error("Sürüm yedeği kaydedilemedi:", err);
  }
}

export async function listVersionBackups() {
  const q = query(collection(db, BACKUPS_COLLECTION), orderBy("savedAt", "desc"), limit(MAX_BACKUPS));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function pruneOldBackups() {
  const q = query(collection(db, BACKUPS_COLLECTION), orderBy("savedAt", "desc"));
  const snap = await getDocs(q);
  const extra = snap.docs.slice(MAX_BACKUPS);
  await Promise.all(extra.map((d) => deleteDoc(doc(db, BACKUPS_COLLECTION, d.id))));
}
