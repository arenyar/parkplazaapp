# Kurulum — bu klasörle ne yapılacak

## 1. Dosyaları repoya yerleştir

Bu klasörün içeriğini ParkPlazaApp reposunun köküne kopyala:

```
ParkPlazaApp/
├── parkplazaapp/
│   ├── AI-CHECKLIST-PROJESI.md     ← ana spesifikasyon + görev tanımı
│   ├── AI-DENETCI-MODULU.md        ← Faz 7: uygunluk denetçisi
│   └── KURULUM.md
├── .claude/
│   ├── skills/
│   │   ├── ai-checklist-engine/SKILL.md
│   │   ├── qr-asset-registry/SKILL.md
│   │   ├── compliance-auditor/SKILL.md
│   │   └── facility-ops-schema/     ← zaten var, dokunma
│   └── agents/
│       ├── firebase-ops.md
│       └── github-flow.md
└── .github/workflows/ci.yml
```

Not: `.claude/` ve `.github/` klasörleri repo **kökünde** olmalı, `parkplazaapp/`
içinde değil. Yalnızca üç `.md` dosyası `parkplazaapp/` altında kalır.

## 2. Kontrol et

```bash
ls .claude/skills .claude/agents
```

`facility-ops-schema` ve `schema-migration-audit` zaten duruyor olmalı; yeni
gelen iki skill onların yanına eklenir.

## 3. Görevi başlat

Repo kökünde:

```bash
claude
```

Sonra bu promptu yapıştır:

```
parkplazaapp/AI-CHECKLIST-PROJESI.md ve parkplazaapp/AI-DENETCI-MODULU.md
dosyalarini oku.
.claude/skills altindaki facility-ops-schema, ai-checklist-engine,
qr-asset-registry ve compliance-auditor skill'lerini kullan; Firebase isleri
icin firebase-ops, dal/PR isleri icin github-flow ajanini kullan.

Faz 0'dan basla: prod'daki Firestore yazma sorununu teshis et ve
docs/firestore-write-issue.md dosyasini yaz.

Her fazin sonunda dur, degisiklikleri ozetle, onay iste. Onay almadan bir
sonraki faza gecme ve main'e merge etme. Spesifikasyondaki bir karar yanlis
veya eksik geliyorsa uygulamadan once soyle.
```

Tek satırda başlatmak istersen:

```bash
claude "parkplazaapp/AI-CHECKLIST-PROJESI.md dosyasini oku, Faz 0'dan basla, her fazin sonunda onay iste"
```

## 4. Faz 0 neden ilk sırada

Prodüksiyonda durum değişikliği ve silme kaydedilmiyor — muhtemelen Security
Rules veya App Check kaynaklı. Yeni callable'larda App Check'i zorunlu kılmadan
önce bu çözülmezse aynı hata yeni modüle taşınır ve "AI çalışmıyor" sanılır.

## 5. Iki modul, tek sira

`AI-CHECKLIST-PROJESI.md` sahadaki teknisyene bakar (QR → soru → teshis).
`AI-DENETCI-MODULU.md` yoneticiye bakar (ne eksik, ne gecikmis, once ne yapilmali).

Ikisi de Faz 1'deki varlik kayit defterine dayanir. Faz 1 bittikten sonra
denetci'nin 7a adimi (deterministik tarayici) checklist'in AI tarafiyla
**paralel** ilerleyebilir — birbirini beklemezler.
