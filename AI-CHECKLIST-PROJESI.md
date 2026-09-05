# Park Plaza Facility OS — Yapay Zeka Destekli QR Checklist Projesi

> Bu dosya hem **teknik spesifikasyon** hem de **Claude Code için uygulama promptu**dur.
> Claude Code bu dosyayı okuduğunda Faz 0'dan başlayıp sırayla uygular.
> Her fazın sonunda durur, çıktıyı gösterir, onay bekler.

**Durum:** Taslak v1 · **Sahip:** Yasin · **Hedef repo:** ParkPlazaApp (platform.parkplaza.app)

---

## 0. Tek cümlelik amaç

Tesisteki her ekipmanın üzerinde bir QR olacak; teknisyen QR'ı okuttuğunda uygulama
ya **planlı bakım kontrolü** ya da **arıza kaydı** başlatacak, soruları **Gemini**
soracak, cevaba göre teşhise yönelik **ek sorular** üretecek, gerektiğinde
**fotoğraf** isteyecek — ve klasik (elle doldurulan) checklist **her zaman
yedekte duracak.**

---

## 1. Vazgeçilmez kurallar (bunlar tartışmaya kapalı)

1. **Klasik mod silinmez.** Mevcut Mahal Kontrol / Bakım Takvimi checklist akışı
   olduğu gibi kalır. AI modu bunun *üzerine* eklenen ikinci bir moddur.
   Aynı `taskInstance` her iki modda da doldurulabilir, aynı sonuç şemasına yazar.
2. **Otomatik geri düşüş (fallback).** AI tarafı yavaşlarsa, hata verirse, kota
   dolarsa veya cihaz çevrimdışıysa kullanıcı hiçbir şey kaybetmeden klasik moda
   döner. Yarıda kalan AI oturumundaki cevaplar klasik forma taşınır.
3. **AI karar vermez, öneri verir.** Arıza kaydı açmak, görevi kapatmak, kritik
   bulgu işaretlemek → her zaman insan onayı ile. AI'nin teşhisi `aiSuggestion`
   alanına yazılır, `result` alanına değil.
4. **API anahtarı istemciye asla gitmez.** Gemini çağrıları yalnızca Cloud
   Functions üzerinden. Anahtar Secret Manager'da.
5. **Şema disiplini.** `facility-ops-schema` skill'indeki kararlar geçerli:
   multi-tenant izolasyon path üzerinden, dokümana `projectId` alanı eklenmez,
   checklist maddeleri gömülü array, denormalize alanlar Cloud Function ile senkron.
   Bu kurallardan sapma gerekiyorsa **sessizce sapma — önce gerekçesini yaz.**

---

## 2. Mimari özet

```
[Teknisyen telefonu]
   │  QR okut (kamera / PWA)
   ▼
/qr/{token}  ──►  qrResolve (callable)  ──►  /qrIndex/{token} → {projectId, assetId}
   │
   ▼
Aksiyon seçimi:  [Planlı Bakım]  [Arıza Kaydı]  [Varlık Bilgisi]
   │
   ▼
taskInstance oluştur  (mode: 'ai' | 'classic')
   │
   ├── mode: 'classic' ──► mevcut checklist formu (DEĞİŞMEZ)
   │
   └── mode: 'ai'
         │
         ▼
      aiChecklistTurn (callable, App Check zorunlu)
         │   ├─ context: asset + katalog + geçmiş bakım + şablon maddeleri
         │   ├─ Gemini structured output (JSON schema)
         │   └─ fotoğraf istenirse → Storage upload → sonraki turda vision
         ▼
      Soru → Cevap → (gerekirse) Ek teşhis sorusu → Özet + öneri
         │
         ▼
      İnsan onayı ──► taskInstance.results  (+ istenirse request/arıza kaydı)
```

---

## 3. Veri modeli

### 3.1 Yeni: varlık kayıt defteri

`/projects/{projectId}/assets/{assetId}`

