import re

# 1. Update style_v128.css
with open('style_v128.css', 'r', encoding='utf-8', errors='ignore') as f:
    css = f.read()

# Replace mueble-alcampo-crf block and toptable block
start_marker = "/* 1. Mueble Isla Alcampo & Carrefour"
end_marker = ".crf-grada-card {"

idx_start = css.find(start_marker)
idx_end = css.find(end_marker)

if idx_start == -1 or idx_end == -1:
    print(f"[FAIL] Could not locate markers in style_v128.css: start={idx_start}, end={idx_end}")
else:
    new_css_block = """/* 1. Mueble Isla Alcampo & Carrefour (Estructura sólida, encimera y faldones continuos sin flotación) */
.table-volume-box.mueble-alcampo-crf {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
}

/* Encimera superior sólida con marco antracita */
.table-volume-box.mueble-alcampo-crf .table-face-top {
    box-sizing: border-box !important;
    position: absolute !important;
    width: 960px;
    height: 360px;
    left: 0;
    top: 0;
    transform: translateY(-18px) rotateX(90deg);
    border: 8px solid #1e293b;
    border-radius: 10px;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 40%, #e2e8f0 100%);
    box-shadow: 
        inset 0 0 25px rgba(255, 255, 255, 0.95),
        inset 0 0 0 2px #334155,
        0 8px 24px rgba(15, 23, 42, 0.18);
    transform-style: preserve-3d;
}

/* Faldón frontal y trasero continuo que sella exactamente con la encimera a Y=162px en ambas caras */
.table-volume-box.mueble-alcampo-crf .table-face-front,
.table-volume-box.mueble-alcampo-crf .table-face-back {
    box-sizing: border-box !important;
    position: absolute !important;
    width: 960px;
    height: 42px;
    left: 0;
    top: 162px;
    background: #ffffff;
    border-top: 5px solid #1e293b;
    border-bottom: 2px solid #cbd5e1;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.14);
    overflow: visible;
}

.table-volume-box.mueble-alcampo-crf .table-face-front {
    transform: translateZ(180px);
}

.table-volume-box.mueble-alcampo-crf .table-face-back {
    transform: rotateY(180deg) translateZ(180px);
}

/* Faldones laterales que cierran los costados sin huecos */
.table-volume-box.mueble-alcampo-crf .table-face-left {
    box-sizing: border-box !important;
    position: absolute !important;
    width: 360px;
    height: 42px;
    left: 300px;
    top: 162px;
    transform: rotateY(-90deg) translateZ(480px);
    background: #f1f5f9;
    border-top: 5px solid #1e293b;
    border-bottom: 2px solid #cbd5e1;
}

.table-volume-box.mueble-alcampo-crf .table-face-right {
    box-sizing: border-box !important;
    position: absolute !important;
    width: 360px;
    height: 42px;
    left: 300px;
    top: 162px;
    transform: rotateY(90deg) translateZ(480px);
    background: #f1f5f9;
    border-top: 5px solid #1e293b;
    border-bottom: 2px solid #cbd5e1;
}

/* Eliminar plano inferior opaco que producía solapamiento oscuro en Cara B */
.table-volume-box.mueble-alcampo-crf .table-face-bottom {
    display: none !important;
}

/* Tira de iluminación LED continua bajo el voladizo del faldón */
.table-led-strip {
    position: absolute;
    bottom: -2px;
    left: 12px;
    right: 12px;
    height: 3px;
    background: #ffffff;
    border-radius: 2px;
    box-shadow: 0 0 12px #ffffff, 0 2px 8px rgba(255, 255, 255, 0.9);
    pointer-events: none;
}

/* Logotipo Xiaomi oficial retroiluminado en el faldón */
.table-xiaomi-glowing-logo {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 26px;
    height: 26px;
    background: transparent;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 10px rgba(255, 105, 0, 0.95));
    pointer-events: none;
}
.table-xiaomi-logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 6px;
    display: block;
}

/* Patas limpiamente ubicadas bajo el cuerpo del mueble */
.table-3d-leg.leg-alcampo {
    position: absolute;
    width: 30px;
    height: 150px;
    top: 204px;
    transform-style: preserve-3d;
}
.leg-alcampo.leg-fl { left: 60px; transform: translateZ(135px); }
.leg-alcampo.leg-fr { right: 60px; transform: translateZ(135px); }
.leg-alcampo.leg-bl { left: 60px; transform: translateZ(-135px); }
.leg-alcampo.leg-br { right: 60px; transform: translateZ(-135px); }

/* 2. Top Table Vertical Oficial Alcampo y CRF Estándar (Altura 218px para albergar la gráfica 1024x328 completa) */
.alcampo-crf-toptable-divider {
    position: absolute;
    left: 0;
    top: 180px; /* Centro exacto en profundidad de la encimera */
    width: 960px;
    height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-style: preserve-3d;
    pointer-events: none;
    z-index: 25;
}

.alcampo-crf-lightbox-stand {
    position: absolute;
    width: 680px;
    height: 218px; /* Proporción exacta 3.12:1 para no recortar texto ni terminales */
    bottom: 0;
    left: 50%;
    transform-origin: bottom center;
    transform: translateX(-50%) rotateX(-90deg); /* 90° VERTICAL exacto perpendicular a la mesa */
    transform-style: preserve-3d;
    cursor: pointer;
    pointer-events: auto;
    transition: filter 0.2s ease, transform 0.2s ease;
}
.alcampo-crf-lightbox-stand:hover {
    filter: brightness(1.04) drop-shadow(0 0 16px rgba(255, 105, 0, 0.45));
}

.alcampo-crf-lb-face {
    position: absolute;
    inset: 0;
    border-radius: 6px;
    overflow: hidden;
    background: #ffffff;
    border: 2px solid #ffffff;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35), 0 0 24px rgba(255, 105, 0, 0.3);
    transform-style: preserve-3d;
}
.alcampo-crf-lb-front {
    transform: translateZ(12px);
}
.alcampo-crf-lb-back {
    transform: rotateY(180deg) translateZ(12px);
}
.alcampo-crf-lb-img {
    width: 100%;
    height: 100%;
    object-fit: contain !important; /* Gráfica oficial 100% visible sin recorte */
    object-position: center;
    background: #ffffff;
    display: block;
}
.alcampo-crf-lb-glare {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 60%);
    pointer-events: none;
}
.alcampo-crf-lb-top {
    position: absolute;
    width: 680px;
    height: 24px;
    top: -12px;
    left: 0;
    transform: rotateX(90deg);
    background: #ffffff;
    border-radius: 4px;
    box-shadow: 0 0 14px rgba(255, 255, 255, 0.95);
}
.alcampo-crf-lb-base {
    position: absolute;
    width: 700px;
    height: 14px;
    bottom: -7px;
    left: -10px;
    transform: rotateX(90deg);
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}
.alcampo-crf-lb-pocket {
    position: absolute;
    width: 22px;
    height: 135px;
    top: 40px;
    background: rgba(255, 255, 255, 0.7);
    border: 1.5px solid rgba(255, 255, 255, 0.95);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    color: #334155;
    writing-mode: vertical-rl;
    font-weight: 800;
    backdrop-filter: blur(2px);
}
.alcampo-crf-lb-pocket-left {
    left: -16px;
    transform: rotateY(-90deg);
}
.alcampo-crf-lb-pocket-right {
    right: -16px;
    transform: rotateY(90deg);
}

/* 3. Filas de dispositivos distribuidas homogéneamente a lo largo de toda la mesa */
.row-alcampo-crf {
    position: absolute;
    left: 20px;
    width: 920px !important;
    height: 145px;
    display: flex !important;
    align-items: flex-end !important;
    justify-content: space-between !important;
    padding: 0 35px !important;
    box-sizing: border-box !important;
    transform-style: preserve-3d;
}
.row-alcampo-crf.row-front {
    bottom: 14px;
}
.row-alcampo-crf.row-back {
    top: 14px;
    transform: rotateZ(180deg);
}
.row-alcampo-crf .device-station-unit {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    transform-style: preserve-3d;
    flex: 0 0 160px;
    box-sizing: border-box;
}

/* 4. Carrefour Premium: Top Table Central Unificado (Altura 335px con Tótem Xiaomi, Banner 235px y Grada) */
.crf-premium-toptable-centerpiece {
    position: absolute;
    width: 760px;
    height: 335px; /* Altura suficiente para mostrar el banner de 235px entero sin recortes */
    bottom: 0;
    left: 50%;
    transform-origin: bottom center;
    transform: translateX(-50%) rotateX(-90deg); /* 90° VERTICAL perpendicular a la mesa, sin flotación */
    transform-style: preserve-3d;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    pointer-events: auto;
    z-index: 25;
}

/* Tótem curvo Xiaomi oficial en la cúspide */
.crf-premium-totem-pole {
    width: 64px;
    height: 52px;
    background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%);
    border-radius: 32px 32px 0 0;
    border: 2px solid #ffffff;
    border-bottom: none;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.22);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: -4px;
    z-index: 5;
    position: relative;
}
.crf-premium-totem-logo {
    width: 36px;
    height: 36px;
    background: transparent;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 14px rgba(255, 105, 0, 0.95));
}
.crf-totem-logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 9px;
    display: block;
}

/* Banner de la cabecera central con altura adaptada para no cortar la imagen */
.crf-premium-banner-stand {
    width: 740px;
    height: 235px; /* Proporción 3.12:1 para gráfica oficial 1024x328 */
    border-radius: 10px;
    border: 2.5px solid #ffffff;
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.35), 0 0 24px rgba(255, 105, 0, 0.3);
    position: relative;
    background: #ffffff;
    cursor: pointer;
    transform-style: preserve-3d;
    transition: filter 0.2s ease, transform 0.2s ease;
}
.crf-premium-banner-stand:hover {
    filter: brightness(1.05);
}
.crf-premium-banner-face {
    position: absolute;
    inset: 0;
    border-radius: 8px;
    overflow: hidden;
    background: #ffffff;
    transform-style: preserve-3d;
}
.crf-premium-banner-front {
    transform: translateZ(10px);
}
.crf-premium-banner-back {
    transform: rotateY(180deg) translateZ(10px);
}
.crf-premium-banner-img {
    width: 100%;
    height: 100%;
    object-fit: contain !important; /* Muestra la gráfica 100% entera sin recortar */
    object-position: center;
    background: #ffffff;
    display: block;
}

/* Base Grada Central integrada descansando firmemente sobre la encimera */
.crf-premium-grada-stand-box {
    width: 760px;
    height: 48px;
    margin-top: 4px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18px;
    background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%);
    border: 2px solid #ffffff;
    border-radius: 8px;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.16);
    pointer-events: auto;
    box-sizing: border-box;
}

"""
    css = css[:idx_start] + new_css_block + css[idx_end:]
    
    # Also ensure .toptable-center-single .toptable-acrylic-stand has generous height
    css = css.replace("height: 165px; /* Proporción 1,1m x 0,4m adaptada a la gráfica horizontal oficial */",
                      "height: 180px; /* Altura adaptada para gráfica completa sin recortes */")

    with open('style_v128.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("[PASS] style_v128.css updated successfully!")

# 2. Update main_v130.js for official logo replacement
with open('main_v130.js', 'r', encoding='utf-8', errors='ignore') as f:
    js = f.read()

# Replace plain text 'mi' logos with official Xiaomi logo image
old_logo_div = '<div class="table-xiaomi-glowing-logo">mi</div>'
new_logo_div = '<div class="table-xiaomi-glowing-logo"><img src="logo.png" class="table-xiaomi-logo-img" alt="Xiaomi"></div>'

old_totem_logo = '<div class="crf-premium-totem-logo">mi</div>'
new_totem_logo = '<div class="crf-premium-totem-logo"><img src="logo.png" class="crf-totem-logo-img" alt="Xiaomi"></div>'

count_skirt_logos = js.count(old_logo_div)
count_totem_logos = js.count(old_totem_logo)

js = js.replace(old_logo_div, new_logo_div)
js = js.replace(old_totem_logo, new_totem_logo)

print(f"[PASS] Replaced {count_skirt_logos} skirt logos and {count_totem_logos} totem logos in main_v130.js")

with open('main_v130.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("[PASS] main_v130.js saved successfully")
