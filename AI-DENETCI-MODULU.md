# Modül: AI Uygunluk Denetçisi (Faz 7)

> Ana spesifikasyonun eki: `parkplazaapp/AI-CHECKLIST-PROJESI.md`
> Bu modül, sistemi **yöneten** tarafa bakar: hangi ekipman hiç kontrol edilmemiş,
> hangi bakım periyodu kaçmış, hangi risk sessizce büyüyor.

---

## 0. Amaç

Her gece tüm varlık envanteri taranır, boşluklar **deterministik olarak** bulunur,
Gemini bu boşlukları yorumlar, önceliklendirir ve yöneticiye eylem planı önerir.

Örnek çıktı cümlesi: *"B2 mekanik odadaki 3 numaralı sirkülasyon pompası 14 aydır
hiç kontrol edilmemiş; aynı odadaki eş pompada son 90 günde 2 arıza kaydı var —
bu ikisi aynı hattı besliyor, önce bu pompaya bakılmalı."*

---

## 1. En kritik tasarım kararı: sayan AI değil

**Gemini eksikleri bulmaz. Eksikleri sorgu bulur, Gemini yorumlar.**

Gerekçe: "hangi varlığın bakımı gecikmiş" sorusunun cevabı bir tarih
karşılaştırmasıdır. Bunu bir dil modeline yaptırmak hem pahalı, hem yavaş, hem
de yanlış sayı üretme riski taşır — ISO denetiminde savunulamaz.

Bu yüzden akış iki katmanlı:

```
Katman 1 (deterministik, Cloud Function)
  Firestore sorguları → boşluk veri seti + risk skorları
  → Bu veri seti tek başına doğrudur ve ekranda ham haliyle gösterilir.

Katman 2 (Gemini, tek çağrı)
  Veri setini alır → önceliklendirir, örüntü kurar, eylem planı yazar
  → Sayı üretmesi YASAK. Sadece veri setindeki sayıları kullanır.
```

Rapor ekranında her AI cümlesinin yanında dayandığı ham veriye link olur.
Kullanıcı "bu iddia nereden geliyor?" diye sorabilmelidir.

---

## 2. Tespit edilen boşluk tipleri

| # | Tip | Sorgu mantığı | Neden önemli |
|---|---|---|---|
| G1 | **Hiç kontrol edilmemiş varlık** | `assets` içinde hiç `taskInstance` bulunmayan | En büyük kör nokta |
| G2 | **Vadesi geçmiş bakım** | `nextDueAt < now` | Klasik gecikme |
| G3 | **Yaklaşan bakım** | `nextDueAt` 7 / 30 gün içinde | Önleyici uyarı |
| G4 | **Şablonsuz varlık** | `taskTemplateIds` boş | Sistem bu varlığı hiç hatırlatmıyor — **sessiz risk, G1'den tehlikeli** |
| G5 | **Etiketsiz varlık** | `qr.printedAt` yok | Sahada okutulamaz |
| G6 | **Eksik kapatılmış görev** | `results` içinde kritik madde cevapsızken `tamamlandi` | Kağıt üstünde yapılmış |
| G7 | **Fenni muayene gecikmesi** | `inspectionRecords.nextDueAt < now` | **Yasal yükümlülük** — ayrı kanal |
| G8 | **Tekrarlayan arıza** | 90 günde ≥3 `request` aynı varlıkta | Kök neden var, bakım yetersiz |
| G9 | **Askıda AI bulgusu** | `aiSuggestion.severity='acil'` + `accepted` boş >7 gün | Öneri okunmamış |
| G10 | **Sözleşme kapsamı boşluğu** | Sözleşmede taahhüt edilip yapılmayan bakım | Yükleniciye rücu hakkı |

G7 asla diğerleriyle aynı listede sunulmaz — yasal zorunluluk kendi bölümünde,
kendi renginde gösterilir (şema kararı 6: fenni muayene bakımdan ayrıdır).

---

## 3. Risk skoru (deterministik)

```
risk = kritiklikAgirligi × gecikmeCarpani × arizaCarpani × kapsamCarpani

kritiklikAgirligi : kritik=5 · onemli=3 · normal=1
gecikmeCarpani    : 1 + (gecikmeGun / 30), üst sınır 4
                    hiç kontrol edilmemişse: kurulumdan bu yana geçen süre
arizaCarpani      : 1 + (son 90 gün arıza sayısı × 0.5), üst sınır 3
kapsamCarpani     : şablonsuz varlık = 1.5, diğer = 1
```