```ts
{
  code: string;              // insan okur: "CHL-01", "AHU-B2-03"
  name: string;
  catalogRef: string | null; // /equipmentCatalog/{id}
  categoryId: string;
  locationId: string;
  locationName: string;      // denormalize
  brand?: string; model?: string; serialNo?: string;
  installedAt?: Timestamp; warrantyEndsAt?: Timestamp;
  criticality: 'kritik' | 'onemli' | 'normal';
  status: 'aktif' | 'devre_disi' | 'hurda';
  taskTemplateIds: string[];  // bu varlığa bağlı bakım şablonları
  lastTaskAt?: Timestamp; nextDueAt?: Timestamp;
  qr: {
    token: string;           // 22 karakter, tahmin edilemez (nanoid)
    version: number;         // etiket yeniden basılınca artar
    printedAt?: Timestamp;
    revokedAt?: Timestamp | null;
  };
}
```

### 3.2 Yeni: kök seviye QR indeksi

`/qrIndex/{token}` → `{ projectId, assetId, active: boolean }`

**Bilinçli sapma:** Şema kuralı "operasyonel veriye `projectId` alanı ekleme" der.
Ama QR okutulduğunda hangi projede olduğumuzu bilmiyoruz; okuyucu henüz tenant
seçmemiş olabilir. Bu yüzden yalnızca bu indeks dokümanı `projectId` taşır.
Kurallar: `allow read: if false` — çözümleme sadece `qrResolve` callable'ı üzerinden,
kullanıcının o projede yetkisi doğrulanarak yapılır.

### 3.3 Genişletilen: taskInstances

`/projects/{projectId}/taskInstances/{id}` içine eklenecek alanlar:

```ts
{
  assetId?: string;
  assetName?: string;          // denormalize
  source: 'qr_scan' | 'schedule' | 'manual';
  mode: 'ai' | 'classic';
  modeSwitchedAt?: Timestamp;  // AI'dan klasiğe düşüldüyse
  aiSessionId?: string;
  aiSuggestion?: {
    summary: string;
    likelyCause?: string;
    severity: 'bilgi' | 'takip' | 'acil';
    recommendedAction?: string;
    confidence: number;        // 0..1
    accepted?: boolean;        // insan onayı
    acceptedBy?: string;
  };
  results: ChecklistResult[];  // MEVCUT ŞEMA — değişmiyor
}
```

`results` şemasının değişmemesi kritik: raporlar, ISO audit izi ve mevcut
ekranlar bu şemaya bağlı. AI modu da klasik mod da **aynı** `results` yazar.

### 3.4 Yeni: AI oturumları

`/projects/{projectId}/aiSessions/{sessionId}`

```ts
{
  taskInstanceId: string;
  assetId: string;
  domainType: string;
  status: 'devam' | 'tamamlandi' | 'iptal' | 'hata_fallback';
  turns: Array<{
    role: 'ai' | 'user';
    at: Timestamp;
    questionId?: string;
    questionType?: 'bool' | 'sayi' | 'secim' | 'metin' | 'fotograf';
    text: string;
    value?: unknown;
    photoPaths?: string[];     // Storage yolları
  }>;                          // gömülü array — üst sınır 40 tur
  usage: { promptTokens: number; outputTokens: number; imageCount: number; costTRY?: number };
  model: string;
  startedAt: Timestamp; endedAt?: Timestamp;
}
```

Tur sayısı sınırlı olduğu için gömülü array (şema kuralı 3). Oturumlar sınırsız
büyüdüğü için ayrı koleksiyon.

### 3.5 Arıza kaydı

Yeni koleksiyon **açma**. Mevcut Talep Yönetimi `requests` koleksiyonu kullanılır,
sadece iki alan eklenir: `origin: 'ai_checklist'` ve `sourceSessionId`.

### 3.6 Indexes ve rules

- `assets`: `(status, nextDueAt)`, `(locationId, criticality)`
- `taskInstances`: `(assetId, createdAt desc)`, `(mode, status)`
- `aiSessions`: `(status, startedAt desc)`
- `qrIndex`: istemci okuması **kapalı**.
- `aiSessions`: kullanıcı yalnızca kendi başlattığı oturumu okur; yazma sadece
  Cloud Function (`allow write: if false`).

⚠️ **Bilinen risk:** Prodüksiyonda hâlihazırda "durum değişikliği ve silme
kaydedilmiyor" şeklinde bir Firestore yazma sorunu var (muhtemelen Security Rules
veya App Check kaynaklı). Yeni callable'larda App Check'i **zorunlu** kılmadan
önce bu sorun teşhis edilmeli, yoksa aynı hatayı yeni modüle taşırız.
Faz 0'ın ilk işi budur.

