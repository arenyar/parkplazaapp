import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// Kullanıcı teyidiyle: "arıza kaydında açılan işi whatsap'tan link olarak
// yollayabilir miyiz" — linke tıklayan personelin uygulamada oturumu yok
// (bkz. lib/workOrderLink.js, pages/WorkOrderPage.jsx), bu yüzden bu
// fonksiyon anket fonksiyonuyla (submit-survey.js) AYNI servis hesabını
// (SURVEY_BOT_EMAIL/PASSWORD) kullanır — appdata belgesine yazma yetkisi
// zaten o hesapta var, ikinci bir bot hesabı kurdurmaya gerek yok. Anket
// linkinden fark: token tek kullanımlık DEĞİL (aynı link önce "başlat"
// sonra "bitir" için tekrar kullanılır) — bunun yerine görev
// Tamamlandı/İptal/arşivli olduğunda işlemler reddedilir, doğal bir sınır.
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyBaG2wpFyFwri-q-LVjkdeYvvrSqJGYmis",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "parkplaza-451fa.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "parkplaza-451fa",
};

function publicTaskView(task) {
  return {
    ticketNo: task.ticketNo, description: task.description, department: task.department,
    priority: task.priority, status: task.status, location: task.location, company: task.company,
    assignee: task.assignee, resolution: task.resolution || "",
  };
}

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
  const { type, taskId, token, resolution } = body;
  if (!taskId || !token || !["status", "start", "finish"].includes(type)) {
    return { statusCode: 400, body: JSON.stringify({ error: "type, taskId ve token zorunlu." }) };
  }
  if (type === "finish" && !(typeof resolution === "string" && resolution.trim())) {
    return { statusCode: 400, body: JSON.stringify({ error: "İşi bitirmek için ne yapıldığını yazmanız gerekiyor." }) };
  }

  const app = initializeApp(firebaseConfig, `workorder_${Date.now()}`);
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
    if (task.actionToken !== token) {
      return { statusCode: 403, body: JSON.stringify({ error: "Geçersiz link." }) };
    }
    if (task.archived || task.status === "İptal") {
      return { statusCode: 409, body: JSON.stringify({ error: "Bu iş emri artık geçerli değil." }) };
    }

    if (type === "status") {
      return { statusCode: 200, body: JSON.stringify({ success: true, task: publicTaskView(task) }) };
    }

    if (task.status === "Tamamlandı") {
      return { statusCode: 409, body: JSON.stringify({ error: "Bu iş zaten tamamlanmış." }) };
    }

    const now = new Date().toISOString();
    const actorLabel = task.assignee ? `${task.assignee} (WhatsApp linki)` : "WhatsApp linki";
    let updatedTask;
    if (type === "start") {
      if (task.status !== "Yapılacak") {
        return { statusCode: 409, body: JSON.stringify({ error: "Bu iş zaten başlatılmış." }) };
      }
      updatedTask = { ...task, status: "Üzr. Çalışılıyor", startedAt: task.startedAt || now, updatedAt: now, updatedBy: actorLabel };
    } else {
      updatedTask = { ...task, status: "Tamamlandı", resolution: resolution.trim(), completedAt: task.completedAt || now, updatedAt: now, updatedBy: actorLabel };
    }
    const updatedTasks = tasks.map((t, i) => (i === idx ? updatedTask : t));
    await setDoc(stateRef, { tasks: updatedTasks }, { merge: true });
    return { statusCode: 200, body: JSON.stringify({ success: true, task: publicTaskView(updatedTask) }) };
  } catch (err) {
    console.error("İş emri linki işlenemedi:", err);
    return { statusCode: 502, body: JSON.stringify({ error: err.message || "İşlem yapılamadı." }) };
  }
}
