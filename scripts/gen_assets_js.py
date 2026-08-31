import json

with open(r"C:\Users\parkp\Desktop\parkplaza-ops-center\scripts\assets_raw.json", encoding="utf-8") as f:
    rows = json.load(f)

KRITIK = {"Elektrik Sistemi", "Jeneratör", "Yangın Suyu Basınçlandırma Sistemi", "Yangın / Gaz Algılama ve İkaz Sistemi", "Chiller Sistemi", "Asansör", "Kesintisiz Güç Kaynağı"}
YUKSEK = {"Basınçlı Su Sistemi", "Havalandırma ve Klima Santrali", "Soğutma Kulesi", "Isıtma Sistemi", "Kapalı Devre Kamera ve Güvenlik Sistemi", "Kapı ve Geçiş Sistemi", "Cephe Temizleme Asansörü"}
ORTA = {"Otomatik Kapı", "Telefon Santrali", "Bilgisayar Sistemi", "TV Yayın Sistemi", "Ses ve Anons Sistemi", "Klima", "Temizlik Ekipmanı"}

def criticality(grup):
    if grup in KRITIK: return "Kritik"
    if grup in YUKSEK: return "Yüksek"
    if grup in ORTA: return "Orta"
    return "Düşük"

def esc(s):
    if s is None: return '""'
    return json.dumps(str(s), ensure_ascii=False)

lines = ["export const ASSETS = ["]
for r in rows:
    obj = (
        "  { id: " + esc(r["code"]) +
        ", name: " + esc(r["aciklama"] or r["grup"]) +
        ", category: " + esc(r["grup"]) +
        ", location: " + esc(r["mahal"]) +
        ", model: " + esc(r["model"]) +
        ", serial: " + esc(r["seri"]) +
        ", manufacturer: " + esc(r["marka"]) +
        ", power: " + esc(r["guc"]) +
        ", quantity: " + (str(r["adet"]) if r["adet"] is not None else "null") +
        ", installDate: \"\"" +
        ", criticality: " + esc(criticality(r["grup"])) +
        ", status: \"Aktif\"" +
        ", notes: " + esc(r["not_"]) +
        " },"
    )
    lines.append(obj)
lines.append("];")

with open(r"C:\Users\parkp\Desktop\parkplaza-ops-center\scripts\assets_js_output.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print("done", len(rows))
