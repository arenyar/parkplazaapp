import openpyxl, json

wb = openpyxl.load_workbook(r"C:\Users\parkp\Desktop\Park Plaza\Park_Plaza_Makine_Elektronik_Techizat_Asset_List.xlsx", data_only=True)
ws = wb["Asset Listesi"]

rows = list(ws.iter_rows(min_row=2, values_only=True))
out = []
for r in rows:
    if not r or not r[0]:
        continue
    code, ana_grup, grup, aciklama, marka, model, guc, adet, mahal, seri, not_ = (list(r) + [None] * 11)[:11]
    out.append({
        "code": code,
        "anaGrup": ana_grup,
        "grup": grup,
        "aciklama": aciklama,
        "marka": marka,
        "model": model,
        "guc": guc,
        "adet": adet,
        "mahal": mahal,
        "seri": seri,
        "not_": not_,
    })

with open(r"C:\Users\parkp\Desktop\parkplaza-ops-center\scripts\assets_raw.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print("rows:", len(out))
groups = sorted(set(x["grup"] for x in out if x["grup"]))
print("distinct grup values:", groups)
