#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sincronizador Directo con Feishu Cloud
Documento: https://mi.feishu.cn/wiki/WjYjwlp8Micxq4kXC24ceumanFG?sheet=4Tpt8O
Pestaña: LDUS DUMMY STOCK (sheet_id: 4Tpt8O)
"""

import sys
import json
import urllib.request
import urllib.error
import argparse

DEFAULT_WIKI_TOKEN = "WjYjwlp8Micxq4kXC24ceumanFG"
DEFAULT_SHEET_ID = "4Tpt8O"

def get_tenant_access_token(app_id: str, app_secret: str) -> str:
    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    payload = json.dumps({"app_id": app_id, "app_secret": app_secret}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("code") != 0:
                raise RuntimeError(f"Error obteniendo token ({data.get('code')}): {data.get('msg')}")
            return data["tenant_access_token"]
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")

def get_spreadsheet_token(wiki_token: str, tenant_token: str) -> str:
    url = f"https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token={wiki_token}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {tenant_token}"})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("code") == 0 and "data" in data and "node" in data["data"]:
                return data["data"]["node"].get("obj_token", wiki_token)
            return wiki_token
    except Exception:
        return wiki_token

def read_sheet_header(spreadsheet_token: str, sheet_id: str, tenant_token: str):
    range_name = f"{sheet_id}!A1:J2"
    url = f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{spreadsheet_token}/values/{urllib.parse.quote(range_name)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {tenant_token}"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        if data.get("code") != 0:
            raise RuntimeError(f"Error leyendo hoja ({data.get('code')}): {data.get('msg')}")
        return data.get("data", {}).get("valueRange", {}).get("values", [])

def update_feishu_cells(spreadsheet_token: str, sheet_id: str, updates: list, tenant_token: str):
    """
    updates: list of dicts: {'row': int, 'imei': str, 'estado': str, 'observacion': str}
    """
    url = f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{spreadsheet_token}/values_batch_update"
    value_ranges = []
    for u in updates:
        row = u.get("row")
        if not row or row < 2:
            continue
        # Columna G (IMEI) y H (Estado)
        value_ranges.append({
            "range": f"{sheet_id}!G{row}:H{row}",
            "values": [[str(u.get("imei", "")), u.get("estado", "Disponible en tienda")]]
        })
        if u.get("observacion"):
            value_ranges.append({
                "range": f"{sheet_id}!J{row}:J{row}",
                "values": [[str(u.get("observacion"))]]
            })

    if not value_ranges:
        return {"count": 0, "status": "no updates"}

    payload = json.dumps({"valueRanges": value_ranges}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={
        "Authorization": f"Bearer {tenant_token}",
        "Content-Type": "application/json; charset=utf-8"
    })
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        if data.get("code") != 0:
            raise RuntimeError(f"Error escribiendo en hoja Feishu ({data.get('code')}): {data.get('msg')}")
        return data

def main():
    parser = argparse.ArgumentParser(description="Feishu Cloud Direct Sync")
    parser.add_argument("--app-id", help="Feishu App ID (cli_...)")
    parser.add_argument("--app-secret", help="Feishu App Secret")
    parser.add_argument("--wiki-token", default=DEFAULT_WIKI_TOKEN, help="Wiki Node Token")
    parser.add_argument("--sheet-id", default=DEFAULT_SHEET_ID, help="Sheet Tab ID")
    parser.add_argument("--test", action="store_true", help="Test connection to sheet")
    args = parser.parse_args()

    if not args.app_id or not args.app_secret:
        print("Uso:")
        print("  python feishu_cloud_sync.py --app-id <cli_...> --app-secret <...> --test")
        sys.exit(1)

    print(f"1. Solicitando tenant_access_token para {args.app_id}...")
    token = get_tenant_access_token(args.app_id, args.app_secret)
    print("   ✅ Token obtenido con éxito.")

    print(f"2. Resolviendo documento Wiki ({args.wiki_token})...")
    sheet_token = get_spreadsheet_token(args.wiki_token, token)
    print(f"   ✅ Spreadsheet Token: {sheet_token}")

    print(f"3. Verificando lectura de pestaña '{args.sheet_id}' (LDUS DUMMY STOCK)...")
    rows = read_sheet_header(sheet_token, args.sheet_id, token)
    print(f"   ✅ Lectura exitosa. Cabeceras: {rows[0] if rows else 'N/A'}")
    print("\n🚀 ¡La conexión con Feishu Cloud está 100% activa y lista para sincronización directa!")

if __name__ == "__main__":
    main()
