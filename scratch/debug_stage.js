const fs = require('fs');

global.window = global;
global.window.addEventListener = () => {};
global.document = { querySelectorAll: () => [], getElementById: () => null, addEventListener: () => {} };
global.localStorage = { getItem: () => null, setItem: () => null };

eval(fs.readFileSync('stores_imei_real.js', 'utf-8'));
global.APP_CONFIG = { imeiDatabase: window.REAL_STORES_DATA.imei_db };

eval(fs.readFileSync('main_v130.js', 'utf-8'));

const html = window.renderAlcampoTable3D('ALCAMPO VAGUADA');

// Find all tags inside stage
const idxStage = html.indexOf('class="retail-3d-stage"');
const stageHtml = html.substring(idxStage, idxStage + 4000);
console.log("Stage HTML preview:");
console.log(stageHtml);
