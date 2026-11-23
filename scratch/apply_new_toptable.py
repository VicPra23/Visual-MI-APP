import re

# 1. Update main_v130.js
with open('main_v130.js', 'r', encoding='utf-8', errors='ignore') as f:
    js = f.read()

# Update wrapAlcampoCrfTable3D lightbox stand
target_alc = """                            <!-- Top Table Vertical Oficial (90° erguido perpendicular en el centro de la mesa) -->
                            <div class="alcampo-crf-toptable-divider">
                                <div class="alcampo-crf-lightbox-stand" onclick="window.openTopTableZoomModal('img/posm/lightbox_alcampo_crf_note15.png', 'Lightbox Central · Redmi Note 15 Series')" title="Clic para ampliar Lightbox Central Oficial">
                                    <div class="alcampo-crf-lb-face alcampo-crf-lb-front">
                                        <img src="img/posm/lightbox_alcampo_crf_note15.png" class="alcampo-crf-lb-img" alt="Lightbox Redmi Note 15 Frontal">
                                        <div class="alcampo-crf-lb-glare"></div>
                                    </div>
                                    <div class="alcampo-crf-lb-face alcampo-crf-lb-back">
                                        <img src="img/posm/lightbox_alcampo_crf_note15.png" class="alcampo-crf-lb-img" alt="Lightbox Redmi Note 15 Posterior">
                                        <div class="alcampo-crf-lb-glare"></div>
                                    </div>
                                    <div class="alcampo-crf-lb-top"></div>
                                    <div class="alcampo-crf-lb-base"></div>
                                    <div class="alcampo-crf-lb-pocket alcampo-crf-lb-pocket-left">FOLLETOS</div>
                                    <div class="alcampo-crf-lb-pocket alcampo-crf-lb-pocket-right">FOLLETOS</div>
                                </div>
                            </div>"""

replacement_alc = """                            <!-- Top Table Vertical Oficial (90° erguido perpendicular en el centro de la mesa) -->
                            <div class="alcampo-crf-toptable-divider">
                                <div class="alcampo-crf-lightbox-stand" onclick="window.openTopTableZoomModal('img/posm/toptable_alcampo_crf_note15.png', 'Top Table Oficial · REDMI Note 15 Series')" title="Clic para ampliar Top Table Oficial">
                                    <div class="alcampo-crf-lb-face alcampo-crf-lb-front">
                                        <img src="img/posm/toptable_alcampo_crf_note15.png" class="alcampo-crf-lb-img" alt="Top Table Redmi Note 15 Frontal">
                                        <div class="alcampo-crf-lb-glare"></div>
                                    </div>
                                    <div class="alcampo-crf-lb-face alcampo-crf-lb-back">
                                        <img src="img/posm/toptable_alcampo_crf_note15.png" class="alcampo-crf-lb-img" alt="Top Table Redmi Note 15 Posterior">
                                        <div class="alcampo-crf-lb-glare"></div>
                                    </div>
                                    <div class="alcampo-crf-lb-top"></div>
                                    <div class="alcampo-crf-lb-base"></div>
                                    <div class="alcampo-crf-lb-pocket alcampo-crf-lb-pocket-left">FOLLETOS</div>
                                    <div class="alcampo-crf-lb-pocket alcampo-crf-lb-pocket-right">FOLLETOS</div>
                                </div>
                            </div>"""

if target_alc in js:
    js = js.replace(target_alc, replacement_alc, 1)
    print("[PASS] Replaced Top Table in wrapAlcampoCrfTable3D")
else:
    print("[WARN] target_alc not found directly in main_v130.js")

# Update wrapCarrefourPremiumTable3D: update banner image and REMOVE corporeal prop of Redmi Note 17
target_prem = """                            <!-- TOP TABLE Central Unificado Flagship Premium (90° Vertical, sin flotación) -->
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
                            </div>"""

