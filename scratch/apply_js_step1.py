import sys

with open('main_v130.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# 1. Update RETAIL_DEVICE_IMAGES with Note 15 / Note 14 aliases
marker_images = "// Catálogo de imágenes reales oficiales"
if "Redmi Note 15 Pro+ 5G" not in content:
    idx_target = content.find("'RN 17 Pro Max 5G':")
    if idx_target != -1:
        insert_images = """    // Redmi Note 15 Series & Hypermarket
    'Redmi Note 15 Pro+ 5G': { front: 'img/devices/rn17_promax_front.webp', back: 'img/devices/rn17_promax_back.webp' },
    'Redmi Note 15 Pro + 5G': { front: 'img/devices/rn17_promax_front.webp', back: 'img/devices/rn17_promax_back.webp' },
    'Redmi Note 15 Pro 5G':  { front: 'img/devices/rn17_pro_front.webp',    back: 'img/devices/rn17_pro_back.webp' },
    'Redmi Note 15 5G':      { front: 'img/devices/rn17_5g_front.webp',     back: 'img/devices/rn17_5g_back.webp' },
    'Redmi Note 15 4G':      { front: 'img/devices/redmi_17_4g_front.webp', back: 'img/devices/redmi_17_4g_back.webp' },
    'REDMI Note 17 5G':      { front: 'img/devices/rn17_5g_front.webp',     back: 'img/devices/rn17_5g_back.webp' },
    'Redmi Note 14 Pro+':    { front: 'img/devices/rn17_promax_front.webp', back: 'img/devices/rn17_promax_back.webp' },
    'Redmi Note 14 Pro':     { front: 'img/devices/rn17_pro_front.webp',    back: 'img/devices/rn17_pro_back.webp' },
    'Redmi Note 14 5G':      { front: 'img/devices/rn17_5g_front.webp',     back: 'img/devices/rn17_5g_back.webp' },
    'Redmi Note 14 4G':      { front: 'img/devices/redmi_17_4g_front.webp', back: 'img/devices/redmi_17_4g_back.webp' },
    'Redmi 14C':             { front: 'img/devices/redmi_15c_front.webp',   back: 'img/devices/redmi_15c_back.webp' },
    'Redmi 13C':             { front: 'img/devices/redmi_15c_front.webp',   back: 'img/devices/redmi_15c_back.webp' },
    'X17T':                  { front: 'img/devices/xiaomi_17t_front.webp',  back: 'img/devices/xiaomi_17t_back.webp' },
"""
        content = content[:idx_target] + insert_images + content[idx_target:]
        print("Updated RETAIL_DEVICE_IMAGES")

# 2. Update renderRetailSlot signature & implementation
target_slot_sig = "window.renderRetailSlot = function({\n    model,\n    badgeColor = 'orange',\n    typeBadge = 'LDU',\n    deviceType = 'phone',\n    color = 'blue',\n    specs = '',\n    isHero = false\n}) {"
replacement_slot_sig = """window.renderRetailSlot = function({
    model,
    badgeColor = 'orange',
    typeBadge = 'LDU',
    deviceType = 'phone',
    color = 'blue',
    specs = '',
    isHero = false,
    promoTag = null,
    energyRating = null,
    acrylicStand = null,
    imei = ''
}) {"""
if target_slot_sig in content:
    content = content.replace(target_slot_sig, replacement_slot_sig, 1)
    print("Updated renderRetailSlot signature")
else:
    print("Warning: target_slot_sig not found directly, checking variations...")

target_slot_return = """    // Sin etiquetas blancas: solo el badge compacto integrado en la peana
    return `
        <div class="device-3d-volume" onclick="window.open3DDeviceModal('${safeModel}', '${badgeColor === 'green' ? 'phone-theme-green' : 'phone-theme-blue'}', '${typeBadge}', '${modalDevType}')" title="${model} (${typeBadge}) - Clic para ver 3D interactivo">
            <div class="pedestal-3d-wedge">
                ${deviceHtml}
                <div class="pedestal-3d-base"></div>
            </div>
            <div class="spiral-3d-cord"></div>
            <div class="retail-product-badge retail-badge-${badgeColor}">
                <span class="retail-badge-model">${model}</span>
                <span class="retail-badge-type">${typeBadge}</span>
            </div>
        </div>
    `;"""

replacement_slot_return = """    const badgeText = promoTag || typeBadge;
    const badgeClass = promoTag ? 'retail-badge-promo-red' : `retail-badge-${badgeColor}`;
    const energyHtml = energyRating ? `<div class="eu-energy-tag class-${String(energyRating).toLowerCase().includes('b') ? 'b' : (String(energyRating).toLowerCase().includes('c') ? 'c' : 'a')}"><i class="fas fa-bolt"></i> ${energyRating}</div>` : '';
    const acrylicHtml = acrylicStand ? `<div class="acrylic-spec-holder" title="${specs || model}">${acrylicStand}</div>` : '';
    const clickTitle = imei ? `${model} (${typeBadge}) - IMEI: ${imei} - Clic para ver 3D interactivo` : `${model} (${typeBadge}) - Clic para ver 3D interactivo`;

    return `
        <div class="device-3d-volume" onclick="window.open3DDeviceModal('${safeModel}', '${badgeColor === 'green' ? 'phone-theme-green' : 'phone-theme-blue'}', '${typeBadge}', '${modalDevType}')" title="${clickTitle}">
            <div class="pedestal-3d-wedge">
                ${deviceHtml}
                <div class="pedestal-3d-base"></div>
                ${energyHtml}
            </div>
            <div class="spiral-3d-cord"></div>
            <div class="retail-product-badge ${badgeClass}">
                <span class="retail-badge-model">${model}</span>
                <span class="retail-badge-type">${badgeText}</span>
            </div>
            ${acrylicHtml}
        </div>
    `;"""

if target_slot_return in content:
    content = content.replace(target_slot_return, replacement_slot_return, 1)
    print("Updated renderRetailSlot return block")
else:
    print("Warning: target_slot_return not found directly")

with open('main_v130.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Step 1 of JS updates applied successfully!")
