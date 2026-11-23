import re

# 1. Update style_v128.css for Carrefour Premium Top Table Centerpiece
with open('style_v128.css', 'r', encoding='utf-8', errors='ignore') as f:
    css = f.read()

target_css = """/* 4. Carrefour Premium: Cabecera anclada a la mesa, grada central vertical y separación */
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
}"""

replacement_css = """/* 4. Carrefour Premium: Top Table Central Unificado (Anclado a la mesa a 90° vertical, con tótem, banner y grada) */
.crf-premium-toptable-centerpiece {
    position: absolute;
    width: 760px;
    height: 210px;
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

/* Tótem curvo Xiaomi en la cúspide */
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
    width: 32px;
    height: 32px;
    background: #ff6900;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 16px rgba(255, 105, 0, 0.95), 0 0 3px #ffffff;
    color: #ffffff;
    font-weight: 900;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    letter-spacing: -0.5px;
}

/* Banner de la cabecera central con doble cara e iluminación */
.crf-premium-banner-stand {
    width: 740px;
    height: 120px;
    border-radius: 10px;
    border: 2.5px solid #ffffff;
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.35), 0 0 24px rgba(255, 105, 0, 0.3);
    position: relative;
    background: #0f172a;
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
    object-fit: cover;
    display: block;
}

/* Letras y números corpóreos 3D "17 Note" */
.crf-premium-corporeal-prop {
    position: absolute;
    top: -20px;
    right: 28px;
    width: 105px;
    height: 115px;
    z-index: 10;
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5));
    transform: translateZ(22px);
    pointer-events: none;
}
.crf-premium-corporeal-prop img {
    width: 100%;
    height: 100%;
    object-fit: contain;
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
}"""

