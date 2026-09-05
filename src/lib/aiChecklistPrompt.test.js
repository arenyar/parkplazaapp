// Kullanıcı teyidiyle: "Netlify kredisi yok, localde test edecek şekilde
// yapalım" — bu testler ağa hiç çıkmaz, sadece prompt/şema üretimini
// doğrular. Gerçek Gemini çağrısını yerelde denemek için:
// scripts/test-ai-checklist-turn.mjs (GEMINI_API_KEY ortam değişkeniyle,
// kullanıcı kendi terminalinde çalıştırır — anahtar bu oturuma hiç girmez).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, buildGeminiRequestBody, RESPONSE_SCHEMA, MODEL } from "./aiChecklistPrompt.js";

const ASSET = { manufacturer: "York", model: "YSDACAS35CGO", category: "Chiller Sistemi", criticality: "Kritik", floorLabel: "3B" };
const QUESTIONS = [
  { id: "q1", text: "Chiller çıkış suyu sıcaklığı normal mi?", unit: "°C" },
  { id: "q2", text: "Anormal titreşim/ses var mı?" },
];

test("promptta HER şablon maddesi (id + metin) yer alır — hiçbiri atlanmaz", () => {
  const prompt = buildSystemPrompt({ assetContext: ASSET, questions: QUESTIONS, history: [] });
  for (const q of QUESTIONS) {
    assert.ok(prompt.includes(q.id), `"${q.id}" promptta bulunamadı`);
    assert.ok(prompt.includes(q.text), `"${q.text}" promptta bulunamadı`);
  }
});

test("promptta varlık bağlamı (marka/model/kategori/kritiklik/mahal) yer alır", () => {
  const prompt = buildSystemPrompt({ assetContext: ASSET, questions: QUESTIONS, history: [] });
  assert.ok(prompt.includes("York"));
  assert.ok(prompt.includes("YSDACAS35CGO"));
  assert.ok(prompt.includes("Chiller Sistemi"));
  assert.ok(prompt.includes("Kritik"));
  assert.ok(prompt.includes("3B"));
});

test("geçmiş cevaplar promptta görünür", () => {
  const history = [{ questionId: "q1", text: QUESTIONS[0].text, value: "9 °C" }];
  const prompt = buildSystemPrompt({ assetContext: ASSET, questions: QUESTIONS, history });
  assert.ok(prompt.includes("9 °C"));
});

test("geçmiş boşken 'henüz cevap yok' yazar (uydurma cevap yok)", () => {
  const prompt = buildSystemPrompt({ assetContext: ASSET, questions: QUESTIONS, history: [] });
  assert.ok(prompt.includes("henüz cevap yok"));
});

test("yasak liste promptta açıkça belirtilir (görev kapatma/silme/maliyet/personel)", () => {
  const prompt = buildSystemPrompt({ assetContext: ASSET, questions: QUESTIONS, history: [] });
  assert.ok(prompt.includes("YASAK"));
  assert.ok(/görev kapatma/i.test(prompt));
});

test("yanıt şeması action enum'unda finalize/ask/request_photo var, gerçek model adı doğru", () => {
  assert.deepEqual(RESPONSE_SCHEMA.properties.action.enum, ["ask", "request_photo", "finalize"]);
  assert.equal(MODEL, "gemini-3.6-flash");
});

test("Gemini istek gövdesi structured output (responseMimeType+responseSchema) zorunlu kılar", () => {
  const req = buildGeminiRequestBody("test prompt");
  assert.equal(req.generationConfig.responseMimeType, "application/json");
  assert.equal(req.generationConfig.responseSchema, RESPONSE_SCHEMA);
  assert.equal(req.contents[0].parts[0].text, "test prompt");
  assert.equal(req.contents[0].parts.length, 1, "fotoğraf verilmezse tek part (metin)");
});

test("Faz 5 — fotoğraf verilince Gemini isteğine inline_data eklenir (vision)", () => {
  const req = buildGeminiRequestBody("test prompt", { base64: "ZmFrZQ==", mimeType: "image/jpeg" });
  assert.equal(req.contents[0].parts.length, 2);
  assert.equal(req.contents[0].parts[1].inline_data.mime_type, "image/jpeg");
  assert.equal(req.contents[0].parts[1].inline_data.data, "ZmFrZQ==");
});

test("promptta fotoğraf kısıtı (en fazla 3, sadece gerekliyse) belirtilir", () => {
  const prompt = buildSystemPrompt({ assetContext: ASSET, questions: QUESTIONS, history: [] });
  assert.ok(/en fazla 3 fotoğraf/i.test(prompt));
});
