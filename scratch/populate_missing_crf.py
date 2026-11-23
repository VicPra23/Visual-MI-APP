import json

with open('stores_imei_real.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

missing_stores = ['SAN FERNANDO', 'LEGANES', 'SAN JAVIER', 'VECINDARIO', 'ALMERIA']

# Template from CRF PETRER
template_devices = [
    { "posicion": 1, "tipologia": "LDU", "isDummy": False, "modelo": "Redmi 15C", "imei": "869290000000000" },
    { "posicion": 2, "tipologia": "LDU", "isDummy": False, "modelo": "REDMI Pad 2 Pro", "imei": "70399/Y5VW00984" },
    { "posicion": 3, "tipologia": "LDU", "isDummy": False, "modelo": "REDMI Pad 2", "imei": "65573/W5RA01577" },
    { "posicion": 4, "tipologia": "LDU", "isDummy": False, "modelo": "REDMI Pad 2", "imei": "65573/W5RA00468" },
    { "posicion": 5, "tipologia": "LDU", "isDummy": False, "modelo": "Redmi Note 15 Pro 5G", "imei": "862540000000000" },
    { "posicion": 6, "tipologia": "LDU", "isDummy": False, "modelo": "REDMI Note 17 5G", "imei": "862730000000000" },
    { "posicion": 7, "tipologia": "Dummy", "isDummy": True, "modelo": "REDMI 17 4G Dummy", "imei": "" },
    { "posicion": 8, "tipologia": "LDU", "isDummy": False, "modelo": "REDMI 17 4G", "imei": "868510000000000" }
]

stores_dict = {s['nombre']: s for s in data.get('stores', [])}

for name in missing_stores:
    s_info = stores_dict.get(name, {})
    devs = []
    safe_name = name.replace(" ", "_").upper()
    for t in template_devices:
        devs.append({
            "id": f"dev_{safe_name}_m1_p{t['posicion']}",
            "tienda": name,
            "cuenta": s_info.get("cuenta", "Carrefour"),
            "rms": s_info.get("rms", ""),
            "usuario": s_info.get("usuario", ""),
            "mesa": "Mesa 1",
            "posicion": t['posicion'],
            "tipologia": t['tipologia'],
            "isDummy": t['isDummy'],
            "modelo": t['modelo'],
            "codigo": "",
            "imei": t['imei'],
            "imeiOriginal": t['imei'],
            "motivoCambio": "",
            "tipoAccion": "",
            "modeloAnterior": "",
            "imeiAnterior": "",
            "observacionCambio": "",
            "fechaModificacion": ""
        })
    data['imei_db'][name] = devs
    print(f"Added {len(devs)} devices for {name}")

with open('stores_imei_real.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

with open('stores_imei_real.js', 'w', encoding='utf-8') as f:
    f.write('window.REAL_STORES_DATA = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')

print("Updated stores_imei_real.json and stores_imei_real.js successfully!")