---

## 4. QR altyapısı

- **Token:** 22 karakterlik URL-safe rastgele dizi. Varlık ID'si veya sıralı numara
  **kullanılmaz** (tahmin edilerek başka varlığın kaydı açılabilir).
- **URL formatı:** `https://platform.parkplaza.app/qr/{token}`
  Mevcut `?birim=` / `?app=mahal` deep-link deseniyle uyumlu; `detectQrToken()`
  fonksiyonu mevcut `detectAnketId` / `detectTurId` deseniyle aynı yerde yazılır.
- **Etiket üretimi:** QRCode.js zaten projede var. Toplu etiket sayfası:
  A4'te 3×8 grid, her etikette QR + varlık kodu + varlık adı + mahal.
  Çıktı yazdırılabilir HTML (PDF kütüphanesi eklemeye gerek yok).
- **Yeniden basım:** `qr.version` artar, eski token 30 gün geçerli kalır
  (`qrIndex` dokümanı `active: false` + `graceUntil`), sonra kapanır.
- **Çevrimdışı okutma:** Token IndexedDB kuyruğuna yazılır, bağlantı gelince
  çözümlenir. Çevrimdışıyken AI modu **açılmaz**, doğrudan klasik mod.

---

## 5. AI checklist motoru

### 5.1 Cloud Functions (v2, Node 20, europe-west1)

| Fonksiyon | Tip | İş |
|---|---|---|
| `qrResolve` | callable | Token → varlık + kullanıcı yetkisi + açılabilecek aksiyonlar |
| `aiChecklistStart` | callable | Oturum aç, ilk soruyu üret |
| `aiChecklistTurn` | callable | Cevabı işle, sonraki soruyu veya özeti üret |
| `aiChecklistFinalize` | callable | Özet + öneri üret, `results` yaz, gerekirse `request` taslağı |
| `onAssetWrite` | firestore trigger | `qrIndex` ve denormalize alanları senkronla |

Anahtar: `defineSecret('GEMINI_API_KEY')`. İstemcide **hiçbir koşulda** bulunmaz.

### 5.2 Gemini yapılandırması

- SDK: `@google/genai` (Node).
- Model: soru turları için hızlı/ucuz model, final teşhis için güçlü model.
  Model ID'leri **koda gömülmez** — Remote Config veya `functions.config`
  üzerinden: `ai.model.turn`, `ai.model.final`. Varsayılan: `gemini-2.5-flash`
  ve `gemini-2.5-pro`. *(Uygulamadan önce güncel model adlarını doğrula.)*
- **Structured output zorunlu:** `responseMimeType: 'application/json'` +
  `responseSchema`. Serbest metin parse etmeye çalışma.
- `temperature: 0.2` (turlar), `0.4` (final özet).

### 5.3 Yanıt şeması

```json
{
  "action": "ask" | "request_photo" | "finalize",
  "question": {
    "id": "string",
    "templateItemId": "string|null",
    "text": "string",
    "type": "bool|sayi|secim|metin|fotograf",
    "options": ["string"],
    "unit": "string|null",
    "expectedRange": { "min": 0, "max": 0 },
    "critical": true,
    "why": "string"
  },
  "diagnosis": {
    "summary": "string",
    "likelyCause": "string",
    "severity": "bilgi|takip|acil",
    "recommendedAction": "string",
    "confidence": 0.0,
    "createFaultRecord": true
  },
  "coverage": { "answered": 0, "total": 0, "remainingCriticalIds": ["string"] }
}
```

### 5.4 Sistem promptu (fonksiyon içinde)

Şu bileşenler her turda modele verilir:

1. **Rol:** "Sen Park Plaza Maslak tesisinde çalışan kıdemli bir bakım
   teknisyenisin. Sahadaki tekniker ile Türkçe, kısa ve net konuşursun."
2. **Varlık bağlamı:** marka, model, kategori, kurulum yılı, kritiklik, mahal.
3. **Şablon maddeleri:** ilgili `taskTemplate.checklistItems` — **bunlar zorunlu
   kapsam**. AI sırayı değiştirebilir, dilini sadeleştirebilir, ama hiçbirini
   atlayamaz.
