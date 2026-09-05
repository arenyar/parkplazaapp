// Faz 3 kabul kriteri: "AI oturumu şablondaki hiçbir kritik maddeyi
// atlamadan tamamlanır; atlanmışsa finalize reddedilir." Node'un yerleşik
// test koşucusu kullanılıyor (node:test) — yeni bir bağımlılık eklemeden.
// Çalıştır: node --test src/lib/aiChecklist.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCoverage, canFinalize } from "./aiChecklist.js";

const QUESTIONS = [
  { id: "q1", text: "Görsel kontrol normal mi?", critical: true },
  { id: "q2", text: "Ses/titreşim normal mi?", critical: true },
  { id: "q3", text: "Not (opsiyonel)", critical: false },
];

test("hiç cevap yokken kapsam sıfır ve tamamlanmamış", () => {
  const c = computeCoverage(QUESTIONS, []);
  assert.equal(c.answered, 0);
  assert.equal(c.total, 3);
  assert.deepEqual(c.remainingCriticalIds, ["q1", "q2"]);
  assert.equal(c.complete, false);
});

test("kritik bir madde cevapsızken finalize reddedilir", () => {
  const history = [{ questionId: "q1", text: "Görsel kontrol normal mi?", value: "Evet" }];
  assert.equal(canFinalize(QUESTIONS, history), false);
});

test("tüm maddeler (kritik dahil) cevaplanınca finalize serbest kalır", () => {
  const history = [
    { questionId: "q1", text: "x", value: "Evet" },
    { questionId: "q2", text: "x", value: "Evet" },
    { questionId: "q3", text: "x", value: "" },
  ];
  const c = computeCoverage(QUESTIONS, history);
  assert.equal(c.complete, true);
  assert.equal(canFinalize(QUESTIONS, history), true);
});

test("kritik olmayan bir madde eksik olsa da AI 3 kritik madde tamamlandıysa erken sonuçlandırma önerebilir ama coverage bunu yakalar", () => {
  const history = [
    { questionId: "q1", text: "x", value: "Evet" },
    { questionId: "q2", text: "x", value: "Evet" },
  ];
  const c = computeCoverage(QUESTIONS, history);
  assert.equal(c.remainingCriticalIds.length, 0, "kritik maddeler tamam");
  assert.equal(c.complete, false, "ama q3 (opsiyonel) hâlâ cevapsız, toplam kapsam eksik");
});