Skor koda gömülür, AI değiştiremez. Ağırlıklar Remote Config'ten ayarlanabilir
(`audit.weights.*`) — bir tesiste asansör kritik, başkasında jeneratör.

Bantlar: **≥40 acil** · **20–39 yüksek** · **8–19 orta** · **<8 izle**

---

## 4. Veri modeli

`/projects/{projectId}/complianceScans/{scanId}`

```ts
{
  runAt: Timestamp;
  scope: 'tum_tesis' | 'birim' | 'kategori';
  scopeRef?: string;
  totals: {
    assetCount: number;
    neverChecked: number;      // G1
    overdue: number;           // G2
    dueSoon: number;           // G3
    withoutTemplate: number;   // G4
    unlabeled: number;         // G5
    incompleteClosed: number;  // G6
    inspectionOverdue: number; // G7
    repeatFailure: number;     // G8
    staleSuggestions: number;  // G9
    contractGap: number;       // G10
  };
  findings: Array<{
    gapType: 'G1'|'G2'|...;
    assetId: string;
    assetName: string;         // denormalize
    locationName: string;
    criticality: string;
    lastCheckedAt: Timestamp | null;
    overdueDays: number | null;
    failureCount90d: number;
    risk: number;
    band: 'acil'|'yuksek'|'orta'|'izle';
  }>;                          // en yüksek riskli 200 kayıt (tamamı ayrı sayfada)
  ai: {
    executiveSummary: string;  // 5-8 cümle, yönetici için
    patterns: Array<{ title: string; explanation: string; assetIds: string[] }>;
    actionPlan: Array<{
      priority: number;
      title: string;
      assetIds: string[];
      reason: string;
      suggestedTemplateId?: string;
      estimatedEffort?: 'dusuk'|'orta'|'yuksek';
    }>;
    model: string;
    usage: { promptTokens: number; outputTokens: number };
    validation: { citedAssetIds: number; unknownAssetIds: number };
  };
  status: 'olusturuldu' | 'incelendi' | 'aksiyona_alindi';
  reviewedBy?: string;
}
```

Tarama sonuçları sınırsız büyür → ayrı koleksiyon. `findings` bir taramada
sınırlı → gömülü array (şema kuralı 3). 200'ü aşarsa `findingsOverflow`
alt-koleksiyonuna taşınır.

---

## 5. Cloud Functions

| Fonksiyon | Tetik | İş |
|---|---|---|
| `complianceScanDaily` | scheduler 03:00 TRT | Deterministik tarama + skorlama, `complianceScans` yaz |
| `complianceNarrate` | scan sonrası | Gemini ile özet + eylem planı |
| `complianceScanNow` | callable | Yönetici elle tetikler (kota: 3/gün) |
| `complianceApplyPlan` | callable | Onaylanan plandan **toplu görev oluştur** |
| `complianceWeeklyDigest` | scheduler pazartesi 07:00 | Yönetici e-postası |

