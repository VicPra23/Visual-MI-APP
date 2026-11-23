import sys

with open('main_v130.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Define the functions to insert
functions_to_insert = """
// =========================================================================
// MESAS 3D VOLUMETRICAS OFICIALES: ALCAMPO, CARREFOUR ESTANDAR Y PREMIUM
// =========================================================================

window.wrapAlcampoCrfTable3D = function(tableId, tableTitle, sideAHtml, sideBHtml, retailer = 'Alcampo') {
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

                    <!-- Patas 3D Volumétricas -->
                    <div class="table-3d-leg leg-fl"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-fr"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-bl"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-br"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>

                    <!-- Mueble Isla con Marco Antracita y Repisa Inferior -->
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

                        <!-- Repisa inferior iluminada -->
                        <div class="table-lower-shelf">
                            <div class="table-lower-shelf-light"></div>
                            <span style="font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 1px; opacity: 0.65; transform: rotateX(180deg);">XIAOMI DISPLAY & STORAGE</span>
                        </div>

                        <!-- Encimera Superior con Acabado Blanco Satinado y Marco Antracita -->
                        <div class="table-face-top">
                            <!-- Fila Posterior (Cara B): Tablets / Smartphones orientados 180° -->
                            <div class="table-counter-row row-back">
                                ${sideBHtml}
                            </div>

                            <!-- Lightbox Central Doble Cara Redmi Note 15 Series -->
                            <div class="alcampo-crf-lightbox" onclick="window.openTopTableZoomModal('img/posm/lightbox_alcampo_crf_note15.png', 'Lightbox Central · Redmi Note 15 Series')" title="Clic para ampliar Lightbox Central Oficial">
                                <div class="alcampo-crf-lightbox-face alcampo-crf-lightbox-front">
                                    <img src="img/posm/lightbox_alcampo_crf_note15.png" class="alcampo-crf-lightbox-img" alt="Lightbox Redmi Note 15 Frontal">
                                    <div class="alcampo-crf-lightbox-glare"></div>
                                </div>
                                <div class="alcampo-crf-lightbox-face alcampo-crf-lightbox-back">
                                    <img src="img/posm/lightbox_alcampo_crf_note15.png" class="alcampo-crf-lightbox-img" alt="Lightbox Redmi Note 15 Posterior">
                                    <div class="alcampo-crf-lightbox-glare"></div>
                                </div>
                                <div class="alcampo-crf-lightbox-top"></div>
                                <div class="alcampo-crf-lightbox-pocket alcampo-crf-lightbox-pocket-left">FOLLETOS</div>
                                <div class="alcampo-crf-lightbox-pocket alcampo-crf-lightbox-pocket-right">FOLLETOS</div>
                            </div>

                            <!-- Fila Frontal (Cara A): Smartphones orientados hacia el pasillo -->
                            <div class="table-counter-row row-front">
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
                        <span id="h-degree-pill-${tableId}" class="retail-h-degree-pill">0° · Frontal (Cabecera)</span>
                    </div>
                </div>
            </div>

            <div class="retail-3d-stage" id="stage-${tableId}">
                <div class="retail-table-rig" id="rig-${tableId}">
                    <!-- Sombra de suelo difusa -->
                    <div class="table-floor-shadow"></div>

                    <!-- Patas 3D Volumétricas -->
                    <div class="table-3d-leg leg-fl"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-fr"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-bl"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-br"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>

                    <!-- Mueble Carrefour Premium -->
                    <div class="table-volume-box mueble-alcampo-crf mueble-crf-premium">
                        <!-- Cabecera Frontal de Testero con Tótem Curvo y Letras Corpóreas 3D -->
                        <div class="crf-premium-headboard">
                            <div class="crf-premium-totem-pole">
                                <div class="crf-premium-totem-logo">mi</div>
                            </div>
                            <div class="crf-premium-banner-box" onclick="window.openTopTableZoomModal('img/posm/cabecera_crf_premium_note15.png', 'Cabecera Carrefour Premium · REDMI Note 15 Series')" title="Clic para ampliar Cabecera Premium">
                                <img src="img/posm/cabecera_crf_premium_note15.png" class="crf-premium-banner-img" alt="Cabecera Carrefour Premium">
                            </div>
                            <!-- Letras corpóreas 3D en relieve -->
                            <div class="crf-premium-corporeal-prop">
                                <img src="img/posm/prop_17_note_crf_premium.png" alt="Prop 17 Note Corpóreo">
                            </div>
                        </div>

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

                        <!-- Vitrina corredera de cristal inferior -->
                        <div class="crf-premium-glass-cabinet">
                            <div class="crf-glass-sliding-door crf-glass-door-left">
                                <div class="crf-glass-door-handle"></div>
                            </div>
                            <div class="crf-glass-sliding-door crf-glass-door-right">
                                <div class="crf-glass-door-handle"></div>
                            </div>
                            <div class="crf-glass-shelf-content">
                                <div class="crf-glass-item"><i class="fas fa-box" style="color: var(--mi-orange);"></i> Pack Redmi Buds 8</div>
                                <div class="crf-glass-item"><i class="fas fa-bolt" style="color: #eab308;"></i> Cargadores 67W / 120W</div>
                                <div class="crf-glass-item"><i class="fas fa-shield-alt" style="color: #22c55e;"></i> Fundas & Protectores</div>
                                <div class="crf-glass-item"><i class="fas fa-tag" style="color: #3b82f6;"></i> Accesorios Oficiales</div>
                            </div>
                        </div>

                        <!-- Encimera Superior con Grada Central Longitudinal -->
                        <div class="table-face-top">
                            <!-- Fila Posterior (Cara B): Tablets orientadas 180° -->
                            <div class="table-counter-row row-back">
                                ${sideBHtml}
                            </div>

                            <!-- Grada Central Longitudinal Blanca con Atriles Comparativos -->
                            <div class="crf-premium-grada">
                                <div class="crf-premium-grada-stand" onclick="window.openTopTableZoomModal('img/posm/lightbox_alcampo_crf_note15.png', 'Ficha Comparativa · Redmi Note 15 Pro vs Pro+ 5G')" title="Clic para ver ficha técnica comparativa">
                                    <div class="crf-grada-stand-title"><i class="fas fa-microchip"></i> Comparativa Pro+</div>
                                    <div class="crf-grada-stand-desc"><b>Note 15 Pro+ 5G vs Pro 5G</b><br>200MP OIS · Carga 120W HyperCharge</div>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                    <span style="font-size: 11px; font-weight: 900; color: #1e293b; letter-spacing: 0.5px;">REDMI NOTE 15 SERIES</span>
                                    <span style="font-size: 9px; font-weight: 700; color: var(--mi-orange);">PODIUM COMPARATIVO PREMIUM</span>
                                </div>
                                <div class="crf-premium-grada-stand" onclick="window.openTopTableZoomModal('img/posm/lightbox_alcampo_crf_note15.png', 'Ficha Comparativa · Redmi Pad 2 Pro')" title="Clic para ver ficha técnica comparativa">
                                    <div class="crf-grada-stand-title"><i class="fas fa-tablet-alt"></i> Ecosistema Pad</div>
                                    <div class="crf-grada-stand-desc"><b>Redmi Pad 2 Pro vs SE 8.7"</b><br>Pantalla 12.1" 120Hz · Batería 10000mAh</div>
                                </div>
                            </div>

                            <!-- Fila Frontal (Cara A): Smartphones orientados hacia el pasillo -->
                            <div class="table-counter-row row-front">
                                ${sideAHtml}
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
        { model: 'Redmi Note 15 Pro+ 5G', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'blue', isHero: true, promoTag: 'SUPER PRECIO', energyRating: 'Clase A', acrylicStand: 'RN 15 Pro+ · 200MP' },
        { model: 'Redmi Note 15 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', promoTag: '-20% DTO', energyRating: 'Clase A', acrylicStand: 'RN 15 Pro · 50MP Sony' },
        { model: 'Redmi Note 15 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', promoTag: 'SUPER PRECIO', energyRating: 'Clase B', acrylicStand: 'RN 15 5G · 120Hz' },
        { model: 'Redmi Note 15 4G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', promoTag: 'OFERTA', energyRating: 'Clase B', acrylicStand: 'RN 15 4G · 108MP' }
    ];
    const defaultBack = [
        { model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'blue', promoTag: 'PAD PRO', energyRating: 'Clase A', acrylicStand: 'Pad 2 Pro · 12.1" 2.5K' },
        { model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'black', promoTag: 'TOP VENTAS', energyRating: 'Clase A', acrylicStand: 'Pad 2 · 11" 90Hz' },
        { model: 'REDMI Pad SE 8.7"', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'blue', promoTag: 'NUEVO', energyRating: 'Clase A', acrylicStand: 'Pad SE · 8.7" Compact' },
        { model: 'Redmi 15C', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', promoTag: 'SUPER PRECIO', energyRating: 'Clase B', acrylicStand: 'Redmi 15C · 50MP' }
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

    const sideAHtml = `
        <div class="retail-3d-tray">
            <div class="retail-3d-tray-header"><i class="fas fa-shopping-basket" style="color: #dc2626;"></i> Cara A · Smartphones Redmi Note 15 Series (4 Terminales en Peana)</div>
            <div class="retail-3d-tray-devices" style="gap: 24px; justify-content: space-around;">
                ${frontItems.map(item => window.renderRetailSlot(item)).join('')}
            </div>
        </div>
    `;

    const sideBHtml = `
        <div class="retail-3d-tray">
            <div class="retail-3d-tray-header"><i class="fas fa-tablet-alt" style="color: #16a34a;"></i> Cara B · Ecosistema Tablets Redmi Pad + Entrada (4 Terminales)</div>
            <div class="retail-3d-tray-devices" style="gap: 24px; justify-content: space-around;">
                ${backItems.map(item => window.renderRetailSlot(item)).join('')}
            </div>
        </div>
    `;

    return `
        <div class="visual-table-wrapper">
            ${storeHeaderHtml}
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 1.25rem;">
                <div>
                    <span style="background: #fef2f2; color: #dc2626; font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">PLANOGRAMA OFICIAL ALCAMPO (9 TIENDAS)</span>
                    <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Mesa Alcampo 3D Volumétrica · ${sName}</h3>
                    <span style="font-size: 12px; color: #64748b; font-weight: 600;">Mueble Isla con marco perimetral antracita, repisa inferior retroiluminada y Lightbox Central doble cara</span>
                </div>
                <div style="background: #fff; border: 1px solid #fecaca; border-radius: 10px; padding: 10px 14px; font-size: 11.5px; color: #7f1d1d; line-height: 1.45;">
                    <strong style="color: #dc2626; display: block; margin-bottom: 2px;"><i class="fas fa-info-circle"></i> Especificaciones Mesa Alcampo:</strong>
                    • <b>8 Terminales Volumétricos:</b> 4 Smartphones (Cara Frontal) + 3 Tablets y 1 Smartphone (Cara Posterior)<br>
                    • <b>Lightbox Central Doble Cara:</b> Creatividad oficial <i>Redmi Note 15 Series</i> con portafolletos laterales<br>
                    • <b>Merchandising Real:</b> Peanas inclinadas, cable antirrobo, badges rojas de oferta, etiqueta energética UE y atril acrílico<br>
                    • <b>Iluminación LED:</b> Tira perimetral bajo encimera y logotipo Xiaomi frontal retroiluminado
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
        { model: 'Redmi Note 15 Pro+ 5G', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'blue', isHero: true, promoTag: 'SUPER PRECIO', energyRating: 'Clase A', acrylicStand: 'RN 15 Pro+ · 200MP' },
        { model: 'Redmi Note 15 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', promoTag: '-20% DTO', energyRating: 'Clase A', acrylicStand: 'RN 15 Pro · 50MP Sony' },
        { model: 'Redmi Note 15 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', promoTag: 'SUPER PRECIO', energyRating: 'Clase B', acrylicStand: 'RN 15 5G · 120Hz' },
        { model: 'Redmi Note 15 4G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', promoTag: 'OFERTA', energyRating: 'Clase B', acrylicStand: 'RN 15 4G · 108MP' }
    ];
    const defaultBack = [
        { model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'blue', promoTag: 'PAD PRO', energyRating: 'Clase A', acrylicStand: 'Pad 2 Pro · 12.1" 2.5K' },
        { model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'black', promoTag: 'TOP VENTAS', energyRating: 'Clase A', acrylicStand: 'Pad 2 · 11" 90Hz' },
        { model: 'REDMI Pad SE 8.7"', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'blue', promoTag: 'NUEVO', energyRating: 'Clase A', acrylicStand: 'Pad SE · 8.7" Compact' },
        { model: 'Redmi 15C', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', promoTag: 'SUPER PRECIO', energyRating: 'Clase B', acrylicStand: 'Redmi 15C · 50MP' }
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

    const sideAHtml = `
        <div class="retail-3d-tray">
            <div class="retail-3d-tray-header"><i class="fas fa-store" style="color: #2563eb;"></i> Cara A · Smartphones Redmi Note 15 Series (4 Terminales)</div>
            <div class="retail-3d-tray-devices" style="gap: 24px; justify-content: space-around;">
                ${frontItems.map(item => window.renderRetailSlot(item)).join('')}
            </div>
        </div>
    `;

    const sideBHtml = `
        <div class="retail-3d-tray">
            <div class="retail-3d-tray-header"><i class="fas fa-tablet-alt" style="color: #16a34a;"></i> Cara B · Ecosistema Tablets Redmi Pad + Gama Entrada (4 Terminales)</div>
            <div class="retail-3d-tray-devices" style="gap: 24px; justify-content: space-around;">
                ${backItems.map(item => window.renderRetailSlot(item)).join('')}
            </div>
        </div>
    `;

    return `
        <div class="visual-table-wrapper">
            ${storeHeaderHtml}
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 1.25rem;">
                <div>
                    <span style="background: #eff6ff; color: #1d4ed8; font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">PLANOGRAMA OFICIAL CARREFOUR (62 TIENDAS)</span>
                    <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Mesa Carrefour Estándar 3D · ${sName}</h3>
                    <span style="font-size: 12px; color: #64748b; font-weight: 600;">Mueble Isla con marco antracita, repisa inferior y Lightbox Central doble cara Redmi Note 15</span>
                </div>
                <div style="background: #fff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 14px; font-size: 11.5px; color: #1e3a8a; line-height: 1.45;">
                    <strong style="color: #2563eb; display: block; margin-bottom: 2px;"><i class="fas fa-info-circle"></i> Características Mesa Carrefour Estándar:</strong>
                    • <b>8 Terminales:</b> 4 Smartphones frontal + 3 Tablets y 1 Smartphone trasera<br>
                    • <b>Lightbox Central Doble Cara:</b> Portafolletos integrados y gráfica <i>Redmi Note 15 Series</i><br>
                    • <b>Modo Flagship:</b> Puedes alternar con un clic a la vista <b>Carrefour Premium ★</b> con cabecera de testero y vitrina inferior
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

    const sideAHtml = `
        <div class="retail-3d-tray">
            <div class="retail-3d-tray-header"><i class="fas fa-mobile-alt" style="color: var(--mi-orange);"></i> Hilera Derecha · Smartphones Redmi Note 15 Series (4 Terminales)</div>
            <div class="retail-3d-tray-devices" style="gap: 24px; justify-content: space-around;">
                ${rightItems.map(item => window.renderRetailSlot(item)).join('')}
            </div>
        </div>
    `;

    const sideBHtml = `
        <div class="retail-3d-tray">
            <div class="retail-3d-tray-header"><i class="fas fa-tablet-alt" style="color: #2563eb;"></i> Hilera Izquierda · Tablets Redmi Pad + Flagship Note 15 Pro+ (4 Terminales)</div>
            <div class="retail-3d-tray-devices" style="gap: 24px; justify-content: space-around;">
                ${leftItems.map(item => window.renderRetailSlot(item)).join('')}
            </div>
        </div>
    `;

    return `
        <div class="visual-table-wrapper">
            ${storeHeaderHtml}
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 1.25rem;">
                <div>
                    <span style="background: #fff7ed; color: #ea580c; font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">FLAGSHIP RETAIL · CARREFOUR PREMIUM ★</span>
                    <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Mesa Carrefour Premium 3D con Cabecera y Grada Central · ${sName}</h3>
                    <span style="font-size: 12px; color: #64748b; font-weight: 600;">Diseño Flagship con Cabecera de Testero, Tótem Curvo iluminado, Grada Central con atriles y Vitrina corredera de cristal</span>
                </div>
                <div style="background: #fff; border: 1.5px solid #fdba74; border-radius: 10px; padding: 10px 14px; font-size: 11.5px; color: #9a3412; line-height: 1.45;">
                    <strong style="color: #ea580c; display: block; margin-bottom: 2px;"><i class="fas fa-gem"></i> Elementos Premium Exclusivos:</strong>
                    • <b>Cabecera de Testero:</b> Banner iluminado <i>REDMI Note 15 Series</i> + Tótem curvo con logo Xiaomi naranja + Letras corpóreas 3D en relieve<br>
                    • <b>Grada Central Elevada:</b> Podium longitudinal con 2 atriles acrílicos de especificaciones comparativas<br>
                    • <b>Vitrina de Cristal Inferior:</b> Mueble con puertas correderas translúcidas y exposición de accesorios
                </div>
            </div>

            ${window.wrapCarrefourPremiumTable3D('carrefour-prem-m1', `Mesa CRF Premium (${sName})`, sideAHtml, sideBHtml)}
        </div>
    `;
};
"""

# Find place to insert functions (right before window.renderVisualTableMockup)
idx_mockup = content.find("window.renderVisualTableMockup = function(clusterId) {")
if idx_mockup != -1:
    content = content[:idx_mockup] + functions_to_insert + "\n\n" + content[idx_mockup:]
    print("Inserted 3D builder functions before renderVisualTableMockup")
else:
    print("Error: renderVisualTableMockup not found")
    sys.exit(1)

# Now update renderVisualTableMockup empty state buttons
old_empty_buttons = """                    <button type="button" onclick="window.switchClusterTab('cabecera_posm')" style="padding: 10px 16px; border-radius: 10px; border: none; background: var(--bg-main); box-shadow: var(--neu-flat-sm); color: var(--text-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;">
                        <i class="fas fa-bullhorn" style="color: #dc2626;"></i> 01-03 & 11. Cabecera ECI & POSM
                    </button>
                </div>"""

new_empty_buttons = """                    <button type="button" onclick="window.switchClusterTab('cabecera_posm')" style="padding: 10px 16px; border-radius: 10px; border: none; background: var(--bg-main); box-shadow: var(--neu-flat-sm); color: var(--text-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;">
                        <i class="fas fa-bullhorn" style="color: #dc2626;"></i> 01-03 & 11. Cabecera ECI & POSM
                    </button>
                    <button type="button" onclick="window.switchClusterTab('alcampo')" style="padding: 10px 16px; border-radius: 10px; border: none; background: var(--bg-main); box-shadow: var(--neu-flat-sm); color: var(--text-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;">
                        <i class="fas fa-shopping-basket" style="color: #dc2626;"></i> Mesa Alcampo (9 Tiendas)
                    </button>
                    <button type="button" onclick="window.switchClusterTab('carrefour')" style="padding: 10px 16px; border-radius: 10px; border: none; background: var(--bg-main); box-shadow: var(--neu-flat-sm); color: var(--text-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;">
                        <i class="fas fa-store" style="color: #2563eb;"></i> Mesa Carrefour (62 Tiendas)
                    </button>
                    <button type="button" onclick="window.switchClusterTab('carrefour_premium')" style="padding: 10px 16px; border-radius: 10px; border: none; background: var(--bg-main); box-shadow: var(--neu-flat-sm); color: var(--text-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;">
                        <i class="fas fa-gem" style="color: #ea580c;"></i> Carrefour Premium ★ (Cabecera 3D)
                    </button>
                </div>"""

if old_empty_buttons in content:
    content = content.replace(old_empty_buttons, new_empty_buttons, 1)
    print("Updated empty state buttons in renderVisualTableMockup")
else:
    print("Warning: old_empty_buttons not found directly")

# Now add cases to renderVisualTableMockup
old_cabecera_case = """    } else if (strTab === 'cabecera_posm') {"""
new_tabs_case = """    } else if (strTab === 'alcampo') {
        dragTableIds.push('alcampo-m1');
        html = window.renderAlcampoTable3D();
    } else if (strTab === 'carrefour') {
        dragTableIds.push('carrefour-m1');
        html = window.renderCarrefourStandardTable3D();
    } else if (strTab === 'carrefour_premium') {
        dragTableIds.push('carrefour-prem-m1');
        html = window.renderCarrefourPremiumTable3D();
    } else if (strTab === 'cabecera_posm') {"""

if old_cabecera_case in content:
    content = content.replace(old_cabecera_case, new_tabs_case, 1)
    print("Added alcampo, carrefour, and carrefour_premium cases to renderVisualTableMockup")
else:
    print("Warning: old_cabecera_case not found")

# Update renderSelectedStoreFurnitureHeader to show Alcampo / Carrefour buttons
old_header_btns = """                    ${specId ? `<button type="button" onclick="window.switchClusterTab('especiales')" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #f59e0b; background: #fffbeb; color: #b45309; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-star"></i> Ver Planograma Especial</button>` : ''}
                    ${mesas > 0 ? `<button type="button" onclick="window.switchClusterTab(${mesas >= 3 ? 3 : (mesas === 2 ? 2 : 1)})" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #fdba74; background: #fff; color: #ea580c; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-table"></i> Mesas (${mesas})</button>` : ''}"""

new_header_btns = """                    ${isAlcampo ? `<button type="button" onclick="window.switchClusterTab('alcampo')" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #f87171; background: #fef2f2; color: #b91c1c; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-shopping-basket"></i> Mesa Alcampo 3D</button>` : ''}
                    ${isCarrefour ? `
                        <button type="button" onclick="window.switchClusterTab('carrefour')" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #93c5fd; background: #eff6ff; color: #1d4ed8; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-store"></i> Mesa CRF Estándar</button>
                        <button type="button" onclick="window.switchClusterTab('carrefour_premium')" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #fdba74; background: #fff7ed; color: #c2410c; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-gem"></i> Mesa CRF Premium</button>
                    ` : ''}
                    ${specId ? `<button type="button" onclick="window.switchClusterTab('especiales')" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #f59e0b; background: #fffbeb; color: #b45309; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-star"></i> Ver Planograma Especial</button>` : ''}
                    ${(!isAlcampo && !isCarrefour && mesas > 0) ? `<button type="button" onclick="window.switchClusterTab(${mesas >= 3 ? 3 : (mesas === 2 ? 2 : 1)})" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #fdba74; background: #fff; color: #ea580c; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-table"></i> Mesas (${mesas})</button>` : ''}"""

# Check if isAlcampo and isCarrefour are defined in renderSelectedStoreFurnitureHeader
header_start = "window.renderSelectedStoreFurnitureHeader = function() {\n    const s = window.selectedPlanogramStore;\n    if (!s) return '';"
header_start_new = """window.renderSelectedStoreFurnitureHeader = function() {
    const s = window.selectedPlanogramStore;
    if (!s) return '';
    const cuentaNorm = (s.cuenta || '').toLowerCase().trim();
    const isAlcampo = cuentaNorm.includes('alcampo');
    const isCarrefour = cuentaNorm.includes('carrefour') || cuentaNorm.includes('crf');"""

if header_start in content:
    content = content.replace(header_start, header_start_new, 1)
    print("Added isAlcampo and isCarrefour variables to renderSelectedStoreFurnitureHeader")

if old_header_btns in content:
    content = content.replace(old_header_btns, new_header_btns, 1)
    print("Updated buttons in renderSelectedStoreFurnitureHeader")

# Update onPlanogramStoreSearch
old_search_target = """        let targetTab = 1;
        if (specId) {
            window.currentSpecialCaseFilter = specId;
            targetTab = 'especiales';
        } else if (mesas === 0 && (walls > 0 || cols > 0)) {
            targetTab = 'wall_col';
        } else {
            targetTab = (mesas >= 3) ? 3 : ((mesas === 2) ? 2 : 1);
        }"""

new_search_target = """        const cuentaNorm = (matched.cuenta || '').toLowerCase().trim();
        const isAlcampo = cuentaNorm.includes('alcampo');
        const isCarrefour = cuentaNorm.includes('carrefour') || cuentaNorm.includes('crf');

        let targetTab = 1;
        if (isAlcampo) {
            targetTab = 'alcampo';
        } else if (isCarrefour) {
            const isPrem = matched.isPremium || (matched.observaciones && matched.observaciones.toLowerCase().includes('premium'));
            targetTab = isPrem ? 'carrefour_premium' : 'carrefour';
        } else if (specId) {
            window.currentSpecialCaseFilter = specId;
            targetTab = 'especiales';
        } else if (mesas === 0 && (walls > 0 || cols > 0)) {
            targetTab = 'wall_col';
        } else {
            targetTab = (mesas >= 3) ? 3 : ((mesas === 2) ? 2 : 1);
        }"""

if old_search_target in content:
    content = content.replace(old_search_target, new_search_target, 1)
    print("Updated targetTab routing in onPlanogramStoreSearch")

# Update switchClusterTab active color logic
old_switch_color = """            const color = tabId === 'hojaruta' ? '#217346' : 'var(--mi-orange)';
            activeBtn.style.borderBottomColor = color;
            activeBtn.style.color = color;"""

new_switch_color = """            let color = 'var(--mi-orange)';
            if (tabId === 'hojaruta') color = '#217346';
            else if (tabId === 'alcampo') color = '#dc2626';
            else if (tabId === 'carrefour') color = '#2563eb';
            else if (tabId === 'carrefour_premium') color = '#ea580c';
            activeBtn.style.borderBottomColor = color;
            activeBtn.style.color = color;"""

if old_switch_color in content:
    content = content.replace(old_switch_color, new_switch_color, 1)
    print("Updated tab colors in switchClusterTab")

with open('main_v130.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Step 2 completed successfully!")
