import re

# 1. Update style_v128.css
with open('style_v128.css', 'r', encoding='utf-8', errors='ignore') as f:
    css_text = f.read()

idx_css = css_text.find("/* ==========================================================================\n   MESAS 3D VOLUMETRICAS")
if idx_css == -1:
    idx_css = css_text.find("MESAS 3D VOLUMETRICAS")
    idx_css = css_text.rfind("/*", 0, idx_css)

new_css = """/* ==========================================================================
   MESAS 3D VOLUMETRICAS OFICIALES: ALCAMPO, CARREFOUR ESTANDAR Y PREMIUM
   ========================================================================== */

/* 1. Mueble Isla Alcampo & Carrefour (Estructura sólida, encimera y faldones continuos sin flotación) */
.table-volume-box.mueble-alcampo-crf {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
}

/* Encimera superior sólida con marco antracita */
.table-volume-box.mueble-alcampo-crf .table-face-top {
    box-sizing: border-box !important;
    position: absolute;
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

/* Faldón frontal y trasero continuo que sella exactamente con la encimera */
.table-volume-box.mueble-alcampo-crf .table-face-front,
.table-volume-box.mueble-alcampo-crf .table-face-back {
    box-sizing: border-box !important;
    position: absolute;
    width: 960px;
    height: 42px;
    left: 0;
    top: 162px;
    background: #ffffff;
    border-top: 5px solid #1e293b;
    border-bottom: 2px solid #cbd5e1;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.14);
    position: relative;
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
    position: absolute;
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
    position: absolute;
    width: 360px;
    height: 42px;
    left: 300px;
    top: 162px;
    transform: rotateY(90deg) translateZ(480px);
    background: #f1f5f9;
    border-top: 5px solid #1e293b;
    border-bottom: 2px solid #cbd5e1;
}

/* Base inferior sólida sellada */
.table-volume-box.mueble-alcampo-crf .table-face-bottom {
    box-sizing: border-box !important;
    position: absolute;
    width: 960px;
    height: 360px;
    left: 0;
    top: 0;
    transform: translateY(24px) rotateX(-90deg);
    background: #334155;
    border-radius: 4px;
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

/* Logotipo Xiaomi retroiluminado en el faldón */
.table-xiaomi-glowing-logo {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 22px;
    height: 22px;
    background: #ff6900;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 14px rgba(255, 105, 0, 0.9), 0 0 3px #ffffff;
    color: #ffffff;
    font-weight: 900;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 11px;
    letter-spacing: -0.5px;
    border: 1px solid rgba(255, 255, 255, 0.4);
    pointer-events: none;
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

/* 2. Top Table Vertical Oficial (Colocado 90° en vertical, dividiendo Cara A y B) */
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
    height: 140px; /* Altura del panel vertical */
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
    background: #0f172a;
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
    object-fit: cover;
    display: block;
}
.alcampo-crf-lb-glare {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, transparent 60%);
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
    height: 95px;
    top: 22px;
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
    width: 920px !important; /* Abarca toda la longitud de la mesa */
    height: 145px;
    display: flex !important;
    align-items: flex-end !important;
    justify-content: space-between !important; /* 4 dispositivos distribuidos equitativamente */
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
    flex: 0 0 160px; /* Espacio generoso de 160px para cada terminal */
    box-sizing: border-box;
}

/* 4. Carrefour Premium: Cabecera anclada a la mesa, grada central vertical y separación */
.crf-premium-headboard-anchor {
    position: absolute;
    left: 0;
    top: 180px;
    width: 960px;
    height: 0;
    transform-style: preserve-3d;
    pointer-events: none;
    z-index: 30;
}

.crf-premium-headboard-vertical {
    position: absolute;
    width: 960px;
    height: 250px;
    bottom: 0;
    left: 0;
    transform-origin: bottom center;
    transform: translateZ(180px) rotateX(-90deg); /* Se levanta verticalmente desde el faldón delantero */
    transform-style: preserve-3d;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: auto;
}

.crf-premium-totem-pole {
    width: 68px;
    height: 75px;
    background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%);
    border-radius: 34px 34px 0 0;
    border: 2px solid #ffffff;
    box-shadow: 0 4px 18px rgba(15, 23, 42, 0.22);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: -10px;
    z-index: 2;
    position: relative;
}
.crf-premium-totem-logo {
    width: 38px;
    height: 38px;
    background: #ff6900;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 18px rgba(255, 105, 0, 0.95), 0 0 4px #ffffff;
    color: #ffffff;
    font-weight: 900;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 18px;
    letter-spacing: -0.8px;
}

.crf-premium-banner-box {
    width: 920px;
    height: 180px;
    border-radius: 14px;
    overflow: hidden;
    border: 3px solid #ffffff;
    box-shadow: 0 10px 32px rgba(15, 23, 42, 0.35), 0 0 24px rgba(255, 105, 0, 0.3);
    position: relative;
    background: #0f172a;
    cursor: pointer;
}
.crf-premium-banner-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.crf-premium-corporeal-prop {
    position: absolute;
    top: -24px;
    right: 40px;
    width: 130px;
    height: 140px;
    z-index: 10;
    filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.5));
    transform: translateZ(24px);
    pointer-events: none;
}
.crf-premium-corporeal-prop img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

/* Grada Central Longitudinal en Carrefour Premium (entre las dos hileras) */
.crf-premium-grada-stand-box {
    position: absolute;
    width: 720px;
    height: 65px;
    bottom: 0;
    left: 50%;
    transform-origin: bottom center;
    transform: translateX(-50%) rotateX(-90deg); /* 90° vertical */
    transform-style: preserve-3d;
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 0 24px;
    background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%);
    border: 2px solid #ffffff;
    border-radius: 10px;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.18);
    pointer-events: auto;
}
.crf-grada-card {
    background: rgba(255, 255, 255, 0.98);
    border: 1.5px solid #cbd5e1;
    border-radius: 8px;
    padding: 6px 14px;
    box-shadow: 0 3px 10px rgba(0,0,0,0.08);
    cursor: pointer;
    transition: transform 0.2s ease, border-color 0.2s ease;
    text-align: center;
}
.crf-grada-card:hover {
    transform: scale(1.08);
    border-color: var(--mi-orange);
    box-shadow: 0 6px 16px rgba(255, 105, 0, 0.3);
}

/* Badges promocionales rojas y etiquetas energéticas oficiales */
.retail-badge-promo-red {
    background: #dc2626 !important;
    color: #ffffff !important;
    font-weight: 900 !important;
    text-transform: uppercase !important;
    box-shadow: 0 2px 6px rgba(220, 38, 38, 0.4) !important;
    border: 1px solid #b91c1c !important;
}

.eu-energy-tag {
    position: absolute;
    bottom: -19px;
    left: 50%;
    transform: translateX(-50%);
    padding: 1.5px 6px;
    background: #16a34a;
    color: #ffffff;
    font-size: 8.5px;
    font-weight: 800;
    border-radius: 3px;
    white-space: nowrap;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.16);
    display: inline-flex;
    align-items: center;
    gap: 3px;
    letter-spacing: 0.3px;
    z-index: 10;
}
.eu-energy-tag.class-b { background: #65a30d; }
.eu-energy-tag.class-c { background: #ca8a04; }
.eu-energy-tag i { font-size: 7.5px; }

.acrylic-spec-holder {
    margin-top: 6px;
    padding: 3px 8px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    font-size: 9.5px;
    font-weight: 700;
    color: #1e293b;
    text-align: center;
    max-width: 130px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    backdrop-filter: blur(2px);
}

.crf-view-toggle-bar {
    display: inline-flex;
    align-items: center;
    background: #f1f5f9;
    border: 1.5px solid #cbd5e1;
    border-radius: 12px;
    padding: 3px;
    gap: 4px;
    margin-left: 10px;
}
.crf-view-toggle-btn {
    padding: 5px 12px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 11.5px;
    font-weight: 800;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: all 0.15s ease;
}
.crf-view-toggle-btn.active {
    background: #ffffff;
    color: var(--mi-orange);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}
"""

if idx_css != -1:
    css_text = css_text[:idx_css] + new_css
    with open('style_v128.css', 'w', encoding='utf-8') as f:
        f.write(css_text)
    print("Updated style_v128.css successfully!")
else:
    print("Error: Could not find anchor in style_v128.css")
