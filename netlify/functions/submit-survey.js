import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// Kullanıcı teyidiyle: "linke tıkladığında hizmetleri değerlendirecek...
// link iş emri kapatılmıştır ile birlikte gidecek" — anket linkine tıklayan
// ofis yetkilisinin uygulamada HİÇBİR hesabı yok, girişsiz bir sayfa görür
// (bkz. pages/SurveyPage.jsx). Ama appdata/parkplaza-ops-center-state
// belgesi SADECE giriş yapmış kullanıcılara açık (bkz. src/firebase.js
// STATE_DOC notu) — bu yüzden anonim ziyaretçi puanı doğrudan Firestore'a
// yazamaz. Çözüm: bu fonksiyon, SADECE bu iş için oluşturulmuş düşük
// yetkili bir "servis" Firebase Auth hesabıyla (SURVEY_BOT_EMAIL/
// SURVEY_BOT_PASSWORD — Netlify ortam değişkenleri) giriş yapar ve puanı
// o kimlikle kaydeder. firebase-admin/servis hesabı anahtarı GEREKMEZ —
// zaten kurulu `firebase` istemci paketi yeniden kullanılıyor (bkz.
// src/firebase.js createAuthAccount'taki "ikincil app" deseniyle aynı
// aile). Ekstra güvenlik: link tek kullanımlıktır (bkz. lib/survey.js
// generateSurveyToken) — token, task.surveyToken ile eşleşmiyorsa veya
// task zaten yanıtlanmışsa (surveyRating dolu) reddedilir.
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyBaG2wpFyFwri-q-LVjkdeYvvrSqJGYmis",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "parkplaza-451fa.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "parkplaza-451fa",
};

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Sadece POST kabul edilir." }) };
  }
  const botEmail = process.env.SURVEY_BOT_EMAIL;
  const botPassword = process.env.SURVEY_BOT_PASSWORD;
  if (!botEmail || !botPassword) {
    return { statusCode: 500, body: JSON.stringify({ error: "Sunucu tarafında SURVEY_BOT_EMAIL/SURVEY_BOT_PASSWORD tanımlı değil." }) };
  }
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Geçersiz istek gövdesi." }) };
  }
  const { taskId, token, rating, note } = body;
  const ratingNum = Number(rating);
  if (!taskId || !token || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return { statusCode: 400, body: JSON.stringify({ error: "taskId, token ve 1-5 arası bir rating zorunlu." }) };
  }
  // Kötüye kullanıma karşı kaba bir üst sınır — anket notu bir form alanı,
  // uzun bir metin editörü değil.
  const noteText = typeof note === "string" ? note.slice(0, 500) : "";

  const app = initializeApp(firebaseConfig, `survey_${Date.now()}`);
  try {
    const auth = getAuth(app);
    await signInWithEmailAndPassword(auth, botEmail, botPassword);
    const db = getFirestore(app);
    const stateRef = doc(db, "appdata", "parkplaza-ops-center-state");
    const snap = await getDoc(stateRef);
    if (!snap.exists()) {
      return { statusCode: 404, body: JSON.stringify({ error: "Durum belgesi bulunamadı." }) };
    }
    const state = snap.data();
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) {
      return { statusCode: 404, body: JSON.stringify({ error: "Kayıt bulunamadı." }) };
    }
    const task = tasks[idx];
    if (task.surveyToken !== token) {
      return { statusCode: 403, body: JSON.stringify({ error: "Geçersiz link." }) };
    }
    if (task.surveyRating) {
      return { statusCode: 409, body: JSON.stringify({ error: "Bu anket zaten yanıtlanmış." }) };
    }
    const updatedTask = { ...task, surveyRating: ratingNum, surveyNote: noteText, surveyRespondedAt: new Date().toISOString() };
    const updatedTasks = tasks.map((t, i) => (i === idx ? updatedTask : t));
    await setDoc(stateRef, { tasks: updatedTasks }, { merge: true });
    return { statusCode: 200, body: JSON.stringify({ success: true, taskSummary: { ticketNo: task.ticketNo, description: task.description } }) };
  } catch (err) {
    console.error("Anket kaydedilemedi:", err);
    return { statusCode: 502, body: JSON.stringify({ error: err.message || "Anket kaydedilemedi." }) };
  }
}
