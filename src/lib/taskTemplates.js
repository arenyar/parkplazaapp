// Belgedeki "asset tipi -> şablon eşlemesi" fikrinin AI'sız ilk sürümü.
// AI/LLM burada YOK — bilinen ekipman kategorisi için önerilen periyot ve
// checklist sorularını döndürür, kullanıcı formda görür/değiştirir/onaylar,
// hiçbir şey otomatik/sessizce kaydedilmez. Yeni bir kategori eklemek kod
// değişikliği değil, bu tabloya satır eklemek demektir.
export const EQUIPMENT_TASK_TEMPLATES = {
  "Jeneratör": { period: "1 AY", questions: [
    { text: "Yağ seviyesi normal mi?", failOn: "Hayır" },
    { text: "Akü şarj durumu uygun mu?", failOn: "Hayır" },
    { text: "Sızıntı var mı?", failOn: "Evet" },
  ] },
  "Elektrik Sistemi": { period: "12 AY", questions: [
    { text: "Anormal ses/koku var mı?", failOn: "Evet" },
    { text: "Pano kapakları kilitli mi?", failOn: "Hayır" },
  ] },
  "Asansör": { period: "1 AY", questions: [
    { text: "Acil alarm butonu çalışıyor mu?", failOn: "Hayır" },
    { text: "Kapı sensörleri düzgün çalışıyor mu?", failOn: "Hayır" },
  ] },
  "Chiller Sistemi": { period: "3 AY", questions: [
    { text: "Su sızıntısı var mı?", failOn: "Evet" },
    { text: "Titreşim/gürültü normal mi?", failOn: "Hayır" },
  ] },
  "Yangın Söndürme Ekipmanı": { period: "12 AY", questions: [
    { text: "Basınç göstergesi yeşil bölgede mi?", failOn: "Hayır" },
    { text: "Son kullanma tarihi geçmiş mi?", failOn: "Evet" },
  ] },
  "Yangın Suyu Basınçlandırma Sistemi": { period: "1 AY", questions: [
    { text: "Basınç göstergeleri normal mi?", failOn: "Hayır" },
  ] },
  "Kesintisiz Güç Kaynağı": { period: "3 AY", questions: [
    { text: "Akü test sonucu normal mi?", failOn: "Hayır" },
  ] },
};

export function suggestTemplateForCategory(category) {
  return EQUIPMENT_TASK_TEMPLATES[category] || null;
}