if target_css in css:
    css = css.replace(target_css, replacement_css, 1)
    with open('style_v128.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("[PASS] style_v128.css updated with unified Carrefour Premium Top Table centerpiece!")
else:
    print("[WARN] target_css not matched in style_v128.css. Checking partial match...")
    if ".crf-premium-headboard-anchor" in css:
        # Replace the block manually
        idx_start = css.find("/* 4. Carrefour Premium")
        idx_end = css.find(".crf-grada-card {")
        if idx_start != -1 and idx_end != -1:
            css = css[:idx_start] + replacement_css + "\n\n" + css[idx_end:]
            with open('style_v128.css', 'w', encoding='utf-8') as f:
                f.write(css)
            print("[PASS] style_v128.css updated via index range!")
        else:
            print("[FAIL] Could not locate index range in style_v128.css")

# 2. Update wrapCarrefourPremiumTable3D in main_v130.js
with open('main_v130.js', 'r', encoding='utf-8', errors='ignore') as f:
    js = f.read()

target_wrap = """                            <!-- Grada Central Longitudinal Vertical (entre hilera A y B) -->
                            <div class="alcampo-crf-toptable-divider">
                                <div class="crf-premium-grada-stand-box">
                                    <div class="crf-grada-card" onclick="window.openTopTableZoomModal('img/posm/cabecera_crf_premium_note15.png', 'Comparativa Note 15 Pro+')" title="Clic para ver ficha técnica">
                                        <div style="font-size: 10px; font-weight: 800; color: var(--mi-orange);"><i class="fas fa-microchip"></i> NOTE 15 PRO+</div>
                                        <div style="font-size: 8.5px; color: #475569; font-weight: 700;">200MP OIS · 120W HyperCharge</div>
                                    </div>
                                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                        <span style="font-size: 11px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">REDMI NOTE 15 SERIES</span>
                                        <span style="font-size: 8.5px; font-weight: 700; color: var(--mi-orange);">PODIUM COMPARATIVO FLAGSHIP</span>
                                    </div>
                                    <div class="crf-grada-card" onclick="window.openTopTableZoomModal('img/posm/lightbox_alcampo_crf_note15.png', 'Comparativa Ecosistema Pad')" title="Clic para ver ficha técnica">
                                        <div style="font-size: 10px; font-weight: 800; color: #2563eb;"><i class="fas fa-tablet-alt"></i> REDMI PAD PRO</div>
                                        <div style="font-size: 8.5px; color: #475569; font-weight: 700;">12.1" 2.5K 120Hz · 10000mAh</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Fila Frontal (Cara A): 4 smartphones separados -->
                            <div class="row-alcampo-crf row-front">
                                ${sideAHtml}
                            </div>
                        </div>

                        <!-- Cabecera de Testero Vertical Frontal anclada al faldón delantero -->
                        <div class="crf-premium-headboard-anchor">
                            <div class="crf-premium-headboard-vertical">
                                <div class="crf-premium-totem-pole">
                                    <div class="crf-premium-totem-logo">mi</div>
                                </div>
                                <div class="crf-premium-banner-box" onclick="window.openTopTableZoomModal('img/posm/cabecera_crf_premium_note15.png', 'Cabecera Carrefour Premium · REDMI Note 15 Series')" title="Clic para ampliar Cabecera Premium">
                                    <img src="img/posm/cabecera_crf_premium_note15.png" class="crf-premium-banner-img" alt="Cabecera Carrefour Premium">
                                </div>
                                <div class="crf-premium-corporeal-prop">
                                    <img src="img/posm/prop_17_note_crf_premium.png" alt="Prop 17 Note Corpóreo">
                                </div>
                            </div>
                        </div>"""

replacement_wrap = """                            <!-- TOP TABLE Central Unificado Flagship Premium (90° Vertical, sin flotación) -->
                            <div class="alcampo-crf-toptable-divider">
                                <div class="crf-premium-toptable-centerpiece">
                                    <!-- Tótem arqueado Xiaomi con luz LED -->
                                    <div class="crf-premium-totem-pole">
                                        <div class="crf-premium-totem-logo">mi</div>
                                    </div>

                                    <!-- Banner oficial Carrefour Premium a doble cara con Prop 3D -->
                                    <div class="crf-premium-banner-stand" onclick="window.openTopTableZoomModal('img/posm/cabecera_crf_premium_note15.png', 'Cabecera Carrefour Premium · REDMI Note 15 Series')" title="Clic para ampliar Cabecera Flagship">
                                        <div class="crf-premium-banner-face crf-premium-banner-front">
                                            <img src="img/posm/cabecera_crf_premium_note15.png" class="crf-premium-banner-img" alt="Cabecera Carrefour Premium">
                                            <div class="alcampo-crf-lb-glare"></div>
                                        </div>
                                        <div class="crf-premium-banner-face crf-premium-banner-back">
                                            <img src="img/posm/lightbox_alcampo_crf_note15.png" class="crf-premium-banner-img" alt="Cabecera Carrefour Premium Cara B">
                                            <div class="alcampo-crf-lb-glare"></div>
                                        </div>
                                        <!-- Letras corpóreas 3D volumétricas -->
                                        <div class="crf-premium-corporeal-prop">
                                            <img src="img/posm/prop_17_note_crf_premium.png" alt="Prop 17 Note Corpóreo">
                                        </div>
                                    </div>

                                    <!-- Grada Central Comparativa apoyada en la encimera -->
                                    <div class="crf-premium-grada-stand-box">
                                        <div class="crf-grada-card" onclick="window.openTopTableZoomModal('img/posm/cabecera_crf_premium_note15.png', 'Comparativa Note 15 Pro+')" title="Clic para ver ficha técnica">
                                            <div style="font-size: 10px; font-weight: 800; color: var(--mi-orange);"><i class="fas fa-microchip"></i> NOTE 15 PRO+</div>
                                            <div style="font-size: 8.5px; color: #475569; font-weight: 700;">200MP OIS · 120W HyperCharge</div>
                                        </div>
                                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                            <span style="font-size: 11px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">REDMI NOTE 15 SERIES</span>
                                            <span style="font-size: 8.5px; font-weight: 700; color: var(--mi-orange);">PODIUM COMPARATIVO FLAGSHIP</span>
                                        </div>
                                        <div class="crf-grada-card" onclick="window.openTopTableZoomModal('img/posm/lightbox_alcampo_crf_note15.png', 'Comparativa Ecosistema Pad')" title="Clic para ver ficha técnica">
                                            <div style="font-size: 10px; font-weight: 800; color: #2563eb;"><i class="fas fa-tablet-alt"></i> REDMI PAD PRO</div>
                                            <div style="font-size: 8.5px; color: #475569; font-weight: 700;">12.1" 2.5K 120Hz · 10000mAh</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Fila Frontal (Cara A): 4 smartphones separados a lo largo de toda la mesa -->
                            <div class="row-alcampo-crf row-front">
                                ${sideAHtml}
                            </div>
                        </div>"""

if target_wrap in js:
    js = js.replace(target_wrap, replacement_wrap, 1)
    with open('main_v130.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print("[PASS] main_v130.js updated with unified Carrefour Premium Top Table centerpiece!")
else:
    print("[WARN] target_wrap not matched in main_v130.js. Checking replacement via regex...")
    pattern = re.compile(r'<!-- Grada Central Longitudinal.*?<!-- Cabecera de Testero Vertical Frontal.*?</div>\s*</div>\s*</div>', re.DOTALL)
    m = pattern.search(js)
    if m:
        js = js[:m.start()] + replacement_wrap + js[m.end():]
        with open('main_v130.js', 'w', encoding='utf-8') as f:
            f.write(js)
        print("[PASS] main_v130.js updated via regex pattern!")
    else:
        print("[FAIL] Could not match wrap section in main_v130.js")
