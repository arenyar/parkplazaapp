import { test } from "node:test";
import assert from "node:assert/strict";
import { MODEL, RESPONSE_SCHEMA, buildQuestionGenPrompt, buildGeminiRequestBody } from "./mahalQuestionPrompt.js";

test("gerçek model adı doğru (canlıda çalıştığı doğrulanmış tek model)", () => {
  assert.equal(MODEL, "gemini-3.6-flash");
});

test("promptta ekipman bağlamı (marka/model/kategori/not) yer alır", () => {
  const prompt = buildQuestionGenPrompt({ assetName: "Sıcak su kazanı", manufacturer: "Viessmann", model: "Paromat-Simplex", category: "Isıtma Sistemi", notes: "Yer tipi doğalgazlı" });
  assert.ok(prompt.includes("Sıcak su kazanı"));
  assert.ok(prompt.includes("Viessmann Paromat-Simplex"));
  assert.ok(prompt.includes("Isıtma Sistemi"));
  assert.ok(prompt.includes("Yer tipi doğalgazlı"));
});

test("eksik alanlar '?' olarak görünür — uydurma bir değer yazılmaz", () => {
  const prompt = buildQuestionGenPrompt({ assetName: "Bilinmeyen ekipman" });
  assert.ok(prompt.includes("Marka/Model: ?"));
  assert.ok(prompt.includes("Kategori: ?"));
});

test("yanıt şeması questions dizisi + bool/sayi tipleri içerir", () => {
  const props = RESPONSE_SCHEMA.properties.questions.items.properties;
  assert.ok(props.text);
  assert.deepEqual(props.type.enum, ["bool", "sayi"]);
  assert.deepEqual(props.failOn.enum, ["Evet", "Hayır"]);
});

test("Gemini istek gövdesi structured output zorunlu kılar", () => {
  const body = buildGeminiRequestBody("test prompt");
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.deepEqual(body.generationConfig.responseSchema, RESPONSE_SCHEMA);
  assert.equal(body.contents[0].parts[0].text, "test prompt");
});
