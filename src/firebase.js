import { initializeApp, deleteApp } from "firebase/app";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updatePassword, createUserWithEmailAndPassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { showToast } from "./lib/toast.js";

// Kullanıcı teyidiyle: "yine aynı klasörde firebase bağlantısını yap" —
// mevcut, zaten kurulu Firebase projesi (parkplaza-451fa) yeniden kullanılıyor
// (C:\Users\parkp\Desktop\firebase-project\src\firebase.js ile AYNI config).
// Yeni bir proje oluşturmaya gerek yok. Bu değerler Firebase'in kendi
// tasarımı gereği "gizli" DEĞİL (istemci koduna gömülmesi normal, herkes
// tarayıcıda görebilir) — gerçek güvenlik sınırı firestore.rules'ta
// (request.auth != null). Yine de Netlify ortam değişkenlerinden
// okunabiliyor olması ileride ayrı bir staging/prod Firebase projesi
// kullanmak istenirse kod değişikliği gerektirmesin diye — .env yoksa (ör.
// yerel geliştirme) aşağıdaki sabit değerlere düşer, davranış değişmez.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBaG2wpFyFwri-q-LVjkdeYvvrSqJGYmis",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "parkplaza-451fa.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "parkplaza-451fa",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "parkplaza-451fa.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1090412135182",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1090412135182:web:b29be46645844b295e0d5f",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-NSE6DMNYRJ",
};

export const app = initializeApp(firebaseConfig);
// Kullanıcı teyidiyle: "telefon çekmeyen yerlerde offline çalışır telefon
// çekince update yapar" — Firestore'un kendi kalıcı (IndexedDB) önbelleği
// AÇILDI. Öncesinde db bellekte tutuluyordu: sinyal kesilince onSnapshot
// hiç veri vermiyordu (ekran boş/donmuş kalırdı) ve o sırada yapılan
// setDoc çağrıları anında "unavailable" ile reddediliyordu (bkz. saveState,
// draftQueue.js'in ELLE yeniden deneme kuyruğu bu yüzden vardı). Artık:
// - Sayfa açılışında/offline'ken en son senkron olmuş veri diskten hemen
//   gösterilir (subscribeState'teki fromCache artık gerçek anlamını taşıyor).
// - Offline'ken yapılan yazmalar SDK tarafından yerelde kuyruğa alınır,
//   setDoc'un Promise'i reddetmez; sinyal dönünce OTOMATİK gönderilir —
//   draftQueue.js'in elle kuyruğu artık bir güvenlik ağı, birincil yol değil.
// persistentMultipleTabManager: aynı tarayıcıda birden fazla sekme/pencere
// (ör. masaüstü + mobil önizleme) AYNI diskteki önbelleği güvenle paylaşır.
// IndexedDB desteklenmeyen bir ortamda initializeFirestore reddedilirse
// (çok nadir — ör. bazı eski private-browsing modları) belleğe düşer,
// uygulama önceki (kalıcılıksız) davranışıyla çalışmaya devam eder.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (err) {
  console.error("Firestore kalıcı önbellek açılamadı, bellek-içi moda düşülüyor:", err);
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;
export const auth = getAuth(app);

// Kullanıcı teyidiyle bulunan sorun: "veritabanı tamamen açık... database
// güvenliğini uçtan uca kontrol etmelisin" — giriş artık gerçek Firebase
// Authentication üzerinden (bkz. Login.jsx, App.jsx). authListen App.jsx'teki
// tek kimlik doğrulama dinleyicisi; oturum açık/kapalı her değiştiğinde
// çağrılır (Firebase Auth'un varsayılan kalıcılığıyla sayfa yenilemede de
// korunur — eskiden her yenilemede yeniden giriş gerekiyordu).
export function authListen(onChange) {
  return onAuthStateChanged(auth, onChange);
}
export function login(email, password) { return signInWithEmailAndPassword(auth, email, password); }
export function logout() { return signOut(auth); }
export function resetPasswordEmail(email) { return sendPasswordResetEmail(auth, email); }
// Oturumdaki kullanıcının KENDİ şifresini değiştirmesi — Firebase Auth
// istemci SDK'sı başka bir kullanıcının şifresini doğrudan belirlemeye izin
// vermez (bkz. plan: Ayarlar.jsx/Yonetim.jsx artık bunun yerine
// resetPasswordEmail kullanıyor, sadece bu kendi-şifreni-değiştir akışı
// updatePassword'ü kullanır).
// Faz 15 — kullanıcı teyidiyle: "Şifre değiştirmede reauthenticateWithCredential
// zorunlu... Mevcut şifre sorulmadan değişiklik yapılmaz." Önceki sürüm
// doğrudan updatePassword çağırıyordu; Firebase Auth bunu oturum "taze"
// değilse zaten `auth/requires-recent-login` ile reddediyordu ama akış
// kullanıcıya MEVCUT şifreyi hiç sormuyordu — şimdi her zaman önce mevcut
// şifreyle yeniden kimlik doğrulanıyor (yanlışsa updatePassword'e hiç
// gidilmiyor, `auth/wrong-password` PasswordChangeForm'da yakalanır).
export async function changeOwnPassword(currentPassword, newPassword) {
  const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
  await reauthenticateWithCredential(auth.currentUser, cred);
  return updatePassword(auth.currentUser, newPassword);
}

