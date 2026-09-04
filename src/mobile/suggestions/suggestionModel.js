import { mobileTokens as t } from "../tokens.js";

// Faz 9 — bu depoda hiç karşılığı olmayan, tamamen yeni bir alan (bkz.
// mockData.js state.suggestions). Enum'lar spec'in kendisinden (bölüm
// Faz 9), uydurma değil ama gerçek koddan da alınamadı çünkü hiç yoktu.
export const CATEGORIES = ["İSG", "Enerji", "Süreç", "Konfor", "Maliyet"];
export const STATUS_ORDER = ["Yeni", "İnceleniyor", "Kabul edildi", "Uygulandı", "Uygulanmayacak"];
export const STATUS_COLORS = {
  "Yeni": { color: t.pine, bg: t.pineSoft },
  "İnceleniyor": { color: t.amber, bg: t.amberSoft },
  "Kabul edildi": { color: t.ok, bg: t.pineSoft },
  "Uygulandı": { color: t.ok, bg: t.pineSoft },
  "Uygulanmayacak": { color: t.kiremit, bg: t.kiremitSoft },
};

// "Göreve dönüştür" — spec: "Kabul edilen öneri Göreve dönüştür ile
// Görevler modülüne aktarılır." Bu depoda "Görevler" ayrı bir koleksiyon
// değil, aynı state.tasks içinde bir kapsam (bkz. navConfig.js
// OPERASYONLAR_SCOPES.gorevler — category "Planlı Bakım" filtresi, Faz 3).
// Bir öneri gerçek bir planlı bakım değil, o filtreye ZORLA sokmak yanlış
// olurdu — bunun yerine normal bir görev olarak state.tasks'a eklenir,
// "Talep yönetimi" (tüm kayıtlar) altında görünür ve `sourceSuggestionId`
// ile öneriye bağlı kalır.
export function departmentForCategory(category) {
  return category === "İSG" ? "İSG" : "Yönetim";
}

export function hasSupported(suggestion, personnelName) {
  return (suggestion.supporters || []).includes(personnelName);
}