4. **Geçmiş:** son 3 bakım sonucu + son 3 arıza kaydı özeti.
5. **Kısıtlar:**
   - Aynı anda tek soru sor.
   - Soru en fazla 20 kelime.
   - Anormal cevap gelirse en fazla **3 ek teşhis sorusu** sor, sonra sonuçlandır.
   - Fotoğraf yalnızca görsel doğrulama gerçekten karar değiştirecekse iste
     (oturum başına en fazla 3 fotoğraf).
   - Emin değilsen tahmin etme; `confidence` düşür ve insana bırak.
   - Güvenlik riski (gaz, elektrik, yüksekte çalışma) sezersen soruyu kes,
     `severity: 'acil'` ile sonuçlandır ve işi durdurmayı öner.
6. **Yasak:** görev kapatma, kayıt silme, maliyet taahhüdü, personel değerlendirmesi.

### 5.5 Tur ve maliyet sınırları

| Sınır | Değer | Aşılınca |
|---|---|---|
| Soru turu | 25 | Otomatik `finalize` |
| Ek teşhis sorusu | 3 / bulgu | Sonuçlandır |
| Fotoğraf | 3 / oturum | Fotoğraf isteme kapanır |
| Oturum süresi | 20 dk | Oturum dondurulur, klasiğe düşer |
| Günlük çağrı / kullanıcı | yapılandırılabilir | Klasik mod |

Her oturumun token kullanımı `aiSessions.usage`'a yazılır; yönetim ekranında
aylık maliyet raporu.

### 5.6 Fotoğraf akışı

1. AI `request_photo` döndürür → istemci kamera açar.
2. İstemci fotoğrafı **1024px kenara küçültür**, JPEG q=0.7, Storage'a yazar:
   `projects/{projectId}/aiSessions/{sessionId}/{n}.jpg`
3. `aiChecklistTurn` fotoğrafı okur, inline olarak modele verir.
4. Fotoğraf `taskInstance.results` içindeki ilgili maddeye ek olarak bağlanır —
   yani klasik moddaki fotoğraf eki ile **aynı yerde** durur.

---

## 6. Klasik mod ve geri düşüş

- Her checklist ekranının üstünde kalıcı bir **"Klasik forma geç"** düğmesi.
- Geçiş anında AI oturumundaki cevaplanmış maddeler klasik forma önceden
  doldurulmuş olarak taşınır, `modeSwitchedAt` yazılır.
- Otomatik düşüş tetikleyicileri: 10 sn timeout, HTTP 5xx, kota hatası,
  `navigator.onLine === false`, App Check hatası.
- Düşüş sessiz olmaz: "Yapay zeka yanıt vermedi, klasik kontrole geçildi"
  bildirimi + `aiSessions.status = 'hata_fallback'`.
- **Varsayılan mod ayarı** proje bazında: `ai_first` | `classic_first` | `classic_only`.
  Sahaya çıkışta `classic_only` ile başlanabilir; pilot ekipmanlarda `ai_first`.

---

## 7. Ekranlar

| Ekran | İçerik |
|---|---|
| `/qr/{token}` | Varlık kartı + aksiyon seçimi (bakım / arıza / bilgi) |
| Varlık listesi | Filtre: mahal, kategori, kritiklik, vadesi geçen |
| Varlık detayı | Künye, QR önizleme, bakım geçmişi, açık arızalar |
| Etiket basımı | Çoklu seçim → yazdırılabilir A4 grid |
| AI kontrol ekranı | Sohbet benzeri, tek soru + hızlı cevap butonları + ilerleme çubuğu |
| Özet ekranı | AI teşhisi, güven skoru, "Onayla / Düzelt / Reddet", arıza kaydı aç |
| Yönetim > AI | Mod ayarı, kota, aylık maliyet, düşüş oranı, en çok soru sorulan varlıklar |

Tasarım dili mevcut platformla aynı kalır (Park Kiremit `#B84B3E`, mineral ivory,
pine green). AI ekranı yeni bir tema getirmez.

---

## 8. Fazlar (her faz = 1 PR)

