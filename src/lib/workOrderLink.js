import { isLeadRole } from "../mockData.js";

// Kullanıcı teyidiyle: "arıza kaydında açılan işi whatsap'tan link olarak
// yollayabilir miyiz" — atanan personelin telefonuna, o göreve özel bir
// link gönderilir; personel uygulamaya giriş yapmadan sadece o kaydın
// "İşi Başlat"/"İşi Bitir" adımını uygulayabilir. Mimari, anket linkiyle
// (bkz. lib/survey.js) aynı desen: rastgele bir token task üzerinde
// saklanır (bkz. netlify/functions/work-order-action.js), link sahibi
// olmayan biri kaydı değiştiremez. Anket linkinden farkı: tek kullanımlık
// DEĞİL — aynı link önce "İşi Başlat" sonra "İşi Bitir" için tekrar
// kullanılır. Görev Tamamlandı/İptal/arşivlendiğinde fonksiyon işlemi
// kendiliğinden reddeder (bkz. o dosyadaki kontrol).
export function generateActionToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// `no` sadece GÖRSEL bağlam için linkte taşınır (anket linkindeki `c`
// parametresiyle aynı mantık) — hangi kayda işlem yapılacağı sunucu
// tarafında SADECE `t`+`k` eşleşmesiyle belirlenir.
export function buildWorkOrderActionLink(origin, task, token) {
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const params = new URLSearchParams({ t: task.id, k: token });
  if (task.ticketNo) params.set("no", String(task.ticketNo));
  return `${base}/is-emri?${params.toString()}`;
}

export function buildWorkOrderWhatsAppMessage(task, link) {
  const header = `İş emri #${task.ticketNo || ""} — ${task.description || task.typePath || ""}`;
  const meta = [task.department, task.priority].filter(Boolean).join(" · ");
  return `${header}\n${meta}\nUygulamaya girmeden işi başlatıp bitirebilirsiniz:\n${link}`;
}

// Kullanıcı teyidiyle: "whatsapp gönder butonu sadece şefler ve
// yöneticilerde olsun" — mockData.js'teki AYNI şef/sorumlu/müdür kalıbı
// (isLeadRole) + Yönetim departmanının tamamı (Facility Manager dahil).
// Sıradan saha personeli bu butonu göremez, sadece kendisine bir link
// gönderilmesini bekler.
export function canSendWorkOrderLink(person) {
  if (!person) return false;
  return person.department === "Yönetim" || isLeadRole(person.role);
}
