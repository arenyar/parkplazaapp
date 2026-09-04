import { mobileTokens as t } from "./tokens.js";

// Gerçek enum'lar (bkz. src/components/TaskForm.jsx TASK_PRIORITIES/TASK_STATUSES)
// — spec'in varsaydığı isimler değil. RecordCard VE DetailScreen aynı
// eşlemeyi kullanır (bkz. mobile-ops-ui SKILL.md: "Durum asla yalnız renkle
// anlatılmaz").
export const PRIORITY_COLOR = { "Kritik": t.kiremit, "Yüksek": t.amber, "Orta": t.pine, "Düşük": t.muted };
export const STATUS_COLOR = { "Yapılacak": t.pine, "Üzr. Çalışılıyor": t.amber, "Tamamlandı": t.ok, "İptal": t.muted };

export function initials(name) {
  return (name || "").trim().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
}

// Kayıt için tek bir "aksiyon" etiketi — spec: "Atanmadı" / "Devam ediyor" /
// "Tamamlandı".
export function actionLabel(task) {
  if (task.status === "Tamamlandı") return "Tamamlandı";
  if (!task.assignee) return "Atanmadı";
  return "Devam ediyor";
}

// "Mahal yolu" — bu depoda tek parça, en fazla tek katlı bir konum alanı var
// (`location`, sadece kiracı talepleri dolduruyor); A Blok>Kat>Oda gibi 3
// seviyeli bir hiyerarşi kayıtlarda hiç tutulmuyor — olmayan bir veri
// uydurmak yerine var olanı (location, yoksa department) gösteriyoruz.
export function placeOf(task) {
  return task.location || task.department;
}

// Saatsiz "YYYY-MM-DD" tarihleri (dueDate, startDate...) TEK yerde biçimlendirir.
// `new Date("YYYY-MM-DD")` UTC gece yarısı sayılır — UTC'nin gerisindeki saat
// dilimlerinde `toLocaleDateString` bir gün geri kayar (ör. ayın 30'u 29 görünür).
// Bileşenlerden kurmak bu kaymayı önler. Saat içeren tam ISO değerlerde
// (createdAt, completedAt...) bu kayma yok, onlar doğrudan `new Date(iso)` ile
// biçimlendirilir.
export function formatDateOnlyTR(dateStr) {
  if (!dateStr) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return null;
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("tr-TR");
}