`complianceScanDaily` sayfalı okur (500'lük parti), 5000 varlığa kadar tek
çalıştırmada biter. Firestore okuma maliyetini düşürmek için `assets` üzerinde
`lastTaskAt` ve `nextDueAt` denormalize alanları kullanılır — `taskInstances`
tam taraması yapılmaz.

---

## 6. Gemini promptu

**Girdi:** toplamlar + en riskli 200 bulgu (JSON) + tesis bağlamı (kaç bina,
hangi kategoriler) + bir önceki taramanın özeti (neyin düzeldiğini görsün).

**Sistem promptu özeti:**

> Sen bir tesis yönetimi denetçisisin. Sana verilen veri setini yorumla.
> **Hiçbir sayıyı kendin hesaplama, üretme veya tahmin etme** — yalnızca veri
> setindeki değerleri kullan. Veri setinde olmayan bir varlıktan söz etme.
> Türkçe, yöneticiye hitap eden, suçlayıcı olmayan bir dil kullan.
> Amacın kimi suçlamak değil, neyin önce yapılması gerektiğini göstermek.

**Kısıtlar:**
- Yönetici özeti en fazla 8 cümle.
- Eylem planı en fazla 10 madde, önceliklendirilmiş.
- Her maddede *neden* bu sırada olduğu tek cümleyle açıklanmalı.
- Örüntü kurarken (aynı mahal, aynı marka, aynı ekip, aynı dönem) veri setindeki
  alanlara dayan; sezgiyle bağlantı kurma.
- Fenni muayene gecikmelerini ayrı başlıkta, yasal dil ile ver.
- Kişi/ekip performansı hakkında yorum yapma.

**Doğrulama (post-process, zorunlu):** modelin ürettiği tüm `assetIds` veri
setiyle karşılaştırılır. Veri setinde olmayan bir ID varsa o madde rapordan
düşürülür ve `validation.unknownAssetIds` artar. Bu sayı 0'dan büyükse rapor
ekranında uyarı gösterilir.

Maliyet: tarama başına **tek** Gemini çağrısı. Varlık başına çağrı yapılmaz.

---

## 7. Eylem planı → görev üretimi

AI plan **önerir**, sistem kendiliğinden görev açmaz.

Yönetici ekranında her plan maddesi için: **Onayla · Ertele · Reddet**
Onaylananlar `complianceApplyPlan` ile toplu `taskInstance` üretir
(`source: 'compliance_plan'`, `planId` referansı). Reddedilenlere gerekçe girilir —
bir sonraki taramanın promptuna "bu daha önce şu gerekçeyle reddedildi" olarak
gider, böylece sistem aynı öneriyi her hafta tekrarlamaz.

G4 (şablonsuz varlık) için özel akış: AI, `equipmentCatalog` ve
`systemTaskTemplates` içinden uygun şablonu **önerir**, yönetici tek tıkla bağlar.
Envanterin en hızlı kapanan boşluğu budur.

---

## 8. Ekranlar

| Ekran | İçerik |
|---|---|
| **Uygunluk paneli** | 10 boşluk tipinin sayaçları, risk bandı dağılımı, trend (son 12 tarama) |
| **Bulgu listesi** | Filtre: tip, bant, mahal, kategori · sıralama: risk · dışa aktarım CSV |
| **AI raporu** | Yönetici özeti, örüntüler, eylem planı, her madde ham veriye linkli |
| **Varlık detayı** | Mevcut ekrana "denetim geçmişi" sekmesi |
| **ISO denetim dosyası** | Aylık: tarama geçmişi + kapatılan boşluklar + açık kalanların gerekçesi |

Trend grafiği önemli: yönetici için asıl soru "kaç eksik var" değil,
**"eksikler artıyor mu azalıyor mu"**.

---

## 9. Bildirim

- **Acil bant** (≥40) veya G7 (fenni muayene): aynı gün, yönetime bildirim.
- **Haftalık özet**: pazartesi 07:00, `yonetim@parkplazamaslak.com` — mevcut
  `mail-ozeti` skill'inin biçimiyle uyumlu, ayrı bir mail altyapısı kurma.
- WhatsApp deep-link köprüsü zaten araştırılmıştı; acil bildirimde opsiyonel.
- **Gürültü kontrolü:** aynı bulgu kapatılana kadar en fazla haftada bir kez
  bildirilir. Denetçinin en hızlı öldüğü yer, her gün aynı 40 satırı yollamasıdır.

---

## 10. Kabul kriterleri

- [ ] Tarama 500 varlıkta 60 saniyenin altında biter.
- [ ] Panel sayıları, aynı sorguların elle çalıştırılmasıyla birebir eşleşir.
- [ ] AI raporundaki her varlık iddiası veri setinde doğrulanabilir;
      `unknownAssetIds = 0`.
- [ ] Gemini kapalıyken panel ve bulgu listesi **tam çalışır** (yalnızca yorum yoktur).
- [ ] Reddedilen bir öneri, gerekçesiyle birlikte tekrar üretilmez.
- [ ] Hiçbir görev yönetici onayı olmadan oluşturulmaz.
- [ ] Rapor kişi/ekip performansı hakkında yorum içermez.

## 11. Kapsam dışı

- Personel performans skorlaması.
- Bütçe/maliyet tahmini (bütçe modülü ayrı).
- Yükleniciye otomatik bildirim veya ceza hesabı (G10 yalnızca raporlar).

---

## 12. Fazlar

**Faz 7a — Deterministik tarayıcı.** Sorgular, skorlama, `complianceScans`,
panel ve bulgu listesi. AI yok. Bu tek başına teslim edilebilir ve zaten
bugün elde olmayan bilgiyi verir.

**Faz 7b — AI yorumlayıcı.** `complianceNarrate`, doğrulama katmanı, rapor ekranı.

**Faz 7c — Eylem planı ve bildirim.** Onay akışı, toplu görev üretimi,
haftalık e-posta, ret gerekçesi hafızası.

> Faz 7a, Faz 1 (varlık + QR altyapısı) biter bitmez başlayabilir —
> checklist'in AI tarafını (Faz 3–5) beklemesi gerekmez.