// Yönetim > "Kullanıcı Aç" — admin başka biri için hesap açarken KENDİ
// oturumundan atılmasın diye (createUserWithEmailAndPassword ana `auth`
// üzerinde çağrılırsa istemci SDK'sı otomatik olarak o YENİ kullanıcıyla
// giriş yapar) geçici, ikincil bir Firebase App örneği kullanılır — sadece bu
// tek işlem için, hemen ardından silinir. Admin'in kendi oturumu (ana `auth`)
// hiç etkilenmez.
export async function createAuthAccount(email, password) {
  const secondary = initializeApp(firebaseConfig, `secondary_${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    await createUserWithEmailAndPassword(secondaryAuth, email, password);
  } finally {
    await deleteApp(secondary);
  }
}

// Aynı projedeki eski/basit sürüm (C:\...\firebase-project) verisini
// "appdata" koleksiyonunda "tanimlar"/"records"/"bakimMarks" gibi anahtarlarla
// tutuyor — bu uygulama AYNI koleksiyonu, ÇAKIŞMAYACAK tek bir anahtarla
// kullanıyor. Bu belge artık (appdata/parkplaza-ops-center-state) SADECE
// giriş yapmış kullanıcılara açık (request.auth != null) — kardeş
// uygulamanın diğer belgeleri hâlâ eski açık kuralla çalışıyor, bkz.
// firestore.rules'taki belge-özel istisna. Canlı kural doğrudan test
// edilerek doğrulandı (yetkisiz istemci "permission-denied" alıyor).
const STATE_DOC = doc(db, "appdata", "parkplaza-ops-center-state");

// Tüm uygulama state'i TEK bir doküman olarak tutulur (mevcut src/mockData.js
// makeInitialState() şeklinin birebir aynısı) — App.jsx'teki updateState zaten
// tek bir state objesini shallow-merge ettiği için, kod tarafında başka bir
// değişikliğe gerek kalmadan bu tek dokümanı okuyup yazmak yeterli.
//
// includeMetadataChanges:true + snap.metadata.fromCache — playbook talimatı:
// "son senkronizasyon zamanı ve bağlantı durumu" göstermek için (bkz.
// App.jsx/TopBar.jsx). fromCache=true demek: bu veri sunucudan değil yerel
// önbellekten geliyor (çevrimdışı ya da henüz senkronize olmadı); false
// demek: sunucudan doğrulanmış, gerçek "son senkron" anı budur.
// Dinleme hatası da (sadece yazma değil) kullanıcıya bildirilir — playbook
// talimatı "sessiz veri kaybı olmamalı" yazma kadar okuma için de geçerli:
// ör. oturum süresi dolmuş/başka bir cihazda şifre değiştirilmiş bir
// istemci, ekranda ESKİ veriyi göstermeye devam edip hiçbir güncelleme
// almadığını fark etmeden çalışabilirdi.
export function subscribeState(onData, onError) {
  return onSnapshot(STATE_DOC, { includeMetadataChanges: true }, (snap) => {
    onData(snap.exists() ? snap.data() : null, { fromCache: snap.metadata.fromCache });
  }, (err) => {
    console.error("Firestore dinleme hatası:", err);
    showToast(err.code === "permission-denied" ? "Oturumunuz geçersiz olmuş olabilir — sayfayı yenileyip tekrar giriş yapmayı deneyin." : "Canlı veri bağlantısı kesildi — sayfayı yenileyin.", "error");
    if (onError) onError(err);
  });
}

export async function fetchState() {
  const snap = await getDoc(STATE_DOC);
  return snap.exists() ? snap.data() : null;
}

// piramitData.js gibi bazı yerlerde "bu alan bu kat tipinde geçerli değil"
// anlamında bilinçli olarak `undefined` kullanılıyor (JS'te geçerli, React
// için sorun değil) — ama Firestore setDoc() `undefined` değerli alanları
// reddediyor. Kaydetmeden önce JSON round-trip ile bu alanları temizliyoruz
// (JSON.stringify undefined değerli anahtarları zaten otomatik atlar).
function stripUndefined(value) {
  return JSON.parse(JSON.stringify(value));
}

// Kullanıcı teyidiyle bulunan hata: "kiracı eklediğimde kat planında daha
// sonra yeniden girdiğimde veri kayboluyor" — sebep: bu fonksiyon her
// updateState çağrısında TÜM state'i (App.jsx'teki `next`, yani o anki yerel
// state + değişiklik) tek dokümana setDoc ile TAMAMEN üzerine yazıyordu. Aynı
// anda başka bir sekme/cihaz (ör. sahada bir Mahal Kontrol dolduran mobil
// kullanıcı) kendi eski yerel state'ine dayanarak yazınca, o yazma araya
// girip henüz kendi ekranına ulaşmamış (ör. Kat Planı'na az önce eklenen
// kiracı) değişikliği geri alıyordu — "son yazan kazanır, TÜM doküman"
// modeli. Artık her updateState çağrısı SADECE değişen üst seviye alan(lar)ı
// ({ merge: true }) yazıyor — App.jsx artık `next` yerine ham `patch`
// gönderiyor. Böylece aynı anda farklı alanlara (ör. biri companies, biri
// mahalRuns) yazan iki istemci birbirini ezmez; sadece AYNI alana gerçekten
// aynı anda yazılırsa (nadir) o alan için hâlâ son yazan kazanır.
// Playbook talimatı: "Veri yazma hatalarında kullanıcı girdisini koru ve
// yeniden dene imkânı sun... sessiz veri kaybı olmamalı." Önceden hata
// sadece console.error'a düşüyordu — ekranda hiçbir iz bırakmıyordu, kullanıcı
// değişikliğin kaydedildiğini sanıyordu (yerel state zaten iyimser
// güncellendiği için). Artık başarısız yazma toast ile bildiriliyor; yerel
// React state (ekrandaki değer) hâlâ duruyor, kullanıcı sayfayı kapatmadığı
// sürece veri kaybolmuyor, tekrar bir işlem yaparak (ör. formu tekrar
// kaydet) yeniden deneyebilir.
// Kullanıcı teyidiyle bulunan sorun: "güvenlik devriyede hata veriyor...
// bu ve buna benzer hataları kontrol et" — bu fonksiyon TÜM yazma
// hatalarında (asıl sebep ne olursa olsun: geçersiz oturum, ağ kopukluğu,
// Firestore kotası...) AYNI "bağlantınızı kontrol edin" mesajını
// gösteriyordu. Bu yanıltıcıydı: bu oturumda birden fazla kez gerçek sebep
// bağlantı değil, oturumun (Firebase Auth token'ının) geçersiz/bayat
// olmasıydı (ör. şifre başka bir cihazda değiştirildiğinde) — kullanıcı
// WiFi'ını kontrol edip zaman kaybediyordu, oysa çözüm sayfayı yenileyip
// yeniden giriş yapmaktı. subscribeState'teki (okuma/dinleme) hata
// mesajıyla AYNI ayrım burada da (yazma) uygulanıyor.
function saveErrorMessage(code) {
  if (code === "permission-denied") return "Kaydedilemedi — oturumunuz geçersiz olmuş olabilir. Sayfayı yenileyip tekrar giriş yapmayı deneyin. Değişiklik ekranda duruyor, kaybolmadı.";
  if (code === "unavailable" || code === "deadline-exceeded") return "Kaydedilemedi — bağlantınızı kontrol edin. Değişiklik ekranda duruyor ama sunucuya iletilemedi, tekrar deneyin.";
  return "Kaydedilemedi — beklenmeyen bir hata oluştu. Değişiklik ekranda duruyor, sayfayı yenilemeden tekrar deneyin.";
}
// Dönüş değeri (true/false) — Faz 1b çevrimdışı kuyruğu (bkz.
// src/mobile/offline/draftQueue.js) yazmanın GERÇEKTEN sunucuya ulaşıp
// ulaşmadığını bilmeden taslağı kuyruktan silemez; App.jsx'teki updateState
// bunu olduğu gibi yukarı taşır. Mevcut ~15 çağıran bu değeri hiç okumuyor,
// davranışları değişmedi. `silent` — kuyruk arka planda sessizce yeniden
// dener; her başarısız deneme için kullanıcıya aynı hata toast'ını tekrar
// tekrar göstermek (özellikle telefon cebindeyken) gürültü olur, kuyruk
// kendi UI'ında (Taslaklar ekranı) zaten bekleyen kayıt sayısını gösteriyor.
export async function saveState(patch, { silent = false } = {}) {
  try {
    await setDoc(STATE_DOC, stripUndefined(patch), { merge: true });
    return true;
  } catch (e) {
    console.error("Firestore kaydetme hatası:", e);
    if (!silent) showToast(saveErrorMessage(e.code), "error");
    return false;
  }
}
