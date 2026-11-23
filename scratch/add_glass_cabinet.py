# Add glass cabinet to wrapCarrefourPremiumTable3D
with open('main_v130.js', 'r', encoding='utf-8', errors='ignore') as f:
    js_text = f.read()

target_str = """                        <div class="table-face-left"></div>
                        <div class="table-face-right"></div>
                        <div class="table-face-bottom"></div>

                        <!-- Encimera Superior -->"""

replacement_str = """                        <div class="table-face-left"></div>
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

                        <!-- Encimera Superior -->"""

if target_str in js_text:
    js_text = js_text.replace(target_str, replacement_str, 1)
    with open('main_v130.js', 'w', encoding='utf-8') as f:
        f.write(js_text)
    print("Added glass cabinet back to Carrefour Premium in main_v130.js")
else:
    print("Warning: target_str not found in main_v130.js")

# Also add styles for crf-premium-glass-cabinet in style_v128.css
with open('style_v128.css', 'r', encoding='utf-8', errors='ignore') as f:
    css_text = f.read()

glass_css = """
/* Vitrina de cristal inferior en Carrefour Premium */
.crf-premium-glass-cabinet {
    position: absolute;
    width: 900px;
    height: 120px;
    left: 30px;
    top: 204px;
    transform: translateZ(160px);
    background: rgba(255, 255, 255, 0.25);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    border: 2px solid rgba(255, 255, 255, 0.75);
    border-radius: 8px;
    box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.5), 0 8px 24px rgba(15, 23, 42, 0.16);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    overflow: hidden;
}
.crf-glass-sliding-door {
    position: absolute;
    top: 4px;
    bottom: 4px;
    width: 48%;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.42) 0%, rgba(240, 249, 255, 0.15) 100%);
    border: 1.5px solid rgba(255, 255, 255, 0.85);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.crf-glass-door-left { left: 8px; }
.crf-glass-door-right { right: 8px; }
.crf-glass-door-handle {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 6px;
    height: 38px;
    background: linear-gradient(180deg, #e2e8f0 0%, #94a3b8 100%);
    border-radius: 3px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
.crf-glass-door-left .crf-glass-door-handle { right: 12px; }
.crf-glass-door-right .crf-glass-door-handle { left: 12px; }

.crf-glass-shelf-content {
    display: flex;
    align-items: center;
    justify-content: space-around;
    width: 100%;
    z-index: 1;
}
.crf-glass-item {
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    font-size: 10px;
    font-weight: 700;
    color: #475569;
    display: flex;
    align-items: center;
    gap: 5px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}
"""

if ".crf-premium-glass-cabinet" not in css_text:
    css_text += glass_css
    with open('style_v128.css', 'w', encoding='utf-8') as f:
        f.write(css_text)
    print("Added glass cabinet CSS styles to style_v128.css")
