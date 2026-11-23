with open('index.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# 1. Bump version in index.html
content = content.replace("v223_hoja_ruta_mesas_cuadre", "v224_alcampo_carrefour_3d_tables")

# 2. Insert new cluster tabs in index.html
target_after_c3 = """                        <button type="button" class="cluster-tab-btn" id="tab-btn-cluster3" onclick="window.switchClusterTab(3)" style="padding: 9px 14px; font-size: 13px; font-weight: 700; border: none; background: transparent; border-bottom: 3px solid transparent; color: #666; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                            <i class="fas fa-table"></i> 3 Mesas <span id="count-badge-cluster3" style="background: #f0f0f0; color: #666; padding: 2px 7px; border-radius: 20px; font-size: 10.5px;">0</span>
                        </button>"""

new_tabs_html = """                        <button type="button" class="cluster-tab-btn" id="tab-btn-cluster3" onclick="window.switchClusterTab(3)" style="padding: 9px 14px; font-size: 13px; font-weight: 700; border: none; background: transparent; border-bottom: 3px solid transparent; color: #666; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                            <i class="fas fa-table"></i> 3 Mesas <span id="count-badge-cluster3" style="background: #f0f0f0; color: #666; padding: 2px 7px; border-radius: 20px; font-size: 10.5px;">0</span>
                        </button>
                        <button type="button" class="cluster-tab-btn" id="tab-btn-alcampo" onclick="window.switchClusterTab('alcampo')" style="padding: 9px 14px; font-size: 13px; font-weight: 700; border: none; background: transparent; border-bottom: 3px solid transparent; color: #666; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                            <i class="fas fa-shopping-basket" style="color: #dc2626;"></i> Alcampo <span id="count-badge-alcampo" style="background: #fee2e2; color: #b91c1c; padding: 2px 7px; border-radius: 20px; font-size: 10.5px;">9 Tiendas</span>
                        </button>
                        <button type="button" class="cluster-tab-btn" id="tab-btn-carrefour" onclick="window.switchClusterTab('carrefour')" style="padding: 9px 14px; font-size: 13px; font-weight: 700; border: none; background: transparent; border-bottom: 3px solid transparent; color: #666; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                            <i class="fas fa-store" style="color: #2563eb;"></i> Carrefour <span id="count-badge-carrefour" style="background: #dbeafe; color: #1d4ed8; padding: 2px 7px; border-radius: 20px; font-size: 10.5px;">62 Tiendas</span>
                        </button>
                        <button type="button" class="cluster-tab-btn" id="tab-btn-carrefour_premium" onclick="window.switchClusterTab('carrefour_premium')" style="padding: 9px 14px; font-size: 13px; font-weight: 700; border: none; background: transparent; border-bottom: 3px solid transparent; color: #666; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
                            <i class="fas fa-gem" style="color: #ea580c;"></i> Carrefour Premium <span style="background: #ffedd5; color: #c2410c; padding: 2px 7px; border-radius: 20px; font-size: 10.5px;">Cabecera 3D</span>
                        </button>"""

if target_after_c3 in content:
    content = content.replace(target_after_c3, new_tabs_html, 1)
    print("Added new cluster tabs to index.html")
else:
    print("Warning: target_after_c3 not found in index.html")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

# 3. Update sw.js
with open('sw.js', 'r', encoding='utf-8', errors='ignore') as f:
    sw_content = f.read()

sw_content = sw_content.replace("xiaomi-visual-app-v223", "xiaomi-visual-app-v224")

posm_to_cache = """    './img/posm/lightbox_alcampo_crf_note15.png',
    './img/posm/cabecera_crf_premium_note15.png',
    './img/posm/prop_17_note_crf_premium.png',"""

if "'./img/posm/lightbox_alcampo_crf_note15.png'" not in sw_content:
    idx_urls = sw_content.find("urlsToCache = [")
    if idx_urls != -1:
        insert_pt = sw_content.find("\n", idx_urls) + 1
        sw_content = sw_content[:insert_pt] + posm_to_cache + "\n" + sw_content[insert_pt:]
        print("Added new POSM images to sw.js urlsToCache")

with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw_content)

print("Updated index.html and sw.js successfully!")
