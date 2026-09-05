import { test } from "node:test";
import assert from "node:assert/strict";
import { getOfflineGuidance } from "./offlineGuidance.js";

test("gaz/koku sorusu ACİL ve tırmandırma (escalate) ile döner", () => {
  const g = getOfflineGuidance({ text: "Doğalgaz kaçağı/kokusu var mı?" });
  assert.ok(g);
  assert.equal(g.severity, "acil");
  assert.equal(g.escalate, true);
});

test("basınç sorusu rehber döner (chiller/kazan/hidrofor ortak deseni)", () => {
  assert.ok(getOfflineGuidance({ text: "Kompresör basıncı (bar)" }));
  assert.ok(getOfflineGuidance({ text: "Sistem/kazan dairesi su basıncı (bar)" }));
  assert.ok(getOfflineGuidance({ text: "Hidrofor basınç şalteri normal çalışıyor mu?" }));
});

test("eşleşmeyen bir soru için null döner — zorla uydurulmaz", () => {
  assert.equal(getOfflineGuidance({ text: "Bugün hava nasıl?" }), null);
});

test("gerçek soru metinlerinin çoğunluğu (mockData.js'ten) bir desenle eşleşir", () => {
  // Kullanıcı teyidiyle örnek verdiği gerçek sorular — kapsam kontrolü.
  const real = [
    "Chiller çıkış suyu sıcaklığı (°C)", "Anormal titreşim/ses var mı?", "Genleşme tankı basıncı normal mi?",
    "Hidrofor basıncı (bar)", "Pompa otomatik devreye giriyor mu?", "Sızıntı/nem var mı?",
    "Pano görünümü normal mi (hasar/kir/pas yok)?", "Alarm/Trip durumu yok mu?",
    "Jeneratör akü voltajı (V)", "Jeneratör yakıt seviyesi yeterli mi (%50 üzeri)?",
    "Tüp basınç göstergesi yeşil bölgede mi?", "Acil durum (batarya) modunda çalışıyor mu?",
  ];
  const matched = real.filter((text) => getOfflineGuidance({ text }));
  assert.ok(matched.length >= real.length * 0.9, `beklenenden az eşleşme: ${matched.length}/${real.length}`);
});
