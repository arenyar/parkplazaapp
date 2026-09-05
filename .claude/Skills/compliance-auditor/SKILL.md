---
name: compliance-auditor
description: Park Plaza Facility OS'un uygunluk denetçisi için referans — hiç kontrol edilmemiş varlıkların, gecikmiş bakımların, şablonsuz ekipmanların ve fenni muayene gecikmelerinin taranması, risk skorlaması ve Gemini ile yönetici raporu üretilmesi. Envanter taraması, eksik/gecikmiş bakım raporu, uygunluk paneli, complianceScans koleksiyonu, denetim/ISO raporu veya "hangi ekipman hiç kontrol edilmemiş" tipi işlerde MUTLAKA kullan. Kullanıcı "denetle", "eksikleri bul", "hangi bakımlar yapılmamış", "rapor çıkar" dediğinde de bu skill'i aç.
---

# Uygunluk denetçisi

> **UYARLANMIŞ MİMARİ — ÖNEMLİ:** Bu dosyadaki `complianceScans`
> koleksiyonu, Firestore composite sorguları, Remote Config ağırlıkları,
> 500'lük sayfalama ve zamanlanmış (Cloud Function) tarama BU PROJENİN
> GERÇEK MİMARİSİYLE UYUŞMUYOR. Gerçekte uygulanan (Faz 7a/7c, kullanıcı
> teyidiyle "AI/Gemini işlerini sona bırak" — Gemini yorumlayıcı katmanı
> hiç yapılmadı, sadece deterministik katman-1 var): tarama
> `src/lib/complianceScan.js`'te İSTEMCİDE, `state` üzerinden anlık
> hesaplanıyor (admin "Taramayı Çalıştır" tıklar), sonuç
> `state.complianceScans` dizisine (son 30) yazılıyor; ağırlıklar KODA
> SABİT (Remote Config yok); onay akışı `src/components/
> ComplianceScanPanel.jsx`'te AI'siz — admin doğrudan "Görev Oluştur"/
> "Reddet" kararı verir. **Bilinçli sapma:** reddedilen bir bulgu
> SONRAKİ taramalardan gizlenmez (aşağıdaki "Onay akışı" bölümünün
> aksine) — deterministik bir tarayıcıda hâlâ geçerli bir olguyu (ör.
> hâlâ etiketsiz) reddedildi diye gizlemek ISO denetiminde savunulamaz;
> bunun yerine ret gerekçesi bulgunun yanında görünür kalır. G6/G9/G10
> bu projede karşılığı olmadığı için uygulanmadı (gerekçe kod içi
> yorumlarda). "mail-ozeti" biçimi bu repoda henüz yok — haftalık özet
> maili hâlâ bekliyor (hangi mail servisi kullanıldığı netleşmedi).

Envanteri tarar, boşlukları bulur, yöneticiye önceliklendirilmiş eylem planı
sunar. Tam spesifikasyon: `parkplazaapp/AI-DENETCI-MODULU.md`.
Veri modeli için `facility-ops-schema`, varlık tarafı için `qr-asset-registry`.

## Birinci kural: sayan AI değil

Boşlukları **Firestore sorguları** bulur, risk skorunu **kod** hesaplar.
Gemini yalnızca yorumlar, önceliklendirir ve eylem planı yazar.

Bir dil modelinden tarih karşılaştırması veya sayım istemek pahalı, yavaş ve
ISO denetiminde savunulamaz. Panel sayıları AI'siz de doğru olmalı.

Prompt'ta açıkça yaz: *"Hiçbir sayıyı kendin hesaplama veya tahmin etme.
Veri setinde olmayan bir varlıktan söz etme."*

## İkinci kural: doğrulama katmanı zorunlu

Model çıktısındaki tüm `assetIds`, girdi veri setiyle karşılaştırılır. Eşleşmeyen
ID içeren madde rapordan **düşürülür**, `validation.unknownAssetIds` artar.
Bu adımı atlama — halüsinasyonun ISO denetim dosyasına girmesini engelleyen
tek mekanizma budur.

## Boşluk tipleri

G1 hiç kontrol edilmemiş · G2 vadesi geçmiş · G3 yaklaşan · G4 şablonsuz varlık ·
G5 etiketsiz · G6 eksik kapatılmış görev · G7 fenni muayene gecikmesi ·
G8 tekrarlayan arıza · G9 askıda AI bulgusu · G10 sözleşme kapsamı boşluğu

**G4 en sinsi olanı:** sistem o varlığı hiç hatırlatmıyor, dolayısıyla G2'de de
görünmüyor. Panelde öne çıkar.

**G7 asla diğerleriyle aynı listede sunulmaz** — yasal zorunluluk, ayrı başlık,
ayrı bildirim kanalı (şema kararı 6).

## Risk skoru

```
risk = kritiklik(5/3/1) × gecikme(1+gun/30, max 4)
       × ariza(1+90gunSayi×0.5, max 3) × kapsam(sablonsuz 1.5)
```
Bantlar: ≥40 acil · 20–39 yüksek · 8–19 orta · <8 izle
Ağırlıklar Remote Config'te (`audit.weights.*`), koda sabitlenmez.

## Performans

`assets` üzerindeki denormalize `lastTaskAt` / `nextDueAt` alanlarını kullan;
`taskInstances` tam taraması yapma. 500'lük partiler halinde oku.
Tarama başına **tek** Gemini çağrısı — varlık başına çağrı yapma.

## Onay akışı

AI plan önerir, sistem görev açmaz. Yönetici: Onayla / Ertele / Reddet.
Reddedilen öneri gerekçesiyle saklanır ve bir sonraki taramanın promptuna
girer — aynı öneri her hafta tekrarlanmaz.

## Gürültü kontrolü

Aynı bulgu kapatılana kadar en fazla haftada bir bildirilir. Acil bant ve G7
istisna. Haftalık özet mevcut `mail-ozeti` biçimiyle uyumlu olmalı, yeni mail
altyapısı kurma.

## Yasak

- Personel/ekip performansı hakkında yorum
- Onaysız görev oluşturma
- Panelin AI'ye bağımlı hale gelmesi (Gemini kapalıyken panel tam çalışmalı)
