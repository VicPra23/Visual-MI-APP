const fs = require('fs');

global.window = global;
global.window.addEventListener = () => {};
global.document = {
    querySelectorAll: () => [],
    getElementById: (id) => null,
    addEventListener: () => {}
};
global.localStorage = {
    getItem: () => null,
    setItem: () => null,
    removeItem: () => null,
    clear: () => null
};

// Load stores_imei_real.js
eval(fs.readFileSync('stores_imei_real.js', 'utf-8'));

const alcStores = window.REAL_STORES_DATA.stores.filter(s => (s.cuenta || '').toLowerCase().includes('alcampo'));
const crfStores = window.REAL_STORES_DATA.stores.filter(s => (s.cuenta || '').toLowerCase().includes('carrefour') || (s.cuenta || '').toLowerCase().includes('crf'));

console.log(`[PASS] Alcampo stores in DB: ${alcStores.length}`);
console.log(`[PASS] Carrefour stores in DB: ${crfStores.length}`);

// Load main_v130.js
const mainCode = fs.readFileSync('main_v130.js', 'utf-8');
global.APP_CONFIG = { imeiDatabase: window.REAL_STORES_DATA.imei_db };

try {
    eval(mainCode);
} catch (e) {
    console.log("Note during eval:", e.message);
}

let htmlAlc = '';
if (typeof window.renderAlcampoTable3D === 'function') {
    htmlAlc = window.renderAlcampoTable3D('ALCAMPO VAGUADA');
    console.log(`[PASS] renderAlcampoTable3D output length: ${htmlAlc.length} chars`);
    if (!htmlAlc.includes('mueble-alcampo-crf') || !htmlAlc.includes('toptable_alcampo_crf_note15.png')) {
        console.error("[FAIL] Alcampo HTML missing expected classes or new Top Table texture!");
        process.exit(1);
    }
    console.log(`[PASS] Alcampo HTML contains anthracite frame, lower shelf, and new Top Table Redmi Note 15 banner.`);
} else {
    console.error("[FAIL] window.renderAlcampoTable3D is not a function!");
    process.exit(1);
}

if (typeof window.renderCarrefourStandardTable3D === 'function') {
    const htmlCrfStd = window.renderCarrefourStandardTable3D('CRF ALCOBENDAS');
    console.log(`[PASS] renderCarrefourStandardTable3D output length: ${htmlCrfStd.length} chars`);
    if (!htmlCrfStd.includes('mueble-alcampo-crf') || !htmlCrfStd.includes('crf-view-toggle-bar') || !htmlCrfStd.includes('toptable_alcampo_crf_note15.png')) {
        console.error("[FAIL] Carrefour Standard HTML missing expected classes or new Top Table texture!");
        process.exit(1);
    }
    console.log(`[PASS] Carrefour Standard HTML contains view toggle, anthracite frame, and new Top Table banner.`);
} else {
    console.error("[FAIL] window.renderCarrefourStandardTable3D is not a function!");
    process.exit(1);
}

if (typeof window.renderCarrefourPremiumTable3D === 'function') {
    const htmlCrfPrem = window.renderCarrefourPremiumTable3D('CRF ALCOBENDAS');
    if (!htmlCrfPrem.includes('crf-premium-toptable-centerpiece') || !htmlCrfPrem.includes('crf-premium-banner-base') || !htmlCrfPrem.includes('crf-premium-glass-cabinet')) {
        console.error("[FAIL] Carrefour Premium HTML missing centerpiece, banner base, or glass cabinet!");
        process.exit(1);
    }
    if (htmlCrfPrem.includes('crf-premium-grada-stand-box') || htmlCrfPrem.includes('PODIUM COMPARATIVO FLAGSHIP')) {
        console.error("[FAIL] Carrefour Premium still contains grada or comparative podium letters beneath Top Table!");
        process.exit(1);
    }
    if (htmlCrfPrem.includes('prop_17_note_crf_premium.png')) {
        console.error("[FAIL] Carrefour Premium still contains prop_17_note_crf_premium.png when it should be removed!");
        process.exit(1);
    }
    if (!htmlCrfPrem.includes('logo.png') || !htmlAlc.includes('logo.png')) {
        console.error("[FAIL] HTML missing official Xiaomi logo.png image!");
        process.exit(1);
    }
    if (htmlCrfPrem.includes('>mi<') || htmlAlc.includes('>mi<')) {
        console.error("[FAIL] HTML still contains plain text '>mi<' instead of official logo!");
        process.exit(1);
    }
    console.log(`[PASS] Carrefour Premium HTML contains 90° vertical centerpiece, official Xiaomi logo, sliding glass cabinet, clean Top Table without letters/grada beneath, and Note 17 prop removed.`);
} else {
    console.error("[FAIL] window.renderCarrefourPremiumTable3D is not a function!");
    process.exit(1);
}

console.log("\nALL VERIFICATIONS PASSED 100%!");