**Faz 0 — Zemin temizliği**
- Prod'daki Firestore yazma sorununu teşhis et (rules mi, App Check mi).
- Bulguyu `docs/firestore-write-issue.md` olarak yaz. Çözülmeden Faz 3'e geçme.
- Çıktı: teşhis raporu + varsa düzeltme PR'ı.

**Faz 1 — Varlık + QR altyapısı (AI yok)**
- `assets`, `qrIndex` koleksiyonları, rules, indexes.
- `qrResolve` callable, `/qr/{token}` route, `detectQrToken()`.
- Varlık CRUD ekranları, etiket basım sayfası.
- QR okutunca **klasik** checklist veya arıza formu açılır. Bu faz tek başına
  kullanılabilir olmalı.

**Faz 2 — Şablon ve sonuç birleştirme**
- `taskTemplates.checklistItems`'ı varlığa bağla.
- `taskInstances`'a `assetId`, `source`, `mode` alanları + geriye dönük migration.
- Mevcut Mahal Kontrol akışını yeni şemaya taşı (davranış değişmeden).

**Faz 3 — Gemini motoru (backend)**
- Secret Manager, `aiChecklistStart/Turn/Finalize`.
- Structured output, kapsam takibi, tur/maliyet sınırları.
- Emülatörde birim testleri: kapsam eksikken finalize edilemez.

**Faz 4 — AI checklist arayüzü**
- Sohbet ekranı, hızlı cevap butonları, ilerleme.
- Klasik moda geçiş düğmesi ve otomatik düşüş.

**Faz 5 — Fotoğraf ve teşhis**
- Kamera, küçültme, Storage, vision turu.
- Özet ekranı, insan onayı, arıza kaydı üretimi.

**Faz 6 — Yönetim ve ölçüm**
- Maliyet/kota paneli, düşüş oranı, AI önerisi kabul oranı.
- Pilot: 20 ekipman, 2 hafta, klasik modla karşılaştırma.

**Faz 7 — AI Uygunluk Denetçisi** → ayrı dosya: `parkplazaapp/AI-DENETCI-MODULU.md`
- Envanteri tarayıp hiç kontrol edilmemiş varlıkları, gecikmiş bakımları,
  şablonsuz ekipmanları ve fenni muayene gecikmelerini bulan yönetici modülü.
- 7a (deterministik tarayıcı) **Faz 1 biter bitmez başlayabilir** — checklist'in
  AI tarafını beklemesi gerekmez.

---

## 9. Kabul kriterleri

- [ ] Bir ekipmanın QR'ı okutulduğunda 3 saniye içinde varlık kartı açılır.
- [ ] AI modu kapalıyken uygulama bugünküyle **birebir aynı** çalışır.
- [ ] AI oturumu şablondaki hiçbir kritik maddeyi atlamadan tamamlanır;
      atlanmışsa `finalize` reddedilir.
- [ ] Ağ kesildiğinde kayıp veri olmadan klasik moda düşülür.
- [ ] Gemini anahtarı istemci paketinde (`dist/`) grep ile bulunamaz.
- [ ] AI hiçbir koşulda insan onayı olmadan görev kapatmaz veya arıza kaydı açmaz.
- [ ] Bir oturumun ortalama maliyeti kayıt altındadır ve panelde görünür.

## 10. Yapılmayacaklar (kapsam dışı)

- Sesli komut / sesten metin.
- Otomatik iş emri atama (dispatch mevcut haliyle kalır).
- Faaliyet Raporu aracıyla entegrasyon.
- Gemini'nin Firestore'a doğrudan yazması (function aracılığı zorunlu).

---

## 11. Başlatma promptu (Claude Code'a verilecek görev)

> Bu repoda `parkplazaapp/AI-CHECKLIST-PROJESI.md` dosyasını oku.
> `.claude/skills/` altındaki `facility-ops-schema`, `ai-checklist-engine` ve
> `qr-asset-registry` skill'lerini kullan.
> **Faz 0'dan başla.** Her fazın sonunda dur, değişiklikleri özetle, onay iste.
> Onay almadan bir sonraki faza geçme, onay almadan `main` dalına merge etme.
> Spesifikasyondaki bir karar yanlış veya eksik geliyorsa uygulamadan önce söyle.