replacement_prem = """                            <!-- TOP TABLE Central Unificado Flagship Premium (90° Vertical, sin flotación) -->
                            <div class="alcampo-crf-toptable-divider">
                                <div class="crf-premium-toptable-centerpiece">
                                    <!-- Tótem arqueado Xiaomi con luz LED -->
                                    <div class="crf-premium-totem-pole">
                                        <div class="crf-premium-totem-logo">mi</div>
                                    </div>

                                    <!-- Banner oficial Top Table Carrefour Premium a doble cara (limpio sin fichas de Note 17) -->
                                    <div class="crf-premium-banner-stand" onclick="window.openTopTableZoomModal('img/posm/toptable_alcampo_crf_note15.png', 'Top Table Flagship · REDMI Note 15 Series')" title="Clic para ampliar Top Table Flagship">
                                        <div class="crf-premium-banner-face crf-premium-banner-front">
                                            <img src="img/posm/toptable_alcampo_crf_note15.png" class="crf-premium-banner-img" alt="Top Table Carrefour Premium Frontal">
                                            <div class="alcampo-crf-lb-glare"></div>
                                        </div>
                                        <div class="crf-premium-banner-face crf-premium-banner-back">
                                            <img src="img/posm/toptable_alcampo_crf_note15.png" class="crf-premium-banner-img" alt="Top Table Carrefour Premium Cara B">
                                            <div class="alcampo-crf-lb-glare"></div>
                                        </div>
                                    </div>

                                    <!-- Grada Central Comparativa apoyada en la encimera -->
                                    <div class="crf-premium-grada-stand-box">
                                        <div class="crf-grada-card" onclick="window.openTopTableZoomModal('img/posm/toptable_alcampo_crf_note15.png', 'Comparativa Note 15 Pro+')" title="Clic para ver ficha técnica">
                                            <div style="font-size: 10px; font-weight: 800; color: var(--mi-orange);"><i class="fas fa-microchip"></i> NOTE 15 PRO+</div>
                                            <div style="font-size: 8.5px; color: #475569; font-weight: 700;">200MP OIS · 120W HyperCharge</div>
                                        </div>
                                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                            <span style="font-size: 11px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">REDMI NOTE 15 SERIES</span>
                                            <span style="font-size: 8.5px; font-weight: 700; color: var(--mi-orange);">PODIUM COMPARATIVO FLAGSHIP</span>
                                        </div>
                                        <div class="crf-grada-card" onclick="window.openTopTableZoomModal('img/posm/toptable_alcampo_crf_note15.png', 'Comparativa Ecosistema Pad')" title="Clic para ver ficha técnica">
                                            <div style="font-size: 10px; font-weight: 800; color: #2563eb;"><i class="fas fa-tablet-alt"></i> REDMI PAD PRO</div>
                                            <div style="font-size: 8.5px; color: #475569; font-weight: 700;">12.1" 2.5K 120Hz · 10000mAh</div>
                                        </div>
                                    </div>
                                </div>
                            </div>"""

if target_prem in js:
    js = js.replace(target_prem, replacement_prem, 1)
    print("[PASS] Replaced Top Table in wrapCarrefourPremiumTable3D (removed Note 17 prop/spec)")
else:
    print("[WARN] target_prem not found directly in main_v130.js")

# Update descriptions in renderCarrefourPremiumTable3D to remove mention of letras corpóreas
js = js.replace("• <b>Cabecera Vertical Anclada:</b> Banner iluminado <i>REDMI Note 15 Series</i> + Tótem curvo con logo Xiaomi naranja + Letras corpóreas 3D",
                "• <b>Top Table Vertical Anclado:</b> Banner oficial <i>REDMI Note 15 Series</i> erguido a 90° + Tótem Xiaomi iluminado")

with open('main_v130.js', 'w', encoding='utf-8') as f:
    f.write(js)
print("[PASS] main_v130.js successfully saved")
