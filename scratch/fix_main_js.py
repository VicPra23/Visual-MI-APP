with open('main_v130.js', 'r', encoding='utf-8', errors='ignore') as f:
    code = f.read()

idx_start = code.find("window.wrapAlcampoCrfTable3D = function")
idx_end = code.find("window.renderVisualTableMockup = function(clusterId) {")

if idx_start == -1 or idx_end == -1:
    print(f"Error finding indices: idx_start={idx_start}, idx_end={idx_end}")
    exit(1)

new_functions = """window.wrapAlcampoCrfTable3D = function(tableId, tableTitle, sideAHtml, sideBHtml, retailer = 'Alcampo') {
    const isCarrefour = retailer.toLowerCase().includes('carrefour') || retailer.toLowerCase().includes('crf');
    const badgeColor = isCarrefour ? '#2563eb' : '#dc2626';
    const iconClass = isCarrefour ? 'fa-store' : 'fa-shopping-basket';

    return `
        <div class="retail-showroom-wrapper" id="showroom-${tableId}">
            <div class="retail-side-nav-bar">
                <div class="retail-nav-top-row">
                    <div class="retail-nav-title-group">
                        <span class="retail-nav-pill" style="border-color: ${badgeColor};">
                            <i class="fas ${iconClass}" style="color: ${badgeColor};"></i> ${tableTitle} · Showroom 3D Volumétrico
                        </span>
                        <span class="retail-nav-hint">
                            <i class="fas fa-arrows-alt-h"></i> Arrastra en horizontal para girar 360° la mesa con volumen real
                        </span>
                        ${isCarrefour ? `
                            <div class="crf-view-toggle-bar">
                                <button type="button" class="crf-view-toggle-btn active" onclick="window.switchClusterTab('carrefour')">
                                    <i class="fas fa-store"></i> Estándar
                                </button>
                                <button type="button" class="crf-view-toggle-btn" onclick="window.switchClusterTab('carrefour_premium')">
                                    <i class="fas fa-gem" style="color: #ea580c;"></i> Premium ★
                                </button>
                            </div>
                        ` : ''}
                    </div>
                    <div class="retail-side-tabs">
                        <button type="button" id="btn-side-0-${tableId}" class="retail-side-btn active" onclick="window.setRetailTableAngle('${tableId}', 0)">
                            <i class="fas fa-mobile-alt"></i> 0° Frontal (Cara A)
                        </button>
                        <button type="button" id="btn-side-35-${tableId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${tableId}', 35)">
                            <i class="fas fa-cube"></i> 35° Perspectiva 3D
                        </button>
                        <button type="button" id="btn-side-90-${tableId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${tableId}', 90)">
                            <i class="fas fa-columns"></i> 90° Perfil Der.
                        </button>
                        <button type="button" id="btn-side-180-${tableId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${tableId}', 180)">
                            <i class="fas fa-tablet-alt"></i> 180° Posterior (Cara B)
                        </button>
                        <button type="button" id="btn-side-270-${tableId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${tableId}', 270)">
                            <i class="fas fa-columns"></i> 270° Perfil Izq.
                        </button>
                        <button type="button" id="btn-autospin-${tableId}" class="retail-side-btn retail-side-btn-autospin" onclick="window.toggleRetailAutoSpin('${tableId}')" title="Girar 360 grados horizontalmente alrededor de la mesa">
                            <i class="fas fa-sync-alt"></i> Giro 360° Horizontal
                        </button>
                    </div>
                </div>

                <div class="retail-h-slider-bar">
                    <div class="retail-h-slider-box">
                        <span class="retail-h-slider-label">
                            <i class="fas fa-compass" style="color: var(--mi-orange);"></i> Giro Horizontal 360°:
                        </span>
                        <input type="range" id="h-slider-${tableId}" class="retail-h-slider" min="0" max="360" value="0" oninput="window.setRetailTableAngle('${tableId}', this.value)">
                        <span id="h-degree-pill-${tableId}" class="retail-h-degree-pill">0° · Frontal (Cara A)</span>
                    </div>
                </div>
            </div>

            <div class="retail-3d-stage" id="stage-${tableId}">
                <div class="retail-table-rig" id="rig-${tableId}">
                    <!-- Sombra de suelo difusa -->
                    <div class="table-floor-shadow"></div>

                    <!-- Patas 3D Volumétricas bajo el cuerpo del mueble -->
                    <div class="table-3d-leg leg-alcampo leg-fl"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-alcampo leg-fr"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-alcampo leg-bl"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-alcampo leg-br"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>

                    <!-- Mueble Isla con Marco Antracita Sólido (Sin separación ni flotación) -->
                    <div class="table-volume-box mueble-alcampo-crf">
                        <div class="table-face-front">
                            <div class="table-led-strip"></div>
                            <div class="table-xiaomi-glowing-logo">mi</div>
                        </div>
                        <div class="table-face-back">
                            <div class="table-led-strip"></div>
                            <div class="table-xiaomi-glowing-logo">mi</div>
                        </div>
                        <div class="table-face-left"></div>
                        <div class="table-face-right"></div>
                        <div class="table-face-bottom"></div>

                        <!-- Encimera Superior con Acabado Blanco Satinado y Marco Antracita -->
                        <div class="table-face-top">
                            <!-- Fila Posterior (Cara B): 4 terminales separados a lo largo de toda la mesa -->
                            <div class="row-alcampo-crf row-back">
                                ${sideBHtml}
                            </div>

                            <!-- Top Table Vertical Oficial (90° erguido perpendicular en el centro de la mesa) -->
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
                            </div>

                            <!-- Fila Frontal (Cara A): 4 smartphones separados a lo largo de toda la mesa -->
                            <div class="row-alcampo-crf row-front">
                                ${sideAHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.wrapCarrefourPremiumTable3D = function(tableId, tableTitle, sideAHtml, sideBHtml) {
    return `
        <div class="retail-showroom-wrapper" id="showroom-${tableId}">
            <div class="retail-side-nav-bar">
                <div class="retail-nav-top-row">
                    <div class="retail-nav-title-group">
                        <span class="retail-nav-pill" style="border-color: #ea580c; background: #fff7ed; color: #c2410c;">
                            <i class="fas fa-gem" style="color: #ea580c;"></i> ${tableTitle} · Carrefour Flagship Premium 3D
                        </span>
                        <span class="retail-nav-hint">
                            <i class="fas fa-arrows-alt-h"></i> Arrastra en horizontal para girar 360° la mesa premium
                        </span>
                        <div class="crf-view-toggle-bar">
                            <button type="button" class="crf-view-toggle-btn" onclick="window.switchClusterTab('carrefour')">
                                <i class="fas fa-store"></i> Estándar
                            </button>
                            <button type="button" class="crf-view-toggle-btn active" onclick="window.switchClusterTab('carrefour_premium')">
                                <i class="fas fa-gem" style="color: #ea580c;"></i> Premium ★
                            </button>
                        </div>
                    </div>
                    <div class="retail-side-tabs">
                        <button type="button" id="btn-side-0-${tableId}" class="retail-side-btn active" onclick="window.setRetailTableAngle('${tableId}', 0)">
                            <i class="fas fa-mobile-alt"></i> 0° Frontal (Cara A)
                        </button>
                        <button type="button" id="btn-side-35-${tableId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${tableId}', 35)">
                            <i class="fas fa-cube"></i> 35° Perspectiva 3D
                        </button>
                        <button type="button" id="btn-side-90-${tableId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${tableId}', 90)">
                            <i class="fas fa-columns"></i> 90° Perfil Der.
                        </button>
                        <button type="button" id="btn-side-180-${tableId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${tableId}', 180)">
                            <i class="fas fa-tablet-alt"></i> 180° Posterior (Cara B)
                        </button>
                        <button type="button" id="btn-side-270-${tableId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${tableId}', 270)">
                            <i class="fas fa-columns"></i> 270° Perfil Izq.
                        </button>
                        <button type="button" id="btn-autospin-${tableId}" class="retail-side-btn retail-side-btn-autospin" onclick="window.toggleRetailAutoSpin('${tableId}')" title="Girar 360 grados horizontalmente alrededor de la mesa">
                            <i class="fas fa-sync-alt"></i> Giro 360° Horizontal
                        </button>
                    </div>
                </div>

                <div class="retail-h-slider-bar">
                    <div class="retail-h-slider-box">
                        <span class="retail-h-slider-label">
                            <i class="fas fa-compass" style="color: var(--mi-orange);"></i> Giro Horizontal 360°:
                        </span>
                        <input type="range" id="h-slider-${tableId}" class="retail-h-slider" min="0" max="360" value="0" oninput="window.setRetailTableAngle('${tableId}', this.value)">
                        <span id="h-degree-pill-${tableId}" class="retail-h-degree-pill">0° · Frontal (Cara A)</span>
                    </div>
                </div>
            </div>

            <div class="retail-3d-stage" id="stage-${tableId}">
                <div class="retail-table-rig" id="rig-${tableId}">
                    <!-- Sombra de suelo difusa -->
                    <div class="table-floor-shadow"></div>

                    <!-- Patas 3D Volumétricas bajo el mueble -->
                    <div class="table-3d-leg leg-alcampo leg-fl"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-alcampo leg-fr"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-alcampo leg-bl"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-alcampo leg-br"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>

                    <!-- Mueble Carrefour Premium Sólido -->
                    <div class="table-volume-box mueble-alcampo-crf">
                        <div class="table-face-front">
                            <div class="table-led-strip"></div>
                            <div class="table-xiaomi-glowing-logo">mi</div>
                        </div>
                        <div class="table-face-back">
                            <div class="table-led-strip"></div>
                            <div class="table-xiaomi-glowing-logo">mi</div>
                        </div>
                        <div class="table-face-left"></div>
                        <div class="table-face-right"></div>
                        <div class="table-face-bottom"></div>

                        <!-- Encimera Superior -->
                        <div class="table-face-top">
                            <!-- Fila Posterior (Cara B): 4 terminales separados -->
                            <div class="row-alcampo-crf row-back">
                                ${sideBHtml}
                            </div>

                            <!-- Grada Central Longitudinal Vertical (entre hilera A y B) -->
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.renderAlcampoTable3D = function(storeName) {
    const s = window.selectedPlanogramStore;
    const sName = storeName || (s ? s.nombre : 'Tienda Alcampo (Estándar)');
    const devs = (s ? window.getStoreImeiDevices(s.nombre) : []) || [];
    const storeHeaderHtml = window.renderSelectedStoreFurnitureHeader();

    const defaultFront = [
        { model: 'Redmi Note 15 Pro+ 5G', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'blue', isHero: true, promoTag: 'SUPER PRECIO', energyRating: 'Clase A', acrylicStand: 'RN 15 Pro+ · 200MP OIS' },
        { model: 'Redmi Note 15 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', promoTag: '-20% DTO', energyRating: 'Clase A', acrylicStand: 'RN 15 Pro · 50MP Sony' },
        { model: 'Redmi Note 15 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', promoTag: 'SUPER PRECIO', energyRating: 'Clase B', acrylicStand: 'RN 15 5G · AMOLED 120Hz' },
        { model: 'Redmi Note 15 4G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', promoTag: 'OFERTA', energyRating: 'Clase B', acrylicStand: 'RN 15 4G · 108MP Pro' }
    ];
    const defaultBack = [
        { model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'blue', promoTag: 'PAD PRO', energyRating: 'Clase A', acrylicStand: 'Pad 2 Pro · 12.1" 2.5K' },
        { model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'black', promoTag: 'TOP VENTAS', energyRating: 'Clase A', acrylicStand: 'Pad 2 · 11" 90Hz Quad' },
        { model: 'REDMI Pad SE 8.7"', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'blue', promoTag: 'NUEVO', energyRating: 'Clase A', acrylicStand: 'Pad SE · 8.7" Compact' },
        { model: 'Redmi 15C', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', promoTag: 'SUPER PRECIO', energyRating: 'Clase B', acrylicStand: 'Redmi 15C · 50MP AI' }
    ];

    let frontItems = defaultFront;
    let backItems = defaultBack;

    if (devs.length >= 8) {
        frontItems = devs.slice(0, 4).map((d, i) => {
            const def = defaultFront[i] || {};
            const isTab = (d.modelo || '').toLowerCase().includes('pad');
            return {
                model: d.modelo || def.model,
                badgeColor: d.isDummy ? 'green' : 'orange',
                typeBadge: d.isDummy ? 'Dummy' : (d.tipologia || 'LDU'),
                deviceType: isTab ? 'tablet' : 'phone',
                color: def.color || 'blue',
                isHero: i === 0,
                promoTag: def.promoTag,
                energyRating: def.energyRating,
                acrylicStand: def.acrylicStand,
                imei: d.imei || ''
            };
        });
        backItems = devs.slice(4, 8).map((d, i) => {
            const def = defaultBack[i] || {};
            const isTab = (d.modelo || '').toLowerCase().includes('pad');
            return {
                model: d.modelo || def.model,
                badgeColor: d.isDummy ? 'green' : 'orange',
                typeBadge: d.isDummy ? 'Dummy' : (d.tipologia || 'LDU'),
                deviceType: isTab ? 'tablet' : 'phone',
                color: def.color || 'black',
                promoTag: def.promoTag,
                energyRating: def.energyRating,
                acrylicStand: def.acrylicStand,
                imei: d.imei || ''
            };
        });
    }

    // 4 terminales separados a lo largo de toda la longitud de la mesa
    const sideAHtml = frontItems.map(item => `
        <div class="device-station-unit">
            ${window.renderRetailSlot(item)}
        </div>
    `).join('');

    const sideBHtml = backItems.map(item => `
        <div class="device-station-unit">
            ${window.renderRetailSlot(item)}
        </div>
    `).join('');

    return `
        <div class="visual-table-wrapper">
            ${storeHeaderHtml}
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 1.25rem;">
                <div>
                    <span style="background: #fef2f2; color: #dc2626; font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">PLANOGRAMA OFICIAL ALCAMPO (9 TIENDAS)</span>
                    <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Mesa Alcampo 3D Volumétrica · ${sName}</h3>
                    <span style="font-size: 12px; color: #64748b; font-weight: 600;">Mueble Isla con marco antracita sólido, Top Table vertical colocado en el centro y 8 dispositivos espaciados homogéneamente</span>
                </div>
                <div style="background: #fff; border: 1px solid #fecaca; border-radius: 10px; padding: 10px 14px; font-size: 11.5px; color: #7f1d1d; line-height: 1.45;">
                    <strong style="color: #dc2626; display: block; margin-bottom: 2px;"><i class="fas fa-info-circle"></i> Especificaciones Mesa Alcampo:</strong>
                    • <b>8 Terminales Separados:</b> 4 Smartphones (Cara Frontal) + 3 Tablets y 1 Smartphone (Cara Posterior) distribuidos a lo largo de toda la encimera<br>
                    • <b>Top Table Vertical (90°):</b> Caja de luz colocada en vertical erguida en el centro de la mesa con portafolletos laterales<br>
                    • <b>Merchandising Real:</b> Peanas inclinadas, cable antirrobo, badges rojas de oferta, etiqueta energética UE y atril acrílico<br>
                    • <b>Estructura Sólida:</b> Sin flotación de superficie, marco antracita y tira LED continua
                </div>
            </div>

            ${window.wrapAlcampoCrfTable3D('alcampo-m1', `Mesa Alcampo (${sName})`, sideAHtml, sideBHtml, 'Alcampo')}
        </div>
    `;
};

window.renderCarrefourStandardTable3D = function(storeName) {
    const s = window.selectedPlanogramStore;
    const sName = storeName || (s ? s.nombre : 'Tienda Carrefour (Estándar)');
    const devs = (s ? window.getStoreImeiDevices(s.nombre) : []) || [];
    const storeHeaderHtml = window.renderSelectedStoreFurnitureHeader();

    const defaultFront = [
        { model: 'Redmi Note 15 Pro+ 5G', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'blue', isHero: true, promoTag: 'SUPER PRECIO', energyRating: 'Clase A', acrylicStand: 'RN 15 Pro+ · 200MP OIS' },
        { model: 'Redmi Note 15 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', promoTag: '-20% DTO', energyRating: 'Clase A', acrylicStand: 'RN 15 Pro · 50MP Sony' },
        { model: 'Redmi Note 15 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', promoTag: 'SUPER PRECIO', energyRating: 'Clase B', acrylicStand: 'RN 15 5G · AMOLED 120Hz' },
        { model: 'Redmi Note 15 4G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', promoTag: 'OFERTA', energyRating: 'Clase B', acrylicStand: 'RN 15 4G · 108MP Pro' }
    ];
    const defaultBack = [
        { model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'blue', promoTag: 'PAD PRO', energyRating: 'Clase A', acrylicStand: 'Pad 2 Pro · 12.1" 2.5K' },
        { model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'black', promoTag: 'TOP VENTAS', energyRating: 'Clase A', acrylicStand: 'Pad 2 · 11" 90Hz Quad' },
        { model: 'REDMI Pad SE 8.7"', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'blue', promoTag: 'NUEVO', energyRating: 'Clase A', acrylicStand: 'Pad SE · 8.7" Compact' },
        { model: 'Redmi 15C', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', promoTag: 'SUPER PRECIO', energyRating: 'Clase B', acrylicStand: 'Redmi 15C · 50MP AI' }
    ];

    let frontItems = defaultFront;
    let backItems = defaultBack;

    if (devs.length >= 8) {
        frontItems = devs.slice(0, 4).map((d, i) => {
            const def = defaultFront[i] || {};
            const isTab = (d.modelo || '').toLowerCase().includes('pad');
            return {
                model: d.modelo || def.model,
                badgeColor: d.isDummy ? 'green' : 'orange',
                typeBadge: d.isDummy ? 'Dummy' : (d.tipologia || 'LDU'),
                deviceType: isTab ? 'tablet' : 'phone',
                color: def.color || 'blue',
                isHero: i === 0,
                promoTag: def.promoTag,
                energyRating: def.energyRating,
                acrylicStand: def.acrylicStand,
                imei: d.imei || ''
            };
        });
        backItems = devs.slice(4, 8).map((d, i) => {
            const def = defaultBack[i] || {};
            const isTab = (d.modelo || '').toLowerCase().includes('pad');
            return {
                model: d.modelo || def.model,
                badgeColor: d.isDummy ? 'green' : 'orange',
                typeBadge: d.isDummy ? 'Dummy' : (d.tipologia || 'LDU'),
                deviceType: isTab ? 'tablet' : 'phone',
                color: def.color || 'black',
                promoTag: def.promoTag,
                energyRating: def.energyRating,
                acrylicStand: def.acrylicStand,
                imei: d.imei || ''
            };
        });
    }

    const sideAHtml = frontItems.map(item => `
        <div class="device-station-unit">
            ${window.renderRetailSlot(item)}
        </div>
    `).join('');

    const sideBHtml = backItems.map(item => `
        <div class="device-station-unit">
            ${window.renderRetailSlot(item)}
        </div>
    `).join('');

    return `
        <div class="visual-table-wrapper">
            ${storeHeaderHtml}
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 1.25rem;">
                <div>
                    <span style="background: #eff6ff; color: #1d4ed8; font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">PLANOGRAMA OFICIAL CARREFOUR (62 TIENDAS)</span>
                    <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Mesa Carrefour Estándar 3D · ${sName}</h3>
                    <span style="font-size: 12px; color: #64748b; font-weight: 600;">Mueble Isla con marco antracita sólido, Top Table vertical y terminales distribuidos homogéneamente</span>
                </div>
                <div style="background: #fff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 14px; font-size: 11.5px; color: #1e3a8a; line-height: 1.45;">
                    <strong style="color: #2563eb; display: block; margin-bottom: 2px;"><i class="fas fa-info-circle"></i> Características Mesa Carrefour Estándar:</strong>
                    • <b>8 Terminales Separados:</b> 4 Smartphones frontal + 3 Tablets y 1 Smartphone trasera espaciados a lo largo de la mesa<br>
                    • <b>Top Table Vertical (90°):</b> Creatividad oficial colocada en vertical erguida en el centro<br>
                    • <b>Alternar a Flagship:</b> Usa el botón <b>Premium ★</b> para ver la cabecera de testero iluminada
                </div>
            </div>

            ${window.wrapAlcampoCrfTable3D('carrefour-m1', `Mesa Carrefour (${sName})`, sideAHtml, sideBHtml, 'Carrefour')}
        </div>
    `;
};

window.renderCarrefourPremiumTable3D = function(storeName) {
    const s = window.selectedPlanogramStore;
    const sName = storeName || (s ? s.nombre : 'Carrefour Flagship Premium');
    const devs = (s ? window.getStoreImeiDevices(s.nombre) : []) || [];
    const storeHeaderHtml = window.renderSelectedStoreFurnitureHeader();

    const defaultLeft = [
        { model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'blue', promoTag: 'PAD PRO', energyRating: 'Clase A', acrylicStand: 'Pad 2 Pro · 12.1"' },
        { model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'black', promoTag: 'TOP VENTAS', energyRating: 'Clase A', acrylicStand: 'Pad 2 · 11"' },
        { model: 'REDMI Pad SE 8.7"', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'blue', promoTag: 'NUEVO', energyRating: 'Clase A', acrylicStand: 'Pad SE · 8.7"' },
        { model: 'Redmi Note 15 Pro+ 5G', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'blue', isHero: true, promoTag: 'SUPER PRECIO', energyRating: 'Clase A', acrylicStand: 'RN 15 Pro+ · 200MP' }
    ];
    const defaultRight = [
        { model: 'Redmi Note 15 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', promoTag: '-20% DTO', energyRating: 'Clase A', acrylicStand: 'RN 15 Pro · 50MP Sony' },
        { model: 'Redmi Note 15 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', promoTag: 'SUPER PRECIO', energyRating: 'Clase B', acrylicStand: 'RN 15 5G · AMOLED' },
        { model: 'Redmi Note 15 4G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', promoTag: 'OFERTA', energyRating: 'Clase B', acrylicStand: 'RN 15 4G · 108MP' },
        { model: 'Redmi 15C', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', promoTag: 'SUPER PRECIO', energyRating: 'Clase B', acrylicStand: 'Redmi 15C · 50MP' }
    ];

    let leftItems = defaultLeft;
    let rightItems = defaultRight;

    if (devs.length >= 8) {
        leftItems = devs.slice(0, 4).map((d, i) => {
            const def = defaultLeft[i] || {};
            const isTab = (d.modelo || '').toLowerCase().includes('pad');
            return {
                model: d.modelo || def.model,
                badgeColor: d.isDummy ? 'green' : 'orange',
                typeBadge: d.isDummy ? 'Dummy' : (d.tipologia || 'LDU'),
                deviceType: isTab ? 'tablet' : 'phone',
                color: def.color || 'blue',
                isHero: (d.modelo || '').includes('Pro+'),
                promoTag: def.promoTag,
                energyRating: def.energyRating,
                acrylicStand: def.acrylicStand,
                imei: d.imei || ''
            };
        });
        rightItems = devs.slice(4, 8).map((d, i) => {
            const def = defaultRight[i] || {};
            const isTab = (d.modelo || '').toLowerCase().includes('pad');
            return {
                model: d.modelo || def.model,
                badgeColor: d.isDummy ? 'green' : 'orange',
                typeBadge: d.isDummy ? 'Dummy' : (d.tipologia || 'LDU'),
                deviceType: isTab ? 'tablet' : 'phone',
                color: def.color || 'green',
                promoTag: def.promoTag,
                energyRating: def.energyRating,
                acrylicStand: def.acrylicStand,
                imei: d.imei || ''
            };
        });
    }

    const sideAHtml = rightItems.map(item => `
        <div class="device-station-unit">
            ${window.renderRetailSlot(item)}
        </div>
    `).join('');

    const sideBHtml = leftItems.map(item => `
        <div class="device-station-unit">
            ${window.renderRetailSlot(item)}
        </div>
    `).join('');

    return `
        <div class="visual-table-wrapper">
            ${storeHeaderHtml}
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 1.25rem;">
                <div>
                    <span style="background: #fff7ed; color: #ea580c; font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">FLAGSHIP RETAIL · CARREFOUR PREMIUM ★</span>
                    <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Mesa Carrefour Premium 3D con Cabecera y Grada Central · ${sName}</h3>
                    <span style="font-size: 12px; color: #64748b; font-weight: 600;">Cabecera de testero vertical anclada a la mesa, grada central longitudinal y terminales separados</span>
                </div>
                <div style="background: #fff; border: 1.5px solid #fdba74; border-radius: 10px; padding: 10px 14px; font-size: 11.5px; color: #9a3412; line-height: 1.45;">
                    <strong style="color: #ea580c; display: block; margin-bottom: 2px;"><i class="fas fa-gem"></i> Elementos Premium Exclusivos:</strong>
                    • <b>Cabecera Vertical Anclada:</b> Banner iluminado <i>REDMI Note 15 Series</i> + Tótem curvo con logo Xiaomi naranja + Letras corpóreas 3D<br>
                    • <b>Grada Central Longitudinal:</b> Podium colocado verticalmente en el centro con atriles acrílicos de especificaciones comparativas<br>
                    • <b>Dispositivos Separados:</b> 8 terminales repartidos a lo largo de toda la superficie de la mesa
                </div>
            </div>

            ${window.wrapCarrefourPremiumTable3D('carrefour-prem-m1', `Mesa CRF Premium (${sName})`, sideAHtml, sideBHtml)}
        </div>
    `;
};
"""

code = code[:idx_start] + new_functions + "\n\n" + code[idx_end:]

with open('main_v130.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated main_v130.js successfully!")
