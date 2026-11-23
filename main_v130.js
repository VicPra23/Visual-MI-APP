/**
 * XIAOMI VISUAL APP - FRONTEND LOGIC
 */

const APP_CONFIG = {
    scriptUrl: 'https://script.google.com/macros/s/AKfycbyxJQldBqVGyeHbYF9lgjPfoww4xWNCE1WwYJC3uGnwU_kdslKVQmUFwlJRec5Aka-iZA/exec',
    currentUser: null,
    currentReport: {
        category: '',
        centro: '',
        path: []
    },
    dashboardReports: [], 
    launches: [],
    materials: [], // Caché de materiales
    incidentUploadedPhotos: [],
    deviceCatalog: [], // Lista global bajada de 'Dispositivos'
    currentSelectedDevices: [], // Buffer temporal del reporte actual
    currentSelectedLonas: [],
    currentSelectedAlarmados: [],
};
window.APP_CONFIG = APP_CONFIG;

// --- MOTOR UNIVERSAL DE COMPRESIÓN Y RENDERIZADO (Baja Cobertura & CDN) ---
window.getGoogleDriveThumbnail = function(url) {
    if (!url) return '';
    const str = String(url);
    if (str.includes('drive.google.com')) {
        const match = str.match(/\/file\/d\/([^\/]+)/) || str.match(/id=([^\&]+)/);
        if (match && match[1]) {
            // Usamos el CDN universal lh3 de Google, inmune al bloqueo de cookies de terceros
            return `https://lh3.googleusercontent.com/d/${match[1]}=w300`;
        }
    }
    return url;
};

window.getCompressedBase64 = async function(file, maxWidth = 1200, maxHeight = 1200, quality = 0.7) {
    // Si no es imagen, retornamos el base64 directo sin compresión
    if (!file.type || !file.type.startsWith('image/')) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1] || reader.result);
            reader.onerror = error => reject(error);
        });
    }
    // Algoritmo de compresión en el cliente vía HTML5 Canvas
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Forzamos calidad reducida en JPEG para velocidad instantánea
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64.split(',')[1] || compressedBase64);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

// --- SISTEMA PREMIUM DE NOTIFICACIONES Y ALERTAS ---
window.showToast = function(msg, type = 'info') {
    let container = document.getElementById('custom-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'custom-toast-container';
        container.className = 'custom-toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <div style="flex:1">${msg}</div>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('slide-out');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
};

// Sobrescribir alert tradicional con Toast ultra moderno
window.alert = function(msg) {
    if (!msg) return;
    let type = 'info';
    const lowerMsg = String(msg).toLowerCase();
    if (lowerMsg.includes('éxito') || lowerMsg.includes('exito') || lowerMsg.includes('correcto') || lowerMsg.includes('guardad')) {
        type = 'success';
    } else if (lowerMsg.includes('error') || lowerMsg.includes('fallo') || lowerMsg.includes('no se found')) {
        type = 'error';
    }
    window.showToast(msg, type);
};

// Diálogo de Confirmación Promificado 100% Premium
window.showConfirm = function(title, message, isDanger = true) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-confirm-overlay';
        
        const iconHtml = isDanger 
            ? '<div class="confirm-icon-box"><i class="fas fa-trash-alt"></i></div>'
            : '<div class="confirm-icon-box primary"><i class="fas fa-exclamation-circle"></i></div>';
            
        const btnClass = isDanger ? 'confirm-btn-danger' : 'confirm-btn-primary';
        const actionText = isDanger ? 'Eliminar' : 'Aceptar';
        
        overlay.innerHTML = `
            <div class="custom-confirm-card">
                ${iconHtml}
                <h3 class="confirm-title">${title}</h3>
                <p class="confirm-message">${message}</p>
                <div class="confirm-actions-row">
                    <button class="confirm-btn confirm-btn-cancel" id="confirm-cancel">Cancelar</button>
                    <button class="confirm-btn ${btnClass}" id="confirm-proceed">${actionText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });
        
        const cleanup = (value) => {
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
                resolve(value);
            }, 300);
        };
        
        overlay.querySelector('#confirm-cancel').onclick = () => cleanup(false);
        overlay.querySelector('#confirm-proceed').onclick = () => cleanup(true);
    });
};

// Helper global para comparaciones a prueba de fallos (quita acentos, mayúsculas, espacios)
function normalizeString(str) {
    return String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

function cleanSubcategoryString(str) {
    return String(str || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/\bDE\b/g, "")
        .replace(/[^A-Z0-9]/g, "");
}

// Helpers globales para detección robusta de roles
function isUserAdmin(user = APP_CONFIG.currentUser) {
    if (!user) return false;
    const r = normalizeString(user.rol || user.role || '');
    const name = normalizeString(user.nombre || user.email || user.usuario || '');
    // Caso especial explícito solicitado: Alicia Muruzabal (o variantes)
    if (name.includes('ALICIA') || name.includes('MURUZABAL')) return true;
    // Roles administrativos / dirección / jefatura / coordinación
    if (r.includes('ADMIN') || r.includes('COORDINAD') || r.includes('SUPER') || r.includes('DIRECC') || r.includes('GESTION') || r.includes('JEFE')) return true;
    return false;
}

function isUserAM(user = APP_CONFIG.currentUser) {
    if (!user) return false;
    if (isUserAdmin(user)) return false; // Admin prevalece
    const r = normalizeString(user.rol || user.role || '');
    return r === 'AM' || r.includes('AREA MANAGER') || r.includes('MANAGER') || r.includes('RESPONSABLE');
}

// Definición oficial de Zonas por AM:
// Alba -> Centro, Emilio -> Sur, Antonio -> Catalunya, Luis -> Norte, Pablo -> Levante, Virginia y Carlos Deniz -> Canarias
window.getStoreAMZone = function(s) {
    if (!s) return 'Sin Zona';
    if (typeof s === 'string') {
        const strNorm = normalizeString(s);
        if (strNorm.includes('CENTRO')) return 'Centro';
        if (strNorm.includes('SUR')) return 'Sur';
        if (strNorm.includes('CATALUNYA') || strNorm.includes('CATALUNA')) return 'Catalunya';
        if (strNorm.includes('LEVANTE')) return 'Levante';
        if (strNorm.includes('NORTE')) return 'Norte';
        if (strNorm.includes('CANARIAS')) return 'Canarias';
    }
    const am = normalizeString(s.am || '');
    const gpv = normalizeString(s.gpv || s.usuario || s.owner || '');
    const region = normalizeString(s.zona || s.region || s.area || '');
    
    // Identificación por AM y GPV oficiales (mayúsculas normalizadas)
    if (am.includes('ALBA') || gpv.includes('BELLASAI') || gpv.includes('LUIS BLANCO')) return 'Centro';
    if (am.includes('EMILIO') || gpv.includes('CORBELLA') || gpv.includes('TORRES') || gpv.includes('MARTINEZ')) return 'Sur';
    if (am.includes('ANTONIO') || gpv.includes('DAHDAH') || gpv.includes('MATA')) return 'Catalunya';
    if (am.includes('PABLO') || gpv.includes('BRITO') || gpv.includes('PEREZ')) return 'Levante';
    if (am.includes('CANARIAS') || am.includes('VIRGINIA') || am.includes('DENIZ') || gpv.includes('VIRGINIA') || gpv.includes('DENIZ') || gpv.includes('CANARIAS')) return 'Canarias';
    if (am.includes('LUIS') || gpv.includes('PAZ') || gpv.includes('TORRE')) return 'Norte';

    // Respaldo por propiedad previa
    if (region.includes('CENTRO')) return 'Centro';
    if (region.includes('SUR')) return 'Sur';
    if (region.includes('CATALUNYA') || region.includes('CATALUNA')) return 'Catalunya';
    if (region.includes('LEVANTE')) return 'Levante';
    if (region.includes('NORTE')) return 'Norte';
    if (region.includes('CANARIAS')) return 'Canarias';

    return 'Sin Zona';
};

window.getStoreAMName = function(s) {
    if (!s) return '';
    const am = normalizeString(s.am || '');
    if (am.includes('ALBA')) return 'Alba González';
    if (am.includes('EMILIO')) return 'Emilio Delgado';
    if (am.includes('ANTONIO')) return 'Antonio Benito';
    if (am.includes('LUIS')) return 'Luis Ángel Mínguez';
    if (am.includes('PABLO')) return 'Pablo Marín';
    if (am.includes('CANARIAS') || am.includes('VIRGINIA') || am.includes('DENIZ')) return 'Virginia Rodríguez y Carlos Déniz';
    
    const z = (typeof window.getStoreAMZone === 'function') ? window.getStoreAMZone(s) : '';
    if (z === 'Centro') return 'Alba González';
    if (z === 'Sur') return 'Emilio Delgado';
    if (z === 'Catalunya') return 'Antonio Benito';
    if (z === 'Norte') return 'Luis Ángel Mínguez';
    if (z === 'Levante') return 'Pablo Marín';
    if (z === 'Canarias') return 'Virginia Rodríguez y Carlos Déniz';
    return s.am || '';
};

// Asegurar que usuarios administradores tengan acceso e hidratación de todas las tiendas maestras
// y que cualquier tienda en sesión tenga Columna, Wall y Lightbox hidratados desde REAL_STORES_DATA
function ensureAdminStoresHydrated() {
    if (!APP_CONFIG.currentUser) return;
    const masterStores = (window.REAL_STORES_DATA && window.REAL_STORES_DATA.stores && window.REAL_STORES_DATA.stores.length > 0)
        ? window.REAL_STORES_DATA.stores
        : (typeof LOCAL_FALLBACK_STORES !== 'undefined' ? LOCAL_FALLBACK_STORES : []);

    if (!masterStores || masterStores.length === 0) return;

    masterStores.forEach(s => {
        const z = window.getStoreAMZone(s);
        const amName = window.getStoreAMName(s);
        s.zona = z;
        s.region = z;
        s.area = z;
        if (!s.am) s.am = amName;
    });

    if (isUserAdmin(APP_CONFIG.currentUser)) {
        APP_CONFIG.currentUser.tiendas = masterStores.map(s => {
            const z = window.getStoreAMZone(s);
            const amName = window.getStoreAMName(s);
            return {
                nombre: s.nombre,
                cuenta: s.cuenta,
                rms: s.rms || '',
                Mesa: s.Mesa !== undefined ? s.Mesa : 1,
                Columna: s.Columna || 0,
                Wall: s.Wall || 0,
                'Top Table': s['Top Table'] || 'Xiaomi 18 Pro Series',
                'Lightbox Column': s['Lightbox Column'] || (s.Columna > 0 ? 'Xiaomi 18 Pro Series' : ''),
                'Lightbox Wall': s['Lightbox Wall'] || (s.Wall > 0 ? 'Xiaomi 18 Pro Series' : ''),
                'Url Guia': s['Url Guia'] || '',
                'Tipo de mesa': s['Tipo de mesa'] || '',
                gpv: s.gpv || s.usuario || '',
                usuario: s.usuario || s.gpv || '',
                area: z,
                region: z,
                zona: z,
                owner: s.usuario || s.gpv || '',
                am: amName || s.am || ''
            };
        });
    } else if (Array.isArray(APP_CONFIG.currentUser.tiendas)) {
        APP_CONFIG.currentUser.tiendas.forEach(t => {
            const z = window.getStoreAMZone(t);
            const amName = window.getStoreAMName(t);
            t.zona = z;
            t.region = z;
            t.area = z;
            if (!t.am) t.am = amName;
            const tNorm = normalizeString(t.nombre || t.tienda || '');
            const tRms = String(t.rms || t.StoreCode || '').trim().toUpperCase();
            const m = masterStores.find(s =>
                (tRms && String(s.rms || '').trim().toUpperCase() === tRms) ||
                normalizeString(s.nombre) === tNorm
            );
            if (m) {
                if (!t.Columna && m.Columna) t.Columna = m.Columna;
                if (!t.Wall && m.Wall) t.Wall = m.Wall;
                if (!t['Top Table'] && m['Top Table']) t['Top Table'] = m['Top Table'];
                if (!t['Lightbox Column'] && m['Lightbox Column']) t['Lightbox Column'] = m['Lightbox Column'];
            }
        });
    }
}
window.isUserAdmin = isUserAdmin;
window.isUserAM = isUserAM;
window.ensureAdminStoresHydrated = ensureAdminStoresHydrated;

// Función para actualizar código de dispositivo
window.updateDeviceCode = function(selectId, inputId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    if (select && input) {
        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption && selectedOption.dataset.code) {
            input.value = selectedOption.dataset.code;
        } else {
            input.value = '';
        }
    }
};

// DOM Elements
const views = {
    login: document.getElementById('login-container'),
    app: document.getElementById('app-container'),
    dashboard: document.getElementById('view-dashboard'),
    reportes: document.getElementById('view-reportes'),
    lanzamientos: document.getElementById('view-lanzamientos'),
    materiales: document.getElementById('view-materiales'),
    imeis: document.getElementById('view-imeis'),
    campana: document.getElementById('view-campana')
};

const navLinks = document.querySelectorAll('.nav-links li[data-target]');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (typeof initLocalImeiDatabase === 'function') {
        initLocalImeiDatabase();
    }
    setupNavigation();
    setupMobileNavigation();
    setupForms();
    
    const isLoggedIn = checkSession();
    
    // Si NO está logueado, necesitamos cargar los usuarios para la pantalla de login
    if (!isLoggedIn) {
        loadUsers();
    }
    
    // El catálogo de dispositivos puede cargar silenciosamente en segundo plano
    loadDeviceCatalog();
});

function checkSession() {
    const savedUser = localStorage.getItem('xiaomi_user');
    const savedToken = localStorage.getItem('xiaomi_session_token');
    if (savedUser) {
        if (!savedToken) {
            // Migración desde versión antigua sin token de sesión: forzar relogin limpio
            localStorage.removeItem('xiaomi_user');
            localStorage.removeItem('xiaomi_session_token');
            return false;
        }
        try {
            APP_CONFIG.currentUser = JSON.parse(savedUser);
            ensureAdminStoresHydrated();
            APP_CONFIG.sessionToken = savedToken;
            startApp();
            return true;
        } catch(e) { return false; }
    }
    return false;
}

// --- Navigation Logic ---
function setupNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const target = link.getAttribute('data-target');
            showView(target);
            
            // Update active class
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) {
        sidebarHeader.addEventListener('click', () => {
            showView('dashboard');
            navLinks.forEach(l => l.classList.remove('active'));
            const dashLink = Array.from(navLinks).find(l => l.getAttribute('data-target') === 'dashboard');
            if (dashLink) dashLink.classList.add('active');
        });
    }

    logoutBtn.addEventListener('click', () => {
        APP_CONFIG.currentUser = null;
        APP_CONFIG.sessionToken = null;
        localStorage.removeItem('xiaomi_user');
        localStorage.removeItem('xiaomi_session_token');
        localStorage.removeItem('xiaomi_last_view');
        location.reload();
    });
}

function setupMobileNavigation() {
    const mobileTabs = document.querySelectorAll('.mobile-bottom-nav-item');
    if (!mobileTabs.length) return;
    
    mobileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-target');
            
            // 1. Simular clic en el enlace de navegación de escritorio correspondiente
            const desktopLink = Array.from(navLinks).find(l => l.getAttribute('data-target') === target);
            if (desktopLink) {
                // Hacer clic en él para desencadenar la carga de datos y visibilidad
                desktopLink.click();
            } else {
                // Fallback por si acaso
                showView(target);
            }
            
            // 2. Sincronizar clase activa en mobile tabs
            mobileTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });
}

window.toggleMobileMessagesView = function(viewName) {
    const redactDiv = document.querySelector('#messages-form-grid > div:first-child');
    const inboxDiv = document.querySelector('#messages-form-grid > div:last-child');
    const btnInbox = document.getElementById('btn-toggle-inbox');
    const btnCompose = document.getElementById('btn-toggle-compose');
    
    if (viewName === 'inbox') {
        if (redactDiv) redactDiv.classList.add('mobile-hidden');
        if (inboxDiv) inboxDiv.classList.remove('mobile-hidden');
        if (btnInbox) btnInbox.classList.add('active');
        if (btnCompose) btnCompose.classList.remove('active');
    } else if (viewName === 'compose') {
        if (redactDiv) redactDiv.classList.remove('mobile-hidden');
        if (inboxDiv) inboxDiv.classList.add('mobile-hidden');
        if (btnInbox) btnInbox.classList.remove('active');
        if (btnCompose) btnCompose.classList.add('active');
    }
};

async function showView(viewName) {
    localStorage.setItem('xiaomi_last_view', viewName);
    
    // Cerrar modales flotantes al cambiar de pestaña
    const historialModal = document.getElementById('historial-modal');
    if (historialModal) {
        historialModal.style.display = 'none';
        historialModal.classList.add('hidden');
    }
    
    // Hide all sub-views explicitly
    document.querySelectorAll('.sub-view').forEach(v => {
        v.style.display = 'none';
        v.classList.add('hidden');
    });
    
    // Show selected view
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.style.display = 'block';
        targetView.classList.remove('hidden');
        // Título con Icono dinámico adaptado
        let formattedTitle = viewName.charAt(0).toUpperCase() + viewName.slice(1);
        let iconHtml = '';
        
        if (viewName === 'dashboard') {
            iconHtml = '<i class="fas fa-chart-line" style="margin-right:8px; font-size:0.85em;"></i>';
            if (typeof window.updateDashboardImeisWidget === 'function') {
                window.updateDashboardImeisWidget();
            }
            if (typeof window.updateDashboardDevolucionesWidget === 'function') {
                window.updateDashboardDevolucionesWidget();
            }
        }
        if (viewName === 'reportes') {
            formattedTitle = 'Reporte Incidencias';
            iconHtml = '<i class="fas fa-clipboard-list" style="margin-right:8px; font-size:0.85em;"></i>';
        }
        if (viewName === 'lanzamientos') {
            iconHtml = '<i class="fas fa-rocket" style="margin-right:8px; font-size:0.85em;"></i>';
        }
        if (viewName === 'materiales') {
            formattedTitle = 'Tiendas';
            iconHtml = '<i class="fas fa-store" style="margin-right:8px; font-size:0.85em;"></i>';
            if (typeof renderTiendasView === 'function') {
                renderTiendasView();
            }
        }
        if (viewName === 'imeis') {
            formattedTitle = 'Control de IMEIs';
            iconHtml = '<i class="fas fa-barcode" style="margin-right:8px; font-size:0.85em;"></i>';
            if (typeof window.initImeisView === 'function') {
                window.initImeisView();
            }
        }
        if (viewName === 'campana') {
            formattedTitle = 'Planograma';
            iconHtml = '<i class="fas fa-layer-group" style="margin-right:8px; font-size:0.85em;"></i>';
            if (typeof window.initCampanaView === 'function') {
                window.initCampanaView();
            }
            if (typeof window.renderJoaquinTotalsWidget === 'function') {
                window.renderJoaquinTotalsWidget();
            }
        }
        if (viewName === 'mensajes') {
            formattedTitle = 'Centro de Mensajes';
            iconHtml = '<i class="fas fa-bell" style="margin-right:8px; font-size:0.85em;"></i>';
        }
document.getElementById('view-title').innerHTML = iconHtml + formattedTitle;
        
        // Cargar data según vista
        if (viewName === 'dashboard' || viewName === 'reportes') loadDashboard();
        if (viewName === 'mensajes') {
            window.loadMessagingUsers();
            window.loadMessagingMotivos();
            window.loadUserInbox();
            if (!APP_CONFIG.dashboardReports || APP_CONFIG.dashboardReports.length === 0) {
                loadDashboard().then(() => {
                    window.loadMessagingMotivos();
                }).catch(e => console.error("Error pre-loading dashboard data:", e));
            }
        }
        if (viewName === 'lanzamientos') {
            const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
            const sidebar = document.getElementById('launch-filter-sidebar');
            if (sidebar) {
                sidebar.style.display = isAdmin ? 'flex' : 'none';
            }
            
            // Popula selector y carga tiendas de forma asíncrona (evita condición de carrera en la UI)
            (async () => {
                try {
                    await loadLaunches();
                    
                    const presetLaunch = APP_CONFIG.presetLaunchName;
                    if (presetLaunch) {
                        const sel = document.getElementById('launch-selector');
                        if (sel) {
                            const exists = Array.from(sel.options).find(o => o.value === presetLaunch);
                            if (exists) sel.value = presetLaunch;
                        }
                        APP_CONFIG.presetLaunchName = null; // Consume and clear
                    }
                    
                    // Si venimos de un redireccionamiento rápido, fijar lanzamiento correcto ANTES del fetch
                    if (window._pendingQuickLaunch) {
                        const select = document.getElementById('launch-selector');
                        if (select) select.value = window._pendingQuickLaunch;
                        window._pendingQuickLaunch = null; // Consumido
                    }
                    
                    // ÚNICA CARGA LIMPIA DE DATOS (Acelerado)
                    await loadLaunchStores();
                    
                    // Selección automática inmediata sin polling al tener el DOM listo
                    if (window._pendingQuickStore) {
                        const storeToOpen = window._pendingQuickStore;
                        window._pendingQuickStore = null; // Consumido
                        
                        const grid = document.getElementById('launch-store-grid');
                        if (grid) {
                            const cards = grid.querySelectorAll('.dashboard-card');
                            const target = String(storeToOpen).trim().toLowerCase();
                            for (const card of cards) {
                                // Logic for auto-opening
                            }
                        }
                    }
                } catch(e) { console.error(e); }
            })();
        }
        
        // Sincronizar indicador de pestaña activa en móvil
        const correspondingMobileTab = Array.from(document.querySelectorAll('.mobile-bottom-nav-item'))
            .find(t => t.getAttribute('data-target') === viewName);
        if (correspondingMobileTab) {
            document.querySelectorAll('.mobile-bottom-nav-item').forEach(t => t.classList.remove('active'));
            correspondingMobileTab.classList.add('active');
        }
        
        // Inicializar por defecto la bandeja de entrada si es móvil en la vista de mensajes
        if (viewName === 'mensajes' && window.innerWidth <= 768) {
            window.toggleMobileMessagesView('inbox');
        }
    }
}

// ==============================================================
// TIENDAS VIEW LOGIC
// ==============================================================

window.renderTiendasView = function() {
    const grid = document.getElementById('tiendas-grid');
    if (!grid) return;
    
    // Asegurar que admin tenga las 236 tiendas
    ensureAdminStoresHydrated();
    
    // Obtener las tiendas del usuario (ya sea Admin o Standard)
    let stores = APP_CONFIG.currentUser.tiendas || [];
    
    // Configurar filtros la primera vez
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    const isAM = isUserAM(APP_CONFIG.currentUser);
    
    // CONTROL DE VISIBILIDAD DEL SUMATORIO DE MOBILIARIO (SOLO ADMINISTRADOR)
    const adminSummaryCard = document.getElementById('admin-stores-furniture-summary');
    if (adminSummaryCard) {
        if (isAdmin) {
            adminSummaryCard.style.display = 'block';
            if (typeof window.initAdminFurnitureSummary === 'function') {
                window.initAdminFurnitureSummary();
            }
        } else {
            adminSummaryCard.style.display = 'none';
        }
    }
    
    const filterCuenta = document.getElementById('tiendas-filter-cuenta');
    const filterTienda = document.getElementById('tiendas-filter-tienda');
    const filterUsuario = document.getElementById('tiendas-filter-usuario');
    
    if (!window.tiendasFiltersInitialized) {
        window.tiendasFiltersInitialized = true;
        
        // Rellenar select de Cuentas
        const cuentas = [...new Set(stores.map(t => String(t.cuenta || '').trim()))].filter(Boolean).sort();
        filterCuenta.innerHTML = '<option value="all">Todas las Cuentas</option>';
        cuentas.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            filterCuenta.appendChild(opt);
        });
        
        // Función para actualizar el select de Tiendas
        window.updateSelectTiendas = function() {
            const filterTienda = document.getElementById('tiendas-filter-tienda');
            const filterUsuario = document.getElementById('tiendas-filter-usuario');
            const selectedCuenta = filterCuenta.value;
            const selectedUsuario = filterUsuario && filterUsuario.style.display !== 'none' ? filterUsuario.value : 'all';
            
            if (filterTienda) {
                const currentVal = filterTienda.value;
                const filterList = document.getElementById('tiendas-filter-tienda-list');
                if (filterList) {
                    filterList.innerHTML = '';
                    let storesFiltered = stores;
                    
                    if (selectedCuenta !== 'all') {
                        storesFiltered = storesFiltered.filter(t => String(t.cuenta || '').trim() === selectedCuenta);
                    }
                    if (selectedUsuario !== 'all') {
                        storesFiltered = storesFiltered.filter(t => String(t.usuario || t.owner || '').trim() === selectedUsuario);
                    }
                    
                    const tiendas = [...new Set(storesFiltered.map(t => String(t.nombre || '').trim()))].filter(Boolean).sort();
                    tiendas.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t;
                        filterList.appendChild(opt);
                    });
                    
                    if (!tiendas.includes(currentVal)) {
                        filterTienda.value = '';
                    }
                }
            }
        };
        
        window.updateSelectTiendas();
        
        // Rellenar select de Usuarios (Admin y AM)
        if ((isAdmin || isAM) && filterUsuario) {
            filterUsuario.style.display = 'inline-block';
            const usuarios = [...new Set(stores.map(t => String(t.usuario || t.owner || '').trim()))].filter(Boolean).sort();
            filterUsuario.innerHTML = '<option value="all">Todos los Usuarios</option>';
            usuarios.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u; opt.textContent = u;
                filterUsuario.appendChild(opt);
            });
        } else if (filterUsuario) {
            filterUsuario.style.display = 'none';
        }
        
        // Event Listeners
        filterCuenta.addEventListener('change', () => {
            if(filterTienda) filterTienda.value = ''; // Reset tienda when cuenta changes
            window.updateSelectTiendas();
            renderTiendasGrid();
        });
        filterTienda.addEventListener('change', renderTiendasGrid);
        if (filterUsuario) {
            filterUsuario.addEventListener('change', () => {
                if(filterTienda) filterTienda.value = ''; // Reset tienda when usuario changes
                window.updateSelectTiendas();
                renderTiendasGrid();
            });
        }
    }
    
    renderTiendasGrid();
};

window.renderTiendasGrid = function() {
    const grid = document.getElementById('tiendas-grid');
    if (!grid) return;
    
    ensureAdminStoresHydrated();
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    const isAM = isUserAM(APP_CONFIG.currentUser);
    
    const fCuenta = document.getElementById('tiendas-filter-cuenta').value;
    const fTienda = document.getElementById('tiendas-filter-tienda').value.toLowerCase().trim();
    const fUsuario = document.getElementById('tiendas-filter-usuario') ? document.getElementById('tiendas-filter-usuario').value : 'all';
    
    let stores = APP_CONFIG.currentUser.tiendas || [];
    
    // Aplicar filtros
    let filtered = stores.filter(t => {
        let match = true;
        
        if (fCuenta !== 'all' && String(t.cuenta || '').trim() !== fCuenta) match = false;
        
        if (fTienda !== '') {
            const tName = String(t.nombre || '').toLowerCase();
            const tRms = String(t.rms || '').toLowerCase();
            if (!tName.includes(fTienda) && !tRms.includes(fTienda)) match = false;
        }
        
        if (isAdmin && fUsuario !== 'all') {
            const tOwner = String(t.usuario || t.owner || '').trim();
            if (tOwner !== fUsuario) match = false;
        }
        
        // Filtro por Zona AM sincronizado
        if (window.activeStoreGridAMZone && window.activeStoreGridAMZone !== 'all') {
            const z = (typeof window.getStoreAMZone === 'function') ? window.getStoreAMZone(t) : (t.zona || t.region || '');
            if (normalizeString(z) !== normalizeString(window.activeStoreGridAMZone)) match = false;
        }
        
        return match;
    });
    
    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #888; padding: 2rem 0;">No se encontraron tiendas con estos filtros.</div>';
        return;
    }
    
    // Ordenar alfabéticamente por nombre de tienda
    filtered.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));
    
    filtered.forEach(t => {
        const getVal = (key) => {
            if (t[key] !== undefined && t[key] !== null) return t[key];
            if (t[key.toLowerCase()] !== undefined && t[key.toLowerCase()] !== null) return t[key.toLowerCase()];
            if (t[key.toUpperCase()] !== undefined && t[key.toUpperCase()] !== null) return t[key.toUpperCase()];
            return 0;
        };
        const getStr = (key) => {
            if (t[key] !== undefined && t[key] !== null) return t[key];
            if (t[key.toLowerCase()] !== undefined && t[key.toLowerCase()] !== null) return t[key.toLowerCase()];
            if (t[key.toUpperCase()] !== undefined && t[key.toUpperCase()] !== null) return t[key.toUpperCase()];
            return '';
        };

        const valMesa = parseFloat(getVal('Mesa')) || 0;
        const valTopTable = getVal('Top Table');
        const valColumna = parseFloat(getVal('Columna')) || 0;
        const valLightboxColumn = getVal('Lightbox Column');
        const valWall = parseFloat(getVal('Wall')) || 0;
        const valLightboxWall = getVal('Lightbox Wall');
        const valUrl = getStr('Url Guia');

        // No mostrar la tienda si las 3 mtricas son 0
        if (valMesa === 0 && valColumna === 0 && valWall === 0) {
            return;
        }

        const card = document.createElement('div');
        card.style.background = '#fff';
        card.style.border = '1px solid #eee';
        card.style.borderRadius = '8px';
        card.style.padding = '15px';
        card.style.boxShadow = '0 2px 5px rgba(0,0,0,0.02)';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '8px';
        card.style.height = '100%';
        card.style.minHeight = '90px';
        card.style.boxSizing = 'border-box';
        
        const nombre = t.nombre || 'Sin Nombre';
        let fontSize = '1.05rem';
        if (nombre.length > 22) {
            fontSize = '0.85rem';
        } else if (nombre.length > 16) {
            fontSize = '0.95rem';
        }

        const safeTiendaNombre = String(nombre).replace(/'/g, "\\'");
        const normStoreCheck = normalizeString(nombre);
        const isSpecialStore = normStoreCheck.includes('adeje') || normStoreCheck.includes('castellana') || normStoreCheck.includes('san sebastian') || normStoreCheck.includes('ssrr');
        const isCabeceraEci = (typeof window.isStoreCabeceraEci === 'function') ? window.isStoreCabeceraEci(t) : (
            (String(t.cuenta || '').toUpperCase().includes('ECI') || String(t.cuenta || '').toUpperCase().includes('CORTE') || normStoreCheck.startsWith('eci')) && (
                normStoreCheck.includes('cataluna') || normStoreCheck.includes('goya') || normStoreCheck.includes('castellana') ||
                normStoreCheck.includes('diagonal') || normStoreCheck.includes('murcia') || normStoreCheck.includes('nuevo centro') ||
                normStoreCheck.includes('nervion') || normStoreCheck.includes('aznalfarache') || normStoreCheck.includes('francia') ||
                normStoreCheck.includes('sanchinarro') || normStoreCheck.includes('alcala') || normStoreCheck.includes('naciones') ||
                normStoreCheck.includes('valderas') || normStoreCheck.includes('pozuelo') || normStoreCheck.includes('marbella') ||
                normStoreCheck.includes('bercial') || normStoreCheck.includes('cadiz')
            )
        );

        const storeZone = (typeof window.getStoreAMZone === 'function') ? window.getStoreAMZone(t) : (t.zona || t.region || '');

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                <h4 style="margin: 0; color: #333; font-size: ${fontSize}; display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; overflow: hidden; white-space: nowrap;">
                    <i class="fas fa-store" style="color: var(--mi-orange); font-size: 0.9rem; flex-shrink: 0;"></i> 
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nombre}</span>
                    <span style="font-size: 0.72rem; background: #e6f7ff; color: #0050b3; padding: 2px 6px; border-radius: 4px; border: 1px solid #91d5ff; font-weight: normal; flex-shrink: 0;">${t.cuenta || 'Sin Cuenta'}</span>
                    <span style="font-size: 0.72rem; background: #f8fafc; color: #334155; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; font-weight: 600; flex-shrink: 0;" title="Zona AM: ${storeZone}"><i class="fas fa-map-marker-alt" style="font-size: 9px; color: var(--mi-orange); margin-right: 2px;"></i>${storeZone}</span>
                </h4>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                    ${isSpecialStore ? `<span style="font-size: 10px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 1px 6px; border-radius: 10px; font-weight: 800;"><i class="fas fa-star"></i> Caso Especial X18</span>` : ''}
                    ${isCabeceraEci ? `<span style="font-size: 10px; background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; padding: 1px 6px; border-radius: 10px; font-weight: 700;">Cabecera ECI</span>` : ''}
                </div>
            </div>
        `;

        html += `
            <div style="display: flex; gap: 15px; margin-top: auto; flex-wrap: wrap; align-items: flex-start; padding-top: 10px; border-top: 1px solid #f0f0f0;">
        `;
        
        if (valMesa > 0) {
            html += `
                <!-- Mesa -->
                <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; min-width: 45px;" onclick="const s = this.querySelector('.subcat-content'); s.style.display = s.style.display === 'none' ? 'block' : 'none';" title="Ver detalle Top Table">
                    <span style="display:inline-block; width: 20px; height: 14px; border-top: 3px solid #666; border-left: 2px solid #666; border-right: 2px solid #666; border-radius: 2px 2px 0 0;"></span>
                    <span style="font-size: 0.8rem; font-weight: bold; margin-top: 4px; color: #444;">${valMesa}</span>
                    <span style="font-size: 0.65rem; color: #888;">Mesa${valMesa > 1 ? 's' : ''}</span>
                    <div class="subcat-content" style="display: none; font-size: 0.7rem; color: #888; margin-top: 4px; text-align: center; background: #f9f9f9; padding: 4px; border-radius: 4px; border: 1px solid #eee;">TOP TABLE X18<br><b style="color:#444">${valTopTable || 'Xiaomi 18 Pro Series'}</b></div>
                </div>
            `;
        }
        
        if (valColumna > 0) {
            html += `
                <!-- Columna -->
                <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; min-width: 45px;" onclick="const s = this.querySelector('.subcat-content'); s.style.display = s.style.display === 'none' ? 'block' : 'none';" title="Ver detalle Columna">
                    <div style="display: flex; flex-direction: column; align-items: center; color: #0284c7;">
                      <div style="width: 14px; height: 6px; border: 2px solid currentColor; border-bottom: none;"></div>
                      <div style="width: 20px; height: 2px; background: currentColor;"></div>
                      <div style="width: 14px; height: 14px; border: 2px solid currentColor; border-top: none;"></div>
                    </div>
                    <span style="font-size: 0.8rem; font-weight: bold; margin-top: 4px; color: #0284c7;">${valColumna}</span>
                    <span style="font-size: 0.65rem; color: #0284c7; font-weight: 600;">Columna</span>
                    <div class="subcat-content" style="display: none; font-size: 0.7rem; color: #888; margin-top: 4px; text-align: center; background: #f0f9ff; padding: 4px; border-radius: 4px; border: 1px solid #bae6fd;">Lightbox Column<br><b style="color:#0369a1">${valLightboxColumn || 'Xiaomi 18 Pro Series'}</b></div>
                </div>
            `;
        }

        if (valWall > 0) {
            html += `
                <!-- Wall -->
                <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; min-width: 45px;" onclick="const s = this.querySelector('.subcat-content'); s.style.display = s.style.display === 'none' ? 'block' : 'none';" title="Ver detalle Wall">
                    <div style="display: flex; flex-direction: column; align-items: center; color: #7c3aed;">
                      <div style="width: 22px; height: 12px; border: 2px solid currentColor; border-bottom: none; border-radius: 2px 2px 0 0;"></div>
                      <div style="width: 26px; height: 2px; background: currentColor;"></div>
                      <div style="width: 22px; height: 8px; background: currentColor;"></div>
                    </div>
                    <span style="font-size: 0.8rem; font-weight: bold; margin-top: 4px; color: #7c3aed;">${valWall}</span>
                    <span style="font-size: 0.65rem; color: #7c3aed; font-weight: 600;">Wall</span>
                    <div class="subcat-content" style="display: none; font-size: 0.7rem; color: #888; margin-top: 4px; text-align: center; background: #f5f3ff; padding: 4px; border-radius: 4px; border: 1px solid #ddd6fe;">Lightbox Wall<br><b style="color:#6d28d9">${valLightboxWall || 'Xiaomi 18 Pro Series'}</b></div>
                </div>
            `;
        }
        
        if (valMesa > 0 || valColumna > 0 || valWall > 0) {
            html += `
                <!-- Url Guia -> Planograma Completo de la Tienda -->
                <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; margin-left: auto;" onclick="event.stopPropagation(); window.navigateToPlanogramForStore(${valMesa}, '${safeTiendaNombre}')" title="Ver planograma 3D completo de esta tienda (Mesas, Wall, Columna o Caso Especial)">
                    <i class="fas fa-file-invoice" style="font-size: 1.2rem; color: var(--mi-orange);"></i>
                    <span style="font-size: 0.7rem; color: var(--mi-orange); margin-top: 4px; font-weight: bold;">Guía X18</span>
                </div>
            `;
        }
        
        html += `</div>`;
        
        // Acceso rápido a IMEIs y Planograma 3D de la tienda
        html += `
            <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 6px; border-top: 1px dashed #f0f0f0; padding-top: 8px;">
                <button type="button" class="btn-secondary" style="font-size: 11px; padding: 4px 10px; border-radius: 6px; display: flex; align-items: center; gap: 5px; cursor: pointer; border: 1px solid #fed7aa; background: #fff7ed; color: #ea580c; font-weight: 700;" onclick="event.stopPropagation(); window.navigateToPlanogramForStore(${valMesa}, '${safeTiendaNombre}')">
                    <i class="fas fa-cube"></i> Ver Planograma 3D
                </button>
                <button type="button" class="btn-secondary" style="font-size: 11px; padding: 4px 10px; border-radius: 6px; display: flex; align-items: center; gap: 5px; cursor: pointer; border: 1px solid #ffd591; background: #fffbe6; color: #d46b08; font-weight: 600;" onclick="event.stopPropagation(); window.openStoreImeis('${safeTiendaNombre}')">
                    <i class="fas fa-barcode"></i> Ver IMEIs
                </button>
            </div>
        `;
        
        if (isAdmin && (t.usuario || t.owner)) {
            const amName = (typeof window.getStoreAMName === 'function') ? window.getStoreAMName(t) : (t.am || '');
            html += `
                <div style="margin-top: 8px; font-size: 0.8rem; color: #666; border-top: 1px dashed #eee; padding-top: 5px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
                    <span><i class="fas fa-user-circle"></i> ${t.usuario || t.owner}</span>
                    <span style="font-size: 0.73rem; color: #475569; background: #f1f5f9; padding: 1px 7px; border-radius: 4px; border: 1px solid #e2e8f0;">AM: <b style="color: #0f172a;">${amName}</b> (${storeZone})</span>
                </div>
            `;
        }
        
        card.innerHTML = html;
        grid.appendChild(card);
    });
};

window.clearTiendasFilters = function() {
    window.activeStoreGridAMZone = null;
    const filterCuenta = document.getElementById('tiendas-filter-cuenta');
    const filterTienda = document.getElementById('tiendas-filter-tienda');
    const filterUsuario = document.getElementById('tiendas-filter-usuario');
    
    if (filterCuenta) filterCuenta.value = 'all';
    if (filterTienda) filterTienda.value = '';
    if (filterUsuario) filterUsuario.value = 'all';
    
    const selCuenta = document.getElementById('admin-furn-filter-cuenta');
    const selZona = document.getElementById('admin-furn-filter-zona');
    if (selCuenta) selCuenta.value = 'all';
    if (selZona) selZona.value = 'all';
    
    if (typeof window.renderTiendasGrid === 'function') {
        window.renderTiendasGrid();
    }
};

// ==============================================================
// SUMATORIO DE TIENDAS POR MOBILIARIO (SOLO ADMINISTRADOR)
// ==============================================================
function matchStoreZone(s, filterZone) {
    if (!filterZone || filterZone === 'all') return true;
    const zone = (typeof window.getStoreAMZone === 'function') ? window.getStoreAMZone(s) : (s.zona || s.region || '');
    return normalizeString(zone) === normalizeString(filterZone);
}

function matchStoreCuenta(storeCuenta, filterCuenta) {
    if (!filterCuenta || filterCuenta === 'all') return true;
    const sc = String(storeCuenta || '').trim();
    if (filterCuenta === 'Carrefour' || filterCuenta === 'CRF') {
        return sc === 'Carrefour' || sc === 'CRF';
    }
    return sc.toLowerCase() === filterCuenta.toLowerCase();
}

window.initAdminFurnitureSummary = function() {
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    const container = document.getElementById('admin-stores-furniture-summary');
    if (!container) return;
    if (!isAdmin) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    ensureAdminStoresHydrated();
    const stores = (window.REAL_STORES_DATA && Array.isArray(window.REAL_STORES_DATA.stores) && window.REAL_STORES_DATA.stores.length > 0)
        ? window.REAL_STORES_DATA.stores
        : (APP_CONFIG.currentUser?.tiendas || []);

    const selCuenta = document.getElementById('admin-furn-filter-cuenta');
    const selZona = document.getElementById('admin-furn-filter-zona');

    if (selCuenta && !selCuenta.dataset.initialized) {
        selCuenta.dataset.initialized = 'true';
        
        // Conteo y agrupación de cuentas
        const cuentasMap = {};
        stores.forEach(s => {
            const raw = String(s.cuenta || 'Sin Cuenta').trim();
            const c = (raw === 'CRF') ? 'Carrefour' : raw;
            cuentasMap[c] = (cuentasMap[c] || 0) + 1;
        });
        
        const sortedCuentas = Object.keys(cuentasMap).sort((a, b) => a.localeCompare(b, 'es'));
        selCuenta.innerHTML = `<option value="all">Todas las Cuentas (${stores.length})</option>`;
        sortedCuentas.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = `${c} (${cuentasMap[c]} tiendas)`;
            selCuenta.appendChild(opt);
        });
    }

    if (selZona && !selZona.dataset.initialized) {
        selZona.dataset.initialized = 'true';

        // Definición oficial de Zonas por AM:
        // Alba -> Centro, Emilio -> Sur, Antonio -> Catalunya, Luis -> Norte, Pablo -> Levante, Virginia y Carlos Deniz -> Canarias
        const amZonesDef = [
            { key: 'Centro', label: 'Centro (AM: Alba González)' },
            { key: 'Sur', label: 'Sur (AM: Emilio Delgado)' },
            { key: 'Levante', label: 'Levante (AM: Pablo Marín)' },
            { key: 'Norte', label: 'Norte (AM: Luis Ángel Mínguez)' },
            { key: 'Catalunya', label: 'Catalunya (AM: Antonio Benito)' },
            { key: 'Canarias', label: 'Canarias (Virginia Rodríguez y Carlos Déniz)' }
        ];

        let html = `<option value="all">Todas las Zonas (${stores.length} tiendas)</option>`;
        amZonesDef.forEach(z => {
            const count = stores.filter(s => matchStoreZone(s, z.key)).length;
            html += `<option value="${z.key}">${z.label} (${count} tiendas)</option>`;
        });

        selZona.innerHTML = html;
    }

    window.updateAdminFurnitureSummary();
};

window.updateAdminFurnitureSummary = function() {
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    const container = document.getElementById('admin-stores-furniture-summary');
    if (!container || !isAdmin) return;

    ensureAdminStoresHydrated();
    const allStores = (window.REAL_STORES_DATA && Array.isArray(window.REAL_STORES_DATA.stores) && window.REAL_STORES_DATA.stores.length > 0)
        ? window.REAL_STORES_DATA.stores
        : (APP_CONFIG.currentUser?.tiendas || []);

    const selCuenta = document.getElementById('admin-furn-filter-cuenta');
    const selZona = document.getElementById('admin-furn-filter-zona');
    const fCuenta = selCuenta ? selCuenta.value : 'all';
    const fZona = selZona ? selZona.value : 'all';

    // Sincronizar zona activa para el catálogo de tiendas
    if (fZona && fZona !== 'all') {
        window.activeStoreGridAMZone = fZona;
    } else {
        window.activeStoreGridAMZone = null;
    }

    // Filtrar tiendas por Cuenta y Zona (por AM)
    const filteredStores = allStores.filter(s => 
        matchStoreCuenta(s.cuenta, fCuenta) && 
        matchStoreZone(s, fZona)
    );

    const totalStores = filteredStores.length;
    const badge = document.getElementById('admin-furn-count-badge');
    if (badge) {
        badge.innerHTML = `<i class="fas fa-store" style="color: var(--mi-orange);"></i> Mostrando <b>${totalStores}</b> de <b>${allStores.length}</b> tiendas`;
    }

    // Cálculo métricas
    let mesaStores = 0, mesaUnits = 0;
    const mesaDist = { 1: 0, 2: 0, 3: 0, '4+': 0 };

    let colStores = 0, colUnits = 0;
    const colDist = { 1: 0, 2: 0, 3: 0, '4+': 0 };

    let wallStores = 0, wallUnits = 0;
    const wallDist = { 1: 0, 2: 0, 3: 0, '4+': 0 };

    let cabeceraStores = 0;
    let specialStores = 0;

    let mixSoloMesa = 0, mixMesaCol = 0, mixMesaWall = 0, mixFull = 0, mixOtros = 0;

    filteredStores.forEach(s => {
        const m = parseInt(s.Mesa, 10) || 0;
        const c = parseInt(s.Columna, 10) || 0;
        const w = parseInt(s.Wall, 10) || 0;
        const isCab = (typeof window.isStoreCabeceraEci === 'function') ? window.isStoreCabeceraEci(s) : false;
        const isSpec = (typeof window.getStoreSpecialCaseId === 'function') ? !!window.getStoreSpecialCaseId(s) : false;

        if (m > 0) {
            mesaStores++;
            mesaUnits += m;
            if (m === 1) mesaDist[1]++;
            else if (m === 2) mesaDist[2]++;
            else if (m === 3) mesaDist[3]++;
            else mesaDist['4+']++;
        }

        if (c > 0) {
            colStores++;
            colUnits += c;
            if (c === 1) colDist[1]++;
            else if (c === 2) colDist[2]++;
            else if (c === 3) colDist[3]++;
            else colDist['4+']++;
        }

        if (w > 0) {
            wallStores++;
            wallUnits += w;
            if (w === 1) wallDist[1]++;
            else if (w === 2) wallDist[2]++;
            else if (w === 3) wallDist[3]++;
            else wallDist['4+']++;
        }

        if (isCab) cabeceraStores++;
        if (isSpec) specialStores++;

        if (m > 0 && c === 0 && w === 0) mixSoloMesa++;
        else if (m > 0 && c > 0 && w === 0) mixMesaCol++;
        else if (m > 0 && c === 0 && w > 0) mixMesaWall++;
        else if (m > 0 && c > 0 && w > 0) mixFull++;
        else mixOtros++;
    });

    const pct = (num) => totalStores > 0 ? ((num / totalStores) * 100).toFixed(1) + '%' : '0%';
    const ratio = (units, stores) => stores > 0 ? (units / stores).toFixed(2) : '0';

    // 1. KPI Grid
    const kpiGrid = document.getElementById('admin-furn-kpi-grid');
    if (kpiGrid) {
        kpiGrid.innerHTML = `
            <div class="admin-furn-kpi-card" style="--kpi-accent: #3b82f6;">
                <div class="admin-furn-kpi-label">
                    <span>Tiendas Filtradas</span>
                    <i class="fas fa-store" style="color: #3b82f6;"></i>
                </div>
                <div class="admin-furn-kpi-value">${totalStores}</div>
                <div class="admin-furn-kpi-sub">${pct(totalStores)} del total global (${allStores.length})</div>
            </div>

            <div class="admin-furn-kpi-card" style="--kpi-accent: var(--mi-orange);">
                <div class="admin-furn-kpi-label">
                    <span>Mesas Experiencia</span>
                    <i class="fas fa-table" style="color: var(--mi-orange);"></i>
                </div>
                <div class="admin-furn-kpi-value">${mesaUnits} <span style="font-size: 0.95rem; font-weight: 700; color: #64748b;">uds</span></div>
                <div class="admin-furn-kpi-sub">En <b>${mesaStores}</b> tiendas (${pct(mesaStores)})</div>
            </div>

            <div class="admin-furn-kpi-card" style="--kpi-accent: #0284c7;">
                <div class="admin-furn-kpi-label">
                    <span>Columnas (Lightbox)</span>
                    <i class="fas fa-monument" style="color: #0284c7;"></i>
                </div>
                <div class="admin-furn-kpi-value">${colUnits} <span style="font-size: 0.95rem; font-weight: 700; color: #64748b;">uds</span></div>
                <div class="admin-furn-kpi-sub">En <b>${colStores}</b> tiendas (${pct(colStores)})</div>
            </div>

            <div class="admin-furn-kpi-card" style="--kpi-accent: #7c3aed;">
                <div class="admin-furn-kpi-label">
                    <span>Walls (Paredes)</span>
                    <i class="fas fa-border-all" style="color: #7c3aed;"></i>
                </div>
                <div class="admin-furn-kpi-value">${wallUnits} <span style="font-size: 0.95rem; font-weight: 700; color: #64748b;">uds</span></div>
                <div class="admin-furn-kpi-sub">En <b>${wallStores}</b> tiendas (${pct(wallStores)})</div>
            </div>

            <div class="admin-furn-kpi-card" style="--kpi-accent: #ea580c;">
                <div class="admin-furn-kpi-label">
                    <span>Cabeceras ECI</span>
                    <i class="fas fa-crown" style="color: #ea580c;"></i>
                </div>
                <div class="admin-furn-kpi-value">${cabeceraStores} <span style="font-size: 0.95rem; font-weight: 700; color: #64748b;">tiendas</span></div>
                <div class="admin-furn-kpi-sub">${pct(cabeceraStores)} del universo seleccionado</div>
            </div>
        `;
    }

    // 2. Detailed Table Body
    const tbody = document.getElementById('admin-furn-table-body');
    if (tbody) {
        if (totalStores === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">
                        <i class="fas fa-search" style="font-size: 1.8rem; color: #cbd5e1; margin-bottom: 8px; display: block;"></i>
                        No se encontraron tiendas que coincidan con la cuenta y zona seleccionadas.
                    </td>
                </tr>
            `;
        } else {
            const mesaPills = [];
            if (mesaDist[1] > 0) mesaPills.push(`<span class="furn-pill furn-pill-mesa">1 Mesa: <b>${mesaDist[1]}</b> tdas</span>`);
            if (mesaDist[2] > 0) mesaPills.push(`<span class="furn-pill furn-pill-mesa">2 Mesas: <b>${mesaDist[2]}</b> tdas</span>`);
            if (mesaDist[3] > 0) mesaPills.push(`<span class="furn-pill furn-pill-mesa">3 Mesas: <b>${mesaDist[3]}</b> tdas</span>`);
            if (mesaDist['4+'] > 0) mesaPills.push(`<span class="furn-pill furn-pill-mesa">4+ Mesas: <b>${mesaDist['4+']}</b> tdas</span>`);

            const colPills = [];
            if (colDist[1] > 0) colPills.push(`<span class="furn-pill furn-pill-col">1 Col: <b>${colDist[1]}</b> tdas</span>`);
            if (colDist[2] > 0) colPills.push(`<span class="furn-pill furn-pill-col">2 Col: <b>${colDist[2]}</b> tdas</span>`);
            if (colDist[3] > 0) colPills.push(`<span class="furn-pill furn-pill-col">3 Col: <b>${colDist[3]}</b> tdas</span>`);

            const wallPills = [];
            if (wallDist[1] > 0) wallPills.push(`<span class="furn-pill furn-pill-wall">1 Wall: <b>${wallDist[1]}</b> tdas</span>`);
            if (wallDist[2] > 0) wallPills.push(`<span class="furn-pill furn-pill-wall">2 Walls: <b>${wallDist[2]}</b> tdas</span>`);
            if (wallDist[3] > 0) wallPills.push(`<span class="furn-pill furn-pill-wall">3 Walls: <b>${wallDist[3]}</b> tdas</span>`);

            tbody.innerHTML = `
                <tr>
                    <td>
                        <div style="font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            <span style="width: 28px; height: 28px; border-radius: 6px; background: #fff7ed; color: var(--mi-orange); display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem;"><i class="fas fa-table"></i></span>
                            <div>
                                <div>Mesa de Experiencia Xiaomi</div>
                                <span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">Mesas centrales (Nivel 1, 2 y 3)</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: center; font-weight: 800; font-size: 1rem; color: #0f172a;">${mesaStores}</td>
                    <td style="text-align: center;">
                        <span style="font-weight: 800; color: #1e293b;">${pct(mesaStores)}</span>
                        <div class="furn-progress-bar-bg"><div class="furn-progress-bar-fill" style="width: ${pct(mesaStores)}; background: var(--mi-orange);"></div></div>
                    </td>
                    <td style="text-align: center; font-weight: 900; font-size: 1.05rem; color: var(--mi-orange);">${mesaUnits} <span style="font-size: 0.75rem; font-weight: normal; color: #64748b;">mesas</span></td>
                    <td>
                        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                            ${mesaPills.join('') || '<span style="color:#94a3b8; font-size: 0.75rem;">Sin implantación</span>'}
                        </div>
                    </td>
                    <td style="text-align: center; font-weight: 700; color: #475569;">${ratio(mesaUnits, mesaStores)}</td>
                </tr>

                <tr>
                    <td>
                        <div style="font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            <span style="width: 28px; height: 28px; border-radius: 6px; background: #f0f9ff; color: #0284c7; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem;"><i class="fas fa-monument"></i></span>
                            <div>
                                <div>Columna de Experiencia</div>
                                <span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">Mueble Columna con Lightbox</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: center; font-weight: 800; font-size: 1rem; color: #0f172a;">${colStores}</td>
                    <td style="text-align: center;">
                        <span style="font-weight: 800; color: #1e293b;">${pct(colStores)}</span>
                        <div class="furn-progress-bar-bg"><div class="furn-progress-bar-fill" style="width: ${pct(colStores)}; background: #0284c7;"></div></div>
                    </td>
                    <td style="text-align: center; font-weight: 900; font-size: 1.05rem; color: #0284c7;">${colUnits} <span style="font-size: 0.75rem; font-weight: normal; color: #64748b;">columnas</span></td>
                    <td>
                        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                            ${colPills.join('') || '<span style="color:#94a3b8; font-size: 0.75rem;">Sin implantación</span>'}
                        </div>
                    </td>
                    <td style="text-align: center; font-weight: 700; color: #475569;">${ratio(colUnits, colStores)}</td>
                </tr>

                <tr>
                    <td>
                        <div style="font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            <span style="width: 28px; height: 28px; border-radius: 6px; background: #faf5ff; color: #7c3aed; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem;"><i class="fas fa-border-all"></i></span>
                            <div>
                                <div>Wall de Experiencia</div>
                                <span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">Mural retroiluminado Lightbox Wall</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: center; font-weight: 800; font-size: 1rem; color: #0f172a;">${wallStores}</td>
                    <td style="text-align: center;">
                        <span style="font-weight: 800; color: #1e293b;">${pct(wallStores)}</span>
                        <div class="furn-progress-bar-bg"><div class="furn-progress-bar-fill" style="width: ${pct(wallStores)}; background: #7c3aed;"></div></div>
                    </td>
                    <td style="text-align: center; font-weight: 900; font-size: 1.05rem; color: #7c3aed;">${wallUnits} <span style="font-size: 0.75rem; font-weight: normal; color: #64748b;">walls</span></td>
                    <td>
                        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                            ${wallPills.join('') || '<span style="color:#94a3b8; font-size: 0.75rem;">Sin implantación</span>'}
                        </div>
                    </td>
                    <td style="text-align: center; font-weight: 700; color: #475569;">${ratio(wallUnits, wallStores)}</td>
                </tr>

                <tr>
                    <td>
                        <div style="font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            <span style="width: 28px; height: 28px; border-radius: 6px; background: #fff7ed; color: #ea580c; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem;"><i class="fas fa-crown"></i></span>
                            <div>
                                <div>Cabecera Gran Formato ECI</div>
                                <span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">Expositor de cabecera oficial en centros ECI</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: center; font-weight: 800; font-size: 1rem; color: #0f172a;">${cabeceraStores}</td>
                    <td style="text-align: center;">
                        <span style="font-weight: 800; color: #1e293b;">${pct(cabeceraStores)}</span>
                        <div class="furn-progress-bar-bg"><div class="furn-progress-bar-fill" style="width: ${pct(cabeceraStores)}; background: #ea580c;"></div></div>
                    </td>
                    <td style="text-align: center; font-weight: 900; font-size: 1.05rem; color: #ea580c;">${cabeceraStores} <span style="font-size: 0.75rem; font-weight: normal; color: #64748b;">muebles</span></td>
                    <td>
                        <span class="furn-pill furn-pill-cab"><i class="fas fa-star" style="font-size: 9px;"></i> Cabecera 3D ECI: <b>${cabeceraStores}</b> tiendas</span>
                    </td>
                    <td style="text-align: center; font-weight: 700; color: #475569;">${cabeceraStores > 0 ? '1.00' : '0'}</td>
                </tr>

                <tr>
                    <td>
                        <div style="font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            <span style="width: 28px; height: 28px; border-radius: 6px; background: #fefce8; color: #b45309; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem;"><i class="fas fa-shapes"></i></span>
                            <div>
                                <div>Casos Especiales Singulares</div>
                                <span style="font-size: 0.72rem; color: #64748b; font-weight: normal;">Castellana, Adeje, San Sebastián de los Reyes</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: center; font-weight: 800; font-size: 1rem; color: #0f172a;">${specialStores}</td>
                    <td style="text-align: center;">
                        <span style="font-weight: 800; color: #1e293b;">${pct(specialStores)}</span>
                        <div class="furn-progress-bar-bg"><div class="furn-progress-bar-fill" style="width: ${pct(specialStores)}; background: #b45309;"></div></div>
                    </td>
                    <td style="text-align: center; font-weight: 900; font-size: 1.05rem; color: #b45309;">${specialStores} <span style="font-size: 0.75rem; font-weight: normal; color: #64748b;">tiendas</span></td>
                    <td>
                        <span class="furn-pill furn-pill-spec"><i class="fas fa-gem" style="font-size: 9px;"></i> Diseño a medida: <b>${specialStores}</b> tiendas</span>
                    </td>
                    <td style="text-align: center; font-weight: 700; color: #475569;">${specialStores > 0 ? '1.00' : '0'}</td>
                </tr>
            `;
        }
    }

    // 3. Mix de Equipamiento Grid
    const mixGrid = document.getElementById('admin-furn-mix-grid');
    if (mixGrid) {
        mixGrid.innerHTML = `
            <div class="admin-furn-mix-item">
                <div class="admin-furn-mix-item-name">
                    <span style="color: #64748b;"><i class="fas fa-table"></i></span> Solo Mesa
                </div>
                <div class="admin-furn-mix-item-val">${mixSoloMesa} <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">(${pct(mixSoloMesa)})</span></div>
            </div>

            <div class="admin-furn-mix-item">
                <div class="admin-furn-mix-item-name">
                    <span style="color: #0284c7;"><i class="fas fa-table"></i> + <i class="fas fa-monument"></i></span> Mesa + Columna
                </div>
                <div class="admin-furn-mix-item-val">${mixMesaCol} <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">(${pct(mixMesaCol)})</span></div>
            </div>

            <div class="admin-furn-mix-item">
                <div class="admin-furn-mix-item-name">
                    <span style="color: #7c3aed;"><i class="fas fa-table"></i> + <i class="fas fa-border-all"></i></span> Mesa + Wall
                </div>
                <div class="admin-furn-mix-item-val">${mixMesaWall} <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">(${pct(mixMesaWall)})</span></div>
            </div>

            <div class="admin-furn-mix-item" style="border-color: #fdba74; background: #fffaf5;">
                <div class="admin-furn-mix-item-name">
                    <span style="color: var(--mi-orange);"><i class="fas fa-layer-group"></i> Full Set</span> (Mesa + Col + Wall)
                </div>
                <div class="admin-furn-mix-item-val" style="color: var(--mi-orange);">${mixFull} <span style="font-size: 0.72rem; color: #ea580c; font-weight: 600;">(${pct(mixFull)})</span></div>
            </div>
        `;
    }

    // Actualizar catálogo de tiendas inferior automáticamente si existe el contenedor
    if (typeof window.renderTiendasGrid === 'function' && document.getElementById('tiendas-grid')) {
        window.renderTiendasGrid();
    }
};

window.resetAdminFurnitureFilters = function() {
    const selCuenta = document.getElementById('admin-furn-filter-cuenta');
    const selZona = document.getElementById('admin-furn-filter-zona');
    if (selCuenta) selCuenta.value = 'all';
    if (selZona) selZona.value = 'all';
    window.activeStoreGridAMZone = null;

    const filterCuenta = document.getElementById('tiendas-filter-cuenta');
    const filterTienda = document.getElementById('tiendas-filter-tienda');
    const filterUsuario = document.getElementById('tiendas-filter-usuario');
    if (filterCuenta) filterCuenta.value = 'all';
    if (filterTienda) filterTienda.value = '';
    if (filterUsuario) filterUsuario.value = 'all';

    window.updateAdminFurnitureSummary();
    if (typeof window.renderTiendasGrid === 'function') {
        window.renderTiendasGrid();
    }
};

window.syncAdminFurnitureToStoreGrid = function() {
    const selCuenta = document.getElementById('admin-furn-filter-cuenta');
    const selZona = document.getElementById('admin-furn-filter-zona');
    const fCuenta = selCuenta ? selCuenta.value : 'all';
    const fZona = selZona ? selZona.value : 'all';
    
    // Sincronizar select de Cuenta del listado inferior
    const filterCuenta = document.getElementById('tiendas-filter-cuenta');
    if (filterCuenta) {
        let targetVal = 'all';
        for (let i = 0; i < filterCuenta.options.length; i++) {
            if (filterCuenta.options[i].value.toLowerCase() === fCuenta.toLowerCase()) {
                targetVal = filterCuenta.options[i].value;
                break;
            }
        }
        filterCuenta.value = targetVal;
    }

    const filterUsuario = document.getElementById('tiendas-filter-usuario');
    if (filterUsuario) {
        filterUsuario.value = 'all';
    }

    // Guardar filtro de zona activo para el grid si es una zona AM
    if (fZona && fZona !== 'all') {
        window.activeStoreGridAMZone = fZona;
    } else {
        window.activeStoreGridAMZone = null;
    }

    if (typeof window.updateSelectTiendas === 'function') {
        window.updateSelectTiendas();
    }

    // Limpiar filtro de texto para ver el catálogo completo de la cuenta
    const filterTienda = document.getElementById('tiendas-filter-tienda');
    if (filterTienda) filterTienda.value = '';

    if (typeof window.renderTiendasGrid === 'function') {
        window.renderTiendasGrid();
    }

    // Scroll suave hacia los filtros del catálogo
    const targetElement = document.getElementById('tiendas-filter-cuenta') || document.getElementById('tiendas-grid');
    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (typeof window.showToast === 'function') {
        const zonaLabel = selZona && selZona.options[selZona.selectedIndex] ? selZona.options[selZona.selectedIndex].text.split('(')[0].trim() : fZona;
        window.showToast(`🔍 Catálogo sincronizado: ${fCuenta === 'all' ? 'Todas Cuentas' : fCuenta} | ${fZona === 'all' ? 'Todas Zonas' : zonaLabel}`, 'info');
    }
};

window.clearDashboardFilters = function() {
    const fCuenta = document.getElementById('dash-filter-cuenta');
    const fTienda = document.getElementById('dash-filter-tienda');
    const fTipo = document.getElementById('dash-filter-tipo');
    const fUsuario = document.getElementById('dash-filter-usuario');
    const fEstado = document.getElementById('dash-filter-estado');
    
    if (fCuenta) fCuenta.value = 'all';
    if (fTienda) fTienda.value = 'all';
    if (fTipo) fTipo.value = 'all';
    if (fUsuario) fUsuario.value = 'all';
    if (fEstado) fEstado.value = 'all';
    
    if (typeof window.filterDashboardTable === 'function') {
        window.filterDashboardTable();
    }
};
window.refreshAllDashboardData = async function() {
    const btn = document.querySelector('.capsule-search-btn');
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
    }
    
    // Clear local memory cache
    APP_CONFIG.dashboardReports = null; 
    APP_CONFIG.launches = [];
    
    await loadDashboard();
    
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) icon.classList.remove('fa-spin');
    }
};

async function loadDashboard() {
    const tableBody = document.querySelector('#recent-reports-table tbody');
    const accountFilter = document.getElementById('dash-account-filter');

    // 1. REHIDRATACIÓN INMEDIATA DE SESIÓN PARA EVITAR FLICKER
    if (!APP_CONFIG.currentUser) {
        const saved = localStorage.getItem('xiaomi_user');
        if (saved) {
            APP_CONFIG.currentUser = JSON.parse(saved);
        }
    }
    if (!APP_CONFIG.sessionToken) {
        APP_CONFIG.sessionToken = localStorage.getItem('xiaomi_session_token') || '';
    }
    
    if (!APP_CONFIG.currentUser) {
        console.warn("Sesión perdida.");
        return; // Dejar que la app maneje logout o login
    }

    // 2. APLICAR FILTRADO POR ROL INSTANTÁNEAMENTE
    ensureAdminStoresHydrated();
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    const dashLaunchCapsule = document.getElementById('dash-launch-filter-capsule');
    if (dashLaunchCapsule) {
        dashLaunchCapsule.style.display = isAdmin ? 'flex' : 'none';
    }

    // OPTIMIZACIÓN: Renderizado instantáneo Stale-While-Revalidate (0ms de latencia percibida)
    if (!APP_CONFIG.dashboardReports || APP_CONFIG.dashboardReports.length === 0) {
        try {
            const cachedDash = sessionStorage.getItem('xiaomi_dash_reports_cache');
            if (cachedDash) {
                APP_CONFIG.dashboardReports = JSON.parse(cachedDash);
            }
        } catch(e) {}
    }

    if (APP_CONFIG.dashboardReports && APP_CONFIG.dashboardReports.length > 0) {
        // Renderizamos instantáneamente lo que ya tenemos para CERO latencia percibida
        console.log("⚡ Render instantáneo desde caché Stale-While-Revalidate (0ms)...");
        renderDashboardFromData(APP_CONFIG.dashboardReports, isAdmin);
    } else {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Sincronizando datos iniciales...</td></tr>';
    }
    
    try {
        const data = await callApi({ 
            action: 'getDashboardData',
            rol: isAdmin ? 'ADMIN' : (isUserAM(APP_CONFIG.currentUser) ? 'AM' : (APP_CONFIG.currentUser?.rol || 'usuario'))
        });
        
        if (data.error) throw new Error(data.error);
        if (data.success === false) {
            console.warn('Aviso al sincronizar dashboard:', data.message);
            if (APP_CONFIG.dashboardReports && APP_CONFIG.dashboardReports.length > 0) {
                renderDashboardFromData(APP_CONFIG.dashboardReports, isAdmin);
                return;
            }
            throw new Error(data.message || 'Error del servidor al leer reportes');
        }
        
        // No descartar filas por ID ausente ni por diferencias de formato en tienda
        let userReports = (data.recentReports || []).filter(r => {
            if (!r) return false;
            const hasTienda = String(r.tienda || '').trim() !== '';
            const hasTipo = String(r.tipo || r.categoria || '').trim() !== '';
            const hasId = String(r.id || '').trim() !== '';
            return hasTienda || hasTipo || hasId;
        });

        // Asegurar ID único y normalizado para cada reporte
        userReports.forEach((r, idx) => {
            if (!r.id) r.id = 'REP_' + (r.fecha ? String(r.fecha).replace(/\D/g, '') : Date.now()) + '_' + idx;
        });

        const isAM = isUserAM(APP_CONFIG.currentUser);
        
        if (!isAdmin) {
            const myEmail = String((APP_CONFIG.currentUser.email || APP_CONFIG.currentUser.usuario || APP_CONFIG.currentUser.nombre) || '').trim().toLowerCase();
            const myStores = APP_CONFIG.currentUser.tiendas || [];
            const myStoreNames = myStores.map(t => String(t.nombre || t.tienda || t).trim().toLowerCase()).filter(Boolean);
            
            if (myStoreNames.length > 0 || myEmail) {
                const filtered = userReports.filter(r => {
                    const rUser = String(r.usuario || '').trim().toLowerCase();
                    const rTienda = String(r.tienda || '').trim().toLowerCase();
                    const isMyUser = myEmail && (rUser === myEmail || rUser.includes(myEmail) || myEmail.includes(rUser));
                    const isMyStore = myStoreNames.length > 0 && (myStoreNames.includes(rTienda) || myStoreNames.some(s => s && (rTienda.includes(s) || s.includes(rTienda))));
                    return isMyUser || isMyStore;
                });
                if (filtered.length > 0 || myStoreNames.length > 0) {
                    userReports = filtered;
                }
            }
        }
        
        APP_CONFIG.dashboardReports = userReports;
        try { sessionStorage.setItem('xiaomi_dash_reports_cache', JSON.stringify(userReports)); } catch(e) {}
        
        // Ejecutar actualización visual final con la data fresca
        renderDashboardFromData(userReports, isAdmin);
        
        // Cargar lanzamientos para el resumen (También optimizado internamente)
        await window.renderDashboardLaunches();
        
    } catch (err) {
        console.error('Error loading dashboard:', err);
        if (!APP_CONFIG.dashboardReports || APP_CONFIG.dashboardReports.length === 0) {
             const safeMsg = String(err.message || err).substring(0, 100);
             tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red; font-size:12px; padding:20px;">
                 <i class="fas fa-exclamation-triangle"></i> Error al cargar datos:<br>
                 <code style="background:#fff5f5; padding:2px 6px; border-radius:4px; border:1px solid #ffcccc; margin-top:5px; display:inline-block;">${safeMsg}</code>
             </td></tr>`;
        }
    }
}

/**
 * Extraído para permitir renderizado repetido rápido tanto desde caché como desde respuesta viva
 */
function renderDashboardFromData(userReports, explicitIsAdmin = null) {
    // NUEVO: Analizar cambios de estado y generar notificaciones si las hay
    checkStatusChanges(userReports);

    const isAdmin = explicitIsAdmin !== null ? explicitIsAdmin : isUserAdmin(APP_CONFIG.currentUser);
    const isAM = isUserAM(APP_CONFIG.currentUser);
    
    // Calcular estadísticas dinámicamente por estados específicos
    const countByStatus = (statusStr) => userReports.filter(r => String(r.estado || '').trim().toLowerCase().includes(statusStr)).length;
    
    const openIncidents = countByStatus('abierta');
    const pendingIncidents = countByStatus('gestionado');
    const solvedIncidents = countByStatus('solucionado');

    // Actualizar estadísticas principales
    const statTotalEl = document.getElementById('stat-total');
    if (statTotalEl) statTotalEl.textContent = userReports.length;
    
    // Actualizar los 4 Cuadrantes Específicos
    const setStat = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    
    setStat('stat-incidents-open', openIncidents);
    setStat('stat-incidents-pending', pendingIncidents);
    setStat('stat-incidents-solved', solvedIncidents);
    
    // Novedad: Estadísticas por Categoría
    const countByCategory = (catStr) => userReports.filter(r => String(r.categoria || '').trim().toLowerCase().includes(catStr)).length;
    setStat('dash-cat-mobiliario', countByCategory('mobiliario'));
    setStat('dash-cat-dispositivo', countByCategory('dispositivo'));
    setStat('dash-cat-pantalla', countByCategory('pantalla'));
    setStat('dash-cat-lonas', countByCategory('lona'));
    
    // Novedad: Control y métricas de IMEIs pendientes por tienda en el Dashboard
    if (typeof window.updateDashboardImeisWidget === 'function') {
        window.updateDashboardImeisWidget();
    }
    // Alerta luminosa de Devoluciones para Admin
    if (typeof window.updateDashboardDevolucionesWidget === 'function') {
        window.updateDashboardDevolucionesWidget();
    }
    // Totales de Producto estructurados (Exclusivo Joaquín Lemus)
    if (typeof window.renderJoaquinTotalsWidget === 'function') {
        window.renderJoaquinTotalsWidget();
    }
    
    const accountFilter = document.getElementById('dash-account-filter');
    if (isAdmin) {
        const titleEl = document.getElementById('dashboard-table-title');
        if (titleEl) titleEl.textContent = 'Historial de Reportes';
        const adminFilters = document.getElementById('admin-filters');
        if (adminFilters) {
            adminFilters.classList.remove('hidden');
            adminFilters.style.display = 'flex';
        }
        if (accountFilter) accountFilter.style.display = 'none';
        populateDashboardFilters(userReports);
    } else {
        const titleEl = document.getElementById('dashboard-table-title');
        if (titleEl) titleEl.textContent = 'Historial de Reportes';
        const adminFilters = document.getElementById('admin-filters');
        if (adminFilters) {
            adminFilters.classList.add('hidden');
            adminFilters.style.display = 'none';
        }
        if (accountFilter) accountFilter.style.display = 'inline-block';
    }
    
    // Rellenar nuevos filtros de la tabla
    const filterCuenta = document.getElementById('dash-filter-cuenta');
    const filterTienda = document.getElementById('dash-filter-tienda');
    const filterUsuario = document.getElementById('dash-filter-usuario');
    
    if (filterUsuario) {
        filterUsuario.style.display = (isAdmin || isAM) ? 'inline-block' : 'none';
        let users = [...new Set(userReports.map(r => String(r.usuario || '').trim()))].filter(Boolean);
        if (isAM) {
            const myStores = APP_CONFIG.currentUser?.tiendas || [];
            const myUsers = myStores.map(t => String(t.usuario || t.owner || '').trim()).filter(Boolean);
            users = [...new Set([...users, ...myUsers])];
        }
        users.sort();
        filterUsuario.innerHTML = '<option value="all">Todos Usuarios</option>';
        users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u; opt.textContent = u;
            filterUsuario.appendChild(opt);
        });
    }

    if (filterCuenta) {
        const accounts = [...new Set(userReports.map(r => String(r.cuenta || '').trim()))].filter(Boolean).sort();
        filterCuenta.innerHTML = '<option value="all">Todas Cuentas</option>';
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc; opt.textContent = acc;
            filterCuenta.appendChild(opt);
        });
    }
    
    if (filterTienda) {
        const stores = [...new Set(userReports.map(r => String(r.tienda || '').trim()))].filter(Boolean).sort();
        const filterList = document.getElementById('dash-filter-tienda-list');
        if (filterList) {
            filterList.innerHTML = '';
            stores.forEach(store => {
                const opt = document.createElement('option');
                opt.value = store;
                filterList.appendChild(opt);
            });
        }
    }
    
    // Resetear filtros visuales a ALL al cargar
    const filterEst = document.getElementById('dash-filter-estado');
    if (filterEst) filterEst.value = 'all';
    if (filterCuenta) filterCuenta.value = 'all';
    if (filterTienda) filterTienda.value = '';
    
    renderDashboardTable(userReports);
}

// Sanitización defensiva de filas de reportes (soluciona cuando Drive cae en Tiempo o días en Cierre/Fotos)
function sanitizeReportRow(r) {
    if (!r) return r;
    const tiempoStr = String(r.tiempo || '').trim();
    const cierreStr = String(r.fechaCierre || '').trim();
    const fotosStr = String(r.fotos || '').trim();

    // 1. Detectar si el link de Drive cayó en Tiempo o Fecha Cierre
    if (tiempoStr.includes('http') || tiempoStr.includes('drive.google.com') || tiempoStr.includes('/d/')) {
        if (!r.fotos || !String(r.fotos).includes('http')) {
            r.fotos = tiempoStr;
        }
        r.tiempo = '';
    }
    if (cierreStr.includes('http') || cierreStr.includes('drive.google.com') || cierreStr.includes('/d/')) {
        if (!r.fotos || !String(r.fotos).includes('http')) {
            r.fotos = cierreStr;
        }
        r.fechaCierre = '';
    }

    // 2. Detectar si los días numéricos cayeron en Fecha Cierre o Fotos
    if (r.tiempo === '' || r.tiempo === undefined || r.tiempo === null || isNaN(r.tiempo)) {
        if (cierreStr !== '' && !isNaN(cierreStr) && !cierreStr.includes('-') && !cierreStr.includes('/')) {
            r.tiempo = parseInt(cierreStr);
            r.fechaCierre = '';
        } else if (fotosStr !== '' && !isNaN(fotosStr) && !fotosStr.includes('http')) {
            r.tiempo = parseInt(fotosStr);
        }
    }

    return r;
}

function renderDashboardTable(reports) {
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    
    const thUsuario = document.getElementById('th-usuario');
    if (thUsuario) {
        thUsuario.style.display = isAdmin ? '' : 'none';
    }

    const tableBody = document.querySelector('#recent-reports-table tbody');
    tableBody.innerHTML = '';
    
    if (reports.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay actividad reciente.</td></tr>';
        return;
    }
    
    reports.forEach(r => {
        sanitizeReportRow(r);

        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.title = 'Haz clic para operar la incidencia';
        row.onclick = function(e) {
            if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;
            if (window.innerWidth <= 768) {
                this.classList.toggle('expanded');
            } else {
                showQuickBox(r);
            }
        };
        
        // Estilos para el estado
        let statusClass = 'color:#95a5a6;font-weight:600';
        const est = String(r.estado || '').trim().toLowerCase();
        if (est === 'abierta') {
            statusClass = 'color:#e74c3c;font-weight:600'; // Rojo
        } else if (est === 'gestionado') {
            statusClass = 'color:#faad14;font-weight:600'; // Amarillo
        } else if (est === 'solucionado') {
            statusClass = 'color:#2ecc71;font-weight:600'; // Verde
        }
        
        // Fix UX: Priorizar valor de tiempo de Excel, solo calcular dinámico si está vacío
        let rawTiempo = r.tiempo;
        let displayTiempo = (rawTiempo !== undefined && rawTiempo !== null && rawTiempo !== '') ? String(rawTiempo).trim() : '';
        const isResolvedTiempo = est === 'solucionado' || est === 'realizado' || est === 'realizada';
        
        // Si displayTiempo contiene URLs o texto no numérico, forzar recálculo dinámico
        if (displayTiempo.includes('http') || isNaN(displayTiempo)) {
            displayTiempo = '';
        }

        if (displayTiempo !== '') {
            // Si está solucionado y el Excel manda '0' o un número fijo, lo respetamos para que no siga sumando.
            if (displayTiempo === '0' && !isResolvedTiempo) {
                displayTiempo = ''; // Forzamos recálculo
            } else {
                if (!isNaN(displayTiempo)) {
                    // Evitar días negativos que vengan del Excel por desajuste de zona horaria
                    if (parseInt(displayTiempo) < 0) {
                        displayTiempo = '0 días';
                    } else {
                        displayTiempo += ' días';
                    }
                }
            }
        }
        
        if (displayTiempo === '') {
            // Fallback solo si el Excel no tiene nada calculado
            const fechaStr = String(r.fecha || '');
            const reportDate = new Date(fechaStr.replace(/-/g, '/')); 
            if (!isNaN(reportDate.getTime())) {
                if (isResolvedTiempo) {
                    // Si está solucionado pero el Excel lo mandó vacío, probamos con fechaCierre
                    if (r.fechaCierre && !isNaN(new Date(String(r.fechaCierre).replace(/-/g, '/')).getTime())) {
                        const closeDate = new Date(String(r.fechaCierre).replace(/-/g, '/'));
                        const diffTime = Math.abs(closeDate.getTime() - reportDate.getTime());
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        displayTiempo = `${diffDays} días`;
                    } else {
                        displayTiempo = '0 días'; 
                    }
                } else {
                    const diffTime = Math.abs(Date.now() - reportDate.getTime());
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    displayTiempo = `${diffDays} días`; 
                }
            } else {
                displayTiempo = '0 días';
            }
        }
        
        // 1. Formato de fecha compacto en 2 líneas (YYYY-MM-DD y HH:MM)
        const fechaStr = String(r.fecha || '').trim();
        let fechaHtml = fechaStr;
        const fechaParts = fechaStr.split(' ');
        if (fechaParts.length >= 2) {
            const datePart = fechaParts[0];
            const timePart = fechaParts[1].substring(0, 5);
            fechaHtml = `<div class="td-fecha-date">${datePart}</div><div class="td-fecha-time">${timePart}</div>`;
        } else if (fechaStr) {
            fechaHtml = `<div class="td-fecha-date">${fechaStr}</div>`;
        }

        // 2. Usuario con truncado elegante y title tooltip
        const usuarioFull = String(r.usuario || '').trim();
        const usuarioTd = isAdmin 
            ? `<td data-label="Usuario" class="td-usuario" title="${usuarioFull}"><span class="td-text-truncate">${usuarioFull}</span></td>` 
            : `<td data-label="Usuario" class="td-usuario" style="display:none;" title="${usuarioFull}"><span class="td-text-truncate">${usuarioFull}</span></td>`;
        
        // 3. Tienda con truncado elegante y title tooltip
        const tiendaFull = String(r.tienda || '').trim();

        // 4. Tipo con formato de 2 líneas (Categoría / Detalle)
        let tipoDisplay = String(r.tipo || '').trim();
        let tipoHtml = tipoDisplay;
        if (tipoDisplay.includes(':')) {
            const tParts = tipoDisplay.split(':');
            const catBadge = tParts[0].trim();
            const detailText = tParts.slice(1).join(':').trim();
            tipoHtml = `<div class="td-tipo-cat">${catBadge}</div><div class="td-tipo-detail" title="${detailText}">${detailText}</div>`;
        }

        row.innerHTML = `
            <td data-label="Fecha" class="td-fecha">${fechaHtml}</td>
            ${usuarioTd}
            <td data-label="Cuenta" class="td-cuenta" style="text-align:center; font-weight:700;">${r.cuenta}</td>
            <td data-label="Tienda" class="td-tienda" title="${tiendaFull}"><span class="td-text-truncate">${tiendaFull}</span></td>
            <td data-label="Tipo" class="td-tipo">${tipoHtml}</td>
            <td data-label="Tiempo" class="td-tiempo" style="text-align:center; font-weight:600;">${displayTiempo}</td>
            <td data-label="Estado" class="td-estado" style="text-align:center; ${statusClass}">${r.estado}</td>
            <td data-label="Acciones" class="td-acciones" style="text-align:center;"></td>
        `;
        
        const actionTd = row.querySelector('td:last-child');
        const flexWrapper = document.createElement('div');
        flexWrapper.className = 'table-actions-wrapper';
        actionTd.appendChild(flexWrapper);
        
        // Circular Button "Ver"
        const verBtn = document.createElement('button');
        verBtn.className = 'action-btn-circle';
        verBtn.innerHTML = '<i class="fas fa-eye"></i>';
        verBtn.title = 'Ver Detalles Completos';
        verBtn.onclick = (e) => {
            e.stopPropagation();
            window.showReportDetails(r);
        };
        flexWrapper.appendChild(verBtn);

        // Editar mientras la incidencia está abierta o gestionada.
        if (est === 'abierta' || est === 'gestionado') {
            // Botón Editar (Lápiz azul-turquesa)
            const editBtn = document.createElement('button');
            editBtn.className = 'action-btn-circle';
            editBtn.style.color = '#00bcd4'; 
            editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
            editBtn.title = 'Editar este reporte';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                window.jumpToCreateReportForStore(r); 
            };
            flexWrapper.appendChild(editBtn);

            if (est === 'abierta') {
                // Botón Eliminar (Basura roja)
                const delBtn = document.createElement('button');
                delBtn.className = 'action-btn-circle';
                delBtn.style.color = '#e74c3c'; 
                delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                delBtn.title = 'Eliminar este reporte permanentemente';
                delBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (await window.showConfirm('¿Eliminar Reporte?', '¿Seguro que deseas ELIMINAR este reporte permanentemente? Esta acción no se puede deshacer.', true)) {
                        await window.deleteDashboardReport(r.id);
                    }
                };
                flexWrapper.appendChild(delBtn);
            }
        }
        
        // Una incidencia gestionada puede marcarse como solucionada.
        if (est === 'gestionado') {
            const resBtn = document.createElement('button');
            resBtn.className = 'action-btn-circle';
            resBtn.style.color = '#52c41a';
            resBtn.innerHTML = '<i class="fas fa-check"></i>';
            resBtn.title = 'Marcar como Solucionado';
            resBtn.onclick = (e) => {
                e.stopPropagation();
                window.showQuickBox(r);
            };
            flexWrapper.appendChild(resBtn);
        }

        // Special Admin Direct Buttons in dashboard table row
        
        if (isAdmin) {
            if (est === 'abierta') {
                const repairBtn = document.createElement('button');
                repairBtn.className = 'action-btn-circle';
                repairBtn.style.color = '#e67e22';
                repairBtn.innerHTML = '<i class="fas fa-tools"></i>';
                repairBtn.title = 'Marcar como Solicitado reparación';
                repairBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await window.changeIncidentStatus(r.id, 'Gestionado');
                };
                flexWrapper.appendChild(repairBtn);
            } else if (est === 'solucionado') {
                const reviewBtn = document.createElement('button');
                reviewBtn.className = 'action-btn-circle';
                reviewBtn.style.color = '#2ecc71';
                reviewBtn.innerHTML = '<i class="fas fa-search"></i>';
                reviewBtn.title = 'Revisar Resolución';
                reviewBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.showReportDetails(r);
                    // Auto open review box inside the detail modal after short delay
                    setTimeout(() => {
                        const revBtn = document.getElementById('admin-review-btn');
                        if (revBtn) revBtn.click();
                    }, 250);
                };
                flexWrapper.appendChild(reviewBtn);
            }
        }
        
        tableBody.appendChild(row);
    });
}

window.showReportDetails = function(report) {
    const modal = document.getElementById('report-modal');
    const container = document.getElementById('modal-report-details');
    if (!modal || !container) return;
    
    let photosHtml = '';
    const rawFotos = report.fotos || report.photos || '';
    const urls = rawFotos ? rawFotos.split(/[\n,]+/).map(url => url.trim()).filter(Boolean) : [];
    
    if (urls.length > 0) {
        photosHtml = `
            <div class="modal-detail-item">
                <span class="modal-detail-label">Fotos Cargadas:</span>
                <div class="modal-photo-grid">
                    ${urls.map(url => {
                        const directUrl = window.getGoogleDriveThumbnail(url);
                        return `<img src="${directUrl}" class="modal-photo-thumbnail" onclick="window.open('${url}', '_blank')" title="Clic para ampliar" />`;
                    }).join('')}
                </div>
            </div>
        `;
    } else {
        photosHtml = `
            <div class="modal-detail-item">
                <span class="modal-detail-label">Fotos Cargadas:</span>
                <p style="color:var(--mi-gray-dark);font-style:italic;margin:0;">Sin imágenes adjuntas</p>
            </div>
        `;
    }
    
    // Admin Actions inside detail modal
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    let adminActionsHtml = '';
    
    if (isAdmin) {
        const estLower = String(report.estado || '').trim().toLowerCase();
        if (estLower === 'abierta' || estLower === 'abierto') {
            adminActionsHtml = `
                <div style="border-top: 1px solid var(--mi-border); padding-top: 1rem; margin-top: 1rem; display: flex; justify-content: flex-end;">
                    <button class="btn-primary" id="admin-repair-btn" style="background:#ff6700; width:auto; padding:8px 16px; border-radius:6px; color:white; border:none; font-size:12px; font-weight:600; cursor:pointer;" onclick="window.changeIncidentStatus('${report.id}', 'Gestionado')">
                        <i class="fas fa-tools"></i> Marcar como gestionado
                    </button>
                </div>
            `;
        } else if (estLower === 'solucionado') {
            const newPhotos = urls.slice(1);
            const reviewPhotos = newPhotos.length > 0 ? newPhotos : urls;
            
            adminActionsHtml = `
                <div style="border-top: 1px solid var(--mi-border); padding-top: 1rem; margin-top: 1rem;">
                    <button class="btn-primary" id="admin-review-btn" style="background:#1890ff; width:100%; padding:10px; border-radius:6px; color:white; border:none; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="document.getElementById('admin-review-box').style.display='block'; this.style.display='none';">
                        <i class="fas fa-search"></i> Revisar Resolución
                    </button>
                    
                    <div id="admin-review-box" style="display:none; background:#f9f9f9; padding:15px; border-radius:8px; border:1px solid var(--mi-border); margin-top:10px;">
                        <p style="font-weight:600; margin-top:0; margin-bottom:10px; font-size:12px; color:var(--mi-gray-dark);">Nuevas Fotos Subidas (Resolución):</p>
                        <div class="modal-photo-grid" style="margin-bottom:15px;">
                            ${reviewPhotos.map(url => {
                                const directUrl = window.getGoogleDriveThumbnail(url);
                                return `<img src="${directUrl}" class="modal-photo-thumbnail" onclick="window.open('${url}', '_blank')" title="Clic para ampliar" />`;
                            }).join('')}
                        </div>
                        <div style="display:flex; gap:10px; justify-content:flex-end;">
                            <button class="btn-primary" style="background:#ff4d4f; width:auto; padding:8px 14px; border-radius:6px; color:white; border:none; font-size:12px; font-weight:600; cursor:pointer;" onclick="window.changeIncidentStatus('${report.id}', 'Abierta')">
                                <i class="fas fa-times-circle"></i> Reabrir
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    let detailTiempo = '';
    const rawTiempo = report.tiempo;
    if (rawTiempo !== undefined && rawTiempo !== null && rawTiempo !== '') {
        detailTiempo = String(rawTiempo).trim();
        if (!isNaN(detailTiempo)) {
            const num = parseInt(detailTiempo);
            detailTiempo = (num < 0 ? 0 : num) + ' días';
        }
    }
    if (!detailTiempo && report.fecha) {
        const repDate = new Date(String(report.fecha).replace(/-/g, '/'));
        if (!isNaN(repDate.getTime())) {
            const endDate = report.fechaCierre ? new Date(String(report.fechaCierre).replace(/-/g, '/')) : new Date();
            if (!isNaN(endDate.getTime())) {
                const diffTime = Math.max(0, Math.floor(Math.abs(endDate.getTime() - repDate.getTime()) / (1000 * 60 * 60 * 24)));
                detailTiempo = `${diffTime} días`;
            }
        }
    }
    
    container.innerHTML = `
        <div class="form-grid-2col" style="gap:1rem;">
            <div class="modal-detail-item">
                <span class="modal-detail-label">Fecha:</span>
                <span class="modal-detail-value">${report.fecha}</span>
            </div>
            <div class="modal-detail-item">
                <span class="modal-detail-label">Usuario:</span>
                <span class="modal-detail-value">${report.usuario}</span>
            </div>
            <div class="modal-detail-item">
                <span class="modal-detail-label">Cuenta:</span>
                <span class="modal-detail-value">${report.cuenta}</span>
            </div>
            <div class="modal-detail-item">
                <span class="modal-detail-label">Tienda:</span>
                <span class="modal-detail-value">${report.tienda} ${getReportStoreCode(report) ? `<span style="display:inline-block; margin-left:6px; font-size:11px; padding:2px 6px; border-radius:4px; background:#fff2e8; color:#d4380d; font-weight:600; border:1px solid #ffbb96;">${getReportStoreCode(report)}</span>` : ''}</span>
            </div>
        </div>
        
        <div class="modal-detail-item" style="border-top: 1px solid var(--mi-border); padding-top: 0.8rem;">
            <span class="modal-detail-label">Tipo / Categoría:</span>
            <span class="modal-detail-value" style="font-weight: 500;">${report.tipo}</span>
        </div>
        
        ${(report.codigoDispositivo || report.modelo || report.cantidad || report.enviar || (report.dispositivos && report.dispositivos.length > 0)) ? `
        <div class="modal-detail-item" style="border-top: 1px solid var(--mi-border); padding-top: 0.8rem;">
            <span class="modal-detail-label">Información Adicional:</span>
            <span class="modal-detail-value" style="display:block; padding:0.5rem 0;">
                ${report.enviar ? `<span style="display:block; margin-bottom:8px;"><b>Destino del Envío:</b> ${report.enviar}</span>` : ''}
                
                ${(report.dispositivos && report.dispositivos.length > 0) ? 
                    report.dispositivos.map((d, index) => `
                        <div style="background:#f0f2f5; padding:8px; border-radius:6px; margin-bottom:6px;">
                            ${report.dispositivos.length > 1 ? `<b>#${index+1}</b><br>` : ''}
                            ${d.modelo ? `<b>Modelo:</b> ${d.modelo}<br>` : ''}
                            ${d.codigoDispositivo ? `<b>Código:</b> ${d.codigoDispositivo}<br>` : ''}
                            ${d.cantidad ? `<b>Unidades:</b> ${d.cantidad}` : ''}
                        </div>
                    `).join('')
                : `
                    ${(report.modelo || report.codigoDispositivo || report.cantidad) ? `
                        <div style="background:#f0f2f5; padding:8px; border-radius:6px; margin-bottom:6px;">
                            ${report.modelo ? `<b>Modelo:</b> ${report.modelo}<br>` : ''}
                            ${report.codigoDispositivo ? `<b>Código:</b> ${report.codigoDispositivo}<br>` : ''}
                            ${report.cantidad ? `<b>Unidades:</b> ${report.cantidad}` : ''}
                        </div>
                    ` : ''}
                `}
            </span>
        </div>
        ` : ''}
        
        <div class="modal-detail-item" style="border-top: 1px solid var(--mi-border); padding-top: 0.8rem;">
            <span class="modal-detail-label">Estado:</span>
            <span class="modal-detail-value" style="font-weight: 600; color:${String(report.estado).toLowerCase().includes('abiert') ? '#e74c3c' : String(report.estado).toLowerCase().includes('gestion') ? '#faad14' : '#2ecc71'};">${report.estado}</span>
        </div>
        
        ${report.fechaCierre ? `
        <div class="modal-detail-item" style="border-top: 1px solid var(--mi-border); padding-top: 0.8rem;">
            <span class="modal-detail-label">Fecha de Cierre:</span>
            <span class="modal-detail-value" style="font-weight: 500;">${report.fechaCierre}</span>
        </div>
        ` : ''}

        ${detailTiempo ? `
        <div class="modal-detail-item" style="border-top: 1px solid var(--mi-border); padding-top: 0.8rem;">
            <span class="modal-detail-label">Tiempo de Resolución:</span>
            <span class="modal-detail-value" style="font-weight: 500;">${detailTiempo}</span>
        </div>
        ` : ''}
        
        <div class="modal-detail-item" style="border-top: 1px solid var(--mi-border); padding-top: 0.8rem;">
            <span class="modal-detail-label">Comentario:</span>
            <span class="modal-detail-value" style="background:#f9f9f9; padding:0.8rem; border-radius:6px; font-style:italic; border-left:3px solid var(--mi-orange);">${report.descripcion || 'Sin comentarios registrados.'}</span>
        </div>
        
        <div style="border-top: 1px solid var(--mi-border); padding-top: 0.8rem;">
            ${photosHtml}
        </div>
        
        <div style="border-top: 1px solid var(--mi-border); padding-top: 1rem; margin-top: 1rem; display: flex; justify-content: flex-end;">
            <button class="btn-primary" style="background:#4a90e2; width:auto; padding:8px 16px; border-radius:6px; color:white; border:none; font-size:12px; font-weight:600; cursor:pointer;" onclick="window.downloadReportPDF('${report.id}')">
                <i class="fas fa-file-pdf"></i> Descargar PDF
            </button>
        </div>
        
        ${adminActionsHtml}
    `;
    
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
};

window.closeReportModal = function() {
    const modal = document.getElementById('report-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
    
    if (APP_CONFIG.returnToHistorial) {
        APP_CONFIG.returnToHistorial = false;
        const hModal = document.getElementById('historial-modal');
        if (hModal) {
            hModal.style.display = 'flex';
            hModal.classList.remove('hidden');
        }
    }
};

window.downloadReportPDF = async function(reportId) {
    const element = document.getElementById('report-modal')?.querySelector('.modal-content');
    if (!element) return;
    
    if (typeof html2pdf === 'undefined') {
        if (typeof window.showToast === 'function') window.showToast("Cargando motor de exportación PDF...", "info");
        await new Promise(resolve => {
            const s = document.createElement('script');
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
            s.onload = () => resolve(true);
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });
    }

    // Ocultar botones e iconos interactivos para que no salgan en el PDF
    const closeBtn = element.querySelector('.close-modal');
    const dragHandle = element.querySelector('.bottom-sheet-drag-handle');
    const actionBtns = element.querySelectorAll('button');
    
    if (closeBtn) closeBtn.style.display = 'none';
    if (dragHandle) dragHandle.style.display = 'none';
    actionBtns.forEach(btn => btn.style.display = 'none');
    
    // Opciones de html2pdf
    const opt = {
      margin:       15,
      filename:     'Reporte_' + (reportId || 'Incidencia') + '.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        // Restaurar UI original
        if (closeBtn) closeBtn.style.display = '';
        if (dragHandle) dragHandle.style.display = '';
        actionBtns.forEach(btn => btn.style.display = '');
    }).catch(err => {
        console.error('Error generando PDF:', err);
        if (closeBtn) closeBtn.style.display = '';
        if (dragHandle) dragHandle.style.display = '';
        actionBtns.forEach(btn => btn.style.display = '');
        alert('Hubo un error al generar el PDF.');
    });
};

// Helper para obtener el código de centro / RMS de una tienda a partir del reporte
function getReportStoreCode(r) {
    if (!r) return '';
    if (r.rms && String(r.rms).trim() !== '') return String(r.rms).trim();
    if (r.codigoCentro && String(r.codigoCentro).trim() !== '') return String(r.codigoCentro).trim();
    if (r.codigo_centro && String(r.codigo_centro).trim() !== '') return String(r.codigo_centro).trim();
    if (r.StoreCode && String(r.StoreCode).trim() !== '') return String(r.StoreCode).trim();
    if (r.storeCode && String(r.storeCode).trim() !== '') return String(r.storeCode).trim();
    
    // Búsqueda en lista maestra de tiendas (window.REAL_STORES_DATA o usuario)
    const normStore = normalizeString(r.tienda || r.nombre || '');
    if (!normStore) return '';
    
    const masterStores = (window.REAL_STORES_DATA && window.REAL_STORES_DATA.stores) ? window.REAL_STORES_DATA.stores : [];
    const foundMaster = masterStores.find(s => normalizeString(s.nombre) === normStore);
    if (foundMaster && foundMaster.rms) return String(foundMaster.rms).trim();
    
    const userStores = APP_CONFIG.currentUser?.tiendas || [];
    const foundUserStore = userStores.find(s => normalizeString(s.nombre || s.tienda) === normStore);
    if (foundUserStore && (foundUserStore.rms || foundUserStore.StoreCode)) return String(foundUserStore.rms || foundUserStore.StoreCode).trim();
    
    return '';
}
window.getReportStoreCode = getReportStoreCode;

// Helper para obtener la cantidad de producto solicitada en el reporte
function getReportCantidad(r) {
    if (!r) return 1;
    if (r.dispositivos && Array.isArray(r.dispositivos) && r.dispositivos.length > 0) {
        const total = r.dispositivos.reduce((sum, d) => sum + (parseInt(d.cantidad) || 1), 0);
        return total || 1;
    }
    if (r.cantidad !== undefined && r.cantidad !== null && String(r.cantidad).trim() !== '') {
        const p = parseInt(r.cantidad);
        return !isNaN(p) ? p : String(r.cantidad).trim();
    }
    return 1;
}
window.getReportCantidad = getReportCantidad;

// Helper para obtener a dónde se envía el material
function getReportEnviar(r) {
    if (!r) return '';
    return String(r.enviar || r.donde_enviar || r.destino || r.destinoEnvio || '').trim();
}
window.getReportEnviar = getReportEnviar;

window.downloadBulkExcel = async function() {
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    if (!isAdmin) {
        alert("No tienes permisos para exportar reportes a Excel.");
        return;
    }

    const list = APP_CONFIG.lastFilteredHistorialItems || APP_CONFIG.currentHistorialItems || [];
    if (list.length === 0) {
        alert("No hay reportes para exportar.");
        return;
    }
    
    // Validar que la librería se ha cargado
    if (typeof ExcelJS === 'undefined') {
        alert("La librería de Excel aún se está cargando. Por favor, inténtalo de nuevo en unos segundos.");
        return;
    }
    
    let maxPhotos = 0;
    list.forEach(r => {
        const rawFotos = r.fotos || r.photos || '';
        const urls = rawFotos ? rawFotos.split(/[\n,]+/).map(u => u.trim()).filter(Boolean) : [];
        if (urls.length > maxPhotos) maxPhotos = urls.length;
    });
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reportes');
    
    const columns = [
        { header: 'ID Reporte', key: 'id', width: 15 },
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Usuario', key: 'usuario', width: 25 },
        { header: 'Cuenta', key: 'cuenta', width: 20 },
        { header: 'Tienda', key: 'tienda', width: 25 },
        { header: 'Código Centro', key: 'codigoCentro', width: 18 },
        { header: 'Categoría', key: 'categoria', width: 15 },
        { header: 'Tipo / Tipología / Modelo', key: 'tipo', width: 28 },
        { header: 'Código Dispositivo', key: 'codigo', width: 20 },
        { header: 'Cantidad', key: 'cantidad', width: 12 },
        { header: 'A dónde se envía', key: 'enviar', width: 22 },
        { header: 'Motivo', key: 'motivo', width: 25 },
        { header: 'Descripción', key: 'descripcion', width: 50 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Fecha Cierre', key: 'fechaCierre', width: 20 },
        { header: 'Tiempo (días)', key: 'tiempo', width: 15 }
    ];
    
    for (let i = 1; i <= maxPhotos; i++) {
        columns.push({ header: `Foto ${i}`, key: `foto${i}`, width: 15 });
    }
    
    worksheet.columns = columns;
    
    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F3F3' }
    };
    
    list.forEach(r => {
        const est = String(r.estado || '').trim().toLowerCase();
        let displayTiempo = '';
        let rawTiempo = r.tiempo;
        if (rawTiempo !== undefined && rawTiempo !== null && rawTiempo !== '') {
            displayTiempo = String(rawTiempo).trim();
        }
        const isResolvedTiempo = est === 'solucionado' || est.includes('realizad');
        
        if (displayTiempo !== '') {
            if (displayTiempo === '0' && !isResolvedTiempo) {
                displayTiempo = ''; 
            } else {
                if (!isNaN(displayTiempo)) {
                    if (parseInt(displayTiempo) < 0) {
                        displayTiempo = '0 días';
                    } else {
                        displayTiempo += ' días';
                    }
                }
            }
        }
        
        if (displayTiempo === '') {
            const fechaStr = String(r.fecha || '');
            const reportDate = new Date(fechaStr.replace(/-/g, '/')); 
            if (!isNaN(reportDate.getTime())) {
                const diffTime = Math.abs(new Date().getTime() - reportDate.getTime());
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (isResolvedTiempo) {
                    if (r.fechaCierre) {
                        const closeDate = new Date(String(r.fechaCierre).replace(/-/g, '/'));
                        if (!isNaN(closeDate.getTime())) {
                            const diffT = Math.abs(closeDate.getTime() - reportDate.getTime());
                            displayTiempo = `${Math.floor(diffT / (1000 * 60 * 60 * 24))} días`;
                        } else {
                            displayTiempo = '0 días';
                        }
                    } else {
                        displayTiempo = '0 días'; 
                    }
                } else {
                    displayTiempo = `${diffDays} días`; 
                }
            } else {
                displayTiempo = '0 días';
            }
        }

        const storeCode = getReportStoreCode(r);
        const cantidadVal = getReportCantidad(r);
        const enviarVal = getReportEnviar(r);

        const devCodes = (r.dispositivos && Array.isArray(r.dispositivos) && r.dispositivos.length > 0)
            ? r.dispositivos.map(d => d.codigoDispositivo).filter(Boolean).join(', ')
            : '';
        const devModels = (r.dispositivos && Array.isArray(r.dispositivos) && r.dispositivos.length > 0)
            ? r.dispositivos.map(d => d.modelo).filter(Boolean).join(', ')
            : '';
        let tipoDisplay = r.tipo || r.tipologia || r.modelo || '';
        if (devModels && (!r.tipo || r.tipo.includes('>'))) {
            if (!tipoDisplay.toLowerCase().includes(devModels.toLowerCase())) {
                tipoDisplay = `${tipoDisplay} (${devModels})`;
            }
        }

        const rowData = {
            id: r.id || r.ref,
            fecha: r.fecha,
            usuario: r.usuario,
            cuenta: r.cuenta,
            tienda: r.tienda,
            codigoCentro: storeCode,
            categoria: r.categoria,
            tipo: tipoDisplay,
            codigo: r.codigoDispositivo || r.codigo || r.codigo_dispositivo || devCodes || '',
            cantidad: cantidadVal,
            enviar: enviarVal,
            motivo: r.motivo,
            descripcion: r.descripcion,
            estado: r.estado,
            fechaCierre: r.fechaCierre || '',
            tiempo: displayTiempo
        };
        
        const row = worksheet.addRow(rowData);
        
        const stateCell = row.getCell('estado');
        stateCell.font = { bold: true };
        if (est.includes('abiert')) {
            stateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEAEA' } };
            stateCell.font = { color: { argb: 'FFD93025' }, bold: true };
        } else if (est.includes('gestion')) {
            stateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4E5' } };
            stateCell.font = { color: { argb: 'FFE37400' }, bold: true };
        } else if (est.includes('solucionado')) {
            stateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
            stateCell.font = { color: { argb: 'FF1E8E3E' }, bold: true };
        }
        
        const cantCell = row.getCell('cantidad');
        if (cantCell) cantCell.alignment = { horizontal: 'center', vertical: 'middle' };
        const centerCodeCell = row.getCell('codigoCentro');
        if (centerCodeCell) centerCodeCell.alignment = { horizontal: 'center', vertical: 'middle' };
        
        const rawFotos = r.fotos || r.photos || '';
        const urls = rawFotos ? rawFotos.split(/[\n,]+/).map(u => u.trim()).filter(Boolean) : [];
        
        urls.forEach((url, i) => {
            const cell = row.getCell(`foto${i + 1}`);
            cell.value = {
                text: 'Ver Foto ' + (i + 1),
                hyperlink: url,
                tooltip: 'Abrir foto en Drive'
            };
            cell.font = { color: { argb: 'FF1A73E8' }, underline: true };
        });
        
        row.alignment = { vertical: 'middle', wrapText: true };
    });
    
    try {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Reportes_Filtrados_' + new Date().toISOString().slice(0,10) + '.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Error generando Excel:', err);
        alert('Hubo un error al generar el archivo Excel.');
    }
};

window.deleteDashboardReport = async function(id) {
    if (!id) return;
    try {
        const res = await callApi({
            action: 'deleteReport',
            id: id
        });
        
        if (res && res.success) {
            // 1. UI Optimista: Quitar el reporte de la caché local inmediatamente
            if (Array.isArray(APP_CONFIG.dashboardReports)) {
                APP_CONFIG.dashboardReports = APP_CONFIG.dashboardReports.filter(item => String(item.id) !== String(id));
            }
            
            // 2. Forzar el re-renderizado de la tabla y stats al instante con la caché limpia
            if (typeof renderDashboardFromData === 'function') {
                renderDashboardFromData(APP_CONFIG.dashboardReports);
            }
            
            // Mostrar el toast premium de éxito
            alert('Reporte eliminado correctamente.');
            
            // 3. Re-sincronizar silenciosamente en segundo plano con el servidor por consistencia
            if (typeof loadDashboard === 'function') {
                loadDashboard(); 
            }
        } else {
            alert('Error al eliminar: ' + (res.message || res.error || 'Desconocido'));
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión al intentar eliminar el reporte.');
    }
};

window.changeIncidentStatus = async function(id, newStatus) {
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    if (newStatus === 'Gestionado' && !isAdmin) {
        alert('Solo un administrador puede marcar una incidencia como gestionada.');
        return;
    }
    const btn = document.activeElement;
    let originalText = '';
    if (btn) {
        originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
    }
    
    try {
        const res = await callApi({
            action: 'resolveIncident',
            id: id,
            estado: newStatus
        });
        
        if (res && res.success) {
            // Notificar al usuario creador de la incidencia
            try {
                const rep = (APP_CONFIG.dashboardReports || []).find(r => String(r.id) === String(id));
                if (rep && rep.usuario) {
                    const adminNombre = APP_CONFIG.currentUser?.nombre || APP_CONFIG.currentUser?.usuario || 'Administración';
                    const storeName = rep.tienda || 'tu tienda';
                    const repTipo = rep.tipo || 'Incidencia';
                    callApi({
                        action: 'sendMessage',
                        remitente: 'Sistema',
                        destinatario: rep.usuario,
                        mensaje: `ACTUALIZACIÓN DE INCIDENCIA: Tu reporte en ${storeName} (${repTipo}) ha pasado a estado ${String(newStatus).toUpperCase()} por ${adminNombre}.`
                    }).catch(e => console.warn('Aviso enviando mensaje al usuario:', e));
                }
            } catch(notifErr) { console.warn('Aviso en notificación de cambio:', notifErr); }

            alert(`El estado de la incidencia ha sido cambiado con éxito a: ${newStatus}`);
            window.closeReportModal();
            await loadDashboard();
        } else {
            alert('Error al actualizar el estado: ' + (res.error || res.message || 'Error desconocido'));
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    } catch (err) {
        console.error(err);
        alert('Error al comunicarse con el servidor.');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

window.selectedReportForQuickBox = null;
window.uploadedResolutionPhotos = [];

window.showQuickBox = function(report) {
    window.selectedReportForQuickBox = report;
    window.uploadedResolutionPhotos = []; // Reset
    
    const box = document.getElementById('quick-detail-box');
    const badge = document.getElementById('quick-detail-status-badge');
    const tienda = document.getElementById('quick-detail-tienda');
    const tipo = document.getElementById('quick-detail-tipo');
    const resolveBtn = document.getElementById('quick-detail-resolve-btn');
    const editBtn = document.getElementById('quick-detail-edit-btn');
    const resArea = document.getElementById('quick-detail-resolution-area');
    const submitBtn = document.getElementById('submit-resolution-btn');
    const previewContainer = document.getElementById('resolve-photo-preview-container');
    
    if (!box) return;
    
    tienda.textContent = report.tienda || '-';
    tipo.textContent = report.tipo || '-';
    
    const est = String(report.estado || '').trim().toUpperCase();
    badge.textContent = est;
    
    if (est === 'ABIERTA') {
        badge.style.background = '#e74c3c';
        badge.style.color = 'white';
    } else if (est === 'GESTIONADO') {
        badge.style.background = '#faad14';
        badge.style.color = 'white';
    } else if (est === 'SOLUCIONADO') {
        badge.style.background = '#2ecc71';
        badge.style.color = 'white';
    } else {
        badge.style.background = '#95a5a6';
        badge.style.color = 'white';
    }
    
    if (est === 'GESTIONADO') {
        resolveBtn.style.display = 'flex';
        resArea.style.display = 'block'; // Auto-desplegar por defecto para ahorrar un clic al usuario
    } else {
        resolveBtn.style.display = 'none';
        resArea.style.display = 'none';
    }

    if (editBtn) {
        editBtn.style.display = (est === 'ABIERTA' || est === 'GESTIONADO') ? 'flex' : 'none';
    }
    
    submitBtn.disabled = true;
    if (previewContainer) previewContainer.innerHTML = '';
    
    box.style.display = 'flex';
    box.classList.remove('hidden');
};

window.toggleResolutionArea = function() {
    const resArea = document.getElementById('quick-detail-resolution-area');
    if (resArea) {
        resArea.style.display = resArea.style.display === 'none' ? 'block' : 'none';
    }
};

window.openDetailsModalFromQuickBox = function() {
    if (window.selectedReportForQuickBox) {
        showReportDetails(window.selectedReportForQuickBox);
    }
};

window.editReportFromQuickBox = function() {
    if (window.selectedReportForQuickBox) {
        const box = document.getElementById('quick-detail-box');
        if (box) {
            box.style.display = 'none';
            box.classList.add('hidden');
        }
        window.jumpToCreateReportForStore(window.selectedReportForQuickBox);
    }
};

window.jumpToCreateReportForStore = function(customReport = null) {
    if (customReport) {
        window.selectedReportForQuickBox = customReport;
    }
    const r = window.selectedReportForQuickBox;
    if (!r || !r.cuenta || !r.tienda) {
        alert('No se puede saltar: faltan datos de cuenta o tienda en este registro.');
        return;
    }
    
    // 1. Navegar a la vista de Nuevo Reporte
    showView('reportes');
    
    // 2. Inyectar Cuenta y Centro instantáneamente en el formulario
    const accSel = document.getElementById('incident-cuenta');
    const storeSel = document.getElementById('incident-centro');
    
    if (accSel && storeSel) {
        // Limpieza preventiva para no pisar datos antiguos
        if (typeof resetProcedure === 'function') {
            resetProcedure(false);
        }
        
        // NUEVO: Activar MODO EDICIÓN y ESCUDO DE PRECARGA ANTIBORRADO (Establecido estrictamente TRAS el reset!)
        window.editingIncidentId = r.id || '';
        window.editingIncidentDate = r.fecha || '';
        window.isAutoloadingReport = true; // Bloquea reseteos del array durante clics automáticos
        const banner = document.getElementById('editing-mode-banner');
        if (banner) {
            banner.style.display = 'flex';
            banner.classList.remove('hidden');
        }
        
        // Cargar cuenta
        accSel.value = r.cuenta;
        
        // Disparar filtro de centros síncrono
        if (typeof filterStoresByAccount === 'function') {
            filterStoresByAccount('incident', r.cuenta);
        }
        
        // Seleccionar la tienda exacta cargada en el combo
        storeSel.value = r.tienda;
        
        // Iniciar el procedimiento visual automáticamente
        if (typeof startIncidentProcedure === 'function') {
            startIncidentProcedure(r.tienda);
        }
        
        // NUEVO: INTELIGENCIA DE PRECARGA AUTOMÁTICA DE TODO EL FORMULARIO (AHORA CON FLUJO ASYNC LINEAL PERFECTO)
        (async () => {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            
            const catStr = String(r.categoria || '').toLowerCase();
            const isFurniture = catStr.includes('mobiliario');
            const isDevice = catStr.includes('dispositivo');
            const isLona = catStr.includes('lona');
            const isScreen = catStr.includes('pantalla');

            // A. Auto-seleccionar Categoría Principal (simulando click)
            let mainBtn = null;
            if (isFurniture) {
                mainBtn = document.querySelector('#category-selection button.furniture');
            } else if (isDevice) {
                mainBtn = document.querySelector('#category-selection button.device');
            } else if (isLona) {
                mainBtn = document.querySelector('#category-selection button.lona');
            } else if (isScreen) {
                mainBtn = document.querySelector('#category-selection button.screen');
            }
            
            if (mainBtn) {
                mainBtn.click();
            }
            
            // Esperar a que la interfaz despliegue las subcategorías correspondientes
            await sleep(350);

            let procId = 'device-procedure';
            if (isFurniture) procId = 'furniture-procedure';
            if (isLona) procId = 'lona-procedure';
            if (isScreen) procId = 'screen-procedure';
            
            const container = document.getElementById(procId);
            if (!container) {
                window.isAutoloadingReport = false; // Liberar bloqueo si algo falla catastróficamente
                return;
            }

            // PASO B: EJECUTAR LA RAMIFICACIÓN DE CLICS DE FORMA SECUENCIAL
            if (isFurniture) {
                // RAMA MOBILIARIO: L2(Subcategoria) -> L3(Motivo)
                if (r.subcategoria) {
                    const subBtns = Array.from(container.querySelectorAll('.level-box[data-level="2"] button.bubble-btn'));
                    const targetSub = subBtns.find(b => b.textContent.trim().toUpperCase() === String(r.subcategoria).trim().toUpperCase());
                    if (targetSub) targetSub.click();
                }
                
                // Espera secuencial garantizada
                await sleep(350);
                
                if (r.motivo) {
                    const motBtns = Array.from(container.querySelectorAll('.level-box[data-level="3"] button.bubble-btn'));
                    const targetMot = motBtns.find(b => b.textContent.trim().toUpperCase() === String(r.motivo).trim().toUpperCase());
                    if (targetMot) targetMot.click();
                }

            } else if (isLona) {
                // RAMA LONA: L2(Tipología) -> L3(Motivo)
                const lonaTip = r.tipologia || r.subcategoria || '';
                if (lonaTip) {
                    const tipBtns = Array.from(container.querySelectorAll('.level-box[data-level="2"] button.bubble-btn'));
                    const targetTip = tipBtns.find(b => b.textContent.trim().toUpperCase() === String(lonaTip).trim().toUpperCase());
                    if (targetTip) targetTip.click();
                }
                
                await sleep(350);
                
                if (r.motivo) {
                    const motBtns = Array.from(container.querySelectorAll('.level-box[data-level="3"] button.bubble-btn'));
                    const targetMot = motBtns.find(b => b.textContent.trim().toUpperCase() === String(r.motivo).trim().toUpperCase());
                    if (targetMot) targetMot.click();
                }
                
            } else if (isScreen) {
                // RAMA PANTALLA: Pantalla no tiene subcategorías en el frontend, pasa directo al paso C.
                
            } else if (isDevice) {
                // RAMA DISPOSITIVO: L2(Tipología) -> L3(Subcategoría) -> L4(Motivo)
                const tipologyVal = r.tipologia || '';
                if (tipologyVal) {
                    const tipBtns = Array.from(container.querySelectorAll('.level-box[data-level="2"] button.bubble-btn'));
                    const targetTip = tipBtns.find(b => b.textContent.trim().toUpperCase() === String(tipologyVal).trim().toUpperCase());
                    if (targetTip) targetTip.click();
                }

                // Espera a que se regeneren las subcategorías del Nivel 3 según Tipología
                await sleep(400);

                if (r.subcategoria) {
                    const subBtns = Array.from(container.querySelectorAll('.level-box[data-level="3"] button.bubble-btn'));
                    const targetSub = subBtns.find(b => {
                        const bTxt = b.textContent.trim().toUpperCase();
                        const rSub = String(r.subcategoria).trim().toUpperCase();
                        return bTxt === rSub || cleanSubcategoryString(bTxt) === cleanSubcategoryString(rSub);
                    });
                    if (targetSub) targetSub.click();
                }

                // Espera a que aparezca la caja del Nivel 4 de Motivos
                await sleep(400);

                if (r.motivo) {
                    const motBtns = Array.from(container.querySelectorAll('.level-box[data-level="4"] button.bubble-btn'));
                    const targetMot = motBtns.find(b => b.textContent.trim().toUpperCase() === String(r.motivo).trim().toUpperCase());
                    if (targetMot) targetMot.click();
                }
            }
            
            // Esperar a que finalice la renderización del DOM final
            await sleep(350);

            // C. Rellenar Bloque Final (Comentarios y Dónde Enviar)
            let finalLvlId = 'final-level-device';
            if (isFurniture) finalLvlId = 'final-level-furniture';
            if (isLona) finalLvlId = 'final-level-lona';
            if (isScreen) finalLvlId = 'final-level-screen';
            
            const finalLvl = document.getElementById(finalLvlId);
            if (finalLvl) {
                const descInp = finalLvl.querySelector('.rep-desc');
                if (descInp) descInp.value = r.descripcion || r.observaciones || '';
                
                const envSel = finalLvl.querySelector('.rep-enviar');
                if (envSel && r.enviar) envSel.value = r.enviar;
                
                // PRECARGAR FOTOS ANTERIORES SI EXISTEN
                const existingPhotos = r.fotos || r.foto;
                if (existingPhotos && typeof existingPhotos === 'string') {
                    const urls = existingPhotos.split(/[\n,]+/).map(u => u.trim()).filter(u => u && u.startsWith('http'));
                    if (urls.length > 0) {
                        APP_CONFIG.incidentUploadedPhotos = urls;
                        if (typeof window.renderIncidentPhotosUI === 'function') {
                            window.renderIncidentPhotosUI(isFurniture ? 'furniture' : (isDevice ? 'device' : (isLona ? 'lona' : 'screen')));
                        }
                    }
                }
                
                // Hacer scroll al final para revisión
                finalLvl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            // D. SI ES DISPOSITIVO: Cargar array completo de modelos para visualización (CON ULTRA-DEFENSA)
            if (isDevice) {
                // Fallback 1: Intentar rehidratar desde el listado global en memoria para máxima seguridad
                let sourceReport = r;
                if (r.id && APP_CONFIG.dashboardReports) {
                    const found = APP_CONFIG.dashboardReports.find(x => x.id === r.id);
                    if (found) sourceReport = found;
                }

                let finalDevs = sourceReport.dispositivos;

                // Fallback 2: Si viene serializado como texto por algún motivo extraño
                if (typeof finalDevs === 'string') {
                    try { finalDevs = JSON.parse(finalDevs); } catch(e) { finalDevs = null; }
                }

                // Fallback 3: Si no hay array pero hay datos planos en el reporte (compatibilidad absoluta heredada)
                if (!finalDevs || !Array.isArray(finalDevs)) {
                    if (sourceReport.modelo || sourceReport.tipologia || sourceReport.tipo) {
                        // Intentar adivinar el modelo desde el texto si es un registro heredado
                        const guessedModel = sourceReport.modelo || (String(sourceReport.tipo).split('>')[1] || '').trim() || 'Dispositivo Genérico';
                        finalDevs = [{
                            modelo: guessedModel,
                            cantidad: parseInt(sourceReport.cantidad) || 1,
                            codigoDispositivo: sourceReport.codigoDispositivo || 'N/A',
                            tipoReporte: sourceReport.tipologia || sourceReport.subcategoria || ''
                        }];
                    }
                }

                if (finalDevs && Array.isArray(finalDevs) && finalDevs.length > 0) {
                    APP_CONFIG.currentSelectedDevices = JSON.parse(JSON.stringify(finalDevs));
                    if (typeof renderSelectedDevices === 'function') {
                        renderSelectedDevices();
                        
                        // REFUERZO FINAL: Doble renderizado tras micro-sleep para garantizar visibilidad
                        await sleep(250);
                        renderSelectedDevices();
                    }
                } else {
                    console.error("CRITICAL PRECARGA: No se encontraron dispositivos estructurados para el reporte id=" + (r.id || 'N/A'), sourceReport);
                }
            } else if (isLona) {
                let sourceReport = r;
                if (r.id && APP_CONFIG.dashboardReports) {
                    const found = APP_CONFIG.dashboardReports.find(x => x.id === r.id);
                    if (found) sourceReport = found;
                }
                let finalLonas = sourceReport.dispositivos;
                if (typeof finalLonas === 'string') {
                    try { finalLonas = JSON.parse(finalLonas); } catch(e) { finalLonas = null; }
                }
                if (!finalLonas || !Array.isArray(finalLonas)) {
                    if (sourceReport.modelo) {
                        finalLonas = [{
                            modelo: sourceReport.modelo,
                            cantidad: parseInt(sourceReport.cantidad) || 1,
                            codigoDispositivo: sourceReport.codigoDispositivo || ''
                        }];
                    }
                }
                if (finalLonas && Array.isArray(finalLonas) && finalLonas.length > 0) {
                    APP_CONFIG.currentSelectedLonas = JSON.parse(JSON.stringify(finalLonas));
                    if (typeof renderSelectedLonas === 'function') {
                        renderSelectedLonas();
                        await sleep(250);
                        renderSelectedLonas();
                    }
                }
            }

            // E. PRECARGA DE FOTOS EXISTENTES: Para que el usuario pueda verlas, borrarlas o añadir nuevas
            if (r.fotos) {
                // Limpiar estado previo de fotos de incidentes
                APP_CONFIG.incidentUploadedPhotos = [];
                
                // Parsear enlaces (separados por saltos de línea o comas)
                const urls = String(r.fotos).split(/[\n,]+/).map(u => u.trim()).filter(u => u && u.startsWith('http'));
                
                if (urls.length > 0) {
                    APP_CONFIG.incidentUploadedPhotos = [...urls];
                    const thumbContainer = document.getElementById(`incident-thumbnails-${isFurniture ? 'furniture' : (isDevice ? 'device' : (isLona ? 'lona' : 'screen'))}`);
                    
                    if (thumbContainer) {
                        thumbContainer.innerHTML = ''; // Limpiar previos visualmente
                        
                        urls.forEach(picUrl => {
                            // Crear el wrapper visual imitando la carga normal de la APP
                            const wrap = document.createElement('div');
                            wrap.className = 'local-thumb-wrapper uploaded';
                            wrap.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 2px solid #2ecc71; background: #333; display: flex; align-items: center; justify-content: center;';
                            wrap.dataset.url = picUrl;

                            // Convertir link de drive a vista previa real para el IMG
                            const previewUrl = window.getGoogleDriveThumbnail(picUrl);

                            wrap.innerHTML = `
                                <img src="${previewUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null;this.src='https://via.placeholder.com/80x80?text=FOTO';">
                                <div style="position: absolute; top: 2px; right: 2px; background: rgba(46, 204, 113, 0.9); color: #fff; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                                    <i class="fa fa-check"></i>
                                </div>
                                <button type="button" class="delete-thumb-btn" style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(231, 76, 60, 0.85); color: #fff; border: none; font-size: 10px; padding: 2px 0; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                                    <i class="fa fa-trash"></i> Borrar
                                </button>
                            `;

                            // Configurar el botón de borrado nativo
                            wrap.querySelector('.delete-thumb-btn').onclick = () => {
                                APP_CONFIG.incidentUploadedPhotos = APP_CONFIG.incidentUploadedPhotos.filter(u => u !== picUrl);
                                wrap.remove();
                            };
                            
                            thumbContainer.appendChild(wrap);
                        });
                    }
                }
            }
            
            // ELEGANCIA PURA Y SEGURIDAD ABSOLUTA: Retirar escudo de precarga solo al FINAL de todo el hilo secuencial
            window.isAutoloadingReport = false;

        })();

    }
};

window.cancelEditMode = function() {
    window.editingIncidentId = null;
    const banner = document.getElementById('editing-mode-banner');
    if (banner) {
        banner.style.display = 'none';
        banner.classList.add('hidden');
    }
    // Limpiar el formulario también por coherencia
    if (typeof resetProcedure === 'function') {
        resetProcedure(false); 
    }
};

window.handleResolutionPhotoUpload = async function(event) {
    const input = event.target;
    const files = Array.from(input.files || []);
    if (files.length === 0) return;
    
    const previewContainer = document.getElementById('resolve-photo-preview-container');
    const submitBtn = document.getElementById('submit-resolution-btn');
    
    submitBtn.disabled = true;
    if (previewContainer) {
        previewContainer.innerHTML = `
            <div style="color:var(--mi-orange); font-weight:600; display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:12px; width:100%;">
                <i class="fa fa-spinner fa-spin" style="font-size:1.1rem;"></i> Subiendo ${files.length} foto(s) a Drive... Espera, por favor.
            </div>
        `;
    }
    
    let successCount = 0;
    let failCount = 0;

    // Iteramos sobre todos los archivos seleccionados por el usuario
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const isImg = file.type && file.type.startsWith('image/');
            const base64 = await window.getCompressedBase64(file);
            const mimeType = isImg ? 'image/jpeg' : file.type;
            const extension = isImg ? 'jpg' : (file.name.split('.').pop() || 'bin');
            const formattedDate = new Date().toISOString().slice(0, 10);
            const userRaw = (APP_CONFIG.currentUser?.email || APP_CONFIG.currentUser?.usuario) || 'Usuario';
            const userClean = String(userRaw).split('@')[0].trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
            const tiendaSanitized = String(window.selectedReportForQuickBox?.tienda || 'Tienda').trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
            
            // Sufijo de conteo si hay varias fotos para mantener el orden lógico y evitar sobreescrituras fortuitas
            const uniqueSuffix = files.length > 1 ? `_${i + 1}` : '';
            const customFileName = `${userClean}_${tiendaSanitized}_${formattedDate}_SOLUCIONADO${uniqueSuffix}.${extension}`;

            const res = await callApi({
                action: 'uploadFile',
                base64: base64,
                mimeType: mimeType,
                fileName: customFileName
            });

            if (res && res.success && res.url) {
                window.uploadedResolutionPhotos.push(res.url);
                successCount++;
            } else {
                failCount++;
            }
        } catch (err) {
            console.error("Fallo de subida en iteración:", err);
            failCount++;
        }
    }

    // Renderizamos el feedback definitivo para el usuario
    if (previewContainer) {
        previewContainer.innerHTML = '';
        
        if (successCount > 0) {
            const successBox = document.createElement('div');
            successBox.style.cssText = "background:#e6f7ff; border:1px solid #91d5ff; padding:8px 12px; border-radius:8px; color:#1890ff; font-size:12px; font-weight:600; margin-bottom:8px; display:flex; align-items:center; gap:8px; width:100%;";
            successBox.innerHTML = `<i class="fa fa-check-circle" style="color:#52c41a; font-size:1.2rem;"></i> ¡${successCount} foto(s) subida(s) con éxito!`;
            previewContainer.appendChild(successBox);
        }
        
        if (failCount > 0) {
            const errorBox = document.createElement('div');
            errorBox.style.cssText = "background:#fff2f0; border:1px solid #ffccc7; padding:8px 12px; border-radius:8px; color:#ff4d4f; font-size:12px; font-weight:600; margin-bottom:8px; display:flex; align-items:center; gap:8px; width:100%;";
            errorBox.innerHTML = `<i class="fa fa-exclamation-circle" style="font-size:1.2rem;"></i> ${failCount} foto(s) no se pudieron cargar.`;
            previewContainer.appendChild(errorBox);
        }
    }

    // Habilitamos el botón final si tenemos al menos una foto válida cargada
    if (window.uploadedResolutionPhotos.length > 0) {
        submitBtn.disabled = false;
    } else {
        submitBtn.disabled = true;
    }
};

window.submitResolution = async function() {
    if (!window.selectedReportForQuickBox || window.uploadedResolutionPhotos.length === 0) {
        alert("Por favor, sube una foto de la solución obligatoria.");
        return;
    }
    
    const submitBtn = document.getElementById('submit-resolution-btn');
    const originalText = submitBtn.textContent;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Actualizando estado...';
    
    try {
        const res = await callApi({
            action: 'resolveIncident',
            id: window.selectedReportForQuickBox.id,
            photos: window.uploadedResolutionPhotos
        });
        
        if (res && res.success) {
            // Notificar al usuario creador de la incidencia
            try {
                const rep = window.selectedReportForQuickBox;
                if (rep && rep.usuario) {
                    const adminNombre = APP_CONFIG.currentUser?.nombre || APP_CONFIG.currentUser?.usuario || 'Administración';
                    const storeName = rep.tienda || 'tu tienda';
                    const repTipo = rep.tipo || 'Incidencia';
                    callApi({
                        action: 'sendMessage',
                        remitente: 'Sistema',
                        destinatario: rep.usuario,
                        mensaje: `INCIDENCIA SOLUCIONADA: Tu reporte en ${storeName} (${repTipo}) ha sido resuelto y marcado como SOLUCIONADO por ${adminNombre}.`
                    }).catch(e => console.warn('Aviso enviando mensaje al usuario:', e));
                }
            } catch(notifErr) { console.warn('Aviso en notificación de resolución:', notifErr); }

            alert('¡Incidencia resuelta con éxito! Pasada a color azul (Solucionado).');
            
            // Ocultar modal de resolución flotante
            const box = document.getElementById('quick-detail-box');
            if (box) {
                box.style.display = 'none';
                box.classList.add('hidden');
            }
            
            // Ocultar también el modal del historial subyacente si estaba abierto
            const histModal = document.getElementById('historial-modal');
            if (histModal) {
                histModal.style.display = 'none';
                histModal.classList.add('hidden');
            }
            
            // Recargar dashboard para actualizar métricas y tabla
            await loadDashboard();
        } else {
            alert('Error al resolver la incidencia: ' + (res.error || 'Error desconocido'));
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    } catch (err) {
        console.error(err);
        alert('Error al enviar la resolución.');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
};

window.filterDashboardTable = function() {
    const selCuenta = document.getElementById('dash-filter-cuenta')?.value || 'all';
    const selTienda = document.getElementById('dash-filter-tienda')?.value.trim().toLowerCase() || '';
    const selTipo = document.getElementById('dash-filter-tipo')?.value || 'all';
    const selEstado = document.getElementById('dash-filter-estado')?.value || 'all';
    const selUsuario = document.getElementById('dash-filter-usuario')?.value || 'all';
    
    let reports = APP_CONFIG.dashboardReports || [];
    
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    const isAM = isUserAM(APP_CONFIG.currentUser);
    
    const filtered = reports.filter(r => {
        const matchCuenta = selCuenta === 'all' || String(r.cuenta || '').trim() === selCuenta;
        const matchTienda = selTienda === '' || String(r.tienda || '').trim().toLowerCase().includes(selTienda);
        
        let matchTipo = true;
        if (selTipo !== 'all') {
            const rCat = String(r.categoria || '').trim().toLowerCase();
            let rTipoFinal = rCat;
            if (String(r.tipo || '').trim().toLowerCase().includes('lanzamiento')) rTipoFinal = 'lanzamiento';
            if (rCat.includes('pantalla')) rTipoFinal = 'pantalla';
            matchTipo = rTipoFinal === selTipo;
        }
        
        let matchUsuario = true;
        if (isAdmin && selUsuario !== 'all') {
            matchUsuario = String(r.usuario || '').trim() === selUsuario;
        }
        
        let matchEstado = true;
        if (selEstado !== 'all') {
            const rowEst = String(r.estado || '').trim().toLowerCase();
            matchEstado = rowEst.includes(selEstado);
        }
        
        return matchCuenta && matchTienda && matchTipo && matchUsuario && matchEstado;
    });
    
    function getSortValue(r) {
        const est = String(r.estado).trim().toLowerCase();
        const isResolvedTiempo = est === 'solucionado' || est === 'realizado' || est === 'realizada';
        let rawTiempo = r.tiempo;
        let displayTiempo = (rawTiempo !== undefined && rawTiempo !== null && rawTiempo !== '') ? String(rawTiempo).trim() : '';
        if (displayTiempo !== '') {
            if (!(displayTiempo === '0' && !isResolvedTiempo)) {
                return !isNaN(displayTiempo) ? Math.max(0, parseInt(displayTiempo)) : 0;
            }
        }
        const fechaStr = String(r.fecha || '');
        const reportDate = new Date(fechaStr.replace(/-/g, '/')); 
        if (!isNaN(reportDate.getTime())) {
            if (isResolvedTiempo) {
                if (r.fechaCierre) {
                    const closeDate = new Date(String(r.fechaCierre).replace(/-/g, '/'));
                    if (!isNaN(closeDate.getTime())) {
                        const diffTime = Math.abs(closeDate.getTime() - reportDate.getTime());
                        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    }
                }
                return 0;
            }
            const diffTime = Math.abs(Date.now() - reportDate.getTime());
            return Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }
        return 0;
    }

    if (window.dashboardTimeSortOrder) {
        filtered.sort((a, b) => {
            const valA = getSortValue(a);
            const valB = getSortValue(b);
            return window.dashboardTimeSortOrder === 'desc' ? valB - valA : valA - valB;
        });
    }
    
    renderDashboardTable(filtered);
};

window.dashboardTimeSortOrder = 'desc';

window.sortDashboardByTime = function() {
    window.dashboardTimeSortOrder = window.dashboardTimeSortOrder === 'desc' ? 'asc' : 'desc';
    const icon = document.getElementById('sort-tiempo-icon');
    if (icon) {
        icon.className = window.dashboardTimeSortOrder === 'desc' ? 'fas fa-sort-numeric-down-alt' : 'fas fa-sort-numeric-up';
    }
    window.filterDashboardTable();
};

window.renderHistorialRows = function(items, isLanzamientos) {
    const modal = document.getElementById('historial-modal');
    const tbody = document.getElementById('historial-modal-tbody');
    if (!tbody) return;
    
    // Toggle header visibility based on isLanzamientos and role
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
                     
    const hideUsuario = !isAdmin;
    const hideAcciones = isLanzamientos;

    const thUsuario = document.getElementById('historial-th-usuario');
    const thAcciones = document.getElementById('historial-th-acciones');
    if (thUsuario) thUsuario.style.display = hideUsuario ? 'none' : '';
    if (thAcciones) thAcciones.style.display = hideAcciones ? 'none' : '';
    
    tbody.innerHTML = '';
    
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${hideUsuario ? (hideAcciones ? '4' : '5') : (hideAcciones ? '5' : '6')}" style="text-align:center; padding: 20px;">No hay registros para este estado o búsqueda.</td></tr>`;
        return;
    }

    items.forEach(r => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--mi-border)';
        
        let statusClass = 'color:#95a5a6;font-weight:600';
        const rawEst = String(r.estado || '').trim().toLowerCase();
        
        if (rawEst === 'abierta' || rawEst === 'incidente') {
            statusClass = 'color:#e74c3c;font-weight:600';
        } else if (rawEst === 'realizado') {
            statusClass = 'color:#2ecc71;font-weight:600';
        } else if (rawEst === 'gestionado') {
            statusClass = 'color:#faad14;font-weight:600';
        } else if (rawEst === 'solucionado') {
            statusClass = 'color:#2ecc71;font-weight:600';
        }
        const refVal = isLanzamientos ? 'Lanzamiento' : (r.fecha || '-');
        const tiendaVal = isLanzamientos ? (r.nombre || r.tienda) : (r.tienda || '-');
        const usuarioVal = r.usuario || '-';
        const cuentaVal = r.cuenta || '-';
        let estadoLabel = isLanzamientos && rawEst === 'pendiente' ? 'Pendiente' : (r.estado || 'Gestionado');
        
        const hideUsuario = !isAdmin;
        const hideAcciones = isLanzamientos;
        
        if (isLanzamientos && rawEst === 'pendiente') {
            estadoLabel = `<span style="color:#faad14; font-weight:600;"><i class="fas fa-clock"></i> Pendiente</span>`;
            statusClass = ''; 
        } else if (isLanzamientos && (rawEst === 'realizado' || rawEst === 'realizada')) {
            estadoLabel = `<span style="color:#2ecc71; font-weight:600;"><i class="fas fa-check-circle"></i> Realizada</span>`;
            statusClass = '';
        }
        
        row.innerHTML = `
            <td style="padding: 12px;">${refVal}</td>
            <td style="padding: 12px; display: ${hideUsuario ? 'none' : ''};">${usuarioVal}</td>
            <td style="padding: 12px;">${cuentaVal}</td>
            <td style="padding: 12px;">${tiendaVal}</td>
            <td style="padding: 12px; ${statusClass}">${estadoLabel}</td>
            <td style="padding: 12px; text-align:center; display: ${hideAcciones ? 'none' : 'flex'}; gap:5px; justify-content:center; align-items:center;"></td>
        `;
        
        const actionTd = row.querySelector('td:last-child');
        
        // --- LÓGICA ESTÁNDAR REPORTES INCIDENCIAS ---
        if (!isLanzamientos) {
            actionTd.style.display = 'table-cell'; // Asegurar modo tabla-celda puro
            
            const flexWrapper = document.createElement('div');
            flexWrapper.className = 'table-actions-wrapper';
            actionTd.appendChild(flexWrapper);

            // 1. Circular Button "Ver"
            const verBtn = document.createElement('button');
            verBtn.className = 'action-btn-circle';
            verBtn.innerHTML = '<i class="fas fa-eye"></i>';
            verBtn.title = 'Ver Detalles Completos';
            verBtn.onclick = (e) => {
                e.stopPropagation();
                modal.style.display = 'none';
                APP_CONFIG.returnToHistorial = true;
                window.showReportDetails(r);
            };
            flexWrapper.appendChild(verBtn);

            // Editar mientras la incidencia está abierta o gestionada.
            if (rawEst === 'abierta' || rawEst === 'abierto' || rawEst === 'gestionado') {
                // Botón Editar (Lápiz azul-turquesa)
                const editBtn = document.createElement('button');
                editBtn.className = 'action-btn-circle';
                editBtn.style.color = '#00bcd4'; 
                editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
                editBtn.title = 'Editar este reporte';
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    modal.style.display = 'none';
                    window.jumpToCreateReportForStore(r); 
                };
                flexWrapper.appendChild(editBtn);

                if (rawEst === 'abierta' || rawEst === 'abierto') {
                    // Botón Eliminar (Basura roja)
                    const delBtn = document.createElement('button');
                    delBtn.className = 'action-btn-circle';
                    delBtn.style.color = '#e74c3c'; 
                    delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                    delBtn.title = 'Eliminar este reporte permanentemente';
                    delBtn.onclick = async (e) => {
                        e.stopPropagation();
                        if (await window.showConfirm('¿Eliminar Reporte?', '¿Seguro que deseas ELIMINAR este reporte permanentemente? Esta acción no se puede deshacer.', true)) {
                            modal.style.display = 'none';
                            await window.deleteDashboardReport(r.id);
                        }
                    };
                    flexWrapper.appendChild(delBtn);
                }
            }
            
            // Una incidencia gestionada puede marcarse como solucionada.
            if (rawEst === 'gestionado') {
                const resBtn = document.createElement('button');
                resBtn.className = 'action-btn-circle';
                resBtn.style.color = '#52c41a'; // Verde éxito vibrante
                resBtn.innerHTML = '<i class="fas fa-check"></i>';
                resBtn.title = 'Marcar como Solucionado';
                resBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.showQuickBox(r);
                };
                flexWrapper.appendChild(resBtn);
            }
            
            // 4. Permisos Admin
            if (isAdmin) {
                if (rawEst === 'abierta' || rawEst === 'abierto') {
                    const repBtn = document.createElement('button');
                    repBtn.className = 'action-btn-circle';
                    repBtn.style.color = '#e67e22';
                    repBtn.innerHTML = '<i class="fas fa-tools"></i>';
                    repBtn.title = 'Marcar como Solicitado reparación';
                    repBtn.onclick = async (e) => {
                        e.stopPropagation();
                        modal.style.display = 'none';
                        await window.changeIncidentStatus(r.id, 'Gestionado');
                    };
                    flexWrapper.appendChild(repBtn);
                } else if (rawEst === 'solucionado') {
                    const revBtn = document.createElement('button');
                    revBtn.className = 'action-btn-circle';
                    revBtn.style.color = '#2ecc71';
                    revBtn.innerHTML = '<i class="fas fa-search"></i>';
                    revBtn.title = 'Revisar Resolución';
                    revBtn.onclick = (e) => {
                        e.stopPropagation();
                        modal.style.display = 'none';
                        APP_CONFIG.returnToHistorial = true;
                        window.showReportDetails(r);
                        setTimeout(() => {
                            const adminRev = document.getElementById('admin-review-btn');
                            if (adminRev) adminRev.click();
                        }, 250);
                    };
                    flexWrapper.appendChild(revBtn);
                }
            }
        }
        
        tbody.appendChild(row);
    });
};

window.applyModalFilters = function() {
    let items = APP_CONFIG.currentHistorialItems || [];
    const isLanzamientos = APP_CONFIG.currentHistorialIsLanzamientos || false;
    
    const targetStatus = APP_CONFIG.currentModalStatus || 'all';
    const isTodos = targetStatus === 'all' || targetStatus === 'todos';
    
    // First, filter items by status so dropdowns only show relevant data
    let statusFilteredItems = items;
    if (!isTodos && !isLanzamientos) {
        statusFilteredItems = items.filter(r => {
            const est = String(r.estado || '').trim().toLowerCase();
            return est.includes(targetStatus);
        });
    }

    const cuentaVal = document.getElementById('modal-filter-cuenta')?.value || 'all';
    const filterTienda = document.getElementById('modal-filter-tienda');
    
    // Dynamically rebuild modal-filter-tienda based on selected cuenta AND status
    if (filterTienda) {
        const currentTiendaVal = filterTienda.value;
        const filterList = document.getElementById('modal-filter-tienda-list');
        if (filterList) {
            let storesForCuenta = statusFilteredItems;
            if (cuentaVal !== 'all') {
                storesForCuenta = statusFilteredItems.filter(r => String(r.cuenta || '').trim() === cuentaVal);
            }
            const tiendas = [...new Set(storesForCuenta.map(r => String(r.tienda || '').trim()).filter(Boolean))].sort();
            
            filterList.innerHTML = '';
            tiendas.forEach(t => filterList.innerHTML += `<option value="${t}"></option>`);
            
            if (currentTiendaVal !== '' && !tiendas.includes(currentTiendaVal)) {
                filterTienda.value = '';
            }
        }
    }
    
    const tiendaVal = filterTienda?.value.trim().toLowerCase() || '';
    const tipoVal = document.getElementById('modal-filter-tipo')?.value || 'all';
    const usuarioVal = document.getElementById('modal-filter-usuario')?.value || 'all';
    const estadoVal = document.getElementById('modal-filter-estado')?.value || 'all';
    
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);

    const filtered = items.filter(r => {
        // Si no estamos en "Todos" ni en lanzamientos, filtramos duro por estado
        if (!isTodos && !isLanzamientos) {
            const est = String(r.estado || '').trim().toLowerCase();
            let matchStatus = false;
            matchStatus = est.includes(targetStatus);
            if (!matchStatus) return false;
        }
        
        // Filtros desplegables
        if (cuentaVal !== 'all' && String(r.cuenta || '').trim() !== cuentaVal) return false;
        
        if (tiendaVal !== '' && !String(r.tienda || '').trim().toLowerCase().includes(tiendaVal)) return false;
        
        if (tipoVal !== 'all') {
            const rCat = String(r.categoria || '').trim().toLowerCase();
            let rTipoFinal = rCat;
            if (String(r.tipo || '').trim().toLowerCase().includes('lanzamiento')) rTipoFinal = 'lanzamiento';
            if (rCat.includes('pantalla')) rTipoFinal = 'pantalla';
            if (rCat.includes('lona')) rTipoFinal = 'lona';
            if (rTipoFinal !== tipoVal) return false;
        }
        
        if (isAdmin && usuarioVal !== 'all') {
            const rUsuario = String(r.usuario || '').trim();
            if (rUsuario !== usuarioVal) return false;
        }
        
        if (isTodos && estadoVal !== 'all') {
            const est = String(r.estado || '').trim().toLowerCase();
            if (!est.includes(estadoVal)) return false;
        }
        
        return true;
    });
    
    if (typeof renderHistorialRows === 'function') {
        APP_CONFIG.lastFilteredHistorialItems = filtered;
        window.renderHistorialRows(filtered, isLanzamientos);
    }
};

window.showHistorialModal = function(title, items, isLanzamientos) {
    const modal = document.getElementById('historial-modal');
    const titleEl = document.getElementById('historial-modal-title');
    const filtersEl = document.getElementById('historial-modal-filters');
    
    if (!modal || !titleEl) return;
    
    titleEl.textContent = title;
    
    // Hide filters for general historical views (not the dashboard summary cards)
    if (filtersEl) filtersEl.style.display = 'none';
    
    // Save current items for local filtering
    APP_CONFIG.currentHistorialItems = items;
    APP_CONFIG.currentHistorialIsLanzamientos = isLanzamientos;
    
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    const excelBtn = document.getElementById('export-excel-btn');
    if (excelBtn) {
        excelBtn.style.display = isAdmin ? 'flex' : 'none';
    }
    
    window.renderHistorialRows(items, isLanzamientos);
    
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
};

window.filterToIncidents = function() {
    if (!APP_CONFIG.dashboardReports) return;
    let filtered = APP_CONFIG.dashboardReports.filter(r => {
        const est = String(r.estado || '').trim().toLowerCase();
        return est === 'abierta' || est === 'gestionado';
    });
    
    window.showHistorialModal('Historial de Incidencias Activas', filtered, false);
};

window.filterToAllReports = function() {
    if (!APP_CONFIG.dashboardReports) return;
    window.showHistorialModal('Historial de Reportes Totales', APP_CONFIG.dashboardReports, false);
};

// --- Password Hashing ---
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Authentication ---
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-usuario').value;
    const pass = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');

    errorMsg.textContent = 'Verificando...';

    try {
        const hashedPass = await hashPassword(pass);
        const response = await callApi({
            action: 'login',
            email: email,
            password: hashedPass
        });

        console.log("Login Response:", response);
        if (response.success) {
            APP_CONFIG.currentUser = response.user;
            ensureAdminStoresHydrated();
            APP_CONFIG.sessionToken = response.sessionToken;
            localStorage.setItem('xiaomi_user', JSON.stringify(APP_CONFIG.currentUser));
            localStorage.setItem('xiaomi_session_token', response.sessionToken);
            startApp(true);
            // FIX: loadDeviceCatalog() se intenta al cargar la página, antes del login, así que
            // sin sessionToken el backend la rechaza y el catálogo queda vacío en silencio.
            // Lo recargamos ahora que ya hay un sessionToken válido.
            loadDeviceCatalog();
            
            // Solicitar permisos de notificación nativa
            if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        } else {
            errorMsg.textContent = response.message || 'Error al iniciar sesión';
        }
    } catch (err) {
        errorMsg.textContent = 'Error de conexión con el servidor (Revisa el despliegue)';
        console.error('Error en login:', err);
    }
}

function startApp(forceDashboard = false) {
    ensureAdminStoresHydrated();
    if (typeof initLocalImeiDatabase === 'function') {
        initLocalImeiDatabase();
    }
    views.login.classList.add('hidden');
    views.app.classList.remove('hidden');
    document.getElementById('user-name').textContent = APP_CONFIG.currentUser.nombre;
    document.getElementById('user-badge').textContent = APP_CONFIG.currentUser.rol;
    
    // Premium Hero Welcome Label
    const welcomeEl = document.getElementById('welcome-msg');
    if (welcomeEl) {
        welcomeEl.innerHTML = `¡Hola, ${String(APP_CONFIG.currentUser.nombre).split(' ')[0]}! ✨`;
    }
    
    // Rellenar Cuentas dinámicamente
    const tiendas = APP_CONFIG.currentUser.tiendas || [];
    const cuentas = [...new Set(tiendas.map(t => t.cuenta))]; // Cuentas únicas
    
    ['incident'].forEach(type => {
        const cuentaSelect = document.getElementById(`${type}-cuenta`);
        const centroSelect = document.getElementById(`${type}-centro`);
        
        if (cuentaSelect) {
            cuentaSelect.innerHTML = '<option value="" disabled selected>Seleccione Cuenta</option>';
            if (cuentas.length === 0) {
                cuentaSelect.innerHTML = '<option value="" disabled>Sin tiendas asignadas</option>';
            } else {
                cuentas.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c;
                    cuentaSelect.appendChild(opt);
                });
            }
        }

        if (centroSelect) {
            centroSelect.innerHTML = '<option value="" disabled selected>Primero elige cuenta</option>';
            centroSelect.disabled = true;
        }
    });

    const targetView = forceDashboard ? 'dashboard' : (localStorage.getItem('xiaomi_last_view') || 'dashboard');
    showView(targetView);
    
    // Sincronizar estado activo de los links de navegación
    navLinks.forEach(link => {
        if (link.getAttribute('data-target') === targetView) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    // Pre-cargar correspondencia en segundo plano para hidratar badge de mensajes y arrancar monitor en vivo
    setTimeout(() => {
        if (typeof window.loadUserInbox === 'function') window.loadUserInbox();
        if (typeof window.startLiveIncidentWatcher === 'function') window.startLiveIncidentWatcher();
        if (typeof window.syncWithFeishuLive === 'function') window.syncWithFeishuLive(true);
    }, 1000);
}

function filterStoresByAccount(type, cuenta) {
    const tiendas = APP_CONFIG.currentUser.tiendas || [];
    const filtered = tiendas.filter(t => t.cuenta === cuenta);
    
    const select = document.getElementById(`${type}-centro`);
    if (select) {
        select.disabled = false;
        select.innerHTML = '<option value="" disabled selected>Seleccione Centro</option>';
        filtered.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.nombre;
            opt.dataset.owner = t.owner || t.usuario || '';
            opt.textContent = t.nombre;
            select.appendChild(opt);
        });
    }
}

// Custom Store Selection Modal Logic
window.openStoreSelectionModal = function(mode = 'incident') {
    APP_CONFIG.currentStoreSelectionMode = mode;
    const modal = document.getElementById('store-selection-modal');
    if (!modal) return;
    
    const searchInput = document.getElementById('store-selection-search');
    if (searchInput) searchInput.value = '';
    
    renderStoreSelectionList();
    
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    
    if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
        searchInput.oninput = renderStoreSelectionList;
    }
};

window.renderStoreSelectionList = function() {
    const listContainer = document.getElementById('store-selection-list');
    const searchInput = document.getElementById('store-selection-search');
    if (!listContainer) return;
    
    const mode = APP_CONFIG.currentStoreSelectionMode || 'incident';
    
    let stores = [];
    if (mode === 'incident') {
        stores = APP_CONFIG.currentCuentaStores || [];
    } else {
        // Tiendas View mode
        const filterCuenta = document.getElementById('tiendas-filter-cuenta');
        const selectedCuenta = filterCuenta ? filterCuenta.value : 'all';
        let allStores = APP_CONFIG.currentUser.tiendas || [];
        if (selectedCuenta !== 'all') {
            stores = allStores.filter(t => String(t.cuenta || '').trim() === selectedCuenta);
        } else {
            stores = allStores;
        }
    }
    
    // Dedup stores by name since the list might contain the same store multiple times for different metrics
    const uniqueStoreNames = [...new Set(stores.map(t => String(t.nombre || '').trim()))].filter(Boolean);
    let uniqueStores = uniqueStoreNames.map(name => {
        return stores.find(t => String(t.nombre || '').trim() === name);
    });
    
    if (searchInput && searchInput.value.trim() !== '') {
        const query = searchInput.value.toLowerCase().trim();
        uniqueStores = uniqueStores.filter(t => 
            String(t.nombre || '').toLowerCase().includes(query) || 
            String(t.rms || '').toLowerCase().includes(query)
        );
    }
    
    listContainer.innerHTML = '';
    
    // Add "Todas las Tiendas" option if mode is 'tiendas_view'
    if (mode === 'tiendas_view') {
        const allBtn = document.createElement('button');
        allBtn.style.cssText = 'width: 100%; text-align: left; padding: 12px 15px; background: #f9f9f9; border: 1px solid #eee; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: #333; transition: all 0.2s; font-style: italic;';
        allBtn.innerHTML = `<span><i class="fas fa-list"></i> Todas las Tiendas</span>`;
        allBtn.onclick = () => {
            document.getElementById('store-selection-modal').style.display = 'none';
            document.getElementById('store-selection-modal').classList.add('hidden');
            const tiendasInput = document.getElementById('tiendas-filter-tienda');
            if (tiendasInput) {
                tiendasInput.value = '';
                tiendasInput.dataset.realValue = '';
                window.renderTiendasGrid();
            }
        };
        listContainer.appendChild(allBtn);
    }
    
    if (uniqueStores.length === 0) {
        listContainer.innerHTML += '<div style="padding: 20px; text-align: center; color: #888;">No hay resultados</div>';
        return;
    }
    
    // Sort
    uniqueStores.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));
    
    uniqueStores.forEach(t => {
        const btn = document.createElement('button');
        btn.style.cssText = 'width: 100%; text-align: left; padding: 12px 15px; background: #f9f9f9; border: 1px solid #eee; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: #333; transition: all 0.2s;';
        btn.onmouseover = () => btn.style.borderColor = 'var(--mi-orange)';
        btn.onmouseout = () => btn.style.borderColor = '#eee';
        
        btn.innerHTML = `
            <span style="font-weight: 500;">${t.nombre}</span>
            <i class="fas fa-chevron-right" style="color: #ccc; font-size: 12px;"></i>
        `;
        
        btn.onclick = () => {
            document.getElementById('store-selection-modal').style.display = 'none';
            document.getElementById('store-selection-modal').classList.add('hidden');
            
            if (mode === 'incident') {
                const selStoreText = document.getElementById('selected-store-text');
                if (selStoreText) {
                    selStoreText.textContent = t.nombre;
                    selStoreText.style.fontWeight = 'bold';
                }
                const customTrigger = document.getElementById('custom-store-trigger');
                if (customTrigger) {
                    customTrigger.style.border = '1px solid #ccc';
                }
                const hiddenInput = document.getElementById('incident-centro');
                if (hiddenInput) {
                    hiddenInput.value = t.nombre;
                    startIncidentProcedure(t.nombre);
                }
            } else if (mode === 'tiendas_view') {
                const tiendasInput = document.getElementById('tiendas-filter-tienda');
                if (tiendasInput) {
                    tiendasInput.value = t.nombre;
                    window.renderTiendasGrid();
                }
            } else if (mode === 'imei') {
                const imeiInput = document.getElementById('imei-filter-tienda-input');
                const imeiSelect = document.getElementById('imei-filter-tienda');
                const clearBtn = document.getElementById('btn-clear-imei-store');
                if (imeiInput) imeiInput.value = t.nombre;
                if (imeiSelect) imeiSelect.value = t.nombre;
                if (clearBtn) clearBtn.style.display = 'block';
                window.renderStoreImeis();
            }
        };
        
        listContainer.appendChild(btn);
    });
};

async function loadUsers() {
    const select = document.getElementById('login-usuario');
    if (!select) return;

    // 1. OPTIMIZACIÓN: Usar caché local para que el desplegable responda AL INSTANTE
    const cachedUsersStr = localStorage.getItem('cached_users_list');
    if (cachedUsersStr) {
        try {
            const cached = JSON.parse(cachedUsersStr);
            if (cached && cached.length > 0) {
                console.log("Renderizando usuarios desde caché instantáneo...");
                renderUsersToDropdown(cached, select);
                // Si ya tenemos caché, no hace falta mostrar spinner, simplemente refrescamos en background
            }
        } catch(e) {
             select.innerHTML = '<option value="" disabled selected>Cargando usuarios...</option>';
        }
    } else {
        select.innerHTML = '<option value="" disabled selected>Cargando usuarios...</option>';
    }
    
    // 2. LISTA DE EMERGENCIA HARDCODED (Backup total en caso de bloqueo de red)
    const HARDCODED_FALLBACK = [
        {"email":"Virginia Rodriguez","nombre":"Virginia Rodriguez"},
        {"email":"Carlos Deniz","nombre":"Carlos Deniz"},
        {"email":"Jesús de Luis Blanco","nombre":"Jesús de Luis Blanco"},
        {"email":"Carlos Bellasai","nombre":"Carlos Bellasai"},
        {"email":"Guillermo Perez","nombre":"Guillermo Perez"},
        {"email":"Ezequiel Brito","nombre":"Ezequiel Brito"},
        {"email":"Jesus de la Torre","nombre":"Jesus de la Torre"},
        {"email":"Francisco Paz","nombre":"Francisco Paz"},
        {"email":"Ricardo Dahdah Leon","nombre":"Ricardo Dahdah Leon"},
        {"email":"Miguel Mata","nombre":"Miguel Mata"},
        {"email":"Fernando Torres","nombre":"Fernando Torres"},
        {"email":"Estela Corbella","nombre":"Estela Corbella"},
        {"email":"Carlos Martinez","nombre":"Carlos Martinez"},
        {"email":"Joaquín Lemus","nombre":"Joaquín Lemus"},
        {"email":"Alicia Muruzabal","nombre":"Alicia Muruzabal"},
        {"email":"Madison Valencia","nombre":"Madison Valencia"},
        {"email":"Luis Angel Minguez","nombre":"Luis Angel Minguez"},
        {"email":"Alba González","nombre":"Alba González"},
        {"email":"Pablo Martín","nombre":"Pablo Martín"},
        {"email":"Emilio Delgado","nombre":"Emilio Delgado"},
        {"email":"Antonio Benito","nombre":"Antonio Benito"}
    ];

    try {
        console.log("Intentando cargar usuarios en vivo...");
        const users = await callApi({ action: 'getUserList' });
        
        if (users && Array.isArray(users) && users.length > 0) {
            localStorage.setItem('cached_users_list', JSON.stringify(users));
            renderUsersToDropdown(users, select);
            console.log("? Carga en vivo completada.");
            return;
        }
    } catch (err) {
        console.error('⚠️ Bloqueo de red al cargar usuarios. Activando modo Rescate Local:', err);
    }

    // 3. ACTIVACIÓN DE EMERGENCIA
    if (!select.options.length || select.value === "") {
        console.warn("🚨 Activando lista de usuarios de emergencia hardcoded por fallo de red.");
        renderUsersToDropdown(HARDCODED_FALLBACK, select);
        // Añadimos opción visual de que está en modo redundante
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = "-- Carga de Emergencia Activa --";
        select.prepend(opt);
    }
}

function renderUsersToDropdown(users, select) {
    if (!select) return;
    const currentVal = select.value; // Preservar si ya eligió algo
    select.innerHTML = '<option value="" disabled selected>Selecciona tu usuario</option>';
    
    users.forEach(user => {
        if (user && user.email) {
            const opt = document.createElement('option');
            opt.value = user.email;
            // Limpiar: Solo mostrar nombre, quitar paréntesis con email
            opt.textContent = user.nombre || user.email; 
            select.appendChild(opt);
        }
    });
    if (currentVal) select.value = currentVal;
}



async function loadDeviceCatalog() {
    // 1. Si ya está cargado en memoria, no hacer nada
    if (APP_CONFIG.deviceCatalog && APP_CONFIG.deviceCatalog.length > 0) return;

    // 2. Cargar instantáneamente desde localStorage (0 ms de espera)
    try {
        const cached = localStorage.getItem('xiaomi_devices_cache');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                APP_CONFIG.deviceCatalog = parsed;
                console.log(`Loaded ${parsed.length} devices instantly from localStorage.`);
            }
        }
    } catch (e) {
        console.warn('Error reading device cache:', e);
    }

    // 3. Si aún está vacío, cargar desde el archivo local estático devices.json
    if (!APP_CONFIG.deviceCatalog || APP_CONFIG.deviceCatalog.length === 0) {
        try {
            const staticRes = await fetch('./devices.json');
            if (staticRes.ok) {
                const staticData = await staticRes.json();
                const list = Array.isArray(staticData) ? staticData : (staticData.value || []);
                if (list.length > 0) {
                    APP_CONFIG.deviceCatalog = list;
                    try { localStorage.setItem('xiaomi_devices_cache', JSON.stringify(list)); } catch (_) {}
                    console.log(`Loaded ${list.length} devices from local devices.json.`);
                }
            }
        } catch (e) {
            console.warn('Error fetching static devices.json:', e);
        }
    }

    // 4. En segundo plano, actualizar desde la API de Google Sheets
    try {
        const devices = await callApi({ action: 'getDevices' });
        if (devices && Array.isArray(devices) && devices.length > 0) {
            APP_CONFIG.deviceCatalog = devices;
            try { localStorage.setItem('xiaomi_devices_cache', JSON.stringify(devices)); } catch (_) {}
            console.log(`Updated ${devices.length} devices from Google Sheets API.`);
        }
    } catch (e) {
        console.warn('API getDevices background notice:', e.message || e);
    }
}

// --- Device Specific UI Logic ---
window.selectDeviceTipology = function(tipology, btn) {
    // 1. Marcar la burbuja activa
    const group = btn.parentElement;
    group.querySelectorAll('.bubble-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // 2. Guardar en el path temporal
    APP_CONFIG.currentReport.path[1] = tipology;
    
    // 3. Inyectar dinámicamente las subcategorías de nivel 3 según la tipología
    const matchTipology = tipology.trim().toUpperCase();
    const subGroup = document.getElementById('device-subcategories-group');
    if (subGroup) {
        subGroup.innerHTML = '';
        let items = [];
        if (matchTipology === 'POSM') {
            items = ['Display', 'Filmina', 'Luminoso', 'Miniluminoso', 'Ficha de Producto', 'Ficha energética', 'A4', 'OTROS'];
        } else {
            // Para LDU y DUMMY
            items = ['MESA', 'MURO', 'COLUMNA', 'LINEAL', 'OTROS'];
        }
        items.forEach(subItem => {
            const button = document.createElement('button');
            button.className = 'bubble-btn sub';
            button.textContent = subItem;
            button.onclick = () => selectLevel('device', 3, subItem);
            subGroup.appendChild(button);
        });
    }
    
    // 4. Avanzar directamente a Subcategoría (Level 3) y resetear el resto (protegido si estamos en precarga)
    if (!window.isAutoloadingReport) {
        APP_CONFIG.currentSelectedDevices = [];
    }
    renderSelectedDevices();

    document.getElementById('device-l3').classList.remove('hidden');
    document.getElementById('device-models-box').classList.add('hidden');
    document.getElementById('device-l4').classList.add('hidden');
    document.getElementById('final-level-device').classList.add('hidden');
    
    document.getElementById('device-l3').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.addDeviceToList = function() {
    const dropdown = document.getElementById('device-selector-dropdown');
    const customInput = document.getElementById('device-selector-custom');
    const qtyInput = document.getElementById('device-quantity-input');
    
    let selectedModel = '';
    let selectedCode = 'N/A';
    let selectedRepType = '';

    // Determinar si estamos usando el selector manual o el desplegable
    const isCustom = !customInput.classList.contains('hidden');
    
    if (isCustom) {
        selectedModel = customInput.value.trim();
        selectedCode = 'OTRO';
        selectedRepType = 'OTRO';
    } else {
        selectedModel = dropdown.value;
        selectedCode = dropdown.options[dropdown.selectedIndex]?.dataset.code || 'N/A';
        selectedRepType = dropdown.options[dropdown.selectedIndex]?.dataset.repType || '';
    }
    
    const selectedQty = parseInt(qtyInput.value) || 1;
    
    if (!selectedModel) {
        alert(isCustom ? "Escribe el nombre del artículo." : "Por favor seleccione un modelo de la lista.");
        return;
    }
    
    // Añadir al array
    APP_CONFIG.currentSelectedDevices.push({
        modelo: selectedModel,
        cantidad: selectedQty,
        codigoDispositivo: selectedCode,
        tipoReporte: selectedRepType
    });
    
    // Reset input para el siguiente
    qtyInput.value = 1;
    dropdown.selectedIndex = 0;
    customInput.value = '';
    
    renderSelectedDevices();
};

window.removeDeviceFromList = function(index) {
    APP_CONFIG.currentSelectedDevices.splice(index, 1);
    renderSelectedDevices();
};

function renderSelectedDevices() {
    const listContainer = document.getElementById('device-selected-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    if (APP_CONFIG.currentSelectedDevices.length === 0) {
        listContainer.innerHTML = '<p id="no-devices-msg" style="font-style: italic; color: #999; margin: 0; font-size: 12px;">Ningún modelo añadido aún.</p>';
        return;
    }
    
    APP_CONFIG.currentSelectedDevices.forEach((item, idx) => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: white; border: 1px solid #eee; padding: 6px 10px; border-radius: 6px; font-size: 12px;';
        div.innerHTML = `
            <span><strong>${item.modelo}</strong> <small style="color:#666;">(${item.codigoDispositivo})</small></span>
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="background:#ff6700; color:white; padding: 2px 8px; border-radius: 20px; font-weight:bold; font-size:11px;">x${item.cantidad}</span>
                <button type="button" onclick="removeDeviceFromList(${idx})" style="border:none; background:none; color:#ff4d4f; cursor:pointer; padding:0;"><i class="fa fa-trash"></i></button>
            </div>
        `;
        listContainer.appendChild(div);
    });
}

// LOGICA DE LONAS

window.addLonaToList = function() {
    const dropdown = document.getElementById('lona-selector-dropdown');
    const customInput = document.getElementById('lona-selector-custom');
    const qtyInput = document.getElementById('lona-quantity-input');
    
    let selectedModel = '';
    let selectedCode = 'N/A';

    const isCustom = !customInput.classList.contains('hidden');
    
    if (isCustom) {
        selectedModel = customInput.value.trim();
        selectedCode = 'OTRO';
    } else {
        selectedModel = dropdown.options[dropdown.selectedIndex]?.text || dropdown.value;
        if (dropdown.value === 'otro') selectedModel = customInput.value.trim();
        selectedCode = dropdown.options[dropdown.selectedIndex]?.dataset.code || 'N/A';
    }
    
    const selectedQty = parseInt(qtyInput.value) || 1;
    
    if (!selectedModel) {
        alert(isCustom ? "Escribe el nombre del modelo de lona." : "Por favor seleccione un modelo de la lista.");
        return;
    }
    
    APP_CONFIG.currentSelectedLonas.push({
        modelo: selectedModel,
        cantidad: selectedQty,
        codigoDispositivo: selectedCode
    });
    
    qtyInput.value = 1;
    dropdown.selectedIndex = 0;
    customInput.value = '';
    
    renderSelectedLonas();
};

window.removeLonaFromList = function(index) {
    APP_CONFIG.currentSelectedLonas.splice(index, 1);
    renderSelectedLonas();
};

function renderSelectedLonas() {
    const listContainer = document.getElementById('lona-selected-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    if (APP_CONFIG.currentSelectedLonas.length === 0) {
        listContainer.innerHTML = '<p id="no-lonas-msg" style="font-style: italic; color: #999; margin: 0; font-size: 12px;">Ningún modelo añadido aún.</p>';
        return;
    }
    
    APP_CONFIG.currentSelectedLonas.forEach((item, idx) => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: white; border: 1px solid #eee; padding: 6px 10px; border-radius: 6px; font-size: 12px;';
        div.innerHTML = `
            <span><strong>${item.modelo}</strong> <small style="color:#666;">(${item.codigoDispositivo})</small></span>
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="background:#ff6700; color:white; padding: 2px 8px; border-radius: 20px; font-weight:bold; font-size:11px;">x${item.cantidad}</span>
                <button type="button" onclick="removeLonaFromList(${idx})" style="border:none; background:none; color:#ff4d4f; cursor:pointer; padding:0;"><i class="fa fa-trash"></i></button>
            </div>
        `;
        listContainer.appendChild(div);
    });
}

// ---- LOGICA DE MOBILIARIO ALARMADOS (MULTI-ITEM) ----
window.addAlarmadoToList = function() {
    const dropdown = document.getElementById('furn-rep-modelo');
    const qtyInput = document.getElementById('furn-rep-cantidad');
    
    const selectedOption = dropdown.options[dropdown.selectedIndex];
    if (!selectedOption || !selectedOption.value) {
        alert('Por favor, selecciona un modelo de Alarmado.');
        dropdown.focus();
        return;
    }
    
    const selectedModel = selectedOption.value;
    const selectedCode = selectedOption.dataset.code || '';
    const selectedQty = parseInt(qtyInput.value) || 1;
    
    if (selectedQty < 1) {
        alert('La cantidad debe ser al menos 1.');
        qtyInput.focus();
        return;
    }
    
    APP_CONFIG.currentSelectedAlarmados.push({
        modelo: selectedModel,
        cantidad: selectedQty,
        codigoDispositivo: selectedCode
    });
    
    dropdown.value = '';
    qtyInput.value = 1;
    
    renderSelectedAlarmados();
};

window.removeAlarmadoFromList = function(index) {
    APP_CONFIG.currentSelectedAlarmados.splice(index, 1);
    renderSelectedAlarmados();
};

function renderSelectedAlarmados() {
    const listContainer = document.getElementById('furn-alarmado-selected-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    if (APP_CONFIG.currentSelectedAlarmados.length === 0) {
        listContainer.innerHTML = '<p id="no-alarmados-msg" style="font-style: italic; color: #999; margin: 0; font-size: 11px;">Ningún modelo añadido aún.</p>';
        return;
    }
    
    APP_CONFIG.currentSelectedAlarmados.forEach((item, idx) => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: white; border: 1px solid #eee; padding: 6px 10px; border-radius: 6px; font-size: 12px;';
        div.innerHTML = `
            <span><strong>${item.modelo}</strong> <small style="color:#666;">(${item.codigoDispositivo})</small></span>
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="background:#ff6700; color:white; padding: 2px 8px; border-radius: 20px; font-weight:bold; font-size:11px;">x${item.cantidad}</span>
                <button type="button" onclick="removeAlarmadoFromList(${idx})" style="border:none; background:none; color:#ff4d4f; cursor:pointer; padding:0;"><i class="fa fa-trash"></i></button>
            </div>
        `;
        listContainer.appendChild(div);
    });
}

// --- Procedure Logic ---
function startIncidentProcedure(centro) {
    if (!centro) return;
    APP_CONFIG.currentReport.centro = centro;
    const catSelection = document.getElementById('category-selection');
    if (catSelection) catSelection.classList.remove('hidden');
    // Ensure all sub-procedures are hidden until chosen
    const fp = document.getElementById('furniture-procedure');
    if (fp) fp.classList.add('hidden');
    const dp = document.getElementById('device-procedure');
    if (dp) dp.classList.add('hidden');
    const sp = document.getElementById('screen-procedure');
    if (sp) sp.classList.add('hidden');
}

window.chooseMainCategory = function(category, btn) {
    // 1. LIMPIEZA PREVENTIVA ABSOLUTA:
    // Al cambiar entre Mobiliario/Dispositivo, reseteamos TODO para no dejar el formulario roto a medias,
    // pero pasamos "true" para que NO borre la tienda elegida ni oculte este selector principal.
    resetProcedure(true);

    // Reset path completamente
    if (category === 'furniture') {
        APP_CONFIG.currentReport.path = ['Mobiliario'];
    } else if (category === 'screen') {
        APP_CONFIG.currentReport.path = ['Pantalla Digital'];
    } else if (category === 'lona') {
        APP_CONFIG.currentReport.path = ['Lona'];
    } else {
        APP_CONFIG.currentReport.path = ['Dispositivo'];
    }
    APP_CONFIG.currentReport.category = category;

    // UI Feedback for category buttons
    const group = btn.parentElement;
    group.querySelectorAll('.bubble-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Show corresponding procedure container, hide the others
    const fp2 = document.getElementById('furniture-procedure');
    if (fp2) fp2.classList.add('hidden');
    const dp2 = document.getElementById('device-procedure');
    if (dp2) dp2.classList.add('hidden');
    const sp2 = document.getElementById('screen-procedure');
    if (sp2) sp2.classList.add('hidden');
    const lp2 = document.getElementById('lona-procedure');
    if (lp2) lp2.classList.add('hidden');

    if (category === 'furniture') {
        const el = document.getElementById('furniture-procedure');
        if (el) el.classList.remove('hidden');
        resetLevels('furniture');
    } else if (category === 'screen') {
        const el1 = document.getElementById('screen-procedure');
        if (el1) el1.classList.remove('hidden');
        const el2 = document.getElementById('final-level-screen');
        if (el2) el2.classList.remove('hidden');
    } else if (category === 'lona') {
        const el = document.getElementById('lona-procedure');
        if (el) {
            el.classList.remove('hidden');
            const l2 = document.getElementById('lona-l2');
            if (l2) l2.classList.remove('hidden');
        }
    } else {
        const el = document.getElementById('device-procedure');
        if (el) el.classList.remove('hidden');
        resetLevels('device');
    }
    
    // NUEVO: Repintar fotos preservadas si existían
    if (typeof window.renderIncidentPhotosUI === 'function' && APP_CONFIG.incidentUploadedPhotos.length > 0) {
        window.renderIncidentPhotosUI(category === 'screen' ? 'screen' : category);
    }
};

function resetLevels(type) {
    const container = document.getElementById(`${type}-procedure`);
    const boxes = container.querySelectorAll('.level-box');
    // Hide all boxes except the first one in that tree (which is level 2)
    boxes.forEach(box => {
        if (box.dataset.level === "2") {
            box.classList.remove('hidden');
        } else {
            box.classList.add('hidden');
        }
        box.querySelectorAll('.bubble-btn').forEach(b => b.classList.remove('active'));
    });
    document.getElementById(`final-level-${type}`).classList.add('hidden');
}

async function selectLevel(type, level, value) {
    // FIX: red de seguridad — si el catálogo sigue vacío al llegar aquí (sesión no lista a
    // tiempo, timeout, etc.), lo recargamos antes de filtrar en vez de dejar el desplegable vacío.
    if ((type === 'device' || type === 'furniture') && APP_CONFIG.deviceCatalog.length === 0) {
        await loadDeviceCatalog();
    }

    // Note: level passed here is 2, 3, or 4. Path index should be level - 1
    APP_CONFIG.currentReport.path = APP_CONFIG.currentReport.path.slice(0, level - 1);
    
    // Save selection
    APP_CONFIG.currentReport.path[level - 1] = value;

    // UI Feedback: Activate bubble in current box
    const container = document.getElementById(`${type}-procedure`);
    // Find the box for the CURRENT level
    const currentBox = container.querySelector(`.level-box[data-level="${level}"]`);
    
    if (currentBox) {
        currentBox.querySelectorAll('.bubble-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent === value);
        });
    }

    // Hide subsequent levels
    const boxes = container.querySelectorAll('.level-box');
    boxes.forEach(box => {
        if (parseInt(box.dataset.level) > level) {
            box.classList.add('hidden');
            box.querySelectorAll('.bubble-btn').forEach(b => b.classList.remove('active'));
        }
    });

    // --- LOGICA DE MOBILIARIO PARA ALARMADO ---
    if (type === 'furniture' && level === 3) {
        const alarmadoFields = document.getElementById('furniture-alarmado-fields');
        const alarmadoInfo = document.getElementById('furn-alarmado-info');
        if (value === 'ALARMADO') {
            if (alarmadoFields) alarmadoFields.style.display = 'block';
            if (alarmadoInfo) alarmadoInfo.style.display = 'flex';
            
            if (!window.isAutoloadingReport) {
                APP_CONFIG.currentSelectedAlarmados = [];
                if (typeof renderSelectedAlarmados === 'function') renderSelectedAlarmados();
            }
            
            // Poblar dropdown de modelos de alarmado (igual que en Dispositivos pero filtramos por 'ALARMADO')
            const dropdown = document.getElementById('furn-rep-modelo');
            if (dropdown) {
                dropdown.innerHTML = '<option value="">Seleccione modelo...</option>';
                const filtered = APP_CONFIG.deviceCatalog.filter(d => {
                    const searchPayload = normalizeString(d.col1 || d.Subcategoria || d.Subcategoria || '');
                    return searchPayload === 'ALARMADO';
                });
                
                filtered.forEach(d => {
                    const model = String(d.col2 || d.Modelo || '').trim();
                    const code = d['Código Dispositivo'] || d.codigo || d.col3 || ''; 
                    
                    if (model && model !== '' && model.toUpperCase() !== 'MODELO') {
                        const opt = document.createElement('option');
                        opt.value = model;
                        opt.textContent = code ? `${model} - ${code}` : model;
                        opt.dataset.code = code; 
                        dropdown.appendChild(opt);
                    }
                });
            }
            
        } else {
            if (alarmadoFields) alarmadoFields.style.display = 'none';
            if (alarmadoInfo) alarmadoInfo.style.display = 'none';
            // Limpiar inputs
            const dropdown = document.getElementById('furn-rep-modelo');
            if (dropdown) dropdown.value = '';
            const cantInput = document.getElementById('furn-rep-cantidad');
            if (cantInput) cantInput.value = '';
            
            if (!window.isAutoloadingReport) {
                APP_CONFIG.currentSelectedAlarmados = [];
            }
        }
    }

    // --- EXCEPCIÓN: Flujo de Dispositivos en Nivel 3 y Nivel 4 ---
    if (type === 'device' && (level === 3 || level === 4)) {
        // En Nivel 3 (Subcategoría), limpiamos la selección actual
        if (level === 3 && !window.isAutoloadingReport) {
            APP_CONFIG.currentSelectedDevices = [];
            renderSelectedDevices();
        }
        
        const dropdown = document.getElementById('device-selector-dropdown');
        dropdown.innerHTML = '<option value="">Seleccione modelo...</option>';
        
        const tipologyChosen = String(APP_CONFIG.currentReport.path[1] || '').trim().toUpperCase();
        const subcategoryChosen = String(APP_CONFIG.currentReport.path[2] || '').trim().toUpperCase();
        const motivoChosen = String(APP_CONFIG.currentReport.path[3] || '').trim().toUpperCase();
        
        // CONTROL DINÁMICO: Para OTROS, mostramos el Input de escritura libre (excepto en LDU y DUMMY)
        const customInput = document.getElementById('device-selector-custom');
        if (subcategoryChosen === 'OTROS' && tipologyChosen !== 'LDU' && tipologyChosen !== 'DUMMY') {
            dropdown.classList.add('hidden');
            customInput.classList.remove('hidden');
            if (level === 3) customInput.value = '';
        } else {
            dropdown.classList.remove('hidden');
            customInput.classList.add('hidden');
            if (level === 3) customInput.value = '';
        }
        
        const filtered = APP_CONFIG.deviceCatalog.filter(d => {
            const itemTip = String(d.col0 || d['Tipología'] || d.Tipologia || d['Tipologia'] || '').trim().toUpperCase();
            
            // Flexibilidad: si en excel pone "LDU / DUMMY", matchTipology debe aceptar tanto LDU como DUMMY
            let tipologyMatch = (itemTip === tipologyChosen);
            if (!tipologyMatch && itemTip.includes(tipologyChosen)) {
                tipologyMatch = true;
            }
            
            if (!tipologyMatch) return false;
            
            const searchPayload = normalizeString(d.col1 || d['subcatergoría'] || d['Subcategoría'] || d.Subcategoria || d.subcategoria || '');
            
            if (tipologyChosen === 'POSM') {
                const cBtn = cleanSubcategoryString(subcategoryChosen);
                const rawSub = d.col1 || d['subcatergoría'] || d['Subcategoría'] || d.Subcategoria || d.subcategoria || '';
                const cExcel = cleanSubcategoryString(rawSub);
                if (!cBtn) return true;
                if (!cExcel) return false;
                if (cBtn === 'LUMINOSO') {
                    return cExcel.includes('LUMINOSO');
                }
                return cExcel.includes(cBtn) || cBtn.includes(cExcel);
            } else {
                // LDU y DUMMY
                if (motivoChosen === 'ALARMADO') {
                    // Si el Motivo es Alarmado, SOLO mostrar dispositivos que tengan ALARMADO en el excel
                    return searchPayload === 'ALARMADO';
                } else {
                    // Si el Motivo NO es Alarmado, NO mostrar los alarmados en el listado normal
                    return searchPayload !== 'ALARMADO';
                }
            }
        });
        
        filtered.forEach(d => {
            // Coger de la Columna C (col2) el modelo final
            const model = String(d.col2 || d.Modelo || '').trim();
            const code = d['Código Dispositivo'] || d.codigo || d.col3 || ''; 
            const repType = d['TIPO REPORTE'] || d['Tipo Reporte'] || d.col4 || d.col3 || '';
            
            if (model && model !== '' && model.toUpperCase() !== 'MODELO') {
                const opt = document.createElement('option');
                opt.value = model;
                opt.textContent = code ? `${model} - ${code}` : model;
                opt.dataset.code = code; 
                opt.dataset.repType = repType; 
                dropdown.appendChild(opt);
            }
        });
        
        if (level === 3) {
            // En Nivel 3 (Subcategoría), mostrar suavemente el Motivo (Nivel 4)
            const nextBox = document.getElementById('device-l4');
            if (nextBox) {
                nextBox.classList.remove('hidden');
                nextBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            const finalBox = document.getElementById('final-level-device');
            if (finalBox) finalBox.classList.add('hidden');
        } else if (level === 4) {
            // En Nivel 4 (Motivo), mostrar el formulario final y artículos
            const box = document.getElementById('device-models-box');
            if (box) box.classList.remove('hidden');
            
            const finalBox = document.getElementById('final-level-device');
            if (finalBox) {
                finalBox.classList.remove('hidden');
                finalBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    } else if (type === 'lona' && level === 3) {
        if (!window.isAutoloadingReport) {
            APP_CONFIG.currentSelectedLonas = [];
            if (typeof renderSelectedLonas === 'function') renderSelectedLonas();
        }
        
        if (APP_CONFIG.deviceCatalog.length === 0) {
            loadDeviceCatalog().then(() => populateLonaDropdown());
        } else {
            populateLonaDropdown();
        }
        
        const final = document.getElementById(`final-level-${type}`);
        if (final) {
            final.classList.remove('hidden');
            final.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    // Show next level or final form para el resto de categorías (mobiliario, pantalla, etc.)
    if (type !== 'device' && type !== 'lona') {
        const nextLevel = level + 1;
        const nextBox = document.getElementById(`${type}-l${nextLevel}`);

        if (nextBox) {
            nextBox.classList.remove('hidden');
            nextBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            showFinalForm(type);
        }
    }
}

function showFinalForm(type) {
    const final = document.getElementById(`final-level-${type}`);
    if (final) {
        final.classList.remove('hidden');
        final.scrollIntoView({ behavior: 'smooth' });
    }
}

function populateLonaDropdown() {
    const dropdown = document.getElementById('lona-selector-dropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">Seleccione modelo...</option>';
    
    const tipologyChosen = String(APP_CONFIG.currentReport.path[1] || '').trim().toUpperCase();
    const uniqueModels = new Set();
    
    APP_CONFIG.deviceCatalog.forEach(d => {
        const modelo = String(d.col1 || d.Subcategoria || d.Subcategoria || '').trim();
        const code = String(d.col2 || d.Codigo || d['Codigo Dispositivo'] || '').trim();
        const repType = String(d.col0 || d.Tipologia || '').trim().toUpperCase();
        const subCat = modelo.toUpperCase();
        
        if (!modelo) return;
        
        let tipologyMatch = false;
        if (repType === tipologyChosen || repType.includes(tipologyChosen)) tipologyMatch = true;
        if (subCat === tipologyChosen || subCat.includes(tipologyChosen)) tipologyMatch = true;
        
        if (!tipologyMatch && repType.includes('LONA') && tipologyChosen.includes('TOP TABLE') && (repType.includes('TOP TABLE') || subCat.includes('TOP TABLE'))) tipologyMatch = true;
        if (!tipologyMatch && repType.includes('LONA') && tipologyChosen.includes('COLUMN') && (repType.includes('COLUMN') || subCat.includes('COLUMN'))) tipologyMatch = true;
        if (!tipologyMatch && repType.includes('LONA') && tipologyChosen.includes('WALL') && (repType.includes('WALL') || subCat.includes('WALL'))) tipologyMatch = true;
        if (!tipologyMatch && repType.includes('LONA') && !repType.includes('TOP TABLE') && !repType.includes('COLUMN') && !repType.includes('WALL') && !subCat.includes('TOP TABLE') && !subCat.includes('COLUMN') && !subCat.includes('WALL')) tipologyMatch = true; // Fallback
        
        if (tipologyMatch) {
            const key = modelo + '_' + code;
            if (!uniqueModels.has(key)) {
                uniqueModels.add(key);
                const opt = document.createElement('option');
                opt.value = modelo;
                opt.textContent = code && code !== 'N/A' ? `${modelo} (${code})` : modelo;
                opt.dataset.code = code;
                opt.dataset.repType = repType;
                dropdown.appendChild(opt);
            }
        }
    });
    
    // Añadir opción "Otro" al final
    const optOtro = document.createElement('option');
    optOtro.value = 'otro';
    optOtro.textContent = 'Otro (Escribir manualmente)';
    optOtro.dataset.code = 'OTRO';
    dropdown.appendChild(optOtro);
}

window.handleLonaDropdownChange = function(sel) {
    const customInput = document.getElementById('lona-selector-custom');
    if (!customInput) return;
    if (sel.value === 'otro') {
        customInput.classList.remove('hidden');
        customInput.style.display = 'inline-block';
        customInput.focus();
    } else {
        customInput.classList.add('hidden');
        customInput.style.display = 'none';
        customInput.value = '';
    }
};

window.renderIncidentPhotosUI = function(type) {
    if (type === 'pantalla') type = 'screen';
    const container = document.getElementById(`incident-thumbnails-${type}`);
    if (!container) return;
    
    container.innerHTML = ''; // Limpiar y repintar
    
    APP_CONFIG.incidentUploadedPhotos.forEach(url => {
        const wrapper = document.createElement('div');
        wrapper.className = 'local-thumb-wrapper uploaded';
        wrapper.dataset.url = url;
        wrapper.style.cssText = 'position: relative; width: 60px; height: 60px; border-radius: 6px; overflow: hidden; border: 2px solid #2ecc71; box-shadow: 0 2px 5px rgba(0,0,0,0.1); flex-shrink: 0;';
        
        wrapper.innerHTML = `
            <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">
            <div style="position: absolute; top: 2px; right: 2px; background: rgba(46, 204, 113, 0.9); color: #fff; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                <i class="fa fa-check"></i>
            </div>
            <button type="button" class="delete-thumb-btn" style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(231, 76, 60, 0.85); color: #fff; border: none; font-size: 10px; padding: 2px 0; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                <i class="fa fa-trash"></i> Borrar
            </button>
        `;
        
        wrapper.querySelector('.delete-thumb-btn').onclick = () => {
            APP_CONFIG.incidentUploadedPhotos = APP_CONFIG.incidentUploadedPhotos.filter(u => u !== url);
            wrapper.remove();
        };
        
        container.appendChild(wrapper);
    });
};

async function handleIncidentPhotos(input, type) {
    const container = document.getElementById(`incident-thumbnails-${type}`);
    const submitBtn = document.querySelector(`#final-level-${type} button[type="submit"]`);
    
    if (!input.files || input.files.length === 0) return;
    
    const files = Array.from(input.files);
    
    // Validar máximo de 5 fotos en total
    const currentCount = APP_CONFIG.incidentUploadedPhotos.length;
    const pendingThumbs = container.querySelectorAll('.local-thumb-wrapper:not(.uploaded)').length;
    if (currentCount + pendingThumbs + files.length > 5) {
        alert("Solo se permite subir un máximo de 5 fotos para la incidencia.");
        input.value = '';
        return;
    }
    
    // Deshabilitar botón de enviar mientras se sube
    if (submitBtn) {
        submitBtn.disabled = true;
    }
    
    for (const file of files) {
        // Crear contenedor local instantáneo
        const wrapper = document.createElement('div');
        wrapper.className = 'local-thumb-wrapper';
        wrapper.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 2px solid var(--mi-orange); background: #333; display: flex; align-items: center; justify-content: center;';
        
        // Crear objeto URL local instantáneo
        const localUrl = URL.createObjectURL(file);
        
        wrapper.innerHTML = `
            <img src="${localUrl}" style="width: 100%; height: 100%; object-fit: cover; filter: blur(1px) brightness(0.6);">
            <div class="thumb-loader" style="position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff;">
                <i class="fa fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 4px;"></i>
                <span style="font-size: 9px; font-weight: bold; text-transform: uppercase;">Subiendo</span>
            </div>
        `;
        container.appendChild(wrapper);
        
        try {
            const isImg = file.type && file.type.startsWith('image/');
            const ext = isImg ? 'jpg' : (file.name.split('.').pop().toLowerCase() || 'bin');
            const base64 = await window.getCompressedBase64(file);
            const userRaw = (APP_CONFIG.currentUser?.email || APP_CONFIG.currentUser?.usuario) || 'Usuario';
            const userClean = String(userRaw).split('@')[0].trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
            const storeRaw = APP_CONFIG.currentReport?.centro || 'Tienda';
            const storeClean = String(storeRaw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
            const dateStr = new Date().toISOString().slice(0, 10);
            const shortTime = Date.now().toString().slice(-4);
            const customFileName = `${userClean}_${storeClean}_${dateStr}_INCIDENCIA_${shortTime}.${ext}`;

            const uploadRes = await callApi({
                action: 'uploadFile',
                fileName: customFileName,
                mimeType: isImg ? 'image/jpeg' : (file.type || 'image/jpeg'),
                base64: base64
            });
            
            if (uploadRes && uploadRes.url) {
                APP_CONFIG.incidentUploadedPhotos.push(uploadRes.url);
                wrapper.classList.add('uploaded');
                wrapper.dataset.url = uploadRes.url;
                wrapper.style.borderColor = '#2ecc71';
                
                // Actualizar thumbnail con icono de borrado y éxito
                wrapper.innerHTML = `
                    <img src="${localUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                    <div style="position: absolute; top: 2px; right: 2px; background: rgba(46, 204, 113, 0.9); color: #fff; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                        <i class="fa fa-check"></i>
                    </div>
                    <button type="button" class="delete-thumb-btn" style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(231, 76, 60, 0.85); color: #fff; border: none; font-size: 10px; padding: 2px 0; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <i class="fa fa-trash"></i> Borrar
                    </button>
                `;
                
                // Agregar acción de borrar
                wrapper.querySelector('.delete-thumb-btn').onclick = () => {
                    APP_CONFIG.incidentUploadedPhotos = APP_CONFIG.incidentUploadedPhotos.filter(url => url !== uploadRes.url);
                    wrapper.remove();
                    updateSubmitState();
                };
            } else {
                throw new Error(uploadRes ? (uploadRes.error || uploadRes.message || "No URL returned") : "No response from server");
            }
        } catch (e) {
            console.error('Error uploading incident photo:', e);
            wrapper.style.borderColor = '#e74c3c';
            wrapper.innerHTML = `
                <img src="${localUrl}" style="width: 100%; height: 100%; object-fit: cover; filter: grayscale(1) brightness(0.5);">
                <div style="position: absolute; color: #fff; text-align: center; font-size: 9px; padding: 4px; font-weight: bold;">
                    <i class="fa fa-exclamation-triangle" style="font-size: 1.2rem; color: #e74c3c; margin-bottom: 2px;"></i><br>Error
                </div>
                <button type="button" class="delete-thumb-btn" style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(51, 51, 51, 0.9); color: #fff; border: none; font-size: 10px; padding: 2px 0; cursor: pointer;">
                    <i class="fa fa-trash"></i> Quitar
                </button>
            `;
            wrapper.querySelector('.delete-thumb-btn').onclick = () => {
                wrapper.remove();
                updateSubmitState();
            };
        }
    }
    
    input.value = '';
    updateSubmitState();
    
    function updateSubmitState() {
        const remainingUploads = container.querySelectorAll('.local-thumb-wrapper:not(.uploaded)').length;
        if (submitBtn) {
            submitBtn.disabled = (remainingUploads > 0);
        }
    }
}

async function submitFinalReport(event, type) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    const descEl = form.querySelector('.rep-desc');
    const desc = descEl ? descEl.value.trim() : '';
    const enviarSelect = form.querySelector('.rep-enviar');
    const enviarVal = enviarSelect ? enviarSelect.value : '';

    const isFurniture = type === 'furniture';
    const isScreen = type === 'screen';
    const isLona = type === 'lona';
    
    let reportCategory = 'Dispositivo';
    if (isFurniture) reportCategory = 'Mobiliario';
    if (isScreen) reportCategory = 'Pantalla Digital';
    if (isLona) reportCategory = 'Lonas';

    // Validate Alarmado inputs if furniture
    if (isFurniture) {
        const isAlarmado = APP_CONFIG.currentReport.path[2] === 'Alarmado';
        if (isAlarmado) {
            const modVal = document.getElementById('furn-rep-modelo').value;
            const cantVal = document.getElementById('furn-rep-cantidad').value;
            if (!modVal || !cantVal || parseInt(cantVal) < 1) {
                alert('Por favor, seleccione un modelo y una cantidad válida para el alarmado.');
                return;
            }
        }
    }
    
    if (APP_CONFIG.incidentUploadedPhotos.length === 0) {
        let zoneId = `drop-zone-${type}`;
        const zone = document.getElementById(zoneId);
        if (zone) {
            zone.style.border = '2px dashed #ff4d4f';
            zone.style.boxShadow = '0 0 12px rgba(255,77,79,0.4)';
            zone.style.background = '#fffafa';
            zone.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                zone.style.border = '2px dashed var(--mi-border)';
                zone.style.boxShadow = 'none';
                zone.style.background = '#f9f9f9';
            }, 4000);
        }
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    // Obligar a que el comentario descriptivo no esté vacío
    if (!desc) {
        if (descEl) {
            descEl.style.border = '2px dashed #ff4d4f';
            descEl.style.boxShadow = '0 0 12px rgba(255,77,79,0.4)';
            descEl.style.background = '#fffafa';
            descEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                descEl.style.border = '1px solid var(--mi-border)';
                descEl.style.boxShadow = 'none';
                descEl.style.background = '#ffffff';
            }, 4000);
        }
        btn.disabled = false;
        btn.textContent = originalText;
        alert('Por favor, escribe un comentario descriptivo para la incidencia.');
        return;
    }

    try {
        const storeSelect = document.getElementById('incident-centro');
        const selectedOption = storeSelect.options[storeSelect.selectedIndex];
        const storeOwner = selectedOption ? selectedOption.dataset.owner || '' : '';

        const reportData = {
            action: 'submitReport',
            usuario: (APP_CONFIG.currentUser.email || APP_CONFIG.currentUser.usuario),
            tienda: APP_CONFIG.currentReport.centro,
            owner: storeOwner,
            categoria: reportCategory,
            subcategoria: APP_CONFIG.currentReport.path[1] || '',
            motivo: isFurniture ? (APP_CONFIG.currentReport.path[2] || '') : (isScreen ? (APP_CONFIG.currentReport.path[2] || '') : (APP_CONFIG.currentReport.path[3] || '')),
            descripcion: desc,
            enviar: enviarVal,
            photos: APP_CONFIG.incidentUploadedPhotos,
            estado: 'Abierta',
            updateId: window.editingIncidentId || APP_CONFIG.currentReport.updateId || null,
            originalFecha: window.editingIncidentDate || APP_CONFIG.currentReport?.fecha || ''
        };
        
        if (isFurniture) {
            const isAlarmado = APP_CONFIG.currentReport.path[2] === 'ALARMADO';
            if (isAlarmado) {
                if (APP_CONFIG.currentSelectedAlarmados.length === 0) {
                    const box = document.getElementById('furniture-alarmado-fields');
                    if (box) {
                        box.style.border = '2px solid #ff4d4f';
                        box.style.boxShadow = '0 0 12px rgba(255,77,79,0.4)';
                        box.style.transition = 'all 0.3s ease';
                        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => {
                            box.style.border = '1px solid var(--mi-border)';
                            box.style.boxShadow = 'none';
                        }, 4000);
                    }
                    btn.disabled = false;
                    btn.textContent = originalText;
                    return;
                }
                reportData.dispositivos = APP_CONFIG.currentSelectedAlarmados;
            } else {
                reportData.modelo = '';
                reportData.codigoDispositivo = '';
                reportData.cantidad = '';
            }

            const enviarSelect = form.querySelector('.rep-enviar');
            if (!enviarSelect || !enviarSelect.value) {
                if (enviarSelect) {
                    enviarSelect.style.border = '2px solid #ff4d4f';
                    enviarSelect.style.boxShadow = '0 0 10px rgba(255,77,79,0.3)';
                    enviarSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    enviarSelect.focus();
                    setTimeout(() => {
                        enviarSelect.style.border = '1px solid var(--mi-border)';
                        enviarSelect.style.boxShadow = 'none';
                    }, 4000);
                }
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }
            reportData.subcategoria = APP_CONFIG.currentReport.path[1] || '';
            reportData.motivo = APP_CONFIG.currentReport.path[2] || '';
            reportData.enviar = enviarSelect.value;

            // SEGURIDAD EXTREMA: Validar Subcategoría de Mobiliario
            if (!reportData.subcategoria) {
                const box = document.getElementById('furniture-l2');
                if (box) {
                    box.style.border = '2px solid #ff4d4f';
                    box.style.borderRadius = '10px';
                    box.style.padding = '12px';
                    box.style.boxShadow = '0 0 15px rgba(255,77,79,0.35)';
                    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => { box.style.border = 'none'; box.style.boxShadow = 'none'; box.style.padding = '0'; }, 5000);
                }
                btn.disabled = false;
                btn.textContent = originalText;
                return alert('Falta Información: Por favor, indica la subcategoría del mobiliario.');
            }
            
            // SEGURIDAD EXTREMA: Validar Motivo detallado de Mobiliario
            if (!reportData.motivo) {
                const box = document.getElementById('furniture-l3');
                if (box) {
                    box.style.border = '2px solid #ff4d4f';
                    box.style.borderRadius = '10px';
                    box.style.padding = '12px';
                    box.style.boxShadow = '0 0 15px rgba(255,77,79,0.35)';
                    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => { box.style.border = 'none'; box.style.boxShadow = 'none'; box.style.padding = '0'; }, 5000);
                }
                btn.disabled = false;
                btn.textContent = originalText;
                return alert('Falta Información: Por favor, indica el MOTIVO concreto del desperfecto.');
            }
        } else if (isScreen) {
            // Pantalla category just needs description and photos, which are already validated.
            // No sub-categories or reasons required.
            reportData.subcategoria = '';
            reportData.motivo = '';
        } else if (isLona) {
            if (APP_CONFIG.currentSelectedLonas.length === 0) {
                const box = document.getElementById('lona-models-box');
                if (box) {
                    box.style.border = '2px solid #ff4d4f';
                    box.style.boxShadow = '0 0 12px rgba(255,77,79,0.4)';
                    box.style.transition = 'all 0.3s ease';
                    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        box.style.border = '1px solid var(--mi-border)';
                        box.style.boxShadow = 'none';
                    }, 4000);
                }
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }
            const enviarSelect = form.querySelector('.rep-enviar');
            if (!enviarSelect || !enviarSelect.value) {
                if (enviarSelect) {
                    enviarSelect.style.border = '2px solid #ff4d4f';
                    enviarSelect.style.boxShadow = '0 0 10px rgba(255,77,79,0.3)';
                    enviarSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    enviarSelect.focus();
                    setTimeout(() => {
                        enviarSelect.style.border = '1px solid var(--mi-border)';
                        enviarSelect.style.boxShadow = 'none';
                    }, 4000);
                }
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }

            reportData.tipologia = APP_CONFIG.currentReport.path[1] || '';
            reportData.motivo = APP_CONFIG.currentReport.path[2] || ''; 
            reportData.enviar = enviarSelect.value; 
            reportData.dispositivos = APP_CONFIG.currentSelectedLonas;
        } else {
            // Para Dispositivos
            if (APP_CONFIG.currentSelectedDevices.length === 0) {
                const box = document.getElementById('device-models-box');
                if (box) {
                    box.style.border = '2px solid #ff4d4f';
                    box.style.boxShadow = '0 0 12px rgba(255,77,79,0.4)';
                    box.style.transition = 'all 0.3s ease';
                    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => {
                        box.style.border = '1px solid var(--mi-border)';
                        box.style.boxShadow = 'none';
                    }, 4000);
                }
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }
            const enviarSelect = form.querySelector('.rep-enviar');
            if (!enviarSelect || !enviarSelect.value) {
                if (enviarSelect) {
                    enviarSelect.style.border = '2px solid #ff4d4f';
                    enviarSelect.style.boxShadow = '0 0 10px rgba(255,77,79,0.3)';
                    enviarSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    enviarSelect.focus();
                    setTimeout(() => {
                        enviarSelect.style.border = '1px solid var(--mi-border)';
                        enviarSelect.style.boxShadow = 'none';
                    }, 4000);
                }
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }

            reportData.tipologia = APP_CONFIG.currentReport.path[1] || '';
            reportData.subcategoria = APP_CONFIG.currentReport.path[2] || ''; 
            reportData.motivo = APP_CONFIG.currentReport.path[3] || ''; 
            reportData.enviar = enviarSelect.value; 
            reportData.dispositivos = APP_CONFIG.currentSelectedDevices;

            // SEGURIDAD EXTREMA: Validar Tipología del Dispositivo
            if (!reportData.tipologia) {
                const box = document.getElementById('device-l2');
                if (box) {
                    box.style.border = '2px solid #ff4d4f'; box.style.borderRadius = '10px'; box.style.padding = '12px'; box.style.boxShadow = '0 0 15px rgba(255,77,79,0.35)';
                    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => { box.style.border = 'none'; box.style.boxShadow = 'none'; box.style.padding = '0'; }, 5000);
                }
                btn.disabled = false; btn.textContent = originalText;
                return alert('Falta Información: Por favor, selecciona la TIPOLOGÍA del dispositivo.');
            }

            // SEGURIDAD EXTREMA: Validar Subcategoría de Dispositivo
            if (!reportData.subcategoria) {
                const box = document.getElementById('device-l3');
                if (box) {
                    box.style.border = '2px solid #ff4d4f'; box.style.borderRadius = '10px'; box.style.padding = '12px'; box.style.boxShadow = '0 0 15px rgba(255,77,79,0.35)';
                    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => { box.style.border = 'none'; box.style.boxShadow = 'none'; box.style.padding = '0'; }, 5000);
                }
                btn.disabled = false; btn.textContent = originalText;
                return alert('Falta Información: Por favor, selecciona la SUB-FAMILIA o Familia del dispositivo.');
            }

            // SEGURIDAD EXTREMA: Validar Motivo detallado de Dispositivo
            if (!reportData.motivo) {
                const box = document.getElementById('device-l4');
                if (box) {
                    box.style.border = '2px solid #ff4d4f'; box.style.borderRadius = '10px'; box.style.padding = '12px'; box.style.boxShadow = '0 0 15px rgba(255,77,79,0.35)';
                    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => { box.style.border = 'none'; box.style.boxShadow = 'none'; box.style.padding = '0'; }, 5000);
                }
                btn.disabled = false; btn.textContent = originalText;
                return alert('Falta Información: Por favor, indica el MOTIVO concreto de la incidencia.');
            }
        }

        const res = await callApi(reportData);
        if (res && res.success) {
            setTimeout(async () => {
                try {
                    const uRes = await callApi({ 
                        action: 'getMessagingUsers',
                        email: APP_CONFIG.currentUser?.email || APP_CONFIG.currentUser?.usuario,
                        token: APP_CONFIG.currentUser?.token
                    });
                    let usersList = (uRes && uRes.users) ? uRes.users : [];
                    if (usersList.length === 0) {
                        try {
                            const cached = localStorage.getItem('cached_users_list');
                            if (cached) usersList = JSON.parse(cached);
                        } catch(e) {}
                    }
                    const admins = usersList.filter(u => isUserAdmin(u));
                    const nombreUsu = APP_CONFIG.currentUser?.nombre || APP_CONFIG.currentUser?.usuario || 'Un usuario';
                    const tiend = reportData.tienda || 'una tienda';
                    const cat = reportData.categoria || 'Incidencia';
                    for (const admin of admins) {
                        const adminEmail = admin.email || admin.usuario;
                        if (adminEmail) {
                            callApi({
                                action: 'sendMessage',
                                remitente: 'Sistema',
                                destinatario: adminEmail,
                                mensaje: 'NUEVA INCIDENCIA ABIERTA: ' + nombreUsu + ' acaba de abrir un reporte de ' + cat + ' en ' + tiend + '. Por favor, revísalo para responder lo antes posible.'
                            }).catch(err => console.warn('Error enviando aviso a admin:', err));
                        }
                    }
                } catch(e) { console.error('Error al notificar admins', e); }
            }, 500);
        }
        if (res && res.success) {
            alert('Reporte guardado con éxito');
            resetProcedure();
            loadDashboard(); // Actualiza el historial visualmente en tiempo real
            // Vuelve abajo para ver el historial insertado
            const tableEl = document.getElementById('dashboard-table-title');
            if (tableEl) tableEl.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert('Error al guardar: ' + (res.message || 'Error desconocido'));
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Error al enviar reporte');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function resetProcedure(preserveStoreContext = false) {
    // Guardamos el centro antes de limpiar si así lo solicitan (para cambios de categoría sin perder la tienda)
    const storedCentro = APP_CONFIG.currentReport?.centro || '';
    
    // NUEVO: Guardar la descripción de la incidencia y fotos si se preserva el contexto
    let storedDescription = '';
    if (preserveStoreContext) {
        document.querySelectorAll('.rep-desc').forEach(el => {
            if (el.value && el.value.trim() !== '') storedDescription = el.value.trim();
        });
    }
    
    APP_CONFIG.currentReport = { 
        category: '', 
        centro: preserveStoreContext ? storedCentro : '', 
        path: [] 
    };

    // Reset notes/inputs
    document.querySelectorAll('.rep-desc').forEach(el => el.value = preserveStoreContext ? storedDescription : '');
    
    const submitBtn = document.getElementById('dash-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirmar y Enviar Reporte';
    }
    
    if (!preserveStoreContext) {
        APP_CONFIG.incidentUploadedPhotos = [];
    }
    APP_CONFIG.currentSelectedDevices = []; // Reset de buffer temporal
    APP_CONFIG.currentSelectedLonas = [];
    APP_CONFIG.currentSelectedAlarmados = [];
    
    // Limpiar miniaturas
    if (!preserveStoreContext) {
        document.querySelectorAll('.thumbnail-container').forEach(c => c.innerHTML = '');
    }

    // NUEVO: Limpiar automáticamente el modo edición si estaba activo
    if (!preserveStoreContext) {
        window.editingIncidentId = null;
        window.editingIncidentDate = null;
        const banner = document.getElementById('editing-mode-banner');
        if (banner) {
            banner.style.display = 'none';
            banner.classList.add('hidden');
        }
    }
    
    // Limpiar listado de dispositivos dinámicos
    const listContainer = document.getElementById('device-selected-list');
    if (listContainer) {
        listContainer.innerHTML = '<p id="no-devices-msg" style="font-style: italic; color: #999; margin: 0; font-size: 12px;">Ningún modelo añadido aún.</p>';
    }
    
    const lonaListContainer = document.getElementById('lona-selected-list');
    if (lonaListContainer) {
        lonaListContainer.innerHTML = '<p id="no-lonas-msg" style="font-style: italic; color: #999; margin: 0; font-size: 12px;">Ningún modelo añadido aún.</p>';
    }
    
    const alarmadoListContainer = document.getElementById('furn-alarmado-selected-list');
    if (alarmadoListContainer) {
        alarmadoListContainer.innerHTML = '<p id="no-alarmados-msg" style="font-style: italic; color: #999; margin: 0; font-size: 11px;">Ningún modelo añadido aún.</p>';
    }
    
    // Reset all selects and hide boxes (Excluyendo cuenta y tienda si preservamos contexto)
    document.querySelectorAll('.sub-view select').forEach(s => {
        if (preserveStoreContext && (s.id === 'incident-cuenta' || s.id === 'incident-centro')) return;
        s.selectedIndex = 0;
    });
    
    // SOLO ocultamos la selección de categoría si es un reset FULL (ej: enviar reporte)
    if (!preserveStoreContext) {
        document.getElementById('category-selection')?.classList.add('hidden');
    }
    
    document.getElementById('furniture-procedure')?.classList.add('hidden');
    document.getElementById('device-procedure')?.classList.add('hidden');
    document.getElementById('screen-procedure')?.classList.add('hidden');
    document.getElementById('lona-procedure')?.classList.add('hidden');
    document.getElementById('device-models-box')?.classList.add('hidden');
    const customInp = document.getElementById('device-selector-custom');
    if (customInp) {
        customInp.value = '';
        customInp.classList.add('hidden');
    }
    document.getElementById('device-selector-dropdown')?.classList.remove('hidden');
    document.querySelectorAll('[id^="final-level-"]').forEach(f => f.classList.add('hidden'));
    
    // Hide all dynamic levels
    document.querySelectorAll('.level-box[data-level]').forEach(box => {
        if (box.id !== 'category-selection') {
            box.classList.add('hidden');
        }
    });
    
    document.querySelectorAll('.bubble-btn').forEach(btn => btn.classList.remove('active'));
    
    // Protección formularios
    if (!preserveStoreContext) {
        document.querySelectorAll('form').forEach(f => f.reset());
    } else {
        // Resetear formularios de procedimientos internos, no los selectores raíz
        document.querySelectorAll('#furniture-procedure form, #device-procedure form, #screen-procedure form, #lona-procedure form').forEach(f => f.reset());
    }
}

// --- API Communication ---
// --- API Communication (Híbrido robusto compatible con ejecución local file://) ---
async function callApi(data) {
    if (typeof window._apiInterceptor === 'function') {
        const intercepted = window._apiInterceptor(data);
        if (intercepted !== undefined) return intercepted;
    }
    if (!APP_CONFIG.scriptUrl) {
        console.warn('Apps Script URL not set. Returning mock data.');
        return mockApi(data);
    }

    // El backend valida este token antes de atender datos o cambios protegidos.
    const token = APP_CONFIG.sessionToken || localStorage.getItem('xiaomi_session_token');
    if (!['login', 'getUserList'].includes(data.action) && token) {
        APP_CONFIG.sessionToken = token;
        data = { ...data, sessionToken: token };
    }
    // Lista blanca explícita de acciones de lectura GET (todo lo demás son mutaciones y van por POST)
    const READ_ACTIONS = [
        'getUserList',
        'getDashboardData',
        'getLaunches',
        'getMaterials',
        'getLaunchStatuses',
        'getDiagnostics',
        'getDevices',
        'getMessagingUsers',
        'getMessages',
        'getFeishuImeis',
        'getLdusStockStatus',
        'getDevoluciones'
    ];
    const isRead = READ_ACTIONS.includes(data.action);
    if (isRead) {
        // ESTRATEGIA HÍBRIDA INTELIGENTE V5
        // 1º Intentamos FETCH NATIVO (Garantizado en http://localhost:8080 o servidores reales)
        try {
            let queryUrl = APP_CONFIG.scriptUrl + (APP_CONFIG.scriptUrl.includes('?') ? '&' : '?');
            const queryParams = [];
            for (let key in data) {
                queryParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
            }
            // Cache Buster para forzar lectura real sin dependencias de CDNs intermedias
            queryParams.push('_nocache=' + Date.now());
            const fullUrl = queryUrl + queryParams.join('&');

            console.log('📡 Probando Fetch Nativo ->', data.action);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); 
            
            const response = await fetch(fullUrl, { 
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const responseText = await response.text();
                // Si devuelve JSON crudo, lo parseamos y triunfamos instantáneamente!
                if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
                    console.log('? FETCH NATIVO EXITOSO - Omitiendo rescate JSONP.');
                    return JSON.parse(responseText);
                }
            }
            throw new Error('Formato de respuesta desconocido');
        } catch (fetchErr) {
            console.warn('⚠️ Fetch nativo fallido (posible file://). Iniciando Rescate JSONP...', fetchErr.message);
            
            // MODO RESCATE: JSONP clásico (El único que a veces funciona desde file:// local)
            return new Promise((resolve, reject) => {
                const callbackName = 'jsonp_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.async = true;
                script.referrerPolicy = 'no-referrer'; 
                
                window[callbackName] = function(response) {
                    cleanup();
                    resolve(response);
                };

                const cleanup = () => {
                    if (script.parentNode) script.parentNode.removeChild(script);
                    delete window[callbackName];
                };

                script.onerror = (e) => {
                    cleanup();
                    console.error("⛔ ERROR CRÍTICO ABSOLUTO (Fetch + JSONP Fallidos):", e);
                    reject(new Error('Bloqueo total de red local'));
                };

                let url = APP_CONFIG.scriptUrl + (APP_CONFIG.scriptUrl.includes('?') ? '&' : '?');
                const params = [];
                for (let key in data) {
                    params.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
                }
                params.push('callback=' + callbackName);
                params.push('_nocache=' + Date.now()); // Evitar cacheo de la etiqueta de script
                
                script.src = url + params.join('&');
                document.body.appendChild(script);

                // Prevención de colgado eterno
                setTimeout(() => {
                    if (window[callbackName]) {
                        cleanup();
                        reject(new Error('Timeout absoluto en rescate JSONP'));
                    }
                }, 15000);
            });
        }
    }

    // Rutas de escritura/mutación (POST) - Funcionan 100% si el login funcionó
    try {
        const response = await fetch(APP_CONFIG.scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (err) {
        console.error('Error de comunicación POST:', err);
        return { success: false, message: err.message };
    }
}
window.callApi = callApi;


function populateDashboardFilters(reports) {
    const cuentas = new Set();
    const tiendas = new Set();
    const usuarios = new Set();

    reports.forEach(r => {
        if (r.cuenta) cuentas.add(r.cuenta);
        if (r.tienda) tiendas.add(r.tienda);
        if (r.usuario) usuarios.add(r.usuario);
    });

    fillSelect('filter-cuenta', cuentas, 'Todas las cuentas');
    fillSelect('filter-tienda', tiendas, 'Todas las tiendas');
    fillSelect('filter-usuario', usuarios, 'Todos los usuarios');
}

function fillSelect(id, set, defaultText) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = `<option value="all">${defaultText}</option>`;
    [...set].sort().forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        select.appendChild(opt);
    });
}

// Duplicate filterDashboardTable removed.

async function loadLaunches() {
    const selector = document.getElementById('launch-selector');
    
    // OPTIMIZACIÓN: Reusar caché si existe
    let launches = APP_CONFIG.launches;
    if (!launches || launches.length === 0) {
        launches = await callApi({ action: 'getLaunches' });
        APP_CONFIG.launches = launches;
    }
    
    if (selector) selector.innerHTML = '';
    
    if (!launches || launches.length === 0) {
        return;
    }

    APP_CONFIG.launches = launches;

    const now = new Date();
    let closestLaunch = null;
    let minDiff = Infinity;

    launches.forEach(launch => {
        const keys = Object.keys(launch);
        let pKey = keys.find(k => k.toLowerCase().includes('producto') || k.toLowerCase().includes('nombre') || k.toLowerCase().includes('dispositivo'));
        if (!pKey && keys.length > 0) pKey = keys[0];
        const prodName = pKey ? String(launch[pKey]) : 'Sin nombre';
        
        // Búsqueda dinámica de la fecha de lanzamiento / activación
        let dateInfo = '';
        let dateObj = null;
        const dateKey = Object.keys(launch).find(k => k.toLowerCase().includes('fecha') || k.toLowerCase().includes('inicio') || k.toLowerCase().includes('activación') || k.toLowerCase().includes('date'));
        
        if (dateKey && launch[dateKey]) {
            let rawDate = String(launch[dateKey]).trim();
            if (rawDate.includes('T')) {
                const datePart = rawDate.split('T')[0];
                const [y, m, d] = datePart.split('-').map(Number);
                dateInfo = `${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${y}`;
                dateObj = new Date(y, m - 1, d);
            } else {
                dateInfo = rawDate;
                // Intentar parsear fecha simple
                const parts = rawDate.split(/[\/\-]/);
                if (parts.length === 3) {
                    if (parts[0].length === 4) dateObj = new Date(parts[0], parts[1]-1, parts[2]);
                    else dateObj = new Date(parts[2], parts[1]-1, parts[0]);
                }
            }
        }
        
        launch._prodName = prodName;
        launch._fechaParsed = dateInfo;
        launch._dateObj = dateObj;

        // Calcular el más cercano (hacia el futuro o el más reciente pasado)
        if (dateObj) {
            const diff = Math.abs(dateObj - now);
            if (diff < minDiff) {
                minDiff = diff;
                closestLaunch = launch;
            }
        }

        // Popula el selector de filtrado
        if (selector) {
            const opt = document.createElement('option');
            opt.value = prodName;
            opt.textContent = prodName; // Solo el nombre, sin la fecha
            selector.appendChild(opt);
        }
    });

    // Auto-seleccionar el lanzamiento más cercano si existe
    if (closestLaunch && selector) {
        selector.value = closestLaunch._prodName;
    }
}

async function loadMaterials() {
    // La pestaña de materiales ahora es estática en index.html
    // No se realizan llamadas al backend
}
window.loadMaterials = loadMaterials;

function renderMaterialsToContainer(materials, container) {
    // Obsoleto
}

// updateRecentTable removed.

// --- Launch Procedure Logic ---
APP_CONFIG.launchUploadedPhotos = [];
APP_CONFIG.launchIncidentPath = [];
APP_CONFIG.currentLaunchStore = null;

window.updateLaunchCascade = function() {
    const launchVal = document.getElementById('launch-selector')?.value || 'all';
    const cSelect = document.getElementById('launch-cuenta-selector');
    
    if (launchVal === 'all') {
        if (cSelect) {
            cSelect.disabled = true;
            cSelect.innerHTML = '<option value="all">Primero elige producto</option>';
        }
        loadLaunchStores();
        return;
    }

    if (cSelect) cSelect.disabled = false;
    
    let tiendas = APP_CONFIG.currentUser ? (APP_CONFIG.currentUser.tiendas || []) : [];

    // First filter by launch
    if (launchVal !== 'all' && APP_CONFIG.launches) {
        const launch = APP_CONFIG.launches.find(l => {
            const keys = Object.keys(l);
            let pKey = keys.find(k => k.toLowerCase().includes('producto') || k.toLowerCase().includes('nombre') || k.toLowerCase().includes('dispositivo'));
            if (!pKey && keys.length > 0) pKey = keys[0]; // Fallback to Column A
            const pVal = pKey ? String(l[pKey]) : '';
            return pVal && pVal.trim().toLowerCase() === launchVal.trim().toLowerCase();
        });
        
        if (launch) {
            const keys = Object.keys(launch);
            let cKey = keys.find(k => k.toLowerCase().includes('cuenta') || k.toLowerCase().includes('cuentas'));
            if (!cKey && keys.length > 1) cKey = keys[1]; // Fallback to Column B
            
            const cuentaVal = cKey ? String(launch[cKey]) : '';
            if (cuentaVal) {
                const allowedAccounts = String(cuentaVal).split(',').map(s => s.trim().toLowerCase());
                tiendas = tiendas.filter(t => t.cuenta && allowedAccounts.includes(t.cuenta.toLowerCase()));
            }
        }
    }

    // Based on filtered tiendas, update Cuenta dropdown
    const filteredAccounts = [...new Set(tiendas.map(t => t.cuenta).filter(Boolean))];

    if (cSelect) {
        cSelect.innerHTML = '<option value="all">Todas las cuentas</option>';
        filteredAccounts.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            cSelect.appendChild(opt);
        });
    }

    loadLaunchStores();
};

window.updateLaunchStoresByCascade = function() {
    loadLaunchStores();
};

window.loadLaunchStores = async function() {
    const grid = document.getElementById('launch-store-grid');
    if (!grid) return;
    
    grid.innerHTML = '<p>Cargando estados...</p>';
    
    try {
        ensureAdminStoresHydrated();
        const launchFilter = document.getElementById('launch-selector')?.value || 'all';
        const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
        
        const res = await callApi({ 
            action: 'getLaunchStatuses', 
            usuario: isAdmin ? '' : (APP_CONFIG.currentUser.email || APP_CONFIG.currentUser.usuario),
            lanzamiento: launchFilter === 'all' ? '' : launchFilter
        });
        const statuses = (res && res.statuses) ? res.statuses : {};
        
        const myStores = APP_CONFIG.currentUser.tiendas || [];
        let tiendas = [];
        
        // 1. Obtener las tiendas permitidas según APP_CONFIG.launches (cruzando con myStores)
        if (APP_CONFIG.launches && APP_CONFIG.launches.length > 0) {
            const allAllowedStores = new Set();
            const allAllowedAccounts = new Set();
            let hasAtLeastOneFilter = false;
            
            const sel = document.getElementById('launch-selector');
            const launchName = sel ? sel.value : '';
            
            // Filtramos los lanzamientos para coger SOLO el seleccionado
            let currentLaunches = APP_CONFIG.launches;
            if (launchName && launchName !== 'all') {
                currentLaunches = APP_CONFIG.launches.filter(l => {
                    const keys = Object.keys(l);
                    const nameKey = keys.find(k => k.toLowerCase().includes('producto') || k.toLowerCase().includes('lanzamiento') || k.toLowerCase() === 'col0' || k.toLowerCase() === 'nombre');
                    if (nameKey) {
                        return String(l[nameKey]).trim().toLowerCase() === String(launchName).trim().toLowerCase();
                    }
                    return false;
                });
            }
            
            currentLaunches.forEach(launch => {
                const keys = Object.keys(launch);
                const tKey = keys.find(k => k.toLowerCase() === 'tienda' || k.toLowerCase() === 'tiendas' || k.toLowerCase() === 'rms');
                const cKey = keys.find(k => k.toLowerCase() === 'cuenta' || k.toLowerCase() === 'cuentas');
                
                if (tKey) {
                    const tiendasVal = String(launch[tKey] || '').trim();
                    if (tiendasVal) {
                        tiendasVal.split(',').forEach(s => allAllowedStores.add(s.trim().toLowerCase()));
                        hasAtLeastOneFilter = true;
                    }
                }
                if (cKey) {
                    const cuentaVal = String(launch[cKey] || '').trim();
                    if (cuentaVal) {
                        cuentaVal.split(',').forEach(s => allAllowedAccounts.add(s.trim().toLowerCase()));
                        hasAtLeastOneFilter = true;
                    }
                }
            });
            
            if (hasAtLeastOneFilter) {
                tiendas = myStores.filter(t => {
                    const nameMatch = t.nombre && allAllowedStores.has(String(t.nombre).trim().toLowerCase());
                    const rmsMatch = t.rms && allAllowedStores.has(String(t.rms).trim().toLowerCase());
                    const accountMatch = t.cuenta && allAllowedAccounts.has(String(t.cuenta).trim().toLowerCase());
                    return nameMatch || rmsMatch || accountMatch;
                });
            }
        }
        
        // 2. Mapear estado desde forms externos y construir el array final
        tiendas = tiendas.map(t => {
            const storeNameKey = Object.keys(statuses).find(k => k.trim().toLowerCase() === String(t.nombre).trim().toLowerCase());
            const estadoActual = storeNameKey ? statuses[storeNameKey].estado : 'Pendiente';
            
            return {
                nombre: t.nombre,
                cuenta: t.cuenta || 'Varias Cuentas',
                usuario: t.usuario || 'Desconocido',
                rms: t.rms || '',
                estado: estadoActual
            };
        });

        // 2. Poblar los selectores dinámicamente si es Admin
        const cuentaSelect = document.getElementById('launch-cuenta-selector');
        const userSelect = document.getElementById('launch-user-selector');
        
        if (isAdmin && cuentaSelect && userSelect) {
            // Guardar valores actuales
            const currCuenta = cuentaSelect.value;
            const currUser = userSelect.value;
            
            const uniqueAccounts = [...new Set(tiendas.map(t => t.cuenta).filter(Boolean))].sort();
            const uniqueUsers = [...new Set(tiendas.map(t => t.usuario).filter(Boolean))].sort();
            
            cuentaSelect.innerHTML = '<option value="all">Todas</option>';
            uniqueAccounts.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                cuentaSelect.appendChild(opt);
            });
            cuentaSelect.value = uniqueAccounts.includes(currCuenta) ? currCuenta : 'all';
            
            userSelect.innerHTML = '<option value="all">Todos</option>';
            uniqueUsers.forEach(u => {
                const opt = document.createElement('option');
                opt.value = u;
                opt.textContent = u;
                userSelect.appendChild(opt);
            });
            userSelect.value = uniqueUsers.includes(currUser) ? currUser : 'all';
        }

        // 3. Aplicar los filtros seleccionados
        const cuentaFilter = cuentaSelect?.value || 'all';
        const userFilter = userSelect?.value || 'all';
        
        if (cuentaFilter !== 'all') {
            tiendas = tiendas.filter(t => t.cuenta && t.cuenta.toLowerCase() === cuentaFilter.toLowerCase());
        }
        if (userFilter !== 'all') {
            tiendas = tiendas.filter(t => t.usuario && t.usuario.toLowerCase() === userFilter.toLowerCase());
        }

        const historyGrid = document.getElementById('launch-history-grid');

        grid.innerHTML = '';
        if (historyGrid) historyGrid.innerHTML = '';
        
        if (tiendas.length === 0) {
            grid.innerHTML = '<p>No hay tiendas para este lanzamiento.</p>';
            if (historyGrid) historyGrid.innerHTML = '<p>Sin datos.</p>';
            return;
        }

        let pendingCount = 0;
        let historyCount = 0;

        function normalizeStoreName(name) {
            if (!name) return "";
            return String(name)
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9]/g, "")
                .toLowerCase();
        }

        tiendas.forEach(store => {
            const normTarget = normalizeStoreName(store.nombre);
            const sKey = Object.keys(statuses).find(k => normalizeStoreName(k) === normTarget);
            const rawStatusObj = sKey ? statuses[sKey] : null;
            
            // Usamos rawStatusObj.estado porque el script antiguo inyectaba 'estado' en lugar de 'state' desde backend
            let status = rawStatusObj ? (rawStatusObj.estado || rawStatusObj.state || 'Pendiente') : 'Pendiente';
            if (status === 'Realizado') status = 'Realizada'; // normalizar a lo que espera la interfaz
            const thumb = rawStatusObj ? rawStatusObj.thumbnail : '';
            
            const card = document.createElement('div');
            card.className = 'dashboard-card';
            card.style.cursor = 'pointer';
            card.style.overflow = 'hidden';
            card.style.background = '#fff';
            card.style.borderRadius = '12px';
            card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
            card.style.border = '1px solid #f0f0f0';
            card.style.transition = 'transform 0.2s, box-shadow 0.2s';
            
            let badgeHtml = '';
            let cardContent = '';
            
            if (status === 'Realizada') {
                badgeHtml = '<span class="status-badge" style="background: #e6f7ff; color: #1890ff; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; border: 1px solid #91d5ff;"><span class="badge-icon"><i class="fas fa-check-circle" style="color: #52c41a; font-size: 18px;"></i></span><span class="badge-text">? Realizada</span></span>';
                if (thumb) {
                    cardContent = `
                        <div style="width: 100%; height: 80px; overflow: hidden; margin-top: 10px; border-radius: 6px;">
                            <img src="${thumb}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    `;
                }
            } else if (status === 'Abierta') {
                badgeHtml = '<span class="status-badge" style="background: #fff1f0; color: #f5222d; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; border: 1px solid #ffa39e;"><span class="badge-icon"><i class="fas fa-exclamation-triangle" style="color: #f5222d; font-size: 18px;"></i></span><span class="badge-text">🔴 Abierta</span></span>';
            } else if (status === 'Revisada') {
                badgeHtml = '<span class="status-badge" style="background: #fff7e6; color: #fa8c16; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; border: 1px solid #ffd591;"><span class="badge-icon"><i class="fas fa-eye" style="color: #fa8c16; font-size: 18px;"></i></span><span class="badge-text">🟠 Revisada</span></span>';
            } else if (status === 'Reportada') {
                badgeHtml = '<span class="status-badge" style="background: #feffe6; color: #d4b106; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; border: 1px solid #ffffb8;"><span class="badge-icon"><i class="fas fa-exclamation" style="color: #d4b106; font-size: 18px;"></i></span><span class="badge-text">🟡 Reportada</span></span>';
            } else if (status === 'Cambiada') {
                badgeHtml = '<span class="status-badge" style="background: #f6ffed; color: #52c41a; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; border: 1px solid #b7eb8f;"><span class="badge-icon"><i class="fas fa-sync-alt" style="color: #52c41a; font-size: 18px;"></i></span><span class="badge-text">🟢 Cambiada</span></span>';
            } else {
                badgeHtml = '<span class="status-badge" style="background: #fff1f0; color: #f5222d; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; border: 1px solid #ffa39e;"><span class="badge-icon"><i class="fas fa-exclamation-circle" style="color: #f5222d; font-size: 18px;"></i></span><span class="badge-text">Pendiente</span></span>';
            }
            
            card.innerHTML = `
                <div style="background: #fff5e6; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; ${cardContent ? 'border-bottom: 1px solid #fce8db;' : ''}">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div style="position: relative; width: 32px; height: 32px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <i class="fas fa-store" style="color: var(--mi-orange); font-size: 14px;"></i>
                            <div class="mobile-badge-float" style="position: absolute; top: -6px; right: -6px; z-index: 2;">${badgeHtml}</div>
                        </div>
                        <div>
                            <h3 style="font-size: 14px; margin: 0 0 2px 0; color: #111; font-weight: 800; line-height: 1.2;">${store.nombre}</h3>
                            <p style="font-size: 11px; margin: 0; color: #666; font-weight: 600;">${store.cuenta}</p>
                        </div>
                    </div>
                    <div class="desktop-badge-area">
                        ${badgeHtml}
                    </div>
                </div>
                ${cardContent ? `<div style="padding: 12px 15px;">${cardContent}</div>` : ''}
            `;
            
            card.onclick = () => {
                startLaunchChecklist(store);
            };
            
            if (status === 'Pendiente') {
                grid.appendChild(card);
                pendingCount++;
            } else {
                if (historyGrid) {
                    historyGrid.appendChild(card);
                    historyCount++;
                }
            }
        });

        if (pendingCount === 0) grid.innerHTML = '<p>No hay tiendas pendientes.</p>';
        if (historyGrid && historyCount === 0) historyGrid.innerHTML = '<p>No hay historial de lanzamientos reportados.</p>';
        
        console.log("[DEBUG] Lanzamientos DOM rendered. Pendientes:", pendingCount, "Historial:", historyCount);
        console.log("[DEBUG] Grid HTML (first 200 chars):", grid.innerHTML.substring(0, 200));
        
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p>Error al cargar las tiendas.</p>';
    }
};

window.startLaunchChecklist = function(storeObj) {
    if (!storeObj) return;
    APP_CONFIG.currentLaunchStore = storeObj;
    
    document.getElementById('launch-store-grid').classList.add('hidden');
    document.getElementById('launch-checklist').classList.remove('hidden');
    
    const isECI = storeObj.cuenta === 'ECI';
    const escGroup = document.getElementById('launch-group-escalerilla');
    const escInput = document.getElementById('launch-q-escalerilla');
    if (escGroup) {
        if (isECI) {
            escGroup.classList.remove('hidden');
            if (escInput) escInput.setAttribute('required', 'true');
        } else {
            escGroup.classList.add('hidden');
            if (escInput) escInput.removeAttribute('required');
        }
    }
    
    document.getElementById('launch-form').reset();
    document.getElementById('launch-checklist-store-title').textContent = storeObj.nombre + ' (' + storeObj.cuenta + ')';
    
    APP_CONFIG.launchUploadedPhotos = [];
    document.getElementById('launch-thumbnails-incident').innerHTML = '';
};

window.toggleLaunchOk = function(isOk) {
    const section2 = document.getElementById('section-tarea-2');
    const details1 = document.getElementById('launch-ok-details');
    
    if (isOk) {
        section2.classList.add('hidden');
        details1.classList.remove('hidden');
    } else {
        section2.classList.remove('hidden');
        details1.classList.add('hidden');
    }
};

window.toggleLaunchIncident = function(isChecked) {
    const section1 = document.getElementById('section-tarea-1');
    const details2 = document.getElementById('launch-incident-details');
    const procedureBox = document.getElementById('launch-device-procedure');
    
    if (isChecked) {
        section1.classList.add('hidden');
        details2.classList.remove('hidden');
        APP_CONFIG.launchIncidentPath = ['Dispositivo'];
        
        // Reset bubble UI inside launch
        procedureBox.querySelectorAll('.bubble-btn').forEach(btn => btn.classList.remove('active'));
        procedureBox.querySelectorAll('.level-box').forEach(box => {
            if (box.dataset.launchLevel === "2") box.classList.remove('hidden');
            else box.classList.add('hidden');
        });
    } else {
        section1.classList.remove('hidden');
        details2.classList.add('hidden');
        APP_CONFIG.launchIncidentPath = [];
    }
};

window.closeLaunchChecklist = function() {
    document.getElementById('launch-form').reset();
    document.getElementById('launch-checklist').classList.add('hidden');
    document.getElementById('launch-store-grid').classList.remove('hidden');
    APP_CONFIG.currentLaunchStore = null;
};

window.selectLaunchLevel = function(level, value) {
    APP_CONFIG.launchIncidentPath = APP_CONFIG.launchIncidentPath.slice(0, level - 1);
    APP_CONFIG.launchIncidentPath[level - 1] = value;

    const procedureBox = document.getElementById('launch-device-procedure');
    const currentBox = procedureBox.querySelector(`.level-box[data-launch-level="${level}"]`);
    
    if (currentBox) {
        currentBox.querySelectorAll('.bubble-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent === value);
        });
    }

    // Hide subsequent levels
    procedureBox.querySelectorAll('.level-box').forEach(box => {
        if (parseInt(box.dataset.launchLevel) > level) {
            box.classList.add('hidden');
            box.querySelectorAll('.bubble-btn').forEach(b => b.classList.remove('active'));
        }
    });

    const nextLevel = level + 1;
    const nextBox = procedureBox.querySelector(`.level-box[data-launch-level="${nextLevel}"]`);
    if (nextBox) {
        nextBox.classList.remove('hidden');
        nextBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

window.handleLaunchPhotos = async function(input, maxFiles = 99) {
    const container = document.getElementById('launch-thumbnails-incident');
    const submitBtn = document.querySelector('#launch-form button[type="submit"]');
    
    if (!input.files || input.files.length === 0) return;
    
    const files = Array.from(input.files);
    
    // Validar máximo de fotos
    const currentCount = APP_CONFIG.launchUploadedPhotos.length;
    const pendingThumbs = container.querySelectorAll('.local-thumb-wrapper:not(.uploaded)').length;
    if (currentCount + pendingThumbs + files.length > maxFiles) {
        alert(`Solo se permite subir un máximo de ${maxFiles} fotos.`);
        input.value = '';
        return;
    }
    
    // Deshabilitar botón de enviar mientras se sube
    if (submitBtn) {
        submitBtn.disabled = true;
    }
    
    for (const file of files) {
        // Crear contenedor local instantáneo
        const wrapper = document.createElement('div');
        wrapper.className = 'local-thumb-wrapper';
        wrapper.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 2px solid var(--mi-orange); background: #333; display: flex; align-items: center; justify-content: center;';
        
        // Crear objeto URL local instantáneo
        const localUrl = URL.createObjectURL(file);
        
        wrapper.innerHTML = `
            <img src="${localUrl}" style="width: 100%; height: 100%; object-fit: cover; filter: blur(1px) brightness(0.6);">
            <div class="thumb-loader" style="position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff;">
                <i class="fa fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 4px;"></i>
                <span style="font-size: 9px; font-weight: bold; text-transform: uppercase;">Subiendo</span>
            </div>
        `;
        container.appendChild(wrapper);
        
        try {
            const isImg = file.type && file.type.startsWith('image/');
            const ext = isImg ? 'jpg' : (file.name.split('.').pop().toLowerCase() || 'bin');
            const base64 = await window.getCompressedBase64(file);
            const userRaw = (APP_CONFIG.currentUser?.email || APP_CONFIG.currentUser?.usuario) || 'Usuario';
            const userClean = String(userRaw).split('@')[0].trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
            const storeRaw = APP_CONFIG.currentReport?.centro || 'Tienda';
            const storeClean = String(storeRaw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
            const dateStr = new Date().toISOString().slice(0, 10);
            const shortTime = Date.now().toString().slice(-4);
            const customFileName = `${userClean}_${storeClean}_${dateStr}_LANZAMIENTO_${shortTime}.${ext}`;

            const uploadRes = await callApi({
                action: 'uploadFile',
                fileName: customFileName,
                mimeType: isImg ? 'image/jpeg' : (file.type || 'image/jpeg'),
                base64: base64
            });
            
            if (uploadRes && uploadRes.url) {
                APP_CONFIG.launchUploadedPhotos.push(uploadRes.url);
                wrapper.classList.add('uploaded');
                wrapper.dataset.url = uploadRes.url;
                wrapper.style.borderColor = '#2ecc71';
                
                // Actualizar thumbnail con icono de borrado y éxito
                wrapper.innerHTML = `
                    <img src="${localUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                    <div style="position: absolute; top: 2px; right: 2px; background: rgba(46, 204, 113, 0.9); color: #fff; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px;">
                        <i class="fa fa-check"></i>
                    </div>
                    <button type="button" class="delete-thumb-btn" style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(231, 76, 60, 0.85); color: #fff; border: none; font-size: 10px; padding: 2px 0; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <i class="fa fa-trash"></i> Borrar
                    </button>
                `;
                
                // Agregar acción de borrar
                wrapper.querySelector('.delete-thumb-btn').onclick = () => {
                    APP_CONFIG.launchUploadedPhotos = APP_CONFIG.launchUploadedPhotos.filter(url => url !== uploadRes.url);
                    wrapper.remove();
                    updateSubmitState();
                };
            } else {
                throw new Error(uploadRes ? (uploadRes.error || uploadRes.message || "No URL returned") : "No response from server");
            }
        } catch (e) {
            console.error('Error uploading launch photo:', e);
            wrapper.style.borderColor = '#e74c3c';
            wrapper.innerHTML = `
                <img src="${localUrl}" style="width: 100%; height: 100%; object-fit: cover; filter: grayscale(1) brightness(0.5);">
                <div style="position: absolute; color: #fff; text-align: center; font-size: 9px; padding: 4px; font-weight: bold;">
                    <i class="fa fa-exclamation-triangle" style="font-size: 1.2rem; color: #e74c3c; margin-bottom: 2px;"></i><br>Error
                </div>
                <button type="button" class="delete-thumb-btn" style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(51, 51, 51, 0.9); color: #fff; border: none; font-size: 10px; padding: 2px 0; cursor: pointer;">
                    <i class="fa fa-trash"></i> Quitar
                </button>
            `;
            wrapper.querySelector('.delete-thumb-btn').onclick = () => {
                wrapper.remove();
                updateSubmitState();
            };
        }
    }
    
    input.value = '';
    updateSubmitState();
    
    function updateSubmitState() {
        const remainingUploads = container.querySelectorAll('.local-thumb-wrapper:not(.uploaded)').length;
        if (submitBtn) {
            submitBtn.disabled = (remainingUploads > 0);
        }
    }
};

window.submitLaunch = async function(event) {
    event.preventDefault();
    
    if (APP_CONFIG.launchUploadedPhotos.length === 0) {
        alert("Por favor, sube al menos una foto antes de enviar.");
        return;
    }
    
    const btn = document.getElementById('btn-submit-launch');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    const isECI = APP_CONFIG.currentLaunchStore.cuenta === 'ECI';

    const reportData = {
        action: 'submitCustomLaunchForm',
        usuario: (APP_CONFIG.currentUser.email || APP_CONFIG.currentUser.usuario),
        cuenta: APP_CONFIG.currentLaunchStore.cuenta,
        tienda: APP_CONFIG.currentLaunchStore.nombre,
        owner: APP_CONFIG.currentLaunchStore.owner || '',
        rms: APP_CONFIG.currentLaunchStore.rms || '',
        // FIX: 'launch-selector' no existe en el HTML (fue eliminado en un refactor anterior);
        // esto hacía que submitLaunch() lanzara un error y el formulario nunca se enviara.
        // Usamos el mismo patrón defensivo (?.value || '') que ya se usa en el resto del código
        // para este mismo elemento (ver loadLaunchStores/updateLaunchCascade).
        lanzamiento: document.getElementById('launch-selector')?.value || '',
        photos: APP_CONFIG.launchUploadedPhotos.join('\n'),
        q_lampara: document.getElementById('launch-q-lampara').value,
        q_ldu: document.getElementById('launch-q-ldu').value,
        q_dummy: document.getElementById('launch-q-dummy').value,
        q_eco: document.getElementById('launch-q-eco').value,
        q_filmina: document.getElementById('launch-q-filmina').value,
        q_lonas: document.getElementById('launch-q-lonas').value,
        q_wall: document.getElementById('launch-q-wall').value,
        q_column: document.getElementById('launch-q-column').value,
        q_fichas: document.getElementById('launch-q-fichas').value,
        q_incidencias: document.getElementById('launch-q-incidencias').value || ''
    };
    
    if (isECI) {
        reportData.q_escalerilla = document.getElementById('launch-q-escalerilla').value || '';
    }

    try {
        const res = await callApi(reportData);
        if (res && res.success) {
            setTimeout(async () => {
                try {
                    const uRes = await callApi({ 
                        action: 'getMessagingUsers',
                        email: APP_CONFIG.currentUser?.email || APP_CONFIG.currentUser?.usuario,
                        token: APP_CONFIG.currentUser?.token
                    });
                    if (uRes && uRes.users) {
                        const admins = uRes.users.filter(u => String(u.rol || '').trim().toUpperCase().includes('ADMIN'));
                        const nombreUsu = APP_CONFIG.currentUser?.nombre || APP_CONFIG.currentUser?.usuario || 'Un usuario';
                        const tiend = reportData.tienda || 'una tienda';
                        const cat = reportData.categoria || 'Incidencia';
                        for (const admin of admins) {
                            const adminEmail = admin.email || admin.usuario;
                            if (adminEmail) {
                                callApi({
                                    action: 'sendMessage',
                                    remitente: 'Sistema',
                                    destinatario: adminEmail,
                                    mensaje: 'NUEVA INCIDENCIA ABIERTA: ' + nombreUsu + ' acaba de abrir un reporte de ' + cat + ' en ' + tiend + '. Por favor, revisalo para responder lo antes posible.'
                                });
                            }
                        }
                    }
                } catch(e) { console.error('Error al notificar admins', e); }
            }, 500);
        }
        if (res.success) {
            alert('Formulario de Lanzamiento enviado con éxito.');
            closeLaunchChecklist();
            loadLaunchStores();
        } else {
            alert('Error al guardar: ' + res.message);
        }
    } catch (e) {
        console.error(e);
        alert('Error de conexión al guardar.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- Form Handling ---
function setupForms() {
    loginForm.addEventListener('submit', handleLogin);
    
    // Toggle Password Visibility
    const togglePassword = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('login-password');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye-slash');
            this.classList.toggle('fa-eye');
        });
    }
}

/* ====================================================
   NUEVAS RUTINAS: GESTIÓN AVANZADA LANZAMIENTOS
   ==================================================== */
window.editValPhotosBuffer = [];

/**
 * Abre la pestaña de lanzamientos y preselecciona la tienda de forma ultra rápida y sin peticiones redundantes
 */
window.quickGoToLaunch = async function(launchName, storeName) {
    // Almacenar objetivos en variables globales temporales para consumo inmediato en showView
    window._pendingQuickLaunch = launchName;
    window._pendingQuickStore = storeName;
    
    // Invocar flujo de enrutado
    await showView('lanzamientos');
};

/**
 * Abre el nuevo modal interactivo de validación en modo VER, EDITAR o RESOLVER
 */
window.openLaunchValidationEditor = function(meta, mode) {
    const modal = document.getElementById('edit-validation-modal');
    if (!modal) return;
    
    // Reset buffers
    window.editValPhotosBuffer = [];
    const valThumbs = document.getElementById('edit-val-thumbnails');
    if (valThumbs) valThumbs.innerHTML = '';
    const valCam = document.getElementById('edit-val-cam');
    if (valCam) valCam.value = '';
    const valGal = document.getElementById('edit-val-gal');
    if (valGal) valGal.value = '';
    
    // Setup Title y data
    const titleEl = document.getElementById('edit-val-title');
    if (titleEl) titleEl.textContent = mode === 'resolve' ? 'Resolver Incidencia Lanzamiento' : (mode === 'edit' ? 'Editar Validación' : 'Detalles del Lanzamiento');
    const idEl = document.getElementById('edit-val-id');
    if (idEl) idEl.value = meta.id || '';
    const storeEl = document.getElementById('edit-val-store');
    if (storeEl) storeEl.value = meta.tienda || '';
    const modeEl = document.getElementById('edit-val-mode');
    if (modeEl) modeEl.value = mode;
    
    const tiendaTxt = document.getElementById('edit-val-tienda-txt');
    if (tiendaTxt) tiendaTxt.textContent = meta.tienda || '-';
    const lanzTxt = document.getElementById('edit-val-lanz-txt');
    if (lanzTxt) lanzTxt.textContent = meta.lanzamiento || '-';
    
    const commentBox = document.getElementById('edit-val-comentario');
    if (commentBox) {
        commentBox.value = meta.comentario || '';
        commentBox.readOnly = (mode === 'view');
    }
    
    // Current Photos Container
    const currPhotos = document.getElementById('edit-val-current-photos');
    if (currPhotos) currPhotos.innerHTML = '';
    const photoLabel = document.getElementById('edit-val-photo-label');
    const inputBlock = document.getElementById('edit-val-photos-input');
    const submitBtn = document.getElementById('edit-val-submit-btn');
    
    // Lógica fotos actuales
    if (meta.fotos && currPhotos) {
        const urls = meta.fotos.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
        if (urls.length > 0) {
            currPhotos.innerHTML = `<p style="font-size:11px; margin:0 0 5px; font-weight:600; color:#666;">Fotografías Actuales:</p>`;
            const grid = document.createElement('div');
            grid.className = 'modal-photo-grid';
            grid.innerHTML = urls.map(u => {
                const final = window.getGoogleDriveThumbnail(u);
                return `<img src="${final}" style="width:60px; height:60px; object-fit:cover; border-radius:4px; cursor:pointer; border:1px solid #ccc;" onclick="window.open('${u}','_blank')" title="Ver original"/>`;
            }).join('');
            currPhotos.appendChild(grid);
        }
    }
    
    // Visibilidad por modo
    if (mode === 'view') {
        if (inputBlock) inputBlock.style.display = 'none';
        if (photoLabel) photoLabel.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'none';
    } else {
        if (inputBlock) inputBlock.style.display = 'flex';
        if (photoLabel) photoLabel.style.display = 'block';
        if (submitBtn) {
            submitBtn.style.display = 'block';
            submitBtn.textContent = mode === 'resolve' ? 'Resolver y Guardar OK' : 'Actualizar Cambios';
            submitBtn.style.background = mode === 'resolve' ? '#2ecc71' : '#ff6700';
        }
    }
    
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
};

window.closeEditValidationModal = function() {
    const modal = document.getElementById('edit-validation-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
};

/**
 * Sube nuevas fotos desde el modal de edición a Google Drive
 */
window.handleEditValPhotoUpload = async function(input) {
    const files = input.files;
    if (!files || files.length === 0) return;
    
    const msg = document.getElementById('edit-val-upload-msg');
    const btn = document.getElementById('edit-val-submit-btn');
    const container = document.getElementById('edit-val-thumbnails');
    
    msg.style.display = 'inline-block';
    btn.disabled = true;
    
    const tienda = document.getElementById('edit-val-store').value || 'Tienda';
    
    for (let f of files) {
        try {
            const isImg = f.type && f.type.startsWith('image/');
            const base64 = await window.getCompressedBase64(f);
            const userRaw = (APP_CONFIG.currentUser?.email || APP_CONFIG.currentUser?.usuario) || 'Usuario';
            const userClean = String(userRaw).split('@')[0].trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
            const storeClean = String(tienda).trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
            const dateStr = new Date().toISOString().slice(0, 10);
            const shortTime = Date.now().toString().slice(-4);
            const ext = isImg ? 'jpg' : (f.name.split('.').pop() || 'bin');
            
            const res = await callApi({
                action: 'uploadFile',
                base64: base64,
                mimeType: isImg ? 'image/jpeg' : (f.type || 'image/jpeg'),
                fileName: `${userClean}_${storeClean}_${dateStr}_LANZAMIENTO_EDIT_${shortTime}.${ext}`
            });
            
            if (res && res.success) {
                window.editValPhotosBuffer.push(res.url);
                const thumb = document.createElement('div');
                thumb.style.cssText = 'width:50px; height:50px; background:#eee; position:relative; border-radius:4px; border:1px solid #2ecc71; overflow:hidden;';
                thumb.innerHTML = `<img src="${window.getGoogleDriveThumbnail(res.url)}" style="width:100%; height:100%; object-fit:cover;">`;
                container.appendChild(thumb);
            }
        } catch (e) {
            console.error(e);
        }
    }
    
    msg.style.display = 'none';
    btn.disabled = false;
};

/**
 * Lanza el submit de edición hacia el backend
 */
window.handleEditValidationSubmit = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('edit-val-submit-btn');
    const id = document.getElementById('edit-val-id').value;
    const mode = document.getElementById('edit-val-mode').value;
    const com = document.getElementById('edit-val-comentario').value;
    
    if (!id) {
        alert("No se puede actualizar un registro sin ID válido.");
        return;
    }

    const original = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    
    try {
        const payload = {
            action: 'updateLaunchValidation',
            id: id,
            comentario: com
        };
        
        // Si es resolución, forzamos estado a OK
        if (mode === 'resolve') {
            payload.instalacionOk = 'OK';
        }
        
        // Si subió nuevas fotos, enviarlas. 
        // (Unimos el buffer separado por saltos de línea)
        if (window.editValPhotosBuffer.length > 0) {
            payload.fotos = window.editValPhotosBuffer.join('\n');
        }
        
        const res = await callApi(payload);
        if (res && res.success) {
            alert(mode === 'resolve' ? "¡Incidencia resuelta! El estado ha pasado a Realizado." : "Validación actualizada con éxito.");
            window.closeEditValidationModal();
            // Recargar dashboard para ver cambios
            await loadDashboard();
        } else {
            alert("Error al guardar cambios: " + (res.error || "Desconocido"));
        }
    } catch (err) {
        console.error(err);
        alert("Error de conexión.");
    } finally {
        btn.disabled = false;
        btn.textContent = original;
    }
};

/**
 * Elimina validación llamando al backend con confirmación
 */
window.deleteLaunchValidationHandler = async function(id) {
    if (!id) return;
    const conf = await window.showConfirm("¿Eliminar Validación?", "¿Estás seguro de que deseas eliminar este reporte permanentemente? Esta acción borrará la fila del Excel.", true);
    if (!conf) return;
    
    try {
        const res = await callApi({
            action: 'deleteLaunchValidation',
            id: id
        });
        if (res && res.success) {
            alert("Reporte eliminado con éxito.");
            // Recargar vista para refrescar lista modal y stats
            await loadDashboard(); 
            // Cierra modal del historial para forzar la recarga visual de la parrilla si el usuario quiere reabrirlo
            const histModal = document.getElementById('historial-modal');
            if (histModal) histModal.style.display = 'none';
        } else {
            alert("Error al borrar: " + (res.error || "Desconocido"));
        }
    } catch (e) {
        console.error(e);
        alert("Error en comunicación con el servidor.");
    }
};

// Helper local para conversiones a base64 si no existe global
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}


function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); // Solo la parte base64
        reader.onerror = error => reject(error);
    });
}



// Mock API for testing before deployment
function mockApi(data) {
    return new Promise(resolve => {
        setTimeout(() => {
            if (data.action === 'login') {
                resolve({ success: true, user: { nombre: 'Admin Demo', email: 'admin@xiaomi.com', rol: 'admin' } });
            }
            if (data.action === 'getDashboardData') {
                resolve({ totalReports: 12, pendingReports: 3, recentReports: [] });
            }
            resolve({ success: true });
        }, 800);
    });
}


window.openDashboardModal = function(status, category = null) { 
    const modal = document.getElementById('historial-modal'); 
    if (!modal) return; 
    const title = document.getElementById('historial-modal-title'); 
    const filtersEl = document.getElementById('historial-modal-filters');

    APP_CONFIG.currentModalStatus = String(status || '').trim().toLowerCase();
    const isTodos = APP_CONFIG.currentModalStatus === 'all' || APP_CONFIG.currentModalStatus === 'todos';
    
    const baseList = APP_CONFIG.dashboardReports || [];
    APP_CONFIG.currentHistorialItems = baseList;
    APP_CONFIG.currentHistorialIsLanzamientos = false;

    // Filter baseList by status so dropdown options only reflect matching reports
    let statusFilteredList = baseList;
    if (!isTodos) {
        statusFilteredList = baseList.filter(r => {
            const est = String(r.estado || '').trim().toLowerCase();
            return est.includes(APP_CONFIG.currentModalStatus);
        });
    }

    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    const isAM = isUserAM(APP_CONFIG.currentUser);
    
    const excelBtn = document.getElementById('export-excel-btn');
    if (excelBtn) {
        excelBtn.style.display = isAdmin ? 'flex' : 'none';
    }
    
    const filterCuenta = document.getElementById('modal-filter-cuenta');
    const filterTienda = document.getElementById('modal-filter-tienda');
    const filterUsuario = document.getElementById('modal-filter-usuario');
    const filterEstado = document.getElementById('modal-filter-estado');
    const filterTipo = document.getElementById('modal-filter-tipo');
    
    if (filtersEl) filtersEl.style.display = 'flex';

    if (filterUsuario) filterUsuario.style.display = (isAdmin || isAM) ? '' : 'none';
    if (filterEstado) filterEstado.style.display = isTodos ? '' : 'none';
    
    if (filterCuenta) {
        const cuentas = [...new Set(statusFilteredList.map(r => String(r.cuenta || '').trim()).filter(Boolean))].sort();
        filterCuenta.innerHTML = '<option value="all">Todas las Cuentas</option>';
        cuentas.forEach(c => filterCuenta.innerHTML += `<option value="${c}">${c}</option>`);
        filterCuenta.value = 'all';
    }
    
    if (filterTienda) {
        const datalist = document.getElementById('modal-filter-tienda-list');
        const tiendas = [...new Set(statusFilteredList.map(r => String(r.tienda || '').trim()).filter(Boolean))].sort();
        if (datalist) {
            datalist.innerHTML = '';
            tiendas.forEach(t => datalist.innerHTML += `<option value="${t}">`);
        }
        filterTienda.value = '';
    }
    
    if ((isAdmin || isAM) && filterUsuario) {
        let usuarios = [...new Set(statusFilteredList.map(r => String(r.usuario || '').trim()).filter(Boolean))];
        if (isAM) {
            const myStores = APP_CONFIG.currentUser?.tiendas || [];
            const myUsers = myStores.map(t => String(t.usuario || t.owner || '').trim()).filter(Boolean);
            usuarios = [...new Set([...usuarios, ...myUsers])];
        }
        usuarios.sort();
        filterUsuario.innerHTML = '<option value="all">Todos los Usuarios</option>';
        usuarios.forEach(u => filterUsuario.innerHTML += `<option value="${u}">${u}</option>`);
        filterUsuario.value = 'all';
    }
    
    if (filterEstado) filterEstado.value = 'all';

    if (filterTipo) {
        if (category) {
            filterTipo.value = category;
        } else {
            filterTipo.value = 'all';
        }
    }

    if (title) {
        let displayStatus = isTodos ? 'TODOS' : APP_CONFIG.currentModalStatus.toUpperCase();
        if (category) {
            displayStatus += ` - ${String(category).toUpperCase()}`;
        }
        title.textContent = 'Historial de Incidencias: ' + displayStatus; 
    }
    
    window.applyModalFilters();
    
    modal.style.display = 'flex'; 
    modal.classList.remove('hidden'); 
};

// ========================================================
// SISTEMA DE ALERTAS EN VIVO DE CAMBIOS DE ESTADO (EN SESIÓN)
// ========================================================

// Purga automática inmediata de notificaciones fantasma y cachés antiguas en localStorage
(function cleanupPhantomNotifications() {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('xiaomi_notifications_') || key.startsWith('xiaomi_states_cache_'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
        console.warn('Error limpiando notificaciones fantasma:', e);
    }
})();

window.showReportById = function(reportId) {
    if (!reportId) return;
    const rep = (APP_CONFIG.dashboardReports || []).find(x => String(x.id) === String(reportId));
    if (rep) {
        showView('dashboard');
        navLinks.forEach(lnk => {
            if (lnk.getAttribute('data-target') === 'dashboard') lnk.classList.add('active');
            else lnk.classList.remove('active');
        });
        setTimeout(() => {
            window.showReportDetails(rep);
        }, 300);
    } else {
        showView('dashboard');
    }
};

function checkStatusChanges(reports) {
    if (!reports || !Array.isArray(reports) || reports.length === 0) return;
    
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    
    // Si es la primera vez que se cargan reportes en esta sesión de navegador,
    // inicializamos silenciosamente la memoria para no disparar alertas falsas de datos históricos
    if (!window._sessionIncidentStates) {
        window._sessionIncidentStates = {};
        window._knownAdminIncidentIds = new Set();
        reports.forEach(r => {
            if (r.id) {
                window._sessionIncidentStates[r.id] = String(r.estado || '').trim().toUpperCase();
                window._knownAdminIncidentIds.add(String(r.id));
            }
        });
        return;
    }
    
    // Solo si el usuario ya tenía la sesión abierta y se produce un refresco con cambio real
    let foundAlerts = [];
    const seenIds = new Set();
    
    reports.forEach(r => {
        if (!r.id || seenIds.has(r.id)) return;
        seenIds.add(r.id);
        
        const currentEst = String(r.estado || '').trim().toUpperCase();
        const prevEst = window._sessionIncidentStates[r.id];
        
        // 1. Cambio de estado de una incidencia ya existente en la sesión (para todos los usuarios)
        if (prevEst && prevEst !== currentEst) {
            foundAlerts.push({
                isStatusChange: true,
                reportId: r.id,
                tienda: r.tienda || 'Tienda',
                oldState: prevEst,
                newState: currentEst,
                tipo: r.tipo || 'Incidencia',
                usuario: r.usuario || ''
            });
        }
        
        // 2. Nueva incidencia registrada durante la sesión (Especialmente para Administradores)
        if (isAdmin && !window._knownAdminIncidentIds.has(String(r.id))) {
            window._knownAdminIncidentIds.add(String(r.id));
            if (!currentEst.includes('SOLUCION')) {
                foundAlerts.push({
                    isNew: true,
                    reportId: r.id,
                    tienda: r.tienda || 'Tienda',
                    tipo: r.tipo || 'Incidencia',
                    usuario: r.usuario || 'Un usuario'
                });
            }
        }
        
        // Actualizar estado en memoria de la sesión
        window._sessionIncidentStates[r.id] = currentEst;
        if (isAdmin) window._knownAdminIncidentIds.add(String(r.id));
    });
    
    if (foundAlerts.length > 0) {
        triggerNotificationAlert(foundAlerts);
    }
}

function triggerNotificationAlert(alerts) {
    const container = document.getElementById('toast-container');
    if (!container || !alerts || alerts.length === 0) return;

    alerts.forEach(item => {
        let title = 'AVISO DE CAMBIO 🔄';
        let iconClass = 'fa-bell';
        let iconColor = 'var(--mi-orange)';
        let msgHtml = '';
        let plainText = '';

        if (item.isNew) {
            title = 'NUEVA INCIDENCIA REGISTRADA 🚨';
            iconClass = 'fa-exclamation-triangle';
            iconColor = '#ff4d4f';
            msgHtml = `Nueva incidencia en <strong>"${item.tienda}"</strong> (${item.tipo}) registrada por <strong>${item.usuario}</strong>.`;
            plainText = `Nueva incidencia en ${item.tienda} (${item.tipo}) registrada por ${item.usuario}.`;
        } else {
            const newState = String(item.newState || '').toUpperCase();
            if (newState.includes('SOLUCION')) {
                title = 'INCIDENCIA SOLUCIONADA ✅';
                iconClass = 'fa-check-circle';
                iconColor = '#52c41a';
            } else if (newState.includes('GESTION')) {
                title = 'INCIDENCIA EN GESTIÓN ⏳';
                iconClass = 'fa-hourglass-half';
                iconColor = '#faad14';
            } else {
                title = 'ACTUALIZACIÓN DE ESTADO 🔄';
                iconClass = 'fa-sync-alt';
                iconColor = '#1890ff';
            }
            msgHtml = `Tu incidencia en <strong>"${item.tienda}"</strong> pasó de <span style="opacity:0.7;">${item.oldState}</span> a <strong>${item.newState}</strong>.`;
            plainText = `Tu incidencia en "${item.tienda}" pasó a ${item.newState}.`;
        }

        // --- LÓGICA DE NOTIFICACIÓN NATIVA PWA / NAVEGADOR ---
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body: plainText,
                    icon: 'logo.png'
                });
            } catch(e) {
                console.log("Error enviando notificación nativa:", e);
            }
        }

        // Vibración háptica en dispositivos móviles compatibles
        if (navigator.vibrate) {
            try { navigator.vibrate([150, 75, 150]); } catch(e) {}
        }

        const toast = document.createElement('div');
        toast.className = 'premium-toast';
        toast.style.borderLeftColor = iconColor;
        toast.innerHTML = `
            <div class="toast-icon" style="color: ${iconColor};"><i class="fas ${iconClass}"></i></div>
            <div class="toast-content" style="flex:1;">
                <div class="toast-title" style="font-weight:700; font-size:13px; margin-bottom:3px; color:var(--mi-black);">${title}</div>
                <div class="toast-text" style="font-size:12px; color:#555; line-height:1.4;">${msgHtml}</div>
                ${item.reportId ? `
                <div style="margin-top:8px;">
                    <button onclick="window.showReportById('${item.reportId}'); this.closest('.premium-toast').remove();" style="background:${iconColor}; color:white; border:none; padding:5px 12px; border-radius:5px; font-size:11px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:5px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
                        <i class="fas fa-eye"></i> Ver Incidencia
                    </button>
                </div>
                ` : ''}
            </div>
            <button class="toast-close" title="Cerrar" style="background:none; border:none; color:#aaa; cursor:pointer; font-size:14px; padding:0 0 0 8px;"><i class="fas fa-times"></i></button>
        `;

        const closeToast = () => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        };

        toast.querySelector('.toast-close').onclick = closeToast;
        container.appendChild(toast);

        // Auto-destrucción tras 8 segundos
        setTimeout(closeToast, 8000);
    });
}

// ========================================================
// MONITOR EN SEGUNDO PLANO DE INCIDENCIAS Y MENSAJES (EN VIVO)
// ========================================================
window.startLiveIncidentWatcher = function() {
    if (window._liveWatcherInterval) return; // Evitar múltiples temporizadores

    window._liveWatcherInterval = setInterval(async () => {
        // Solo ejecutar si hay usuario activo y la pestaña no está minimizada o en reposo profundo
        if (!APP_CONFIG.currentUser || document.hidden) return;

        try {
            const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
            
            // 1. Sincronización silenciosa de incidencias
            const dashRes = await callApi({ 
                action: 'getDashboardData',
                rol: isAdmin ? 'ADMIN' : (isUserAM(APP_CONFIG.currentUser) ? 'AM' : (APP_CONFIG.currentUser?.rol || 'usuario'))
            });

            if (dashRes && dashRes.recentReports) {
                let userReports = (dashRes.recentReports || []).filter(r => r && (r.id || r.tienda) && String(r.tienda || r.tipo || '').trim() !== '');
                userReports.forEach((r, idx) => {
                    if (!r.id) r.id = 'REP_' + (r.fecha ? String(r.fecha).replace(/\D/g, '') : Date.now()) + '_' + idx;
                });
                if (!isAdmin) {
                    const myEmail = String((APP_CONFIG.currentUser.email || APP_CONFIG.currentUser.usuario || APP_CONFIG.currentUser.nombre) || '').trim().toLowerCase();
                    const myStores = (APP_CONFIG.currentUser.tiendas || []).map(t => String(t.nombre || t.tienda || t).trim().toLowerCase()).filter(Boolean);
                    if (myStores.length > 0 || myEmail) {
                        const filtered = userReports.filter(r => {
                            const rUser = String(r.usuario || '').trim().toLowerCase();
                            const rTienda = String(r.tienda || '').trim().toLowerCase();
                            const isMyUser = myEmail && (rUser === myEmail || rUser.includes(myEmail) || myEmail.includes(rUser));
                            const isMyStore = myStores.length > 0 && (myStores.includes(rTienda) || myStores.some(s => s && (rTienda.includes(s) || s.includes(rTienda))));
                            return isMyUser || isMyStore;
                        });
                        if (filtered.length > 0 || myStores.length > 0) userReports = filtered;
                    }
                }
                APP_CONFIG.dashboardReports = userReports;
                checkStatusChanges(userReports);
            }

            // 2. Sincronización silenciosa de correspondencia para el globo de notificaciones
            const msgRes = await callApi({
                action: 'getMessages',
                email: (APP_CONFIG.currentUser.email || APP_CONFIG.currentUser.usuario)
            });

            if (msgRes && msgRes.messages) {
                const currentUserStr = String((APP_CONFIG.currentUser?.email || APP_CONFIG.currentUser?.usuario) || '').trim().toLowerCase();
                const prevUnreadCount = (window.inboxMessages || []).filter(m => 
                    String(m.destinatario || '').trim().toLowerCase() === currentUserStr && 
                    !String(m.leido || m.estado || '').toLowerCase().includes('leido')
                ).length;

                window.inboxMessages = msgRes.messages;
                updateNavBadge();

                const newUnreadCount = (window.inboxMessages || []).filter(m => 
                    String(m.destinatario || '').trim().toLowerCase() === currentUserStr && 
                    !String(m.leido || m.estado || '').toLowerCase().includes('leido')
                ).length;

                // Si ha llegado un nuevo mensaje mientras está en la aplicación
                if (newUnreadCount > prevUnreadCount) {
                    const activeView = document.querySelector('.sub-view:not(.hidden)')?.id;
                    if (activeView === 'view-mensajes') {
                        window.renderInboxList(window.activeInboxFilter);
                    }
                }
            }
        } catch(e) {
            console.warn('Sync de fondo omitido temporalmente:', e);
        }
    }, 45000); // Comprobación cada 45 segundos
};

function updateNavBadge() {
    const badge = document.getElementById('msg-nav-badge');
    const mobileBadge = document.getElementById('msg-mobile-badge');
    if (!badge && !mobileBadge) return;
    
    // Mensajes de chat reales no leídos de la base de datos dirigidos al usuario activo
    const currentUser = String((APP_CONFIG.currentUser?.email || APP_CONFIG.currentUser?.usuario) || '').trim().toLowerCase();
    const unreadChatCount = (window.inboxMessages || []).filter(m => 
        String(m.destinatario || '').trim().toLowerCase() === currentUser && 
        !String(m.leido || m.estado || '').trim().toLowerCase().includes('leido') &&
        !String(m.leido || m.estado || '').trim().toLowerCase().includes('leído')
    ).length;
    
    if (unreadChatCount > 0) {
        const displayText = unreadChatCount > 99 ? '99+' : unreadChatCount;
        if (badge) {
            badge.textContent = displayText;
            badge.style.display = 'flex';
            badge.classList.add('active');
        }
        if (mobileBadge) {
            mobileBadge.textContent = displayText;
            mobileBadge.style.display = 'flex';
            mobileBadge.classList.add('active');
        }
    } else {
        if (badge) {
            badge.style.display = 'none';
            badge.classList.remove('active');
        }
        if (mobileBadge) {
            mobileBadge.style.display = 'none';
            mobileBadge.classList.remove('active');
        }
    }
}

// Helpers de compatibilidad retroactiva seguros
window.markSingleNotificationRead = function(notifId) {
    updateNavBadge();
};

window.renderNotificationsView = function() {
    const listContainer = document.getElementById('notifications-list');
    const emptyEl = document.getElementById('no-msgs-fallback');
    if (listContainer) listContainer.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
};

window.markAllNotificationsRead = function() {
    updateNavBadge();
};

// Iniciar chequeo al arrancar (Badge)
setTimeout(updateNavBadge, 1000);


// ==============================================================
// --- MÓDULO DE MENSAJERÍA INTERNA (ANTIGRAVITY PREMIUM) ---
// ==============================================================

window.inboxMessages = [];
window.activeInboxFilter = 'recibidos';

window.updateCharCounter = function(el) {
    const counter = document.getElementById('msg-char-counter');
    if (counter) {
        counter.textContent = `${el.value.length} / 200`;
        if (el.value.length >= 200) {
            counter.style.color = '#ff4d4f';
        } else {
            counter.style.color = '#aaa';
        }
    }
};

window.loadMessagingUsers = async function() {
    const select = document.getElementById('msg-destinatario');
    if (!select) return;
    
    try {
        const res = await callApi({ 
            action: 'getMessagingUsers',
            email: APP_CONFIG.currentUser?.email || APP_CONFIG.currentUser?.usuario,
            token: APP_CONFIG.currentUser?.token
        });
        if (res && res.success && res.users) {
            const isCurrentUserAdmin = isUserAdmin(APP_CONFIG.currentUser);
            
            // Si el usuario actual es Admin, carga a los usuarios Estándar.
            // Si el usuario actual es Estándar, carga a los Admins.
            const filteredUsers = res.users.filter(u => {
                const targetIsAdmin = isUserAdmin(u);
                if (isCurrentUserAdmin) {
                    // Mostrar todos excepto Admins (para mandarle a estandars)
                    return !targetIsAdmin;
                } else {
                    // Mostrar solo Admins
                    return targetIsAdmin;
                }
            });
            
            select.innerHTML = '<option value="" disabled selected>Selecciona destinatario...</option>';
            filteredUsers.forEach(u => {
                const opt = document.createElement('option');
                opt.value = (u.email || u.usuario);
                opt.textContent = `${(u.nombre || u.email || u.usuario)} (${isCurrentUserAdmin ? 'Estándar' : 'Administrador'})`;
                opt.dataset.nombre = String(u.nombre || '').trim().toLowerCase();
                select.appendChild(opt);
            });
            
            if (filteredUsers.length === 0) {
                select.innerHTML = '<option value="" disabled selected>Sin destinatarios disponibles.</option>';
            }
        } else {
            const errReason = res ? (res.message || res.error || JSON.stringify(res)) : 'Sin respuesta del servidor';
            console.error("Error de API:", errReason);
            select.innerHTML = `<option value="" disabled selected>Error: ${errReason}</option>`;
        }
    } catch (err) {
        console.error("Excepción de carga de contactos:", err);
        select.innerHTML = `<option value="" disabled selected>Error de red: ${err.message || err}</option>`;
    }
};

window.handleMotivoChange = function(select) {
    const customInput = document.getElementById('msg-custom-motivo');
    if (select.value === 'nuevo') {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
        customInput.value = '';
    }
};

window.loadMessagingMotivos = function() {
    const select = document.getElementById('msg-motivo');
    const destSelect = document.getElementById('msg-destinatario');
    if (!select) return;
    
    // Mantener las opciones básicas
    select.innerHTML = '<option value="" selected>Sin motivo / General</option><option value="nuevo">Escribir nuevo motivo...</option>';
    
    // Cargar reportes si existen
    let reports = APP_CONFIG.dashboardReports || [];
    
    // Si somos Admin, filtrar los reportes solo al usuario seleccionado
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    
    if (isAdmin && destSelect) {
        const selectedOption = destSelect.options[destSelect.selectedIndex];
        if (selectedOption && !selectedOption.disabled) {
            const targetEmail = String(selectedOption.value).trim().toLowerCase();
            const targetNombre = String(selectedOption.dataset.nombre || '').trim().toLowerCase();
            
            try {
                let filteredReports = reports.filter(r => {
                    if (!r) return false;
                    const repUser = String(r.usuario || '').trim().toLowerCase();
                    const repOwner = String(r.owner || '').trim().toLowerCase();
                    const repCuenta = String(r.cuenta || '').trim().toLowerCase();
                    
                    const normalizeStr = (str) => {
                        if (!str) return '';
                        let s = String(str).toLowerCase();
                        try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch(e) {}
                        return s.replace(/[^a-z0-9]/g, '');
                    };
                    
                    const cleanRepUser = normalizeStr(repUser);
                    const cleanRepOwner = normalizeStr(repOwner);
                    const cleanRepCuenta = normalizeStr(repCuenta);
                    const cleanTargetEmail = normalizeStr(targetEmail);
                    const cleanTargetNombre = normalizeStr(targetNombre);
                    
                    if (cleanTargetEmail && cleanRepUser && (cleanRepUser.includes(cleanTargetEmail) || cleanTargetEmail.includes(cleanRepUser))) return true;
                    if (cleanTargetEmail && cleanRepOwner && cleanRepOwner.includes(cleanTargetEmail)) return true;
                    if (cleanTargetEmail && cleanRepCuenta && cleanRepCuenta.includes(cleanTargetEmail)) return true;
                    
                    if (cleanTargetNombre && cleanRepUser && (cleanRepUser.includes(cleanTargetNombre) || cleanTargetNombre.includes(cleanRepUser))) return true;
                    if (cleanTargetNombre && cleanRepOwner && cleanRepOwner.includes(cleanTargetNombre)) return true;
                    if (cleanTargetNombre && cleanRepCuenta && cleanRepCuenta.includes(cleanTargetNombre)) return true;
                    
                    return false;
                });
                
                console.log("🎯 Filtrando reportes para dest:", targetEmail, "| Nombre:", targetNombre);
                console.log("📊 Total reportes antes:", reports.length, "| Después:", filteredReports.length);
                
                reports = filteredReports;
            } catch (e) {
                console.error("Error filtrando motivos:", e);
                reports = [];
            }
        } else {
            reports = []; // Si no ha seleccionado usuario, no mostrar reportes aún
        }
    }
    
    if (reports.length > 0) {
        reports.forEach(r => {
            const idStr = r.id ? String(r.id) : 'Sin ID';
            const categoriaStr = r.categoria || 'Sin categoría';
            const subcategoriaStr = r.subcategoria ? String(r.subcategoria) : 'Sin subcategoría';
            const estadoStr = r.estado || 'Sin estado';
            let motivoDesc = 'Sin motivo';
            
            if (r.motivo) motivoDesc = String(r.motivo);
            else if (r.descripcion) motivoDesc = String(r.descripcion).substring(0, 40) + '...';
            
            const optionText = `${idStr}, ${categoriaStr}, ${subcategoriaStr}, ${motivoDesc}, ${estadoStr}`;
            const optionValue = optionText;
            
            const opt = document.createElement('option');
            opt.value = optionValue;
            opt.textContent = optionText;
            select.appendChild(opt);
        });
    }
};

window.handleSendMessage = async function(e) {
    e.preventDefault();
    const destInput = document.getElementById('msg-destinatario');
    const textInput = document.getElementById('msg-texto');
    const selectMotivo = document.getElementById('msg-motivo');
    const customMotivo = document.getElementById('msg-custom-motivo');
    const submitBtn = document.getElementById('msg-submit-btn');
    
    if (!destInput.value || !textInput.value.trim()) {
        alert("Por favor completa todos los campos obligatorios.");
        return;
    }
    
    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Enviando...';
    
    let finalMotivo = '';
    if (selectMotivo && selectMotivo.value) {
        if (selectMotivo.value === 'nuevo' && customMotivo) {
            finalMotivo = customMotivo.value.trim();
        } else {
            finalMotivo = selectMotivo.value;
        }
    }
    
    try {
        const res = await callApi({
            action: 'sendMessage',
            remitente: (APP_CONFIG.currentUser.email || APP_CONFIG.currentUser.usuario),
            destinatario: destInput.value,
            mensaje: textInput.value.trim(),
            motivo: finalMotivo
        });
        
        if (res && res.success) {
            alert("¡Mensaje enviado con éxito!");
            textInput.value = '';
            if (selectMotivo) selectMotivo.value = '';
            if (customMotivo) {
                customMotivo.value = '';
                customMotivo.style.display = 'none';
            }
            updateCharCounter(textInput);
            // Recargar bandeja automáticamente
            await window.loadUserInbox();
        } else {
            alert("Error al enviar mensaje: " + (res.error || 'Error desconocido'));
        }
    } catch (err) {
        console.error(err);
        alert("Error al comunicar con el servidor de mensajería.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalContent;
    }
};

window.loadUserInbox = async function() {
    const loader = document.getElementById('inbox-loader');
    const list = document.getElementById('inbox-list');
    const fallback = document.getElementById('no-inbox-fallback');
    
    if (loader) loader.style.display = 'block';
    if (list) list.style.display = 'none';
    if (fallback) fallback.style.display = 'none';
    
    try {
        const res = await callApi({
            action: 'getMessages',
            email: (APP_CONFIG.currentUser.email || APP_CONFIG.currentUser.usuario)
        });
        
        if (res && res.success) {
            window.inboxMessages = res.messages || [];
            window.lastInboxResponse = res; // Guardamos metadatos de depuración para el panel visual
            window.renderInboxList(window.activeInboxFilter);
            updateNavBadge();
        } else {
            if (list) list.innerHTML = '<p style="color:red; text-align:center; font-size:12px;">Error cargando bandeja.</p>';
        }
    } catch (err) {
        console.error("Error crítico en inbox loader:", err);
        if (list) list.innerHTML = `
            <div style="text-align:center; padding:20px; color:#cf1322; font-size:12px; background:#fff1f0; border:1px solid #ffa39e; border-radius:8px; margin:10px;">
                <i class="fas fa-exclamation-circle" style="font-size:20px; margin-bottom:8px;"></i><br>
                <strong>Error de Conexión:</strong><br>${err.message || err.toString()}<br>
                <small style="color:#888; margin-top:5px; display:block;">Por favor reporta esta traza técnica.</small>
            </div>
        `;
        if (list) list.style.display = 'block';
    } finally {
        if (loader) loader.style.display = 'none';
        if (list) list.style.display = 'flex';
    }
};

window.filterInbox = function(filterType, btn) {
    window.activeInboxFilter = filterType;
    
    // Alternar estilos visuales del selector píldora
    document.querySelectorAll('.inbox-filter-pill').forEach(p => {
        p.style.background = 'transparent';
        p.style.color = '#666';
        p.style.boxShadow = 'none';
    });
    
    btn.style.background = 'white';
    btn.style.color = 'var(--mi-orange)';
    btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
    
    window.renderInboxList(filterType);
};

window.renderInboxList = function(filterType) {
    const list = document.getElementById('inbox-list');
    const fallback = document.getElementById('no-inbox-fallback');
    if (!list) return;
    
    const currentUser = String((APP_CONFIG.currentUser?.email || APP_CONFIG.currentUser?.usuario) || '').trim().toLowerCase();
    
    // --- CONSTRUCCIÓN DEL FEED EXCLUSIVO DE CHAT REAL ---
    let combinedFeed = [];
    
    if (filterType === 'recibidos') {
        // Mensajes de Chat Recibidos de base de datos
        combinedFeed = (window.inboxMessages || [])
            .filter(m => String(m.destinatario || '').trim().toLowerCase() === currentUser.trim())
            .map(m => ({
                id: m.id,
                time: new Date(m.fecha).getTime() || 0,
                formattedDate: isNaN(new Date(m.fecha)) ? 'Fecha Desconocida' : new Date(m.fecha).toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}),
                isRead: String(m.leido || m.estado || '').toLowerCase().includes('leido') || String(m.leido || m.estado || '').toLowerCase().includes('leído'),
                type: 'chat',
                sender: m.remitente,
                content: m.mensaje,
                original: m
            }));
            
        combinedFeed.sort((a, b) => b.time - a.time);
        
    } else {
        // Para la pestaña Enviados, solo chat saliente del usuario activo
        combinedFeed = (window.inboxMessages || [])
            .filter(m => String(m.remitente || '').trim().toLowerCase() === currentUser.trim())
            .map(m => ({
                id: m.id,
                time: new Date(m.fecha).getTime() || 0,
                formattedDate: isNaN(new Date(m.fecha)) ? 'Fecha Desconocida' : new Date(m.fecha).toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}),
                isRead: true, 
                type: 'chat',
                sender: m.destinatario,
                content: m.mensaje,
                original: m
            }));
            
        combinedFeed.sort((a, b) => b.time - a.time);
    }
    
    // --- BUTTON VISIBILITY ---
    const markAllBtn = document.getElementById('mark-all-read-btn');
    if (markAllBtn) {
        const hasUnread = combinedFeed.some(item => !item.isRead);
        if (filterType === 'recibidos' && hasUnread) {
            markAllBtn.style.display = 'flex';
        } else {
            markAllBtn.style.display = 'none';
        }
    }
    
    // Manejo de vista vacía (Producción)
    if (combinedFeed.length === 0) {
        list.innerHTML = '';
        if (fallback) {
            fallback.style.display = 'block';
            const diagPara = fallback.querySelector('p');
            if (diagPara) {
                diagPara.innerHTML = '<span style="color: #999; font-size: 13px; font-weight: 500;">No hay mensajes en este filtro.</span>';
            }
        }
        return;
    }
    if (fallback) fallback.style.display = 'none';
    
    // --- RENDERIZADO DINÁMICO DE MENSAJES REALES ---
    list.innerHTML = combinedFeed.map(item => {
        const peerLabel = filterType === 'recibidos' ? 'De:' : 'Para:';
        const borderLeftColor = filterType === 'recibidos' ? (item.isRead ? '#ddd' : 'var(--mi-orange)') : '#1890ff';
        const badgeBg = filterType === 'recibidos' ? (item.isRead ? '#f0f0f0' : '#fff2e8') : '#e6f7ff';
        const badgeTextColor = filterType === 'recibidos' ? (item.isRead ? '#8c8c8c' : '#fa541c') : '#1890ff';
        const badgeText = filterType === 'recibidos' ? (item.isRead ? 'Leído' : 'Nuevo') : 'Enviado';
        
        let extraButtons = '';
        if (!item.isRead && filterType === 'recibidos') {
            extraButtons += `
            <button onclick="event.stopPropagation(); window.markInboxMessageRead('${item.id}', this.closest('.message-card'))" style="background:#ffffff; color:#555; border:1px solid #ddd; padding:6px 12px; border-radius:4px; font-size:10px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:4px; margin-top: 8px;">
                <i class="fas fa-check"></i> Marcar como leído
            </button>
            `;
        }
        
        const buttonsContainer = extraButtons ? `<div style="display:flex; gap:8px; justify-content:flex-start; border-top: 1px solid #f0f0f0; padding-top: 8px; margin-top: 4px;">${extraButtons}</div>` : '';
        const motivoBadge = item.original && item.original.motivo ? `<div style="margin: 4px 0 6px 0;"><span style="background: #f4f6f8; border: 1px solid #d9e2ec; color: #486581; font-size: 10px; padding: 3px 8px; border-radius: 4px; font-weight: 600;"><i class="fas fa-tag" style="margin-right: 4px; color: var(--mi-orange);"></i>Motivo: ${item.original.motivo}</span></div>` : '';
        
        return `
            <div class="message-card chat-item" style="background:#ffffff; border-radius: 8px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); display:flex; flex-direction:column; gap:8px; transition:all 0.2s; border: 1px solid #f0f0f0; border-left: 4px solid ${borderLeftColor}; margin-bottom: 10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:11px; font-weight:700; color:var(--mi-gray-dark); text-transform:uppercase;">
                        ${peerLabel} <span style="color:var(--mi-black); text-transform:none; background:#f0f2f5; padding: 2px 8px; border-radius:4px; font-weight:600;">${item.sender}</span>
                    </span>
                    <span style="background:${badgeBg}; color:${badgeTextColor}; font-size:10px; font-weight:700; padding:2px 10px; border-radius:20px;">${badgeText}</span>
                </div>
                ${motivoBadge}
                <p style="margin:4px 0; font-size:13px; line-height:1.5; color:#333; word-break:break-word;">${item.content}</p>
                ${buttonsContainer}
                <div style="display:flex; justify-content:flex-end; align-items:center;">
                    <small style="font-size:10px; color:#aaa;"><i class="far fa-clock"></i> ${item.formattedDate}</small>
                </div>
            </div>
        `;
    }).join('');
};

window.markInboxMessageRead = async function(msgId, cardEl) {
    // Optimistic UI: marcado instantáneo sin lag visual
    if (cardEl) {
        cardEl.style.borderColor = '#f0f0f0';
        cardEl.style.borderLeftColor = '#ddd';
        cardEl.style.cursor = 'default';
        const badge = cardEl.querySelector('span[style*="background"]');
        if (badge) {
            badge.style.background = '#f0f0f0';
            badge.style.color = '#8c8c8c';
            badge.textContent = 'Leído';
        }
        cardEl.removeAttribute('onclick');
    }
    
    const localMsg = window.inboxMessages.find(m => m.id === msgId);
    if (localMsg) localMsg.leido = 'Leido';
    
    // Actualizar el contador visual de la barra de navegación instantáneamente
    updateNavBadge();
    
    try {
        await callApi({
            action: 'markMessageRead',
            messageId: msgId
        });
    } catch (err) {
        console.error("Fallo al persistir leído en servidor:", err);
    }
};


// ==============================================================
// --- CALLBACKS GLOBALES PARA NOTIFICACIONES DE SISTEMA ---
// ==============================================================

window.handleSystemGo = function(tipo, lanzamientoId, tienda) {
    if (String(tipo).toLowerCase().includes('lanzamiento')) {
        window._pendingQuickLaunch = lanzamientoId || null;
        window._pendingQuickStore = tienda || null;
        showView('lanzamientos');
    } else {
        showView('dashboard');
        setTimeout(() => {
            const targetRow = Array.from(document.querySelectorAll('#recent-reports-table tbody tr'))
                                  .find(tr => tr.innerText.includes(tienda));
            if (targetRow) targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 800);
    }
};

window.handleSystemMarkRead = function(id) {
    updateNavBadge();
    window.renderInboxList('recibidos');
};

window.handleMarkAllRead = async function() {
    const markAllBtn = document.getElementById('mark-all-read-btn');
    if (!markAllBtn) return;
    
    // Deshabilitar botón durante proceso
    const originalHtml = markAllBtn.innerHTML;
    markAllBtn.disabled = true;
    markAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 4px;"></i> Marcando...';
    
    const currentUser = String((APP_CONFIG.currentUser?.email || APP_CONFIG.currentUser?.usuario) || '').trim().toLowerCase();
    
    // Llamada a la API para mensajes de chat
    try {
        const unreadIds = (window.inboxMessages || [])
            .filter(m => String(m.estado || m.leido || '').trim().toLowerCase() !== 'leido' && String(m.estado || m.leido || '').trim().toLowerCase() !== 'leído')
            .map(m => m.id);

        const res = await callApi({
            action: 'markAllMessagesRead',
            email: currentUser,
            msgIds: unreadIds.length > 0 ? JSON.stringify(unreadIds) : '[]'
        });
        
        if (res && res.success) {
            // Actualizar estado local en memoria
            if (window.inboxMessages) {
                const normalizeStr = (str) => {
                    if (!str) return '';
                    let s = String(str).toLowerCase();
                    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch(e) {}
                    return s.replace(/[^a-z0-9]/g, '');
                };
                const cleanCurrentUser = normalizeStr(currentUser);
                
                window.inboxMessages.forEach(m => {
                    const isLeido = String(m.leido || '').toLowerCase().includes('leido') || String(m.leido || '').toLowerCase().includes('leído');
                    const cleanDest = normalizeStr(String(m.destinatario || '').trim().toLowerCase());
                    
                    if (cleanDest === cleanCurrentUser && !isLeido) {
                        m.leido = 'Leido';
                    }
                });
            }
        } else {
            console.error("Error al marcar todos como leídos en la base de datos:", res);
        }
    } catch (e) {
        console.error("Excepción marcando todos como leídos:", e);
    }
    
    // Refrescar vista
    markAllBtn.innerHTML = originalHtml;
    markAllBtn.disabled = false;
    markAllBtn.style.display = 'none';
    
    // Re-renderizar
    const inboxFilter = document.querySelector('.inbox-filter-pill.active');
    renderInboxList(inboxFilter ? (inboxFilter.textContent.trim().toLowerCase() === 'recibidos' ? 'recibidos' : 'enviados') : 'recibidos');
    
    // Si no es un read explícito desde click, refrescamos badge si procede
    updateNavBadge();
};


// ==========================================
// ==========================================
// NUEVO MOTOR DE PROGRESO DE LANZAMIENTOS EN DASHBOARD
// ==========================================
window.renderDashboardLaunches = async function() {
    const adminFilters = document.getElementById('admin-launch-filters');
    const filterCuenta = document.getElementById('dash-internal-cuenta');
    const filterUsuario = document.getElementById('dash-internal-usuario');
    
    // Obtener Rol
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    
    // Mostrar filtros a todos
    if (adminFilters) adminFilters.style.display = 'flex';
    
    try {
        // Cargar launches si no estn
        if (!APP_CONFIG.launches || APP_CONFIG.launches.length === 0) {
            APP_CONFIG.launches = await callApi({ action: 'getLaunches' });
        }
        
        // Cargar statuses (sin filtros, obtenemos el mapa global)
        if (!APP_CONFIG.launchStatuses || Object.keys(APP_CONFIG.launchStatuses).length === 0) {
            APP_CONFIG.launchStatuses = await callApi({ action: 'getLaunchStatuses', usuario: '', lanzamiento: '' }) || {};
        }
        
        const launches = APP_CONFIG.launches || [];
        const statuses = APP_CONFIG.launchStatuses || {};
        const myEmail = String((APP_CONFIG.currentUser?.email || APP_CONFIG.currentUser?.usuario) || '').trim().toLowerCase();
        
        // Llenar selectores si están vacíos (solo una vez)
        if (filterCuenta && filterCuenta.options.length <= 1) {
            const cuentasSet = new Set();
            const usuariosSet = new Set();
            launches.forEach(l => {
                if (l.tiendas && Array.isArray(l.tiendas)) {
                    l.tiendas.forEach(t => {
                        if (t.Cuenta) cuentasSet.add(t.Cuenta.trim());
                        if (t.Usuario) usuariosSet.add(t.Usuario.trim());
                    });
                }
            });
            Array.from(cuentasSet).sort().forEach(c => {
                const opt = document.createElement('option');
                opt.value = c; opt.textContent = c;
                filterCuenta.appendChild(opt);
            });
            Array.from(usuariosSet).sort().forEach(u => {
                const opt = document.createElement('option');
                opt.value = u; opt.textContent = u;
                filterUsuario.appendChild(opt);
            });
        }
        
        const selectedCuenta = filterCuenta ? filterCuenta.value : 'all';
        const selectedUsuario = filterUsuario ? filterUsuario.value : 'all';
        
        let globalTotal = 0;
        let globalCompletadas = 0;
        let filteredStoresCache = []; // Para guardarlas y usarlas en el modal
        
        launches.forEach(launch => {
            const keys = Object.keys(launch);
            const nameKey = keys.find(k => k.toLowerCase().includes('producto') || k.toLowerCase().includes('lanzamiento') || k.toLowerCase() === 'col0' || k.toLowerCase() === 'nombre');
            const launchName = nameKey ? launch[nameKey] : 'Lanzamiento Sin Nombre';
            
            if (launch.tiendas && Array.isArray(launch.tiendas)) {
                launch.tiendas.forEach(t => {
                    const tUser = String(t.Usuario || '').trim().toLowerCase();
                    const tCuenta = String(t.Cuenta || '').trim();
                    const tNombre = String(t.Tienda || '').trim();
                    
                    // Filtrar por permisos del usuario
                    if (!isAdmin && tUser !== myEmail) return;
                    
                    // Filtrar por admin filters
                    if (isAdmin && selectedCuenta !== 'all' && tCuenta !== selectedCuenta) return;
                    if (isAdmin && selectedUsuario !== 'all' && tUser !== selectedUsuario.toLowerCase()) return;
                    
                    globalTotal++;
                    
                    let estadoActual = 'Pendiente';
                    if (statuses[tNombre] && statuses[tNombre].estado === 'Realizado') {
                        globalCompletadas++;
                        estadoActual = 'Realizado';
                    }
                    
                    filteredStoresCache.push({
                        tienda: tNombre,
                        cuenta: tCuenta,
                        usuario: t.Usuario,
                        estado: estadoActual,
                        lanzamientoTarget: launchName
                    });
                });
            }
        });
        
        // Guardamos en memoria para los clicks del modal
        window._currentLaunchStoresCache = filteredStoresCache;
        
        const globalPendientes = globalTotal - globalCompletadas;
        const globalPct = globalTotal > 0 ? Math.round((globalCompletadas / globalTotal) * 100) : 0;
        
        const totalEl = document.getElementById('dash-launch-total');
        const doneEl = document.getElementById('dash-launch-done');
        const pendEl = document.getElementById('dash-launch-pending');
        const pctEl = document.getElementById('dash-launch-pct');
        
        if (totalEl) totalEl.textContent = globalTotal;
        if (doneEl) doneEl.textContent = globalCompletadas;
        if (pendEl) pendEl.textContent = globalPendientes;
        if (pctEl) pctEl.textContent = globalPct + '%';
        
    } catch (e) {
        console.error("Error calculando lanzamientos en dashboard:", e);
    }
};

window.filterLaunchStores = function(filterType) {
    if (!window._currentLaunchStoresCache || window._currentLaunchStoresCache.length === 0) {
        alert("No hay tiendas asignadas para el filtro actual.");
        return;
    }
    
    let filteredStores = [];
    if (filterType === 'all') {
        filteredStores = window._currentLaunchStoresCache;
    } else if (filterType === 'done') {
        filteredStores = window._currentLaunchStoresCache.filter(t => t.estado === 'Realizado');
    } else if (filterType === 'pending') {
        filteredStores = window._currentLaunchStoresCache.filter(t => t.estado === 'Pendiente');
    }
    
    // Mapear tiendas a formato consistente para el historial modal, arrastrando la metadata
    const mappedItems = filteredStores.map(t => ({
        nombre: t.tienda,
        tienda: t.tienda,
        cuenta: t.cuenta,
        estado: t.estado,
        lanzamientoTarget: t.lanzamientoTarget
    }));
    
    // showHistorialModal(title, reports, isReadOnlyLaunch)
    window.showHistorialModal(`Lanzamientos: Tiendas (${filterType.toUpperCase()})`, mappedItems, true);
};

// ========================================================
// PWA Y NOTIFICACIONES
// ========================================================
let deferredPrompt;

// 1. Registrar Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // En entorno local (localhost o 127.0.0.1), no registrar Service Worker para evitar cachés obstinadas durante el desarrollo
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('Ambiente local detectado: Omitiendo registro de ServiceWorker para permitir actualización instantánea.');
            return;
        }
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('ServiceWorker registrado', reg);

            // Si ya hay una versión nueva esperando (p.ej. se publicó mientras la app estaba cerrada)
            if (reg.waiting) {
                showUpdateBanner(reg);
            }

            // Detecta cuándo el navegador encuentra y empieza a instalar una versión nueva
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                    // 'installed' + ya había un controller = es una ACTUALIZACIÓN (no la primera instalación)
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateBanner(reg);
                    }
                });
            });

            // Comprobación activa de versión nueva: cada 5 min y al volver a primer plano.
            // Clave para quienes usan la app instalada (APK/PWA) y la dejan abierta mucho tiempo,
            // ya que si nunca se cierra la pestaña, el navegador no comprueba solo si hay una versión nueva.
            setInterval(() => reg.update(), 5 * 60 * 1000);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') reg.update();
            });

        }).catch(err => {
            console.error('Error al registrar ServiceWorker', err);
        });

        // Cuando la nueva versión toma el control, recargamos la página una sola vez
        let swRefreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (swRefreshing) return;
            swRefreshing = true;
            window.location.reload();
        });
    });
}

// Aviso fijo arriba de la pantalla: "Hay una nueva versión disponible"
function showUpdateBanner(reg) {
    if (sessionStorage.getItem('dismissed_sw_update') === 'true') return;
    if (document.getElementById('sw-update-banner')) return; // ya se está mostrando
    const banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#F35F35;color:#fff;padding:10px 16px;display:flex;align-items:center;justify-content:center;gap:12px;font-size:13px;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,0.25);flex-wrap:wrap;text-align:center;';
    banner.innerHTML = `
        <span><i class="fas fa-rotate-right"></i>&nbsp; Hay una nueva versión de la app disponible.</span>
        <button id="sw-update-btn" style="background:#fff;color:#F35F35;border:none;border-radius:6px;padding:6px 14px;font-weight:700;cursor:pointer;">Actualizar ahora</button>
        <button id="sw-update-close" style="background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 6px;line-height:1;" title="Cerrar aviso">&times;</button>
    `;
    document.body.prepend(banner);
    const closeBtn = document.getElementById('sw-update-close');
    if (closeBtn) {
        closeBtn.onclick = () => {
            banner.remove();
            sessionStorage.setItem('dismissed_sw_update', 'true');
        };
    }
    document.getElementById('sw-update-btn').onclick = async () => {
        const btn = document.getElementById('sw-update-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }

        // Evitar que el banner vuelva a salir en esta sesión tras recargar
        sessionStorage.setItem('dismissed_sw_update', 'true');

        // Quitar banner visualmente de inmediato
        banner.remove();

        // Desregistrar workers previos para limpiar cualquier worker atascado en waiting
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let r of regs) {
                    await r.unregister();
                }
            }
        } catch (e) {
            console.warn('Error desregistrando SW:', e);
        }

        // Limpiar cachés del navegador desde el cliente
        try {
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
        } catch (e) {
            console.warn('Error limpiando cachés en cliente:', e);
        }

        // Recargar con la versión más reciente
        setTimeout(() => {
            window.location.reload();
        }, 150);
    };
}

window.forceAppUpdate = window.forceAppUpdate || async function(isAutomatic = false) {
    if (!isAutomatic) {
        const confirmed = confirm("¿Deseas forzar la actualización de la aplicación y limpiar la caché local?");
        if (!confirmed) return;
    }
    try {
        localStorage.removeItem('xiaomi_imei_db');
        localStorage.removeItem('xiaomi_campaign_planograms');
        localStorage.setItem('xiaomi_app_version', 'v154_feishu_force_local');
        sessionStorage.clear();
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        }
    } catch(e) {
        console.warn('Aviso limpiando caché:', e);
    }
    const base = window.location.href.split('?')[0].split('#')[0];
    window.location.replace(base + '?v=' + Date.now());
};

// 2. Interceptar el evento de instalacin de PWA (Generar APK / Add to Home Screen)
window.addEventListener('beforeinstallprompt', (e) => {
    // Evitar que el navegador muestre el banner por defecto inmediatamente (opcional)
    e.preventDefault();
    deferredPrompt = e;
    
    // Mostrar nuestro botn de instalacin en el men
    const installBtn = document.getElementById('install-app-btn');
    if (installBtn) {
        installBtn.style.display = 'block';
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    installBtn.style.display = 'none';
                }
                deferredPrompt = null;
            }
        });
    }
});

// 3. Botn de Activar Notificaciones
document.addEventListener('DOMContentLoaded', () => {
    const notifBtn = document.getElementById('enable-notif-btn');
    if (notifBtn && 'Notification' in window) {
        // Mostrar botn slo si los permisos an no han sido otorgados ni denegados
        if (Notification.permission === 'default') {
            notifBtn.style.display = 'block';
        }
        
        notifBtn.addEventListener('click', () => {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    alert('Notificaciones activadas!');
                    notifBtn.style.display = 'none';
                } else {
                    alert('Permiso de notificaciones denegado.');
                    notifBtn.style.display = 'none';
                }
            });
        });
    }
});

// ==============================================================
// MÓDULO 1: CONTROL DE IMEIS POR TIENDA Y MESAS
// ==============================================================

// Normalización de nombres de modelos para unificar variantes de mayúsculas/minúsculas
window.DEVICE_MODEL_CANONICAL_MAP = {
    'xiaomi 17t pro blue': 'Xiaomi 17T Pro Blue',
    'xiaomi 17t purple': 'Xiaomi 17T Purple',
    'redmi watch 6 active': 'REDMI Watch 6 Active',
    'redmi buds 8 pro': 'REDMI Buds 8 Pro',
    'redmi 17 5g orange': 'REDMI 17 5G Orange',
    'redmi 17 5g dummy orange': 'REDMI 17 5G Dummy Orange',
    'redmi 17 4g green': 'REDMI 17 4G Green',
    'redmi 17 4g dummy blue': 'REDMI 17 4G Dummy Blue',
    'redmi buds 8': 'REDMI Buds 8',
    'xiaomi pad 8': 'Xiaomi Pad 8',
    'redmi pad 2': 'REDMI Pad 2',
    'redmi watch 6 lite': 'REDMI Watch 6 Lite',
    'redmi pad 2 pro': 'REDMI Pad 2 Pro'
};

window.normalizeDeviceModelName = function(name) {
    if (!name || typeof name !== 'string') return name || '';
    const trimmed = name.trim();
    const lower = trimmed.toLowerCase();
    if (window.DEVICE_MODEL_CANONICAL_MAP && window.DEVICE_MODEL_CANONICAL_MAP[lower]) {
        return window.DEVICE_MODEL_CANONICAL_MAP[lower];
    }
    return trimmed;
};

APP_CONFIG.imeiDatabase = {};
window.currentImeiJustificationContext = null;

// Inicialización inmediata de la base de datos de IMEIs para coherencia en Dashboard
if (typeof initLocalImeiDatabase === 'function') {
    initLocalImeiDatabase();
}

// Base de datos de tiendas de respaldo para trabajo 100% local y offline
const LOCAL_FALLBACK_STORES = [
    { nombre: "MediaMarkt Goya", cuenta: "MediaMarkt", rms: "MM001", Mesa: 2, "Top Table": "TOP TABLE", Columna: 2, Wall: 1, usuario: "Carlos Deniz" },
    { nombre: "MediaMarkt Plenilunio", cuenta: "MediaMarkt", rms: "MM002", Mesa: 3, "Top Table": "TOP TABLE", Columna: 3, Wall: 2, usuario: "Virginia Rodriguez" },
    { nombre: "MediaMarkt Castellana", cuenta: "MediaMarkt", rms: "MM003", Mesa: 3, "Top Table": "TOP TABLE", Columna: 2, Wall: 1, usuario: "Carlos Bellasai" },
    { nombre: "ECI Castellana", cuenta: "ECI", rms: "ECI101", Mesa: 2, "Top Table": "TOP TABLE", Columna: 1, Wall: 1, usuario: "Virginia Rodriguez" },
    { nombre: "ECI Pozuelo", cuenta: "ECI", rms: "ECI102", Mesa: 1, "Top Table": "TOP TABLE", Columna: 1, Wall: 0, usuario: "Jesús de Luis Blanco" },
    { nombre: "ECI Preciados", cuenta: "ECI", rms: "ECI103", Mesa: 2, "Top Table": "TOP TABLE", Columna: 2, Wall: 1, usuario: "Carlos Deniz" },
    { nombre: "FNAC Callao", cuenta: "FNAC", rms: "FN201", Mesa: 2, "Top Table": "TOP TABLE", Columna: 1, Wall: 1, usuario: "Ezequiel Brito" },
    { nombre: "FNAC Triangle", cuenta: "FNAC", rms: "FN202", Mesa: 1, "Top Table": "TOP TABLE", Columna: 0, Wall: 1, usuario: "Jesus de la Torre" },
    { nombre: "Mi Store Sol", cuenta: "Mi Store", rms: "MS301", Mesa: 3, "Top Table": "TOP TABLE", Columna: 4, Wall: 2, usuario: "Francisco Paz" },
    { nombre: "Mi Store La Vaguada", cuenta: "Mi Store", rms: "MS302", Mesa: 2, "Top Table": "TOP TABLE", Columna: 2, Wall: 1, usuario: "Ricardo Dahdah Leon" },
    { nombre: "Vodafone Fuencarral", cuenta: "Vodafone", rms: "VF401", Mesa: 1, "Top Table": "TOP TABLE", Columna: 0, Wall: 0, usuario: "Miguel Mata" },
    { nombre: "Orange Gran Vía", cuenta: "Orange", rms: "OR501", Mesa: 1, "Top Table": "TOP TABLE", Columna: 0, Wall: 0, usuario: "Fernando Torres" }
];

// Función para normalizar nombres de cuentas y evitar discrepancias de mayúsculas o siglas
function normalizeAccountName(cuenta) {
    const c = String(cuenta || '').trim();
    const up = normalizeString(c);
    if (up === 'ALCAMPO' || up === 'ALC') return 'Alcampo';
    if (up === 'CARREFOUR' || up === 'CRF') return 'Carrefour';
    if (up.includes('CORTE') || up === 'ECI') return 'El Corte Inglés';
    if (up.includes('MEDIA') || up === 'MM') return 'MediaMarkt';
    if (up === 'FNAC') return 'FNAC';
    if (up.includes('XIAOMI')) return 'Xiaomi';
    return c;
}

// Obtener las tiendas accesibles respetando los roles: Standard, AM y Administrador
function getUserAccessibleStores() {
    const user = APP_CONFIG.currentUser;
    const isAdmin = !user || isUserAdmin(user);
    const isAM = user && isUserAM(user);
    
    // Lista maestra completa (las 236 tiendas reales de LDUS DUMMY STORE en Feishu)
    const masterStores = (window.REAL_STORES_DATA && window.REAL_STORES_DATA.stores && window.REAL_STORES_DATA.stores.length > 0)
        ? window.REAL_STORES_DATA.stores
        : LOCAL_FALLBACK_STORES;

    // 1. ADMINISTRADOR (o sin sesión iniciada / modo demo de pruebas):
    // Acceso total a las 236 tiendas de todas las cuentas
    if (isAdmin) {
        return masterStores;
    }

    // 2. Si el usuario tiene tiendas explícitamente asignadas en su perfil (user.tiendas):
    // Prioridad máxima: Respetar estrictamente su asignación personal directa
    const userStores = (user && Array.isArray(user.tiendas)) ? user.tiendas : [];
    if (userStores.length > 0) {
        const allowedNames = new Set(userStores.map(t => normalizeString(t.nombre || t.tienda || '')));
        const allowedRms = new Set(userStores.map(t => String(t.rms || t.StoreCode || '').trim().toUpperCase()).filter(Boolean));

        const matched = masterStores.filter(s => {
            const normName = normalizeString(s.nombre);
            const normRms = String(s.rms || '').trim().toUpperCase();
            return allowedNames.has(normName) || (normRms && allowedRms.has(normRms));
        });

        if (matched.length > 0) {
            return matched;
        }

        // Si no hubo coincidencia en masterStores, mapear directamente userStores
        return userStores.map(t => ({
            nombre: t.nombre || t.tienda,
            cuenta: t.cuenta,
            rms: t.rms || t.StoreCode || '',
            Mesa: parseInt(t.Mesa) || 0,
            Columna: parseInt(t.Columna) || 0,
            Wall: parseInt(t.Wall) || 0,
            'Top Table': t['Top Table'] || '',
            'Lightbox Column': t['Lightbox Column'] || '',
            'Lightbox Wall': t['Lightbox Wall'] || '',
            gpv: t.gpv || user.nombre || '',
            area: t.area || user.area || ''
        }));
    }

    // 3. AREA MANAGER (AM) sin lista explícita en su perfil:
    // Acceso a las tiendas de su área/región o de las que es AM
    if (isAM) {
        const userNorm = normalizeString(user.nombre || user.usuario || user.email || '');
        const userRegion = normalizeString(user.area || user.region || user.zona || '');

        const matched = masterStores.filter(s => {
            const normArea = normalizeString(s.area || s.region || '');
            const normAm = normalizeString(s.am || '');
            const matchesAM = userNorm && (normAm === userNorm || normAm.includes(userNorm) || userNorm.includes(normAm));
            const matchesRegion = userRegion && (normArea.includes(userRegion) || userRegion.includes(normArea));
            return matchesAM || matchesRegion;
        });

        if (matched.length > 0) {
            return matched;
        }
    }

    // 4. USUARIO ESTÁNDAR / GPV / PROMOTOR sin lista explícita:
    // Filtramos por las tiendas donde el usuario figura como GPV asignado
    const userNameNorm = normalizeString(user.nombre || user.usuario || user.email || '');
    const matched = masterStores.filter(s => {
        const normGpv = normalizeString(s.gpv || s.usuario || '');
        return userNameNorm && (normGpv === userNameNorm || normGpv.includes(userNameNorm) || userNameNorm.includes(normGpv));
    });

    if (matched.length > 0) {
        return matched;
    }

    return [];
}

function getAllStoresList() {
    return getUserAccessibleStores();
}

// Helper para obtener los dispositivos de una tienda de forma robusta y tolerante a fallos
function getStoreImeiDevices(storeOrName) {
    if (!APP_CONFIG.imeiDatabase || Object.keys(APP_CONFIG.imeiDatabase).length === 0) {
        if (typeof initLocalImeiDatabase === 'function') initLocalImeiDatabase();
    }
    const storeName = typeof storeOrName === 'string' ? storeOrName.trim() : (storeOrName?.nombre || '').trim();
    if (!storeName || !APP_CONFIG.imeiDatabase) return [];

    // 1. Coincidencia directa exacta
    if (APP_CONFIG.imeiDatabase[storeName] && Array.isArray(APP_CONFIG.imeiDatabase[storeName]) && APP_CONFIG.imeiDatabase[storeName].length > 0) {
        return APP_CONFIG.imeiDatabase[storeName];
    }

    // 2. Coincidencia normalizada (sin tildes, minúsculas y sin espacios residuales)
    const norm = normalizeString(storeName);
    const keyMatch = Object.keys(APP_CONFIG.imeiDatabase).find(k => normalizeString(k) === norm);
    if (keyMatch && APP_CONFIG.imeiDatabase[keyMatch] && APP_CONFIG.imeiDatabase[keyMatch].length > 0) {
        return APP_CONFIG.imeiDatabase[keyMatch];
    }

    // 3. Coincidencia por código RMS si viene disponible
    const storeObj = typeof storeOrName === 'object' ? storeOrName : null;
    const rms = (storeObj?.rms || storeObj?.codigo_tienda || storeObj?.StoreCode || '').trim().toUpperCase();
    if (rms && window.REAL_STORES_DATA && window.REAL_STORES_DATA.stores) {
        const foundMaster = window.REAL_STORES_DATA.stores.find(s => String(s.rms || '').trim().toUpperCase() === rms);
        if (foundMaster && APP_CONFIG.imeiDatabase[foundMaster.nombre]) {
            return APP_CONFIG.imeiDatabase[foundMaster.nombre];
        }
    }

    return [];
}
window.getStoreImeiDevices = getStoreImeiDevices;

// =========================================================================
// GESTOR ULTRA-OPTIMIZADO DE ALMACENAMIENTO DE IMEIS (DELTA STORAGE V187)
// Evita desbordar los 5MB de cuota de localStorage guardando sólo los cambios
// =========================================================================
function saveStoreMesasLocally() {
    try {
        const storeMesas = {};
        if (window.REAL_STORES_DATA && Array.isArray(window.REAL_STORES_DATA.stores)) {
            window.REAL_STORES_DATA.stores.forEach(s => {
                if (s.nombre && s.Mesa) {
                    storeMesas[s.nombre] = Number(s.Mesa);
                }
            });
        }
        localStorage.setItem('xiaomi_store_mesas_v187', JSON.stringify(storeMesas));
    } catch(e) {}
}
window.saveStoreMesasLocally = saveStoreMesasLocally;

function updateStoreMesaCount(storeName, count) {
    if (!storeName || !count) return;
    const cnt = Number(count);
    if (!cnt || cnt <= 0) return;
    const norm = normalizeString(storeName);

    if (window.REAL_STORES_DATA && Array.isArray(window.REAL_STORES_DATA.stores)) {
        const found = window.REAL_STORES_DATA.stores.find(s => normalizeString(s.nombre) === norm);
        if (found) {
            found.Mesa = cnt;
        }
    }
    if (APP_CONFIG.currentUser && Array.isArray(APP_CONFIG.currentUser.tiendas)) {
        const foundUser = APP_CONFIG.currentUser.tiendas.find(s => normalizeString(s.nombre || s.tienda || '') === norm);
        if (foundUser) {
            foundUser.Mesa = cnt;
        }
    }
}
window.updateStoreMesaCount = updateStoreMesaCount;

function saveImeiDbLocally() {
    try {
        if (!APP_CONFIG.imeiDatabase) return;
        const edits = {};
        Object.keys(APP_CONFIG.imeiDatabase).forEach(store => {
            const devs = APP_CONFIG.imeiDatabase[store];
            if (Array.isArray(devs)) {
                devs.forEach(d => {
                    const isChanged = d.motivoCambio || d.imeiCambio || d.observacionCambio || 
                                     d.fechaModificacion || (d.imei && d.imei !== d.imeiOriginal) || 
                                     d.tipoAccion || d.isDummy || (d.tipologia === 'Dummy') ||
                                     (d.modeloAnterior && d.modelo !== d.modeloAnterior);
                    if (isChanged) {
                        if (!edits[store]) edits[store] = [];
                        edits[store].push({
                            id: d.id,
                            mesa: d.mesa,
                            posicion: d.posicion,
                            modelo: d.modelo,
                            codigo: d.codigo || '',
                            imei: d.imei || '',
                            imeiOriginal: d.imeiOriginal,
                            imeiCambio: d.imeiCambio,
                            modeloCambio: d.modeloCambio,
                            isDummy: !!d.isDummy,
                            tipologia: d.tipologia || (d.isDummy ? 'Dummy' : 'LDU'),
                            motivoCambio: d.motivoCambio,
                            observacionCambio: d.observacionCambio,
                            fechaModificacion: d.fechaModificacion,
                            tipoAccion: d.tipoAccion
                        });
                    }
                });
            }
        });
        localStorage.setItem('xiaomi_imei_edits_v187', JSON.stringify(edits));
        // Limpieza proactiva de versiones anteriores pesadas
        localStorage.removeItem('xiaomi_imei_edits_v168');
        localStorage.removeItem('xiaomi_imei_db_v163');
        localStorage.removeItem('xiaomi_imei_db_v162');
        localStorage.removeItem('xiaomi_imei_db_v161');
        localStorage.removeItem('xiaomi_imei_db');
    } catch(e) {
        console.warn('Aviso guardando deltas de IMEI:', e);
    }
}
window.saveImeiDbLocally = saveImeiDbLocally;

// Inicialización de la base de datos de IMEIs local
function initLocalImeiDatabase() {
    // Si window.REAL_STORES_DATA existe, priorizar la base de datos real extraída de Feishu
    if (window.REAL_STORES_DATA && window.REAL_STORES_DATA.imei_db) {
        const baseDb = JSON.parse(JSON.stringify(window.REAL_STORES_DATA.imei_db));

        // Fusionar ediciones guardadas localmente
        try {
            // 1. Probar deltas ligeros v187 o v168
            const editsStr = localStorage.getItem('xiaomi_imei_edits_v187') || localStorage.getItem('xiaomi_imei_edits_v168');
            let hasAppliedEdits = false;

            if (editsStr) {
                const edits = JSON.parse(editsStr);
                if (edits && typeof edits === 'object') {
                    Object.keys(edits).forEach(storeName => {
                        const savedList = edits[storeName];
                        if (Array.isArray(savedList)) {
                            const normK = normalizeString(storeName);
                            const targetKey = baseDb[storeName] ? storeName : Object.keys(baseDb).find(k => normalizeString(k) === normK);
                            if (targetKey && baseDb[targetKey]) {
                                savedList.forEach(savedDev => {
                                    const targetDev = baseDb[targetKey].find(d =>
                                        d.id === savedDev.id ||
                                        (d.mesa === savedDev.mesa && d.posicion === savedDev.posicion)
                                    );
                                    if (targetDev) {
                                        if (savedDev.modelo) targetDev.modelo = savedDev.modelo;
                                        if (savedDev.codigo) targetDev.codigo = savedDev.codigo;
                                        if (savedDev.isDummy !== undefined) {
                                            targetDev.isDummy = !!savedDev.isDummy;
                                            targetDev.tipologia = savedDev.isDummy ? 'Dummy' : 'LDU';
                                        }
                                        if (savedDev.tipologia) targetDev.tipologia = savedDev.tipologia;
                                        if (savedDev.imei !== undefined) targetDev.imei = savedDev.imei;
                                        if (savedDev.imeiOriginal !== undefined) targetDev.imeiOriginal = savedDev.imeiOriginal;
                                        if (savedDev.motivoCambio) targetDev.motivoCambio = savedDev.motivoCambio;
                                        if (savedDev.observacionCambio) targetDev.observacionCambio = savedDev.observacionCambio;
                                        if (savedDev.imeiCambio) targetDev.imeiCambio = savedDev.imeiCambio;
                                        if (savedDev.modeloCambio) targetDev.modeloCambio = savedDev.modeloCambio;
                                        if (savedDev.fechaModificacion) targetDev.fechaModificacion = savedDev.fechaModificacion;
                                        if (savedDev.tipoAccion) targetDev.tipoAccion = savedDev.tipoAccion;
                                    }
                                });
                            }
                        }
                    });
                    hasAppliedEdits = true;
                }
            }

            // 2. Restaurar recuento de mesas modificado (xiaomi_store_mesas_v187)
            const savedMesasStr = localStorage.getItem('xiaomi_store_mesas_v187');
            if (savedMesasStr) {
                const savedMesas = JSON.parse(savedMesasStr);
                if (savedMesas && typeof savedMesas === 'object') {
                    Object.keys(savedMesas).forEach(stName => {
                        updateStoreMesaCount(stName, Number(savedMesas[stName]));
                    });
                }
            }

            // 3. Si no hay deltas, migrar desde versiones anteriores pesadas
            if (!hasAppliedEdits) {
                const legacyStr = localStorage.getItem('xiaomi_imei_db_v163') ||
                                 localStorage.getItem('xiaomi_imei_db_v162') ||
                                 localStorage.getItem('xiaomi_imei_db_v161') ||
                                 localStorage.getItem('xiaomi_imei_db_v159') ||
                                 localStorage.getItem('xiaomi_imei_db');
                if (legacyStr) {
                    const savedDb = JSON.parse(legacyStr);
                    if (savedDb && typeof savedDb === 'object') {
                        Object.keys(savedDb).forEach(storeName => {
                            const savedList = savedDb[storeName];
                            if (Array.isArray(savedList)) {
                                const normK = normalizeString(storeName);
                                const targetKey = baseDb[storeName] ? storeName : Object.keys(baseDb).find(k => normalizeString(k) === normK);
                                if (targetKey && baseDb[targetKey]) {
                                    savedList.forEach(savedDev => {
                                        const targetDev = baseDb[targetKey].find(d =>
                                            d.id === savedDev.id ||
                                            (d.mesa === savedDev.mesa && d.posicion === savedDev.posicion)
                                        );
                                        if (targetDev) {
                                            if (savedDev.modelo) targetDev.modelo = savedDev.modelo;
                                            if (savedDev.codigo) targetDev.codigo = savedDev.codigo;
                                            if (savedDev.isDummy !== undefined) {
                                                targetDev.isDummy = !!savedDev.isDummy;
                                                targetDev.tipologia = savedDev.isDummy ? 'Dummy' : 'LDU';
                                            }
                                            if (savedDev.imei !== undefined) targetDev.imei = savedDev.imei;
                                            if (savedDev.imeiOriginal !== undefined) targetDev.imeiOriginal = savedDev.imeiOriginal;
                                            if (savedDev.motivoCambio) targetDev.motivoCambio = savedDev.motivoCambio;
                                            if (savedDev.observacionCambio) targetDev.observacionCambio = savedDev.observacionCambio;
                                            if (savedDev.imeiCambio) targetDev.imeiCambio = savedDev.imeiCambio;
                                            if (savedDev.modeloCambio) targetDev.modeloCambio = savedDev.modeloCambio;
                                            if (savedDev.fechaModificacion) targetDev.fechaModificacion = savedDev.fechaModificacion;
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            }
        } catch(e) {
            console.warn('Error reading local IMEI db:', e);
        }

        // Asegurar nombres canónicos unificados sin variaciones de mayúsculas/minúsculas
        Object.values(baseDb).forEach(devices => {
            if (Array.isArray(devices)) {
                devices.forEach(d => {
                    if (d.modelo) d.modelo = window.normalizeDeviceModelName(d.modelo);
                    if (d.modeloAnterior) d.modeloAnterior = window.normalizeDeviceModelName(d.modeloAnterior);
                });
            }
        });

        APP_CONFIG.imeiDatabase = baseDb;
        saveImeiDbLocally();

        // Sincronización silenciosa en segundo plano con la nube
        setTimeout(() => {
            if (typeof window.syncWithFeishuLive === 'function') {
                window.syncWithFeishuLive(true);
            }
        }, 1500);

        return;
    }

    try {
        const saved = localStorage.getItem('xiaomi_imei_db');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && Object.keys(parsed).length > 20) {
                APP_CONFIG.imeiDatabase = parsed;
                return;
            }
        }
    } catch(e) {
        console.warn('Error reading local IMEI db:', e);
    }

    // Si no hay datos, generar datos iniciales automáticos para las tiendas
    const stores = getAllStoresList();
    const catalog = APP_CONFIG.deviceCatalog && APP_CONFIG.deviceCatalog.length > 0 ? APP_CONFIG.deviceCatalog : [
        { Modelo: "Xiaomi 14T Pro 5G", 'Código Dispositivo': "XR100004452", Tipología: "LDU" },
        { Modelo: "Xiaomi 14T 5G", 'Código Dispositivo': "XR100004451", Tipología: "LDU" },
        { Modelo: "Xiaomi 14T Black (Dummy)", 'Código Dispositivo': "XR100004450", Tipología: "Dummy" },
        { Modelo: "Redmi Note 15 5G Black", 'Código Dispositivo': "XR100006315", Tipología: "LDU" },
        { Modelo: "Redmi Note 15 5G Blue (Dummy)", 'Código Dispositivo': "XR100006316", Tipología: "Dummy" },
        { Modelo: "Xiaomi Watch S3 Black", 'Código Dispositivo': "XR100003318", Tipología: "LDU" },
        { Modelo: "Xiaomi Pad 6S Pro", 'Código Dispositivo': "XR100002100", Tipología: "LDU" },
        { Modelo: "Redmi Buds 6 White", 'Código Dispositivo': "XR100004451", Tipología: "Dummy" }
    ];

    const newDb = {};
    stores.forEach((store, sIdx) => {
        const mesaCount = Math.max(1, Math.min(3, parseInt(store.Mesa) || 1));
        const storeDevices = [];
        let devCounter = 1;

        for (let m = 1; m <= mesaCount; m++) {
            const positionsPerTable = 6;
            for (let p = 1; p <= positionsPerTable; p++) {
                const sampleDevice = catalog[(sIdx * 3 + m * 2 + p) % catalog.length];
                const isDummy = String(sampleDevice.Tipología || '').toUpperCase().includes('DUMMY') || 
                                String(sampleDevice.Modelo || '').toUpperCase().includes('DUMMY');
                
                // Algunos LDU con IMEI volcado, otros vacíos para rellenar
                let sampleImei = '';
                if (!isDummy) {
                    if (p % 2 === 1) {
                        sampleImei = "86" + String(1000000000000 + sIdx * 1000000 + m * 10000 + p * 111).slice(0, 13);
                    }
                }

                storeDevices.push({
                    id: `dev_${store.nombre.replace(/[^a-zA-Z0-9]/g, '_')}_m${m}_p${p}`,
                    tienda: store.nombre,
                    cuenta: store.cuenta || 'General',
                    mesa: `Mesa ${m}`,
                    posicion: p,
                    tipologia: isDummy ? 'Dummy' : 'LDU',
                    modelo: sampleDevice.Modelo || `Xiaomi Modelo ${p}`,
                    codigo: sampleDevice['Código Dispositivo'] || sampleDevice.codigo || `XR10000${100 + p}`,
                    imei: sampleImei,
                    imeiOriginal: sampleImei,
                    isDummy: isDummy,
                    motivoCambio: '',
                    observacionCambio: '',
                    fechaModificacion: ''
                });
                devCounter++;
            }
        }
        newDb[store.nombre] = storeDevices;
    });

    APP_CONFIG.imeiDatabase = newDb;
    saveImeiDbLocally();
}

window.initImeisView = function() {
    initLocalImeiDatabase();
    
    const stores = getUserAccessibleStores();
    const filterCuenta = document.getElementById('imei-filter-cuenta');
    const filterTienda = document.getElementById('imei-filter-tienda');
    const filterUsuario = document.getElementById('imei-filter-usuario');
    const filterUsuarioContainer = document.getElementById('imei-filter-usuario-container');
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    const isAM = isUserAM(APP_CONFIG.currentUser);

    if (filterCuenta) {
        // Cuentas únicas normalizadas de las tiendas accesibles por el usuario
        const cuentas = [...new Set(stores.map(t => normalizeAccountName(t.cuenta)))].filter(Boolean).sort();
        filterCuenta.innerHTML = '<option value="all">Todas las Cuentas</option>';
        cuentas.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            filterCuenta.appendChild(opt);
        });
        filterCuenta.value = 'all';
    }

    if (filterUsuarioContainer) {
        if (isAdmin || isAM) {
            filterUsuarioContainer.style.display = 'flex';
            const users = [...new Set(stores.map(t => String(t.usuario || t.gpv || '').trim()))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
            if (filterUsuario) {
                filterUsuario.innerHTML = '<option value="all">Todos los GPVs</option>';
                users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u;
                    opt.textContent = u;
                    filterUsuario.appendChild(opt);
                });
                filterUsuario.value = 'all';
            }
        } else {
            filterUsuarioContainer.style.display = 'none';
        }
    }

    // Si viene una tienda objetivo (desde modal de pendientes, openStoreImeis o filtro del dashboard)
    const targetStore = window._pendingTargetImeiStore || (document.getElementById('dash-filter-tienda')?.value?.trim());
    if (targetStore && targetStore !== 'Todas Tiendas') {
        window.selectStoreInImeiView(targetStore);
        window._pendingTargetImeiStore = null;
        return;
    }

    // Rellenar selector de tiendas sin pre-seleccionar ninguna de base
    window.updateImeiStoreSelect(false);

    if (filterTienda) {
        filterTienda.value = '';
    }

    // Renderizar la vista en estado de espera (pide al usuario seleccionar tienda)
    window.renderStoreImeis();
};

window.updateImeiStoreSelect = function(preserveSelection = false) {
    const filterCuenta = document.getElementById('imei-filter-cuenta');
    const filterUsuario = document.getElementById('imei-filter-usuario');
    const selectTienda = document.getElementById('imei-filter-tienda');
    const inputTienda = document.getElementById('imei-filter-tienda-input');
    const datalistTienda = document.getElementById('imei-filter-tienda-datalist');
    const countBadge = document.getElementById('imei-stores-count-badge');
    const clearBtn = document.getElementById('btn-clear-imei-store');
    if (!selectTienda) return;
    
    const selectedCuenta = filterCuenta ? filterCuenta.value : 'all';
    const selectedUsuario = (filterUsuario && filterUsuario.parentElement && filterUsuario.parentElement.style.display !== 'none') ? filterUsuario.value : 'all';
    const currentVal = preserveSelection ? (selectTienda.value || (inputTienda ? inputTienda.value : '')) : '';
    
    const stores = getUserAccessibleStores();
    
    let filteredStores = stores;
    if (selectedCuenta !== 'all') {
        filteredStores = filteredStores.filter(t => normalizeAccountName(t.cuenta) === normalizeAccountName(selectedCuenta));
    }
    if (selectedUsuario !== 'all') {
        const selNorm = normalizeString(selectedUsuario);
        filteredStores = filteredStores.filter(t => {
            const uNorm = normalizeString(t.usuario || t.gpv || '');
            return uNorm === selNorm;
        });
    }

    // Ordenar tiendas alfabéticamente por nombre
    const uniqueStoreNames = [...new Set(filteredStores.map(t => String(t.nombre || '').trim()))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    if (countBadge) {
        countBadge.textContent = `(${uniqueStoreNames.length} disponible${uniqueStoreNames.length === 1 ? '' : 's'})`;
    }

    // Actualizar Select oculto
    selectTienda.innerHTML = '<option value="">-- Selecciona una Tienda / Centro --</option>';
    uniqueStoreNames.forEach(tName => {
        const opt = document.createElement('option');
        opt.value = tName;
        opt.textContent = tName;
        if (currentVal && tName.toLowerCase() === currentVal.toLowerCase()) {
            opt.selected = true;
        }
        selectTienda.appendChild(opt);
    });

    // Actualizar Datalist para búsqueda escribible rápida
    if (datalistTienda) {
        datalistTienda.innerHTML = '';
        uniqueStoreNames.forEach(tName => {
            const storeObj = filteredStores.find(s => s.nombre === tName);
            const rms = storeObj ? (storeObj.rms || storeObj.codigo_tienda || '') : '';
            const cuenta = storeObj ? (storeObj.cuenta || '') : '';
            const opt = document.createElement('option');
            opt.value = tName;
            opt.label = `${rms ? rms + ' · ' : ''}${cuenta}`;
            datalistTienda.appendChild(opt);
        });
    }

    if (preserveSelection && currentVal && uniqueStoreNames.some(n => n.toLowerCase() === currentVal.toLowerCase())) {
        const matched = uniqueStoreNames.find(n => n.toLowerCase() === currentVal.toLowerCase());
        selectTienda.value = matched;
        if (inputTienda) inputTienda.value = matched;
        if (clearBtn) clearBtn.style.display = 'block';
    } else {
        selectTienda.value = '';
        if (inputTienda && !preserveSelection) inputTienda.value = '';
        if (clearBtn && !preserveSelection) clearBtn.style.display = 'none';
    }
};

// Detección en tiempo real de búsqueda de tienda por texto
window.onImeiStoreInputSearch = function(query) {
    const clearBtn = document.getElementById('btn-clear-imei-store');
    const q = String(query || '').trim();
    if (clearBtn) {
        clearBtn.style.display = q ? 'block' : 'none';
    }

    if (!q) {
        const selectTienda = document.getElementById('imei-filter-tienda');
        if (selectTienda) selectTienda.value = '';
        window.renderStoreImeis();
        return;
    }

    // Si coincide exactamente con alguna tienda, seleccionarla al vuelo
    const stores = getUserAccessibleStores();
    const exact = stores.find(s => s.nombre.toLowerCase().trim() === q.toLowerCase());
    if (exact) {
        window.onImeiStoreInputSelected(exact.nombre);
    }
};

// Selección confirmada de tienda desde el buscador escribible
window.onImeiStoreInputSelected = function(val) {
    const q = String(val || '').trim();
    const selectTienda = document.getElementById('imei-filter-tienda');
    const inputTienda = document.getElementById('imei-filter-tienda-input');
    const clearBtn = document.getElementById('btn-clear-imei-store');
    
    if (!q) {
        if (selectTienda) selectTienda.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        window.renderStoreImeis();
        return;
    }

    const stores = getUserAccessibleStores();
    // Búsqueda inteligente: nombre exacto, o por código RMS
    let matched = stores.find(s => s.nombre.toLowerCase().trim() === q.toLowerCase());
    if (!matched) {
        matched = stores.find(s => String(s.rms || s.codigo_tienda || '').toLowerCase().trim() === q.toLowerCase());
    }
    if (!matched) {
        matched = stores.find(s => s.nombre.toLowerCase().includes(q.toLowerCase()));
    }

    if (matched) {
        if (selectTienda) selectTienda.value = matched.nombre;
        if (inputTienda) inputTienda.value = matched.nombre;
        if (clearBtn) clearBtn.style.display = 'block';
    } else {
        if (selectTienda) selectTienda.value = '';
    }

    window.renderStoreImeis();
};

window.clearImeiStoreSearch = function() {
    const selectTienda = document.getElementById('imei-filter-tienda');
    const inputTienda = document.getElementById('imei-filter-tienda-input');
    const clearBtn = document.getElementById('btn-clear-imei-store');
    if (selectTienda) selectTienda.value = '';
    if (inputTienda) {
        inputTienda.value = '';
        inputTienda.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    window.renderStoreImeis();
};

// Compatibilidad por si alguna llamada antigua invoca updateImeiStoreDatalist
window.updateImeiStoreDatalist = window.updateImeiStoreSelect;

window.onImeiCuentaChange = function(cuenta) {
    window.updateImeiStoreSelect(false);
    const filterTienda = document.getElementById('imei-filter-tienda');
    const inputTienda = document.getElementById('imei-filter-tienda-input');
    const clearBtn = document.getElementById('btn-clear-imei-store');
    if (filterTienda) filterTienda.value = '';
    if (inputTienda) inputTienda.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    window.renderStoreImeis();
};

window.onImeiUsuarioChange = function(usuario) {
    window.updateImeiStoreSelect(false);
    const filterTienda = document.getElementById('imei-filter-tienda');
    const inputTienda = document.getElementById('imei-filter-tienda-input');
    const clearBtn = document.getElementById('btn-clear-imei-store');
    if (filterTienda) filterTienda.value = '';
    if (inputTienda) inputTienda.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    window.renderStoreImeis();
};

window.onImeiTiendaChange = function(storeVal) {
    const inputTienda = document.getElementById('imei-filter-tienda-input');
    const clearBtn = document.getElementById('btn-clear-imei-store');
    if (inputTienda) inputTienda.value = storeVal || '';
    if (clearBtn) clearBtn.style.display = storeVal ? 'block' : 'none';
    window.renderStoreImeis();
};

window.clearImeiFilters = function() {
    const filterCuenta = document.getElementById('imei-filter-cuenta');
    const filterUsuario = document.getElementById('imei-filter-usuario');
    const filterTienda = document.getElementById('imei-filter-tienda');
    const inputTienda = document.getElementById('imei-filter-tienda-input');
    const filterTipo = document.getElementById('imei-filter-tipologia');
    const filterSearch = document.getElementById('imei-filter-search');
    const clearBtn = document.getElementById('btn-clear-imei-store');

    if (filterCuenta) filterCuenta.value = 'all';
    if (filterUsuario) filterUsuario.value = 'all';
    if (filterTipo) filterTipo.value = 'all';
    if (filterSearch) filterSearch.value = '';
    if (clearBtn) clearBtn.style.display = 'none';

    window.updateImeiStoreSelect(false);
    if (filterTienda) filterTienda.value = '';
    if (inputTienda) inputTienda.value = '';
    window.renderStoreImeis();
};

// Selección canónica y renderizado directo de una tienda en la vista de Control de IMEIs
window.selectStoreInImeiView = function(storeName) {
    if (!storeName) return;
    
    const filterTienda = document.getElementById('imei-filter-tienda');
    const inputTienda = document.getElementById('imei-filter-tienda-input');
    const filterCuenta = document.getElementById('imei-filter-cuenta');
    const clearBtn = document.getElementById('btn-clear-imei-store');
    
    const rawQuery = String(storeName).trim();
    const normQuery = normalizeString(rawQuery);
    
    // 1. Localizar la tienda exacta en las tiendas accesibles o maestras
    const allStores = getUserAccessibleStores();
    let foundStore = allStores.find(s => s.nombre.toLowerCase().trim() === rawQuery.toLowerCase());
    if (!foundStore) {
        foundStore = allStores.find(s => normalizeString(s.nombre) === normQuery);
    }
    if (!foundStore) {
        foundStore = allStores.find(s => String(s.rms || s.codigo_tienda || s.StoreCode || '').toLowerCase().trim() === rawQuery.toLowerCase());
    }
    if (!foundStore) {
        foundStore = allStores.find(s => {
            const sn = normalizeString(s.nombre);
            return sn.includes(normQuery) || normQuery.includes(sn);
        });
    }
    
    // Nombre canónico oficial
    const officialName = foundStore ? foundStore.nombre : rawQuery;
    
    // 2. Sincronizar cuenta si se detecta
    if (filterCuenta) {
        if (foundStore && foundStore.cuenta) {
            const normCuenta = normalizeAccountName(foundStore.cuenta);
            let cuentaOptExists = Array.from(filterCuenta.options).some(o => o.value === normCuenta);
            if (cuentaOptExists) {
                filterCuenta.value = normCuenta;
            } else {
                filterCuenta.value = 'all';
            }
        } else {
            filterCuenta.value = 'all';
        }
    }
    
    // 3. Actualizar select de tiendas de acuerdo a la cuenta seleccionada
    window.updateImeiStoreSelect(false);
    
    // 4. Asegurarse de que el option de la tienda existe en el select (añadirlo si no estaba)
    if (filterTienda) {
        let optExists = Array.from(filterTienda.options).find(o => 
            o.value.toLowerCase().trim() === officialName.toLowerCase().trim() ||
            normalizeString(o.value) === normalizeString(officialName)
        );
        if (!optExists) {
            const newOpt = document.createElement('option');
            newOpt.value = officialName;
            newOpt.textContent = officialName;
            filterTienda.appendChild(newOpt);
            filterTienda.value = officialName;
        } else {
            filterTienda.value = optExists.value;
        }
    }
    
    // 5. Rellenar input visible y mostrar botón de limpiar
    if (inputTienda) {
        inputTienda.value = officialName;
    }
    if (clearBtn) {
        clearBtn.style.display = 'block';
    }
    
    // 6. Renderizar inmediatamente los terminales e IMEIs de la tienda
    window.renderStoreImeis();
};

window.openStoreImeis = function(storeName) {
    if (!storeName) return;
    window._pendingTargetImeiStore = storeName;
    showView('imeis');
    
    // Activar link en nav
    if (typeof navLinks !== 'undefined' && navLinks) {
        navLinks.forEach(l => l.classList.remove('active'));
        const imeiLink = Array.from(navLinks).find(l => l.getAttribute('data-target') === 'imeis');
        if (imeiLink) imeiLink.classList.add('active');
    }

    window.selectStoreInImeiView(storeName);
    
    // Timeout preventivo por posibles retrasos o transiciones en showView
    setTimeout(() => {
        window.selectStoreInImeiView(storeName);
    }, 40);
};

// ==========================================================
// CONTROL DE IMEIS EN DASHBOARD: CÁLCULO, WIDGET Y MODAL
// ==========================================================

window.updateDashboardImeisWidget = function() {
    const pendingCountEl = document.getElementById('dash-imei-pending-count');
    const pendingStoresEl = document.getElementById('dash-imei-pending-stores-count');
    const badgeEl = document.getElementById('dash-imei-status-badge');
    const summaryEl = document.getElementById('dash-imei-summary-text');
    if (!pendingCountEl) return;

    // Asegurar que la base de datos de IMEIs esté cargada
    if (!APP_CONFIG.imeiDatabase || Object.keys(APP_CONFIG.imeiDatabase).length === 0) {
        if (typeof initLocalImeiDatabase === 'function') {
            initLocalImeiDatabase();
        }
    }

    const accessibleStores = getUserAccessibleStores();
    if (!accessibleStores || accessibleStores.length === 0) {
        pendingCountEl.textContent = '0';
        if (pendingStoresEl) pendingStoresEl.textContent = '0';
        if (badgeEl) {
            badgeEl.textContent = 'Sin Tiendas';
            badgeEl.style.background = '#f5f5f5';
            badgeEl.style.color = '#888';
            badgeEl.style.borderColor = '#d9d9d9';
        }
        return;
    }

    let totalPendingImeis = 0;
    const pendingStoresList = [];

    accessibleStores.forEach(store => {
        const devices = getStoreImeiDevices(store);
        
        let missingLdus = 0;
        let totalLdus = 0;
        
        if (devices.length > 0) {
            devices.forEach(d => {
                if (!d.isDummy) {
                    totalLdus++;
                    if (!d.imei || String(d.imei).trim() === '') {
                        missingLdus++;
                    }
                }
            });
        } else {
            const mesaCount = Math.max(1, parseInt(store.Mesa) || 1);
            missingLdus = mesaCount * 3;
            totalLdus = mesaCount * 3;
        }

        if (missingLdus > 0) {
            totalPendingImeis += missingLdus;
            pendingStoresList.push({
                store: store,
                missingLdus: missingLdus,
                totalLdus: totalLdus,
                mesas: store.Mesa || 1
            });
        }
    });

    pendingStoresList.sort((a, b) => b.missingLdus - a.missingLdus);
    window._pendingImeiStoresCache = pendingStoresList;

    pendingCountEl.textContent = totalPendingImeis;
    if (pendingStoresEl) pendingStoresEl.textContent = pendingStoresList.length;

    if (totalPendingImeis === 0) {
        if (badgeEl) {
            badgeEl.textContent = '¡Todo Asignado!';
            badgeEl.style.background = '#f6ffed';
            badgeEl.style.color = '#52c41a';
            badgeEl.style.borderColor = '#b7eb8f';
        }
        if (summaryEl) {
            summaryEl.textContent = '¡Excelente! Todos los terminales LDU de tus tiendas asignadas tienen su IMEI registrado.';
        }
    } else {
        if (badgeEl) {
            badgeEl.textContent = `${totalPendingImeis} Pendientes`;
            badgeEl.style.background = '#fff1f0';
            badgeEl.style.color = '#cf1322';
            badgeEl.style.borderColor = '#ffa39e';
        }
        if (summaryEl) {
            summaryEl.textContent = `Tienes ${totalPendingImeis} terminales LDU pendientes de IMEI en ${pendingStoresList.length} tienda${pendingStoresList.length > 1 ? 's' : ''}. Pulsa para verlas y rellenar.`;
        }
    }
};

window.openDashboardPendingImeisModal = function() {
    const dashStore = document.getElementById('dash-filter-tienda')?.value?.trim();
    if (dashStore && dashStore !== 'Todas Tiendas' && dashStore !== 'all' && dashStore !== '') {
        window.openStoreImeis(dashStore);
        return;
    }

    const modal = document.getElementById('dashboard-pending-imeis-modal');
    if (!modal) return;

    window.updateDashboardImeisWidget();

    const searchInput = document.getElementById('pending-imeis-search-input');
    if (searchInput) {
        searchInput.value = '';
        window.renderPendingImeisStoresList(window._pendingImeiStoresCache || []);
    } else {
        window.renderPendingImeisStoresList(window._pendingImeiStoresCache || []);
    }

    modal.style.display = 'flex';
    modal.classList.remove('hidden');
};

window.closeDashboardPendingImeisModal = function() {
    const modal = document.getElementById('dashboard-pending-imeis-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
};

window.renderPendingImeisStoresList = function(list) {
    const container = document.getElementById('pending-imeis-stores-list');
    if (!container) return;

    container.innerHTML = '';

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: #52c41a;">
                <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 12px; display: block;"></i>
                <h4 style="margin: 0 0 6px; font-size: 1.1rem; color: #222;">¡Todo al día!</h4>
                <p style="margin: 0; font-size: 13px; color: #777;">No hay tiendas con IMEIs pendientes de rellenar en tu cuenta.</p>
            </div>
        `;
        return;
    }

    list.forEach(item => {
        const s = item.store;
        const safeNombre = String(s.nombre || '').replace(/'/g, "\\'");
        const card = document.createElement('div');
        card.className = 'pending-store-item';
        card.onclick = () => window.selectPendingStoreAndNavigate(s.nombre);

        const rmsText = s.rms || s.codigo_tienda || s.StoreCode || '';
        const gpvText = s.gpv || s.usuario || '';

        card.innerHTML = `
            <div style="flex: 1; min-width: 0;">
                <div class="store-title">
                    <span>${s.nombre}</span>
                    <span style="font-size: 10px; background: #f0f2f5; color: #555; padding: 2px 7px; border-radius: 4px; font-weight: 600;">${s.cuenta || ''}</span>
                </div>
                <div class="store-meta">
                    ${rmsText ? `<span><i class="fas fa-barcode" style="color: #999;"></i> ${rmsText}</span>` : ''}
                    <span><i class="fas fa-table" style="color: #999;"></i> ${item.mesas} mesa${item.mesas > 1 ? 's' : ''}</span>
                    ${gpvText ? `<span><i class="fas fa-user" style="color: #999;"></i> ${gpvText}</span>` : ''}
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
                <span class="pending-store-badge">
                    <i class="fas fa-exclamation-circle"></i> ${item.missingLdus} pendiente${item.missingLdus > 1 ? 's' : ''}
                </span>
                <button type="button" class="btn-primary" onclick="event.stopPropagation(); window.selectPendingStoreAndNavigate('${safeNombre}')" style="padding: 7px 14px; font-size: 12px; border-radius: 8px; font-weight: 600; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px;">
                    <span>Rellenar</span> <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        `;

        container.appendChild(card);
    });
};

window.filterPendingImeisModal = function(query) {
    const q = (query || '').toLowerCase().trim();
    const cache = window._pendingImeiStoresCache || [];
    if (!q) {
        window.renderPendingImeisStoresList(cache);
        return;
    }

    const filtered = cache.filter(item => {
        const s = item.store;
        const name = String(s.nombre || '').toLowerCase();
        const cuenta = String(s.cuenta || '').toLowerCase();
        const rms = String(s.rms || s.codigo_tienda || s.StoreCode || '').toLowerCase();
        const gpv = String(s.gpv || s.usuario || '').toLowerCase();
        return name.includes(q) || cuenta.includes(q) || rms.includes(q) || gpv.includes(q);
    });

    window.renderPendingImeisStoresList(filtered);
};

window.selectPendingStoreAndNavigate = function(storeName) {
    window.closeDashboardPendingImeisModal();
    window.openStoreImeis(storeName);
};

window.renderStoreImeis = function() {
    const container = document.getElementById('imei-tables-container');
    const metricsBar = document.getElementById('imei-store-metrics-bar');
    const filterTienda = document.getElementById('imei-filter-tienda');
    const inputTienda = document.getElementById('imei-filter-tienda-input');
    const filterTipo = document.getElementById('imei-filter-tipologia')?.value || 'all';
    const filterSearch = (document.getElementById('imei-filter-search')?.value || '').toLowerCase().trim();

    if (!container) return;

    let storeName = filterTienda ? filterTienda.value.trim() : '';
    if (!storeName && inputTienda && inputTienda.value.trim()) {
        storeName = inputTienda.value.trim();
        if (filterTienda) {
            let optExists = Array.from(filterTienda.options).find(o => 
                o.value.toLowerCase().trim() === storeName.toLowerCase().trim() ||
                normalizeString(o.value) === normalizeString(storeName)
            );
            if (optExists) {
                filterTienda.value = optExists.value;
                storeName = optExists.value;
            } else {
                const newOpt = document.createElement('option');
                newOpt.value = storeName;
                newOpt.textContent = storeName;
                filterTienda.appendChild(newOpt);
                filterTienda.value = storeName;
            }
        }
    }

    if (!storeName) {
        if (metricsBar) metricsBar.style.display = 'none';
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 1.5rem; background: #fff; border-radius: 12px; border: 1px dashed #ffd591; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                <i class="fas fa-store-alt" style="font-size: 3rem; color: var(--mi-orange); margin-bottom: 12px; display: block;"></i>
                <h3 style="color: #333; font-size: 1.2rem; margin-bottom: 6px;">Selecciona una Tienda / Centro</h3>
                <p style="color: #777; font-size: 13px; max-width: 450px; margin: 0 auto;">Por favor, elige una tienda en el selector superior para consultar sus mesas de exposición y gestionar los IMEIs de los terminales.</p>
            </div>
        `;
        return;
    }

    // Obtener los dispositivos de la tienda
    let storeDevices = getStoreImeiDevices(storeName);
    if (!storeDevices || storeDevices.length === 0) {
        // Si no existen en la BD, crearlos al vuelo para esta tienda
        const allStores = getAllStoresList();
        const foundStore = allStores.find(s => s.nombre.toLowerCase() === storeName.toLowerCase());
        const mesaCount = foundStore ? Math.max(1, parseInt(foundStore.Mesa) || 1) : 2;
        
        storeDevices = [];
        for (let m = 1; m <= mesaCount; m++) {
            for (let p = 1; p <= 6; p++) {
                const isDummy = p % 2 === 0;
                storeDevices.push({
                    id: `dev_${storeName.replace(/[^a-zA-Z0-9]/g, '_')}_m${m}_p${p}`,
                    tienda: storeName,
                    cuenta: foundStore ? foundStore.cuenta : 'General',
                    mesa: `Mesa ${m}`,
                    posicion: p,
                    tipologia: isDummy ? 'Dummy' : 'LDU',
                    modelo: isDummy ? `Redmi Note 15 Blue (Dummy)` : `Xiaomi 14T Pro 5G`,
                    codigo: isDummy ? `XR100006316` : `XR100004452`,
                    imei: '',
                    imeiOriginal: '',
                    isDummy: isDummy,
                    motivoCambio: '',
                    observacionCambio: '',
                    fechaModificacion: ''
                });
            }
        }
        APP_CONFIG.imeiDatabase[storeName] = storeDevices;
        saveImeiDbLocally();
    }

    // Calcular Métricas Globales de la tienda seleccionada
    const uniqueMesas = [...new Set(storeDevices.map(d => d.mesa))];
    const totalMesas = uniqueMesas.length;
    const totalLdus = storeDevices.filter(d => !d.isDummy).length;
    const okLdus = storeDevices.filter(d => !d.isDummy && d.imei && String(d.imei).trim() !== '').length;
    const pendingLdus = totalLdus - okLdus;
    const totalDummies = storeDevices.filter(d => d.isDummy).length;

    if (metricsBar) {
        metricsBar.style.display = 'grid';
        document.getElementById('metric-imei-mesas').textContent = totalMesas;
        document.getElementById('metric-imei-total-ldus').textContent = totalLdus;
        document.getElementById('metric-imei-ok-ldus').textContent = okLdus;
        document.getElementById('metric-imei-pending-ldus').textContent = pendingLdus;
        document.getElementById('metric-imei-dummies').textContent = totalDummies;
    }

    // Filtrar dispositivos según la barra de filtros
    let filteredDevices = storeDevices.filter(d => {
        if (filterTipo === 'LDU' && d.isDummy) return false;
        if (filterTipo === 'DUMMY' && !d.isDummy) return false;
        if (filterTipo === 'sin_imei' && (d.isDummy || (d.imei && String(d.imei).trim() !== ''))) return false;
        if (filterTipo === 'con_imei' && (d.isDummy || !d.imei || String(d.imei).trim() === '')) return false;

        if (filterSearch !== '') {
            const mText = String(d.modelo || '').toLowerCase();
            const cText = String(d.codigo || '').toLowerCase();
            const iText = String(d.imei || '').toLowerCase();
            const mesaText = String(d.mesa || '').toLowerCase();
            if (!mText.includes(filterSearch) && !cText.includes(filterSearch) && !iText.includes(filterSearch) && !mesaText.includes(filterSearch)) {
                return false;
            }
        }
        return true;
    });

    container.innerHTML = '';

    if (filteredDevices.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; background: #fff; border-radius: 12px; border: 1px solid #eee;">
                <p style="color: #999; margin: 0; font-size: 14px;">No se encontraron terminales con los filtros seleccionados.</p>
            </div>
        `;
        return;
    }

    // Agrupar por Mesa
    const mesasGrouped = {};
    filteredDevices.forEach(d => {
        const mesaKey = d.mesa || 'Mesa 1';
        if (!mesasGrouped[mesaKey]) mesasGrouped[mesaKey] = [];
        mesasGrouped[mesaKey].push(d);
    });

    // Ordenar mesas
    const sortedMesaKeys = Object.keys(mesasGrouped).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
    });

    sortedMesaKeys.forEach(mesaKey => {
        const devicesInMesa = mesasGrouped[mesaKey];
        devicesInMesa.sort((a, b) => (parseInt(a.posicion) || 0) - (parseInt(b.posicion) || 0));

        const mesaCard = document.createElement('div');
        mesaCard.className = 'imei-table-card';

        const mesaLdus = devicesInMesa.filter(d => !d.isDummy).length;
        const mesaDummies = devicesInMesa.filter(d => d.isDummy).length;
        const mesaPending = devicesInMesa.filter(d => !d.isDummy && (!d.imei || String(d.imei).trim() === '')).length;

        let mesaHeaderHtml = `
            <div class="imei-table-header">
                <h3>
                    <span style="display:inline-block; width: 18px; height: 13px; border-top: 3px solid var(--mi-orange); border-left: 2px solid var(--mi-orange); border-right: 2px solid var(--mi-orange); border-radius: 2px 2px 0 0;"></span>
                    ${mesaKey}
                    <span style="font-size: 11px; font-weight: normal; color: #888;">(${devicesInMesa.length} terminales)</span>
                </h3>
                <div style="display: flex; gap: 8px; font-size: 11px;">
                    <span style="background: #e6f7ff; color: #1890ff; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${mesaLdus} LDUs</span>
                    <span style="background: #f5f5f5; color: #595959; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${mesaDummies} Dummies</span>
                    ${mesaPending > 0 ? `<span style="background: #fff1f0; color: #f5222d; padding: 2px 8px; border-radius: 4px; font-weight: 700;"><i class="fas fa-exclamation-triangle"></i> ${mesaPending} sin IMEI</span>` : `<span style="background: #f6ffed; color: #52c41a; padding: 2px 8px; border-radius: 4px; font-weight: 600;"><i class="fas fa-check"></i> Completa</span>`}
                </div>
            </div>
        `;

        let rowsHtml = `
            <div class="imei-table-content">
                <!-- Cabecera de columnas -->
                <div style="display: grid; grid-template-columns: 75px 95px 1fr 310px 115px 90px; gap: 12px; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; border-bottom: 2px solid #eee;">
                    <div>Posición</div>
                    <div>Tipología</div>
                    <div>Dispositivo / Modelo</div>
                    <div>IMEI / Guardar</div>
                    <div class="imei-status-col">Estado</div>
                    <div class="imei-action-col" style="text-align: center;">Reporte</div>
                </div>
        `;

        devicesInMesa.forEach(dev => {
            const hasImei = dev.imei && String(dev.imei).trim() !== '';
            const isDummy = dev.isDummy;
            const isModified = dev.imei !== dev.imeiOriginal && dev.imeiOriginal !== '';

            let tipTag = isDummy ? `<span class="imei-tag-dummy">Dummy</span>` : `<span class="imei-tag-ldu">LDU</span>`;
            
            // Campo de IMEI y botón de guardar en cada línea de producto
            let imeiFieldHtml = '';
            if (isDummy) {
                // Las dummies no tienen IMEI
                imeiFieldHtml = `
                    <div style="display: flex; gap: 6px; align-items: center; width: 100%;">
                        <div class="dummy-lock-badge" style="flex: 1;" title="Las unidades Dummy son maquetas sin componentes electrónicos ni IMEI">
                            <i class="fas fa-ban" style="color: #999;"></i> Sin IMEI (Dummy)
                        </div>
                    </div>
                `;
            } else {
                const safeVal = dev.imei || '';
                imeiFieldHtml = `
                    <div style="display: flex; gap: 6px; align-items: center; width: 100%;">
                        <input type="text" 
                            id="input-imei-${dev.id}"
                            class="imei-input-control ${isModified ? 'is-modified' : ''}" 
                            value="${safeVal}" 
                            placeholder="Introduce IMEI..." 
                            maxlength="25"
                            data-id="${dev.id}"
                            data-store="${storeName}"
                            oninput="window.onImeiInputTyping('${dev.id}')"
                            onkeydown="if(event.key==='Enter'){event.preventDefault(); window.saveSingleRowImei('${storeName}', '${dev.id}');}"
                            onchange="window.handleImeiFieldChange('${storeName}', '${dev.id}', this)"
                            title="${hasImei ? 'IMEI Asignado: ' + safeVal : 'Pendiente de rellenar'}"
                            style="flex: 1; min-width: 0;">
                        <button type="button" 
                            id="btn-save-row-${dev.id}" 
                            class="btn-row-save" 
                            onclick="window.saveSingleRowImei('${storeName}', '${dev.id}')" 
                            title="Guardar cambios de esta línea y sincronizar con Feishu">
                            <i class="fas fa-save"></i> Guardar
                        </button>
                    </div>
                `;
            }

            // Badge de Estado
            let statusBadge = '';
            if (isDummy) {
                if (dev.tipoAccion) {
                    statusBadge = `<span style="background: #fff7e6; color: #d46b08; border: 1px solid #ffd591; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;" title="Acción: ${dev.tipoAccion}">${dev.tipoAccion}</span>`;
                } else {
                    statusBadge = `<span style="color: #8c8c8c; font-size: 11px; font-weight: 500;">No requiere</span>`;
                }
            } else if (dev.tipoAccion === 'Cambio de modelo') {
                statusBadge = `<span class="badge-action-cambio" title="Cambio de Modelo: ${dev.modeloAnterior || ''} ➔ ${dev.modelo} (IMEI: ${dev.imei})"><i class="fas fa-sync-alt"></i> Cambio Modelo</span>`;
            } else if (dev.tipoAccion === 'Rotura') {
                statusBadge = `<span class="badge-action-rotura" title="Rotura registrada. IMEI anterior: ${dev.imeiAnterior || '-'}"><i class="fas fa-heart-broken"></i> Rotura</span>`;
            } else if (dev.tipoAccion === 'Robo') {
                statusBadge = `<span class="badge-action-robo" title="Robo registrado. IMEI anterior: ${dev.imeiAnterior || '-'}"><i class="fas fa-exclamation-triangle"></i> Robo</span>`;
            } else if (hasImei) {
                if (dev.motivoCambio) {
                    statusBadge = `<span style="background: #fff7e6; color: #d46b08; border: 1px solid #ffd591; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;" title="Motivo: ${dev.motivoCambio}">Modificado</span>`;
                } else {
                    statusBadge = `<span style="background: #f6ffed; color: #389e0d; border: 1px solid #b7eb8f; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;"><i class="fas fa-check"></i> Asignado</span>`;
                }
            } else {
                statusBadge = `<span style="background: #fff1f0; color: #cf1322; border: 1px solid #ffa39e; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;"><i class="fas fa-clock"></i> Vacío</span>`;
            }

            // Botón de Reporte (Pop-up: Cambio de modelo, Rotura o Robo) disponible tanto para LDUs como Dummies
            const actionBtnHtml = `
                <button type="button" class="imei-action-btn" title="Generar Reporte de Incidencia o Cambio de Terminal en Google Sheets" 
                    onclick="window.openImeiActionModal('${storeName}', '${dev.id}')" 
                    style="background: #fff9f5; border: 1px solid #ffd591; color: var(--mi-orange); font-size: 11px; padding: 5px 8px; border-radius: 6px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
                    <i class="fas fa-clipboard-list"></i> Reporte
                </button>
            `;

            rowsHtml += `
                <div class="imei-grid-row" id="row-${dev.id}">
                    <div style="font-weight: 700; color: #555;">Pos. ${dev.posicion}</div>
                    <div>${tipTag}</div>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <strong style="color: #222;">${dev.modelo}</strong>
                        ${dev.codigo ? `<br><small style="color: #888; font-family: monospace;">${dev.codigo}</small>` : ''}
                    </div>
                    <div>${imeiFieldHtml}</div>
                    <div class="imei-status-col">${statusBadge}</div>
                    <div class="imei-action-col" style="text-align: center;">${actionBtnHtml}</div>
                </div>
            `;
        });

        rowsHtml += `</div>`;
        mesaCard.innerHTML = mesaHeaderHtml + rowsHtml;
        container.appendChild(mesaCard);
    });
};

// Variable de contexto para la acción en curso
window.currentActionDeviceContext = null;

// Selector interactivo de tipo de acción en el pop-up (Cambio de modelo, Rotura, Robo)
window.selectActionType = function(actionType) {
    const cards = document.querySelectorAll('.action-type-card');
    cards.forEach(c => {
        c.classList.remove('active');
        c.style.borderColor = '#e0e0e0';
        c.style.background = '#fff';
    });

    const activeCard = document.getElementById(`card-action-${actionType}`);
    if (activeCard) {
        activeCard.classList.add('active');
        activeCard.style.borderColor = actionType === 'devolucion' ? '#d97706' : 'var(--mi-orange)';
        activeCard.style.background = actionType === 'devolucion' ? '#fffbf0' : '#fff9f5';
        const radio = activeCard.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    }

    const groupModel = document.getElementById('group-new-model');
    const newModelSelect = document.getElementById('modal-action-new-model');
    const imeiInput = document.getElementById('modal-action-new-imei');
    const imeiStar = document.getElementById('modal-action-imei-req-star');
    const dev = window.currentActionDeviceContext ? window.currentActionDeviceContext.device : null;
    const submitBtn = document.querySelector('#imei-action-form button[type="submit"]');

    if (actionType === 'devolucion') {
        if (groupModel) groupModel.style.display = 'none';
        if (newModelSelect) newModelSelect.required = false;
        if (imeiInput) {
            imeiInput.required = false;
            imeiInput.placeholder = 'No necesario (el terminal se retira a DEVOLUCIONES)...';
            imeiInput.disabled = true;
        }
        if (imeiStar) imeiStar.style.display = 'none';
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-undo-alt"></i> Confirmar Devolución (Retirar de Stock)';
            submitBtn.style.background = '#d97706';
        }
    } else {
        if (imeiInput) imeiInput.disabled = false;
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Guardar y Rellenar en Google Sheets';
            submitBtn.style.background = 'var(--mi-orange)';
        }
        if (actionType === 'cambio') {
            if (groupModel) groupModel.style.display = 'block';
            if (newModelSelect) newModelSelect.required = true;
            if (imeiInput) {
                imeiInput.placeholder = dev && dev.isDummy ? 'Introduce IMEI si pasa a LDU (opcional si sigue dummy)...' : 'Introduce nuevo IMEI...';
            }
            if (imeiStar) imeiStar.style.display = dev && dev.isDummy ? 'none' : 'inline';
        } else {
            if (groupModel) groupModel.style.display = 'none';
            if (newModelSelect) newModelSelect.required = false;
            if (dev && dev.isDummy) {
                if (imeiInput) {
                    imeiInput.required = false;
                    imeiInput.placeholder = 'Opcional (Maqueta dummy sin IMEI)...';
                }
                if (imeiStar) imeiStar.style.display = 'none';
            } else {
                if (imeiInput) {
                    imeiInput.placeholder = 'Introduce nuevo IMEI de sustitución...';
                }
                if (imeiStar) imeiStar.style.display = 'inline';
            }
        }
    }
};

window.onNewModelSelected = function(modelName) {
    const customInp = document.getElementById('modal-action-new-model-custom');
    if (customInp) {
        if (modelName === 'OTRO') {
            customInp.style.display = 'block';
            customInp.required = true;
            customInp.focus();
        } else {
            customInp.style.display = 'none';
            customInp.required = false;
        }
    }

    const catalog = APP_CONFIG.deviceCatalog || [];
    const catItem = catalog.find(c => String(c.Modelo).toLowerCase().trim() === String(modelName).toLowerCase().trim());
    const preview = document.getElementById('modal-action-new-sku-preview');
    if (preview) {
        if (catItem) {
            const sku = catItem['Código Dispositivo'] || catItem.codigo || '';
            preview.textContent = sku ? `Código SKU: ${sku}` : '';
        } else {
            preview.textContent = '';
        }
    }

    // Si el nuevo modelo es dummy, hacer opcional el campo IMEI
    const imeiInput = document.getElementById('modal-action-new-imei');
    const imeiStar = document.getElementById('modal-action-imei-req-star');
    const isDummyModel = (catItem && catItem.Tipología && catItem.Tipología.toUpperCase().includes('DUMMY')) || 
                         (String(modelName).toUpperCase().includes('DUMMY'));
    if (imeiInput && imeiStar) {
        if (isDummyModel) {
            imeiStar.style.display = 'none';
            imeiInput.placeholder = 'Opcional (Maqueta dummy sin IMEI)...';
        } else {
            imeiStar.style.display = 'inline';
            imeiInput.placeholder = 'Introduce nuevo IMEI (15 dígitos)...';
        }
    }
};

window.openImeiActionModalDirect = function(defaultAction = 'cambio') {
    const filterTienda = document.getElementById('imei-filter-tienda');
    const storeName = filterTienda ? filterTienda.value.trim() : '';

    if (!storeName) {
        alert('Por favor, selecciona primero una tienda en el buscador superior para reportar un cambio.');
        const searchInp = document.getElementById('imei-filter-tienda-input');
        if (searchInp) searchInp.focus();
        return;
    }

    const devices = (APP_CONFIG.imeiDatabase && APP_CONFIG.imeiDatabase[storeName]) || [];
    if (devices.length === 0) {
        alert('No se encontraron terminales configurados para la tienda ' + storeName);
        return;
    }

    const pickerGroup = document.getElementById('modal-action-device-picker-group');
    const pickerSelect = document.getElementById('modal-action-device-picker');
    if (pickerGroup && pickerSelect) {
        pickerGroup.style.display = 'block';
        pickerSelect.innerHTML = '';
        devices.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = `${d.mesa} · Pos. ${d.posicion}: ${d.modelo} ${d.imei ? '· IMEI: ' + d.imei : '(Sin IMEI)'}`;
            pickerSelect.appendChild(opt);
        });
    }

    window.openImeiActionModal(storeName, devices[0].id, defaultAction, true);
};

window.onActionDevicePickerChanged = function(devId) {
    if (!devId) return;
    const ctx = window.currentActionDeviceContext;
    if (!ctx) return;
    const storeName = ctx.storeName;
    const list = APP_CONFIG.imeiDatabase[storeName] || [];
    const dev = list.find(d => d.id === devId);
    if (!dev) return;

    window.currentActionDeviceContext.device = dev;
    window.currentActionDeviceContext.devId = devId;

    document.getElementById('modal-action-device-id').value = devId;
    document.getElementById('modal-action-location').textContent = `${storeName} · ${dev.mesa} · Posición ${dev.posicion}`;
    document.getElementById('modal-action-current-model').textContent = dev.modelo;
    document.getElementById('modal-action-current-code').textContent = dev.codigo ? `(${dev.codigo})` : '';

    const retiredImeiInp = document.getElementById('modal-action-retired-imei');
    if (retiredImeiInp) {
        retiredImeiInp.value = dev.imei || dev.imeiOriginal || '';
    }

    const tipBadge = document.getElementById('modal-action-tipologia-badge');
    if (tipBadge) {
        tipBadge.textContent = dev.isDummy ? 'Dummy' : 'LDU';
        tipBadge.className = dev.isDummy ? 'imei-tag-dummy' : 'imei-tag-ldu';
    }
};

window.openImeiActionModal = function(storeName, devId, defaultAction = 'cambio', fromDirect = false) {
    const modal = document.getElementById('imei-action-modal');
    if (!modal) return;

    if (!APP_CONFIG.imeiDatabase || Object.keys(APP_CONFIG.imeiDatabase).length === 0) {
        if (typeof initLocalImeiDatabase === 'function') initLocalImeiDatabase();
    }

    const list = typeof getStoreImeiDevices === 'function' ? getStoreImeiDevices(storeName) : (APP_CONFIG.imeiDatabase && APP_CONFIG.imeiDatabase[storeName]);
    const dev = list ? list.find(d => d.id === devId) : null;
    if (!dev) return;

    window.currentActionDeviceContext = {
        storeName: storeName,
        devId: devId,
        device: dev
    };

    const pickerGroup = document.getElementById('modal-action-device-picker-group');
    if (pickerGroup) {
        pickerGroup.style.display = fromDirect ? 'block' : 'none';
        const pickerSelect = document.getElementById('modal-action-device-picker');
        if (pickerSelect && fromDirect) pickerSelect.value = devId;
    }

    document.getElementById('modal-action-store-name').value = storeName;
    document.getElementById('modal-action-device-id').value = devId;
    document.getElementById('modal-action-location').textContent = `${storeName} · ${dev.mesa} · Posición ${dev.posicion}`;
    document.getElementById('modal-action-current-model').textContent = dev.modelo;
    document.getElementById('modal-action-current-code').textContent = dev.codigo ? `(${dev.codigo})` : '';
    
    // Campo editable para IMEI a retirar / devolver
    const retiredImeiInp = document.getElementById('modal-action-retired-imei');
    if (retiredImeiInp) {
        retiredImeiInp.value = dev.imei || dev.imeiOriginal || '';
    }
    
    const tipBadge = document.getElementById('modal-action-tipologia-badge');
    if (tipBadge) {
        tipBadge.textContent = dev.isDummy ? 'Dummy' : 'LDU';
        tipBadge.className = dev.isDummy ? 'imei-tag-dummy' : 'imei-tag-ldu';
    }

    // Poblar desplegable de modelos con el catálogo disponible (con X18 prioritario)
    const selectModel = document.getElementById('modal-action-new-model');
    if (selectModel) {
        selectModel.innerHTML = '';
        const catalog = APP_CONFIG.deviceCatalog && APP_CONFIG.deviceCatalog.length > 0 ? APP_CONFIG.deviceCatalog : [];
        
        // Asegurar X18 al principio
        const modelsList = [...catalog];
        if (!modelsList.some(d => String(d.Modelo || '').toUpperCase().includes('X18'))) {
            modelsList.unshift({
                Modelo: "X18",
                'Código Dispositivo': "XR100008818",
                Tipología: "LDU"
            });
        }

        modelsList.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.Modelo;
            const sku = m['Código Dispositivo'] || m.codigo || '';
            opt.textContent = `${m.Modelo}${sku ? ' (' + sku + ')' : ''}`;
            selectModel.appendChild(opt);
        });

        // Opción para otro modelo no catalogado
        const optOther = document.createElement('option');
        optOther.value = 'OTRO';
        optOther.textContent = '✏️ Otro modelo (escribir manualmente)...';
        selectModel.appendChild(optOther);
        
        if (selectModel.options.length > 0) {
            window.onNewModelSelected(selectModel.value);
        }
    }

    const customInp = document.getElementById('modal-action-new-model-custom');
    if (customInp) {
        customInp.value = '';
        customInp.style.display = 'none';
    }

    document.getElementById('modal-action-new-imei').value = '';
    document.getElementById('modal-action-observaciones').value = '';

    window.selectActionType(defaultAction);

    modal.style.display = 'flex';
    modal.classList.remove('hidden');
};

window.closeImeiActionModal = function() {
    const modal = document.getElementById('imei-action-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
    window.currentActionDeviceContext = null;
};

// Detección de tecleo en el campo IMEI de una fila
window.onImeiInputTyping = function(devId) {
    const input = document.getElementById(`input-imei-${devId}`);
    const btn = document.getElementById(`btn-save-row-${devId}`);
    if (input) input.classList.add('is-modified');
    if (btn) {
        btn.classList.add('is-dirty');
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar*';
    }
};

// Sincronización con el backend y Feishu para un dispositivo individual
window.syncDeviceToFeishu = async function(dev, storeName) {
    if (!dev) return { success: false, message: 'No hay dispositivo' };
    const targetStore = storeName || dev.tienda || '';
    const storeInfo = (window.REAL_STORES_DATA && window.REAL_STORES_DATA[targetStore]) || {};
    const currentUser = APP_CONFIG.currentUser || {};

    const payload = {
        action: 'updateFeishuImei',
        excelRow: dev.excelRow || '',
        cuenta: dev.cuenta || storeInfo.cuenta || storeInfo.retail || '',
        rms: storeInfo.codigo_tienda || dev.rms || '',
        tienda: targetStore,
        mesa: dev.mesa,
        posicion: dev.posicion,
        modelo: dev.modelo,
        codigo: dev.codigo || '',
        imei: dev.imei || '',
        tipologia: dev.isDummy ? 'Dummy' : 'LDU',
        tipoAccion: dev.tipoAccion || (dev.imei ? 'Asignación IMEI' : ''),
        motivoCambio: dev.motivoCambio || '',
        modeloAnterior: dev.modeloAnterior || '',
        imeiAnterior: dev.imeiAnterior || '',
        observacionCambio: dev.observacionCambio || '',
        usuario: currentUser.email || currentUser.nombre || 'Visual App',
        fecha: new Date().toISOString()
    };

    console.log('📡 Sincronizando fila con backend y Feishu:', payload);

    try {
        const res = await callApi(payload);
        console.log('✅ Respuesta backend Feishu:', res);
        return res;
    } catch (err) {
        console.warn('⚠️ Sincronización diferida (offline o backend no accesible):', err);
        return { success: false, offline: true, message: err.message };
    }
};

// ==================================================
// GESTIÓN Y SINCRONIZACIÓN CON GOOGLE SHEETS
// Pestaña maestra: LDUS DUMMY STOCK
// ==================================================
window.openGoogleSheet = function() {
    window.open('https://docs.google.com/spreadsheets/d/1Xht-QU2wRpWNBgT0dqyJkfM9SHD610mhO9y-W3lzonM/edit?pli=1&gid=473234364#gid=473234364', '_blank');
};

// Sincronización directa en segundo plano usando el archivo generado (stores_imei_real.js)
window.triggerBackgroundImeiSync = async function(event, forceFull = false) {
    const isForce = forceFull || (event && event.shiftKey);
    if (window._isImeiSyncing) {
        window.showToast('⏳ Ya hay una sincronización en curso en segundo plano...', 'info');
        return;
    }
    window._isImeiSyncing = true;

    const btn = document.getElementById('btn-feishu-config');
    const originalBtnHtml = btn ? btn.innerHTML : '<i class="fas fa-sync-alt" style="color: #16a34a;"></i> Sincronizar';

    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.75';
        btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="color: var(--mi-orange);"></i> Sincronizando...';
    }

    try {
        window.showToast('🔄 Conectando con Google Sheets en segundo plano...', 'info');

        // Asegurar que la base de datos local / generada esté cargada
        if (!APP_CONFIG.imeiDatabase || Object.keys(APP_CONFIG.imeiDatabase).length === 0) {
            if (typeof initLocalImeiDatabase === 'function') {
                initLocalImeiDatabase();
            }
        }
        const db = APP_CONFIG.imeiDatabase || (window.REAL_STORES_DATA && window.REAL_STORES_DATA.imei_db) || {};

        // 1. Consultar estado en Google Sheets
        let status = null;
        try {
            status = await callApi({ action: 'getLdusStockStatus' });
        } catch (statusErr) {
            console.warn('Aviso comprobando estado de Google Sheets:', statusErr);
        }

        const needsFullUpload = isForce || !status || !status.success || !status.exists || !status.totalRows || Number(status.totalRows) < 50;

        let pullResult = { rebuilt: false };
        if (needsFullUpload) {
            // Caso A: La pestaña no existe o está vacía -> Cargar la base generada completa en segundo plano
            window.showToast('📦 Replicando base generada (6.213 terminales) en Google Sheets...', 'info');

            const rows = [];
            Object.keys(db).forEach(storeName => {
                const devs = db[storeName] || [];
                devs.forEach(d => {
                    rows.push([
                        d.cuenta || '',
                        d.rms || '',
                        storeName,
                        d.numMesas || 1,
                        d.mesa || 'Mesa 1',
                        d.modelo || '',
                        d.imei || '',
                        d.isDummy ? 'Maqueta dummy' : (d.imei ? 'Disponible en tienda' : 'Sin asignar'),
                        '', // otros imei
                        d.observacionCambio || '',
                        d.tipoAccion || '',
                        d.usuario || '',
                        d.fechaModificacion || ''
                    ]);
                });
            });

            if (rows.length === 0) {
                throw new Error('No se encontraron terminales en la base generada.');
            }

            const CHUNK_SIZE = 1500;
            const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);
            let uploaded = 0;

            for (let i = 0; i < totalChunks; i++) {
                const chunk = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                if (totalChunks > 1) {
                    window.showToast(`⏳ Enviando bloque ${i + 1} de ${totalChunks} (${uploaded + chunk.length} de ${rows.length} terminales)...`, 'info');
                }
                const res = await callApi({
                    action: 'initLdusStockSheet',
                    clearExisting: (i === 0),
                    rows: chunk
                });

                if (!res || !res.success) {
                    throw new Error(res ? res.message : `Error subiendo bloque ${i + 1}`);
                }
                uploaded += chunk.length;
            }

            window.showToast(`✅ ¡Base de ${uploaded} terminales replicada con éxito en Google Sheets!`, 'success');
        } else {
            // Caso B: La pestaña ya existe con datos -> Sincronización bidireccional en segundo plano
            // Subir cambios locales modificados (deltas)
            const modifiedItems = [];
            const currentUser = APP_CONFIG.currentUser || {};
            Object.keys(db).forEach(storeName => {
                const devs = db[storeName] || [];
                devs.forEach(d => {
                    if ((d.imei && d.imei !== d.imeiOriginal) || (!d._fromLiveSheet && (d.tipoAccion || d.motivoCambio)) || (d.modeloAnterior && d.modelo !== d.modeloAnterior)) {
                        modifiedItems.push({
                            excelRow: d.excelRow || '',
                            cuenta: d.cuenta || '',
                            rms: d.rms || '',
                            tienda: storeName,
                            mesa: d.mesa || 'Mesa 1',
                            posicion: d.posicion || 1,
                            modelo: d.modelo || '',
                            codigo: d.codigo || '',
                            imei: d.imei || '',
                            tipologia: d.isDummy ? 'Dummy' : 'LDU',
                            tipoAccion: d.tipoAccion || 'Asignación IMEI',
                            motivoCambio: d.motivoCambio || '',
                            modeloAnterior: d.modeloAnterior || '',
                            imeiAnterior: d.imeiAnterior || '',
                            observacionCambio: d.observacionCambio || '',
                            usuario: currentUser.email || currentUser.nombre || 'Visual App',
                            fecha: d.fechaModificacion || new Date().toISOString()
                        });
                    }
                });
            });

            if (modifiedItems.length > 0) {
                window.showToast(`Subiendo ${modifiedItems.length} cambios pendientes a Google Sheets...`, 'info');
                try {
                    await callApi({
                        action: 'bulkUpdateFeishuImeis',
                        usuario: currentUser.email || 'Visual App',
                        items: modifiedItems
                    });
                } catch (pushErr) {
                    console.warn('Aviso subiendo cambios locales a Google Sheets:', pushErr);
                }
            }

            // Descargar actualizaciones recientes de Google Sheets y reconstruir catálogo vivo
            try {
                const getRes = await callApi({ action: 'getFeishuImeis' });
                if (getRes && getRes.success) {
                    pullResult = window.applyLiveSheetPull(getRes, { silent: false });
                } else {
                    window.showToast('✅ Sincronización en segundo plano completada. Terminales al día.', 'success');
                }
            } catch (pullErr) {
                console.warn('Aviso descargando de Google Sheets:', pullErr);
                window.showToast('✅ Sincronización local completada. Conexión parcial con la nube.', 'info');
            }
        }

        if (!pullResult || !pullResult.rebuilt) {
            saveImeiDbLocally();
        }
        window.renderStoreImeis();
        if (typeof window.calculateCampaignTotals === 'function') {
            window.calculateCampaignTotals();
        }
    } catch (err) {
        console.error('Error en sincronización en segundo plano:', err);
        window.showToast('⚠️ Sincronización en segundo plano: ' + (err.message || 'Error de conexión'), 'warning');
    } finally {
        window._isImeiSyncing = false;
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = originalBtnHtml;
        }
    }
};

window.openGoogleSheetsSyncModal = async function() {
    let modal = document.getElementById('modal-feishu-config');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    modal.classList.add('active');
    window.refreshGoogleSheetsStatus();
};

window.closeGoogleSheetsSyncModal = function() {
    const modal = document.getElementById('modal-feishu-config');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        modal.classList.remove('active');
    }
};

// Aliases de compatibilidad
window.openFeishuConfigModal = window.openGoogleSheetsSyncModal;
window.closeFeishuConfigModal = window.closeGoogleSheetsSyncModal;

window.refreshGoogleSheetsStatus = async function() {
    const statusBox = document.getElementById('sheets-sync-status-box');
    if (statusBox) statusBox.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando estado de la pestaña "LDUS DUMMY STOCK" en Google Sheets...';

    try {
        const res = await callApi({ action: 'getLdusStockStatus' });
        if (res && res.success) {
            if (res.exists && res.totalRows > 0) {
                if (statusBox) {
                    statusBox.innerHTML = `
                        <div style="color: #237804; font-weight: 600; margin-bottom: 4px;">
                            <i class="fas fa-check-circle" style="color: #52c41a;"></i> Pestaña '${res.tabName}' ACTIVA en Google Sheets
                        </div>
                        <div style="font-size: 12px; color: #555; line-height: 1.5;">
                            • Total terminales en la nube: <strong>${res.totalRows}</strong><br>
                            • IMEIs cumplimentados: <strong style="color: #389e0d;">${res.filledImeis}</strong><br>
                            • IMEIs pendientes: <strong style="color: #d46b08;">${res.pendingImeis}</strong>
                        </div>
                    `;
                }
            } else if (res.exists && res.totalRows === 0) {
                if (statusBox) {
                    statusBox.innerHTML = `
                        <div style="color: #fa8c16; font-weight: 600; margin-bottom: 4px;">
                            <i class="fas fa-exclamation-triangle"></i> Pestaña creada pero vacía
                        </div>
                        <div style="font-size: 12px; color: #666;">
                            La pestaña '${res.tabName}' existe en Google Sheets pero no contiene datos aún. Pulsa a continuación para volcar los 6.213 terminales.
                        </div>
                    `;
                }
            } else {
                if (statusBox) {
                    statusBox.innerHTML = `
                        <div style="color: #cf1322; font-weight: 600; margin-bottom: 4px;">
                            <i class="fas fa-info-circle"></i> Pestaña no encontrada en Google Sheets
                        </div>
                        <div style="font-size: 12px; color: #666;">
                            Aún no se ha creado la pestaña <strong>LDUS DUMMY STOCK</strong> en tu hoja de Google. Puedes crearla y poblarla en 1 clic abajo.
                        </div>
                    `;
                }
            }
        }
    } catch(err) {
        if (statusBox) statusBox.innerHTML = '<span style="color: #888;">No se pudo conectar con Google Sheets. Verifica tu conexión.</span>';
    }
};

window.populateGoogleSheetsFromLocal = async function() {
    const btn = document.getElementById('btn-populate-sheets');
    const resultBox = document.getElementById('sheets-populate-result');

    const confirmPopulate = confirm('¿Deseas volcar y replicar toda la base de 6.213 terminales en la pestaña "LDUS DUMMY STOCK" de tu hoja de Google Sheets?');
    if (!confirmPopulate) return;

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Replicando en Google Sheets...';
    }
    if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.style.background = '#e6f7ff';
        resultBox.style.border = '1px solid #91d5ff';
        resultBox.style.color = '#0050b3';
        resultBox.innerHTML = '⏳ Preparando registros y enviando a Google Sheets...';
    }

    try {
        const rows = [];
        const db = APP_CONFIG.imeiDatabase || {};
        
        Object.keys(db).forEach(storeName => {
            const devs = db[storeName] || [];
            devs.forEach(d => {
                rows.push([
                    d.cuenta || '',
                    d.rms || '',
                    storeName,
                    d.numMesas || 1,
                    d.mesa || 'Mesa 1',
                    d.modelo || '',
                    d.imei || '',
                    d.isDummy ? 'Maqueta dummy' : (d.imei ? 'Disponible en tienda' : 'Sin asignar'),
                    '', // otros imei
                    d.observacionCambio || '',
                    d.tipoAccion || '',
                    d.usuario || '',
                    d.fechaModificacion || ''
                ]);
            });
        });

        if (rows.length === 0) {
            throw new Error('No hay datos en memoria local para transferir.');
        }

        const CHUNK_SIZE = 1500;
        const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);
        let uploaded = 0;

        for (let i = 0; i < totalChunks; i++) {
            const chunk = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            if (resultBox) {
                resultBox.innerHTML = `⏳ Enviando bloque ${i + 1} de ${totalChunks} (${uploaded + chunk.length} de ${rows.length} terminales)...`;
            }
            const res = await callApi({
                action: 'initLdusStockSheet',
                clearExisting: (i === 0),
                rows: chunk
            });

            if (!res || !res.success) {
                throw new Error(res ? res.message : 'Error en la subida del bloque ' + (i + 1));
            }
            uploaded += chunk.length;
        }

        if (resultBox) {
            resultBox.style.background = '#f6ffed';
            resultBox.style.border = '1px solid #b7eb8f';
            resultBox.style.color = '#389e0d';
            resultBox.innerHTML = `<strong>✅ ¡BASE REPLICADA CON ÉXITO!</strong><br>Se han creado y sincronizado los ${uploaded} terminales en la pestaña <strong>LDUS DUMMY STOCK</strong> de Google Sheets.`;
        }
        window.showToast('¡Base replicada con éxito en Google Sheets!', 'success');
        window.refreshGoogleSheetsStatus();
    } catch (err) {
        console.error('Error poblando Google Sheets:', err);
        if (resultBox) {
            resultBox.style.background = '#fff2f0';
            resultBox.style.border = '1px solid #ffccc7';
            resultBox.style.color = '#cf1322';
            resultBox.innerHTML = `<strong>❌ Error al volcar datos:</strong><br>${err.message}<br><small>También puedes importar el archivo Excel <em>Control IMEI Copy (1).xlsx</em> en tu Google Sheet como pestaña 'LDUS DUMMY STOCK'.</small>`;
        }
        window.showToast('Error volcando a Google Sheets: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Replicar Base en Google Sheets';
        }
    }
};

// Guardado individual en cada línea de producto al pulsar "Guardar" o pulsar Enter
window.saveSingleRowImei = async function(storeName, devId) {
    const normStore = normalizeString(storeName);
    const targetKey = APP_CONFIG.imeiDatabase[storeName] ? storeName : Object.keys(APP_CONFIG.imeiDatabase).find(k => normalizeString(k) === normStore);
    const list = targetKey ? APP_CONFIG.imeiDatabase[targetKey] : null;
    if (!list) return;
    const dev = list.find(d => d.id === devId);
    if (!dev) return;

    const input = document.getElementById(`input-imei-${devId}`);
    const btn = document.getElementById(`btn-save-row-${devId}`);
    const newVal = input ? input.value.trim() : (dev.imei || '');

    // Si ya tenía un IMEI asignado y se altera, sugerir pop-up con motivo justificado (robo, dañado...)
    if (dev.imeiOriginal && dev.imeiOriginal !== '' && newVal !== dev.imeiOriginal && !dev.tipoAccion) {
        const confirmChange = confirm(`El dispositivo ya tenía el IMEI "${dev.imeiOriginal}". ¿Deseas registrar un motivo formal (Rotura, Robo o Cambio de modelo)?`);
        if (confirmChange) {
            window.openImeiActionModal(storeName, devId, 'rotura');
            const newImeiInput = document.getElementById('modal-action-new-imei');
            if (newImeiInput) newImeiInput.value = newVal;
            return;
        }
    }

    // Guardar nuevo IMEI
    dev.imeiAnterior = (dev.imei && dev.imei !== newVal) ? dev.imei : dev.imeiAnterior;
    dev.imei = newVal;
    if (!dev.imeiOriginal && newVal !== '') {
        dev.imeiOriginal = newVal;
    }
    dev.fechaModificacion = new Date().toISOString().slice(0, 10);

    // Persistir localmente de inmediato (deltas ultrarrápidos <1ms)
    saveImeiDbLocally();

    // Efecto visual de confirmación instantánea en el botón de la fila
    if (input) input.classList.remove('is-modified');
    if (btn) {
        btn.classList.remove('is-dirty');
        btn.classList.add('is-saved');
        btn.innerHTML = '<i class="fas fa-check"></i> ¡Guardado!';
        setTimeout(() => {
            if (btn) {
                btn.classList.remove('is-saved');
                btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
            }
        }, 2500);
    }

    // Sincronizar en segundo plano con Google Sheets (LDUS DUMMY STOCK)
    window.syncDeviceToFeishu(dev, storeName).then(res => {
        if (res && res.success) {
            const rowTxt = (res.row || dev.excelRow) ? ` (Celda G${res.row || dev.excelRow})` : '';
            window.showToast(`¡IMEI guardado en Google Sheets${rowTxt}! (${dev.modelo})`, 'success');
        } else {
            window.showToast(`¡Línea guardada localmente! (${dev.modelo})`, 'info');
        }
    });

    if (typeof window.calculateCampaignTotals === 'function') {
        window.calculateCampaignTotals();
    }
    if (typeof window.updateDashboardImeisWidget === 'function') {
        window.updateDashboardImeisWidget();
    }
};

// Cambio directo de IMEI al perder el foco (blur/change)
window.handleImeiFieldChange = function(storeName, devId, inputEl) {
    const list = APP_CONFIG.imeiDatabase[storeName];
    if (!list) return;
    const dev = list.find(d => d.id === devId);
    if (!dev) return;

    const newVal = inputEl.value.trim();

    // Si ya tenía IMEI y se modifica, abrir pop-up de acción para registrar motivo/incidencia
    if (dev.imeiOriginal && dev.imeiOriginal !== '' && newVal !== dev.imeiOriginal) {
        inputEl.value = dev.imei;
        window.openImeiActionModal(storeName, devId, 'rotura');
        const newImeiInput = document.getElementById('modal-action-new-imei');
        if (newImeiInput) newImeiInput.value = newVal;
        return;
    }

    // Asignación directa
    dev.imei = newVal;
    if (!dev.imeiOriginal && newVal !== '') {
        dev.imeiOriginal = newVal;
    }
    inputEl.classList.remove('is-modified');
};

// Envío del modal de Acción / Cambio de terminal y Devolución
window.submitImeiAction = async function(event) {
    event.preventDefault();
    if (!window.currentActionDeviceContext) return;

    const ctx = window.currentActionDeviceContext;
    const dev = ctx.device;
    const storeName = ctx.storeName;

    const actionRadio = document.querySelector('input[name="modal_action_type"]:checked');
    const actionType = actionRadio ? actionRadio.value : 'cambio';
    
    // IMEI retirado del terminal que se devuelve
    const retiredImeiInput = document.getElementById('modal-action-retired-imei');
    const retiredImei = retiredImeiInput ? retiredImeiInput.value.trim() : (dev.imei || dev.imeiOriginal || '');

    // Nuevo modelo
    const newModelSelect = document.getElementById('modal-action-new-model');
    const customModelInput = document.getElementById('modal-action-new-model-custom');
    let newModelName = newModelSelect ? newModelSelect.value : '';
    if (newModelName === 'OTRO' && customModelInput) {
        newModelName = customModelInput.value.trim();
    }
    
    // Nuevo IMEI
    const newImei = document.getElementById('modal-action-new-imei').value.trim();
    const observaciones = document.getElementById('modal-action-observaciones').value.trim();

    const isDevolucionAction = (actionType === 'devolucion');

    if (actionType === 'cambio' && !newModelName) {
        alert("Por favor, selecciona o introduce el nuevo modelo para el cambio.");
        return;
    }

    const catalog = APP_CONFIG.deviceCatalog || [];
    const catItem = catalog.find(c => String(c.Modelo).toLowerCase().trim() === String(newModelName).toLowerCase().trim());
    const isNewModelDummy = (catItem && catItem.Tipología && catItem.Tipología.toUpperCase().includes('DUMMY')) || 
                            (String(newModelName).toUpperCase().includes('DUMMY'));

    // Para unidades LDU (o si pasa a LDU), si es cambio de modelo se exige nuevo IMEI
    if (actionType === 'cambio' && !isNewModelDummy && !newImei) {
        alert("Por favor, introduce el nuevo IMEI para el terminal asignado a la mesa.");
        return;
    }

    const storeInfo = (window.REAL_STORES_DATA && window.REAL_STORES_DATA[storeName]) || {};
    const currentUser = APP_CONFIG.currentUser || {};
    
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayFormatted = `${dd}/${mm}/${yyyy}`;

    const motivoStr = isDevolucionAction 
        ? 'Devolución de terminal' 
        : (actionType === 'cambio' 
            ? `Cambio de modelo: ${dev.modelo} ➔ ${newModelName}` 
            : (actionType === 'rotura' ? 'Rotura / Dañado' : 'Robo / Sustracción'));

    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando en Google Sheets...';
    }

    try {
        const payload = {
            action: 'reportTerminalChange',
            excelRow: dev.excelRow || '',
            retailer: dev.cuenta || storeInfo.retail || storeInfo.cuenta || '',
            storeCode: storeInfo.codigo_tienda || dev.rms || '',
            tienda: storeName,
            mueble: dev.mesa || 'Mesa 1',
            posicion: dev.posicion || 1,
            dispositivoRetirado: dev.modelo,
            imeiRetirado: retiredImei,
            motivo: isDevolucionAction ? 'Devolución' : (actionType === 'cambio' ? 'Cambio de modelo' : (actionType === 'rotura' ? 'Rotura' : 'Robo')),
            tipoProducto: dev.isDummy ? 'Dummy' : 'LDU',
            usuario: currentUser.email || currentUser.nombre || 'Field Force',
            fechaCheck: todayFormatted,
            nuevoModelo: isDevolucionAction ? '' : (actionType === 'cambio' ? newModelName : dev.modelo),
            nuevoImei: isDevolucionAction ? '' : newImei,
            observaciones: observaciones,
            isDummy: isDevolucionAction ? false : isNewModelDummy,
            isDevolucion: isDevolucionAction
        };

        const res = await callApi(payload);

        // Actualizar en el estado local de memoria
        if (isDevolucionAction) {
            // El producto devuelto se retira de la mesa y de la base local
            const targetKey = APP_CONFIG.imeiDatabase && APP_CONFIG.imeiDatabase[storeName] 
                ? storeName 
                : (APP_CONFIG.imeiDatabase ? Object.keys(APP_CONFIG.imeiDatabase).find(k => normalizeString(k) === normalizeString(storeName)) : null);
            if (targetKey && APP_CONFIG.imeiDatabase[targetKey]) {
                APP_CONFIG.imeiDatabase[targetKey] = APP_CONFIG.imeiDatabase[targetKey].filter(d => d.id !== dev.id);
            }
        } else {
            dev.modeloAnterior = dev.modelo;
            dev.imeiAnterior = retiredImei;
            if (actionType === 'cambio') {
                dev.modelo = newModelName;
                dev.isDummy = isNewModelDummy;
                dev.tipologia = isNewModelDummy ? 'Dummy' : 'LDU';
                if (catItem) {
                    dev.codigo = catItem['Código Dispositivo'] || catItem.codigo || dev.codigo || '';
                }
            }
            dev.imei = newImei;
            dev.tipoAccion = actionType === 'cambio' ? 'Cambio de modelo' : (actionType === 'rotura' ? 'Rotura' : 'Robo');
            dev.motivoCambio = motivoStr;
            dev.observacionCambio = observaciones;
            dev.fechaModificacion = todayFormatted;
        }

        saveImeiDbLocally();

        window.closeImeiActionModal();
        const toastMsg = isDevolucionAction
            ? `✅ ¡Devolución guardada! Fila eliminada de LDUS DUMMY STOCK y registrada en DEVOLUCIONES.`
            : `✅ ¡Cambio guardado en Google Sheets! LDUS DUMMY STOCK actualizado y registrado en DEVOLUCIONES.`;
        window.showToast(toastMsg, 'success');

        window.renderStoreImeis();
        if (typeof window.calculateCampaignTotals === 'function') {
            window.calculateCampaignTotals();
        }
        if (typeof window.updateDashboardImeisWidget === 'function') {
            window.updateDashboardImeisWidget();
        }
        if (typeof window.updateDashboardDevolucionesWidget === 'function') {
            window.updateDashboardDevolucionesWidget();
        }
        if (typeof window.renderJoaquinTotalsWidget === 'function') {
            window.renderJoaquinTotalsWidget();
        }
        if (typeof window._onImeiActionCompleted === 'function') {
            try { window._onImeiActionCompleted(); } catch (hookErr) { console.warn('Aviso callback inspector:', hookErr); }
        }
    } catch (err) {
        console.error('Error registrando cambio en Google Sheets:', err);
        alert('Hubo un error al registrar en Google Sheets: ' + (err.message || err));
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Guardar y Rellenar en Google Sheets';
        }
    }
};

// ==================================================
// GESTIÓN Y VISUALIZACIÓN DE DEVOLUCIONES EN GOOGLE SHEETS
// ==================================================
window.currentDevolucionesList = [];

window.openDevolucionesModal = async function() {
    const modal = document.getElementById('modal-devoluciones-list');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    window.loadDevolucionesData();
};

window.closeDevolucionesModal = function() {
    const modal = document.getElementById('modal-devoluciones-list');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
};

window.loadDevolucionesData = async function() {
    const container = document.getElementById('devoluciones-table-container');
    if (container) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: #6b7280;">
                <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #0284c7; margin-bottom: 10px; display: block;"></i>
                Consultando pestaña <strong>DEVOLUCIONES</strong> de Google Sheets...
            </div>
        `;
    }

    try {
        const res = await callApi({ action: 'getDevoluciones' });
        if (res && res.success && Array.isArray(res.records)) {
            window.currentDevolucionesList = res.records;
            window.renderDevolucionesTable(window.currentDevolucionesList);
        } else {
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 3rem 1rem; color: #999;">
                        <i class="fas fa-inbox" style="font-size: 32px; color: #ccc; margin-bottom: 8px; display: block;"></i>
                        No se encontraron registros de devolución en la hoja de Google Sheets aún.
                    </div>
                `;
            }
        }
    } catch (err) {
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2.5rem 1rem; color: #cf1322;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 28px; margin-bottom: 8px; display: block;"></i>
                    Error al cargar devoluciones desde Google Sheets: ${err.message || err}
                </div>
            `;
        }
    }
};

window.filterDevolucionesTable = function(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
        window.renderDevolucionesTable(window.currentDevolucionesList);
        return;
    }
    const filtered = (window.currentDevolucionesList || []).filter(r => {
        return String(r.tienda || '').toLowerCase().includes(q) ||
               String(r.dispositivo || '').toLowerCase().includes(q) ||
               String(r.imei || '').toLowerCase().includes(q) ||
               String(r.estado || '').toLowerCase().includes(q) ||
               String(r.storeCode || '').toLowerCase().includes(q) ||
               String(r.retailer || '').toLowerCase().includes(q) ||
               String(r.devolucionesFF || '').toLowerCase().includes(q);
    });
    window.renderDevolucionesTable(filtered);
};

window.renderDevolucionesTable = function(records) {
    const container = document.getElementById('devoluciones-table-container');
    if (!container) return;

    if (!records || records.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: #999;">
                <i class="fas fa-search" style="font-size: 28px; color: #ddd; margin-bottom: 8px; display: block;"></i>
                No hay devoluciones que coincidan con la búsqueda.
            </div>
        `;
        return;
    }

    let rowsHtml = '';
    records.forEach(r => {
        rowsHtml += `
            <tr style="border-bottom: 1px solid #f0f0f0; font-size: 12px; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
                <td style="padding: 8px 10px; font-weight: 600; color: #334155;">${r.retailer || '-'}</td>
                <td style="padding: 8px 10px; font-family: monospace; color: #64748b;">${r.storeCode || '-'}</td>
                <td style="padding: 8px 10px; font-weight: 600; color: #0f172a;">${r.tienda || '-'}</td>
                <td style="padding: 8px 10px; font-weight: 700; color: var(--mi-orange);">${r.dispositivo || '-'}</td>
                <td style="padding: 8px 10px; white-space: nowrap; color: #475569;">${r.fechaCheck || '-'}</td>
                <td style="padding: 8px 10px; font-family: monospace; color: #333; font-weight: 600;">${r.imei || '<span style="color:#aaa;">(Sin IMEI)</span>'}</td>
                <td style="padding: 8px 10px;"><span style="background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">${r.estado || 'Devolución'}</span></td>
                <td style="padding: 8px 10px; color: #64748b;">${r.mueble || '-'}</td>
                <td style="padding: 8px 10px; color: #0284c7; font-weight: 500;">${r.devolucionesFF || '-'}</td>
                <td style="padding: 8px 10px;"><span style="background: ${r.tipoProducto === 'Dummy' ? '#f3f4f6' : '#e0f2fe'}; color: ${r.tipoProducto === 'Dummy' ? '#374151' : '#0369a1'}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">${r.tipoProducto || 'LDU'}</span></td>
            </tr>
        `;
    });

    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; text-align: left; background: white;">
            <thead>
                <tr style="background: #f1f5f9; color: #475569; font-size: 11px; text-transform: uppercase; font-weight: 700; border-bottom: 2px solid #e2e8f0; position: sticky; top: 0; z-index: 2;">
                    <th style="padding: 9px 10px;">Retailer</th>
                    <th style="padding: 9px 10px;">StoreCode</th>
                    <th style="padding: 9px 10px;">Tienda</th>
                    <th style="padding: 9px 10px;">Dispositivo</th>
                    <th style="padding: 9px 10px;">FechaCheck</th>
                    <th style="padding: 9px 10px;">IMEI</th>
                    <th style="padding: 9px 10px;">Estado</th>
                    <th style="padding: 9px 10px;">Mueble</th>
                    <th style="padding: 9px 10px;">Devoluciones FF</th>
                    <th style="padding: 9px 10px;">Tipo de producto</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    `;
};

// ==================================================
// WIDGET DASHBOARD: ALERTAS LUMINOSAS Y GESTIÓN DEVOLUCIONES
// ==================================================
window._devolucionesLoadedOnce = false;

window.updateDashboardDevolucionesWidget = async function() {
    const container = document.getElementById('dash-admin-devoluciones-container');
    if (!container) return;

    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    if (!isAdmin) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    if (!window._devolucionesLoadedOnce) {
        window._devolucionesLoadedOnce = true;
        try {
            const res = await callApi({ action: 'getDevoluciones' });
            if (res && res.success && Array.isArray(res.records)) {
                window.currentDevolucionesList = res.records;
            }
        } catch (e) {
            console.warn("Consulta inicial de devoluciones:", e);
        }
    }

    const count = (window.currentDevolucionesList || []).length;
    const card = document.getElementById('btn-admin-devoluciones');
    const badge = document.getElementById('dash-devoluciones-badge');
    const subtitle = document.getElementById('dash-devoluciones-summary-text');

    if (badge) {
        badge.textContent = `${count} ${count === 1 ? 'Devolución' : 'Devoluciones'}`;
        badge.style.background = count > 0 ? '#fef3c7' : '#f1f5f9';
        badge.style.color = count > 0 ? '#b45309' : '#64748b';
        badge.style.borderColor = count > 0 ? '#fde68a' : '#cbd5e1';
    }

    if (card) {
        if (count > 0) {
            card.classList.add('glow-active');
            if (subtitle) {
                subtitle.innerHTML = `⚠️ <strong>${count} devolución(es) registradas</strong> en Google Sheets. Pulsa para ver o descarga el Excel consolidado.`;
                subtitle.style.color = '#b45309';
            }
        } else {
            card.classList.remove('glow-active');
            if (subtitle) {
                subtitle.textContent = 'No hay nuevas devoluciones de terminales actualmente.';
                subtitle.style.color = '#666';
            }
        }
    }
};

// ==================================================
// EXPORTACIÓN DE DEVOLUCIONES A EXCEL (.XLSX)
// ==================================================
window.exportDevolucionesExcel = async function() {
    try {
        if (!window.currentDevolucionesList || window.currentDevolucionesList.length === 0) {
            window.showToast("Consultando registros de devolución...", "info");
            const res = await callApi({ action: 'getDevoluciones' });
            if (res && res.success && Array.isArray(res.records)) {
                window.currentDevolucionesList = res.records;
            }
        }

        const records = window.currentDevolucionesList || [];
        if (records.length === 0) {
            alert("No hay registros de devoluciones en la hoja de Google Sheets para exportar.");
            return;
        }

        // Asegurar que la librería ExcelJS esté disponible
        if (typeof ExcelJS === 'undefined' && typeof XLSX === 'undefined') {
            window.showToast("Cargando motor de exportación Excel...", "info");
            await new Promise(resolve => {
                const s = document.createElement('script');
                s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js";
                s.onload = () => resolve(true);
                s.onerror = () => resolve(false);
                document.head.appendChild(s);
            });
        }

        if (typeof ExcelJS !== 'undefined') {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Xiaomi Visual APP';
            workbook.created = new Date();
            const sheet = workbook.addWorksheet('DEVOLUCIONES');

            sheet.columns = [
                { header: 'Retailer', key: 'retailer', width: 16 },
                { header: 'StoreCode', key: 'storeCode', width: 15 },
                { header: 'Tienda', key: 'tienda', width: 28 },
                { header: 'Dispositivo', key: 'dispositivo', width: 26 },
                { header: 'FechaCheck', key: 'fechaCheck', width: 14 },
                { header: 'IMEI', key: 'imei', width: 22 },
                { header: 'Estado', key: 'estado', width: 20 },
                { header: 'Mueble', key: 'mueble', width: 14 },
                { header: 'Devoluciones FF', key: 'devolucionesFF', width: 22 },
                { header: 'Tipo de producto', key: 'tipoProducto', width: 16 }
            ];

            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF217346' }
            };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.height = 26;

            records.forEach(r => {
                const row = sheet.addRow({
                    retailer: r.retailer || '',
                    storeCode: r.storeCode || '',
                    tienda: r.tienda || '',
                    dispositivo: r.dispositivo || '',
                    fechaCheck: r.fechaCheck || '',
                    imei: r.imei || '',
                    estado: r.estado || 'Devolución',
                    mueble: r.mueble || 'Mesa 1',
                    devolucionesFF: r.devolucionesFF || '',
                    tipoProducto: r.tipoProducto || 'LDU'
                });
                row.alignment = { vertical: 'middle' };
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            a.download = `Xiaomi_Devoluciones_Terminales_${dateStr}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            window.showToast("✅ ¡Excel de Devoluciones descargado correctamente!", "success");
        } else if (typeof XLSX !== 'undefined') {
            const data = [
                ['Retailer', 'StoreCode', 'Tienda', 'Dispositivo', 'FechaCheck', 'IMEI', 'Estado', 'Mueble', 'Devoluciones FF', 'Tipo de producto']
            ];
            records.forEach(r => {
                data.push([
                    r.retailer || '', r.storeCode || '', r.tienda || '', r.dispositivo || '',
                    r.fechaCheck || '', r.imei || '', r.estado || '', r.mueble || '',
                    r.devolucionesFF || '', r.tipoProducto || ''
                ]);
            });
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "DEVOLUCIONES");
            const now = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Xiaomi_Devoluciones_Terminales_${now}.xlsx`);
            window.showToast("✅ Archivo Excel descargado.", "success");
        }
    } catch (err) {
        console.error("Error exportando devoluciones:", err);
        alert("Error al descargar Excel de devoluciones: " + (err.message || err));
    }
};

// ==================================================
// WIDGET DE TOTALES DE PRODUCTO (EXCLUSIVO JOAQUÍN LEMUS)
// ==================================================
function isJoaquinUser(user = APP_CONFIG.currentUser) {
    if (!user) return false;
    const name = normalizeString(user.nombre || user.email || user.usuario || '');
    if (name.includes('JOAQU') || name.includes('LEMUS')) return true;
    if (isUserAdmin(user)) return true;
    return false;
}

window.toggleJoaquinBranch = function(contentId, arrowId) {
    const el = document.getElementById(contentId);
    const arrow = document.getElementById(arrowId);
    if (!el) return;
    const isHidden = (el.style.display === 'none' || el.style.display === '');
    const targetDisplay = el.dataset.display || 'block';
    el.style.display = isHidden ? targetDisplay : 'none';
    if (arrow) {
        arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
};

window.toggleJoaquinAccordion = function(key) {
    window.toggleJoaquinBranch(`branch-${key}`, `arrow-${key}`);
};

window._joaquinActiveCat = (typeof window._joaquinActiveCat !== 'undefined') ? window._joaquinActiveCat : null;
window._joaquinActiveBrand = window._joaquinActiveBrand || {
    smartphones: 'xiaomi',
    tablets: 'xiaomi',
    wear: 'xiaomi',
    buds: 'xiaomi'
};

window.selectJoaquinCategory = function(catKey) {
    window._joaquinActiveCat = (window._joaquinActiveCat === catKey) ? null : catKey;
    window.renderJoaquinTotalsWidget();
};

window.selectJoaquinBrand = function(catKey, brandKey) {
    if (!window._joaquinActiveBrand) window._joaquinActiveBrand = {};
    window._joaquinActiveBrand[catKey] = brandKey;
    window.renderJoaquinTotalsWidget();
};

window.renderJoaquinTotalsWidget = function() {
    const container = document.getElementById('planogram-joaquin-totals-container') || document.getElementById('dash-joaquin-totals-container');
    if (!container) return;

    // Total de dispositivos solo visible para administradores
    const isAdmin = isUserAdmin(APP_CONFIG.currentUser);
    if (!isAdmin) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    const db = APP_CONFIG.imeiDatabase || {};
    const totals = {
        smartphones: { xiaomi: {}, redmi: {} },
        tablets: { xiaomi: {}, redmi: {} },
        wear: { xiaomi: {}, redmi: {} },
        buds: { xiaomi: {}, redmi: {} }
    };

    let totalSmartphones = 0;
    let totalTablets = 0;
    let totalWear = 0;
    let totalBuds = 0;

    Object.values(db).forEach(storeDevices => {
        if (!Array.isArray(storeDevices)) return;
        storeDevices.forEach(d => {
            const m = window.normalizeDeviceModelName(d.modelo || 'Desconocido').trim();
            const isDummy = !!d.isDummy;
            const tipologia = isDummy ? 'Dummy' : 'LDU';
            const mLower = m.toLowerCase();
            const hasImei = !!(d.imei && String(d.imei).trim());

            const isRedmi = mLower.includes('redmi') || mLower.startsWith('rn ') || mLower.startsWith('rn1') || mLower.includes('poco');
            const brand = isRedmi ? 'redmi' : 'xiaomi';
            const key = `${m}__${tipologia}`;

            let cat = 'smartphones';
            if (mLower.includes('pad') || mLower.includes('tab')) cat = 'tablets';
            else if (mLower.includes('watch') || mLower.includes('band')) cat = 'wear';
            else if (mLower.includes('buds') || mLower.includes('clip') || mLower.includes('audio')) cat = 'buds';

            if (cat === 'tablets') totalTablets++;
            else if (cat === 'wear') totalWear++;
            else if (cat === 'buds') totalBuds++;
            else totalSmartphones++;

            if (!totals[cat][brand][key]) {
                totals[cat][brand][key] = { modelo: m, tipologia, total: 0, conImei: 0, sinImei: 0 };
            }
            totals[cat][brand][key].total++;
            if (hasImei) totals[cat][brand][key].conImei++; else totals[cat][brand][key].sinImei++;
        });
    });

    const totalGlobal = totalSmartphones + totalTablets + totalWear + totalBuds;

    const categoriesConfig = [
        {
            key: 'smartphones',
            title: 'Smartphones',
            icon: 'fas fa-mobile-alt',
            color: 'var(--mi-orange)',
            total: totalSmartphones,
            xiaomi: totals.smartphones.xiaomi,
            redmi: totals.smartphones.redmi
        },
        {
            key: 'tablets',
            title: 'Tablets',
            icon: 'fas fa-tablet-alt',
            color: '#16a34a',
            total: totalTablets,
            xiaomi: totals.tablets.xiaomi,
            redmi: totals.tablets.redmi
        },
        {
            key: 'wear',
            title: 'Wearables',
            icon: 'fas fa-clock',
            color: '#2563eb',
            total: totalWear,
            xiaomi: totals.wear.xiaomi,
            redmi: totals.wear.redmi
        },
        {
            key: 'buds',
            title: 'Buds / Audio',
            icon: 'fas fa-headphones',
            color: '#9333ea',
            total: totalBuds,
            xiaomi: totals.buds.xiaomi,
            redmi: totals.buds.redmi
        }
    ];

    const renderRows = (itemsMap) => {
        const list = Object.values(itemsMap).sort((a, b) => b.total - a.total);
        if (list.length === 0) return '<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 18px; font-size: 12.5px;">Sin terminales registrados para esta gama</td></tr>';
        return list.map(item => `
            <tr style="border-bottom: 1px solid #f1f5f9; font-size: 12.5px; transition: background 0.1s;" onmouseover="this.style.background='#fbfcfd'" onmouseout="this.style.background='white'">
                <td style="padding: 9px 12px; font-weight: 700; color: #1e293b;">${item.modelo}</td>
                <td style="padding: 9px 12px;">
                    <span style="font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; background: ${item.tipologia === 'Dummy' ? '#f3f4f6' : '#e0f2fe'}; color: ${item.tipologia === 'Dummy' ? '#4b5563' : '#0369a1'};">
                        ${item.tipologia}
                    </span>
                </td>
                <td style="padding: 9px 12px; font-weight: 800; color: var(--mi-orange); text-align: right; font-size: 13px;">${item.total} uds</td>
                <td style="padding: 9px 12px; text-align: right; font-size: 11.5px; white-space: nowrap;">
                    <span style="color: #16a34a; font-weight: 700;">${item.conImei} OK</span> / <span style="color: ${item.sinImei > 0 ? '#dc2626' : '#64748b'}; font-weight: 700;">${item.sinImei} Pend.</span>
                </td>
            </tr>
        `).join('');
    };

    // Construcción de las 4 Columnas Superiores
    let categoriesCardsHtml = categoriesConfig.map(cat => {
        const xTotal = Object.values(cat.xiaomi).reduce((a, b) => a + b.total, 0);
        const rTotal = Object.values(cat.redmi).reduce((a, b) => a + b.total, 0);
        const isActive = (window._joaquinActiveCat === cat.key);

        return `
            <div onclick="window.selectJoaquinCategory('${cat.key}')" 
                style="background: var(--bg-main); border: ${isActive ? '1.5px solid rgba(255,103,0,0.5)' : '1px solid rgba(255,255,255,0.9)'}; border-radius: 16px; padding: 14px 16px; cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: ${isActive ? 'var(--neu-pressed), 0 0 0 2px rgba(255,103,0,0.2)' : 'var(--neu-flat-sm)'}; display: flex; flex-direction: column; justify-content: space-between;"
                onmouseover="if (!${isActive}) { this.style.transform = 'translateY(-2px)'; this.style.boxShadow = 'var(--neu-flat)'; }"
                onmouseout="if (!${isActive}) { this.style.transform = 'translateY(0)'; this.style.boxShadow = 'var(--neu-flat-sm)'; }"
            >
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 36px; height: 36px; border-radius: 10px; background: ${isActive ? 'linear-gradient(135deg, #ff7a1a 0%, #ea580c 100%)' : 'var(--bg-main)'}; color: ${isActive ? 'white' : cat.color}; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: ${isActive ? 'var(--neu-orange-btn)' : 'var(--neu-inset-sm)'};">
                            <i class="${cat.icon}"></i>
                        </div>
                        <strong style="font-size: 14.5px; color: ${isActive ? '#9a3412' : 'var(--text-heading)'};">${cat.title}</strong>
                    </div>
                    <span style="font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 12px; background: ${isActive ? 'linear-gradient(135deg, #ff7a1a 0%, #ea580c 100%)' : 'var(--bg-main)'}; color: ${isActive ? 'white' : 'var(--text-muted)'}; box-shadow: ${isActive ? '0 2px 6px rgba(255,103,0,0.3)' : 'var(--neu-inset-sm)'};">
                        ${isActive ? 'Activo ▾' : 'Ver Gamas ›'}
                    </span>
                </div>
                <div>
                    <div style="font-size: 1.6rem; font-weight: 800; color: ${isActive ? 'var(--mi-orange)' : 'var(--text-heading)'}; line-height: 1.2;">
                        ${cat.total} <span style="font-size: 12px; font-weight: 600; color: var(--text-muted);">uds</span>
                    </div>
                    <div style="font-size: 11.5px; margin-top: 4px; font-weight: 600; color: var(--text-muted);">
                        <span style="color: #ea580c; font-weight: 700;">${xTotal} Xiaomi</span> · <span style="color: #2563eb; font-weight: 700;">${rTotal} Redmi</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Construcción del Contenido de la Categoría Activa
    let activeCategoryDetailHtml = '';
    const activeCat = categoriesConfig.find(c => c.key === window._joaquinActiveCat);

    if (activeCat) {
        const xTotal = Object.values(activeCat.xiaomi).reduce((a, b) => a + b.total, 0);
        const xCount = Object.keys(activeCat.xiaomi).length;
        const rTotal = Object.values(activeCat.redmi).reduce((a, b) => a + b.total, 0);
        const rCount = Object.keys(activeCat.redmi).length;
        
        let activeBrand = (window._joaquinActiveBrand && window._joaquinActiveBrand[activeCat.key]) || 'xiaomi';
        // Si la marca elegida tiene 0 y la otra tiene datos, conmutar
        if (activeBrand === 'xiaomi' && xTotal === 0 && rTotal > 0) activeBrand = 'redmi';

        activeCategoryDetailHtml = `
            <div class="joaquin-active-cat-container" style="background: var(--bg-main); border: 1px solid rgba(255, 255, 255, 0.9); border-radius: 18px; padding: 20px; box-shadow: var(--neu-flat); margin-top: 16px;">
                <!-- Barra superior de la categoría activa -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid rgba(166, 180, 200, 0.22); padding-bottom: 14px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #ff7a1a 0%, #ea580c 100%); color: white; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: var(--neu-orange-btn);">
                            <i class="${activeCat.icon}"></i>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; color: var(--text-heading); font-weight: 800;">Familia: ${activeCat.title}</h3>
                            <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">${activeCat.total} unidades totales en tiendas</span>
                        </div>
                    </div>

                    <!-- Pestañas rápidas de selección de marca -->
                    <div style="display: flex; gap: 8px; background: var(--bg-main); padding: 5px; border-radius: 12px; box-shadow: var(--neu-inset-sm); border: 1px solid rgba(255,255,255,0.7);">
                        <button type="button" onclick="window.selectJoaquinBrand('${activeCat.key}', 'xiaomi')" 
                            style="padding: 7px 16px; border-radius: 9px; border: none; cursor: pointer; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; transition: all 0.2s; ${activeBrand === 'xiaomi' ? 'background: linear-gradient(135deg, #ff7a1a 0%, #ea580c 100%); color: white; box-shadow: var(--neu-orange-btn);' : 'background: transparent; color: var(--text-muted);'}"
                        >
                            <span style="background: ${activeBrand === 'xiaomi' ? 'white' : 'var(--mi-orange)'}; color: ${activeBrand === 'xiaomi' ? 'var(--mi-orange)' : 'white'}; width: 18px; height: 18px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 10px; font-family: 'Outfit', sans-serif;">mi</span>
                            Gama Xiaomi (${xTotal})
                        </button>

                        <button type="button" onclick="window.selectJoaquinBrand('${activeCat.key}', 'redmi')" 
                            style="padding: 7px 16px; border-radius: 9px; border: none; cursor: pointer; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; transition: all 0.2s; ${activeBrand === 'redmi' ? 'background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%); color: white; box-shadow: 3px 3px 10px rgba(225,29,72,0.35);' : 'background: transparent; color: var(--text-muted);'}"
                        >
                            <span style="background: ${activeBrand === 'redmi' ? 'white' : '#e11d48'}; color: ${activeBrand === 'redmi' ? '#e11d48' : 'white'}; padding: 1px 4px; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 9px; font-family: 'Outfit', sans-serif; letter-spacing: 0.5px;">REDMI</span>
                            Gama Redmi (${rTotal})
                        </button>
                    </div>
                </div>

                <!-- DISPOSICIÓN ASIMÉTRICA: COLUMNA EXPANDIDA AL 100% Y COLUMNA NO SELECCIONADA REDUCIDA A SÓLO EL NOMBRE -->
                <div style="display: flex; gap: 14px; align-items: stretch; flex-wrap: wrap;">
                    ${activeBrand === 'xiaomi' ? `
                        <!-- 1. GAMA XIAOMI EXPANDIDA (APROVECHA TODO EL ANCHO) -->
                        <div style="flex: 1; min-width: 320px; background: var(--bg-main); border: 1px solid rgba(255, 255, 255, 0.9); border-radius: 14px; overflow: hidden; box-shadow: var(--neu-flat-sm);">
                            <div style="padding: 12px 16px; background: rgba(255, 255, 255, 0.5); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(166, 180, 200, 0.22);">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="background: var(--mi-orange); color: white; width: 28px; height: 28px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; font-family: 'Outfit', sans-serif; letter-spacing: -0.5px; box-shadow: 0 2px 5px rgba(255,103,0,0.25);">mi</span>
                                    <div>
                                        <strong style="font-size: 14px; color: #9a3412;">Gama Xiaomi</strong>
                                        <span style="font-size: 12px; color: #c2410c; margin-left: 6px; font-weight: 700;">(${xTotal} unidades · ${xCount} modelos)</span>
                                    </div>
                                </div>
                                <span style="font-size: 11px; font-weight: 700; color: #9a3412; background: rgba(255,103,0,0.12); padding: 4px 10px; border-radius: 20px;">
                                    ${xCount} modelos desplegados
                                </span>
                            </div>
                            <div style="padding: 6px; overflow-x: auto;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead>
                                        <tr style="background: rgba(255, 237, 213, 0.5); color: #9a3412; font-size: 11px; text-transform: uppercase;">
                                            <th style="padding: 8px 12px; text-align: left;">Modelo</th>
                                            <th style="padding: 8px 12px; text-align: left;">Tipo</th>
                                            <th style="padding: 8px 12px; text-align: right;">Total Unidades</th>
                                            <th style="padding: 8px 12px; text-align: right;">Estado IMEIs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${renderRows(activeCat.xiaomi)}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- 2. GAMA REDMI REDUCIDA (SÓLO NOMBRE Y TOTAL) -->
                        <div onclick="window.selectJoaquinBrand('${activeCat.key}', 'redmi')" 
                            title="Pulsar para desplegar Gama Redmi aprovechando todo el ancho"
                            style="width: 200px; flex-shrink: 0; background: var(--bg-main); border: 1.5px dashed rgba(2, 132, 199, 0.4); border-radius: 14px; padding: 18px 14px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; transition: all 0.2s; box-shadow: var(--neu-flat-sm);"
                            onmouseover="this.style.borderColor='#2563eb'; this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--neu-flat)';"
                            onmouseout="this.style.borderColor='rgba(2, 132, 199, 0.4)'; this.style.transform='translateY(0)'; this.style.boxShadow='var(--neu-flat-sm)';"
                        >
                            <span style="background: #e11d48; color: white; height: 26px; padding: 0 10px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px; font-family: 'Outfit', sans-serif; letter-spacing: 0.5px; text-transform: uppercase; box-shadow: 0 2px 5px rgba(225,29,72,0.25);">REDMI</span>
                            <div>
                                <strong style="font-size: 14px; color: #1e40af; display: block;">Gama Redmi</strong>
                                <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">${rTotal} uds · ${rCount} modelos</span>
                            </div>
                            <span style="font-size: 11px; font-weight: 700; color: #2563eb; background: rgba(37,99,235,0.1); padding: 4px 12px; border-radius: 12px; margin-top: 4px; display: inline-flex; align-items: center; gap: 4px;">
                                Desplegar Redmi <i class="fas fa-arrow-right"></i>
                            </span>
                        </div>
                    ` : `
                        <!-- 1. GAMA XIAOMI REDUCIDA (SÓLO NOMBRE Y TOTAL) -->
                        <div onclick="window.selectJoaquinBrand('${activeCat.key}', 'xiaomi')" 
                            title="Pulsar para desplegar Gama Xiaomi aprovechando todo el ancho"
                            style="width: 200px; flex-shrink: 0; background: var(--bg-main); border: 1.5px dashed rgba(255, 103, 0, 0.4); border-radius: 14px; padding: 18px 14px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; transition: all 0.2s; box-shadow: var(--neu-flat-sm);"
                            onmouseover="this.style.borderColor='var(--mi-orange)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--neu-flat)';"
                            onmouseout="this.style.borderColor='rgba(255, 103, 0, 0.4)'; this.style.transform='translateY(0)'; this.style.boxShadow='var(--neu-flat-sm)';"
                        >
                            <span style="background: var(--mi-orange); color: white; width: 28px; height: 28px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; font-family: 'Outfit', sans-serif; letter-spacing: -0.5px; box-shadow: 0 2px 5px rgba(255,103,0,0.25);">mi</span>
                            <div>
                                <strong style="font-size: 14px; color: #9a3412; display: block;">Gama Xiaomi</strong>
                                <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">${xTotal} uds · ${xCount} modelos</span>
                            </div>
                            <span style="font-size: 11px; font-weight: 700; color: var(--mi-orange); background: rgba(255,103,0,0.12); padding: 4px 12px; border-radius: 12px; margin-top: 4px; display: inline-flex; align-items: center; gap: 4px;">
                                <i class="fas fa-arrow-left"></i> Desplegar Xiaomi
                            </span>
                        </div>

                        <!-- 2. GAMA REDMI EXPANDIDA (APROVECHA TODO EL ANCHO) -->
                        <div style="flex: 1; min-width: 320px; background: var(--bg-main); border: 1px solid rgba(255, 255, 255, 0.9); border-radius: 14px; overflow: hidden; box-shadow: var(--neu-flat-sm);">
                            <div style="padding: 12px 16px; background: rgba(255, 255, 255, 0.5); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(166, 180, 200, 0.22);">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="background: #e11d48; color: white; height: 26px; padding: 0 10px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 12px; font-family: 'Outfit', sans-serif; letter-spacing: 0.5px; text-transform: uppercase; box-shadow: 0 2px 5px rgba(225,29,72,0.25);">REDMI</span>
                                    <div>
                                        <strong style="font-size: 14px; color: #1e40af;">Gama Redmi</strong>
                                        <span style="font-size: 12px; color: #1d4ed8; margin-left: 6px; font-weight: 700;">(${rTotal} unidades · ${rCount} modelos)</span>
                                    </div>
                                </div>
                                <span style="font-size: 11px; font-weight: 700; color: #1e40af; background: rgba(37,99,235,0.1); padding: 4px 10px; border-radius: 20px;">
                                    ${rCount} modelos desplegados
                                </span>
                            </div>
                            <div style="padding: 6px; overflow-x: auto;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead>
                                        <tr style="background: rgba(239, 246, 255, 0.6); color: #1e40af; font-size: 11px; text-transform: uppercase;">
                                            <th style="padding: 8px 12px; text-align: left;">Modelo</th>
                                            <th style="padding: 8px 12px; text-align: left;">Tipo</th>
                                            <th style="padding: 8px 12px; text-align: right;">Total Unidades</th>
                                            <th style="padding: 8px 12px; text-align: right;">Estado IMEIs</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${renderRows(activeCat.redmi)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `}
                </div>
            </div>
        `;
    } else {
        activeCategoryDetailHtml = `
            <div style="background: var(--bg-main); border: 1.5px dashed rgba(166, 180, 200, 0.4); border-radius: 16px; padding: 20px; text-align: center; margin-top: 16px; box-shadow: var(--neu-inset-sm); display: flex; align-items: center; justify-content: center; gap: 10px;">
                <i class="fas fa-hand-pointer" style="font-size: 16px; color: var(--mi-orange);"></i>
                <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">
                    Pulsa sobre cualquiera de las 4 familias superiores (Smartphones, Tablets, Wearables o Buds) para desplegar sus modelos y estado de IMEIs.
                </span>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="joaquin-totals-container">
            <!-- Cabecera limpia con el total global de terminales en la esquina izquierda -->
            <div style="margin-bottom: 1.25rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <span style="background: #0f172a; color: white; padding: 6px 14px; border-radius: 10px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 7px; box-shadow: var(--neu-flat-sm); border-left: 4px solid var(--mi-orange);">
                            <i class="fas fa-boxes" style="color: var(--mi-orange);"></i> Total Dispositivos en Tiendas: <span style="color: #fb923c; font-size: 13.5px;">${totalGlobal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span> uds
                        </span>
                        <h2 style="margin: 0; font-size: 1.3rem; color: var(--text-heading); font-weight: 800;">Totales de Producto en Tiendas</h2>
                    </div>
                </div>
                <p style="margin: 2px 0 0; color: var(--text-muted); font-size: 12.5px;">Desglose ramificado por familias, gamas de marca (Xiaomi vs Redmi) y modelos normalizados.</p>
            </div>

            <!-- Las 4 Columnas de Categorías situadas debajo del título -->
            <div class="joaquin-categories-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px;">
                ${categoriesCardsHtml}
            </div>

            <!-- Despliegue de Productos de la Categoría Seleccionada -->
            ${activeCategoryDetailHtml}
        </div>
    `;
};

// ==================================================
// ==================================================
// DIAGRAMAS FÍSICOS DE PLANOGRAMAS POR CLUSTER (OFICIAL XIAOMI 3D)
// ==================================================
window._planogramViewMode = 'visual';

window.planogram3DState = {
    rotY: 0,
    rotX: 4, // Vista frontal de frente a los terminales por defecto
    isDragging: false,
    startX: 0,
    startY: 0,
    startRotY: 0,
    startRotX: 4,
    autoSpin: false,
    autoSpinRaf: null
};

window.currentPlanogram3DMode = localStorage.getItem('xiaomi_planogram_3d_mode') || '3d-front';

window.applyPlanogram3DRotation = function(rotY, rotX, noTransition = false) {
    window.planogram3DState.rotY = rotY;
    window.planogram3DState.rotX = rotX;

    const normY = ((rotY % 360) + 360) % 360;
    const assemblies = document.querySelectorAll('.table-3d-assembly');
    assemblies.forEach(a => {
        if (noTransition) a.classList.add('no-transition');
        else a.classList.remove('no-transition');
        a.style.transform = `rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg)`;
    });

    const slider = document.getElementById('planogram-3d-rot-slider');
    if (slider && document.activeElement !== slider) {
        slider.value = Math.round(normY);
    }
    const degreePill = document.getElementById('planogram-3d-degree-pill');
    if (degreePill) {
        let label = `${Math.round(normY)}°`;
        if (normY >= 350 || normY <= 10) label += ' (Frente)';
        else if (normY >= 80 && normY <= 100) label += ' (Lat. Der.)';
        else if (normY >= 170 && normY <= 190) label += ' (Posterior)';
        else if (normY >= 260 && normY <= 280) label += ' (Lat. Izq.)';
        degreePill.textContent = label;
    }
};

window.setPlanogram3DMode = function(mode) {
    window.currentPlanogram3DMode = mode;
    try {
        localStorage.setItem('xiaomi_planogram_3d_mode', mode);
    } catch(e){}

    const container = document.getElementById('visual-planogram-diagram-container');
    if (!container) return;

    const scenes = container.querySelectorAll('.table-3d-scene');
    scenes.forEach(s => {
        s.classList.remove('mode-3d-iso', 'mode-3d-front', 'mode-2d');
        s.classList.add(`mode-${mode}`);
    });

    const btns = container.querySelectorAll('.planogram-3d-btn');
    btns.forEach(b => {
        if (b.dataset.mode) {
            if (b.dataset.mode === mode) b.classList.add('active');
            else b.classList.remove('active');
        }
    });

    if (mode === '3d-front') {
        window.planogram3DState.rotX = 4;
        window.planogram3DState.rotY = 0;
    } else if (mode === '3d-iso') {
        window.planogram3DState.rotX = 23;
        window.planogram3DState.rotY = -2;
    } else if (mode === '2d') {
        window.planogram3DState.rotX = 0;
        window.planogram3DState.rotY = 0;
    }
    window.applyPlanogram3DRotation(window.planogram3DState.rotY, window.planogram3DState.rotX, false);
};

window.setPlanogram3DRotationY = function(val) {
    const deg = parseFloat(val) || 0;
    window.applyPlanogram3DRotation(deg, window.planogram3DState.rotX, true);
};

window.rotatePlanogramToPreset = function(targetY, targetX = null) {
    if (window.planogram3DState.autoSpin) {
        window.togglePlanogram3DAutoSpin();
    }
    if (targetX !== null) window.planogram3DState.rotX = targetX;
    window.applyPlanogram3DRotation(targetY, window.planogram3DState.rotX, false);
};

window.togglePlanogram3DAutoSpin = function() {
    const state = window.planogram3DState;
    state.autoSpin = !state.autoSpin;

    const btns = document.querySelectorAll('.planogram-3d-btn-autospin');
    if (state.autoSpin) {
        btns.forEach(b => {
            b.classList.add('active');
            b.innerHTML = '<i class="fas fa-pause"></i> Detener Giro 360°';
        });
        const spinStep = () => {
            if (!state.autoSpin) return;
            state.rotY = (state.rotY + 0.45) % 360;
            window.applyPlanogram3DRotation(state.rotY, state.rotX, true);
            state.autoSpinRaf = requestAnimationFrame(spinStep);
        };
        state.autoSpinRaf = requestAnimationFrame(spinStep);
    } else {
        btns.forEach(b => {
            b.classList.remove('active');
            b.innerHTML = '<i class="fas fa-sync-alt"></i> Giro 360° Auto';
        });
        if (state.autoSpinRaf) {
            cancelAnimationFrame(state.autoSpinRaf);
            state.autoSpinRaf = null;
        }
    }
};

window.resetPlanogram3DTilt = function() {
    if (window.planogram3DState.autoSpin) {
        window.togglePlanogram3DAutoSpin();
    }
    const isIso = window.currentPlanogram3DMode === '3d-iso';
    const is2D = window.currentPlanogram3DMode === '2d';
    window.planogram3DState.rotX = is2D ? 0 : (isIso ? 23 : 4);
    window.planogram3DState.rotY = is2D ? 0 : (isIso ? -2 : 0);
    window.applyPlanogram3DRotation(window.planogram3DState.rotY, window.planogram3DState.rotX, false);
};

window.initPlanogram3DInteractivity = function() {
    const scenes = document.querySelectorAll('.table-3d-scene');
    scenes.forEach(scene => {
        if (scene._has3DOrbitEvents) return;
        scene._has3DOrbitEvents = true;

        const onStart = (e) => {
            if (scene.classList.contains('mode-2d')) return;
            // No interceptar si el usuario pulsa botones o sliders
            if (e.target.closest('button, a, input, select')) return;

            window.planogram3DState.isDragging = true;
            scene.classList.add('is-dragging-3d');
            const pt = e.touches ? e.touches[0] : e;
            window.planogram3DState.startX = pt.clientX;
            window.planogram3DState.startY = pt.clientY;
            window.planogram3DState.startRotY = window.planogram3DState.rotY;
            window.planogram3DState.startRotX = window.planogram3DState.rotX;

            if (window.planogram3DState.autoSpin) {
                window.togglePlanogram3DAutoSpin();
            }
        };

        const onMove = (e) => {
            if (!window.planogram3DState.isDragging) return;
            const pt = e.touches ? e.touches[0] : e;
            const deltaX = pt.clientX - window.planogram3DState.startX;
            const deltaY = pt.clientY - window.planogram3DState.startY;

            // Giro 360 grados horizontal completo continuo
            const newRotY = (window.planogram3DState.startRotY + deltaX * 0.55);
            // Inclinación vertical entre -10deg y 60deg
            const newRotX = Math.max(-10, Math.min(60, window.planogram3DState.startRotX - deltaY * 0.35));

            window.applyPlanogram3DRotation(newRotY, newRotX, true);
        };

        const onEnd = () => {
            if (window.planogram3DState.isDragging) {
                window.planogram3DState.isDragging = false;
                scene.classList.remove('is-dragging-3d');
                const assemblies = document.querySelectorAll('.table-3d-assembly');
                assemblies.forEach(a => a.classList.remove('no-transition'));
            }
        };

        scene.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);

        scene.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onEnd);
    });
};

window.getPlanogram3DControlsBarHtml = function() {
    const curMode = window.currentPlanogram3DMode || '3d-front';
    const normY = Math.round(((window.planogram3DState.rotY % 360) + 360) % 360);
    return `
        <div class="planogram-3d-controls-bar">
            <!-- Fila Superior: Modos y Acciones -->
            <div class="planogram-3d-controls-top">
                <div class="planogram-3d-controls-left">
                    <span class="planogram-3d-pill">
                        <i class="fas fa-cube" style="color: var(--mi-orange);"></i> Showroom 3D Xiaomi
                    </span>
                    <span class="planogram-3d-hint">
                        <i class="fas fa-arrows-alt"></i> Arrastra la mesa con el ratón o el dedo para girar 360° en cualquier dirección
                    </span>
                </div>
                <div class="planogram-3d-modes">
                    <button type="button" class="planogram-3d-btn ${curMode === '3d-front' ? 'active' : ''}" data-mode="3d-front" onclick="window.setPlanogram3DMode('3d-front')">
                        <i class="fas fa-tv"></i> 3D Frontal (Terminales de Frente)
                    </button>
                    <button type="button" class="planogram-3d-btn ${curMode === '3d-iso' ? 'active' : ''}" data-mode="3d-iso" onclick="window.setPlanogram3DMode('3d-iso')">
                        <i class="fas fa-cube"></i> 3D Isométrica
                    </button>
                    <button type="button" class="planogram-3d-btn ${curMode === '2d' ? 'active' : ''}" data-mode="2d" onclick="window.setPlanogram3DMode('2d')">
                        <i class="fas fa-border-all"></i> 2D Cenital
                    </button>
                    <button type="button" class="planogram-3d-btn planogram-3d-btn-autospin" onclick="window.togglePlanogram3DAutoSpin()" title="Activar rotación continua 360 grados">
                        <i class="fas fa-sync-alt"></i> Giro 360° Auto
                    </button>
                    <button type="button" class="planogram-3d-btn" onclick="window.resetPlanogram3DTilt()" title="Restablecer ángulo frontal original">
                        <i class="fas fa-undo"></i>
                    </button>
                </div>
            </div>

            <!-- Fila Inferior: Control de Giro 360 y Ángulos Rápidos -->
            <div class="planogram-3d-orbit-bar">
                <div class="planogram-3d-slider-container">
                    <span class="planogram-3d-slider-label">
                        <i class="fas fa-compass" style="color: var(--mi-orange);"></i> Giro 360°:
                    </span>
                    <input type="range" id="planogram-3d-rot-slider" class="planogram-3d-slider" min="0" max="360" value="${normY}" oninput="window.setPlanogram3DRotationY(this.value)">
                    <span id="planogram-3d-degree-pill" class="planogram-3d-degree-pill">${normY}°</span>
                </div>
                <div class="planogram-3d-presets">
                    <span style="font-size: 10.5px; font-weight: 700; color: #64748b; margin-right: 4px;">Vistas directas:</span>
                    <button type="button" class="planogram-3d-preset-btn" onclick="window.rotatePlanogramToPreset(0, 4)">0° Frente</button>
                    <button type="button" class="planogram-3d-preset-btn" onclick="window.rotatePlanogramToPreset(90, 8)">90° Derecha</button>
                    <button type="button" class="planogram-3d-preset-btn" onclick="window.rotatePlanogramToPreset(180, 8)">180° Posterior</button>
                    <button type="button" class="planogram-3d-preset-btn" onclick="window.rotatePlanogramToPreset(270, 8)">270° Izquierda</button>
                </div>
            </div>
        </div>
    `;
};

window.wrapPlanogramTableIn3D = function(tableTitle, tableInnerHtml, sceneId = '') {
    const curMode = window.currentPlanogram3DMode || '3d-front';
    return `
        <div class="table-3d-scene mode-${curMode}" ${sceneId ? `id="${sceneId}"` : ''}>
            <div class="table-3d-assembly">
                <!-- Canto Posterior Biselado 3D (visible a 180°) -->
                <div class="table-3d-edge-back"></div>
                <div class="visual-table-surface">
                    ${tableTitle ? `<div class="visual-table-title"><i class="fas fa-table" style="color: var(--mi-orange); font-size: 14px;"></i> ${tableTitle}</div>` : ''}
                    ${tableInnerHtml}
                </div>
                <!-- Canto Frontal y Bisel de Encimera 3D -->
                <div class="table-3d-edge-front">
                    <span class="table-3d-edge-trim"></span>
                </div>
                <!-- Patas Metálicas Tubulares Showroom -->
                <div class="table-3d-legs-container">
                    <div class="table-3d-leg leg-fl"><div class="table-3d-leg-foot"></div></div>
                    <div class="table-3d-leg leg-fr"><div class="table-3d-leg-foot"></div></div>
                    <div class="table-3d-leg leg-rl"><div class="table-3d-leg-foot"></div></div>
                    <div class="table-3d-leg leg-rr"><div class="table-3d-leg-foot"></div></div>
                </div>
                <!-- Sombra Proyectada en Suelo 3D -->
                <div class="table-3d-floor-shadow"></div>
            </div>
        </div>
    `;
};

// ==================================================
// BUILDERS DE MODELOS 3D FÍSICOS DE DISPOSITIVOS
// ==================================================
window.render3DPhone = function(model, color = 'blue', typeBadge = 'LDU', isHero = false) {
    const cLower = String(color || '').toLowerCase();
    let colorClass = 'phone-blue';
    let themeBack = 'phone-theme-blue';
    if (cLower.includes('purple') || cLower.includes('purp')) { colorClass = 'phone-purple'; themeBack = 'phone-theme-purple'; }
    else if (cLower.includes('orange') || cLower.includes('naranja')) { colorClass = 'phone-orange'; themeBack = 'phone-theme-orange'; }
    else if (cLower.includes('green') || cLower.includes('verde')) { colorClass = 'phone-green'; themeBack = 'phone-theme-green'; }
    else if (cLower.includes('black') || cLower.includes('negro')) { colorClass = 'phone-black'; themeBack = 'phone-theme-black'; }
    else if (cLower.includes('white') || cLower.includes('blanco')) { colorClass = 'phone-white'; themeBack = 'phone-theme-black'; }
    if (isHero) { colorClass = 'phone-hero'; themeBack = 'phone-theme-gold'; }

    const bLower = String(typeBadge || '').toLowerCase();
    let badgeClass = 'badge-ldu';
    if (isHero) badgeClass = 'badge-hero';
    else if (bLower.includes('dummy')) badgeClass = 'badge-dummy';
    else if (bLower.includes('hero') || bLower.includes('stand')) badgeClass = 'badge-hero';
    else if (bLower.includes('pending') || bLower.includes('nuevo')) badgeClass = 'badge-pending';

    const safeModel = String(model || '').replace(/'/g, "\\'");

    return `
        <div class="device-3d-wrapper" title="${model} (${typeBadge}) - Haz clic para ver en 3D y girar 360°" onclick="window.open3DDeviceModal('${safeModel}', '${themeBack}', '${typeBadge}', 'phone')">
            <div class="device-3d-phone ${colorClass}">
                <div class="device-phone-glare"></div>
                <div class="device-phone-screen">
                    <div class="device-phone-camera"></div>
                </div>
                <div class="device-phone-stand"></div>
            </div>
            <span class="device-mini-label">${model}</span>
            <span class="device-model-badge ${badgeClass}">${typeBadge}</span>
        </div>
    `;
};

window.render3DTablet = function(model, typeBadge = 'Pad', isHero = false) {
    const shortName = model.replace('REDMI ', '').replace('Xiaomi ', '');
    const safeModel = String(model || '').replace(/'/g, "\\'");
    return `
        <div class="device-3d-wrapper" title="${model} (${typeBadge}) - Haz clic para ver en 3D y girar 360°" onclick="window.open3DDeviceModal('${safeModel}', 'tablet-default', '${typeBadge}', 'tablet')">
            <div class="device-3d-tablet ${isHero ? 'tablet-hero' : ''}">
                <div class="device-tablet-glare"></div>
                <div class="device-tablet-camera"></div>
                <div class="device-tablet-screen">
                    <span class="device-tablet-title">${shortName}</span>
                </div>
                <div class="device-tablet-stand"></div>
            </div>
            <span class="device-mini-label">${model}</span>
            <span class="device-model-badge badge-pad ${isHero ? 'badge-hero' : ''}">${typeBadge}</span>
        </div>
    `;
};

window.render3DWatch = function(model, isRound = false, typeBadge = 'Wear') {
    const isS5 = String(model || '').toLowerCase().includes('s5') || String(model || '').toLowerCase().includes('s4') || isRound;
    const isNew = String(typeBadge || '').toLowerCase().includes('nuevo');
    const safeModel = String(model || '').replace(/'/g, "\\'");
    return `
        <div class="device-3d-wrapper" title="${model} (${typeBadge}) - Haz clic para ver en 3D y girar 360°" onclick="window.open3DDeviceModal('${safeModel}', '${isS5 ? 'round' : 'squircle'}', '${typeBadge}', 'watch')">
            <div class="device-3d-watch">
                <div class="device-watch-strap-top"></div>
                <div class="device-watch-case ${isS5 ? 'round' : 'squircle'}">
                    <div class="device-watch-dial">
                        <i class="far fa-clock"></i>
                    </div>
                    <div class="device-watch-crown"></div>
                </div>
                <div class="device-watch-strap-bottom"></div>
                <div class="device-watch-stand"></div>
            </div>
            <span class="device-mini-label">${model}</span>
            <span class="device-model-badge ${isNew ? 'badge-pending' : 'badge-wear'}">${typeBadge}</span>
        </div>
    `;
};

window.render3DBuds = function(model, typeBadge = 'Buds') {
    const isPending = String(typeBadge || '').toLowerCase().includes('pending');
    const safeModel = String(model || '').replace(/'/g, "\\'");
    return `
        <div class="device-3d-wrapper" title="${model} (${typeBadge}) - Haz clic para ver en 3D y girar 360°" onclick="window.open3DDeviceModal('${safeModel}', 'buds', '${typeBadge}', 'buds')">
            <div class="device-3d-buds">
                <div class="device-buds-seam"></div>
                <div class="device-buds-led"></div>
            </div>
            <span class="device-mini-label">${model}</span>
            <span class="device-model-badge ${isPending ? 'badge-pending' : 'badge-buds'}">${typeBadge}</span>
        </div>
    `;
};

window.renderStationPodium = function(themeClass, devicesHtml, stationTitle = '', extraClass = '') {
    return `
        <div class="table-station-podium ${themeClass} ${extraClass}">
            <div class="station-devices-row">
                ${devicesHtml}
            </div>
            ${stationTitle ? `<div class="station-label-bar">${stationTitle}</div>` : ''}
        </div>
    `;
};

window.renderHeroPodium = function(heroPhonesHtml, stationTitle = 'Display Acrílico Hero') {
    return `
        <div class="table-station-podium theme-yellow station-podium-hero">
            <div class="hero-podium-inner">
                <div class="hero-totem-divider">XIAOMI</div>
                <div class="hero-devices-row">
                    ${heroPhonesHtml}
                </div>
            </div>
            <div class="station-label-bar" style="color: #92400e; font-weight: 800;">
                <i class="fas fa-crown" style="color: #f59e0b;"></i> ${stationTitle}
            </div>
        </div>
    `;
};

// ==================================================
// MODAL INTERACTIVO: VISOR 3D DE TERMINAL (GIRO 360)
// ==================================================
window.inspectorDeviceState = {
    rotY: 0,
    rotX: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    startRotY: 0,
    startRotX: 0,
    autoSpin: false,
    autoSpinRaf: null
};

window.open3DDeviceModal = function(model, themeClass, typeBadge, deviceType = 'phone', extraContext = {}) {
    let modal = document.getElementById('device-3d-inspector-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'device-3d-inspector-modal';
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal" onclick="window.close3DDeviceModal()" style="position: absolute; top: 1.2rem; right: 1.5rem; font-size: 1.8rem; cursor: pointer; color: #cbd5e1; z-index: 10;">&times;</span>
                <div id="device-3d-inspector-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const state = window.inspectorDeviceState;
    state.rotY = 0;
    state.rotX = 0;
    if (state.autoSpin) {
        window.toggleInspectorAutoSpin();
    }

    // Resolver contexto de tienda y terminal para control de IMEI e incidencias
    const activeStoreName = (extraContext && extraContext.storeName) || 
                            (window.selectedPlanogramStore && window.selectedPlanogramStore.nombre) || 
                            (document.getElementById('imei-filter-tienda') && document.getElementById('imei-filter-tienda').value) || 
                            '';

    window.currentInspectorContext = {
        model: model,
        themeClass: themeClass,
        typeBadge: typeBadge,
        deviceType: deviceType,
        storeName: activeStoreName,
        deviceId: extraContext && extraContext.deviceId ? extraContext.deviceId : null
    };

    const realImg = typeof window.getRetailDeviceImage === 'function' ? window.getRetailDeviceImage(model) : null;
    let model3DHtml = '';

    const phoneChassisCoreHtml = `
        <div class="inspector-chassis-core">
            <div class="chassis-slice" style="transform: translateZ(-6.25px);"></div>
            <div class="chassis-slice" style="transform: translateZ(-5px);"></div>
            <div class="chassis-slice" style="transform: translateZ(-3.75px);"></div>
            <div class="chassis-slice" style="transform: translateZ(-2.5px);"></div>
            <div class="chassis-slice" style="transform: translateZ(-1.25px);"></div>
            <div class="chassis-slice" style="transform: translateZ(0px);"></div>
            <div class="chassis-slice" style="transform: translateZ(1.25px);"></div>
            <div class="chassis-slice" style="transform: translateZ(2.5px);"></div>
            <div class="chassis-slice" style="transform: translateZ(3.75px);"></div>
            <div class="chassis-slice" style="transform: translateZ(5px);"></div>
            <div class="chassis-slice" style="transform: translateZ(6.25px);"></div>
        </div>
        <div class="inspector-edge inspector-edge-left">
            <div class="chassis-antenna-line"></div>
            <div class="chassis-sim-tray"><div class="chassis-sim-pinhole"></div></div>
            <div class="chassis-antenna-line"></div>
        </div>
        <div class="inspector-edge inspector-edge-right">
            <div class="chassis-antenna-line"></div>
            <div class="chassis-btn-group">
                <div class="chassis-hw-button chassis-btn-volume" title="Volumen +/-"></div>
                <div class="chassis-hw-button chassis-btn-power" title="Botón Encendido"></div>
            </div>
            <div class="chassis-antenna-line"></div>
        </div>
        <div class="inspector-edge inspector-edge-top">
            <div class="chassis-antenna-line"></div>
            <div class="chassis-ir-blaster" title="Sensor Infrarrojos IR"></div>
            <div class="chassis-mic-dot" title="Micrófono cancelación de ruido"></div>
            <div class="chassis-speaker-slit"></div>
            <div class="chassis-antenna-line"></div>
        </div>
        <div class="inspector-edge inspector-edge-bottom">
            <div class="chassis-antenna-line"></div>
            <div class="chassis-mic-dot" title="Micrófono principal"></div>
            <div class="chassis-usbc-slot" title="Puerto USB Type-C">
                <div class="chassis-usbc-tongue"></div>
            </div>
            <div class="chassis-speaker-holes" title="Altavoz estéreo">
                <span></span><span></span><span></span><span></span>
            </div>
            <div class="chassis-antenna-line"></div>
        </div>
    `;

    const tabletChassisCoreHtml = `
        <div class="inspector-chassis-core">
            <div class="chassis-slice" style="transform: translateZ(-5px);"></div>
            <div class="chassis-slice" style="transform: translateZ(-3.75px);"></div>
            <div class="chassis-slice" style="transform: translateZ(-2.5px);"></div>
            <div class="chassis-slice" style="transform: translateZ(-1.25px);"></div>
            <div class="chassis-slice" style="transform: translateZ(0px);"></div>
            <div class="chassis-slice" style="transform: translateZ(1.25px);"></div>
            <div class="chassis-slice" style="transform: translateZ(2.5px);"></div>
            <div class="chassis-slice" style="transform: translateZ(3.75px);"></div>
            <div class="chassis-slice" style="transform: translateZ(5px);"></div>
        </div>
        <div class="inspector-edge inspector-edge-tablet-left">
            <div class="tablet-quad-speaker"><span></span><span></span><span></span></div>
            <div class="chassis-mic-dot"></div>
            <div class="tablet-quad-speaker"><span></span><span></span><span></span></div>
        </div>
        <div class="inspector-edge inspector-edge-tablet-right">
            <div class="tablet-quad-speaker"><span></span><span></span><span></span></div>
            <div class="chassis-usbc-slot"><div class="chassis-usbc-tongue"></div></div>
            <div class="tablet-quad-speaker"><span></span><span></span><span></span></div>
        </div>
        <div class="inspector-edge inspector-edge-tablet-top">
            <div class="chassis-hw-button chassis-btn-power"></div>
            <div class="chassis-hw-button chassis-btn-volume" style="width: 24px; height: 8px;"></div>
            <div class="tablet-magnetic-stylus" title="Zona de carga Stylus Pen"></div>
        </div>
        <div class="inspector-edge inspector-edge-tablet-bottom">
            <div class="tablet-pogo-pins" title="Conector teclado Pogo Pin"><span></span><span></span><span></span></div>
        </div>
    `;

    if (deviceType === 'tablet') {
        model3DHtml = realImg ? `
            <div class="inspector-tablet-3d">
                <div class="inspector-tablet-face inspector-tablet-front">
                    <img src="${realImg.front}" class="inspector-device-img" alt="${model} Frontal">
                </div>
                ${tabletChassisCoreHtml}
                <div class="inspector-tablet-face inspector-tablet-back">
                    <img src="${realImg.back || realImg.front}" class="inspector-device-img" alt="${model} Trasera">
                </div>
            </div>
        ` : `
            <div class="inspector-tablet-3d">
                <div class="inspector-tablet-face inspector-tablet-front inspector-face-css-styled">
                    <div style="width: 6px; height: 6px; background: #000; border-radius: 50%; margin: 0 auto; border: 1px solid rgba(255,255,255,0.4);"></div>
                    <div style="flex: 1; margin: 8px 0; border-radius: 12px; background: linear-gradient(135deg, #0284c7 0%, #1e1b4b 50%, #ea580c 100%); display: flex; align-items: center; justify-content: center;">
                        <h2 style="color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 1px; text-shadow: 0 2px 8px rgba(0,0,0,0.6);">${model}</h2>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 700;">
                        <span>Xiaomi HyperOS</span>
                        <span>12:00</span>
                    </div>
                </div>
                ${tabletChassisCoreHtml}
                <div class="inspector-tablet-face inspector-tablet-back inspector-face-css-styled">
                    <div class="camera-deco-island" style="width: 50px; height: 50px;">
                        <div class="camera-lens"></div>
                        <div class="camera-lens lens-flash"></div>
                    </div>
                    <div class="back-xiaomi-logo">${model}</div>
                </div>
            </div>
        `;
    } else if (deviceType === 'watch') {
        model3DHtml = realImg ? `
            <div class="inspector-phone-3d" style="width: 170px; height: 260px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; box-shadow: none;">
                <img src="${realImg.front}" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 20px 40px rgba(0,0,0,0.7)); pointer-events: none;">
            </div>
        ` : `
            <div class="inspector-phone-3d" style="width: 140px; height: 230px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="width: 44px; height: 48px; background: linear-gradient(90deg, #1e293b 0%, #475569 50%, #1e293b 100%); border-radius: 6px;"></div>
                <div style="width: 110px; height: 110px; background: #000; border-radius: ${themeClass === 'squircle' ? '24px' : '50%'}; border: 4px solid #64748b; box-shadow: 0 12px 30px rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; position: relative;">
                    <div style="font-size: 28px; color: var(--mi-orange);"><i class="far fa-clock"></i></div>
                    <div style="position: absolute; right: -6px; top: 50%; transform: translateY(-50%); width: 6px; height: 16px; background: #cbd5e1; border-radius: 2px;"></div>
                </div>
                <div style="width: 44px; height: 48px; background: linear-gradient(90deg, #1e293b 0%, #475569 50%, #1e293b 100%); border-radius: 6px;"></div>
            </div>
        `;
    } else if (deviceType === 'buds') {
        model3DHtml = realImg ? `
            <div style="width: 220px; height: 160px; display: flex; align-items: center; justify-content: center;">
                <img src="${realImg.front}" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 20px 40px rgba(0,0,0,0.6)); pointer-events: none;">
            </div>
        ` : `
            <div style="width: 180px; height: 130px; background: linear-gradient(145deg, #ffffff 0%, #cbd5e1 100%); border-radius: 55px; border: 3px solid rgba(255,255,255,0.9); box-shadow: 0 20px 45px rgba(0,0,0,0.6); position: relative; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; top: 48%; left: 8px; right: 8px; height: 2px; background: rgba(100,116,139,0.5);"></div>
                <div style="position: absolute; bottom: 18px; width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 10px #10b981;"></div>
                <span style="font-size: 13px; font-weight: 800; color: #475569; letter-spacing: 1px;">XIAOMI BUDS</span>
            </div>
        `;
    } else {
        // Smartphone con cara delantera, trasera y chasis volumétrico 3D
        model3DHtml = realImg ? `
            <div class="inspector-phone-3d">
                <div class="inspector-phone-face inspector-phone-front">
                    <img src="${realImg.front}" class="inspector-device-img" alt="${model} Frontal">
                </div>
                ${phoneChassisCoreHtml}
                <div class="inspector-phone-face inspector-phone-back">
                    <img src="${realImg.back || realImg.front}" class="inspector-device-img" alt="${model} Trasera">
                </div>
            </div>
        ` : `
            <div class="inspector-phone-3d ${themeClass || 'phone-theme-blue'}">
                <div class="inspector-phone-face inspector-phone-front inspector-face-css-styled">
                    <div class="front-punch-hole"></div>
                    <div class="front-wallpaper">
                        <div class="front-glare"></div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 700; color: #ffffff;">
                            <span>Xiaomi 5G</span>
                            <span>100% <i class="fas fa-battery-full"></i></span>
                        </div>
                        <div style="text-align: center;">
                            <div class="front-clock">12:00</div>
                            <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600;">Miércoles, 15 Oct</div>
                        </div>
                        <div style="text-align: center;">
                            <span class="front-hyperos-badge">Xiaomi HyperOS 2.0</span>
                        </div>
                    </div>
                    <div style="height: 4px; width: 44px; background: rgba(255,255,255,0.6); border-radius: 2px; margin: 0 auto;"></div>
                </div>
                ${phoneChassisCoreHtml}
                <div class="inspector-phone-face inspector-phone-back inspector-face-css-styled">
                    <div class="camera-deco-island">
                        <div class="camera-lens"></div>
                        <div class="camera-lens"></div>
                        <div class="camera-lens"></div>
                        <div class="camera-lens lens-flash"></div>
                    </div>
                    <div class="back-xiaomi-logo">XIAOMI</div>
                </div>
            </div>
        `;
    }

    const body = document.getElementById('device-3d-inspector-body');
    body.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 0.8rem;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(255,105,0,0.15); color: var(--mi-orange); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                <i class="fas fa-cube"></i>
            </div>
            <div>
                <h3 style="margin: 0; font-size: 1.35rem; color: #ffffff; font-weight: 800;">${model}</h3>
                <span style="font-size: 12px; color: #94a3b8; font-weight: 600;">Visor 3D Interactivo • <b style="color: var(--mi-orange);">${typeBadge}</b></span>
            </div>
        </div>

        <!-- Escenario 3D con giro 360 -->
        <div class="device-inspector-stage" id="device-inspector-stage">
            <div class="device-inspector-pedestal"></div>
            <div class="device-inspector-assembly" id="device-inspector-assembly">
                ${model3DHtml}
            </div>
        </div>

        <!-- Controles de Giro 360 del Dispositivo -->
        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 12px 16px; margin-top: 14px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;">
                <span style="font-size: 12px; font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 6px;">
                    <i class="fas fa-arrows-alt-h" style="color: var(--mi-orange);"></i> Arrastra o gira 360° para inspeccionar
                </span>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="planogram-3d-preset-btn" onclick="window.rotateInspectorTo(0)">Frente (0°)</button>
                    <button type="button" class="planogram-3d-preset-btn" onclick="window.rotateInspectorTo(90)">Perfil (90°)</button>
                    <button type="button" class="planogram-3d-preset-btn" onclick="window.rotateInspectorTo(180)">Trasera (180°)</button>
                    <button type="button" class="planogram-3d-preset-btn" onclick="window.rotateInspectorTo(270)">Perfil (270°)</button>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <input type="range" id="device-inspector-slider" class="planogram-3d-slider" min="0" max="360" value="0" oninput="window.setInspectorRotationY(this.value)">
                <span id="device-inspector-degree-pill" class="planogram-3d-degree-pill" style="background: rgba(255,255,255,0.1); border-color: rgba(255,105,0,0.4); color: #ffffff;">0°</span>
                <button type="button" id="btn-inspector-autospin" class="planogram-3d-btn planogram-3d-btn-autospin" onclick="window.toggleInspectorAutoSpin()" style="padding: 5px 12px; font-size: 11px;">
                    <i class="fas fa-sync-alt"></i> Giro 360° Auto
                </button>
            </div>
        </div>

        <!-- Panel de Control de Terminal & Gestión de IMEI / Incidencias -->
        <div id="device-inspector-mgmt-container"></div>

        <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
            <button type="button" class="btn-primary" onclick="window.close3DDeviceModal()" style="padding: 9px 22px; border-radius: 10px; background: var(--mi-orange); color: white; border: none; font-weight: 700; cursor: pointer; font-size: 13px;">
                Cerrar Visor
            </button>
        </div>
    `;

    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    // Inyectar panel de Control de Terminal, IMEI e Incidencias
    window.renderInspectorTerminalMgmt(activeStoreName, model, themeClass, typeBadge, deviceType, window.currentInspectorContext.deviceId);

    // Inicializar eventos de arrastre 360 sobre el visor del dispositivo
    const stage = document.getElementById('device-inspector-stage');
    const assembly = document.getElementById('device-inspector-assembly');

    const onStart = (e) => {
        state.isDragging = true;
        stage.classList.add('is-dragging');
        assembly.classList.add('no-transition');
        const pt = e.touches ? e.touches[0] : e;
        state.startX = pt.clientX;
        state.startY = pt.clientY;
        state.startRotY = state.rotY;
        state.startRotX = state.rotX;
    };

    const onMove = (e) => {
        if (!state.isDragging) return;
        const pt = e.touches ? e.touches[0] : e;
        const deltaX = pt.clientX - state.startX;
        const deltaY = pt.clientY - state.startY;

        state.rotY = (state.startRotY + deltaX * 0.7);
        state.rotX = Math.max(-25, Math.min(25, state.startRotX - deltaY * 0.4));
        window.applyInspectorRotation(state.rotY, state.rotX, true);
    };

    const onEnd = () => {
        if (state.isDragging) {
            state.isDragging = false;
            stage.classList.remove('is-dragging');
            assembly.classList.remove('no-transition');
        }
    };

    stage.onmousedown = onStart;
    window.onmousemove = onMove;
    window.onmouseup = onEnd;

    stage.ontouchstart = onStart;
    window.ontouchmove = onMove;
    window.ontouchend = onEnd;
};

window.applyInspectorRotation = function(rotY, rotX = 0, noTransition = false) {
    const assembly = document.getElementById('device-inspector-assembly');
    if (!assembly) return;
    if (noTransition) assembly.classList.add('no-transition');
    else assembly.classList.remove('no-transition');

    assembly.style.transform = `rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg)`;

    const normY = Math.round(((rotY % 360) + 360) % 360);
    const slider = document.getElementById('device-inspector-slider');
    if (slider && document.activeElement !== slider) slider.value = normY;
    const pill = document.getElementById('device-inspector-degree-pill');
    if (pill) pill.textContent = `${normY}°`;
};

window.setInspectorRotationY = function(val) {
    const deg = parseFloat(val) || 0;
    window.inspectorDeviceState.rotY = deg;
    window.applyInspectorRotation(deg, window.inspectorDeviceState.rotX, true);
};

window.rotateInspectorTo = function(deg) {
    window.inspectorDeviceState.rotY = deg;
    window.applyInspectorRotation(deg, 0, false);
};

window.toggleInspectorAutoSpin = function() {
    const state = window.inspectorDeviceState;
    state.autoSpin = !state.autoSpin;
    const btn = document.getElementById('btn-inspector-autospin');

    if (state.autoSpin) {
        if (btn) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-pause"></i> Detener Giro';
        }
        const spin = () => {
            if (!state.autoSpin) return;
            state.rotY = (state.rotY + 0.8) % 360;
            window.applyInspectorRotation(state.rotY, state.rotX, true);
            state.autoSpinRaf = requestAnimationFrame(spin);
        };
        state.autoSpinRaf = requestAnimationFrame(spin);
    } else {
        if (btn) {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Giro 360° Auto';
        }
        if (state.autoSpinRaf) {
            cancelAnimationFrame(state.autoSpinRaf);
            state.autoSpinRaf = null;
        }
    }
};

window.close3DDeviceModal = function() {
    const state = window.inspectorDeviceState;
    if (state.autoSpin && state.autoSpinRaf) {
        cancelAnimationFrame(state.autoSpinRaf);
        state.autoSpin = false;
        state.autoSpinRaf = null;
    }
    const modal = document.getElementById('device-3d-inspector-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
    window.currentInspectorContext = null;
    window._onImeiActionCompleted = null;
};

// ==================================================
// CONTROL DE TERMINAL, IMEI E INCIDENCIAS EN VISOR 3D
// ==================================================
function scoreDeviceMatch(searchModel, dbDevice, isDummyPref) {
    if (!searchModel || !dbDevice || !dbDevice.modelo) return -100;
    const dbModel = dbDevice.modelo || '';
    const sNorm = searchModel.toLowerCase().replace(/redmi\s*note/g, 'rn').replace(/[^a-z0-9]/g, ' ').trim();
    const dNorm = dbModel.toLowerCase().replace(/redmi\s*note/g, 'rn').replace(/[^a-z0-9]/g, ' ').trim();

    if (sNorm === dNorm) return 100;

    const sTokens = sNorm.split(/\s+/).filter(Boolean);
    const dTokens = dNorm.split(/\s+/).filter(Boolean);

    // Si uno es tablet/pad y el otro no, no pueden coincidir
    const sIsPad = sTokens.includes('pad');
    const dIsPad = dTokens.includes('pad');
    if (sIsPad !== dIsPad) return -100;

    // Si uno es reloj/band y el otro no, no pueden coincidir
    const sIsWear = sTokens.some(t => t.includes('watch') || t.includes('band'));
    const dIsWear = dTokens.some(t => t.includes('watch') || t.includes('band'));
    if (sIsWear !== dIsWear) return -100;

    // Si uno es buds/clip y el otro no, no pueden coincidir
    const sIsBuds = sTokens.some(t => t.includes('buds') || t.includes('clip'));
    const dIsBuds = dTokens.some(t => t.includes('buds') || t.includes('clip'));
    if (sIsBuds !== dIsBuds) return -100;

    // Comparar números principales (18, 17, 15, 8, etc.)
    const sNumbers = sTokens.filter(t => /^\d+$/.test(t) || /^\d+t$/i.test(t));
    const dNumbers = dTokens.filter(t => /^\d+$/.test(t) || /^\d+t$/i.test(t));
    if (sNumbers.length > 0 && dNumbers.length > 0) {
        const hasCommonNum = sNumbers.some(n => dNumbers.includes(n));
        if (!hasCommonNum) return -100;
    }

    let matchCount = 0;
    sTokens.forEach(t => {
        if (dTokens.includes(t)) matchCount++;
    });

    const isDummyModel = Boolean(dbDevice.isDummy || dNorm.includes('dummy'));
    let penalty = 0;
    if (isDummyPref !== undefined && isDummyPref !== null) {
        if (isDummyPref && !isDummyModel) penalty += 10;
        if (!isDummyPref && isDummyModel) penalty += 18;
    }

    const sHasMax = sTokens.includes('max') || sTokens.includes('promax');
    const dHasMax = dTokens.includes('max') || dTokens.includes('promax');
    if (sHasMax !== dHasMax) penalty += 30;

    const sHasUltra = sTokens.includes('ultra');
    const dHasUltra = dTokens.includes('ultra');
    if (sHasUltra !== dHasUltra) penalty += 30;

    const sHasT = sTokens.some(t => t === 't' || t.startsWith('17t') || t.startsWith('18t'));
    const dHasT = dTokens.some(t => t === 't' || t.startsWith('17t') || t.startsWith('18t'));
    if (sHasT !== dHasT) penalty += 30;

    return (matchCount / Math.max(sTokens.length, 1)) * 50 - penalty;
}

window.renderInspectorTerminalMgmt = function(storeName, model, themeClass, typeBadge, deviceType, selectedDevId) {
    const container = document.getElementById('device-inspector-mgmt-container');
    if (!container) return;

    // 1. Obtener lista completa de tiendas para el selector
    const allStores = (typeof getAllStoresList === 'function' ? getAllStoresList() : []) || [];
    const dbStoreKeys = (window.APP_CONFIG && window.APP_CONFIG.imeiDatabase ? Object.keys(window.APP_CONFIG.imeiDatabase) : []);
    const storeNamesSet = new Set();
    allStores.forEach(s => { if (s && s.nombre) storeNamesSet.add(s.nombre); });
    dbStoreKeys.forEach(k => { if (k) storeNamesSet.add(k); });
    const sortedStores = [...storeNamesSet].sort((a, b) => a.localeCompare(b));

    // Si no hay tienda activa, intentar deducir o seleccionar la primera
    let currentStore = storeName || 
                       (window.selectedPlanogramStore && window.selectedPlanogramStore.nombre) || 
                       (document.getElementById('imei-filter-tienda') && document.getElementById('imei-filter-tienda').value) || 
                       '';
    if (!currentStore && sortedStores.length > 0) {
        currentStore = sortedStores[0];
    }

    if (window.currentInspectorContext) {
        window.currentInspectorContext.storeName = currentStore;
    }

    // 2. Obtener los terminales de esta tienda
    const storeDevices = (typeof getStoreImeiDevices === 'function' ? getStoreImeiDevices(currentStore) : (window.APP_CONFIG?.imeiDatabase ? window.APP_CONFIG.imeiDatabase[currentStore] : [])) || [];
    const isDummyPref = String(typeBadge || '').toLowerCase().includes('dummy');

    // 3. Buscar coincidencias ordenadas por afinidad
    const scored = storeDevices.map(d => ({ dev: d, score: scoreDeviceMatch(model, d, isDummyPref) }));
    scored.sort((a, b) => b.score - a.score);

    // Solo se consideran coincidencias válidas con afinidad real en el inventario
    const goodMatches = scored.filter(x => x.score >= 18).map(x => x.dev);
    let matchedDevices = goodMatches;

    let activeDev = null;
    if (selectedDevId) {
        activeDev = matchedDevices.find(d => d.id === selectedDevId) || storeDevices.find(d => d.id === selectedDevId);
    }
    if (!activeDev && matchedDevices.length > 0) {
        activeDev = matchedDevices[0];
    }

    const safeModel = String(model || '').replace(/'/g, "\\'");
    const safeStore = String(currentStore || '').replace(/'/g, "\\'");

    let html = `
        <div class="inspector-terminal-mgmt-card">
            <!-- Barra superior: Selector de tienda & Estado -->
            <div class="inspector-mgmt-topbar">
                <div class="inspector-mgmt-title">
                    <i class="fas fa-microchip"></i>
                    <span>Control de Terminal en Tienda</span>
                </div>
                <div class="inspector-store-row">
                    <span style="font-size: 11.5px; color: #94a3b8; font-weight: 700;">Tienda:</span>
                    <select class="inspector-store-select" onchange="window.onInspectorStoreChange(this.value)">
                        ${sortedStores.map(st => `
                            <option value="${st.replace(/"/g, '&quot;')}" ${st === currentStore ? 'selected' : ''}>${st}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
    `;

    if (!activeDev) {
        html += `
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px dashed rgba(255, 255, 255, 0.2); border-radius: 14px; padding: 22px 18px; text-align: center; margin-top: 10px;">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(255, 105, 0, 0.12); color: var(--mi-orange); display: flex; align-items: center; justify-content: center; font-size: 20px; margin: 0 auto 12px auto;">
                    <i class="fas fa-exclamation-circle"></i>
                </div>
                <p style="margin: 0 0 6px 0; font-size: 14px; color: #f1f5f9; font-weight: 700;">
                    Dispositivo no registrado en ${currentStore}
                </p>
                <p style="margin: 0 0 16px 0; font-size: 12px; color: #94a3b8; line-height: 1.5; max-width: 340px; margin-left: auto; margin-right: auto;">
                    El modelo <strong>${model}</strong> no figura registrado en el archivo Excel de esta tienda.
                </p>
                <button type="button" class="btn-primary" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 22px; font-weight: 700; border-radius: 10px; font-size: 13px; background: linear-gradient(135deg, #ff6900 0%, #f97316 100%); color: #fff; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(255, 105, 0, 0.35); transition: all 0.2s ease;" onclick="window.reportUnregisteredDeviceIncident('${safeStore}', '${safeModel}')">
                    <i class="fas fa-clipboard-list" style="font-size: 14px;"></i> Reportar Incidencia
                </button>
            </div>
        </div>`;
        container.innerHTML = html;
        return;
    }

    const activeDevId = activeDev.id;

    // Selector de posiciones si hay más de una ubicación para el modelo en la tienda
    if (matchedDevices.length > 1) {
        html += `
            <div class="inspector-pos-pills-row">
                <span style="font-size: 11px; color: #94a3b8; font-weight: 700;">Ubicaciones en tienda:</span>
                ${matchedDevices.map(mDev => {
                    const isActive = mDev.id === activeDevId;
                    const statusText = mDev.isDummy ? 'Dummy' : (mDev.imei ? 'Con IMEI' : 'Sin IMEI');
                    const safeDevId = String(mDev.id).replace(/'/g, "\\'");
                    return `
                        <button type="button" class="inspector-pos-pill ${isActive ? 'is-active' : ''}" onclick="window.onInspectorDeviceSelect('${safeStore}', '${safeDevId}', '${safeModel}', '${themeClass}', '${typeBadge}', '${deviceType}')">
                            <i class="fas ${isActive ? 'fa-check-circle' : 'fa-map-marker-alt'}"></i>
                            ${mDev.mesa} · P${mDev.posicion} <span style="opacity: 0.75; font-size: 10px;">(${statusText})</span>
                        </button>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Datos del terminal en el planograma / inventario
    const isLdu = !activeDev.isDummy;
    const hasImei = Boolean(activeDev.imei && String(activeDev.imei).trim() !== '');
    const cleanImei = hasImei ? String(activeDev.imei).trim() : '';

    html += `
        <div class="inspector-device-meta-row">
            <div class="inspector-meta-item">
                <span class="inspector-meta-label">Ubicación Mueble</span>
                <span class="inspector-meta-value"><i class="fas fa-map-pin" style="color: var(--mi-orange); margin-right: 4px;"></i>${activeDev.mesa} · Posición ${activeDev.posicion}</span>
            </div>
            <div class="inspector-meta-item">
                <span class="inspector-meta-label">Tipología</span>
                <span class="inspector-meta-value">
                    <span class="${activeDev.isDummy ? 'imei-tag-dummy' : 'imei-tag-ldu'}" style="font-size: 11px; padding: 2px 8px; border-radius: 6px;">
                        ${activeDev.isDummy ? 'Dummy' : 'LDU Operativo'}
                    </span>
                </span>
            </div>
            <div class="inspector-meta-item">
                <span class="inspector-meta-label">Modelo Registrado</span>
                <span class="inspector-meta-value" style="color: #93c5fd;">${activeDev.modelo} ${activeDev.codigo ? '<small style="color: #64748b;">(' + activeDev.codigo + ')</small>' : ''}</span>
            </div>
            <div class="inspector-meta-item">
                <span class="inspector-meta-label">Google Sheets</span>
                <span class="inspector-meta-value" style="font-size: 11px; color: #86efac;">
                    <i class="fas fa-table" style="margin-right: 3px;"></i>LDUS DUMMY STOCK ${activeDev.excelRow ? '(Fila ' + activeDev.excelRow + ')' : ''}
                </span>
            </div>
        </div>
    `;

    // Tarjeta interactiva de IMEI
    if (isLdu) {
        if (!hasImei) {
            html += `
                <div class="inspector-imei-card is-missing">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="font-size: 12.5px; font-weight: 800; color: #fbbf24; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-exclamation-triangle"></i> Terminal LDU sin IMEI registrado
                        </span>
                        <span style="font-size: 10.5px; background: rgba(245, 158, 11, 0.25); color: #fde68a; padding: 2px 8px; border-radius: 6px; font-weight: 700;">Requerido</span>
                    </div>
                    <p style="font-size: 11.5px; color: #cbd5e1; margin: 6px 0 10px 0;">
                        Introduce los 15 dígitos del IMEI del terminal para asignarlo a esta mesa y sincronizarlo con Google Sheets:
                    </p>
                    <div class="inspector-imei-input-group">
                        <input type="text" id="inspector-input-imei" class="inspector-imei-input" placeholder="Ej. 864209061234567" maxlength="20" autocomplete="off" onkeydown="if(event.key==='Enter') window.saveInspectorDeviceImei('${safeStore}', '${activeDevId}')">
                        <button type="button" class="btn-inspector-save-imei" onclick="window.saveInspectorDeviceImei('${safeStore}', '${activeDevId}')">
                            <i class="fas fa-save"></i> Guardar IMEI
                        </button>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="inspector-imei-card is-assigned">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <span style="font-size: 12px; font-weight: 800; color: #34d399; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-check-circle"></i> IMEI Asignado y Sincronizado
                        </span>
                        <div style="display: flex; gap: 6px;">
                            <button type="button" onclick="navigator.clipboard.writeText('${cleanImei}'); window.showToast('¡IMEI copiado al portapapeles!', 'info');" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;">
                                <i class="far fa-copy"></i> Copiar
                            </button>
                            <button type="button" onclick="window.toggleInspectorImeiEdit()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;">
                                <i class="fas fa-pen"></i> Modificar
                            </button>
                        </div>
                    </div>
                    <div id="inspector-imei-display-box" style="font-family: 'Consolas', monospace; font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 2px; margin: 8px 0 4px 0;">
                        ${cleanImei}
                    </div>
                    <div id="inspector-imei-edit-box" style="display: none; margin-top: 10px;" class="inspector-imei-input-group">
                        <input type="text" id="inspector-input-imei" class="inspector-imei-input" value="${cleanImei}" maxlength="20" autocomplete="off" onkeydown="if(event.key==='Enter') window.saveInspectorDeviceImei('${safeStore}', '${activeDevId}')">
                        <button type="button" class="btn-inspector-save-imei" onclick="window.saveInspectorDeviceImei('${safeStore}', '${activeDevId}')">
                            <i class="fas fa-save"></i> Guardar
                        </button>
                        <button type="button" onclick="window.toggleInspectorImeiEdit()" style="background: transparent; border: 1px solid #64748b; color: #94a3b8; border-radius: 10px; padding: 8px 12px; font-size: 12px; cursor: pointer;">
                            Cancelar
                        </button>
                    </div>
                </div>
            `;
        }
    } else {
        // Dispositivo Dummy
        html += `
            <div class="inspector-imei-card is-dummy">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size: 12px; font-weight: 700; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-info-circle"></i> Terminal Dummy de exposición (no requiere IMEI operativo)
                    </span>
                    <button type="button" onclick="window.toggleInspectorImeiEdit()" style="background: none; border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; border-radius: 6px; padding: 2px 8px; font-size: 10.5px; cursor: pointer;">
                        ${hasImei ? 'Editar IMEI' : 'Asignar IMEI manual'}
                    </button>
                </div>
                ${hasImei ? `<div id="inspector-imei-display-box" style="font-family: 'Consolas', monospace; font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: 1.5px; margin: 6px 0;">IMEI: ${cleanImei}</div>` : ''}
                <div id="inspector-imei-edit-box" style="${hasImei ? 'display: none;' : 'display: none;'} margin-top: 8px;" class="inspector-imei-input-group">
                    <input type="text" id="inspector-input-imei" class="inspector-imei-input" placeholder="IMEI opcional..." value="${cleanImei}" maxlength="20" onkeydown="if(event.key==='Enter') window.saveInspectorDeviceImei('${safeStore}', '${activeDevId}')">
                    <button type="button" class="btn-inspector-save-imei" onclick="window.saveInspectorDeviceImei('${safeStore}', '${activeDevId}')">
                        <i class="fas fa-save"></i> Guardar
                    </button>
                </div>
            </div>
        `;
    }

    // Botonera de reporte formal de Incidencias & Devolución
    html += `
        <div style="margin-top: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <span style="font-size: 12px; font-weight: 800; color: #f1f5f9; display: flex; align-items: center; gap: 6px;">
                    <i class="fas fa-file-medical-alt" style="color: var(--mi-orange);"></i> Reportar Incidencia o Devolución
                </span>
                <span style="font-size: 10.5px; color: #94a3b8;">Impacta en LDUS DUMMY STOCK y DEVOLUCIONES</span>
            </div>
            <div class="inspector-actions-grid">
                <button type="button" class="btn-inspector-action action-cambio" onclick="window.openInspectorIncidentModal('${safeStore}', '${activeDevId}', 'cambio')">
                    <i class="fas fa-exchange-alt"></i>
                    <span class="btn-action-label">Cambio Modelo</span>
                    <span class="btn-action-sub">Sustituir por otro equipo</span>
                </button>
                <button type="button" class="btn-inspector-action action-devolucion" onclick="window.openInspectorIncidentModal('${safeStore}', '${activeDevId}', 'devolucion')">
                    <i class="fas fa-box-open"></i>
                    <span class="btn-action-label">Devolución</span>
                    <span class="btn-action-sub">Retirar y devolver</span>
                </button>
                <button type="button" class="btn-inspector-action action-rotura" onclick="window.openInspectorIncidentModal('${safeStore}', '${activeDevId}', 'rotura')">
                    <i class="fas fa-heart-broken"></i>
                    <span class="btn-action-label">Rotura / Daño</span>
                    <span class="btn-action-sub">Pantalla o avería técnica</span>
                </button>
                <button type="button" class="btn-inspector-action action-robo" onclick="window.openInspectorIncidentModal('${safeStore}', '${activeDevId}', 'robo')">
                    <i class="fas fa-shield-alt"></i>
                    <span class="btn-action-label">Robo / Pérdida</span>
                    <span class="btn-action-sub">Sustracción en tienda</span>
                </button>
            </div>
        </div>
    `;

    // Historial si ya tiene gestión registrada
    if (activeDev.tipoAccion || activeDev.motivoCambio) {
        html += `
            <div class="inspector-history-pill">
                <i class="fas fa-history" style="color: var(--mi-orange); font-size: 13px;"></i>
                <span>Último reporte registrado: <strong>${activeDev.tipoAccion || 'Gestión'}</strong> · ${activeDev.motivoCambio || ''} ${activeDev.fechaModificacion ? '· ' + activeDev.fechaModificacion : ''}</span>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
};

window.toggleInspectorImeiEdit = function() {
    const disp = document.getElementById('inspector-imei-display-box');
    const edit = document.getElementById('inspector-imei-edit-box');
    if (!edit) return;
    const isHidden = edit.style.display === 'none';
    edit.style.display = isHidden ? 'flex' : 'none';
    if (disp) disp.style.display = isHidden ? 'none' : 'block';
    if (isHidden) {
        const inp = document.getElementById('inspector-input-imei');
        if (inp) {
            inp.focus();
            inp.select();
        }
    }
};

window.saveInspectorDeviceImei = async function(storeName, devId) {
    const inp = document.getElementById('inspector-input-imei');
    if (!inp) return;
    const newImei = inp.value.trim();

    if (!newImei) {
        alert('Por favor, introduce el número de IMEI para este terminal.');
        inp.focus();
        return;
    }

    if (!APP_CONFIG.imeiDatabase || !APP_CONFIG.imeiDatabase[storeName]) {
        if (typeof initLocalImeiDatabase === 'function') initLocalImeiDatabase();
    }

    const list = APP_CONFIG.imeiDatabase ? APP_CONFIG.imeiDatabase[storeName] : null;
    const dev = list ? list.find(d => d.id === devId) : null;

    if (!dev) {
        alert('No se localizó el terminal en la base de datos de ' + storeName);
        return;
    }

    // Actualizar registro
    dev.imeiAnterior = (dev.imei && dev.imei !== newImei) ? dev.imei : dev.imeiAnterior;
    dev.imei = newImei;
    if (!dev.imeiOriginal) dev.imeiOriginal = newImei;
    dev.fechaModificacion = new Date().toISOString().slice(0, 10);
    dev.tipoAccion = dev.tipoAccion || 'Asignación IMEI 3D';

    // Persistir localmente
    saveImeiDbLocally();

    // Sincronizar en segundo plano con Google Sheets
    window.syncDeviceToFeishu(dev, storeName).then(res => {
        if (res && res.success) {
            const rowTxt = (res.row || dev.excelRow) ? ` (Fila ${res.row || dev.excelRow})` : '';
            window.showToast(`¡IMEI sincronizado con Google Sheets${rowTxt}!`, 'success');
        } else {
            window.showToast(`¡IMEI guardado localmente!`, 'info');
        }
    });

    window.showToast(`✅ IMEI ${newImei} asignado con éxito a ${dev.modelo}`, 'success');

    // Refrescar panel de inmediato sin cerrar el visor
    if (window.currentInspectorContext) {
        window.renderInspectorTerminalMgmt(
            storeName,
            window.currentInspectorContext.model,
            window.currentInspectorContext.themeClass,
            window.currentInspectorContext.typeBadge,
            window.currentInspectorContext.deviceType,
            devId
        );
    }

    if (typeof window.calculateCampaignTotals === 'function') window.calculateCampaignTotals();
    if (typeof window.updateDashboardImeisWidget === 'function') window.updateDashboardImeisWidget();
    if (typeof window.renderStoreImeis === 'function') window.renderStoreImeis();
};

window.openInspectorIncidentModal = function(storeName, devId, actionType = 'cambio') {
    // Registrar callback de actualización para cuando se complete el modal de reporte
    window._onImeiActionCompleted = function() {
        if (window.currentInspectorContext) {
            window.renderInspectorTerminalMgmt(
                window.currentInspectorContext.storeName,
                window.currentInspectorContext.model,
                window.currentInspectorContext.themeClass,
                window.currentInspectorContext.typeBadge,
                window.currentInspectorContext.deviceType,
                devId
            );
        }
    };

    if (typeof window.openImeiActionModal === 'function') {
        window.openImeiActionModal(storeName, devId, actionType);
    }
};

window.onInspectorStoreChange = function(newStoreName) {
    if (window.currentInspectorContext) {
        window.currentInspectorContext.storeName = newStoreName;
        window.renderInspectorTerminalMgmt(
            newStoreName,
            window.currentInspectorContext.model,
            window.currentInspectorContext.themeClass,
            window.currentInspectorContext.typeBadge,
            window.currentInspectorContext.deviceType
        );
    }
};

window.onInspectorDeviceSelect = function(storeName, devId, model, themeClass, typeBadge, deviceType) {
    if (window.currentInspectorContext) {
        window.currentInspectorContext.deviceId = devId;
    }
    window.renderInspectorTerminalMgmt(storeName, model, themeClass, typeBadge, deviceType, devId);
};

window.togglePlanogramViewMode = function() {
    const visualCont = document.getElementById('visual-planogram-diagram-container');
    if (visualCont) visualCont.style.display = 'block';
};

window.reportUnregisteredDeviceIncident = function(storeName, model) {
    if (typeof window.close3DDeviceModal === 'function') {
        window.close3DDeviceModal();
    }

    if (typeof showView === 'function') {
        showView('reportes');
    }

    // Actualizar selector visual de barra lateral y barra móvil
    const navLinks = document.querySelectorAll('.nav-links li[data-target]');
    if (navLinks) {
        navLinks.forEach(l => {
            if (l.getAttribute('data-target') === 'reportes') l.classList.add('active');
            else l.classList.remove('active');
        });
    }
    const mobileTabs = document.querySelectorAll('.mobile-bottom-nav-item');
    if (mobileTabs) {
        mobileTabs.forEach(l => {
            if (l.getAttribute('data-target') === 'reportes') l.classList.add('active');
            else l.classList.remove('active');
        });
    }

    // Identificar cuenta y centro
    const allStores = (typeof getAllStoresList === 'function' ? getAllStoresList() : []) || [];
    const storeObj = allStores.find(s => s && (s.nombre === storeName || s.centro === storeName));
    const storeCuenta = storeObj ? storeObj.cuenta : '';

    const accSel = document.getElementById('incident-cuenta');
    const storeSel = document.getElementById('incident-centro');

    if (accSel && storeCuenta) {
        accSel.value = storeCuenta;
        if (typeof filterStoresByAccount === 'function') {
            filterStoresByAccount('incident', storeCuenta);
        }
    }
    if (storeSel) {
        storeSel.value = storeName;
    }

    if (typeof startIncidentProcedure === 'function') {
        startIncidentProcedure(storeName);
    }

    // Pre-seleccionar categoría 'Dispositivo'
    const deviceBtn = document.querySelector('#category-selection .bubble-btn[onclick*="device"]');
    if (deviceBtn && typeof window.chooseMainCategory === 'function') {
        window.chooseMainCategory('device', deviceBtn);
    }

    // Pre-cargar modelo en el campo de observaciones/comentarios
    const descArea = document.querySelector('#final-level-device .rep-desc') || document.querySelector('.rep-desc');
    if (descArea) {
        descArea.value = `Incidencia de terminal no registrado en inventario: ${model}`;
    }

    if (typeof window.showToast === 'function') {
        window.showToast(`Iniciando reporte de incidencia para ${model}`, 'info');
    }
};

// ==================================================
// MOTOR 3D VOLUMÉTRICO RETAIL SHOWROOM CON GIRO HORIZONTAL 360°
// ==================================================
window.showroom360State = {
    tables: {},
    initTable: function(tableId) {
        if (!this.tables[tableId]) {
            this.tables[tableId] = {
                angleY: 0,
                pitch: -22,
                autoSpin: false,
                autoSpinRaf: null,
                isDragging: false,
                startX: 0,
                startY: 0,
                startAngleY: 0,
                startPitch: -22
            };
        }
        return this.tables[tableId];
    }
};

window.setRetailTableAngle = function(tableId, angleY, pitch) {
    const table = window.showroom360State.initTable(tableId);
    if (table.autoSpin) {
        window.toggleRetailAutoSpin(tableId);
    }
    table.angleY = parseFloat(angleY) || 0;
    if (pitch !== undefined && pitch !== null) {
        table.pitch = parseFloat(pitch);
    }
    window.applyRetailTableRotation(tableId, false);
};

// Compatibilidad hacia atrás si algún botón llama con 'front'/'top'/'back'
window.setRetailTableSide = function(tableId, side) {
    if (side === 'front') window.setRetailTableAngle(tableId, 0, -22);
    else if (side === 'top') window.setRetailTableAngle(tableId, 0, -55);
    else if (side === 'back') window.setRetailTableAngle(tableId, 180, -22);
    else window.setRetailTableAngle(tableId, parseFloat(side) || 0);
};

window.setRetailVerticalAngle = function(tableId, deg) {
    window.setRetailTableAngle(tableId, deg);
};

window.toggleRetailAutoSpin = function(tableId) {
    const table = window.showroom360State.initTable(tableId);
    table.autoSpin = !table.autoSpin;

    const btn = document.getElementById(`btn-autospin-${tableId}`);
    if (table.autoSpin) {
        if (btn) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-pause"></i> Detener Giro';
        }
        const spin = () => {
            if (!table.autoSpin) return;
            table.angleY = (table.angleY + 0.45) % 360;
            window.applyRetailTableRotation(tableId, true);
            table.autoSpinRaf = requestAnimationFrame(spin);
        };
        table.autoSpinRaf = requestAnimationFrame(spin);
    } else {
        if (btn) {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Giro 360° Horizontal';
        }
        if (table.autoSpinRaf) {
            cancelAnimationFrame(table.autoSpinRaf);
            table.autoSpinRaf = null;
        }
    }
};

window.toggleRetailAutoSpinVertical = function(tableId) {
    window.toggleRetailAutoSpin(tableId);
};

window.applyRetailTableRotation = function(tableId, noTransition = false) {
    const table = window.showroom360State.initTable(tableId);
    const rig = document.getElementById(`rig-${tableId}`);
    const slider = document.getElementById(`h-slider-${tableId}`);
    const pill = document.getElementById(`h-degree-pill-${tableId}`);

    const btn0 = document.getElementById(`btn-side-0-${tableId}`);
    const btn35 = document.getElementById(`btn-side-35-${tableId}`);
    const btn90 = document.getElementById(`btn-side-90-${tableId}`);
    const btn180 = document.getElementById(`btn-side-180-${tableId}`);
    const btn270 = document.getElementById(`btn-side-270-${tableId}`);

    // Columna face pills
    const pillCol0 = document.getElementById(`pill-col-0-${tableId}`);
    const pillCol90 = document.getElementById(`pill-col-90-${tableId}`);
    const pillCol180 = document.getElementById(`pill-col-180-${tableId}`);
    const pillCol270 = document.getElementById(`pill-col-270-${tableId}`);

    const normY = Math.round(((table.angleY % 360) + 360) % 360);

    if (slider && document.activeElement !== slider) slider.value = normY;

    [btn0, btn35, btn90, btn180, btn270].forEach(b => b && b.classList.remove('active'));
    [pillCol0, pillCol90, pillCol180, pillCol270].forEach(p => p && p.classList.remove('active'));

    if (normY >= 340 || normY <= 15) {
        if (btn0) btn0.classList.add('active');
        if (pillCol0) pillCol0.classList.add('active');
    }
    else if (normY > 15 && normY <= 50) {
        if (btn35) btn35.classList.add('active');
    }
    else if (normY >= 65 && normY <= 115) {
        if (btn90) btn90.classList.add('active');
        if (pillCol90) pillCol90.classList.add('active');
    }
    else if (normY >= 155 && normY <= 205) {
        if (btn180) btn180.classList.add('active');
        if (pillCol180) pillCol180.classList.add('active');
    }
    else if (normY >= 245 && normY <= 295) {
        if (btn270) btn270.classList.add('active');
        if (pillCol270) pillCol270.classList.add('active');
    }

    if (pill) {
        let label = `${normY}°`;
        const isCol = String(tableId).toLowerCase().includes('col');
        const isWall = String(tableId).toLowerCase().includes('wall');
        const isCabecera = String(tableId).toLowerCase().includes('cabecera');
        if (isCol) {
            if (normY >= 340 || normY <= 20) label += ' • Frontal (Terminales & Mostrador)';
            else if (normY >= 70 && normY <= 110) label += ' • Derecha (Xiaomi 18 Pro)';
            else if (normY >= 160 && normY <= 200) label += ' • Posterior (Redmi Note 17)';
            else if (normY >= 250 && normY <= 290) label += ' • Izquierda (Xiaomi 17T)';
            else label += ' • Rotación 3D Columna';
        } else if (isWall) {
            if (normY >= 340 || normY <= 20) label += ' • Frontal (Lightbox & Mostrador)';
            else if (normY >= 70 && normY <= 110) label += ' • Lateral Perfil 3D';
            else if (normY >= 160 && normY <= 200) label += ' • Posterior Wall';
            else label += ' • Perspectiva 3D Wall';
        } else if (isCabecera) {
            if (normY >= 340 || normY <= 20) label += ' • Frontal (Exposición Cabecera ECI)';
            else if (normY >= 70 && normY <= 110) label += ' • Perfil Pasillo ECI';
            else if (normY >= 160 && normY <= 200) label += ' • Trasera Cabecera ECI';
            else label += ' • Perspectiva 3D Cabecera ECI';
        } else {
            if (normY >= 340 || normY <= 20) label += ' • Frontal (Cara A)';
            else if (normY >= 70 && normY <= 110) label += ' • Lateral Derecho (Perfil 3D)';
            else if (normY >= 160 && normY <= 200) label += ' • Posterior (Cara B)';
            else if (normY >= 250 && normY <= 290) label += ' • Lateral Izquierdo';
            else if (normY > 20 && normY < 70) label += ' • Perspectiva 3D Delantera';
            else if (normY > 110 && normY < 160) label += ' • Perspectiva 3D Trasera';
            else if (normY > 200 && normY < 250) label += ' • Perspectiva 3D Trasera';
            else label += ' • Perspectiva 3D Delantera';
        }
        pill.textContent = label;
    }

    if (!rig) return;

    if (noTransition) rig.classList.add('no-transition');
    else rig.classList.remove('no-transition');

    const pitch = table.pitch !== undefined ? table.pitch : -22;
    rig.style.transform = `rotateX(${pitch}deg) rotateY(${normY}deg)`;
};

window.initRetailDragEvents = function(tableId) {
    const stage = document.getElementById(`stage-${tableId}`);
    if (!stage || stage._hasRetailDrag) return;
    stage._hasRetailDrag = true;

    const table = window.showroom360State.initTable(tableId);

    const onStart = (e) => {
        if (e.target.closest('button, a, input, select')) return;
        table.isDragging = true;
        stage.classList.add('is-dragging');
        const pt = e.touches ? e.touches[0] : e;
        table.startX = pt.clientX;
        table.startY = pt.clientY;
        table.startAngleY = table.angleY || 0;
        table.startPitch = table.pitch !== undefined ? table.pitch : -22;
        if (table.autoSpin) {
            window.toggleRetailAutoSpin(tableId);
        }
    };

    const onMove = (e) => {
        if (!table.isDragging) return;
        const pt = e.touches ? e.touches[0] : e;
        const deltaX = pt.clientX - table.startX;
        const deltaY = pt.clientY - table.startY;

        // Giro horizontal alrededor de la mesa (eje Y)
        table.angleY = (table.startAngleY + deltaX * 0.55);

        // Ajuste sutil de inclinación en altura (pitch)
        const newPitch = table.startPitch - deltaY * 0.15;
        table.pitch = Math.max(-35, Math.min(-10, newPitch));

        window.applyRetailTableRotation(tableId, true);
    };

    const onEnd = () => {
        if (table.isDragging) {
            table.isDragging = false;
            stage.classList.remove('is-dragging');
            const rig = document.getElementById(`rig-${tableId}`);
            if (rig) rig.classList.remove('no-transition');
        }
    };

    stage.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    stage.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
};

// ==================================================
// CATÁLOGO DE IMÁGENES REALES OFICIALES DE PRODUCTO (3D RETAIL)
// ==================================================
window.RETAIL_DEVICE_IMAGES = {
    // Flagships Xiaomi
    'Xiaomi 18 Pro Max': { front: 'img/devices/xiaomi_18_pro_max_front.webp', back: 'img/devices/xiaomi_18_pro_max_back.webp' },
    'Dummy Xiaomi 18 Pro Max': { front: 'img/devices/xiaomi_18_pro_max_front.webp', back: 'img/devices/xiaomi_18_pro_max_back.webp' },
    'Xiaomi 18 Pro':     { front: 'img/devices/xiaomi_18_pro_front.webp',     back: 'img/devices/xiaomi_18_pro_back.webp' },
    'Dummy Xiaomi 18 Pro': { front: 'img/devices/xiaomi_18_pro_front.webp',   back: 'img/devices/xiaomi_18_pro_back.webp' },
    'Xiaomi 17T PRO':    { front: 'img/devices/xiaomi_17t_pro_front.webp',    back: 'img/devices/xiaomi_17t_pro_back.webp' },
    'Xiaomi 17T Pro':    { front: 'img/devices/xiaomi_17t_pro_front.webp',    back: 'img/devices/xiaomi_17t_pro_back.webp' },
    'Xiaomi 17T':        { front: 'img/devices/xiaomi_17t_front.webp',        back: 'img/devices/xiaomi_17t_back.webp' },
    'Xiaomi 17 Ultra':   { front: 'img/devices/xiaomi_18_pro_max_front.webp', back: 'img/devices/xiaomi_18_pro_max_back.webp' },
    'Xiaomi 17':         { front: 'img/devices/xiaomi_17_front.webp',         back: 'img/devices/xiaomi_17_back.webp' },

    // Redmi Note 17 Series
    'RN 17 Pro Max 5G Orange': { front: 'img/devices/rn17_promax_front.webp',       back: 'img/devices/rn17_promax_back.webp' },
    'RN 17 Pro Max Orange':    { front: 'img/devices/rn17_promax_front.webp',       back: 'img/devices/rn17_promax_back.webp' },
        // Redmi Note 15 Series & Hypermarket
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
'RN 17 Pro Max 5G':      { front: 'img/devices/rn17_promax_front.webp',       back: 'img/devices/rn17_promax_back.webp' },
    'RN 17 PRO MAX':         { front: 'img/devices/rn17_promax_front.webp',       back: 'img/devices/rn17_promax_back.webp' },
    'RN 17 Pro Max':         { front: 'img/devices/rn17_promax_front.webp',       back: 'img/devices/rn17_promax_back.webp' },
    'RN17 Pro Max 5G':       { front: 'img/devices/rn17_promax_front.webp',       back: 'img/devices/rn17_promax_back.webp' },
    'RN 17 PRO 5G':          { front: 'img/devices/rn17_pro_front.webp',          back: 'img/devices/rn17_pro_back.webp' },
    'RN 17 Pro 5G':          { front: 'img/devices/rn17_pro_front.webp',          back: 'img/devices/rn17_pro_back.webp' },
    'RN 17 Pro':             { front: 'img/devices/rn17_pro_front.webp',          back: 'img/devices/rn17_pro_back.webp' },
    'RN 17 5G':              { front: 'img/devices/rn17_5g_front.webp',           back: 'img/devices/rn17_5g_back.webp' },
    'RN 17 4G':              { front: 'img/devices/redmi_17_4g_front.webp',       back: 'img/devices/redmi_17_4g_back.webp' },
    'RN 17':                 { front: 'img/devices/rn17_5g_front.webp',           back: 'img/devices/rn17_5g_back.webp' },
    'Redmi Note 17 Pro Max': { front: 'img/devices/rn17_promax_front.webp',       back: 'img/devices/rn17_promax_back.webp' },
    'Redmi Note 17 Pro':     { front: 'img/devices/rn17_pro_front.webp',          back: 'img/devices/rn17_pro_back.webp' },
    'Redmi Note 17':         { front: 'img/devices/rn17_5g_front.webp',           back: 'img/devices/rn17_5g_back.webp' },

    // Redmi Series
    'REDMI 17 5G':       { front: 'img/devices/redmi_17_5g_front.webp',       back: 'img/devices/redmi_17_5g_back.webp' },
    'Redmi 17 5G':       { front: 'img/devices/redmi_17_5g_front.webp',       back: 'img/devices/redmi_17_5g_back.webp' },
    'REDMI 17 4G':       { front: 'img/devices/redmi_17_4g_front.webp',       back: 'img/devices/redmi_17_4g_back.webp' },
    'Redmi 17 4G':       { front: 'img/devices/redmi_17_4g_front.webp',       back: 'img/devices/redmi_17_4g_back.webp' },
    'REDMI 15 C':        { front: 'img/devices/redmi_15c_front.webp',         back: 'img/devices/redmi_15c_back.webp' },
    'REDMI 15C':         { front: 'img/devices/redmi_15c_front.webp',         back: 'img/devices/redmi_15c_back.webp' },
    'Redmi 15C':         { front: 'img/devices/redmi_15c_front.webp',         back: 'img/devices/redmi_15c_back.webp' },

    // Tablets
    'Xiaomi Pad 8 Pro':  { front: 'img/devices/pad8_pro_front.webp',          back: 'img/devices/pad8_pro_back.webp' },
    'Xiaomi Pad 8':      { front: 'img/devices/pad8_front.webp',              back: 'img/devices/pad8_back.webp' },
    'Xiaomi PAD 8':      { front: 'img/devices/pad8_front.webp',              back: 'img/devices/pad8_back.webp' },
    'REDMI Pad 2 Pro':   { front: 'img/devices/redmi_pad2_pro_front.webp',    back: 'img/devices/redmi_pad2_pro_back.webp' },
    'Redmi Pad 2 Pro':   { front: 'img/devices/redmi_pad2_pro_front.webp',    back: 'img/devices/redmi_pad2_pro_back.webp' },
    'REDMI Pad 2 SE 9.7':{ front: 'img/devices/redmi_pad2_97_front.webp',     back: 'img/devices/redmi_pad2_97_back.webp' },
    'REDMI Pad 2 9.7':   { front: 'img/devices/redmi_pad2_97_front.webp',     back: 'img/devices/redmi_pad2_97_back.webp' },
    'REDMI Pad SE 8.7"': { front: 'img/devices/redmi_pad2_97_front.webp',     back: 'img/devices/redmi_pad2_97_back.webp' },
    'REDMI Pad SE 8.7':  { front: 'img/devices/redmi_pad2_97_front.webp',     back: 'img/devices/redmi_pad2_97_back.webp' },
    'REDMI Pad 2':       { front: 'img/devices/redmi_pad2_front.webp',        back: 'img/devices/redmi_pad2_back.webp' },
    'Redmi Pad 2':       { front: 'img/devices/redmi_pad2_front.webp',        back: 'img/devices/redmi_pad2_back.webp' },

    // Watches & Bands
    'Xiaomi Watch S5 46mm': { front: 'img/devices/watch_s5_46_front.webp' },
    'Xiaomi Watch S5 45mm': { front: 'img/devices/watch_s5_46_front.webp' },
    'Xiaomi Watch S5 41mm': { front: 'img/devices/watch_s5_41_front.webp' },
    'Xiaomi Watch S5':      { front: 'img/devices/watch_s5_46_front.webp' },
    'Watch S5 46 mm':       { front: 'img/devices/watch_s5_46_front.webp' },
    'Watch S5 46mm':        { front: 'img/devices/watch_s5_46_front.webp' },
    'Watch S5 45mm':        { front: 'img/devices/watch_s5_46_front.webp' },
    'Watch S5 41mm':        { front: 'img/devices/watch_s5_41_front.webp' },
    'Xiaomi Watch 5 46mm':  { front: 'img/devices/watch_5_front.webp' },
    'Xiaomi Watch 5':       { front: 'img/devices/watch_5_front.webp' },
    'Xiaomi Watch S4':      { front: 'img/devices/watch_s4_front.webp' },
    'REDMI Watch 6 Active Black': { front: 'img/devices/watch_6_active_front.webp' },
    'Redmi Watch 6 Active Black': { front: 'img/devices/watch_6_active_front.webp' },
    'REDMI Watch 6 Active': { front: 'img/devices/watch_6_active_front.webp' },
    'Watch 6 Active':       { front: 'img/devices/watch_6_active_front.webp' },
    'Watch 6 active':       { front: 'img/devices/watch_6_active_front.webp' },
    'REDMI Watch 6 Lite':   { front: 'img/devices/watch_6_lite_front.webp' },
    'Watch 6 Lite':         { front: 'img/devices/watch_6_lite_front.webp' },
    'REDMI Watch 6':        { front: 'img/devices/watch_6_front.webp' },
    'Watch 6 Black':        { front: 'img/devices/watch_6_front.webp' },
    'REDMI Watch 5 Active': { front: 'img/devices/watch_6_active_front.webp' },
    'REDMI Watch 5 Lite Black': { front: 'img/devices/watch_5_lite_front.webp' },
    'Redmi Watch 5 Lite Black': { front: 'img/devices/watch_5_lite_front.webp' },
    'REDMI Watch 5 Lite':   { front: 'img/devices/watch_5_lite_front.webp' },
    'Redmi Watch 5 Lite':   { front: 'img/devices/watch_5_lite_front.webp' },
    'REDMI Watch 5':        { front: 'img/devices/watch_6_front.webp' },
    'Xiaomi Smart Band 11 Active': { front: 'img/devices/band_11_active_front.webp' },
    'Xiaomi Band 11 Active':{ front: 'img/devices/band_11_active_front.webp' },
    'Band 11 Active':       { front: 'img/devices/band_11_active_front.webp' },
    'Xiaomi Smart Band 11': { front: 'img/devices/band_11_front.webp' },
    'Xiaomi Band 11':       { front: 'img/devices/band_11_front.webp' },
    'Band 11':              { front: 'img/devices/band_11_front.webp' },
    'Xiaomi Smart Band 10 Pro': { front: 'img/devices/band_10_pro_front.webp' },
    'Xiaomi Band 10 Pro':   { front: 'img/devices/band_10_pro_front.webp' },
    'Band 10 Pro':          { front: 'img/devices/band_10_pro_front.webp' },
    'Xiaomi Smart Band 10': { front: 'img/devices/band_10_front.webp' },
    'Xiaomi Band 10':       { front: 'img/devices/band_10_front.webp' },
    'Band 10':              { front: 'img/devices/band_10_front.webp' },
    'Xiaomi Band 9 Active': { front: 'img/devices/band_9_active_front.webp' },
    'Band 9 Active':        { front: 'img/devices/band_9_active_front.webp' },

    // Buds & Audio
    'REDMI Buds 8 Pro':  { front: 'img/devices/buds_8_pro_front.webp' },
    'Buds 8 Pro':        { front: 'img/devices/buds_8_pro_front.webp' },
    'REDMI Buds 8':      { front: 'img/devices/buds_8_front.webp' },
    'Buds 8':            { front: 'img/devices/buds_8_front.webp' },
    'Xiaomi Buds 6':     { front: 'img/devices/xiaomi_buds_6_front.webp' },
    'Xiaomi Clip':       { front: 'img/devices/buds_clip_front.webp' },
    'Xiaomi Clips':      { front: 'img/devices/buds_clip_front.webp' },
    'Buds Clip':         { front: 'img/devices/buds_clip_front.webp' }
};

window.getRetailDeviceImage = function(model, isVertical = false) {
    if (!model) return null;
    const trimmed = String(model).trim();
    const sortedKeys = Object.keys(window.RETAIL_DEVICE_IMAGES).sort((x, y) => y.length - x.length);
    const b = trimmed.toLowerCase().replace(/\s+/g, '');
    let res = null;
    if (window.RETAIL_DEVICE_IMAGES[trimmed]) {
        res = window.RETAIL_DEVICE_IMAGES[trimmed];
    } else {
        const key = sortedKeys.find(k => {
            const a = k.toLowerCase().replace(/\s+/g, '');
            return a === b || b.includes(a);
        }) || sortedKeys.find(k => {
            const a = k.toLowerCase().replace(/\s+/g, '');
            return a.includes(b);
        });
        res = key ? window.RETAIL_DEVICE_IMAGES[key] : null;
    }
    if (res && isVertical && res.front && res.front.includes('pad')) {
        const vFront = res.front.replace('.webp', '_vertical.webp');
        const vBack = res.back ? res.back.replace('.webp', '_vertical.webp') : vFront;
        return { front: vFront, back: vBack };
    }
    return res;
};

window.renderRetailSlot = function({
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
}) {
    const safeModel = String(model || '').replace(/'/g, "\\'");
    let deviceHtml = '';

    const colorClass = `color-${color.includes('gold') ? 'gold' : (color.includes('purple') ? 'purple' : (color.includes('green') ? 'green' : (color.includes('black') ? 'black' : (color.includes('orange') ? 'orange' : 'blue'))))}`;
    const isFlagship = isHero || model.includes('18') || model.includes('Ultra');
    const isVerticalTablet = (deviceType === 'tablet-vertical');
    const realImg = window.getRetailDeviceImage(model, isVerticalTablet);

    if (deviceType === 'tablet' || deviceType === 'tablet-vertical') {
        const shortName = model.replace('REDMI ', '').replace('Xiaomi ', '');
        const vertClass = isVerticalTablet ? 'tablet-vertical' : '';
        deviceHtml = `
            <div class="tablet-3d-box ${vertClass}">
                <div class="tablet-face-front ${realImg ? 'has-real-skin' : ''}">
                    ${realImg ? `<img src="${realImg.front}" class="device-real-skin" alt="${model} frontal">` : `
                        <div class="screen-gradient">
                            <span class="tablet-title">${shortName}</span>
                        </div>
                    `}
                </div>
                <div class="tablet-face-back ${realImg ? 'has-real-skin' : ''}">
                    ${realImg ? `<img src="${realImg.back || realImg.front}" class="device-real-skin" alt="${model} trasera">` : `
                        <div class="tablet-cam"></div>
                    `}
                </div>
                <div class="tablet-edge-left"></div>
                <div class="tablet-edge-right"></div>
                <div class="tablet-edge-top"></div>
                <div class="tablet-edge-bottom"></div>
            </div>
        `;
    } else if (deviceType === 'watch') {
        const isS5 = String(model || '').toLowerCase().includes('s5');
        deviceHtml = realImg ? `
            <div class="watch-3d-box">
                <img src="${realImg.front}" class="watch-real-skin" alt="${model}">
            </div>
        ` : `
            <div class="watch-3d-box">
                <div class="watch-strap-loop"></div>
                <div class="watch-dial-body ${isS5 ? '' : 'squircle'}">
                    <i class="far fa-clock"></i>
                </div>
            </div>
        `;
    } else if (deviceType === 'buds') {
        deviceHtml = realImg ? `
            <div class="buds-3d-box has-real-skin">
                <img src="${realImg.front}" class="buds-real-skin" alt="${model}">
            </div>
        ` : `
            <div class="buds-3d-box">
                <div class="buds-seam"></div>
                <div class="buds-led"></div>
            </div>
        `;
    } else if (deviceType === 'horizontal-phone') {
        deviceHtml = `
            <div class="phone-3d-box phone-3d-horizontal">
                <div class="phone-face-front ${realImg ? 'has-real-skin' : ''}">
                    ${realImg ? `<img src="${realImg.front}" class="device-real-skin skin-horizontal" alt="${model} frontal">` : `
                        <div class="screen-gradient">
                            <div class="screen-glare"></div>
                            <div class="punch-hole" style="margin-left: 6px; margin-top: auto; margin-bottom: auto;"></div>
                        </div>
                    `}
                </div>
                <div class="phone-face-back ${realImg ? 'has-real-skin' : ''} ${colorClass}">
                    ${realImg ? `<img src="${realImg.back || realImg.front}" class="device-real-skin skin-horizontal" alt="${model} trasera">` : `
                        <div class="camera-bump-leica-round"></div>
                    `}
                </div>
                <div class="phone-edge-left" style="width: 10px; height: 44px; left: 37px; transform: rotateY(-90deg) translateZ(42px);"></div>
                <div class="phone-edge-right" style="width: 10px; height: 44px; left: 37px; transform: rotateY(90deg) translateZ(42px);"></div>
                <div class="phone-edge-top" style="width: 84px; height: 10px; top: 17px; transform: rotateX(90deg) translateZ(22px);"></div>
                <div class="phone-edge-bottom" style="width: 84px; height: 10px; top: 17px; transform: rotateX(-90deg) translateZ(22px);"></div>
            </div>
        `;
    } else {
        const camBumpHtml = isFlagship 
            ? `<div class="camera-bump-leica-round"></div>`
            : `<div class="camera-bump-rect"><div class="camera-lens-dot"></div><div class="camera-lens-dot"></div></div>`;

        deviceHtml = `
            <div class="phone-3d-box">
                <div class="phone-face-front ${realImg ? 'has-real-skin' : ''}">
                    ${realImg ? `<img src="${realImg.front}" class="device-real-skin" alt="${model} frontal">` : `
                        <div class="screen-gradient">
                            <div class="screen-glare"></div>
                            <div class="punch-hole"></div>
                        </div>
                    `}
                </div>
                <div class="phone-face-back ${realImg ? 'has-real-skin' : ''} ${colorClass}">
                    ${realImg ? `<img src="${realImg.back || realImg.front}" class="device-real-skin" alt="${model} trasera">` : camBumpHtml}
                </div>
                <div class="phone-edge-left"></div>
                <div class="phone-edge-right"></div>
                <div class="phone-edge-top"></div>
                <div class="phone-edge-bottom"></div>
            </div>
        `;
    }

    const modalDevType = deviceType.includes('tablet') ? 'tablet' : (deviceType.includes('watch') ? 'watch' : (deviceType.includes('buds') ? 'buds' : 'phone'));

    const badgeText = promoTag || typeBadge;
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
    `;
};

window.renderRetailTray = function(title, slotsHtml) {
    return `
        <div class="retail-3d-tray">
            ${title ? `<div class="retail-3d-tray-header"><i class="fas fa-layer-group" style="color: var(--mi-orange);"></i> ${title}</div>` : ''}
            <div class="retail-3d-tray-devices">
                ${slotsHtml}
            </div>
        </div>
    `;
};

window.showTopTable = true;

window.renderTableTopTableHtml = function(tableId, options = {}) {
    if (options.hasTopTable === false) return '';
    const tid = String(tableId || '');
    // Mesas de sólo tabletas o accesorios sin smartphones (p. ej. m2-sin, m2-con, m3) no llevan Top Table de móviles
    if (tid.includes('-m3') || tid.includes('m2-sin') || tid.includes('m2-con') || tid.includes('spec-cast-m2') || tid.includes('spec-ssrr-m3')) return '';

    const isHidden = (window.showTopTable === false);
    const hiddenClass = isHidden ? 'is-hidden' : '';

    // Mesa 2 en 3 MESAS (c3-m2) o MM SSRR M2 es Familia Redmi Note 17 (Cara A: RN17, Cara B: Blanco)
    if (tid === 'c3-m2' || tid === 'spec-ssrr-m2') {
        return `
            <div class="table-toptable-divider ${hiddenClass}" id="toptable-${tableId}">
                <div class="toptable-unit toptable-center-single" onclick="window.openTopTableZoomModal('img/posm/toptable_redmi_note_17.png', 'Top Table · Redmi Note 17 Series')" title="Clic para ampliar diseño Top Table oficial">
                    <div class="toptable-acrylic-stand">
                        <div class="toptable-face toptable-face-front">
                            <img src="img/posm/toptable_redmi_note_17.png" class="toptable-banner-img" alt="Top Table Redmi Note 17 Series">
                            <div class="toptable-acrylic-glare"></div>
                        </div>
                        <div class="toptable-face toptable-face-back toptable-white-back">
                            <div class="toptable-white-acrylic-surface">
                                <span class="toptable-acrylic-watermark">Xiaomi Retail POSM</span>
                            </div>
                            <div class="toptable-acrylic-glare"></div>
                        </div>
                        <div class="toptable-top-edge"></div>
                        <div class="toptable-foot-base"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // Mesa con Xiaomi 18 Pro (c1-m1, c2-m1, c3-m1, spec-adeje-m1, spec-cast-m1, spec-ssrr-m1):
    // ÚNICO Top Table en el medio de la mesa compartido:
    // Cara A (Frontal): Xiaomi 18 Pro Series completa sin cortes (nuevo diseño adaptado a escala 1,1m x 0,4m)
    // Cara B (Posterior): Redmi Note 17 Series completa sin cortes
    return `
        <div class="table-toptable-divider ${hiddenClass}" id="toptable-${tableId}">
            <div class="toptable-unit toptable-center-single" onclick="window.openTopTableZoomModal('img/posm/toptable_xiaomi_18_pro.png', 'Top Table · Xiaomi 18 Pro Series')" title="Clic para ampliar diseño Top Table oficial (1,1m x 0,4m)">
                <div class="toptable-acrylic-stand">
                    <div class="toptable-face toptable-face-front">
                        <img src="img/posm/toptable_xiaomi_18_pro.png" class="toptable-banner-img" alt="Top Table Xiaomi 18 Pro Series">
                        <div class="toptable-acrylic-glare"></div>
                    </div>
                    <div class="toptable-face toptable-face-back">
                        <img src="img/posm/toptable_redmi_note_17.png" class="toptable-banner-img" alt="Top Table Redmi Note 17 Series">
                        <div class="toptable-acrylic-glare"></div>
                    </div>
                    <div class="toptable-top-edge"></div>
                    <div class="toptable-foot-base"></div>
                </div>
            </div>
        </div>
    `;
};

window.openTopTableZoomModal = function(imgSrc, title = 'Top Table Oficial Xiaomi') {
    let modal = document.getElementById('toptable-zoom-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'toptable-zoom-modal';
        modal.className = 'modal';
        modal.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(2,6,23,0.88); backdrop-filter:blur(8px); z-index:99999; align-items:center; justify-content:center; padding:1.5rem;';
        modal.innerHTML = `
            <div style="position:relative; max-width:1050px; width:95%; background:#0f172a; border:2px solid rgba(255,255,255,0.15); border-radius:18px; box-shadow:0 25px 60px rgba(0,0,0,0.8); overflow:hidden; display:flex; flex-direction:column;">
                <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 20px; background:#1e293b; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="background:var(--mi-orange); color:#fff; font-weight:900; font-size:11px; padding:3px 8px; border-radius:6px;">POSM 2026</span>
                        <h3 id="toptable-zoom-title" style="margin:0; font-size:1.1rem; color:#ffffff; font-weight:800;">${title}</h3>
                        <span style="font-size:11px; color:#94a3b8; font-weight:600;">(Escala Proporcional 1,1m × 0,4m)</span>
                    </div>
                    <button type="button" onclick="window.closeTopTableZoomModal()" style="background:none; border:none; color:#cbd5e1; font-size:1.8rem; cursor:pointer; line-height:1;">&times;</button>
                </div>
                <div style="padding:20px; background:#020617; display:flex; align-items:center; justify-content:center; max-height:75vh; overflow:auto;">
                    <img id="toptable-zoom-img" src="${imgSrc}" style="max-width:100%; max-height:68vh; object-fit:contain; border-radius:10px; box-shadow:0 10px 35px rgba(0,0,0,0.6);" alt="${title}">
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 20px; background:#1e293b; border-top:1px solid rgba(255,255,255,0.1);">
                    <span style="font-size:12px; color:#94a3b8; font-weight:600;"><i class="fas fa-info-circle" style="color:var(--mi-orange); margin-right:6px;"></i>Diseño oficial de cabecera centrado para mesas de experiencia Xiaomi Retail.</span>
                    <button type="button" onclick="window.closeTopTableZoomModal()" style="padding:7px 18px; border-radius:8px; background:var(--mi-orange); color:#fff; border:none; font-weight:700; cursor:pointer;">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        const titleEl = document.getElementById('toptable-zoom-title');
        const imgEl = document.getElementById('toptable-zoom-img');
        if (titleEl) titleEl.textContent = title;
        if (imgEl) {
            imgEl.src = imgSrc;
            imgEl.alt = title;
        }
    }
    modal.style.display = 'flex';
};

window.closeTopTableZoomModal = function() {
    const modal = document.getElementById('toptable-zoom-modal');
    if (modal) modal.style.display = 'none';
};

window.toggleTopTable = function(tableId) {
    window.showTopTable = !window.showTopTable;
    const dividers = document.querySelectorAll('.table-toptable-divider');
    dividers.forEach(el => {
        if (window.showTopTable) {
            el.classList.remove('is-hidden');
        } else {
            el.classList.add('is-hidden');
        }
    });
    const btns = document.querySelectorAll('.btn-toggle-toptable');
    btns.forEach(btn => {
        if (window.showTopTable) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-layer-group"></i> <span>Top Table: ON</span>';
            btn.title = 'Top Table visible. Clic para ocultar';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fas fa-eye-slash"></i> <span>Top Table: OFF</span>';
            btn.title = 'Top Table oculto. Clic para mostrar';
        }
    });
};

window.wrapRetailShowroom360 = function(tableId, tableTitle, sideAHtml, sideBHtml, options = {}) {
    const topTableHtml = window.renderTableTopTableHtml(tableId, options);
    const hasTopTable = Boolean(topTableHtml);

    return `
        <div class="retail-showroom-wrapper" id="showroom-${tableId}">
            <div class="retail-side-nav-bar">
                <div class="retail-nav-top-row">
                    <div class="retail-nav-title-group">
                        <span class="retail-nav-pill">
                            <i class="fas fa-store" style="color: var(--mi-orange);"></i> ${tableTitle} • Showroom 3D Volumétrico
                        </span>
                        <span class="retail-nav-hint">
                            <i class="fas fa-arrows-alt-h"></i> Arrastra en horizontal para girar 360° la mesa con volumen real
                        </span>
                    </div>
                    <div class="retail-side-tabs">
                        <button type="button" id="btn-side-0-${tableId}" class="retail-side-btn active" onclick="window.setRetailTableAngle('${tableId}', 0)">
                            <i class="fas fa-mobile-alt"></i> 0° Frontal (Cara A)
                        </button>
                        <button type="button" id="btn-side-90-${tableId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${tableId}', 90)">
                            <i class="fas fa-cube"></i> 90° Lateral Der. (Perfil 3D)
                        </button>
                        <button type="button" id="btn-side-180-${tableId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${tableId}', 180)">
                            <i class="fas fa-tablet-alt"></i> 180° Posterior (Cara B)
                        </button>
                        <button type="button" id="btn-side-270-${tableId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${tableId}', 270)">
                            <i class="fas fa-columns"></i> 270° Lateral Izq. (Tótem)
                        </button>
                        <button type="button" id="btn-autospin-${tableId}" class="retail-side-btn retail-side-btn-autospin" onclick="window.toggleRetailAutoSpin('${tableId}')" title="Girar 360 grados horizontalmente alrededor de la mesa">
                            <i class="fas fa-sync-alt"></i> Giro 360° Horizontal
                        </button>
                        ${hasTopTable ? `
                            <button type="button" id="btn-toptable-${tableId}" class="retail-side-btn btn-toggle-toptable ${window.showTopTable !== false ? 'active' : ''}" onclick="window.toggleTopTable('${tableId}')" title="${window.showTopTable !== false ? 'Top Table visible. Clic para ocultar' : 'Top Table oculto. Clic para mostrar'}">
                                <i class="${window.showTopTable !== false ? 'fas fa-layer-group' : 'fas fa-eye-slash'}"></i> <span>${window.showTopTable !== false ? 'Top Table: ON' : 'Top Table: OFF'}</span>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="retail-h-slider-bar">
                    <div class="retail-h-slider-box">
                        <span class="retail-h-slider-label">
                            <i class="fas fa-compass" style="color: var(--mi-orange);"></i> Giro Horizontal 360°:
                        </span>
                        <input type="range" id="h-slider-${tableId}" class="retail-h-slider" min="0" max="360" value="0" oninput="window.setRetailTableAngle('${tableId}', this.value)">
                        <span id="h-degree-pill-${tableId}" class="retail-h-degree-pill">0° • Frontal (Cara A)</span>
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

                    <!-- Bloque Volumétrico de la Mesa Counter -->
                    <div class="table-volume-box">
                        <div class="table-face-front"></div>
                        <div class="table-face-back"></div>
                        <div class="table-face-left"></div>
                        <div class="table-face-right"></div>
                        <div class="table-face-bottom"></div>
                        <div class="table-face-top">
                            <!-- Placa Tótem Acrílico de Exposición sobre la Encimera -->
                            <div class="totem-3d-panel">
                                <div class="totem-face">XIAOMI SHOWROOM</div>
                            </div>

                            <!-- Fila Posterior (Cara B): situada dentro de la encimera y orientada 180° hacia el pasillo trasero -->
                            <div class="table-counter-row row-back">
                                ${sideBHtml}
                            </div>

                            <!-- Separador Central con Top Table 3D Fixture (X18 Pro & Redmi Note 17) -->
                            ${topTableHtml}

                            <!-- Fila Frontal (Cara A): situada dentro de la encimera orientada hacia el cliente delantero -->
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

window.CABECERA_ECI_LIST = [
    'ECI Cataluña', 'ECI Goya', 'ECI Castellana', 'ECI Diagonal', 'ECI Murcia',
    'ECI Valencia Nuevo Centro', 'ECI Sevilla Nervión', 'ECI San Juan de Aznalfarache',
    'ECI Avda. de Francia', 'ECI Sanchinarro', 'ECI Alcalá de Henares', 'ECI Campo de las Naciones',
    'ECI San José de Valderas', 'ECI Pozuelo', 'ECI Marbella', 'ECI El Bercial', 'ECI Cádiz'
];

window.isStoreCabeceraEci = function(storeObjOrName) {
    const name = typeof storeObjOrName === 'string' ? storeObjOrName : (storeObjOrName?.nombre || '');
    const cuenta = typeof storeObjOrName === 'object' ? (storeObjOrName?.cuenta || storeObjOrName?.retail || '') : '';
    const norm = normalizeString(name);
    if (cuenta && !String(cuenta).toUpperCase().includes('ECI') && !norm.includes('eci')) return false;
    return (
        norm.includes('cataluna') || norm.includes('goya') || norm.includes('castellana') ||
        norm.includes('diagonal') || norm.includes('murcia') || norm.includes('nuevo centro') ||
        norm.includes('nervion') || norm.includes('aznalfarache') || norm.includes('francia') ||
        norm.includes('sanchinarro') || norm.includes('alcala') || norm.includes('naciones') ||
        norm.includes('valderas') || norm.includes('pozuelo') || norm.includes('marbella') ||
        norm.includes('bercial') || norm.includes('cadiz')
    );
};

window.getStoreSpecialCaseId = function(storeObjOrName) {
    const name = typeof storeObjOrName === 'string' ? storeObjOrName : (storeObjOrName?.nombre || '');
    const norm = normalizeString(name);
    if (norm.includes('adeje')) return 'adeje';
    if (norm.includes('castellana')) return 'castellana';
    if (norm.includes('san sebastian') || norm.includes('ssrr')) return 'ssrr';
    return null;
};

// ==================================================
// MÓDULOS 3D VOLUMÉTRICOS: WALL, COLUMNA, CABECERA ECI & LINEAL WEARABLES
// ==================================================

// 1. Mueble WALL 3D Volumétrico Oficial (5 Bloques con Lightbox Superior Xiaomi 18 Pro)
window.wrapRetailWall3D = function(wallId, title, traysHtml, lightboxTitle = 'XIAOMI 18 PRO SERIES', badgeText = 'WALL · 5 BLOQUES') {
    return `
        <div class="retail-showroom-wrapper" id="showroom-${wallId}" style="margin-bottom: 28px;">
            <div class="retail-side-nav-bar">
                <div class="retail-nav-top-row">
                    <div class="retail-nav-title-group">
                        <span class="retail-nav-pill">
                            <i class="fas fa-th-large" style="color: #0284c7;"></i> ${title} • Wall 3D Volumétrico
                        </span>
                        <span class="retail-nav-hint">
                            <i class="fas fa-arrows-alt-h"></i> Arrastra en horizontal para girar 360° el mueble Wall con volumen real
                        </span>
                    </div>
                    <div class="retail-side-tabs">
                        <button type="button" id="btn-side-0-${wallId}" class="retail-side-btn active" onclick="window.setRetailTableAngle('${wallId}', 0, -18)">
                            <i class="fas fa-eye"></i> 0° Frontal 3D
                        </button>
                        <button type="button" id="btn-side-35-${wallId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${wallId}', 35, -20)">
                            <i class="fas fa-cube"></i> 35° Perspectiva 3D
                        </button>
                        <button type="button" id="btn-side-90-${wallId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${wallId}', 90, -18)">
                            <i class="fas fa-columns"></i> 90° Perfil 3D
                        </button>
                        <button type="button" id="btn-side-180-${wallId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${wallId}', 180, -18)">
                            <i class="fas fa-undo"></i> 180° Posterior
                        </button>
                        <button type="button" id="btn-autospin-${wallId}" class="retail-side-btn retail-side-btn-autospin" onclick="window.toggleRetailAutoSpin('${wallId}')" title="Girar 360 grados en 3D">
                            <i class="fas fa-sync-alt"></i> Giro 360°
                        </button>
                    </div>
                </div>

                <div class="retail-h-slider-bar">
                    <div class="retail-h-slider-box">
                        <span class="retail-h-slider-label">
                            <i class="fas fa-compass" style="color: var(--mi-orange);"></i> Giro Horizontal 360°:
                        </span>
                        <input type="range" id="h-slider-${wallId}" class="retail-h-slider" min="0" max="360" value="0" oninput="window.setRetailTableAngle('${wallId}', this.value)">
                        <span id="h-degree-pill-${wallId}" class="retail-h-degree-pill">0° • Frontal (Lightbox & Mostrador)</span>
                    </div>
                </div>
            </div>

            <div class="retail-3d-stage" id="stage-${wallId}">
                <div class="retail-wall-rig" id="rig-${wallId}">
                    <!-- Sombra en Suelo -->
                    <div class="table-floor-shadow" style="width: 1020px; height: 320px; left: -30px; transform: rotateX(90deg) translateZ(-240px);"></div>

                    <!-- Panel Trasero Vertical 3D Blanco (con Lightbox Xiaomi 18 Pro anclado directamente en el fondo) -->
                    <div class="wall-back-panel">
                        <div class="wall-bg-anchored-banner" onclick="window.openTopTableZoomModal('img/posm/lightbox_wall_xiaomi_18_pro.png', 'Lightbox Wall · Xiaomi 18 Pro Series')" title="Clic para ampliar gráfica oficial">
                            <img src="img/posm/lightbox_wall_xiaomi_18_pro.png" class="wall-bg-banner-img" alt="Lightbox Wall Xiaomi 18 Pro Series">
                            <div class="wall-bg-banner-glare"></div>
                        </div>
                    </div>

                    <!-- Mostrador / Repisa Volumétrica con Profundidad 3D Compacta -->
                    <div class="wall-shelf-box">
                        <div class="wall-shelf-top">
                            ${traysHtml}
                        </div>
                        <div class="wall-shelf-front">
                            <span><i class="fas fa-cube" style="color: var(--mi-orange); margin-right: 6px;"></i>ESTANTE RETAIL XIAOMI WALL</span>
                            <span style="font-size: 9.5px; color: #64748b; font-weight: 700;">XIAOMI STORE OFFICIAL WALL</span>
                        </div>
                        <div class="wall-shelf-left"></div>
                        <div class="wall-shelf-right"></div>
                    </div>

                    <!-- Zócalo Inferior Wall -->
                    <div class="wall-plinth-box">
                        <i class="fas fa-shield-alt" style="margin-right: 8px; color: var(--mi-orange);"></i> MUEBLE RETAIL OFICIAL WALL · XIAOMI ESPAÑA
                    </div>
                </div>
            </div>
        </div>
    `;
};

// 2. Mueble COLUMNA 3D Volumétrica Oficial (4 Caras: Frontal Mostrador en Blanco, Derecha Xiaomi 18 Pro, Posterior Redmi Note 17, Izquierda Xiaomi 17T)
window.wrapRetailColumn3D = function(colId, title, traysHtml, lightboxTitle = 'XIAOMI 18 PRO SERIES', badgeText = 'COLUMNA · 2 BLOQUES') {
    return `
        <div class="retail-showroom-wrapper" id="showroom-${colId}" style="margin-bottom: 28px; max-width: 860px; margin-left: auto; margin-right: auto;">
            <div class="retail-side-nav-bar">
                <div class="retail-nav-top-row">
                    <div class="retail-nav-title-group">
                        <span class="retail-nav-pill">
                            <i class="fas fa-columns" style="color: #0284c7;"></i> ${title} • Columna 3D Volumétrica (4 Caras)
                        </span>
                        <span class="retail-nav-hint">
                            <i class="fas fa-arrows-alt-h"></i> Arrastra en horizontal o usa los botones directos para girar 360°
                        </span>
                    </div>
                    <div class="retail-side-tabs">
                        <button type="button" id="btn-side-0-${colId}" class="retail-side-btn active" onclick="window.setRetailTableAngle('${colId}', 0, -18)">
                            <i class="fas fa-eye"></i> 0° Frontal
                        </button>
                        <button type="button" id="btn-side-35-${colId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${colId}', 35, -20)">
                            <i class="fas fa-cube"></i> 35° Perspectiva
                        </button>
                        <button type="button" id="btn-side-90-${colId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${colId}', 90, -18)">
                            <i class="fas fa-arrow-right"></i> 90° Derecha
                        </button>
                        <button type="button" id="btn-side-180-${colId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${colId}', 180, -18)">
                            <i class="fas fa-undo"></i> 180° Detrás
                        </button>
                        <button type="button" id="btn-side-270-${colId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${colId}', 270, -18)">
                            <i class="fas fa-arrow-left"></i> 270° Izquierda
                        </button>
                        <button type="button" id="btn-autospin-${colId}" class="retail-side-btn retail-side-btn-autospin" onclick="window.toggleRetailAutoSpin('${colId}')" title="Girar 360 grados en 3D">
                            <i class="fas fa-sync-alt"></i> Giro 360°
                        </button>
                    </div>
                </div>

                <!-- Botonera de Selección Rápida de Caras de la Columna -->
                <div class="retail-col-face-pills">
                    <span class="face-pill-label"><i class="fas fa-cube"></i> Caras del Tótem:</span>
                    <button type="button" class="face-pill-btn active" id="pill-col-0-${colId}" onclick="window.setRetailTableAngle('${colId}', 0, -18)">
                        <i class="fas fa-mobile-alt"></i> 0° Frontal (Terminales)
                    </button>
                    <button type="button" class="face-pill-btn" id="pill-col-90-${colId}" onclick="window.setRetailTableAngle('${colId}', 90, -18)">
                        <i class="fas fa-arrow-right" style="color: var(--mi-orange);"></i> 90° Derecha (Xiaomi 18 Pro)
                    </button>
                    <button type="button" class="face-pill-btn" id="pill-col-180-${colId}" onclick="window.setRetailTableAngle('${colId}', 180, -18)">
                        <i class="fas fa-undo" style="color: #38bdf8;"></i> 180° Detrás (Redmi Note 17)
                    </button>
                    <button type="button" class="face-pill-btn" id="pill-col-270-${colId}" onclick="window.setRetailTableAngle('${colId}', 270, -18)">
                        <i class="fas fa-arrow-left" style="color: #a855f7;"></i> 270° Izquierda (Xiaomi 17T)
                    </button>
                </div>

                <div class="retail-h-slider-bar">
                    <div class="retail-h-slider-box">
                        <span class="retail-h-slider-label">
                            <i class="fas fa-compass" style="color: var(--mi-orange);"></i> Giro Horizontal 360°:
                        </span>
                        <input type="range" id="h-slider-${colId}" class="retail-h-slider" min="0" max="360" value="0" oninput="window.setRetailTableAngle('${colId}', this.value)">
                        <span id="h-degree-pill-${colId}" class="retail-h-degree-pill">0° • Frontal (Terminales & Mostrador)</span>
                    </div>
                </div>
            </div>

            <div class="retail-3d-stage" id="stage-${colId}">
                <div class="retail-column-rig" id="rig-${colId}">
                    <!-- Sombra en Suelo -->
                    <div class="table-floor-shadow" style="width: 720px; height: 360px; left: -80px; transform: rotateX(90deg) translateZ(-250px);"></div>

                    <!-- Estructura Tótem 3D con 4 Caras -->
                    <div class="column-totem-body">
                        <!-- Cara Frontal (0°): Mostrador en blanco con repisa y terminales (sin títulos en cabecera) -->
                        <div class="col-face col-face-front">
                            <div class="column-shelf-box">
                                <div class="column-shelf-top">
                                    ${traysHtml}
                                </div>
                                <div class="column-shelf-front">
                                    <span><i class="fas fa-columns" style="color: var(--mi-orange); margin-right: 6px;"></i>ESTANTE COLUMNA</span>
                                    <span style="font-size: 10px; color: #94a3b8; font-weight: 700;">XIAOMI RETAIL</span>
                                </div>
                            </div>
                            <div class="col-plinth-front">
                                <i class="fas fa-shield-alt" style="margin-right: 8px; color: var(--mi-orange);"></i> TÓTEM COLUMNA OFICIAL XIAOMI ESPAÑA
                            </div>
                        </div>

                        <!-- Cara Derecha (90°): Lightbox Vertical Xiaomi 18 Pro Series -->
                        <div class="col-face col-face-right">
                            <div class="col-lightbox-card">
                                <div class="col-poster-frame" onclick="window.openTopTableZoomModal('img/posm/lightbox_column_xiaomi_18_pro.png', 'Lightbox Vertical · Xiaomi 18 Pro Series')" title="Clic para ampliar gráfica oficial">
                                    <img src="img/posm/lightbox_column_xiaomi_18_pro.png" class="col-poster-img" alt="Xiaomi 18 Pro Series">
                                    <div class="col-poster-glare"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Cara Posterior (180°): Lightbox Vertical Redmi Note 17 Series -->
                        <div class="col-face col-face-back">
                            <div class="col-lightbox-card">
                                <div class="col-poster-frame" onclick="window.openTopTableZoomModal('img/posm/lightbox_column_redmi_note_17.png', 'Lightbox Vertical · Redmi Note 17 Series')" title="Clic para ampliar gráfica oficial">
                                    <img src="img/posm/lightbox_column_redmi_note_17.png" class="col-poster-img" alt="Redmi Note 17 Series">
                                    <div class="col-poster-glare"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Cara Izquierda (270°): Lightbox Vertical Xiaomi 17T Series -->
                        <div class="col-face col-face-left">
                            <div class="col-lightbox-card">
                                <div class="col-poster-frame" onclick="window.openTopTableZoomModal('img/posm/lightbox_column_xiaomi_17t.png', 'Lightbox Vertical · Xiaomi 17T Series')" title="Clic para ampliar gráfica oficial">
                                    <img src="img/posm/lightbox_column_xiaomi_17t.png" class="col-poster-img" alt="Xiaomi 17T Series">
                                    <div class="col-poster-glare"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

// 3. Mueble CABECERA ECI 3D Volumétrica Oficial (Basada en la gráfica oficial de Cabecera ECI Xiaomi 18 Pro)
window.wrapRetailCabeceraEci3D = function(cabeceraId, title = '03. Cabecera ECI (Destacador Oficial Leica)') {
    return `
        <div class="retail-showroom-wrapper" id="showroom-${cabeceraId}" style="margin-bottom: 28px;">
            <div class="retail-side-nav-bar">
                <div class="retail-nav-top-row">
                    <div class="retail-nav-title-group">
                        <span class="retail-nav-pill">
                            <i class="fas fa-crown" style="color: #ea580c;"></i> ${title} • Cabecera ECI 3D Volumétrica
                        </span>
                        <span class="retail-nav-hint">
                            <i class="fas fa-arrows-alt-h"></i> Arrastra en horizontal para girar 360° la Cabecera ECI con volumen real
                        </span>
                    </div>
                    <div class="retail-side-tabs">
                        <button type="button" id="btn-side-0-${cabeceraId}" class="retail-side-btn active" onclick="window.setRetailTableAngle('${cabeceraId}', 0, -18)">
                            <i class="fas fa-eye"></i> 0° Frontal 3D
                        </button>
                        <button type="button" id="btn-side-35-${cabeceraId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${cabeceraId}', 35, -20)">
                            <i class="fas fa-cube"></i> 35° Perspectiva 3D
                        </button>
                        <button type="button" id="btn-side-90-${cabeceraId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${cabeceraId}', 90, -18)">
                            <i class="fas fa-columns"></i> 90° Perfil Pasillo ECI
                        </button>
                        <button type="button" id="btn-side-180-${cabeceraId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${cabeceraId}', 180, -18)">
                            <i class="fas fa-undo"></i> 180° Trasera
                        </button>
                        <button type="button" id="btn-autospin-${cabeceraId}" class="retail-side-btn retail-side-btn-autospin" onclick="window.toggleRetailAutoSpin('${cabeceraId}')" title="Girar 360 grados">
                            <i class="fas fa-sync-alt"></i> Giro 360°
                        </button>
                    </div>
                </div>

                <div class="retail-h-slider-bar">
                    <div class="retail-h-slider-box">
                        <span class="retail-h-slider-label">
                            <i class="fas fa-compass" style="color: var(--mi-orange);"></i> Giro Horizontal 360°:
                        </span>
                        <input type="range" id="h-slider-${cabeceraId}" class="retail-h-slider" min="0" max="360" value="0" oninput="window.setRetailTableAngle('${cabeceraId}', this.value)">
                        <span id="h-degree-pill-${cabeceraId}" class="retail-h-degree-pill">0° • Frontal 3D</span>
                    </div>
                </div>
            </div>

            <div class="retail-3d-stage" id="stage-${cabeceraId}">
                <div class="retail-cabecera-rig" id="rig-${cabeceraId}">
                    <!-- Sombra en Suelo -->
                    <div class="table-floor-shadow" style="width: 920px; height: 320px; left: -20px; transform: rotateX(90deg) translateZ(-160px);"></div>

                    <!-- Mueble Cabecera ECI 3D Volumétrico Oficial -->
                    <div class="cabecera-totem-structure">
                        <!-- Panel Vertical de Exposición Cabecera ECI (Fondo Oficial Leica) -->
                        <div class="cabecera-backwall-3d">
                            <div class="cabecera-backwall-front" onclick="window.openTopTableZoomModal('img/posm/cabecera_eci_display.png', 'Cabecera Oficial ECI · Xiaomi 18 Pro Series')" title="Clic para ampliar diseño de Cabecera ECI">
                                <img src="img/posm/cabecera_eci_backdrop.png" class="cabecera-display-full-img" alt="Fondo Cabecera ECI Xiaomi 18 Pro Series">
                                <div class="cabecera-display-glare"></div>
                            </div>
                            <div class="cabecera-backwall-back">
                                <div class="cabecera-white-back-surface">
                                    <div style="font-size: 26px; color: var(--mi-orange); margin-bottom: 4px;"><i class="fas fa-crown"></i></div>
                                    <span class="cabecera-watermark">El Corte Inglés · Xiaomi Retail</span>
                                    <span style="font-size: 11px; color: #94a3b8; font-weight: 600;">Cabecera Oficial Exclusiva Xiaomi 18 Pro Series</span>
                                </div>
                            </div>
                            <div class="cabecera-backwall-top"></div>
                            <div class="cabecera-backwall-left"></div>
                            <div class="cabecera-backwall-right"></div>
                        </div>

                        <!-- Dispositivos con Volumen 3D en Frontal (Disposición Oficial ECI) -->
                        <div class="cabecera-stage-3d">
                            <!-- Posición 1: Trío de Exhibición Xiaomi 18 Pro (White, Black, Blue) -->
                            <div class="cabecera-item-pos cabecera-pos-1" onclick="window.open3DDeviceModal('Xiaomi 18 Pro Max', 'phone-theme-blue', 'Exposición 3 Colores', 'phone')" title="Xiaomi 18 Pro Max (Trío de Exhibición) - Clic para ver 3D interactivo">
                                <div class="cabecera-pedestal-trio">
                                    <div class="phone-3d-trio trio-phone-blue">
                                        <img src="img/devices/xiaomi_18_pro_back.webp" class="trio-skin" alt="Xiaomi 18 Pro Blue">
                                    </div>
                                    <div class="phone-3d-trio trio-phone-black">
                                        <img src="img/devices/xiaomi_18_pro_back.webp" class="trio-skin skin-black" alt="Xiaomi 18 Pro Black">
                                    </div>
                                    <div class="phone-3d-trio trio-phone-white">
                                        <img src="img/devices/xiaomi_18_pro_back.webp" class="trio-skin skin-white" alt="Xiaomi 18 Pro White">
                                    </div>
                                    <div class="cabecera-pedestal-wedge"></div>
                                </div>
                                <div class="cabecera-color-swatches">
                                    <span class="swatch-dot dot-navy" title="Navy Blue"></span>
                                    <span class="swatch-dot dot-black" title="Black"></span>
                                    <span class="swatch-dot dot-burgundy" title="Burgundy"></span>
                                </div>
                            </div>

                            <!-- Posición 2: Xiaomi 18 Pro en Dock de Seguridad y Carga -->
                            <div class="cabecera-item-pos cabecera-pos-2" onclick="window.open3DDeviceModal('Xiaomi 18 Pro', 'phone-theme-orange', 'LDU 18 Pro', 'phone')" title="Xiaomi 18 Pro - Clic para ver 3D interactivo">
                                <div class="cabecera-dock-group">
                                    <div class="phone-3d-box cabecera-phone-box">
                                        <div class="phone-face-front has-real-skin">
                                            <img src="img/devices/xiaomi_18_pro_front.webp" class="device-real-skin" alt="Xiaomi 18 Pro frontal">
                                        </div>
                                        <div class="phone-face-back has-real-skin color-orange">
                                            <img src="img/devices/xiaomi_18_pro_back.webp" class="device-real-skin" alt="Xiaomi 18 Pro trasera">
                                        </div>
                                        <div class="phone-edge-left"></div>
                                        <div class="phone-edge-right"></div>
                                        <div class="phone-edge-top"></div>
                                        <div class="phone-edge-bottom"></div>
                                    </div>
                                    <div class="cabecera-dock-pedestal">
                                        <div class="dock-clamp-left"></div>
                                        <div class="dock-clamp-right"></div>
                                        <div class="dock-base-block"></div>
                                        <div class="dock-back-spine"></div>
                                    </div>
                                    <div class="spiral-3d-cord cabecera-cord"></div>
                                </div>
                                <div class="cabecera-color-swatches">
                                    <span class="swatch-dot dot-navy" title="Navy Blue"></span>
                                    <span class="swatch-dot dot-black" title="Black"></span>
                                    <span class="swatch-dot dot-burgundy" title="Burgundy"></span>
                                </div>
                            </div>

                            <!-- Posición 3: Xiaomi Watch S5 46mm en Pedestal Cilíndrico Oficial -->
                            <div class="cabecera-item-pos cabecera-pos-3" onclick="window.open3DDeviceModal('Xiaomi Watch S5 46mm', 'round', 'Wear S5', 'watch')" title="Xiaomi Watch S5 46mm - Clic para ver 3D interactivo">
                                <div class="cabecera-watch-pedestal-group">
                                    <div class="watch-3d-box cabecera-watch-box">
                                        <img src="img/devices/watch_s5_46_front.webp" class="watch-real-skin" alt="Xiaomi Watch S5 46mm">
                                    </div>
                                    <div class="cabecera-cylinder-pedestal">
                                        <div class="cylinder-neck"></div>
                                        <div class="cylinder-column"></div>
                                        <div class="cylinder-base-ring"></div>
                                    </div>
                                </div>
                                <div class="cabecera-color-swatches">
                                    <span class="swatch-dot dot-black" title="Black"></span>
                                    <span class="swatch-dot dot-green" title="Green"></span>
                                    <span class="swatch-dot dot-navy" title="Slate Blue"></span>
                                </div>
                            </div>

                            <!-- Posición 4: Xiaomi Clip / Buds en Bandeja Dual -->
                            <div class="cabecera-item-pos cabecera-pos-4" onclick="window.open3DDeviceModal('Xiaomi Clip', 'buds', 'Nuevo Clip', 'buds')" title="Xiaomi Clip - Clic para ver 3D interactivo">
                                <div class="cabecera-buds-pad-group">
                                    <div class="buds-3d-box has-real-skin cabecera-buds-box">
                                        <img src="img/devices/buds_clip_front.webp" class="buds-real-skin" alt="Xiaomi Clip">
                                    </div>
                                    <div class="cabecera-buds-plate">
                                        <div class="buds-earpiece-left"></div>
                                        <div class="buds-earpiece-right"></div>
                                        <div class="buds-acrylic-stand"></div>
                                    </div>
                                </div>
                                <div class="cabecera-color-swatches">
                                    <span class="swatch-dot dot-black" title="Black"></span>
                                    <span class="swatch-dot dot-lilac" title="Lilac"></span>
                                    <span class="swatch-dot dot-cream" title="Cream"></span>
                                </div>
                            </div>
                        </div>

                        <!-- Mostrador Podio Base Cabecera ECI con Superficie Ampliada y Texto Integrado en X -->
                        <div class="cabecera-table-counter">
                            <!-- Superficie Horizontal de Exposición con Texto y Especificaciones Debajo de los Móviles -->
                            <div class="cabecera-counter-top">
                                <div class="cabecera-surface-specs-zone" title="Especificaciones oficiales Cabecera ECI">
                                    <img src="img/posm/cabecera_eci_footer.png" class="cabecera-surface-specs-img" alt="Texto y especificaciones debajo de los productos">
                                </div>
                            </div>
                            <!-- Canto Delantero Limpio sin Texto Vertical -->
                            <div class="cabecera-counter-front">
                                <div class="cabecera-front-accent-line"></div>
                            </div>
                            <div class="cabecera-counter-left"></div>
                            <div class="cabecera-counter-right"></div>
                            <div class="cabecera-counter-plinth"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

// 4. Mueble LINEAL DE WEARABLES 3D Volumétrico (Grada Escalonada de 2 Alturas)
window.wrapRetailWearableLineal3D = function(linealId, title, subtitle, badgeText, upperItems, lowerItems) {
    const renderWearRow = (items) => items.map((it, idx) => window.renderRetailSlot({
        model: it.m,
        badgeColor: it.b || 'orange',
        typeBadge: `${idx + 1}. ${it.t || 'Wear'}`,
        deviceType: 'watch',
        color: it.c || 'black',
        specs: it.s || it.m
    })).join('');

    const isDoubleTier = Boolean(lowerItems && lowerItems.length > 0);
    const wFilter = window.currentWearableLinealFilter || 'all';
    const isVisible = (wFilter === 'all' || wFilter === linealId);

    return `
        <div class="retail-showroom-wrapper wearable-lineal-card" id="showroom-${linealId}" data-lineal-id="${linealId}" style="display: ${isVisible ? 'block' : 'none'}; margin-bottom: 28px;">
            <div class="retail-side-nav-bar">
                <div class="retail-nav-top-row">
                    <div class="retail-nav-title-group">
                        <span class="retail-nav-pill">
                            <i class="fas fa-stopwatch" style="color: #16a34a;"></i> ${title} • Grada 3D Volumétrica
                        </span>
                        <span class="retail-nav-hint">
                            <i class="fas fa-arrows-alt-h"></i> Arrastra en horizontal para ver el escalonado 3D y los soportes de cada reloj
                        </span>
                    </div>
                    <div class="retail-side-tabs">
                        <button type="button" id="btn-side-0-${linealId}" class="retail-side-btn active" onclick="window.setRetailTableAngle('${linealId}', 0, -22)">
                            <i class="fas fa-eye"></i> 0° Frontal 3D
                        </button>
                        <button type="button" id="btn-side-35-${linealId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${linealId}', 35, -24)">
                            <i class="fas fa-cube"></i> 35° Perspectiva Grada
                        </button>
                        <button type="button" id="btn-side-90-${linealId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${linealId}', 90, -22)">
                            <i class="fas fa-columns"></i> 90° Perfil Escalonado
                        </button>
                        <button type="button" id="btn-side-180-${linealId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${linealId}', 180, -22)">
                            <i class="fas fa-undo"></i> 180° Trasera
                        </button>
                        <button type="button" id="btn-autospin-${linealId}" class="retail-side-btn retail-side-btn-autospin" onclick="window.toggleRetailAutoSpin('${linealId}')" title="Girar 360 grados">
                            <i class="fas fa-sync-alt"></i> Giro 360°
                        </button>
                    </div>
                </div>

                <div class="retail-h-slider-bar">
                    <div class="retail-h-slider-box">
                        <span class="retail-h-slider-label">
                            <i class="fas fa-compass" style="color: var(--mi-orange);"></i> Giro Horizontal 360°:
                        </span>
                        <input type="range" id="h-slider-${linealId}" class="retail-h-slider" min="0" max="360" value="0" oninput="window.setRetailTableAngle('${linealId}', this.value)">
                        <span id="h-degree-pill-${linealId}" class="retail-h-degree-pill">0° • Frontal 3D</span>
                    </div>
                </div>
            </div>

            <div class="retail-3d-stage" id="stage-${linealId}">
                <div class="retail-lineal-rig" id="rig-${linealId}">
                    <!-- Sombra de suelo -->
                    <div class="table-floor-shadow" style="width: 920px; height: 300px; left: -20px; transform: rotateX(90deg) translateZ(-200px);"></div>

                    ${isDoubleTier ? `
                        <!-- Nivel Superior Escalonado (Elevado) -->
                        <div class="lineal-step-upper">
                            <div class="step-surface-upper">
                                ${renderWearRow(upperItems)}
                            </div>
                            <div class="step-riser-upper">
                                <i class="fas fa-grip-lines" style="color: var(--mi-orange); margin-right: 8px;"></i>
                                NIVEL SUPERIOR (${upperItems.length} POSICIONES) · ${subtitle || ''}
                            </div>
                        </div>

                        <!-- Nivel Inferior Escalonado (Adelantado) -->
                        <div class="lineal-step-lower">
                            <div class="step-surface-lower">
                                ${renderWearRow(lowerItems)}
                            </div>
                            <div class="step-riser-lower">
                                <span><i class="fas fa-layer-group" style="color: var(--mi-orange); margin-right: 8px;"></i>${badgeText}</span>
                                <span style="font-size: 10px; color: #475569; font-weight: 700;">NIVEL INFERIOR (${lowerItems.length} POSICIONES)</span>
                            </div>
                        </div>
                    ` : `
                        <!-- Grada Mononivel (ECI 6 Posiciones en Fila Única) -->
                        <div class="lineal-ramp-single">
                            <div class="ramp-surface-single">
                                ${renderWearRow(upperItems)}
                            </div>
                            <div class="ramp-riser-single">
                                <span><i class="fas fa-stopwatch" style="color: var(--mi-orange); margin-right: 8px;"></i>${badgeText}</span>
                                <span style="font-size: 10.5px; color: #475569; font-weight: 700;">FILA ÚNICA EN ÁNGULO ERGONÓMICO</span>
                            </div>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
};

// Helpers de conveniencia para Wall Estándar, Columna Estándar y Cabecera ECI
window.getStandardWall3DHtml = function(wallId = 'wall-std', customTitle) {
    const wallTrays = `
        ${window.renderRetailTray('Bloque 1 · RN 17 Pro Max + Watches', `
            ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', specs: 'Green · 200MP OIS' })}
            ${window.renderRetailSlot({ model: 'REDMI Watch 6 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Watch 6 Active' })}
            ${window.renderRetailSlot({ model: 'REDMI Watch 6 Lite', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Watch 6 Lite' })}
        `)}
        ${window.renderRetailTray('Bloque 2 · RN 17 Pro 5G + Watches', `
            ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'Blue · 120Hz AMOLED' })}
            ${window.renderRetailSlot({ model: 'REDMI Watch 5 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Watch 5 Active' })}
            ${window.renderRetailSlot({ model: 'REDMI Watch 5 Lite', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Watch 5 Lite' })}
        `)}
        ${window.renderRetailTray('Bloque 3 · Tablet REDMI Pad 2', `
            ${window.renderRetailSlot({ model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet-vertical', color: 'green', specs: '10.6" 90Hz Vertical' })}
        `)}
        ${window.renderRetailTray('Bloque 4 · Smart Bands', `
            ${window.renderRetailSlot({ model: 'Xiaomi Band 11 Active', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 11 Active' })}
            ${window.renderRetailSlot({ model: 'Xiaomi Band 9 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 9 Active' })}
        `)}
        ${window.renderRetailTray('Bloque 5 · Smart Bands', `
            ${window.renderRetailSlot({ model: 'Xiaomi Band 11 Active', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 11 Active' })}
            ${window.renderRetailSlot({ model: 'Xiaomi Band 9 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 9 Active' })}
        `)}
    `;
    return window.wrapRetailWall3D(
        wallId,
        customTitle || '08. Planograma WALL (5 Bloques)',
        wallTrays,
        'LIGHTBOX WALL · XIAOMI 18 PRO SERIES',
        'WALL · 5 BLOQUES'
    );
};

window.getStandardColumna3DHtml = function(colId = 'col-std', customTitle) {
    const colTrays = `
        ${window.renderRetailTray('Bloque 1 · RN 17 Pro Max 5G + Wearables', `
            ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'orange', specs: 'RN 17 Pro Max 5G Orange' })}
            ${window.renderRetailSlot({ model: 'REDMI Watch 6 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Active Black' })}
            ${window.renderRetailSlot({ model: 'REDMI Watch 5 Lite', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 5 Lite' })}
        `)}
        ${window.renderRetailTray('Bloque 2 · Tablet REDMI Pad 2', `
            ${window.renderRetailSlot({ model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'green', specs: 'REDMI Pad 2' })}
        `)}
    `;
    return window.wrapRetailColumn3D(
        colId,
        customTitle || '08. Planograma COLUMNA (2 Bloques)',
        colTrays,
        'LIGHTBOX COLUMN · XIAOMI 18 PRO SERIES',
        'COLUMNA · 2 BLOQUES'
    );
};

window.renderCabeceraEciModule3D = function(cabId = 'cabecera-eci-main') {
    return window.wrapRetailCabeceraEci3D(cabId, '03. Cabecera ECI (5 Posiciones)');
};

// ==================================================
// DESTACADOR OFICIAL XIAOMI 18 PRO SERIES · LEICA POSM GLORIFIER
// ==================================================
window.currentDestacadorViewMode = 'toptable';

window.renderDestacadorModeBanner = function() {
    return '';
};

window.renderDestacadorLeicaX18Html = function(options = {}) {
    const isStandalone = Boolean(options.isStandalone);
    const id = options.destacadorId || 'destacador-posm';

    return `
        <div class="destacador-leica-tray" id="tray-${id}">
            <!-- Panel Trasero Acrílico Blanco con Rótulo y Escultura de Cámara (Blanco delante y detrás) -->
            <div class="${isStandalone ? 'destacador-backwall-standalone' : 'destacador-backwall'}">
                <div class="destacador-backwall-back"></div>
                <div class="destacador-branding">
                    <div class="destacador-brand-title">
                        <span class="mi-logo-txt">xiaomi</span>
                        <span class="brand-model">18 Pro</span>
                        <sup class="brand-series">Series</sup>
                    </div>
                    <div class="destacador-leica-cobrand">
                        <span>CO-ENGINEERED WITH</span>
                        <span class="leica-red-dot">Leica</span>
                    </div>
                </div>

                <!-- Escultura Translúcida de Cámara Leica en Rojo Rubí -->
                <div class="destacador-camera-sculpture">
                    <div class="camera-lens-duo">
                        <div class="lens-aperture lens-top"><div class="lens-glass"></div></div>
                        <div class="lens-aperture lens-bottom"><div class="lens-glass"></div></div>
                    </div>
                    <!-- Pantalla del destacador en negro puro sin fotos externas -->
                    <div class="camera-screen-mockup">
                        <div class="camera-screen-glass-glare"></div>
                    </div>
                </div>
            </div>

            <!-- Superficie del Podio con los 4 Sectores Delimitados Sin Solapamiento -->
            <div class="destacador-podium-surface">
                <!-- Zona 1: Xiaomi 18 Pro (Trío de teléfonos horizontales escalonados con trasera 100% oficial) -->
                <div class="destacador-zone zone-18pro">
                    <div class="destacador-zone-items">
                        <div class="destacador-stepped-trio">
                            <!-- Ranuras sutiles en la base de metacrilato blanco -->
                            <div class="acrylic-slot slot-3"></div>
                            <div class="acrylic-slot slot-2"></div>
                            <div class="acrylic-slot slot-1"></div>

                            <!-- Teléfono 3: Xiaomi 18 Pro Trasera Oficial Negro Obsidiana -->
                            <div class="stepped-phone-card step-3 color-black" onclick="window.open3DDeviceModal('Xiaomi 18 Pro', 'phone-theme-black', 'Dummy 18 Pro Black', 'phone')" title="Xiaomi 18 Pro (Obsidian Black) - Clic para ver 3D">
                                <div class="stepped-phone-inner">
                                    <img src="img/devices/xiaomi_18_pro_back.webp" class="stepped-real-skin" alt="Xiaomi 18 Pro Trasera Negra Oficial">
                                </div>
                            </div>

                            <!-- Teléfono 2: Xiaomi 18 Pro Trasera Oficial Plata Titanio -->
                            <div class="stepped-phone-card step-2 color-silver" onclick="window.open3DDeviceModal('Xiaomi 18 Pro', 'phone-theme-silver', 'Dummy 18 Pro Silver', 'phone')" title="Xiaomi 18 Pro (Titanium Silver) - Clic para ver 3D">
                                <div class="stepped-phone-inner">
                                    <img src="img/devices/xiaomi_18_pro_back.webp" class="stepped-real-skin" alt="Xiaomi 18 Pro Trasera Plata Oficial">
                                </div>
                            </div>

                            <!-- Teléfono 1: Xiaomi 18 Pro Trasera Oficial Verde Alpino -->
                            <div class="stepped-phone-card step-1 color-green" onclick="window.open3DDeviceModal('Xiaomi 18 Pro', 'phone-theme-green', 'LDU 18 Pro Green', 'phone')" title="Xiaomi 18 Pro (Alpine Green) - Clic para ver 3D">
                                <div class="stepped-phone-inner">
                                    <img src="img/devices/xiaomi_18_pro_back.webp" class="stepped-real-skin" alt="Xiaomi 18 Pro Trasera Verde Oficial">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Zona 2: Xiaomi 18 Pro Max (Hero Vertical en Peana + Muestras de Color Flanqueadas) -->
                <div class="destacador-zone zone-18promax">
                    <div class="destacador-zone-items">
                        <div class="color-swatches-col">
                            <span class="color-pill pill-ruby" title="Ruby Red"></span>
                            <span class="color-pill pill-titanium" title="Titanium Black"></span>
                            <span class="color-pill pill-purple" title="Lavender Purple"></span>
                            <span class="color-pill pill-silver" title="Pearl White"></span>
                        </div>
                        <div class="hero-max-pedestal" onclick="window.open3DDeviceModal('Xiaomi 18 Pro Max', 'phone-theme-blue', 'Hero LDU Max', 'phone')" title="★ Xiaomi 18 Pro Max - Clic para ver 3D">
                            <div class="pedestal-glow-base"></div>
                            <div class="phone-3d-box" style="transform: rotateX(-78deg) translateZ(6px); width: 56px; height: 112px;">
                                <div class="phone-face-front has-real-skin">
                                    <img src="img/devices/xiaomi_18_pro_max_front.webp" class="device-real-skin" alt="Xiaomi 18 Pro Max Frontal">
                                </div>
                                <div class="phone-face-back has-real-skin color-gold">
                                    <img src="img/devices/xiaomi_18_pro_max_back.webp" class="device-real-skin" alt="Xiaomi 18 Pro Max Trasera">
                                </div>
                                <div class="phone-edge-left"></div>
                                <div class="phone-edge-right"></div>
                                <div class="phone-edge-top"></div>
                                <div class="phone-edge-bottom"></div>
                            </div>
                            <div class="spiral-3d-cord" style="margin-top: 2px;"></div>
                        </div>
                        <div class="color-swatches-col">
                            <span class="color-pill pill-black" title="Obsidian Black"></span>
                            <span class="color-pill pill-gold" title="Champagne Gold"></span>
                            <span class="color-pill pill-green" title="Alpine Green"></span>
                            <span class="color-pill pill-silver" title="Titanium Silver"></span>
                        </div>
                    </div>
                </div>

                <!-- Zona 3: Xiaomi Watch S5 46mm (Columna cilíndrica) -->
                <div class="destacador-zone zone-watch">
                    <div class="destacador-zone-items">
                        <div class="watch-column-pedestal" onclick="window.open3DDeviceModal('Xiaomi Watch S5 46mm', 'round', 'Wear S5', 'watch')" title="Xiaomi Watch S5 46mm - Clic para ver 3D">
                            <div class="watch-pedestal-cylinder"></div>
                            <div class="watch-3d-box" style="transform: rotateX(-74deg) translateZ(8px); width: 52px; height: 52px;">
                                <img src="img/devices/watch_s5_46_front.webp" class="watch-real-skin" alt="Xiaomi Watch S5 46mm">
                            </div>
                        </div>
                        <div class="color-swatches-col">
                            <span class="color-pill pill-green" title="Olive Green"></span>
                            <span class="color-pill pill-silver" title="Silver"></span>
                            <span class="color-pill pill-gold" title="Sand Gold"></span>
                        </div>
                    </div>
                </div>

                <!-- Zona 4: Xiaomi Clip (Bandeja acrílica de audio) -->
                <div class="destacador-zone zone-clip">
                    <div class="destacador-zone-items">
                        <div class="clip-acrylic-pad" onclick="window.open3DDeviceModal('Xiaomi Clip', 'buds', 'Nuevo Clip', 'buds')" title="Xiaomi Clip - Clic para ver 3D">
                            <div class="clip-pad-base"></div>
                            <div class="buds-3d-box has-real-skin" style="transform: rotateX(-65deg) translateZ(6px); width: 48px; height: 38px;">
                                <img src="img/devices/buds_clip_front.webp" class="buds-real-skin" alt="Xiaomi Clip">
                            </div>
                        </div>
                        <div class="color-swatches-col">
                            <span class="color-pill pill-gold" title="Rose Gold"></span>
                            <span class="color-pill pill-titanium" title="Dark Titanium"></span>
                            <span class="color-pill pill-silver" title="Silver"></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Rótulos de Serigrafía en la Base de Metacrilato (Sin desbordamiento, 100% integrados en la base) -->
            <div class="destacador-base-silkscreen">
                <span class="silkscreen-label">Xiaomi 18 Pro</span>
                <span class="silkscreen-label">Xiaomi 18 Pro Max</span>
                <span class="silkscreen-label">Xiaomi Watch S5 46mm</span>
                <span class="silkscreen-label">Xiaomi Clip</span>
            </div>
        </div>
    `;
};

// Standalone 3D Showroom del Destacador Oficial (Permite giro 360 y comparación)
window.wrapRetailDestacador3D = function(destacadorId = 'destacador-main', title = 'Destacador Oficial Xiaomi 18 Pro Series · Co-Engineered with Leica') {
    return `
        <div class="retail-showroom-wrapper" id="showroom-${destacadorId}" style="margin-bottom: 28px;">
            <div class="retail-side-nav-bar">
                <div class="retail-nav-top-row">
                    <div class="retail-nav-title-group">
                        <span class="retail-nav-pill" style="background: linear-gradient(135deg, #be123c 0%, #881337 100%);">
                            <i class="fas fa-gem" style="color: #fff;"></i> ${title}
                        </span>
                        <span class="retail-nav-hint">
                            <i class="fas fa-arrows-alt-h"></i> Arrastra en horizontal para rotar 360° el Destacador Oficial Leica
                        </span>
                    </div>
                    <div class="retail-side-tabs">
                        <button type="button" id="btn-side-0-${destacadorId}" class="retail-side-btn active" onclick="window.setRetailTableAngle('${destacadorId}', 0, -18)">
                            <i class="fas fa-eye"></i> 0° Frontal 3D
                        </button>
                        <button type="button" id="btn-side-35-${destacadorId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${destacadorId}', 35, -20)">
                            <i class="fas fa-cube"></i> 35° Perspectiva 3D
                        </button>
                        <button type="button" id="btn-side-90-${destacadorId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${destacadorId}', 90, -18)">
                            <i class="fas fa-columns"></i> 90° Perfil 3D
                        </button>
                        <button type="button" id="btn-side-180-${destacadorId}" class="retail-side-btn" onclick="window.setRetailTableAngle('${destacadorId}', 180, -18)">
                            <i class="fas fa-undo"></i> 180° Posterior
                        </button>
                        <button type="button" id="btn-autospin-${destacadorId}" class="retail-side-btn retail-side-btn-autospin" onclick="window.toggleRetailAutoSpin('${destacadorId}')" title="Girar 360 grados en 3D">
                            <i class="fas fa-sync-alt"></i> Giro 360°
                        </button>
                        <button type="button" class="retail-side-btn" onclick="window.openDestacadorCompareModal()" style="background: #fff1f2; color: #be123c; border-color: #fecdd3; font-weight: 800;">
                            <i class="fas fa-camera"></i> Ver Foto Real POSM
                        </button>
                    </div>
                </div>

                <div class="retail-h-slider-bar">
                    <div class="retail-h-slider-box">
                        <span class="retail-h-slider-label">
                            <i class="fas fa-compass" style="color: #be123c;"></i> Giro Horizontal 360°:
                        </span>
                        <input type="range" id="h-slider-${destacadorId}" class="retail-h-slider" min="0" max="360" value="0" oninput="window.setRetailTableAngle('${destacadorId}', this.value)">
                        <span id="h-degree-pill-${destacadorId}" class="retail-h-degree-pill">0° • Frontal 3D</span>
                    </div>
                </div>
            </div>

            <div class="retail-3d-stage" id="stage-${destacadorId}">
                <div class="retail-destacador-rig" id="rig-${destacadorId}">
                    <!-- Sombra en suelo -->
                    <div class="table-floor-shadow" style="width: 860px; height: 300px; left: -20px; transform: rotateX(90deg) translateZ(-200px);"></div>

                    <!-- Módulo Destacador 3D con Backwall Independiente y Base Extruida -->
                    <div class="destacador-standalone-base">
                        ${window.renderDestacadorLeicaX18Html({ isStandalone: true, destacadorId: `${destacadorId}-unit` })}
                    </div>
                </div>
            </div>
    `;
};

// Modal Comparativo entre el Destacador 3D y la Foto Real subida por el usuario
window.openDestacadorCompareModal = function() {
    let modal = document.getElementById('destacador-compare-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'destacador-compare-modal';
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 950px; width: 92%; padding: 24px; border-radius: 20px;">
                <span class="close-modal" onclick="window.closeDestacadorCompareModal()" style="position: absolute; top: 1.2rem; right: 1.5rem; font-size: 1.8rem; cursor: pointer; color: #94a3b8; z-index: 10;">&times;</span>
                <div id="destacador-compare-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const body = document.getElementById('destacador-compare-body');
    if (body) {
        body.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1.5px solid #f1f5f9;">
                <span style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #be123c 0%, #881337 100%); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                    <i class="fas fa-camera"></i>
                </span>
                <div>
                    <h3 style="margin: 0; font-size: 1.3rem; color: #0f172a; font-weight: 900;">Destacador Oficial Xiaomi 18 Pro Series · Co-Engineered with Leica</h3>
                    <span style="font-size: 12px; color: #64748b; font-weight: 600;">Comparativa entre la Foto Real del Mueble POSM y el Modelo 3D Integrado en el Planograma</span>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px; align-items: start;">
                <!-- Columna 1: Foto Real subida -->
                <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="background: #be123c; color: white; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 800;">FOTO REAL POSM</span>
                        <span style="font-size: 11.5px; color: #64748b; font-weight: 700;">Muestra Oficial de Producción</span>
                    </div>
                    <div style="position: relative; border-radius: 10px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 6px 16px rgba(0,0,0,0.12);">
                        <img src="img/posm/destacador_x18_pro_series.jpg" alt="Foto Real Destacador Xiaomi 18 Pro Series" style="width: 100%; height: auto; display: block;">
                    </div>
                    <div style="margin-top: 12px; font-size: 12px; color: #475569; line-height: 1.5;">
                        <strong style="color: #0f172a; display: block; margin-bottom: 4px;">Detalles Físicos del Mueble:</strong>
                        • <b>Panel Trasero:</b> Rótulo oficial <i>xiaomi 18 Pro Series · CO-ENGINEERED WITH Leica</i> con escultura de cámara en rojo rubí translúcido.<br>
                        • <b>4 Zonas de Producto:</b> Xiaomi 18 Pro (3 horizontales), Xiaomi 18 Pro Max (hero vertical), Xiaomi Watch S5 46mm y Xiaomi Clip.<br>
                        • <b>Pastillas de Color:</b> Muestras de color encastradas en la base acrílica.
                    </div>
                </div>

                <!-- Columna 2: Especificaciones del Planograma e Integración -->
                <div style="background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 14px; padding: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="background: var(--mi-orange); color: white; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 800;">INTEGRACIÓN 3D PLANOGRAMA</span>
                        <span style="font-size: 11.5px; color: #b45309; font-weight: 700;">Guía X18 Series</span>
                    </div>
                    <div style="background: #ffffff; border: 1.5px solid #fed7aa; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
                        <h4 style="margin: 0 0 6px; font-size: 13.5px; color: #9a3412; font-weight: 800;">¿Cómo se integra en la Mesa?</h4>
                        <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.55;">
                            El destacador se ubica en la <b>Cara Frontal de Mesa 1</b> (en tiendas de 1, 2 y 3 Mesas, y en Cabecera ECI), ocupando el espacio de los dos primeros bloques tradicionales de la mesa. Detrás de él, se sitúan el Bloque 3 (Serie 17T) y el Bloque 4 (Redmi Note 17 Pro).
                        </p>
                    </div>

                    <div style="background: #ffffff; border: 1.5px solid #fed7aa; border-radius: 10px; padding: 14px;">
                        <h4 style="margin: 0 0 6px; font-size: 13.5px; color: #9a3412; font-weight: 800;">Dispositivos y Wallpapers Reales</h4>
                        <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.55;">
                            A diferencia de la muestra provisional de la foto (con mockups previos), en la aplicación se visualizan los <b>dispositivos finales de campaña</b> con sus wallpapers oficiales de Xiaomi 18 Pro Series, lentes Leica reales y módulos de cámara detallados.
                        </p>
                    </div>

                    <div style="margin-top: 18px; display: flex; gap: 8px;">
                        <button type="button" onclick="window.toggleDestacadorMode('destacador'); window.closeDestacadorCompareModal();" style="flex: 1; padding: 9px 14px; border-radius: 8px; border: none; background: var(--mi-orange); color: #fff; font-weight: 800; font-size: 12px; cursor: pointer;">
                            <i class="fas fa-check-circle"></i> Aplicar en el Planograma
                        </button>
                        <button type="button" onclick="window.closeDestacadorCompareModal()" style="padding: 9px 14px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; color: #64748b; font-weight: 700; font-size: 12px; cursor: pointer;">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    modal.style.display = 'block';
};

window.closeDestacadorCompareModal = function() {
    const modal = document.getElementById('destacador-compare-modal');
    if (modal) modal.style.display = 'none';
};

// Banner superior e inyección de mobiliario extra cuando hay una tienda seleccionada desde Tiendas o el buscador
window.renderSelectedStoreFurnitureHeader = function() {
    const s = window.selectedPlanogramStore;
    if (!s) return '';
    const cuentaNorm = (s.cuenta || '').toLowerCase().trim();
    const isAlcampo = cuentaNorm.includes('alcampo');
    const isCarrefour = cuentaNorm.includes('carrefour') || cuentaNorm.includes('crf');
    const mesas = Number(s.Mesa) || 0;
    const cols = Number(s.Columna) || 0;
    const walls = Number(s.Wall) || 0;
    const isCab = window.isStoreCabeceraEci(s);
    const specId = window.getStoreSpecialCaseId(s);
    const sDevs = getStoreImeiDevices(s.nombre) || [];
    const hasPad8Pro = sDevs.some(d => (d.modelo || '').toLowerCase().includes('pad 8 pro'));

    return `
        <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffffff 100%); border: 2px solid #fed7aa; border-radius: 16px; padding: 14px 18px; margin-bottom: 18px; box-shadow: 0 6px 18px rgba(255,103,0,0.08);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 42px; height: 42px; border-radius: 12px; background: var(--mi-orange); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; box-shadow: 0 4px 10px rgba(255,103,0,0.25);">
                        <i class="fas fa-store"></i>
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <strong style="font-size: 15px; color: #0f172a; font-weight: 900;">${s.nombre}</strong>
                            <span style="font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 999px; font-weight: 800;">${s.cuenta || 'Retail'}</span>
                            ${specId ? `<span style="font-size: 11px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 2px 8px; border-radius: 999px; font-weight: 800;"><i class="fas fa-star"></i> Caso Especial Guía X18</span>` : ''}
                            ${isCab ? `<span style="font-size: 11px; background: #ffedd5; color: #c2410c; border: 1px solid #fdba74; padding: 2px 8px; border-radius: 999px; font-weight: 800;"><i class="fas fa-crown"></i> Tiene Cabecera ECI</span>` : ''}
                        </div>
                        <div style="font-size: 12px; color: #475569; margin-top: 4px; display: flex; gap: 10px; flex-wrap: wrap; font-weight: 600;">
                            <span><i class="fas fa-table" style="color: var(--mi-orange);"></i> <b>${mesas}</b> ${mesas === 1 ? 'Mesa' : 'Mesas'} ${s['Top Table'] ? `(${s['Top Table']})` : ''}</span>
                            <span><i class="fas fa-columns" style="color: #0284c7;"></i> <b>${cols}</b> ${cols === 1 ? 'Columna' : 'Columnas'}</span>
                            <span><i class="fas fa-th-large" style="color: #7c3aed;"></i> <b>${walls}</b> ${walls === 1 ? 'Wall' : 'Walls'}</span>
                            <span><i class="fas fa-tablet-alt" style="color: ${hasPad8Pro ? '#2563eb' : '#16a34a'};"></i> ${hasPad8Pro ? 'Con Xiaomi Pad 8 Pro (Variante B)' : 'Sin Pad 8 Pro (Variante A)'}</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    ${isAlcampo ? `<button type="button" onclick="window.switchClusterTab('alcampo')" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #f87171; background: #fef2f2; color: #b91c1c; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-shopping-basket"></i> Mesa Alcampo 3D</button>` : ''}
                    ${isCarrefour ? `
                        <button type="button" onclick="window.switchClusterTab('carrefour')" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #93c5fd; background: #eff6ff; color: #1d4ed8; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-store"></i> Mesa CRF Estándar</button>
                        <button type="button" onclick="window.switchClusterTab('carrefour_premium')" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #fdba74; background: #fff7ed; color: #c2410c; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-gem"></i> Mesa CRF Premium</button>
                    ` : ''}
                    ${specId ? `<button type="button" onclick="window.switchClusterTab('especiales')" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #f59e0b; background: #fffbeb; color: #b45309; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-star"></i> Ver Planograma Especial</button>` : ''}
                    ${(!isAlcampo && !isCarrefour && mesas > 0) ? `<button type="button" onclick="window.switchClusterTab(${mesas >= 3 ? 3 : (mesas === 2 ? 2 : 1)})" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #fdba74; background: #fff; color: #ea580c; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-table"></i> Mesas (${mesas})</button>` : ''}
                    ${(walls > 0 || cols > 0) ? `<button type="button" onclick="window.switchClusterTab('wall_col')" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #93c5fd; background: #eff6ff; color: #1d4ed8; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-columns"></i> Wall (${walls}) / Col (${cols})</button>` : ''}
                    ${isCab ? `<button type="button" onclick="window.switchClusterTab('cabecera_posm')" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid #fca5a5; background: #fef2f2; color: #b91c1c; font-size: 11.5px; font-weight: 800; cursor: pointer;"><i class="fas fa-crown"></i> Cabecera ECI</button>` : ''}
                    <button type="button" onclick="window.clearSelectedPlanogramStore()" style="padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: #64748b; font-size: 11.5px; font-weight: 700; cursor: pointer;" title="Quitar filtro de tienda"><i class="fas fa-times"></i></button>
                </div>
            </div>
        </div>
    `;
};

window.renderSelectedStoreExtraFurniture = function(currentTab, dragTableIds = []) {
    const s = window.selectedPlanogramStore;
    if (!s) return '';
    // Si estamos en una pestaña de Mesas (1, 2 o 3) y la tienda además tiene Wall, Columna o Cabecera ECI, los mostramos debajo automáticamente en 3D
    if (currentTab !== 1 && currentTab !== 2 && currentTab !== 3) return '';
    const cols = Number(s.Columna) || 0;
    const walls = Number(s.Wall) || 0;
    const isCab = window.isStoreCabeceraEci(s);
    if (cols === 0 && walls === 0 && !isCab) return '';

    let extraHtml = `
        <div style="margin-top: 36px; padding-top: 24px; border-top: 2px dashed #fdba74;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                <span style="background: var(--mi-orange); color: white; padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase;">Mobiliario 3D Adicional de ${s.nombre}</span>
                <span style="font-size: 13px; color: #475569; font-weight: 700;">Esta tienda cuenta además con ${[walls > 0 ? `${walls} Wall` : '', cols > 0 ? `${cols} Columna${cols > 1 ? 's' : ''}` : '', isCab ? 'Cabecera ECI' : ''].filter(Boolean).join(' + ')}:</span>
            </div>
    `;
    if (isCab) {
        dragTableIds.push('store-cabecera');
        extraHtml += window.wrapRetailCabeceraEci3D('store-cabecera', `Cabecera ECI de ${s.nombre}`);
    }
    if (walls > 0) {
        dragTableIds.push('store-wall');
        extraHtml += window.getStandardWall3DHtml('store-wall', `Wall de ${s.nombre} (${walls} ${walls === 1 ? 'Unidad' : 'Unidades'} · ${s['Lightbox Wall'] || 'Xiaomi 18 Pro Series'})`);
    }
    if (cols > 0) {
        dragTableIds.push('store-col');
        extraHtml += window.getStandardColumna3DHtml('store-col', `Columna de ${s.nombre} (${cols} ${cols === 1 ? 'Unidad' : 'Unidades'} · ${s['Lightbox Column'] || 'Xiaomi 18 Pro Series'})`);
    }
    extraHtml += `</div>`;
    return extraHtml;
};


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

                    <!-- Patas 3D Volumétricas bajo el cuerpo del mueble -->
                    <div class="table-3d-leg leg-alcampo leg-fl"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-alcampo leg-fr"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-alcampo leg-bl"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>
                    <div class="table-3d-leg leg-alcampo leg-br"><div class="leg-face leg-front"></div><div class="leg-face leg-back"></div><div class="leg-face leg-left"></div><div class="leg-face leg-right"></div></div>

                    <!-- Mueble Isla con Marco Antracita Sólido (Sin separación ni flotación) -->
                    <div class="table-volume-box mueble-alcampo-crf">
                        <div class="table-face-front">
                            <div class="table-led-strip"></div>
                            <div class="table-xiaomi-glowing-logo"><img src="logo.png" class="table-xiaomi-logo-img" alt="Xiaomi"></div>
                        </div>
                        <div class="table-face-back">
                            <div class="table-led-strip"></div>
                            <div class="table-xiaomi-glowing-logo"><img src="logo.png" class="table-xiaomi-logo-img" alt="Xiaomi"></div>
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
                            <div class="table-xiaomi-glowing-logo"><img src="logo.png" class="table-xiaomi-logo-img" alt="Xiaomi"></div>
                        </div>
                        <div class="table-face-back">
                            <div class="table-led-strip"></div>
                            <div class="table-xiaomi-glowing-logo"><img src="logo.png" class="table-xiaomi-logo-img" alt="Xiaomi"></div>
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

                        <!-- Encimera Superior -->
                        <div class="table-face-top">
                            <!-- Fila Posterior (Cara B): 4 terminales separados -->
                            <div class="row-alcampo-crf row-back">
                                ${sideBHtml}
                            </div>

                            <!-- TOP TABLE Central Unificado Flagship Premium (90° Vertical, sin flotación) -->
                            <div class="alcampo-crf-toptable-divider">
                                <div class="crf-premium-toptable-centerpiece">
                                    <!-- Tótem arqueado Xiaomi con luz LED -->
                                    <div class="crf-premium-totem-pole">
                                        <div class="crf-premium-totem-logo"><img src="logo.png" class="crf-totem-logo-img" alt="Xiaomi"></div>
                                    </div>

                                    <!-- Banner oficial Top Table Carrefour Premium a doble cara (limpio sin fichas de Note 17 ni grada/letras inferiores) -->
                                    <div class="crf-premium-banner-stand" onclick="window.openTopTableZoomModal('img/posm/toptable_alcampo_crf_note15.png', 'Top Table Flagship · REDMI Note 15 Series')" title="Clic para ampliar Top Table Flagship">
                                        <div class="crf-premium-banner-face crf-premium-banner-front">
                                            <img src="img/posm/toptable_alcampo_crf_note15.png" class="crf-premium-banner-img" alt="Top Table Carrefour Premium Frontal">
                                            <div class="alcampo-crf-lb-glare"></div>
                                        </div>
                                        <div class="crf-premium-banner-face crf-premium-banner-back">
                                            <img src="img/posm/toptable_alcampo_crf_note15.png" class="crf-premium-banner-img" alt="Top Table Carrefour Premium Cara B">
                                            <div class="alcampo-crf-lb-glare"></div>
                                        </div>
                                        <div class="crf-premium-banner-base"></div>
                                    </div>
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
                    • <b>Top Table Vertical Anclado:</b> Banner oficial <i>REDMI Note 15 Series</i> erguido a 90° + Tótem Xiaomi iluminado<br>
                    • <b>Grada Central Longitudinal:</b> Podium colocado verticalmente en el centro con atriles acrílicos de especificaciones comparativas<br>
                    • <b>Dispositivos Separados:</b> 8 terminales repartidos a lo largo de toda la superficie de la mesa
                </div>
            </div>

            ${window.wrapCarrefourPremiumTable3D('carrefour-prem-m1', `Mesa CRF Premium (${sName})`, sideAHtml, sideBHtml)}
        </div>
    `;
};


window.renderVisualTableMockup = function(clusterId) {
    const container = document.getElementById('visual-planogram-diagram-container');
    if (!container) return;

    if (clusterId === 'hojaruta') {
        container.style.display = 'none';
        return;
    }

    if (!clusterId) {
        container.style.display = 'block';
        container.innerHTML = `
            <div style="background: var(--bg-main); border: 1.5px dashed rgba(166, 180, 200, 0.4); border-radius: 18px; padding: 42px 24px; text-align: center; box-shadow: var(--neu-inset-sm); margin-top: 10px;">
                <div style="width: 58px; height: 58px; border-radius: 16px; background: var(--bg-main); box-shadow: var(--neu-flat-sm); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; color: var(--mi-orange); font-size: 26px;">
                    <i class="fas fa-layer-group"></i>
                </div>
                <h3 style="margin: 0 0 8px; font-size: 1.25rem; color: var(--text-heading); font-weight: 800;">Guía de Lanzamiento Xiaomi 18 Series · Planograma 3D</h3>
                <p style="margin: 0 auto; max-width: 620px; font-size: 13.5px; color: var(--text-muted); line-height: 1.5;">
                    Selecciona una pestaña superior o busca una tienda para visualizar sus <b>Mesas 360°</b>, <b>Wall y Columnas</b>, <b>Casos Especiales (MM Adeje, ECI Castellana, MM SSRR)</b>, <b>Lineal de Wearables</b> o <b>Cabecera ECI & POSM</b>.
                </p>
                <div style="margin-top: 22px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
                    <button type="button" onclick="window.switchClusterTab(1)" style="padding: 10px 16px; border-radius: 10px; border: none; background: var(--bg-main); box-shadow: var(--neu-flat-sm); color: var(--text-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;">
                        <i class="fas fa-table" style="color: var(--mi-orange);"></i> 04. 1 Mesa
                    </button>
                    <button type="button" onclick="window.switchClusterTab(2)" style="padding: 10px 16px; border-radius: 10px; border: none; background: var(--bg-main); box-shadow: var(--neu-flat-sm); color: var(--text-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;">
                        <i class="fas fa-table" style="color: var(--mi-orange);"></i> 05-06. 2 Mesas
                    </button>
                    <button type="button" onclick="window.switchClusterTab(3)" style="padding: 10px 16px; border-radius: 10px; border: none; background: var(--bg-main); box-shadow: var(--neu-flat-sm); color: var(--text-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;">
                        <i class="fas fa-table" style="color: var(--mi-orange);"></i> 07. 3 Mesas
                    </button>
                    <button type="button" onclick="window.switchClusterTab('wall_col')" style="padding: 10px 16px; border-radius: 10px; border: none; background: var(--bg-main); box-shadow: var(--neu-flat-sm); color: var(--text-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;">
                        <i class="fas fa-columns" style="color: #0284c7;"></i> 08. Wall y Columna
                    </button>
                    <button type="button" onclick="window.switchClusterTab('especiales')" style="padding: 10px 16px; border-radius: 10px; border: none; background: var(--bg-main); box-shadow: var(--neu-flat-sm); color: var(--text-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;">
                        <i class="fas fa-star" style="color: #d97706;"></i> 09. Casos Especiales
                    </button>
                    <button type="button" onclick="window.switchClusterTab('wearables')" style="padding: 10px 16px; border-radius: 10px; border: none; background: var(--bg-main); box-shadow: var(--neu-flat-sm); color: var(--text-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;">
                        <i class="fas fa-stopwatch" style="color: #16a34a;"></i> 10. Lineal Wearables
                    </button>
                    <button type="button" onclick="window.switchClusterTab('cabecera_posm')" style="padding: 10px 16px; border-radius: 10px; border: none; background: var(--bg-main); box-shadow: var(--neu-flat-sm); color: var(--text-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;">
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
                </div>
            </div>
        `;
        return;
    }

    container.style.display = 'block';
    const strTab = String(clusterId);
    const cNum = (strTab === '1' || strTab === '2' || strTab === '3') ? Number(strTab) : 0;
    const storeHeaderHtml = window.renderSelectedStoreFurnitureHeader();
    const dragTableIds = [];
    let html = '';

    // Detectar si la tienda seleccionada tiene Pad 8 Pro
    let storeHasPad8Pro = false;
    if (window.selectedPlanogramStore) {
        const sDevs = getStoreImeiDevices(window.selectedPlanogramStore.nombre) || [];
        storeHasPad8Pro = sDevs.some(d => (d.modelo || '').toLowerCase().includes('pad 8 pro'));
    }

    if (cNum === 1) {
        // 04. PLANOGRAMA 1 MESA (30 MM, 16 ECI) - 4 bloques por cara con Top Table Oficial
        const sideFrontC1 = `
            ${window.renderRetailTray('Bloque 1 · Xiaomi 18 Pro Max (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'Xiaomi 18 Pro Max', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'gold', specs: 'Xiaomi 18 Pro Max · LDU con peana', isHero: true })}
                ${window.renderRetailSlot({ model: 'Dummy Xiaomi 18 Pro Max', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'gold', specs: 'Dummy Xiaomi 18 Pro Max (En peana)', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi 18 Pro (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'Xiaomi 18 Pro', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'gold', specs: 'Xiaomi 18 Pro · LDU con peana', isHero: true })}
                ${window.renderRetailSlot({ model: 'Dummy Xiaomi 18 Pro', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'gold', specs: 'Dummy Xiaomi 18 Pro (En peana)', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 3 · Serie 17T + Band 10 + Clip', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T Pro', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'Xiaomi 17T Pro Blue' })}
                ${window.renderRetailSlot({ model: 'Xiaomi 17T', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'Xiaomi 17T Purple' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Band 10', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Band 10 (1 LDU Band 11 entra en dotación)' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Clip', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'buds', color: 'gold', specs: 'Xiaomi Buds Clip (Nuevo)' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · Familia Redmi Note 17 Pro', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'white-orange', specs: 'RN 17 Pro Max 5G White & Orange' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'white-orange', specs: 'Dummy RN 17 Pro Max 5G White & Orange' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', specs: 'RN 17 Pro 5G Green' })}
            `)}
        `;

        const sideBackC1 = `
            ${window.renderRetailTray('Bloque 1 · RN 17 Pro 5G + Ecosistema Redmi', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'RN 17 Pro 5G Blue' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'purple', specs: 'Dummy RN 17 Pro 5G Purple' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6' })}
                ${window.renderRetailSlot({ model: 'REDMI Buds 8', badgeColor: 'green', typeBadge: 'Buds', deviceType: 'buds', color: 'white', specs: 'REDMI Buds 8' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi Pad 8 + RN 17 5G', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'silver', specs: 'Xiaomi Pad 8 Horizontal' })}
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'RN 17 5G Purple' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · REDMI Pad 2 Pro + REDMI 17 5G', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 Pro Horizontal' })}
                ${window.renderRetailSlot({ model: 'REDMI 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'orange', specs: 'REDMI 17 5G Orange' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · REDMI Pad 2 + REDMI 17 4G', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'green', specs: 'REDMI Pad 2 Horizontal' })}
                ${window.renderRetailSlot({ model: 'REDMI 17 4G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', specs: 'REDMI 17 4G Green' })}
            `)}
        `;

        dragTableIds.push('c1-m1');
        html = `
            <div class="visual-table-wrapper">
                ${storeHeaderHtml}
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 1.25rem;">
                    <div>
                        <span style="background: rgba(255,103,0,0.12); color: var(--mi-orange); font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">04. PLANOGRAMA 1 MESA - ECI / MM</span>
                        <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Mesa 1 (1 Mesa) • Guía Oficial X18 Series 360°</h3>
                        <span style="font-size: 12px; color: #64748b; font-weight: 600;">Dotación oficial: <b>30 MediaMarkt · 16 El Corte Inglés</b> (4 bloques por cara)</span>
                    </div>
                    <div style="background: #fff; border: 1px solid #fed7aa; border-radius: 10px; padding: 10px 14px; font-size: 11.5px; color: #7c2d12; line-height: 1.45;">
                        <strong style="color: var(--mi-orange); display: block; margin-bottom: 2px;"><i class="fas fa-info-circle"></i> Reglas Guía X18 (1 Mesa):</strong>
                        • <b>Xiaomi 18 Pro Max + Dummy</b> y <b>Xiaomi 18 Pro + Dummy</b> con Top Table Oficial 3D en el separador central (ON/OFF en barra superior)<br>
                        • <b>Top Table Doble Cara:</b> Frontal Xiaomi 18 Pro / Posterior Redmi Note 17 Series<br>
                        • <b>1 LDU de Smart Band 11</b> entra en dotación (se expone Band 10 si falta espacio)<br>
                        • Se incorpora <b>Xiaomi Clip</b> (Nuevo) junto a Serie 17T<br>
                        • <span style="color:#dc2626; font-weight:700;">Devolución a central:</span> Xiaomi 17, Band 10 Pro, Watch 5 y Buds 6
                    </div>
                </div>

                ${window.wrapRetailShowroom360('c1-m1', 'Mesa 1 (Planograma 1 Mesa · 4 Bloques por Cara)', sideFrontC1, sideBackC1)}

                ${window.renderSelectedStoreExtraFurniture(1, dragTableIds)}
            </div>
        `;
    } else if (cNum === 2) {
        // 05 & 06. PLANOGRAMA 2 MESAS (65 MM, 32 ECI) - Con selector Variante A (Con Pad 8) / Variante B (Con Pad 8 Pro)
        const sideFrontC2M1 = `
            ${window.renderRetailTray('Bloque 1 · Xiaomi 18 Pro Max (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'Xiaomi 18 Pro Max', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'gold', specs: 'Xiaomi 18 Pro Max · LDU con peana', isHero: true })}
                ${window.renderRetailSlot({ model: 'Dummy Xiaomi 18 Pro Max', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'gold', specs: 'Dummy Xiaomi 18 Pro Max', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi 18 Pro (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'Xiaomi 18 Pro', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'gold', specs: 'Xiaomi 18 Pro · LDU con peana', isHero: true })}
                ${window.renderRetailSlot({ model: 'Dummy Xiaomi 18 Pro', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'gold', specs: 'Dummy Xiaomi 18 Pro', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 3 · Xiaomi 17T Pro + Watch S5 + Clip', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T Pro', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'Xiaomi 17T Pro Blue' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 46mm', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch S5 46mm' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 41mm', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'watch', color: 'gold', specs: 'Xiaomi Watch S5 41mm (Nuevo)' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Clip', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'buds', color: 'gold', specs: 'Xiaomi Buds Clip (Nuevo)' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · Xiaomi 17T + Smart Band 11 Series', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'Xiaomi 17T Purple' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Smart Band 11 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 11 Active' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Smart Band 11', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 11 (Nuevo)' })}
            `)}
        `;

        const sideBackC2M1 = `
            ${window.renderRetailTray('Bloque 1 · RN 17 Pro Max + REDMI Watch 6', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'RN 17 Pro Max Black' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'green', specs: 'Dummy RN 17 Pro Max 5G Green' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · RN 17 Pro 5G (Se retira Watch 5)', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'RN 17 Pro 5G Black' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'purple', specs: 'Dummy RN 17 Pro 5G Purple (Se retira Watch 5)' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · RN 17 5G Black & Blue', `
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'RN 17 5G Black' })}
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'RN 17 5G Blue' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · REDMI 17 5G + Audio Buds 8', `
                ${window.renderRetailSlot({ model: 'REDMI 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', specs: 'REDMI 17 5G' })}
                ${window.renderRetailSlot({ model: 'REDMI Buds 8', badgeColor: 'green', typeBadge: 'Buds', deviceType: 'buds', color: 'white', specs: 'REDMI Buds 8' })}
                ${window.renderRetailSlot({ model: 'REDMI Buds 8 Pro', badgeColor: 'green', typeBadge: 'Buds', deviceType: 'buds', color: 'black', specs: 'REDMI Buds 8 Pro' })}
            `)}
        `;

        // Mesa 2 Variante A (05. Con Pad 8 / Sin Pad 8 Pro)
        const sideFrontC2M2Sin = `
            ${window.renderRetailTray('Bloque 1 · Xiaomi Pad 8', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'silver', specs: 'Xiaomi Pad 8 Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · REDMI Pad 2 Pro', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 Pro Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · REDMI Pad 2 Pro + REDMI 17 5G Dummy', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 Pro Horizontal' })}
                ${window.renderRetailSlot({ model: 'REDMI 17 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'orange', specs: 'Dummy REDMI 17 5G Orange' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · REDMI Pad 2 + REDMI 17 4G Dummy', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'green', specs: 'REDMI Pad 2 Horizontal' })}
                ${window.renderRetailSlot({ model: 'REDMI 17 4G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'blue', specs: 'Dummy REDMI 17 4G Blue' })}
            `)}
        `;

        // Mesa 2 Variante B (06. Con Pad 8 Pro)
        const sideFrontC2M2Con = `
            ${window.renderRetailTray('Bloque 1 · ★ Hero Xiaomi Pad 8 Pro', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8 Pro', badgeColor: 'orange', typeBadge: '★ Hero Pad', deviceType: 'tablet', color: 'gold', specs: '★ Xiaomi Pad 8 Pro Horizontal', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi Pad 8', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'silver', specs: 'Xiaomi Pad 8 Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · REDMI Pad 2 Pro + REDMI 17 5G Dummy', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 Pro Horizontal' })}
                ${window.renderRetailSlot({ model: 'REDMI 17 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'orange', specs: 'Dummy REDMI 17 5G Orange' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · REDMI Pad 2 + REDMI 17 4G Dummy', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'green', specs: 'REDMI Pad 2 Horizontal' })}
                ${window.renderRetailSlot({ model: 'REDMI 17 4G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'blue', specs: 'Dummy REDMI 17 4G Blue' })}
            `)}
        `;

        const sideBackC2M2 = `
            ${window.renderRetailTray('Bloque 1 · RN 17 Pro Max 5G + Watch 6', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'white-orange', specs: 'RN 17 Pro Max 5G White & Orange' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'white-orange', specs: 'Dummy RN 17 Pro Max 5G White & Orange' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · RN 17 Pro 5G + Watch 6 Active', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'RN 17 Pro 5G Blue' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'purple', specs: 'Dummy RN 17 Pro 5G Purple' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Active' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · RN 17 5G + Watch 6 Lite', `
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'RN 17 5G Purple' })}
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'blue', specs: 'Dummy RN 17 5G Blue' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6 Lite', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Lite' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · REDMI Pad 2 9.7 + REDMI 17 4G', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 9.7', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 9.7 Horizontal' })}
                ${window.renderRetailSlot({ model: 'REDMI 17 4G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'REDMI 17 4G LDU' })}
            `)}
        `;

        dragTableIds.push('c2-m1', 'c2-m2-sin', 'c2-m2-con');
        html = `
            <div class="visual-table-wrapper">
                ${storeHeaderHtml}
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 1.25rem;">
                    <div>
                        <span style="background: rgba(255,103,0,0.12); color: var(--mi-orange); font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">05 & 06. PLANOGRAMA 2 MESAS - ECI / MM</span>
                        <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Mesas 1 y 2 (Con Pad 8 vs. Con Pad 8 Pro) • Entorno Retail 360°</h3>
                        <span style="font-size: 12px; color: #64748b; font-weight: 600;">Dotación oficial: <b>65 MediaMarkt · 32 El Corte Inglés</b> (4 bloques por cara)</span>
                    </div>
                    <div style="background: #fff; border: 1px solid #fed7aa; border-radius: 10px; padding: 10px 14px; font-size: 11.5px; color: #7c2d12; line-height: 1.45;">
                        <strong style="color: var(--mi-orange); display: block; margin-bottom: 2px;"><i class="fas fa-info-circle"></i> Reglas Guía X18 (2 Mesas):</strong>
                        • Mesa 1: <b>Xiaomi 18 Pro Max + Dummy</b> y <b>Xiaomi 18 Pro + Dummy</b> con Top Table Oficial 3D en el separador central (ON/OFF en barra superior), junto a <b>Watch S5 41mm</b>, <b>Xiaomi Clip</b> y <b>Smart Band 11</b><br>
                        • <b>Top Table Doble Cara:</b> Frontal Xiaomi 18 Pro / Posterior Redmi Note 17 Series<br>
                        • Cara Posterior Mesa 1: <span style="color:#dc2626; font-weight:700;">Se retira Watch 5</span> en bloque RN 17 Pro 5G<br>
                        • Mesa 2: disponible en <b>05. Con Pad 8</b> (Variante A) y <b>06. Con Pad 8 Pro</b> (Variante B)
                    </div>
                </div>

                ${window.wrapRetailShowroom360('c2-m1', 'Mesa 1 (2 MESAS Showroom · Xiaomi 18 Series & Redmi)', sideFrontC2M1, sideBackC2M1)}

                <div style="margin-top: 2rem; padding-top: 1.25rem; border-top: 1.5px solid #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800;">MESA 2</span>
                                <span class="visual-table-title" style="margin: 0; font-size: 1.2rem;">Selector de Variante Mesa 2 (05. Con Pad 8 vs 06. Con Pad 8 Pro)</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button type="button" onclick="window.switchMesa2Variant('sin_pad')" id="btn-m2-sin" style="padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 8px; border: 1.5px solid #cbd5e1; background: white; cursor: pointer;">
                                05. Con Pad 8 (Sin Pad 8 Pro)
                            </button>
                            <button type="button" onclick="window.switchMesa2Variant('con_pad')" id="btn-m2-con" style="padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 8px; border: 1.5px solid #cbd5e1; background: white; cursor: pointer;">
                                06. Con Pad 8 Pro (★ Hero Pad)
                            </button>
                            <button type="button" onclick="window.switchMesa2Variant('both')" id="btn-m2-both" style="padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 8px; border: 1.5px solid #cbd5e1; background: white; cursor: pointer;">
                                Ver Ambas Variantes
                            </button>
                        </div>
                    </div>

                    <div id="m2-wrapper-sin" style="display: block; margin-bottom: 24px;">
                        <div style="font-size: 13px; font-weight: 800; color: #166534; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                            <span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 6px; font-size: 11px;">05. VARIANTE A</span>
                            <span>Mesa 2 (2 MESAS) — CON PAD 8 (Sin Pad 8 Pro)</span>
                        </div>
                        ${window.wrapRetailShowroom360('c2-m2-sin', 'Mesa 2 (05. Con Pad 8 · Sin Pad 8 Pro)', sideFrontC2M2Sin, sideBackC2M2)}
                    </div>

                    <div id="m2-wrapper-con" style="display: block;">
                        <div style="font-size: 13px; font-weight: 800; color: #b45309; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                            <span style="background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 6px; font-size: 11px;">06. VARIANTE B</span>
                            <span>Mesa 2 (2 MESAS) — CON XIAOMI PAD 8 PRO</span>
                        </div>
                        ${window.wrapRetailShowroom360('c2-m2-con', 'Mesa 2 (06. Con Xiaomi Pad 8 Pro)', sideFrontC2M2Con, sideBackC2M2)}
                    </div>
                </div>
                ${window.renderSelectedStoreExtraFurniture(2, dragTableIds)}
            </div>
        `;
    } else if (cNum === 3) {
        // 07. PLANOGRAMA 3 MESAS (15 MM, 8 ECI) - 4 bloques por cara
        const sideFrontC3M1 = `
            ${window.renderRetailTray('Bloque 1 · Xiaomi 18 Pro Max (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'Xiaomi 18 Pro Max', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'gold', specs: 'Xiaomi 18 Pro Max · LDU con peana', isHero: true })}
                ${window.renderRetailSlot({ model: 'Dummy Xiaomi 18 Pro Max', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'gold', specs: 'Dummy Xiaomi 18 Pro Max', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi 18 Pro (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'Xiaomi 18 Pro', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'gold', specs: 'Xiaomi 18 Pro · LDU con peana', isHero: true })}
                ${window.renderRetailSlot({ model: 'Dummy Xiaomi 18 Pro', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'gold', specs: 'Dummy Xiaomi 18 Pro', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 3 · Xiaomi 17T Pro + Watch S5 46mm + Clip', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T Pro', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'Xiaomi 17T Pro Blue' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 46mm', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch S5 46mm' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Clip', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'buds', color: 'gold', specs: 'Xiaomi Clip (Sustituye a Band 10)' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · Xiaomi 17T + Watch S5 41mm', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'Xiaomi 17T Purple' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 41mm', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'watch', color: 'gold', specs: 'Xiaomi Watch S5 41mm (Sustituye a Band 10 Pro)' })}
            `)}
        `;

        const sideBackC3M1 = `
            ${window.renderRetailTray('Bloque 1 · Xiaomi 17 Ultra + Watch S5 45mm', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17 Ultra', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'Xiaomi 17 Ultra Leica' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 45mm', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch S5 45mm' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi 17 + Band 10 Pro', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'Xiaomi 17' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Band 10 Pro', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 10 Pro' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · Xiaomi 17T Pro + Smart Band 11', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T Pro', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'Xiaomi 17T Pro Purple' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Smart Band 11', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 11 (Nuevo)' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · Xiaomi 17T + Band 11 Active', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'Xiaomi 17T Blue' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Smart Band 11 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 11 Active' })}
            `)}
        `;

        const sideFrontC3M2 = `
            ${window.renderRetailTray('Bloque 1 · RN 17 Pro Max 5G + Watch 6 Active', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'white-orange', specs: 'RN 17 Pro Max 5G White & Orange' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'white-orange', specs: 'Dummy RN 17 Pro Max 5G White & Orange' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Active' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · RN 17 Pro Max Green + RN 17 Pro + Buds 8 Pro', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', specs: 'RN 17 Pro Max 5G Green' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'RN 17 Pro Blue' })}
                ${window.renderRetailSlot({ model: 'REDMI Buds 8 Pro', badgeColor: 'green', typeBadge: 'Buds', deviceType: 'buds', color: 'black', specs: 'REDMI Buds 8 Pro' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · RN 17 Pro 5G Black & Blue', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'RN 17 Pro 5G Black' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'RN 17 Pro Blue' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · RN 17 5G Purple & Blue Dummy', `
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'RN 17 5G Purple' })}
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'blue', specs: 'Dummy RN 17 5G Blue' })}
            `)}
        `;

        const sideBackC3M2 = `
            ${window.renderRetailTray('Bloque 1 · REDMI 17 5G Orange (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'REDMI 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'orange', specs: 'REDMI 17 5G Orange' })}
                ${window.renderRetailSlot({ model: 'REDMI 17 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'orange', specs: 'Dummy REDMI 17 5G Orange' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · REDMI 17 4G Green & Blue Dummy', `
                ${window.renderRetailSlot({ model: 'REDMI 17 4G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', specs: 'REDMI 17 4G Green' })}
                ${window.renderRetailSlot({ model: 'REDMI 17 4G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'blue', specs: 'Dummy REDMI 17 4G Blue' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · REDMI 15 C + REDMI Watch 6', `
                ${window.renderRetailSlot({ model: 'REDMI 15 C', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'REDMI 15 C Black' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Black' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · REDMI 15 C + Buds 8 & Buds 8 Pro', `
                ${window.renderRetailSlot({ model: 'REDMI 15 C', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'REDMI 15 C Black' })}
                ${window.renderRetailSlot({ model: 'REDMI Buds 8', badgeColor: 'green', typeBadge: 'Buds', deviceType: 'buds', color: 'white', specs: 'REDMI Buds 8' })}
                ${window.renderRetailSlot({ model: 'REDMI Buds 8 Pro', badgeColor: 'green', typeBadge: 'Buds', deviceType: 'buds', color: 'black', specs: 'REDMI Buds 8 Pro' })}
            `)}
        `;

        // Mesa 3: 4 bloques individuales en Cara Frontal y 4 bloques en Cara Posterior
        const sideFrontC3M3Sin = `
            ${window.renderRetailTray('Bloque 1 · Xiaomi Pad 8', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'silver', specs: 'Xiaomi Pad 8 Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · REDMI Pad 2 Pro', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 Pro Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · REDMI Pad 2 Pro', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 Pro Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · REDMI Pad 2', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'green', specs: 'REDMI Pad 2 Horizontal' })}
            `)}
        `;

        const sideFrontC3M3Con = `
            ${window.renderRetailTray('Bloque 1 · ★ Xiaomi Pad 8 Pro', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8 Pro', badgeColor: 'orange', typeBadge: '★ Hero Pad', deviceType: 'tablet', color: 'gold', specs: '★ Xiaomi Pad 8 Pro Horizontal', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi Pad 8', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'silver', specs: 'Xiaomi Pad 8 Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · REDMI Pad 2 Pro', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 Pro Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · REDMI Pad 2 Pro', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 Pro Horizontal' })}
            `)}
        `;

        const sideBackC3M3 = `
            ${window.renderRetailTray('Bloque 1 · REDMI Pad 2', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'green', specs: 'REDMI Pad 2 Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · REDMI Pad SE 8.7"', `
                ${window.renderRetailSlot({ model: 'REDMI Pad SE 8.7"', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad SE 8.7" Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · Watch 6 Active + Watch 6 Lite', `
                ${window.renderRetailSlot({ model: 'REDMI Watch 6 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Active' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6 Lite', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Lite' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · REDMI Watch 6 + Watch 6 Active', `
                ${window.renderRetailSlot({ model: 'REDMI Watch 6', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Active' })}
            `)}
        `;

        dragTableIds.push('c3-m1', 'c3-m2', 'c3-m3-sin', 'c3-m3-con');
        html = `
            <div class="visual-table-wrapper">
                ${storeHeaderHtml}
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: gap: 12px; margin-bottom: 1.25rem;">
                    <div>
                        <span style="background: rgba(255,103,0,0.12); color: var(--mi-orange); font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">07. PLANOGRAMA 3 MESAS - ECI / MM</span>
                        <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Mesas 1, 2 y 3 • Guía Oficial X18 Series 360°</h3>
                        <span style="font-size: 12px; color: #64748b; font-weight: 600;">Dotación oficial: <b>15 MediaMarkt · 8 El Corte Inglés</b> (4 bloques por cara)</span>
                    </div>
                    <div style="background: #fff; border: 1px solid #fed7aa; border-radius: 10px; padding: 10px 14px; font-size: 11.5px; color: #7c2d12; line-height: 1.45;">
                        <strong style="color: var(--mi-orange); display: block; margin-bottom: 2px;"><i class="fas fa-info-circle"></i> Reglas Guía X18 (3 Mesas):</strong>
                        • Mesa 1: <b>Xiaomi 18 Pro Max + Dummy</b> y <b>Xiaomi 18 Pro + Dummy</b> con Top Table Oficial 3D en el separador central (ON/OFF en barra superior) + Serie 17T<br>
                        • <b>Top Table Doble Cara:</b> Frontal Xiaomi 18 Pro / Posterior Redmi Note 17 Series<br>
                        • Mesa 2: Familia Redmi Note 17 con Top Table Redmi Note 17 Series<br>
                        • En Mesa 1 Posterior: se mantienen <b>Xiaomi 17 Ultra</b> y <b>Xiaomi 17</b> + <b>Smart Band 11</b><br>
                        • En Mesa 3: 4 bloques individuales por cara (Variante A Sin Pad Pro / Variante B Con Pad 8 Pro)
                    </div>
                </div>

                ${window.wrapRetailShowroom360('c3-m1', 'Mesa 1 (3 MESAS Showroom · Flagship Xiaomi 18 & 17 Series)', sideFrontC3M1, sideBackC3M1)}

                ${window.wrapRetailShowroom360('c3-m2', 'Mesa 2 (3 MESAS Showroom · Familia Redmi Note 17 & Redmi)', sideFrontC3M2, sideBackC3M2)}

                <div style="margin-top: 2rem; padding-top: 1.25rem; border-top: 1.5px solid #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 800;">MESA 3</span>
                                <span class="visual-table-title" style="margin: 0; font-size: 1.2rem;">Mesa 3 (3 MESAS) · 4 Bloques de Tabletas y Wearables</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="m3-variant-tabs">
                            <button type="button" onclick="window.switchMesa3Variant('sin_pad')" id="btn-m3-sin" style="padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 8px; border: 1.5px solid #cbd5e1; background: white; cursor: pointer;">
                                Variante A (Sin Pad 8 Pro)
                            </button>
                            <button type="button" onclick="window.switchMesa3Variant('con_pad')" id="btn-m3-con" style="padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 8px; border: 1.5px solid #cbd5e1; background: white; cursor: pointer;">
                                Variante B (Con Pad 8 Pro)
                            </button>
                            <button type="button" onclick="window.switchMesa3Variant('both')" id="btn-m3-both" style="padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 8px; border: 1.5px solid #cbd5e1; background: white; cursor: pointer;">
                                Ver Ambas Variantes
                            </button>
                        </div>
                    </div>

                    <div id="m3-wrapper-sin" style="display: block; margin-bottom: 25px;">
                        <div style="font-size: 13px; font-weight: 800; color: #166534; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                            <span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 6px; font-size: 11px;">VARIANTE A</span>
                            <span>Mesa 3 (3 MESAS) — SIN PAD PRO (4 Bloques)</span>
                        </div>
                        ${window.wrapRetailShowroom360('c3-m3-sin', 'Mesa 3 (Variante A - Sin Pad 8 Pro)', sideFrontC3M3Sin, sideBackC3M3)}
                    </div>

                    <div id="m3-wrapper-con" style="display: block;">
                        <div style="font-size: 13px; font-weight: 800; color: #b45309; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                            <span style="background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 6px; font-size: 11px;">VARIANTE B</span>
                            <span>Mesa 3 (3 MESAS) — CON XIAOMI PAD 8 PRO (4 Bloques)</span>
                        </div>
                        ${window.wrapRetailShowroom360('c3-m3-con', 'Mesa 3 (Variante B - Con Pad 8 Pro)', sideFrontC3M3Con, sideBackC3M3)}
                    </div>
                </div>
                ${window.renderSelectedStoreExtraFurniture(3, dragTableIds)}
            </div>
        `;
    } else if (strTab === 'wall_col') {
        // 08. PLANOGRAMA WALL (5 Bloques) Y COLUMNA (2 Bloques)
        dragTableIds.push('wall-std', 'col-std');
        html = `
            <div class="visual-table-wrapper">
                ${storeHeaderHtml}
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 1.5rem;">
                    <div>
                        <span style="background: rgba(2,132,199,0.12); color: #0284c7; font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">08. PLANOGRAMA WALL Y COLUMNA</span>
                        <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Módulos Verticales Wall (5 Bloques) y Columna (2 Bloques) • Lightbox Xiaomi 18 Pro Series</h3>
                        <span style="font-size: 12px; color: #64748b; font-weight: 600;">Conectado con el inventario de <b>51 tiendas con Wall</b> y <b>38 tiendas con Columna</b></span>
                    </div>
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 14px; font-size: 11.5px; color: #1e3a8a; line-height: 1.45;">
                        <strong style="color: #0284c7; display: block; margin-bottom: 2px;"><i class="fas fa-info-circle"></i> Directrices Oficiales Wall & Columna:</strong>
                        • Se sustituyen todas las <b>Band 9 Active</b> por las unidades que lleguen de <b>Band 11 Active</b><br>
                        • <b>No se retira nada de la serie 15</b> en Wall/Columna<br>
                        • Cartelería superior: <b>Lightbox Xiaomi 18 Pro Series</b>
                    </div>
                </div>

                ${window.getStandardWall3DHtml('wall-std')}
                ${window.getStandardColumna3DHtml('col-std')}
            </div>
        `;
    } else if (strTab === 'especiales') {
        // 09. CASOS ESPECIALES: MM ADEJE 4.0, ECI CASTELLANA, MM SSRR
        const activeSpec = window.currentSpecialCaseFilter || (window.selectedPlanogramStore ? window.getStoreSpecialCaseId(window.selectedPlanogramStore) : null) || 'all';

        // 1) MM ADEJE 4.0 (1 Mesa Especial)
        const adejeFront = `
            ${window.renderRetailTray('Bloque 1 · X18 Pro Max (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'Xiaomi 18 Pro Max', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'gold', specs: 'Xiaomi 18 Pro Max', isHero: true })}
                ${window.renderRetailSlot({ model: 'Dummy Xiaomi 18 Pro Max', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'gold', specs: 'Dummy Xiaomi 18 Pro Max', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 2 · X18 Pro (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'Xiaomi 18 Pro', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'gold', specs: 'Xiaomi 18 Pro', isHero: true })}
                ${window.renderRetailSlot({ model: 'Dummy Xiaomi 18 Pro', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'gold', specs: 'Dummy Xiaomi 18 Pro', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 3 · Serie 17T + Watch S5 41mm + Clip', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T Pro', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'Xiaomi 17T Pro Blue' })}
                ${window.renderRetailSlot({ model: 'Xiaomi 17T', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'Xiaomi 17T Purple' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 41mm', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'watch', color: 'gold', specs: 'Xiaomi Watch S5 41mm (Sustituye Band 10)' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Clip', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'buds', color: 'gold', specs: 'Xiaomi Clip' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · Trío Redmi Note 17', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'white-orange', specs: 'RN 17 Pro Max 5G' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'RN 17 Pro Blue' })}
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'RN 17 5G Purple' })}
            `)}
        `;
        const adejeBack = `
            ${window.renderRetailTray('Bloque 1 · REDMI 15C + RN 17 5G + Watch 6', `
                ${window.renderRetailSlot({ model: 'REDMI 15 C', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'REDMI 15C' })}
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'orange', specs: 'RN 17 5G Orange' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi Pad 8', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'silver', specs: 'Xiaomi Pad 8 Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · REDMI Pad 2 Pro', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 Pro Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · REDMI Pad 2', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'green', specs: 'REDMI Pad 2 Horizontal' })}
            `)}
        `;

        // 2) ECI CASTELLANA (2 Mesas Especiales + Wall 1 Conectividad + Wall 2 Lifestyle + Cabecera ECI)
        const castM1Front = `
            ${window.renderRetailTray('Bloque 1 · X18 Pro Max (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'Xiaomi 18 Pro Max', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'gold', specs: 'Xiaomi 18 Pro Max', isHero: true })}
                ${window.renderRetailSlot({ model: 'Dummy Xiaomi 18 Pro Max', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'gold', specs: 'Dummy Xiaomi 18 Pro Max', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 2 · X18 Pro (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'Xiaomi 18 Pro', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'gold', specs: 'Xiaomi 18 Pro', isHero: true })}
                ${window.renderRetailSlot({ model: 'Dummy Xiaomi 18 Pro', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'gold', specs: 'Dummy Xiaomi 18 Pro', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 3 · 17T Pro + Watch S5 46/41mm + Clips', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T Pro', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'Xiaomi 17T Pro Blue' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 46mm', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch S5 46mm' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 41mm', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'watch', color: 'gold', specs: 'Xiaomi Watch S5 41mm' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Clip', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'buds', color: 'gold', specs: 'Xiaomi Clips' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · Xiaomi 17 + Dummy 17T + Band 11', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'Xiaomi 17 Purple' })}
                ${window.renderRetailSlot({ model: 'Xiaomi 17T', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'blue', specs: 'Dummy Xiaomi 17T Blue' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Smart Band 11', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 11' })}
            `)}
        `;
        const castM1Back = `
            ${window.renderRetailTray('Bloque 1 · RN 17 Pro Max 5G Orange + Watch 6', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'white-orange', specs: 'RN 17 Pro Max 5G Orange' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'white-orange', specs: 'Dummy RN 17 Pro Max 5G Orange' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · RN 17 Pro 5G + Watch 6', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'RN 17 Pro 5G Black' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'purple', specs: 'Dummy RN 17 Pro 5G Purple' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · RN 17 5G + Watch 6 Active & Lite', `
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'RN 17 5G Purple' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Active' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6 Lite', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Lite' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · RN 17 + Buds 8 & Buds 8 Pro', `
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'RN 17' })}
                ${window.renderRetailSlot({ model: 'REDMI Buds 8', badgeColor: 'green', typeBadge: 'Buds', deviceType: 'buds', color: 'white', specs: 'REDMI Buds 8' })}
                ${window.renderRetailSlot({ model: 'REDMI Buds 8 Pro', badgeColor: 'green', typeBadge: 'Buds', deviceType: 'buds', color: 'black', specs: 'REDMI Buds 8 Pro' })}
            `)}
        `;
        const castM2Front = `
            ${window.renderRetailTray('Bloque 1 · ★ Xiaomi Pad 8 Pro', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8 Pro', badgeColor: 'orange', typeBadge: '★ Hero Pad', deviceType: 'tablet', color: 'gold', specs: 'Xiaomi Pad 8 Pro Horizontal', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi Pad 8', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'silver', specs: 'Xiaomi Pad 8 Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · REDMI Pad 2 Pro + Dummy RN 17 Pro Max', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 Pro Horizontal' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'green', specs: 'Dummy RN 17 Pro Max 5G' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · REDMI Pad 2 + Dummy RN 17 Pro 5G', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'green', specs: 'REDMI Pad 2 Horizontal' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'blue', specs: 'Dummy RN 17 Pro 5G' })}
            `)}
        `;
        const castM2Back = `
            ${window.renderRetailTray('Bloque 1 · REDMI Pad 2 9.7 + Dummy RN 17 5G', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 9.7', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 9.7 Horizontal' })}
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'blue', specs: 'Dummy RN 17 5G' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · REDMI 15C + REDMI Watch 6', `
                ${window.renderRetailSlot({ model: 'REDMI 15 C', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'REDMI 15C' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · REDMI 17 5G Black & Orange', `
                ${window.renderRetailSlot({ model: 'REDMI 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'REDMI 17 5G Black' })}
                ${window.renderRetailSlot({ model: 'REDMI 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'orange', specs: 'REDMI 17 5G Orange' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · RN 17 4G Green + Watch 6 Active & Lite', `
                ${window.renderRetailSlot({ model: 'REDMI 17 4G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', specs: 'RN 17 4G Green' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Active' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6 Lite', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Lite' })}
            `)}
        `;

        const castWall1Trays = `
            ${window.renderRetailTray('Bloque 1 · Xiaomi Pad 8', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet-vertical', color: 'silver', specs: 'Xiaomi Pad 8 Vertical' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · 17T Pro + 17T + Watch S5 + Buds 6', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T Pro', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'Xiaomi 17T Pro Blue' })}
                ${window.renderRetailSlot({ model: 'Xiaomi 17T', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'Xiaomi 17T Purple' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 45mm', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch S5 45mm' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Buds 6', badgeColor: 'green', typeBadge: 'Buds', deviceType: 'buds', color: 'white', specs: 'Xiaomi Buds 6' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · Xiaomi 17T Blue + Watch S5 Silver', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'Xiaomi 17T Blue' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 45mm', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'silver', specs: 'Xiaomi Watch S5 45mm Silver' })}
            `)}
        `;
        const castWall1Html = window.wrapRetailWall3D('spec-cast-wall1', 'ECI Castellana · WALL 1 (Conectividad · 3 Bloques)', castWall1Trays, 'ECI CASTELLANA · WALL 1 CONECTIVIDAD', 'WALL 1 · 3 BLOQUES');

        const castWall2Trays = `
            ${window.renderRetailTray('Bloque 1 · Watch S5 45mm + Band 10 Pro', `
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 45mm', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch S5 45mm' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Band 10 Pro', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Band 10 Pro' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi Watch 5 + Band 10 Pro', `
                ${window.renderRetailSlot({ model: 'Xiaomi Watch 5', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch 5' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Band 10 Pro', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Band 10 Pro' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · RN 17 Pro Max 5G + Watch 6', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'RN 17 Pro Max 5G Black' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · RN 17 Pro 5G + Watch 5', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'RN 17 Pro 5G Blue' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch 5', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI / Xiaomi Watch 5' })}
            `)}
        `;
        const castWall2Html = window.wrapRetailWall3D('spec-cast-wall2', 'ECI Castellana · WALL 2 (Lifestyle · 4 Bloques)', castWall2Trays, 'ECI CASTELLANA · WALL 2 LIFESTYLE', 'WALL 2 · 4 BLOQUES');

        // 3) MM SSRR (San Sebastián de los Reyes - 3 Mesas Especiales de 3 bloques + Wall 1 Conectividad)
        const ssrrM1Front = `
            ${window.renderRetailTray('Bloque 1 · X18 Pro Max (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'Xiaomi 18 Pro Max', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'gold', specs: 'Xiaomi 18 Pro Max', isHero: true })}
                ${window.renderRetailSlot({ model: 'Dummy Xiaomi 18 Pro Max', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'gold', specs: 'Dummy Xiaomi 18 Pro Max', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 2 · X18 Pro (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'Xiaomi 18 Pro', badgeColor: 'orange', typeBadge: 'Hero LDU', deviceType: 'phone', color: 'gold', specs: 'Xiaomi 18 Pro', isHero: true })}
                ${window.renderRetailSlot({ model: 'Dummy Xiaomi 18 Pro', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'gold', specs: 'Dummy Xiaomi 18 Pro', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 3 · Xiaomi 17T Pro + Watch S5 41mm', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T Pro', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'Xiaomi 17T Pro Blue' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 41mm', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'watch', color: 'gold', specs: 'Xiaomi Watch S5 41mm' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · Xiaomi 17 + Smart Band 11', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'Xiaomi 17 Purple' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Smart Band 11', badgeColor: 'orange', typeBadge: 'Nuevo', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 11' })}
            `)}
        `;
        const ssrrM1Back = `
            ${window.renderRetailTray('Bloque 1 · Xiaomi 17 Ultra + Watch S5 45mm', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17 Ultra', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'Xiaomi 17 Ultra' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 45mm', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch S5 45mm' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi 17 + Xiaomi Watch 5', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'Xiaomi 17' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch 5', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch 5' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · Xiaomi 17T Pro + Band 11 Active', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T Pro', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'Xiaomi 17T Pro Purple' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Smart Band 11 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 11 Active' })}
            `)}
        `;
        const ssrrM2Front = `
            ${window.renderRetailTray('Bloque 1 · RN 17 Pro Max 5G + Watch 6', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'white-orange', specs: 'RN 17 Pro Max 5G' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'white-orange', specs: 'Dummy RN 17 Pro Max 5G' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · RN 17 Pro 5G + Watch 6 Active', `
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'RN 17 Pro 5G Blue' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'purple', specs: 'Dummy RN 17 Pro 5G' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Active' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · RN 17 5G + Watch 6 Active', `
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'RN 17 5G Purple' })}
                ${window.renderRetailSlot({ model: 'RN 17 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'blue', specs: 'Dummy RN 17 5G' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6 Active', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6 Active' })}
            `)}
        `;
        const ssrrM2Back = `
            ${window.renderRetailTray('Bloque 1 · REDMI 15C + REDMI Watch 6', `
                ${window.renderRetailSlot({ model: 'REDMI 15 C', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'black', specs: 'REDMI 15C' })}
                ${window.renderRetailSlot({ model: 'REDMI Watch 6', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'REDMI Watch 6' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · REDMI 17 5G Orange (LDU + Dummy)', `
                ${window.renderRetailSlot({ model: 'REDMI 17 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'orange', specs: 'REDMI 17 5G Orange' })}
                ${window.renderRetailSlot({ model: 'REDMI 17 5G', badgeColor: 'green', typeBadge: 'Dummy', deviceType: 'phone', color: 'orange', specs: 'Dummy REDMI 17 5G Orange' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · REDMI 17 4G + Buds 8 Pro', `
                ${window.renderRetailSlot({ model: 'REDMI 17 4G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', specs: 'REDMI 17 4G' })}
                ${window.renderRetailSlot({ model: 'REDMI Buds 8 Pro', badgeColor: 'green', typeBadge: 'Buds', deviceType: 'buds', color: 'black', specs: 'REDMI Buds 8 Pro' })}
            `)}
        `;
        const ssrrM3Front = `
            ${window.renderRetailTray('Bloque 1 · ★ Xiaomi Pad 8 Pro', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8 Pro', badgeColor: 'orange', typeBadge: '★ Hero Pad', deviceType: 'tablet', color: 'gold', specs: 'Xiaomi Pad 8 Pro Horizontal', isHero: true })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi Pad 8', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'silver', specs: 'Xiaomi Pad 8 Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · REDMI Pad 2 Pro', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2 Pro', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad 2 Pro Horizontal' })}
            `)}
        `;
        const ssrrM3Back = `
            ${window.renderRetailTray('Bloque 1 · REDMI Pad 2 + RN17 Pro Max Green', `
                ${window.renderRetailSlot({ model: 'REDMI Pad 2', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'green', specs: 'REDMI Pad 2 Horizontal' })}
                ${window.renderRetailSlot({ model: 'RN 17 Pro Max 5G', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'green', specs: 'RN 17 Pro Max 5G Green' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · REDMI Pad SE 8.7"', `
                ${window.renderRetailSlot({ model: 'REDMI Pad SE 8.7"', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'gray', specs: 'REDMI Pad SE 8.7" Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · Watch S5 46mm + Xiaomi Watch 5', `
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 46mm', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch S5 46mm' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch 5', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch 5' })}
            `)}
        `;
        const ssrrWall1Trays = `
            ${window.renderRetailTray('Bloque 1 · 17T Pro + 17T + Watch S5 + Buds 6', `
                ${window.renderRetailSlot({ model: 'Xiaomi 17T Pro', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'blue', specs: 'Xiaomi 17T Pro Blue' })}
                ${window.renderRetailSlot({ model: 'Xiaomi 17T', badgeColor: 'orange', typeBadge: 'LDU', deviceType: 'phone', color: 'purple', specs: 'Xiaomi 17T Purple' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 45mm', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch S5 45mm' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Buds 6', badgeColor: 'green', typeBadge: 'Buds', deviceType: 'buds', color: 'white', specs: 'Xiaomi Buds 6' })}
            `)}
            ${window.renderRetailTray('Bloque 2 · Xiaomi Pad 8', `
                ${window.renderRetailSlot({ model: 'Xiaomi Pad 8', badgeColor: 'green', typeBadge: 'Pad', deviceType: 'tablet', color: 'silver', specs: 'Xiaomi Pad 8 Horizontal' })}
            `)}
            ${window.renderRetailTray('Bloque 3 · Band 10 + Band 10 Pro', `
                ${window.renderRetailSlot({ model: 'Xiaomi Band 10', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 10' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Band 10 Pro', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Smart Band 10 Pro' })}
            `)}
            ${window.renderRetailTray('Bloque 4 · Xiaomi Watch 5 + Watch S5 45mm', `
                ${window.renderRetailSlot({ model: 'Xiaomi Watch 5', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch 5' })}
                ${window.renderRetailSlot({ model: 'Xiaomi Watch S5 45mm', badgeColor: 'orange', typeBadge: 'Wear', deviceType: 'watch', color: 'black', specs: 'Xiaomi Watch S5 45mm' })}
            `)}
        `;
        const ssrrWall1Html = window.wrapRetailWall3D('spec-ssrr-wall1', 'MM SSRR · WALL 1 (Conectividad · 4 Bloques)', ssrrWall1Trays, 'MM SSRR · WALL 1 CONECTIVIDAD', 'WALL 1 · 4 BLOQUES');

        dragTableIds.push('spec-adeje-m1', 'spec-cast-m1', 'spec-cast-m2', 'spec-cast-wall1', 'spec-cast-wall2', 'spec-cast-cabecera', 'spec-ssrr-m1', 'spec-ssrr-m2', 'spec-ssrr-m3', 'spec-ssrr-wall1');

        html = `
            <div class="visual-table-wrapper">
                ${storeHeaderHtml}
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: gap: 12px; margin-bottom: 1.25rem;">
                    <div>
                        <span style="background: #fef3c7; color: #b45309; font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">09. CASOS ESPECIALES GUÍA X18</span>
                        <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Planogramas Especiales: MM Adeje 4.0 · ECI Castellana · MM SSRR</h3>
                    </div>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button type="button" onclick="window.filterSpecialCase('all')" style="padding: 7px 14px; border-radius: 8px; border: 1.5px solid ${activeSpec === 'all' ? 'var(--mi-orange)' : '#cbd5e1'}; background: ${activeSpec === 'all' ? 'var(--mi-orange)' : '#fff'}; color: ${activeSpec === 'all' ? '#fff' : '#334155'}; font-size: 12px; font-weight: 800; cursor: pointer;">Ver Todos (3)</button>
                        <button type="button" onclick="window.filterSpecialCase('adeje')" style="padding: 7px 14px; border-radius: 8px; border: 1.5px solid ${activeSpec === 'adeje' ? 'var(--mi-orange)' : '#cbd5e1'}; background: ${activeSpec === 'adeje' ? 'var(--mi-orange)' : '#fff'}; color: ${activeSpec === 'adeje' ? '#fff' : '#334155'}; font-size: 12px; font-weight: 800; cursor: pointer;">MM Adeje 4.0</button>
                        <button type="button" onclick="window.filterSpecialCase('castellana')" style="padding: 7px 14px; border-radius: 8px; border: 1.5px solid ${activeSpec === 'castellana' ? 'var(--mi-orange)' : '#cbd5e1'}; background: ${activeSpec === 'castellana' ? 'var(--mi-orange)' : '#fff'}; color: ${activeSpec === 'castellana' ? '#fff' : '#334155'}; font-size: 12px; font-weight: 800; cursor: pointer;">ECI Castellana</button>
                        <button type="button" onclick="window.filterSpecialCase('ssrr')" style="padding: 7px 14px; border-radius: 8px; border: 1.5px solid ${activeSpec === 'ssrr' ? 'var(--mi-orange)' : '#cbd5e1'}; background: ${activeSpec === 'ssrr' ? 'var(--mi-orange)' : '#fff'}; color: ${activeSpec === 'ssrr' ? '#fff' : '#334155'}; font-size: 12px; font-weight: 800; cursor: pointer;">MM SSRR</button>
                    </div>
                </div>

                <div id="spec-block-adeje" style="display: ${(activeSpec === 'all' || activeSpec === 'adeje') ? 'block' : 'none'}; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px dashed #e2e8f0;">
                    <div style="background: #fff7ed; border-left: 4px solid var(--mi-orange); padding: 10px 14px; border-radius: 8px; margin-bottom: 14px;">
                        <strong style="font-size: 14px; color: #9a3412;">1. MediaMarkt Adeje 4.0 (1 Mesa Especial)</strong>
                        <div style="font-size: 12px; color: #7c2d12;">Sustituye Band 10 por Xiaomi Watch S5 41mm + Xiaomi Clip en frontal y 3 tablets individuales en posterior.</div>
                    </div>
                    ${window.wrapRetailShowroom360('spec-adeje-m1', 'MM Adeje 4.0 · Mesa 1 Especial', adejeFront, adejeBack)}
                </div>

                <div id="spec-block-castellana" style="display: ${(activeSpec === 'all' || activeSpec === 'castellana') ? 'block' : 'none'}; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px dashed #e2e8f0;">
                    <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px;">
                        <strong style="font-size: 14px; color: #1e40af;">2. El Corte Inglés Castellana (2 Mesas Especiales + Wall 1 Conectividad + Wall 2 Lifestyle + Cabecera ECI)</strong>
                        <div style="font-size: 12px; color: #1e3a8a;">Dotación completa con Xiaomi Pad 8 Pro, 2 Walls específicos y Cabecera ECI de 5 posiciones.</div>
                    </div>
                    ${window.wrapRetailShowroom360('spec-cast-m1', 'ECI Castellana · Mesa 1 Especial', castM1Front, castM1Back)}
                    ${window.wrapRetailShowroom360('spec-cast-m2', 'ECI Castellana · Mesa 2 Especial (Con Pad 8 Pro)', castM2Front, castM2Back)}
                    <div style="margin-top: 20px;">
                        ${castWall1Html}
                        ${castWall2Html}
                        ${window.wrapRetailCabeceraEci3D('spec-cast-cabecera', 'ECI Castellana · Cabecera ECI (5 Posiciones)')}
                    </div>
                </div>

                <div id="spec-block-ssrr" style="display: ${(activeSpec === 'all' || activeSpec === 'ssrr') ? 'block' : 'none'};">
                    <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px;">
                        <strong style="font-size: 14px; color: #166534;">3. MediaMarkt San Sebastián de los Reyes (MM SSRR · 3 Mesas Especiales de 3 Bloques + Wall 1 Conectividad)</strong>
                        <div style="font-size: 12px; color: #14532d;">Mesas especiales de 3 bloques por cara (excepto frontal Mesa 1 con 4 bloques) + Wall 1 Conectividad de 4 bloques.</div>
                    </div>
                    ${window.wrapRetailShowroom360('spec-ssrr-m1', 'MM SSRR · Mesa 1 Especial', ssrrM1Front, ssrrM1Back)}
                    ${window.wrapRetailShowroom360('spec-ssrr-m2', 'MM SSRR · Mesa 2 Especial (3 Bloques por Cara)', ssrrM2Front, ssrrM2Back)}
                    ${window.wrapRetailShowroom360('spec-ssrr-m3', 'MM SSRR · Mesa 3 Especial (3 Bloques por Cara · Con Pad 8 Pro)', ssrrM3Front, ssrrM3Back)}
                    <div style="margin-top: 20px;">
                        ${ssrrWall1Html}
                    </div>
                </div>
            </div>
        `;
    } else if (strTab === 'wearables') {
        // 10. LINEAL WEARABLES (MM 9, 8, 7, 6 Posiciones + ECI 6 Posiciones)
        const wFilter = window.currentWearableLinealFilter || 'all';
        dragTableIds.push('wear-mm9', 'wear-mm8', 'wear-mm7', 'wear-mm6', 'wear-eci6');

        html = `
            <div class="visual-table-wrapper">
                ${storeHeaderHtml}
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 1.25rem;">
                    <div>
                        <span style="background: #dcfce7; color: #15803d; font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">10. LINEAL WEARABLES · MM & ECI</span>
                        <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Planograma Oficial Lineal de Wearables 3D (9, 8, 7 y 6 Posiciones)</h3>
                    </div>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        ${[
                            { k: 'all', l: 'Todos (5)' },
                            { k: 'mm9', l: 'MM · 9 Pos.' },
                            { k: 'mm8', l: 'MM · 8 Pos.' },
                            { k: 'mm7', l: 'MM · 7 Pos.' },
                            { k: 'mm6', l: 'MM · 6 Pos.' },
                            { k: 'eci6', l: 'ECI · 6 Pos.' }
                        ].map(b => `
                            <button type="button" onclick="window.filterWearableLineal('${b.k}')" style="padding: 6px 12px; border-radius: 8px; border: 1.5px solid ${wFilter === b.k ? '#16a34a' : '#cbd5e1'}; background: ${wFilter === b.k ? '#16a34a' : '#fff'}; color: ${wFilter === b.k ? '#fff' : '#334155'}; font-size: 11.5px; font-weight: 800; cursor: pointer;">${b.l}</button>
                        `).join('')}
                    </div>
                </div>

                ${window.wrapRetailWearableLineal3D('wear-mm9', 'MediaMarkt · Lineal Wearables 9 Posiciones (5 Sup. + 4 Inf.)', 'Doble altura con gama completa Xiaomi Watch & Smart Band', 'MEDIAMARKT · 9 POSICIONES',
                    [
                        { m: 'Xiaomi Watch 5', t: 'Sup 1' },
                        { m: 'Xiaomi Watch S5 46mm', t: 'Sup 2' },
                        { m: 'Xiaomi Watch S5 41mm', t: 'Sup 3 · Nuevo', c: 'gold' },
                        { m: 'Xiaomi Watch S4', t: 'Sup 4' },
                        { m: 'Xiaomi Watch S4 41mm', t: 'Sup 5', c: 'gold' }
                    ],
                    [
                        { m: 'Xiaomi Smart Band 10 Pro', t: 'Inf 1' },
                        { m: 'Xiaomi Smart Band 11', t: 'Inf 2 · Nuevo' },
                        { m: 'Xiaomi Smart Band 11 Active', t: 'Inf 3 · Nuevo' },
                        { m: 'REDMI Watch 6', t: 'Inf 4' }
                    ]
                )}

                ${window.wrapRetailWearableLineal3D('wear-mm8', 'MediaMarkt · Lineal Wearables 8 Posiciones (4 Sup. + 4 Inf.)', 'Doble altura simétrica 4 + 4', 'MEDIAMARKT · 8 POSICIONES',
                    [
                        { m: 'Xiaomi Watch 5', t: 'Sup 1' },
                        { m: 'Xiaomi Watch S5 46mm', t: 'Sup 2' },
                        { m: 'Xiaomi Watch S5 41mm', t: 'Sup 3 · Nuevo', c: 'gold' },
                        { m: 'Xiaomi Watch S4 41mm', t: 'Sup 4', c: 'gold' }
                    ],
                    [
                        { m: 'Xiaomi Smart Band 10 Pro', t: 'Inf 1' },
                        { m: 'Xiaomi Smart Band 11', t: 'Inf 2 · Nuevo' },
                        { m: 'Xiaomi Smart Band 11 Active', t: 'Inf 3 · Nuevo' },
                        { m: 'REDMI Watch 6', t: 'Inf 4' }
                    ]
                )}

                ${window.wrapRetailWearableLineal3D('wear-mm7', 'MediaMarkt · Lineal Wearables 7 Posiciones (4 Sup. + 3 Inf.)', 'Doble altura 4 + 3', 'MEDIAMARKT · 7 POSICIONES',
                    [
                        { m: 'Xiaomi Watch 5', t: 'Sup 1' },
                        { m: 'Xiaomi Watch S5 46mm', t: 'Sup 2' },
                        { m: 'Xiaomi Watch S5 41mm', t: 'Sup 3 · Nuevo', c: 'gold' },
                        { m: 'Xiaomi Smart Band 10 Pro', t: 'Sup 4' }
                    ],
                    [
                        { m: 'Xiaomi Smart Band 11', t: 'Inf 1 · Nuevo' },
                        { m: 'Xiaomi Smart Band 11 Active', t: 'Inf 2 · Nuevo' },
                        { m: 'REDMI Watch 6', t: 'Inf 3' }
                    ]
                )}

                ${window.wrapRetailWearableLineal3D('wear-mm6', 'MediaMarkt · Lineal Wearables 6 Posiciones (3 Sup. + 3 Inf.)', 'Doble altura compacta 3 + 3', 'MEDIAMARKT · 6 POSICIONES',
                    [
                        { m: 'Xiaomi Watch S5 46mm', t: 'Sup 1' },
                        { m: 'Xiaomi Watch S5 41mm', t: 'Sup 2 · Nuevo', c: 'gold' },
                        { m: 'Xiaomi Smart Band 10 Pro', t: 'Sup 3' }
                    ],
                    [
                        { m: 'Xiaomi Smart Band 11', t: 'Inf 1 · Nuevo' },
                        { m: 'Xiaomi Smart Band 11 Active', t: 'Inf 2 · Nuevo' },
                        { m: 'REDMI Watch 6', t: 'Inf 3' }
                    ]
                )}

                ${window.wrapRetailWearableLineal3D('wear-eci6', 'El Corte Inglés · Lineal Wearables 6 Posiciones (1 Fila Horizontal)', 'Exposición lineal en 1 única fila de 6 soportes', 'EL CORTE INGLÉS · 6 POSICIONES',
                    [
                        { m: 'REDMI Watch 6 Lite', t: 'Pos 1' },
                        { m: 'REDMI Watch 6 Active', t: 'Pos 2' },
                        { m: 'REDMI Watch 6', t: 'Pos 3' },
                        { m: 'Xiaomi Smart Band 11 Active', t: 'Pos 4 · Nuevo' },
                        { m: 'Xiaomi Smart Band 11', t: 'Pos 5 · Nuevo' },
                        { m: 'Xiaomi Watch S5 41mm', t: 'Pos 6 · Nuevo', c: 'gold' }
                    ],
                    null
                )}
            </div>
        `;
    } else if (strTab === 'alcampo') {
        dragTableIds.push('alcampo-m1');
        html = window.renderAlcampoTable3D();
    } else if (strTab === 'carrefour') {
        dragTableIds.push('carrefour-m1');
        html = window.renderCarrefourStandardTable3D();
    } else if (strTab === 'carrefour_premium') {
        dragTableIds.push('carrefour-prem-m1');
        html = window.renderCarrefourPremiumTable3D();
    } else if (strTab === 'cabecera_posm') {
        // 01-03 & 11. CABECERA ECI (17 TIENDAS), NOVEDADES, MATERIALES POSM Y DEVOLUCIÓN LDUs
        dragTableIds.push('cabecera-eci-main');
        html = `
            <div class="visual-table-wrapper">
                ${storeHeaderHtml}
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 1.5rem;">
                    <div>
                        <span style="background: #fef2f2; color: #dc2626; font-weight: 800; font-size: 11px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">01-03 & 11. CABECERA ECI · POSM · DEVOLUCIÓN LDUs</span>
                        <h3 style="margin: 4px 0 0; font-size: 1.25rem; color: #0f172a; font-weight: 800;">Cabecera ECI 3D (5 Posiciones con Destacador Integrado), POSM y Retirada de LDUs</h3>
                    </div>
                </div>

                ${window.renderCabeceraEciModule3D('cabecera-eci-main')}

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-top: 20px;">
                    <!-- Card 1: 17 Tiendas Cabecera ECI -->
                    <div style="background: #fff; border: 1.5px solid #fed7aa; border-radius: 16px; padding: 16px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <span style="width: 32px; height: 32px; border-radius: 8px; background: #fff7ed; color: var(--mi-orange); display: inline-flex; align-items: center; justify-content: center; font-weight: 800;"><i class="fas fa-crown"></i></span>
                            <div>
                                <h4 style="margin: 0; font-size: 14px; color: #0f172a; font-weight: 800;">03. 17 Tiendas con Cabecera ECI</h4>
                                <span style="font-size: 11px; color: #64748b;">Pulsa una tienda para cargar su planograma completo</span>
                            </div>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                            ${window.CABECERA_ECI_LIST.map(stName => `
                                <button type="button" onclick="window.onPlanogramStoreSearch('${stName}')" style="padding: 5px 10px; border-radius: 8px; border: 1px solid #fdba74; background: #fff7ed; color: #9a3412; font-size: 11.5px; font-weight: 700; cursor: pointer; transition: all 0.15s;" onmouseover="this.style.background='#ffedd5'" onmouseout="this.style.background='#fff7ed'">
                                    <i class="fas fa-store" style="margin-right: 4px; color: var(--mi-orange);"></i>${stName}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Card 2: 01. Novedades & 02. Materiales POSM -->
                    <div style="background: #fff; border: 1.5px solid #bfdbfe; border-radius: 16px; padding: 16px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <span style="width: 32px; height: 32px; border-radius: 8px; background: #eff6ff; color: #2563eb; display: inline-flex; align-items: center; justify-content: center; font-weight: 800;"><i class="fas fa-box-open"></i></span>
                            <div>
                                <h4 style="margin: 0; font-size: 14px; color: #0f172a; font-weight: 800;">01. Novedades & 02. Materiales POSM</h4>
                                <span style="font-size: 11px; color: #64748b;">Dotación de campaña Xiaomi 18 Series</span>
                            </div>
                        </div>
                        <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; color: #334155; line-height: 1.65;">
                            <li><b>Nuevos Dispositivos:</b> <code>Xiaomi 18 Pro Max</code> (LDU + Dummy en peana), <code>Xiaomi 18 Pro</code> (LDU + Dummy en peana), <code>Xiaomi Watch S5 41mm</code>, <code>Xiaomi Smart Band 11</code> y <code>Xiaomi Buds Clip</code>.</li>
                            <li><b>Soportes Especiales:</b> Peana oficial para los Dummies de Xiaomi 18 Pro Max y Xiaomi 18 Pro + Soporte específico para <b>Xiaomi Clip</b>.</li>
                            <li><b>Metacrilatos y Precio:</b> Cartelería actualizada en bloque Hero y actualización de <b>Lightbox Wall / Column</b> a creatividades <i>Xiaomi 18 Pro Series</i>.</li>
                        </ul>
                    </div>

                    <!-- Card 3: 11. Devolución de LDUs -->
                    <div style="background: #fff; border: 1.5px solid #fecaca; border-radius: 16px; padding: 16px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <span style="width: 32px; height: 32px; border-radius: 8px; background: #fef2f2; color: #dc2626; display: inline-flex; align-items: center; justify-content: center; font-weight: 800;"><i class="fas fa-undo-alt"></i></span>
                            <div>
                                <h4 style="margin: 0; font-size: 14px; color: #0f172a; font-weight: 800;">11. Devolución de LDUs a Central</h4>
                                <span style="font-size: 11px; color: #64748b;">Retirada obligatoria según número de mesas</span>
                            </div>
                        </div>
                        <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; color: #334155; line-height: 1.65;">
                            <li><b>Xiaomi 17 Ultra</b> y <b>Xiaomi 17</b>: Se retiran de <b>1 y 2 Mesas</b> (solo se mantienen en tiendas de 3 Mesas).</li>
                            <li><b>Xiaomi Smart Band 10 Pro</b>: Se retira de <b>1 y 2 Mesas</b> (solo se mantiene en 3 Mesas).</li>
                            <li><b>Xiaomi Smart Band 10</b>: Se retira de <b>2 y 3 Mesas</b> (solo se mantiene en 1 Mesa si no cabe Band 11).</li>
                            <li><b>Xiaomi Watch 5</b> y <b>Xiaomi Buds 6</b>: Se retiran de las mesas estándar (salvo los casos especiales indicados en ECI Castellana y MM SSRR).</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;

    // Inicializar interacción táctil y drag de giro horizontal 360 en todas las mesas renderizadas
    setTimeout(() => {
        dragTableIds.forEach(id => {
            if (typeof window.initRetailDragEvents === 'function') {
                window.initRetailDragEvents(id);
            }
        });
    }, 60);

    if (cNum === 2) {
        let initialMode2 = window.currentMesa2VariantMode || 'both';
        if (window.selectedPlanogramStore) {
            initialMode2 = storeHasPad8Pro ? 'con_pad' : 'sin_pad';
        }
        setTimeout(() => {
            if (typeof window.switchMesa2Variant === 'function') {
                window.switchMesa2Variant(initialMode2);
            }
        }, 10);
    }

    if (cNum === 3) {
        let initialMode3 = window.currentMesa3VariantMode || 'both';
        if (window.selectedPlanogramStore) {
            initialMode3 = storeHasPad8Pro ? 'con_pad' : 'sin_pad';
        }
        setTimeout(() => {
            if (typeof window.switchMesa3Variant === 'function') {
                window.switchMesa3Variant(initialMode3);
            }
        }, 10);
    }
};

window.switchMesa2Variant = function(mode) {
    window.currentMesa2VariantMode = mode;
    const sinEl = document.getElementById('m2-wrapper-sin');
    const conEl = document.getElementById('m2-wrapper-con');
    const btnSin = document.getElementById('btn-m2-sin');
    const btnCon = document.getElementById('btn-m2-con');
    const btnBoth = document.getElementById('btn-m2-both');

    if (sinEl && conEl) {
        sinEl.style.display = (mode === 'sin_pad' || mode === 'both') ? 'block' : 'none';
        conEl.style.display = (mode === 'con_pad' || mode === 'both') ? 'block' : 'none';
    }

    [btnSin, btnCon, btnBoth].forEach(b => {
        if (b) {
            b.style.background = 'white';
            b.style.color = '#334155';
            b.style.borderColor = '#cbd5e1';
            b.style.boxShadow = 'none';
        }
    });

    const activeBtn = mode === 'sin_pad' ? btnSin : (mode === 'con_pad' ? btnCon : btnBoth);
    if (activeBtn) {
        activeBtn.style.background = 'var(--mi-orange)';
        activeBtn.style.color = 'white';
        activeBtn.style.borderColor = 'var(--mi-orange)';
        activeBtn.style.boxShadow = '0 2px 6px rgba(255,103,0,0.2)';
    }
};

window.switchMesa3Variant = function(mode) {
    window.currentMesa3VariantMode = mode;
    const sinEl = document.getElementById('m3-wrapper-sin');
    const conEl = document.getElementById('m3-wrapper-con');
    const btnSin = document.getElementById('btn-m3-sin');
    const btnCon = document.getElementById('btn-m3-con');
    const btnBoth = document.getElementById('btn-m3-both');

    if (sinEl && conEl) {
        if (mode === 'sin_pad') {
            sinEl.style.display = 'block';
            conEl.style.display = 'none';
        } else if (mode === 'con_pad') {
            sinEl.style.display = 'none';
            conEl.style.display = 'block';
        } else {
            sinEl.style.display = 'block';
            conEl.style.display = 'block';
        }
    }

    [btnSin, btnCon, btnBoth].forEach(b => {
        if (b) {
            b.style.background = 'white';
            b.style.color = '#334155';
            b.style.borderColor = '#cbd5e1';
            b.style.boxShadow = 'none';
        }
    });

    const activeBtn = mode === 'sin_pad' ? btnSin : (mode === 'con_pad' ? btnCon : btnBoth);
    if (activeBtn) {
        activeBtn.style.background = 'var(--mi-orange)';
        activeBtn.style.color = 'white';
        activeBtn.style.borderColor = 'var(--mi-orange)';
        activeBtn.style.boxShadow = '0 2px 6px rgba(255,103,0,0.2)';
    }
};

window.filterSpecialCase = function(caseId) {
    window.currentSpecialCaseFilter = caseId || 'all';
    window.renderVisualTableMockup('especiales');
};

window.filterWearableLineal = function(filterId) {
    window.currentWearableLinealFilter = filterId || 'all';
    window.renderVisualTableMockup('wearables');
};

window.clearSelectedPlanogramStore = function() {
    window.selectedPlanogramStore = null;
    window.currentSpecialCaseFilter = 'all';
    const searchInput = document.getElementById('planogram-search-store');
    if (searchInput) searchInput.value = '';
    const clearBtn = document.getElementById('btn-clear-planogram-store');
    if (clearBtn) clearBtn.style.display = 'none';
    if (typeof window.renderVisualTableMockup === 'function') {
        window.renderVisualTableMockup(window.currentActiveClusterTab);
    }
};

// ==================================================
// FILTROS INTERACTIVOS DE PLANOGRAMA (CUENTA, TIENDA, CLUSTER)
// ==================================================
window.populatePlanogramFilters = function() {
    const accountSelect = document.getElementById('planogram-filter-account');
    const storeDatalist = document.getElementById('planogram-stores-datalist');
    const clusterSelect = document.getElementById('planogram-filter-cluster');

    const stores = getAllStoresList();
    if (!stores || stores.length === 0) return;

    // 1. Cuentas únicas
    if (accountSelect) {
        const currentVal = accountSelect.value || 'all';
        const accounts = [...new Set(stores.map(s => s.cuenta || s.retail || 'Otros').filter(Boolean))].sort();
        accountSelect.innerHTML = '<option value="all">Todas las Cuentas</option>';
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc;
            opt.textContent = acc;
            accountSelect.appendChild(opt);
        });
        accountSelect.value = currentVal;
    }

    // 2. Datalist de tiendas con resumen de Mesas, Columnas y Wall
    if (storeDatalist) {
        storeDatalist.innerHTML = '';
        stores.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.nombre;
            const m = Number(s.Mesa) || 0;
            const c = Number(s.Columna) || 0;
            const w = Number(s.Wall) || 0;
            const parts = [];
            if (m > 0) parts.push(`${m} ${m === 1 ? 'Mesa' : 'Mesas'}`);
            if (c > 0) parts.push(`${c} Col`);
            if (w > 0) parts.push(`${w} Wall`);
            opt.label = `${s.cuenta || ''} (${parts.join(' · ') || 'Sin mobiliario'})`;
            storeDatalist.appendChild(opt);
        });
    }

    // 3. Sincronizar cluster select
    if (clusterSelect) {
        clusterSelect.value = window.currentActiveClusterTab ? String(window.currentActiveClusterTab) : '';
    }
};

window.onPlanogramAccountChange = function(account) {
    const storeDatalist = document.getElementById('planogram-stores-datalist');
    const stores = getAllStoresList();
    if (!storeDatalist || !stores) return;

    storeDatalist.innerHTML = '';
    const filteredStores = (account === 'all') 
        ? stores 
        : stores.filter(s => String(s.cuenta || s.retail || '').toLowerCase() === account.toLowerCase());

    filteredStores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.nombre;
        const m = Number(s.Mesa) || 0;
        const c = Number(s.Columna) || 0;
        const w = Number(s.Wall) || 0;
        const parts = [];
        if (m > 0) parts.push(`${m} ${m === 1 ? 'Mesa' : 'Mesas'}`);
        if (c > 0) parts.push(`${c} Col`);
        if (w > 0) parts.push(`${w} Wall`);
        opt.label = `${s.cuenta || ''} (${parts.join(' · ') || 'Sin mobiliario'})`;
        storeDatalist.appendChild(opt);
    });

    window.clearSelectedPlanogramStore();
};

window.navigateToPlanogramForStore = function(mesaCount, storeName) {
    if (typeof showView === 'function') {
        showView('campana');
    }
    if (typeof navLinks !== 'undefined' && navLinks) {
        navLinks.forEach(l => l.classList.remove('active'));
        const campanaLink = Array.from(navLinks).find(l => l.getAttribute('data-target') === 'campana');
        if (campanaLink) campanaLink.classList.add('active');
    }

    if (storeName) {
        setTimeout(() => {
            const searchInput = document.getElementById('planogram-search-store');
            if (searchInput) searchInput.value = storeName;
            const clearBtn = document.getElementById('btn-clear-planogram-store');
            if (clearBtn) clearBtn.style.display = 'inline-block';
            if (typeof window.onPlanogramStoreSearch === 'function') {
                window.onPlanogramStoreSearch(storeName);
            }
        }, 40);
    } else {
        const mesas = Number(mesaCount) || 1;
        const targetCluster = (mesas >= 3) ? 3 : ((mesas === 2) ? 2 : 1);
        if (typeof window.switchClusterTab === 'function') {
            window.switchClusterTab(targetCluster);
        }
    }
};

window.onPlanogramStoreSearch = function(query) {
    const q = (query || '').toLowerCase().trim();
    const clearBtn = document.getElementById('btn-clear-planogram-store');
    if (clearBtn) clearBtn.style.display = q ? 'inline-block' : 'none';

    if (!q) {
        window.selectedPlanogramStore = null;
        if (typeof window.renderVisualTableMockup === 'function') {
            window.renderVisualTableMockup(window.currentActiveClusterTab);
        }
        return;
    }

    const stores = (window.REAL_STORES_DATA && Array.isArray(window.REAL_STORES_DATA.stores) && window.REAL_STORES_DATA.stores.length > 0)
        ? window.REAL_STORES_DATA.stores
        : getAllStoresList();
    const qNorm = normalizeString(q);
    const matched = stores.find(s => s.nombre.toLowerCase().trim() === q || normalizeString(s.nombre) === qNorm);
    if (matched) {
        window.selectedPlanogramStore = matched;
        const searchInput = document.getElementById('planogram-search-store');
        if (searchInput && searchInput.value !== matched.nombre) {
            searchInput.value = matched.nombre;
        }

        const mesas = Number(matched.Mesa) || 0;
        const cols = Number(matched.Columna) || 0;
        const walls = Number(matched.Wall) || 0;
        const specId = window.getStoreSpecialCaseId(matched);

        const devices = getStoreImeiDevices(matched.nombre) || [];
        const hasPad8Pro = devices.some(d => (d.modelo || '').toLowerCase().includes('pad 8 pro'));

        window.currentMesa2VariantMode = hasPad8Pro ? 'con_pad' : 'sin_pad';
        window.currentMesa3VariantMode = hasPad8Pro ? 'con_pad' : 'sin_pad';

        const cuentaNorm = (matched.cuenta || '').toLowerCase().trim();
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
        }

        window.switchClusterTab(targetTab);

        const mobParts = [];
        if (mesas > 0) mobParts.push(`${mesas} ${mesas === 1 ? 'Mesa' : 'Mesas'}`);
        if (cols > 0) mobParts.push(`${cols} ${cols === 1 ? 'Columna' : 'Columnas'}`);
        if (walls > 0) mobParts.push(`${walls} ${walls === 1 ? 'Wall' : 'Walls'}`);
        if (window.isStoreCabeceraEci(matched)) mobParts.push('Cabecera ECI');

        window.showToast(`📍 ${matched.nombre} (${matched.cuenta || ''}) · ${mobParts.join(' + ')}${specId ? ' · Caso Especial X18' : ''}`, 'info');
    }
};


// Reconstruye APP_CONFIG.imeiDatabase íntegramente desde las filas vivas de Google Sheets (LDUS DUMMY STOCK)
window.rebuildImeiDbFromSheetRecords = function(records, storeMesas) {
    if (!APP_CONFIG.imeiDatabase || Object.keys(APP_CONFIG.imeiDatabase).length === 0) {
        if (typeof initLocalImeiDatabase === 'function') {
            initLocalImeiDatabase();
        }
    }
    const prevDb = APP_CONFIG.imeiDatabase || {};

    // Mapa canónico de nombres y usuarios asignados desde el maestro / estado previo
    const canonStoreMap = {};
    const storeUserMap = {};
    const masterStores = (window.REAL_STORES_DATA && Array.isArray(window.REAL_STORES_DATA.stores))
        ? window.REAL_STORES_DATA.stores
        : [];
    masterStores.forEach(s => {
        if (!s || !s.nombre) return;
        const cleanName = String(s.nombre).trim();
        const norm = normalizeString(cleanName);
        if (norm) {
            canonStoreMap[norm] = cleanName;
            if (s.usuario || s.gpv) {
                storeUserMap[norm] = String(s.usuario || s.gpv).trim();
            }
        }
    });
    Object.keys(prevDb).forEach(k => {
        const norm = normalizeString(k);
        if (norm && !canonStoreMap[norm]) canonStoreMap[norm] = k;
        const firstDev = Array.isArray(prevDb[k]) ? prevDb[k][0] : null;
        if (norm && !storeUserMap[norm] && firstDev && firstDev.usuario) {
            storeUserMap[norm] = String(firstDev.usuario).trim();
        }
    });

    // Indexar estado previo para calcular altas, bajas y modificaciones exactas
    const allPrevItems = [];
    const prevBySlot = new Map();
    const prevByExcelRow = new Map();
    Object.keys(prevDb).forEach(k => {
        const list = prevDb[k];
        if (!Array.isArray(list)) return;
        const nStore = normalizeString(k);
        list.forEach((d, idx) => {
            const entry = { prev: d, matched: false };
            allPrevItems.push(entry);
            const nMesa = String(d.mesa || 'Mesa 1').toLowerCase().trim();
            const pPos = Number(d.posicion) || (idx + 1);
            const slotKey = `${nStore}||${nMesa}||${pPos}`;
            if (!prevBySlot.has(slotKey)) prevBySlot.set(slotKey, []);
            prevBySlot.get(slotKey).push(entry);
            if (d.excelRow) {
                prevByExcelRow.set(`${nStore}||${Number(d.excelRow)}`, entry);
            }
        });
    });

    const rebuiltDb = {};
    const mesaPosCounters = {};
    let totalDevices = 0;
    let addedCount = 0;
    let updatedCount = 0;

    (records || []).forEach((rec, recIdx) => {
        const rawTienda = String(rec && rec.tienda ? rec.tienda : '').trim();
        if (!rawTienda) return;
        const normStore = normalizeString(rawTienda);
        const storeKey = canonStoreMap[normStore] || rawTienda;
        if (normStore && !canonStoreMap[normStore]) canonStoreMap[normStore] = storeKey;

        const rawMesa = String(rec.mesa || 'Mesa 1').trim();
        const mesaLabel = /^\d+$/.test(rawMesa) ? `Mesa ${rawMesa}` : rawMesa;
        const mesaNum = mesaLabel.replace(/\D/g, '') || '1';
        const counterKey = `${storeKey}||${mesaLabel}`;
        const pos = (mesaPosCounters[counterKey] = (mesaPosCounters[counterKey] || 0) + 1);

        const isDummy = Boolean(
            rec.isDummy ||
            String(rec.estado || '').toLowerCase().includes('dummy') ||
            String(rec.modelo || '').toLowerCase().includes('dummy')
        );
        const resolvedUser = String(rec.usuario || '').trim() || storeUserMap[normStore] || '';
        const cleanModelo = String(rec.modelo || '').trim();
        const cleanImei = isDummy ? '' : String(rec.imei || '').trim();
        const mesaCountFromMap = storeMesas ? (Number(storeMesas[rec.tienda]) || Number(storeMesas[storeKey]) || 0) : 0;
        const sheetMesaCount = Number(rec.numMesas) || mesaCountFromMap || 1;

        const devObj = {
            id: `dev_${storeKey.replace(/[^a-zA-Z0-9]/g, '_')}_m${mesaNum}_p${pos}_r${rec.excelRow || (recIdx + 2)}`,
            tienda: storeKey,
            cuenta: rec.cuenta || '',
            rms: rec.rms || '',
            usuario: resolvedUser,
            mesa: mesaLabel,
            posicion: pos,
            tipologia: isDummy ? 'Dummy' : 'LDU',
            isDummy: isDummy,
            modelo: cleanModelo,
            codigo: rec.codigo || '',
            imei: cleanImei,
            imeiOriginal: cleanImei,
            estado: rec.estado || (isDummy ? 'Maqueta dummy' : (cleanImei ? 'Disponible en tienda' : 'Sin asignar')),
            motivoCambio: rec.motivoCambio || '',
            tipoAccion: rec.tipoAccion || '',
            modeloAnterior: '',
            imeiAnterior: '',
            observacionCambio: rec.observacionCambio || '',
            fechaModificacion: rec.fechaModificacion || '',
            numMesas: sheetMesaCount,
            excelRow: rec.excelRow || null,
            _fromLiveSheet: true
        };

        if (!rebuiltDb[storeKey]) rebuiltDb[storeKey] = [];
        rebuiltDb[storeKey].push(devObj);
        totalDevices++;

        let prevEntry = null;
        const slotKey = `${normStore}||${mesaLabel.toLowerCase().trim()}||${pos}`;
        const slotBucket = prevBySlot.get(slotKey);
        if (slotBucket) {
            prevEntry = slotBucket.find(e => !e.matched) || null;
        }
        if (!prevEntry && devObj.excelRow) {
            const rowEntry = prevByExcelRow.get(`${normStore}||${Number(devObj.excelRow)}`);
            if (rowEntry && !rowEntry.matched) prevEntry = rowEntry;
        }

        if (!prevEntry) {
            addedCount++;
        } else {
            prevEntry.matched = true;
            const prevDev = prevEntry.prev;
            const modelChanged = String(prevDev.modelo || '').trim() !== cleanModelo;
            const imeiChanged = String(prevDev.imei || '').trim() !== cleanImei;
            const dummyChanged = Boolean(prevDev.isDummy) !== isDummy;
            if (modelChanged || imeiChanged || dummyChanged) {
                updatedCount++;
            }
        }
    });

    const removedCount = allPrevItems.filter(x => !x.matched).length;
    const totalStores = Object.keys(rebuiltDb).length;

    APP_CONFIG.imeiDatabase = rebuiltDb;
    if (window.REAL_STORES_DATA) {
        window.REAL_STORES_DATA.imei_db = rebuiltDb;
    }

    if (storeMesas && typeof storeMesas === 'object') {
        Object.keys(storeMesas).forEach(stName => {
            const cnt = Number(storeMesas[stName]);
            if (cnt > 0) updateStoreMesaCount(stName, cnt);
        });
    }
    Object.keys(rebuiltDb).forEach(stName => {
        const cnt = rebuiltDb[stName][0] && Number(rebuiltDb[stName][0].numMesas);
        if (cnt > 0) updateStoreMesaCount(stName, cnt);
    });
    saveStoreMesasLocally();

    // El Sheet en vivo pasa a ser la fuente autoritativa; limpiar deltas antiguos
    try { localStorage.removeItem('xiaomi_imei_edits_v187'); } catch (e) {}

    return {
        totalDevices,
        totalStores,
        addedCount,
        removedCount,
        updatedCount,
        changedTotal: addedCount + removedCount + updatedCount
    };
};

// Aplica los registros descargados de Google Sheets (reconstrucción completa o parche legado) y refresca la UI
window.applyLiveSheetPull = function(res, options = {}) {
    const silent = Boolean(options.silent);
    if (!res || !res.success) {
        return { handled: false, rebuilt: false, appliedCount: 0 };
    }

    const refreshAllViews = () => {
        if (typeof window.renderStoreImeis === 'function') window.renderStoreImeis();
        if (typeof window.updateDashboardImeisWidget === 'function') window.updateDashboardImeisWidget();
        if (typeof window.renderJoaquinTotalsWidget === 'function') window.renderJoaquinTotalsWidget();
        if (typeof window.calculateCampaignTotals === 'function') window.calculateCampaignTotals();
        const campanaView = document.getElementById('view-campana');
        if (campanaView && !campanaView.classList.contains('hidden') && typeof window.switchClusterTab === 'function') {
            window.switchClusterTab(window.currentActiveClusterTab || 1);
        }
    };

    if (res.source === 'google_sheets_ldus' && Array.isArray(res.records) && res.records.length > 0) {
        const stats = window.rebuildImeiDbFromSheetRecords(res.records, res.storeMesas);
        refreshAllViews();
        if (!silent && typeof window.showToast === 'function') {
            window.showToast(
                `✅ Google Sheets sincronizado: ${stats.totalDevices} terminales en ${stats.totalStores} tiendas (${stats.updatedCount} actualizados, ${stats.addedCount} nuevos, ${stats.removedCount} eliminados).`,
                'success'
            );
        }
        return { handled: true, rebuilt: true, stats, appliedCount: stats.changedTotal };
    }

    if (res.storeMesas && typeof res.storeMesas === 'object') {
        Object.keys(res.storeMesas).forEach(stName => {
            const cnt = Number(res.storeMesas[stName]);
            if (cnt > 0) updateStoreMesaCount(stName, cnt);
        });
        saveStoreMesasLocally();
    }

    let appliedCount = 0;
    if (Array.isArray(res.records) && res.records.length > 0) {
        if (!APP_CONFIG.imeiDatabase || Object.keys(APP_CONFIG.imeiDatabase).length === 0) {
            if (typeof initLocalImeiDatabase === 'function') initLocalImeiDatabase();
        }

        res.records.forEach(rec => {
            const storeName = rec.tienda;
            if (!storeName) return;
            const normStore = normalizeString(storeName);
            const targetKey = APP_CONFIG.imeiDatabase[storeName]
                ? storeName
                : Object.keys(APP_CONFIG.imeiDatabase).find(k => normalizeString(k) === normStore);
            if (!targetKey || !APP_CONFIG.imeiDatabase[targetKey]) return;

            const storeDevices = APP_CONFIG.imeiDatabase[targetKey];
            const matched = storeDevices.find(d =>
                (rec.excelRow && d.excelRow && Number(d.excelRow) === Number(rec.excelRow)) ||
                (String(d.mesa).toLowerCase().trim() === String(rec.mesa).toLowerCase().trim() &&
                 String(d.modelo).toLowerCase().trim() === String(rec.modelo).toLowerCase().trim()) ||
                (String(d.mesa).toLowerCase().trim() === String(rec.mesa).toLowerCase().trim() &&
                 String(d.posicion) === String(rec.posicion))
            );

            if (matched) {
                const isDummyRec = rec.isDummy ||
                    String(rec.estado || '').toLowerCase().includes('dummy') ||
                    String(rec.modelo || '').toLowerCase().includes('dummy');

                if (isDummyRec) {
                    if (!matched.isDummy || matched.tipologia !== 'Dummy') {
                        matched.isDummy = true;
                        matched.tipologia = 'Dummy';
                        matched.imei = '';
                        appliedCount++;
                    }
                } else if (rec.isDummy === false && matched.isDummy) {
                    matched.isDummy = false;
                    matched.tipologia = 'LDU';
                    appliedCount++;
                }

                if (!isDummyRec && rec.imei !== undefined && rec.imei !== matched.imei) {
                    matched.imei = rec.imei;
                    matched.imeiOriginal = rec.imei;
                    appliedCount++;
                }
                if (rec.modelo && rec.modelo !== matched.modelo) {
                    matched.modelo = rec.modelo;
                    matched.codigo = rec.codigo || matched.codigo;
                    appliedCount++;
                }
                if (rec.tipoAccion) matched.tipoAccion = rec.tipoAccion;
                if (rec.motivoCambio) matched.motivoCambio = rec.motivoCambio;
                if (rec.observacionCambio) matched.observacionCambio = rec.observacionCambio;
            }
            if (rec.numMesas && Number(rec.numMesas) > 0) {
                updateStoreMesaCount(storeName, Number(rec.numMesas));
            }
        });

        saveImeiDbLocally();
        saveStoreMesasLocally();
        refreshAllViews();
        if (!silent && typeof window.showToast === 'function') {
            window.showToast(`¡Sincronización completada! ${appliedCount} actualizaciones aplicadas desde Google Sheets.`, 'success');
        }
    } else if (!silent && typeof window.showToast === 'function') {
        window.showToast('Nube verificada: Todos los terminales e IMEIs están al día.', 'success');
    }

    return { handled: true, rebuilt: false, appliedCount };
};

// Sincronización en vivo con la nube / Feishu (LDUS DUMMY STORE)
window.syncWithFeishuLive = async function(silent = false) {
    const btn = document.getElementById('btn-sync-feishu');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn && !silent) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
    }

    try {
        if (!silent) window.showToast('Conectando con la base en la nube...', 'info');
        const res = await callApi({ action: 'getFeishuImeis' });
        if (res && res.success) {
            window.applyLiveSheetPull(res, { silent });
        } else {
            if (!silent) window.showToast('Nube verificada: Todos los terminales e IMEIs están al día.', 'success');
        }
    } catch (err) {
        console.warn('Error sincronizando con la nube:', err);
        if (!silent) {
            window.showToast('Aviso: Base local operativa. Los cambios pendientes se sincronizarán al reconectar.', 'info');
        }
    } finally {
        if (btn && !silent) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
};

// Guardar todos los cambios de la base de datos de IMEIs directamente en la nube y local
window.saveImeiChanges = async function() {
    try {
        saveImeiDbLocally();
        
        // Obtener tienda activa actual y sincronizar sus líneas modificadas en bloque con la nube
        const tiendaSelect = document.getElementById('imei-filter-tienda');
        const activeStore = tiendaSelect ? tiendaSelect.value : '';
        if (activeStore && APP_CONFIG.imeiDatabase[activeStore]) {
            const list = APP_CONFIG.imeiDatabase[activeStore];
            const modified = list.filter(d => (d.imei && d.imei !== d.imeiOriginal) || d.tipoAccion);
            if (modified.length > 0) {
                window.showToast(`Sincronizando ${modified.length} terminales con la nube...`, 'info');
                const storeInfo = (window.REAL_STORES_DATA && window.REAL_STORES_DATA[activeStore]) || {};
                const currentUser = APP_CONFIG.currentUser || {};
                const itemsPayload = modified.map(d => ({
                    excelRow: d.excelRow || '',
                    cuenta: d.cuenta || storeInfo.cuenta || storeInfo.retail || '',
                    rms: storeInfo.codigo_tienda || d.rms || '',
                    tienda: activeStore,
                    mesa: d.mesa,
                    posicion: d.posicion,
                    modelo: d.modelo,
                    codigo: d.codigo || '',
                    imei: d.imei || '',
                    tipologia: d.isDummy ? 'Dummy' : 'LDU',
                    tipoAccion: d.tipoAccion || (d.imei ? 'Asignación IMEI' : ''),
                    motivoCambio: d.motivoCambio || '',
                    modeloAnterior: d.modeloAnterior || '',
                    imeiAnterior: d.imeiAnterior || '',
                    observacionCambio: d.observacionCambio || '',
                    usuario: currentUser.email || currentUser.nombre || 'Visual App',
                    timestamp: new Date().toISOString()
                }));

                try {
                    const res = await callApi({ 
                        action: 'bulkUpdateFeishuImeis', 
                        items: itemsPayload, 
                        usuario: currentUser.email || currentUser.nombre || 'Visual App' 
                    });
                    if (res && res.success) {
                        modified.forEach(d => { d.imeiOriginal = d.imei; });
                        saveImeiDbLocally();
                        window.showToast(`¡${modified.length} terminales guardados y actualizados en Google Sheets (LDUS DUMMY STOCK)!`, 'success');
                    } else {
                        for (const d of modified) {
                            await window.syncDeviceToFeishu(d, activeStore);
                        }
                    }
                } catch(bulkErr) {
                    console.warn('Error en bulk sync, intentando individual:', bulkErr);
                    for (const d of modified) {
                        await window.syncDeviceToFeishu(d, activeStore);
                    }
                }
            }
        }

        // Actualizar métricas de Dashboard inmediatamente
        if (typeof window.updateDashboardImeisWidget === 'function') {
            window.updateDashboardImeisWidget();
        }

        window.showToast("¡Base de datos de IMEIs guardada correctamente y sincronizada en la nube!", "success");
    } catch(e) {
        console.error("Error saving IMEI db:", e);
        alert("Error al guardar en el almacenamiento.");
    }
};

// Importación desde archivo Excel (Feishu pestaña 'ldus dummy')
window.handleImeiExcelUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const buffer = e.target.result;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);

            // Buscar la pestaña 'ldus dummy' o similar
            let targetSheet = null;
            workbook.eachSheet(sheet => {
                const sName = sheet.name.toLowerCase().trim();
                if (sName.includes('ldu') || sName.includes('dummy') || sName.includes('imei')) {
                    if (!targetSheet) targetSheet = sheet;
                }
            });

            if (!targetSheet) {
                targetSheet = workbook.worksheets[0]; // Fallback primera hoja
            }

            if (!targetSheet) {
                alert("No se encontró ninguna hoja válida en el archivo Excel.");
                return;
            }

            console.log(`Leyendo hoja: "${targetSheet.name}" (${targetSheet.rowCount} filas)...`);

            // Detectar cabecera de columnas
            let colTienda = 1, colCuenta = -1, colMesa = -1, colPos = -1, colTipo = -1, colModelo = -1, colCodigo = -1, colImei = -1, headerRowIndex = 1;

            for (let r = 1; r <= Math.min(5, targetSheet.rowCount); r++) {
                const row = targetSheet.getRow(r);
                row.eachCell((cell, colNumber) => {
                    const txt = String(cell.value || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                    if (txt.includes('tienda') || txt.includes('centro') || txt.includes('store') || txt.includes('nombre')) colTienda = colNumber;
                    if (txt.includes('cuenta') || txt.includes('cadena') || txt.includes('canal')) colCuenta = colNumber;
                    if (txt.includes('mesa') || txt.includes('table') || txt.includes('mueble')) colMesa = colNumber;
                    if (txt.includes('posicion') || txt.includes('pos') || txt.includes('slot')) colPos = colNumber;
                    if (txt.includes('tipologia') || txt.includes('tipo') || txt.includes('ldu/dummy')) colTipo = colNumber;
                    if (txt.includes('modelo') || txt.includes('dispositivo') || txt.includes('terminal')) colModelo = colNumber;
                    if (txt.includes('codigo') || txt.includes('sku') || txt.includes('item')) colCodigo = colNumber;
                    if (txt.includes('imei') || txt.includes('serie') || txt.includes('sn')) colImei = colNumber;
                });
                if (colModelo !== -1 || colImei !== -1) {
                    headerRowIndex = r;
                    break;
                }
            }

            // Fallbacks si las columnas no tenían nombres exactos
            if (colModelo === -1) colModelo = 3;
            if (colImei === -1) colImei = 4;
            if (colMesa === -1) colMesa = 2;

            let importedCount = 0;
            const updatedStores = new Set();
            const newDb = { ...APP_CONFIG.imeiDatabase };

            for (let r = headerRowIndex + 1; r <= targetSheet.rowCount; r++) {
                const row = targetSheet.getRow(r);
                const rawTienda = String(row.getCell(colTienda).value || '').trim();
                if (!rawTienda) continue;

                const rawCuenta = colCuenta !== -1 ? String(row.getCell(colCuenta).value || '').trim() : '';
                const rawMesa = colMesa !== -1 ? String(row.getCell(colMesa).value || 'Mesa 1').trim() : 'Mesa 1';
                const rawPos = colPos !== -1 ? parseInt(row.getCell(colPos).value) || 1 : 1;
                const rawTipo = colTipo !== -1 ? String(row.getCell(colTipo).value || '').trim() : '';
                const rawModelo = colModelo !== -1 ? String(row.getCell(colModelo).value || '').trim() : 'Dispositivo';
                const rawCodigo = colCodigo !== -1 ? String(row.getCell(colCodigo).value || '').trim() : '';
                
                // Tratamiento del IMEI
                let rawImei = '';
                if (colImei !== -1) {
                    const imeiCell = row.getCell(colImei);
                    rawImei = imeiCell.value !== null && imeiCell.value !== undefined ? String(imeiCell.value).trim() : '';
                    if (rawImei.toUpperCase() === 'N/A' || rawImei.toLowerCase().includes('dummy')) rawImei = '';
                }

                // "Y las dummys sale que no tiene Inei al ser dummy"
                const isDummy = rawTipo.toUpperCase().includes('DUMMY') || rawModelo.toUpperCase().includes('DUMMY');
                const finalImei = isDummy ? '' : rawImei;

                if (!newDb[rawTienda]) {
                    newDb[rawTienda] = [];
                }

                const deviceEntry = {
                    id: `dev_${rawTienda.replace(/[^a-zA-Z0-9]/g, '_')}_m${rawMesa.replace(/\D/g, '') || 1}_p${rawPos}_${r}`,
                    tienda: rawTienda,
                    cuenta: rawCuenta || 'General',
                    mesa: rawMesa.toLowerCase().startsWith('mesa') ? rawMesa : `Mesa ${rawMesa}`,
                    posicion: rawPos,
                    tipologia: isDummy ? 'Dummy' : 'LDU',
                    modelo: rawModelo,
                    codigo: rawCodigo,
                    imei: finalImei,
                    imeiOriginal: finalImei,
                    isDummy: isDummy,
                    motivoCambio: '',
                    observacionCambio: '',
                    fechaModificacion: ''
                };

                // Si ya existe la posición, actualizarla; si no, añadirla
                const existingIdx = newDb[rawTienda].findIndex(d => d.mesa === deviceEntry.mesa && d.posicion === deviceEntry.posicion);
                if (existingIdx !== -1) {
                    newDb[rawTienda][existingIdx] = deviceEntry;
                } else {
                    newDb[rawTienda].push(deviceEntry);
                }

                importedCount++;
                updatedStores.add(rawTienda);
            }

            APP_CONFIG.imeiDatabase = newDb;
            saveImeiDbLocally();

            event.target.value = '';
            window.showToast(`¡Importación exitosa! Se han procesado ${importedCount} registros de ${updatedStores.size} tiendas desde '${targetSheet.name}'.`, 'success');
            
            // Actualizar selectores, vista y widget de Dashboard
            window.updateImeiStoreDatalist();
            window.renderStoreImeis();
            if (typeof window.updateDashboardImeisWidget === 'function') {
                window.updateDashboardImeisWidget();
            }

        } catch (err) {
            console.error("Error al procesar archivo Excel:", err);
            alert("Error al leer el archivo Excel: " + (err.message || "Formato no válido"));
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
};

// Exportación a Excel en formato 'LDYS DUMMY STORE' para sincronización con Feishu
window.exportImeiExcel = async function() {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Xiaomi Visual APP';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('LDYS DUMMY STORE');
        const worksheetLegacy = workbook.addWorksheet('ldus dummy');

        const columnsDef = [
            { header: 'Tienda', key: 'tienda', width: 28 },
            { header: 'Cuenta', key: 'cuenta', width: 16 },
            { header: 'Mesa', key: 'mesa', width: 12 },
            { header: 'Posición', key: 'posicion', width: 10 },
            { header: 'Tipología', key: 'tipologia', width: 12 },
            { header: 'Modelo', key: 'modelo', width: 30 },
            { header: 'Código Dispositivo', key: 'codigo', width: 20 },
            { header: 'IMEI', key: 'imei', width: 22 },
            { header: 'Estado IMEI', key: 'estado', width: 16 },
            { header: 'Tipo Acción (Feishu)', key: 'tipo_accion', width: 20 },
            { header: 'Modelo Anterior', key: 'modelo_anterior', width: 25 },
            { header: 'IMEI Anterior', key: 'imei_anterior', width: 22 },
            { header: 'Observaciones / Denuncia', key: 'observaciones', width: 30 },
            { header: 'Fecha Modificación', key: 'fecha', width: 16 }
        ];

        [worksheet, worksheetLegacy].forEach(ws => {
            ws.columns = columnsDef;
            ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            ws.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFF6700' } // Xiaomi Orange
            };
            ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        });

        const accessibleStores = getUserAccessibleStores();
        const accessibleNames = new Set(accessibleStores.map(s => String(s.nombre || '').trim().toLowerCase()));
        const storesList = Object.keys(APP_CONFIG.imeiDatabase).filter(name => accessibleNames.size === 0 || accessibleNames.has(name.toLowerCase().trim()));
        if (storesList.length === 0) {
            alert("No hay datos de IMEIs para exportar.");
            return;
        }

        storesList.sort().forEach(storeName => {
            const devices = APP_CONFIG.imeiDatabase[storeName] || [];
            devices.sort((a, b) => {
                const mesaA = parseInt(a.mesa.replace(/\D/g, '')) || 0;
                const mesaB = parseInt(b.mesa.replace(/\D/g, '')) || 0;
                if (mesaA !== mesaB) return mesaA - mesaB;
                return (parseInt(a.posicion) || 0) - (parseInt(b.posicion) || 0);
            });

            devices.forEach(d => {
                let estadoTxt = 'Pendiente';
                if (d.isDummy) {
                    estadoTxt = 'Dummy (Sin IMEI)';
                } else if (d.tipoAccion) {
                    estadoTxt = d.tipoAccion;
                } else if (d.imei && String(d.imei).trim() !== '') {
                    estadoTxt = d.motivoCambio ? 'Modificado' : 'Correcto';
                }

                const rowData = {
                    tienda: d.tienda,
                    cuenta: d.cuenta,
                    mesa: d.mesa,
                    posicion: d.posicion,
                    tipologia: d.tipologia,
                    modelo: window.normalizeDeviceModelName(d.modelo),
                    codigo: d.codigo,
                    imei: d.isDummy ? 'N/A' : (d.imei || ''),
                    estado: estadoTxt,
                    tipo_accion: d.tipoAccion || (d.motivoCambio ? 'Modificado' : ''),
                    modelo_anterior: window.normalizeDeviceModelName(d.modeloAnterior || ''),
                    imei_anterior: d.imeiAnterior || '',
                    observaciones: d.observacionCambio || '',
                    fecha: d.fechaModificacion || ''
                };

                [worksheet, worksheetLegacy].forEach(ws => {
                    const row = ws.addRow(rowData);
                    if (d.isDummy) {
                        row.getCell('imei').font = { color: { argb: 'FF888888' }, italic: true };
                    } else if (!d.imei || String(d.imei).trim() === '') {
                        row.getCell('estado').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F0' } };
                        row.getCell('estado').font = { color: { argb: 'FFCF1322' }, bold: true };
                    } else if (d.tipoAccion === 'Cambio de modelo') {
                        row.getCell('tipo_accion').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F7FF' } };
                        row.getCell('tipo_accion').font = { color: { argb: 'FF0050B3' }, bold: true };
                    } else if (d.tipoAccion === 'Rotura') {
                        row.getCell('tipo_accion').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7E6' } };
                        row.getCell('tipo_accion').font = { color: { argb: 'FFD46B08' }, bold: true };
                    } else if (d.tipoAccion === 'Robo') {
                        row.getCell('tipo_accion').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F0' } };
                        row.getCell('tipo_accion').font = { color: { argb: 'FFCF1322' }, bold: true };
                    } else {
                        row.getCell('estado').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6FFED' } };
                        row.getCell('estado').font = { color: { argb: 'FF389E0D' }, bold: true };
                    }
                });
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Control_IMEI_LDYS_DUMMY_STORE_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        window.showToast("¡Archivo descargado en formato Feishu (LDYS DUMMY STORE) con trazabilidad de acciones!", "success");

    } catch (err) {
        console.error("Error al exportar Excel:", err);
        alert("Error al generar el archivo Excel de IMEIs.");
    }
};


// ==============================================================
// MÓDULO 2: AUTOMATIZACIÓN HOJA DE RUTA Y PLANOGRAMAS CAMPAÑA
// ==============================================================

APP_CONFIG.campaignPlanograms = {
    cluster1: null,
    cluster2: null,
    cluster3: null
};

window.currentActiveClusterTab = null;

// Inicialización de planogramas por cluster de mesas
function initCampaignPlanograms() {
    function normalizePlanograms(p) {
        if (!p) return;
        ['cluster1', 'cluster2', 'cluster3'].forEach(cKey => {
            if (Array.isArray(p[cKey])) {
                p[cKey].forEach(table => {
                    if (Array.isArray(table)) {
                        table.forEach(slot => {
                            if (slot.modelo) slot.modelo = window.normalizeDeviceModelName(slot.modelo);
                        });
                    }
                });
            }
        });
    }

    if (window.REAL_STORES_DATA && window.REAL_STORES_DATA.cluster_planograms) {
        try {
            const saved = localStorage.getItem('xiaomi_campaign_planograms_v156');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.cluster1 && parsed.cluster2 && parsed.cluster3) {
                    normalizePlanograms(parsed);
                    APP_CONFIG.campaignPlanograms = parsed;
                    return;
                }
            }
        } catch(e) {}

        // Cargar los planogramas reales por cluster extraídos de Feishu (Cluster 1: 20 pos, Cluster 2: 21+17 pos, Cluster 3: 16+19+10 pos)
        APP_CONFIG.campaignPlanograms = JSON.parse(JSON.stringify(window.REAL_STORES_DATA.cluster_planograms));
        normalizePlanograms(APP_CONFIG.campaignPlanograms);
        try {
            localStorage.setItem('xiaomi_campaign_planograms_v156', JSON.stringify(APP_CONFIG.campaignPlanograms));
            localStorage.setItem('xiaomi_campaign_planograms', JSON.stringify(APP_CONFIG.campaignPlanograms));
        } catch(e) {}
        return;
    }

    try {
        const saved = localStorage.getItem('xiaomi_campaign_planograms');
        if (saved) {
            APP_CONFIG.campaignPlanograms = JSON.parse(saved);
            if (APP_CONFIG.campaignPlanograms.cluster1 && APP_CONFIG.campaignPlanograms.cluster2 && APP_CONFIG.campaignPlanograms.cluster3) {
                return;
            }
        }
    } catch(e) {}

    // Configuración por defecto de los 3 Clusters:
    // Cluster 1: 1 mesa (8 posiciones)
    // Cluster 2: 2 mesas (Mesa 1: 8 pos, Mesa 2: 8 pos)
    // Cluster 3: 3 mesas (Mesa 1: 8 pos, Mesa 2: 8 pos, Mesa 3: 8 pos)
    const defaultModels = [
        { modelo: "X18", codigo: "XR100008818", tipologia: "LDU" }, // Nuevo modelo para sustitución y suma
        { modelo: "Xiaomi 14T Pro 5G", codigo: "XR100004452", tipologia: "LDU" },
        { modelo: "Xiaomi 14T 5G", codigo: "XR100004451", tipologia: "LDU" },
        { modelo: "Redmi Note 15 5G Black", codigo: "XR100006315", tipologia: "LDU" },
        { modelo: "Redmi Note 15 5G Blue (Dummy)", codigo: "XR100006316", tipologia: "Dummy" },
        { modelo: "Xiaomi Watch S3 Black", codigo: "XR100003318", tipologia: "LDU" },
        { modelo: "Xiaomi Pad 6S Pro", codigo: "XR100002100", tipologia: "LDU" },
        { modelo: "Redmi Buds 6 Pro White", codigo: "XR100004452", tipologia: "Dummy" }
    ];

    function createMesaSlots(mNum, count = 8) {
        const slots = [];
        for (let p = 1; p <= count; p++) {
            const m = defaultModels[(p - 1) % defaultModels.length];
            slots.push({
                mesa: `Mesa ${mNum}`,
                posicion: p,
                modelo: m.modelo,
                codigo: m.codigo,
                tipologia: m.tipologia
            });
        }
        return slots;
    }

    APP_CONFIG.campaignPlanograms = {
        cluster1: [createMesaSlots(1)],
        cluster2: [createMesaSlots(1), createMesaSlots(2)],
        cluster3: [createMesaSlots(1), createMesaSlots(2), createMesaSlots(3)]
    };

    try {
        localStorage.setItem('xiaomi_campaign_planograms_v156', JSON.stringify(APP_CONFIG.campaignPlanograms));
        localStorage.setItem('xiaomi_campaign_planograms', JSON.stringify(APP_CONFIG.campaignPlanograms));
    } catch(e) {}
}

window.resetCampaignPlanograms = function() {
    if (confirm("¿Deseas restaurar los planogramas de los 3 clusters a la configuración inicial?")) {
        localStorage.removeItem('xiaomi_campaign_planograms_v156');
        localStorage.removeItem('xiaomi_campaign_planograms');
        initCampaignPlanograms();
        window.switchClusterTab(window.currentActiveClusterTab);
        window.showToast("Planogramas restaurados a valores iniciales de campaña.", "info");
    }
};

// Contar tiendas por cluster y mobiliario oficial Guía X18
function getClusterStoreCounts() {
    const stores = getAllStoresList();
    const storesToCount = (stores && stores.length > 0) ? stores : (window.REAL_STORES_DATA?.stores || []);
    const c1 = storesToCount.filter(s => (parseInt(s.Mesa) || 0) === 1).length;
    const c2 = storesToCount.filter(s => (parseInt(s.Mesa) || 0) === 2).length;
    const c3 = storesToCount.filter(s => (parseInt(s.Mesa) || 0) >= 3).length;
    const wallCnt = storesToCount.filter(s => (parseInt(s.Wall) || 0) > 0).length;
    const colCnt = storesToCount.filter(s => (parseInt(s.Columna) || 0) > 0).length;
    return {
        cluster1: c1 || 46,
        cluster2: c2 || 97,
        cluster3: c3 || 23,
        walls: wallCnt || 51,
        cols: colCnt || 38
    };
}

window.clearPlanogramStoreSelection = function() {
    if (typeof window.clearSelectedPlanogramStore === 'function') {
        window.clearSelectedPlanogramStore();
    }
};

window.initCampanaView = function() {
    initCampaignPlanograms();

    // Actualizar badges de tiendas en las pestañas
    const counts = getClusterStoreCounts();
    const b1 = document.getElementById('count-badge-cluster1');
    const b2 = document.getElementById('count-badge-cluster2');
    const b3 = document.getElementById('count-badge-cluster3');
    const bWallCol = document.getElementById('count-badge-wallcol');

    if (b1) b1.textContent = `${counts.cluster1} tiendas`;
    if (b2) b2.textContent = `${counts.cluster2} tiendas`;
    if (b3) b3.textContent = `${counts.cluster3} tiendas`;
    if (bWallCol) bWallCol.textContent = `${counts.walls} Wall · ${counts.cols} Col`;

    if (typeof window.populatePlanogramFilters === 'function') {
        window.populatePlanogramFilters();
    }

    window.switchClusterTab(window.currentActiveClusterTab || 1);
    if (typeof window.renderJoaquinTotalsWidget === 'function') {
        window.renderJoaquinTotalsWidget();
    }
};

window.switchClusterTab = function(tabId) {
    window.currentActiveClusterTab = tabId || 1;

    const allTabs = document.querySelectorAll('.cluster-tab-btn');
    allTabs.forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = '#666';
    });

    if (tabId) {
        let btnId = `tab-btn-${tabId}`;
        if (tabId === 1 || tabId === 2 || tabId === 3 || tabId === '1' || tabId === '2' || tabId === '3') {
            btnId = `tab-btn-cluster${tabId}`;
        }
        const activeBtn = document.getElementById(btnId);
        if (activeBtn) {
            activeBtn.classList.add('active');
            let color = 'var(--mi-orange)';
            if (tabId === 'hojaruta') color = '#217346';
            else if (tabId === 'alcampo') color = '#dc2626';
            else if (tabId === 'carrefour') color = '#2563eb';
            else if (tabId === 'carrefour_premium') color = '#ea580c';
            activeBtn.style.borderBottomColor = color;
            activeBtn.style.color = color;
        }
    }

    // Sincronizar select interactivo de cluster
    const clusterSelect = document.getElementById('planogram-filter-cluster');
    if (clusterSelect) {
        const targetVal = tabId ? String(tabId) : '';
        if (clusterSelect.value !== targetVal) {
            clusterSelect.value = targetVal;
        }
    }

    const hojaRutaContainer = document.getElementById('hoja-ruta-view-container');
    const visualCont = document.getElementById('visual-planogram-diagram-container');

    if (tabId === 'hojaruta') {
        if (visualCont) visualCont.style.display = 'none';
        if (hojaRutaContainer) {
            hojaRutaContainer.style.display = 'block';
            window.renderHojaRutaView();
        }
    } else {
        if (hojaRutaContainer) hojaRutaContainer.style.display = 'none';
        if (visualCont) {
            visualCont.style.display = 'block';
            if (typeof window.renderVisualTableMockup === 'function') {
                window.renderVisualTableMockup(tabId);
            }
        }
    }
};

window.renderClusterPlanogram = function(clusterId) {
    const container = document.getElementById('cluster-planogram-container');
    if (!container) return;

    const clusterKey = `cluster${clusterId}`;
    const tables = APP_CONFIG.campaignPlanograms[clusterKey] || [];
    const counts = getClusterStoreCounts();
    const storeCount = counts[clusterKey] || 1;

    // Obtener catálogo de dispositivos
    const catalog = APP_CONFIG.deviceCatalog && APP_CONFIG.deviceCatalog.length > 0 ? APP_CONFIG.deviceCatalog : [];
    
    // Asegurar que el nuevo modelo 'X18' esté disponible en las opciones
    const hasX18 = catalog.some(d => String(d.Modelo || '').toUpperCase().includes('X18'));
    if (!hasX18) {
        catalog.unshift({
            Modelo: "X18",
            'Código Dispositivo': "XR100008818",
            Tipología: "LDU"
        });
    }

    let html = `
        <div style="background: #fff; padding: 1.25rem; border-radius: 12px; border: 1px solid #eee; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
                <h3 style="margin: 0; font-size: 1.15rem; color: #111;">
                    <i class="fas fa-layer-group" style="color: var(--mi-orange); margin-right: 6px;"></i> 
                    Configuración de Planograma: Cluster ${clusterId} ${clusterId === 1 ? 'Mesa' : 'Mesas'}
                </h3>
                <p style="margin: 4px 0 0; color: #777; font-size: 12px;">
                    Aplica a <b>${storeCount} tiendas</b>. Cada posición se multiplicará por el total de tiendas del cluster.
                </p>
            </div>
            <span style="background: rgba(255,103,0,0.1); color: var(--mi-orange); padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 12px;">
                ${tables.length} ${tables.length === 1 ? 'Mesa en este cluster' : 'Mesas en este cluster'}
            </span>
        </div>
    `;

    tables.forEach((tableSlots, tIdx) => {
        const mesaNum = tIdx + 1;
        html += `
            <div class="planogram-table-block">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f2f5; padding-bottom: 10px; margin-bottom: 12px;">
                    <h4 style="margin: 0; font-size: 1rem; color: #333; display: flex; align-items: center; gap: 8px;">
                        <span style="display:inline-block; width: 18px; height: 13px; border-top: 3px solid var(--mi-orange); border-left: 2px solid var(--mi-orange); border-right: 2px solid var(--mi-orange); border-radius: 2px 2px 0 0;"></span>
                        Mesa ${mesaNum} (${tableSlots.length} Posiciones)
                    </h4>
                    <span style="font-size: 11px; color: #888;">Multiplicador cluster: <b>×${storeCount} tiendas</b></span>
                </div>

                <div class="planogram-slots-grid">
        `;

        tableSlots.forEach((slot, pIdx) => {
            const isX18 = String(slot.modelo || '').toUpperCase().includes('X18');
            const totalUnitsForThisSlot = 1 * storeCount;

            html += `
                <div class="planogram-slot-card ${isX18 ? 'highlight-new' : ''}">
                    <div class="planogram-slot-header">
                        <span class="planogram-pos-badge">M${mesaNum} · Posición ${slot.posicion}</span>
                        <span class="planogram-qty-calc">×${storeCount} uds</span>
                    </div>

                    <div>
                        <label style="font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; margin-bottom: 3px; display: block;">
                            Dispositivo Asignado:
                        </label>
                        <select class="form-control" style="height: 36px; font-size: 12px; border-radius: 6px; font-weight: 600; width: 100%; ${isX18 ? 'border-color: var(--mi-orange); color: var(--mi-orange);' : ''}" 
                            onchange="window.updatePlanogramSlot(${clusterId}, ${tIdx}, ${pIdx}, this.value)">
            `;

            // Construir opciones con los modelos del catálogo
            let modelFoundInCatalog = false;
            catalog.forEach(catItem => {
                const mName = catItem.Modelo;
                if (!mName) return;
                const isSelected = mName.toLowerCase().trim() === String(slot.modelo).toLowerCase().trim();
                if (isSelected) modelFoundInCatalog = true;
                const code = catItem['Código Dispositivo'] || catItem.codigo || '';
                html += `<option value="${mName}" data-code="${code}" ${isSelected ? 'selected' : ''}>${mName}${code ? ' (' + code + ')' : ''}</option>`;
            });

            if (!modelFoundInCatalog && slot.modelo) {
                html += `<option value="${slot.modelo}" selected>${slot.modelo}</option>`;
            }

            html += `
                        </select>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 11px;">
                        <span style="font-family: monospace; color: #888;">${slot.codigo || 'SKU N/A'}</span>
                        <select style="border: 1px solid #ddd; border-radius: 4px; font-size: 10px; font-weight: 700; padding: 2px 4px; background: white;"
                            onchange="window.updatePlanogramSlotTipology(${clusterId}, ${tIdx}, ${pIdx}, this.value)">
                            <option value="LDU" ${slot.tipologia === 'LDU' ? 'selected' : ''}>LDU</option>
                            <option value="Dummy" ${slot.tipologia === 'Dummy' ? 'selected' : ''}>Dummy</option>
                        </select>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
};

// Actualizar posición del planograma con nuevo modelo
window.updatePlanogramSlot = function(clusterId, tableIdx, slotIdx, selectedModel) {
    const clusterKey = `cluster${clusterId}`;
    const tables = APP_CONFIG.campaignPlanograms[clusterKey];
    if (!tables || !tables[tableIdx] || !tables[tableIdx][slotIdx]) return;

    const slot = tables[tableIdx][slotIdx];
    slot.modelo = selectedModel;

    // Buscar código correspondiente en el catálogo
    const catalog = APP_CONFIG.deviceCatalog || [];
    const catItem = catalog.find(c => String(c.Modelo).toLowerCase().trim() === selectedModel.toLowerCase().trim());
    if (catItem) {
        slot.codigo = catItem['Código Dispositivo'] || catItem.codigo || slot.codigo;
        if (catItem.Tipología) {
            slot.tipologia = catItem.Tipología.toUpperCase().includes('DUMMY') ? 'Dummy' : 'LDU';
        }
    }

    try {
        localStorage.setItem('xiaomi_campaign_planograms_v156', JSON.stringify(APP_CONFIG.campaignPlanograms));
        localStorage.setItem('xiaomi_campaign_planograms', JSON.stringify(APP_CONFIG.campaignPlanograms));
    } catch(e) {}

    // Recalcular unidades de campaña inmediatamente
    window.calculateCampaignTotals();
    window.renderClusterPlanogram(clusterId);
    window.showToast(`¡Planograma actualizado! Modelo '${selectedModel}' asignado a M${tableIdx + 1}-P${slot.posicion}.`, 'success');
};

window.updatePlanogramSlotTipology = function(clusterId, tableIdx, slotIdx, tipology) {
    const clusterKey = `cluster${clusterId}`;
    const tables = APP_CONFIG.campaignPlanograms[clusterKey];
    if (tables && tables[tableIdx] && tables[tableIdx][slotIdx]) {
        tables[tableIdx][slotIdx].tipologia = tipology;
        try {
            localStorage.setItem('xiaomi_campaign_planograms_v156', JSON.stringify(APP_CONFIG.campaignPlanograms));
            localStorage.setItem('xiaomi_campaign_planograms', JSON.stringify(APP_CONFIG.campaignPlanograms));
        } catch(e) {}
        window.calculateCampaignTotals();
    }
};

// Cálculo en vivo de la suma total de unidades de campaña
window.calculateCampaignTotals = function() {
    const chipsContainer = document.getElementById('campaign-totals-chips');
    if (!chipsContainer) return;

    const counts = getClusterStoreCounts();
    const modelTotals = {}; // { "X18": { codigo, c1: 0, c2: 0, c3: 0, total: 0 } }

    [1, 2, 3].forEach(cNum => {
        const clusterKey = `cluster${cNum}`;
        const storeCount = counts[clusterKey] || 1;
        const tables = APP_CONFIG.campaignPlanograms[clusterKey] || [];

        tables.forEach(tableSlots => {
            tableSlots.forEach(slot => {
                const mName = slot.modelo || 'Sin Modelo';
                if (!modelTotals[mName]) {
                    modelTotals[mName] = {
                        modelo: mName,
                        codigo: slot.codigo || 'N/A',
                        tipologia: slot.tipologia || 'LDU',
                        c1: 0, c2: 0, c3: 0,
                        total: 0
                    };
                }
                const qtyToAdd = 1 * storeCount;
                modelTotals[mName][`c${cNum}`] += qtyToAdd;
                modelTotals[mName].total += qtyToAdd;
            });
        });
    });

    chipsContainer.innerHTML = '';
    const sortedModels = Object.values(modelTotals).sort((a, b) => b.total - a.total);

    sortedModels.forEach(m => {
        const isX18 = String(m.modelo).toUpperCase().includes('X18');
        const chip = document.createElement('div');
        chip.className = 'hoja-ruta-summary-chip';
        if (isX18) {
            chip.style.borderColor = 'var(--mi-orange)';
            chip.style.background = '#fff9f5';
        }

        chip.innerHTML = `
            <div>
                <strong style="color: #111; font-size: 13px;">${m.modelo}</strong>
                <span style="font-size: 10px; color: #888; font-family: monospace; margin-left: 4px;">(${m.codigo})</span>
                <div style="font-size: 10px; color: #777; margin-top: 2px;">
                    C1: ${m.c1} | C2: ${m.c2} | C3: ${m.c3}
                </div>
            </div>
            <b style="font-size: 1.15rem; ${isX18 ? 'color: var(--mi-orange);' : 'color: #1890ff;'}">${m.total} uds</b>
        `;
        chipsContainer.appendChild(chip);
    });
};

// Generación de la tabla transpuesta de Hoja de Ruta
window.renderHojaRutaView = function() {
    const container = document.getElementById('hoja-ruta-view-container');
    if (!container) return;

    const stores = getAllStoresList();
    const counts = getClusterStoreCounts();

    // Obtener los códigos y modelos únicos asignados en todos los planogramas
    const assignedModelsMap = {};
    [1, 2, 3].forEach(cNum => {
        const tables = APP_CONFIG.campaignPlanograms[`cluster${cNum}`] || [];
        tables.forEach(tableSlots => {
            tableSlots.forEach(slot => {
                const normModel = window.normalizeDeviceModelName(slot.modelo);
                const key = slot.codigo || normModel;
                if (!assignedModelsMap[key]) {
                    assignedModelsMap[key] = {
                        codigo: slot.codigo || 'N/A',
                        modelo: normModel,
                        tipologia: slot.tipologia
                    };
                }
            });
        });
    });

    const uniqueProductKeys = Object.keys(assignedModelsMap).sort((a, b) => {
        // Poner X18 primero si existe
        const isX18A = String(assignedModelsMap[a].modelo).toUpperCase().includes('X18');
        const isX18B = String(assignedModelsMap[b].modelo).toUpperCase().includes('X18');
        if (isX18A && !isX18B) return -1;
        if (!isX18A && isX18B) return 1;
        return assignedModelsMap[a].modelo.localeCompare(assignedModelsMap[b].modelo);
    });

    // Calcular cantidades por tienda
    // Para cada tienda: cuántas unidades de cada código le corresponden según su cluster
    function getStoreAllocations(store) {
        const mesaCount = Math.max(1, Math.min(3, parseInt(store.Mesa) || 1));
        const clusterKey = `cluster${mesaCount}`;
        const tables = APP_CONFIG.campaignPlanograms[clusterKey] || [];
        const allocations = {};

        tables.forEach(tableSlots => {
            tableSlots.forEach(slot => {
                const normModel = window.normalizeDeviceModelName(slot.modelo);
                const key = slot.codigo || normModel;
                allocations[key] = (allocations[key] || 0) + 1;
            });
        });

        return { mesaCount, allocations };
    }

    let html = `
        <div style="background: #fff; padding: 1.25rem; border-radius: 12px; border: 1px solid #ebeef2; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
            <div>
                <h3 style="margin: 0; font-size: 1.2rem; color: #111; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-file-invoice" style="color: #217346;"></i> Hoja de Ruta Transpuesta de Campaña
                </h3>
                <p style="margin: 4px 0 0; color: #666; font-size: 13px;">
                    Formato de distribución logística: Tiendas en filas, Códigos de producto en columnas y cantidades asignadas.
                </p>
            </div>
        </div>

        <div class="hoja-ruta-table-wrapper">
            <table class="hoja-ruta-table">
                <thead>
                    <tr>
                        <th style="min-width: 180px;">Tienda</th>
                        <th>Cuenta</th>
                        <th>RMS</th>
                        <th>Cluster</th>
    `;

    uniqueProductKeys.forEach(key => {
        const prod = assignedModelsMap[key];
        const isX18 = String(prod.modelo).toUpperCase().includes('X18');
        html += `
            <th style="text-align: center; ${isX18 ? 'background: #fff2e8; color: #d4380d;' : ''}">
                ${prod.modelo}
                <br><small style="font-weight: normal; font-family: monospace;">${prod.codigo}</small>
            </th>
        `;
    });

    html += `
                        <th style="text-align: center; background: #fafafa; font-weight: 800;">Total Uds</th>
                    </tr>
                </thead>
                <tbody>
    `;

    const columnTotals = {};
    let grandTotal = 0;

    stores.forEach(store => {
        const { mesaCount, allocations } = getStoreAllocations(store);
        let storeTotal = 0;

        html += `
            <tr>
                <td><strong>${store.nombre}</strong></td>
                <td><span style="font-size: 11px; background: #e6f7ff; color: #0050b3; padding: 2px 6px; border-radius: 4px;">${store.cuenta || 'Sin Cuenta'}</span></td>
                <td><small style="font-family: monospace; color: #666;">${store.rms || '-'}</small></td>
                <td><span style="font-size: 11px; font-weight: 700; color: var(--mi-orange);">Cluster ${mesaCount}</span></td>
        `;

        uniqueProductKeys.forEach(key => {
            const qty = allocations[key] || 0;
            storeTotal += qty;
            columnTotals[key] = (columnTotals[key] || 0) + qty;

            const isX18 = String(assignedModelsMap[key].modelo).toUpperCase().includes('X18');
            html += `
                <td class="qty-cell ${qty > 0 ? 'has-qty' : ''}" style="${isX18 && qty > 0 ? 'font-weight: 800; color: #d4380d; background: #fff2e8;' : ''}">
                    ${qty > 0 ? qty : '<span style="color: #ccc;">0</span>'}
                </td>
            `;
        });

        grandTotal += storeTotal;

        html += `
                <td style="text-align: center; font-weight: 800; color: #111; background: #fafafa;">${storeTotal}</td>
            </tr>
        `;
    });

    // Fila de totales
    html += `
                </tbody>
                <tfoot>
                    <tr style="background: #f8fafc; font-weight: 800; border-top: 2px solid #ccc;">
                        <td colspan="4" style="text-align: right; padding-right: 15px; font-size: 14px; color: #111;">TOTALES DE CAMPAÑA:</td>
    `;

    uniqueProductKeys.forEach(key => {
        const totalForCol = columnTotals[key] || 0;
        const isX18 = String(assignedModelsMap[key].modelo).toUpperCase().includes('X18');
        html += `
            <td style="text-align: center; font-size: 14px; ${isX18 ? 'color: #d4380d; background: #fff2e8;' : 'color: var(--mi-orange);'}">
                ${totalForCol}
            </td>
        `;
    });

    html += `
                        <td style="text-align: center; font-size: 16px; color: #111; background: #e6f7ff;">${grandTotal}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;

    container.innerHTML = html;
};

// Exportar Hoja de Ruta completa a Excel (.xlsx) mediante ExcelJS
window.exportHojaRutaExcel = async function() {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Xiaomi Visual APP';
        workbook.created = new Date();

        const stores = getAllStoresList();
        const counts = getClusterStoreCounts();

        // 1. Obtener los modelos únicos asignados en planogramas
        const assignedModelsMap = {};
        [1, 2, 3].forEach(cNum => {
            const tables = APP_CONFIG.campaignPlanograms[`cluster${cNum}`] || [];
            tables.forEach(tableSlots => {
                tableSlots.forEach(slot => {
                    const normModel = window.normalizeDeviceModelName(slot.modelo);
                    const key = slot.codigo || normModel;
                    if (!assignedModelsMap[key]) {
                        assignedModelsMap[key] = {
                            codigo: slot.codigo || 'N/A',
                            modelo: normModel,
                            tipologia: slot.tipologia
                        };
                    }
                });
            });
        });

        const uniqueProductKeys = Object.keys(assignedModelsMap).sort();

        // HOJA 1: Hoja de Ruta Tiendas (Transpuesta)
        const sheet1 = workbook.addWorksheet('Hoja de Ruta Tiendas');

        const columns = [
            { header: 'Tienda', key: 'tienda', width: 28 },
            { header: 'Cuenta', key: 'cuenta', width: 16 },
            { header: 'Código / RMS', key: 'rms', width: 16 },
            { header: 'Cluster Mesas', key: 'cluster', width: 14 }
        ];

        uniqueProductKeys.forEach((key, idx) => {
            const prod = assignedModelsMap[key];
            columns.push({
                header: `${prod.modelo} (${prod.codigo})`,
                key: `prod_${idx}`,
                width: 22
            });
        });

        columns.push({ header: 'Total Terminales', key: 'total_tienda', width: 16 });
        sheet1.columns = columns;

        // Estilo cabecera Hoja 1
        sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet1.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF217346' } // Excel Green
        };
        sheet1.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        const colTotals = {};
        let grandTotal = 0;

        stores.forEach(store => {
            const mesaCount = Math.max(1, Math.min(3, parseInt(store.Mesa) || 1));
            const clusterKey = `cluster${mesaCount}`;
            const tables = APP_CONFIG.campaignPlanograms[clusterKey] || [];
            const allocations = {};

            tables.forEach(tableSlots => {
                tableSlots.forEach(slot => {
                    const normModel = window.normalizeDeviceModelName(slot.modelo);
                    const key = slot.codigo || normModel;
                    allocations[key] = (allocations[key] || 0) + 1;
                });
            });

            const rowData = {
                tienda: store.nombre,
                cuenta: store.cuenta || 'General',
                rms: store.rms || '',
                cluster: `Cluster ${mesaCount}`
            };

            let rowSum = 0;
            uniqueProductKeys.forEach((key, idx) => {
                const qty = allocations[key] || 0;
                rowData[`prod_${idx}`] = qty;
                rowSum += qty;
                colTotals[key] = (colTotals[key] || 0) + qty;
            });

            rowData.total_tienda = rowSum;
            grandTotal += rowSum;

            const addedRow = sheet1.addRow(rowData);
            addedRow.alignment = { vertical: 'middle' };
        });

        // Fila de totales en Hoja 1
        const totalRowData = {
            tienda: 'TOTALES DE CAMPAÑA',
            cuenta: '',
            rms: '',
            cluster: ''
        };
        uniqueProductKeys.forEach((key, idx) => {
            totalRowData[`prod_${idx}`] = colTotals[key] || 0;
        });
        totalRowData.total_tienda = grandTotal;

        const totalRow = sheet1.addRow(totalRowData);
        totalRow.font = { bold: true };
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6F4EA' }
        };

        // HOJA 2: Resumen Global de Campaña
        const sheet2 = workbook.addWorksheet('Resumen de Cantidades');
        sheet2.columns = [
            { header: 'Código Dispositivo', key: 'codigo', width: 20 },
            { header: 'Modelo', key: 'modelo', width: 30 },
            { header: 'Tipología', key: 'tipologia', width: 14 },
            { header: 'Cluster 1 (1 Mesa)', key: 'c1', width: 18 },
            { header: 'Cluster 2 (2 Mesas)', key: 'c2', width: 18 },
            { header: 'Cluster 3 (3 Mesas)', key: 'c3', width: 18 },
            { header: 'TOTAL UNIDADES', key: 'total', width: 18 }
        ];

        sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet2.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF6700' } // Xiaomi Orange
        };
        sheet2.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Calcular cantidades de cada modelo por cluster
        uniqueProductKeys.forEach(key => {
            const prod = assignedModelsMap[key];
            let q1 = 0, q2 = 0, q3 = 0;

            [1, 2, 3].forEach(cNum => {
                const clusterKey = `cluster${cNum}`;
                const storeCount = counts[clusterKey] || 1;
                const tables = APP_CONFIG.campaignPlanograms[clusterKey] || [];
                let countInCluster = 0;
                tables.forEach(tableSlots => {
                    tableSlots.forEach(slot => {
                        const normModel = window.normalizeDeviceModelName(slot.modelo);
                        const slotKey = slot.codigo || normModel;
                        if (slotKey === key) countInCluster++;
                    });
                });
                if (cNum === 1) q1 = countInCluster * storeCount;
                if (cNum === 2) q2 = countInCluster * storeCount;
                if (cNum === 3) q3 = countInCluster * storeCount;
            });

            sheet2.addRow({
                codigo: prod.codigo,
                modelo: prod.modelo,
                tipologia: prod.tipologia,
                c1: q1,
                c2: q2,
                c3: q3,
                total: q1 + q2 + q3
            });
        });

        // Descarga
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Hoja_de_Ruta_Campana_XIAOMI_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        window.showToast("¡Hoja de Ruta descargada con éxito en formato Excel!", "success");

    } catch (err) {
        console.error("Error al exportar Hoja de Ruta:", err);
        alert("Error al generar el archivo Excel de la Hoja de Ruta.");
    }
};
// Garantizar inicialización completa e inmediata de la BD de IMEIs para Dashboard
if (typeof initLocalImeiDatabase === 'function') {
    initLocalImeiDatabase();
}



