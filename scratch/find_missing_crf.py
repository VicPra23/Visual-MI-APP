import json

with open('stores_imei_real.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

stores = data.get('stores', [])
crf_stores = [s for s in stores if any(c in s.get('cuenta', '').lower() for c in ['carrefour', 'crf'])]
imei_keys = set(data.get('imei_db', {}).keys())

missing = []
for s in crf_stores:
    name = s.get('nombre')
    if name not in imei_keys:
        missing.append(name)

print(f"Total CRF stores: {len(crf_stores)}")
print(f"Missing in imei_db: {len(missing)}")
for m in missing:
    print(" ", m)
