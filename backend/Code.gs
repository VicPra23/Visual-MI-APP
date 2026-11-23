// ==================================================
// XIAOMI VISUAL APP - Backend V5.1 (Fixed Pro)
// ==================================================

const CONFIG = {
  SS_ID: "1Xht-QU2wRpWNBgT0dqyJkfM9SHD610mhO9y-W3lzonM",
  DRIVE_FOLDER_ID: "1e5uJurcqaTgDGfgHlp2vKyWmpOFhV_-U",
  LOCK_TIMEOUT: 15000,
  SESSION_TTL_SECONDS: 2592000 // 30 días
};

function purgeExpiredSessions() {
  const propStore = PropertiesService.getScriptProperties();
  const props = propStore.getProperties();
  const keys = Object.keys(props);
  if (keys.length <= 40) return;

  const now = Date.now();
  keys.forEach(key => {
    if (key.indexOf('session:') !== 0) return;
    try {
      const parsed = JSON.parse(props[key]);
      if (!parsed || !parsed.expiresAt || now > parsed.expiresAt) {
        propStore.deleteProperty(key);
      }
    } catch (e) {
      propStore.deleteProperty(key);
    }
  });
}

function createSession(user) {
  try {
    purgeExpiredSessions();
  } catch (e) {
    console.warn('purgeExpiredSessions warning:', e);
  }
  const token = Utilities.getUuid() + Utilities.getUuid();
  const session = {
    email: String(user.email || '').trim().toLowerCase(),
    rol: String(user.rol || '').trim().toUpperCase(),
    expiresAt: Date.now() + CONFIG.SESSION_TTL_SECONDS * 1000
  };
  const serialized = JSON.stringify(session);
  CacheService.getScriptCache().put('session:' + token, serialized, CONFIG.SESSION_TTL_SECONDS);
  PropertiesService.getScriptProperties().setProperty('session:' + token, serialized);
  return token;
}

function requireSession(token) {
  if (!token) throw new Error('Sesión no válida o caducada');
  const key = 'session:' + token;
  const cache = CacheService.getScriptCache();
  const serialized = cache.get(key) || PropertiesService.getScriptProperties().getProperty(key);
  if (!serialized) throw new Error('Sesión no válida o caducada');
  try {
    const session = JSON.parse(serialized);
    if (!session.expiresAt || Date.now() > session.expiresAt) {
      cache.remove(key);
      PropertiesService.getScriptProperties().deleteProperty(key);
      throw new Error('Sesión no válida o caducada');
    }
    // Normalmente se resuelve desde caché; Properties solo es respaldo ante
    // una expulsión puntual de la caché.
    cache.put(key, serialized, Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000)));
    return session;
  } catch (e) {
    throw new Error('Sesión no válida o caducada');
  }
}

function doGet(e) {
  const callback = e.parameter.callback;
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SS_ID);
    const action = e.parameter.action;
    
    // Lecturas públicas o tolerantes a sesión (usuarios, dispositivos, materiales, lanzamientos, imeis, estado stock, devoluciones, dashboard)
    const isPublicAction = ['getUserList', 'getDevices', 'getMaterials', 'getLaunches', 'getFeishuImeis', 'getLdusStockStatus', 'getDiagnostics', 'getDevoluciones', 'getDashboardData'].includes(action);
    let session = null;
    if (e.parameter.sessionToken) {
      try { session = requireSession(e.parameter.sessionToken); } catch(sErr) { console.warn('Token sesión no verificado en doGet:', sErr); }
    }
    if (!isPublicAction && !session) {
      session = requireSession(e.parameter.sessionToken);
    }
    let result;
    switch (action) {
      case 'getUserList':
        result = getUserList(ss);
        console.log("getUserList result:", result);
        break;
      case 'getDashboardData':
        result = getDashboardData(ss, session ? session.rol : (e.parameter.rol || 'ADMIN'));
        break;
      case 'getLaunches':
        result = getDataFromSheet(ss, 'Lanzamientos');
        break;
      case 'getMaterials':
        result = getDataFromSheet(ss, 'Materiales');
        break;
      case 'getLaunchStatuses':
        result = getLaunchStatuses(ss, e.parameter.usuario, e.parameter.lanzamiento);
        break;
      case 'getDiagnostics':
        result = getDiagnostics(ss);
        break;
      case 'getDevices':
        result = getDataFromSheet(ss, 'Dispositivos');
        break;
      case 'getMessagingUsers':
        result = getMessagingUsers(ss);
        break;
      case 'getMessages':
        result = getUserMessages(ss, e.parameter.email);
        break;
      case 'getFeishuImeis':
        result = handleGetFeishuImeis(ss);
        break;
      case 'getLdusStockStatus':
        result = handleGetLdusStockStatus(ss);
        break;
      case 'getDevoluciones':
        result = handleGetDevoluciones(ss);
        break;
      default:
        result = { success: false, message: 'Acción GET no válida' };
    }
    return jsonResponse(result, callback);
  } catch (err) {
    return jsonResponse({ success: false, message: 'Error en doGet: ' + err.toString() }, callback);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, message: 'Cuerpo de petición vacío' });
    }
    
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ success: false, message: 'JSON inválido en el cuerpo de la petición: ' + parseErr.toString() });
    }

    const ss = SpreadsheetApp.openById(CONFIG.SS_ID);
    const isOptionalSession = ['login', 'getFeishuImeis', 'getLdusStockStatus', 'getDevoluciones'].includes(data.action);
    const session = isOptionalSession ? null : requireSession(data.sessionToken);
    // Una incidencia nueva siempre entra como Abierta. La transición a
    // Gestionado se controla exclusivamente en resolveIncident y requiere
    // un administrador.
    if (session && data.action === 'submitReport') data.estado = 'Abierta';
    
    switch (data.action) {
      case 'getMaterials':
        return jsonResponse(getDataFromSheet(ss, 'Materiales'));
      case 'login': {
        const loginResult = handleLogin(ss, data.email, data.password);
        if (loginResult.success) loginResult.sessionToken = createSession(loginResult.user);
        return jsonResponse(loginResult);
      }
      case 'submitReport':
        return jsonResponse(handleSubmitReport(ss, data));
      case 'submitLaunchChecklist':
        return jsonResponse(handleSubmitLaunchChecklist(ss, data));
      case 'submitCustomLaunchForm':
        return jsonResponse(handleSubmitCustomLaunchForm(ss, data));
      case 'uploadFile':
        return jsonResponse(handleFileUpload(data));
      case 'resolveIncident':
        return jsonResponse(resolveIncident(ss, data, session));
      case 'getLaunchStatuses':
        return jsonResponse(getLaunchStatuses(ss, data.usuario, data.lanzamiento));
      case 'deleteLaunchValidation':
        return jsonResponse(deleteLaunchValidation(ss, data.id));
      case 'updateLaunchValidation':
        return jsonResponse(updateLaunchValidation(ss, data));
      case 'deleteReport':
        return jsonResponse(deleteReport(ss, data.id));
      case 'getMessagingUsers':
        return jsonResponse(getMessagingUsers(ss));
      case 'sendMessage':
        return jsonResponse(sendInstantMessage(ss, data));
      case 'getMessages':
        return jsonResponse(getUserMessages(ss, data.email));
      case 'markMessageRead':
        return jsonResponse(markInstantMessageRead(ss, data.messageId));
      case 'markAllMessagesRead':
        return jsonResponse(markAllMessagesRead(ss, data.email, data.msgIds));
      case 'updateFeishuImei':
        return jsonResponse(handleUpdateFeishuImei(ss, data));
      case 'bulkUpdateFeishuImeis':
        return jsonResponse(handleBulkUpdateFeishuImeis(ss, data));
      case 'getFeishuImeis':
        return jsonResponse(handleGetFeishuImeis(ss));
      case 'initLdusStockSheet':
        return jsonResponse(handleInitLdusStockSheet(ss, data));
      case 'getLdusStockStatus':
        return jsonResponse(handleGetLdusStockStatus(ss));
      case 'reportTerminalChange':
        return jsonResponse(handleReportTerminalChange(ss, data));
      case 'recordDevolucion':
        return jsonResponse(handleRecordDevolucion(ss, data));
      case 'getDevoluciones':
        return jsonResponse(handleGetDevoluciones(ss));
      case 'syncMissingMMStores':
        return jsonResponse(syncMissingMMStoresToSheet(ss));
      default:
        return jsonResponse({ success: false, message: 'Acción POST no válida: ' + data.action });
    }
  } catch (err) {
    return jsonResponse({ success: false, message: 'Error en doPost: ' + err.toString() });
  }
}

function jsonResponse(data, callback) {
  const output = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + output + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

function generateUUID(prefix) {
  return prefix + "-" + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function getSheetDefensive(ss, name) {
  const sheets = ss.getSheets();
  const lowerName = name.toLowerCase().trim();
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  sheet = sheets.find(s => {
    const sName = s.getName().toLowerCase().trim();
    return sName === lowerName || sName.includes(lowerName) || lowerName.includes(sName);
  });
  return sheet || null;
}

function getDataFromSheet(ss, sheetName) {
  const sheet = getSheetDefensive(ss, sheetName);
  if (!sheet) return [];
  const data = getFastValues(sheet);
  if (data.length <= 1) return [];
  const headers = data.shift();
  
  const tz = ss.getSpreadsheetTimeZone();
  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, tz, "yyyy-MM-dd");
      }
      const key = h.toString().trim();
      obj[key] = val;
      obj['col' + i] = val; // Añadimos acceso directo por índice numérico para robustez
    });
    return obj;
  });
}

function getUserList(ss) {
  const sheet = getSheetDefensive(ss, 'Usuarios');
  if (!sheet) return [];
  const data = getFastValues(sheet);
  if (data.length <= 1) return [];
  data.shift();
  // Estructura: A: Usuario, B: Password, C: Rol
  return data.map(r => ({ email: r[0], nombre: r[0] })).filter(u => u.email);
}

function handleLogin(ss, email, password) {
  const sheet = getSheetDefensive(ss, 'Usuarios');
  if (!sheet) return { success: false, message: 'Error: Hoja Usuarios no encontrada' };
  
  const data = getFastValues(sheet);
  data.shift();
  
  // r[0]: Usuario, r[1]: Password, r[2]: Rol
  const user = data.find(r => String(r[0]).trim().toLowerCase() === String(email).trim().toLowerCase() && String(r[1]).trim() === String(password).trim());
  if (user) {
    const storesSheet = getSheetDefensive(ss, 'Tiendas');
    let userStores = [];
    let debugInfo = {};
    if (storesSheet) {
      const sData = getFastValues(storesSheet);
      const headers = sData.shift();
      const userRole = String(user[2] || '').trim().toUpperCase();
      const userName = String(user[0] || '').trim().toUpperCase();
      const isAdmin = userRole === 'ADMIN' || userRole === 'ADMINISTRADOR' || userRole.indexOf('ADMIN') !== -1 || userRole.indexOf('COORDINAD') !== -1 || userRole.indexOf('SUPER') !== -1 || userRole.indexOf('DIRECC') !== -1 || userRole.indexOf('GESTION') !== -1 || userRole.indexOf('JEFE') !== -1 || userName.indexOf('ALICIA') !== -1 || userName.indexOf('MURUZABAL') !== -1;
      const isAM = !isAdmin && (userRole === 'AM' || userRole.indexOf('MANAGER') !== -1);
      const cleanEmail = String(email || '').trim().toLowerCase();
      
      userStores = sData.filter(r => {
        const storeUser = String(r[3] || '').trim().toLowerCase(); // Columna D (Índice 3) es USUARIO
        const storeAM = String(r[12] || '').trim().toLowerCase(); // Columna M (Índice 12) es AM
        if (isAdmin) {
            return true; // Devolver todas las tiendas para el Admin, pero con la info del usuario incluida
        }
        if (isAM) {
            return storeAM === cleanEmail || (cleanEmail && (storeAM.indexOf(cleanEmail) !== -1 || cleanEmail.indexOf(storeAM) !== -1));
        }
        return storeUser === cleanEmail || (cleanEmail && (storeUser.indexOf(cleanEmail) !== -1 || cleanEmail.indexOf(storeUser) !== -1));
      }).map(r => {
        const storeObj = {
          nombre: r[2],  // Columna C (índice 2) es Tienda (Nombre)
          cuenta: r[1],  // Columna B (índice 1) es Cuenta
          rms: r[0] || '', // Columna A (índice 0) es Codigo RMS
          usuario: r[3] || '', // Columna D (índice 3) es Usuario asignado
          gpv: r[3] || '',
          am: r[12] || '',
          owner: String(r[3] || '').trim() || String(r[4] || '').trim()
        };
        // Mapear el resto de cabeceras dinámicamente (Mesa, Columna, Wall, etc.)
        headers.forEach((header, index) => {
          if (header && String(header).trim() !== '') {
            storeObj[String(header).trim()] = r[index];
          }
        });
        return storeObj;
      });
      
      debugInfo = {
        isAdmin: isAdmin,
        userRole: userRole,
        cleanEmail: cleanEmail,
        totalStoresInSheet: sData.length,
        headers: headers,
        sampleRow: sData[0] || []
      };
    }
    
    return { 
      success: true, 
      user: { 
        nombre: user[0], 
        email: user[0], 
        rol: user[2],
        tiendas: userStores
      },
      debug: debugInfo
    };
  }
  return { success: false, message: 'Usuario o contraseña incorrectos' };
}

function getDashboardData(ss, rol) {
  const mobSheet = getSheetDefensive(ss, 'Reporte mobiliario');
  const devSheet = getSheetDefensive(ss, 'Reporte dispositivo');
  
  let mobReports = getFastValues(mobSheet);
  let devReports = getFastValues(devSheet);
  
  let allReports = [];
  let openTotal = 0;
  let pendingTotal = 0;
  
  const tz = ss.getSpreadsheetTimeZone();

  // Helper defensivo para evitar que enlaces de Drive caigan en tiempo o días en fechaCierre
  function extractStatusTimePhotos(r, idxEstado, idxFechaCierre, idxTiempo, idxFotos) {
    let estado = r[idxEstado] || '';
    let fechaCierre = r[idxFechaCierre] || '';
    let tiempo = r[idxTiempo] || '';
    let fotos = r[idxFotos] || '';

    const sTiempo = String(tiempo || '').trim();
    const sCierre = String(fechaCierre || '').trim();
    const sFotos = String(fotos || '').trim();

    if (sTiempo.includes('http') || sTiempo.includes('drive.google.com') || sTiempo.includes('/d/')) {
      fotos = sTiempo;
      tiempo = '';
    } else if (sCierre.includes('http') || sCierre.includes('drive.google.com') || sCierre.includes('/d/')) {
      fotos = sCierre;
      fechaCierre = '';
    }

    if (tiempo === '' || tiempo === undefined || tiempo === null || isNaN(tiempo)) {
      if (sCierre !== '' && !isNaN(sCierre) && !sCierre.includes('-') && !sCierre.includes('/')) {
        tiempo = Number(sCierre);
        fechaCierre = '';
      } else if (sFotos !== '' && !isNaN(sFotos) && !sFotos.includes('http')) {
        tiempo = Number(sFotos);
      }
    }

    return { estado, fechaCierre, tiempo, fotos };
  }

  // 1. Procesar Mobiliario
  if (mobReports.length > 1) {
    mobReports.shift();
    mobReports.forEach((r, idx) => {
      const hasData = r.some(c => c !== '' && c !== null && c !== undefined);
      if (!hasData) return;
      const id = r[0] ? String(r[0]).trim() : ('MOB_AUTO_' + (idx + 1));
      const parsed = extractStatusTimePhotos(r, 14, 15, 16, 17);
      const est = String(parsed.estado || '').trim().toLowerCase(); 
      if (est === 'abierta') openTotal++;
      if (est === 'gestionado') pendingTotal++;
      
      allReports.push({
        id: id,
        fecha: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, "yyyy-MM-dd HH:mm:ss") : r[1],
        usuario: r[2],
        cuenta: r[3],
        tienda: r[4],
        rms: r[5] || '',
        categoria: 'Mobiliario',
        subcategoria: r[7],
        enviar: r[8] || '',
        motivo: r[9],
        modelo: r[10] || '',
        codigoDispositivo: r[11] || '',
        cantidad: r[12] || '',
        descripcion: r[13] || '', 
        estado: parsed.estado,  
        fechaCierre: parsed.fechaCierre,
        tiempo: parsed.tiempo,  
        fotos: parsed.fotos,
        tipo: `Mobiliario: ${r[7] || ''} > ${r[9] || ''}`
      });
    });
  }

  // 2. Procesar Dispositivo: AGRUPAR POR ID
  if (devReports.length > 1) {
    devReports.shift();
    const devMap = {};
    
    devReports.forEach((r, idx) => {
      const hasData = r.some(c => c !== '' && c !== null && c !== undefined);
      if (!hasData) return;
      const id = r[0] ? String(r[0]).trim() : ('DEV_AUTO_' + (idx + 1));
      const item = {
        tipoReporte: r[2] || '',
        tipologia: r[8] || '',
        modelo: r[9] || '',
        codigoDispositivo: r[10] || '',
        cantidad: r[11] || 1
      };
      
      if (!devMap[id]) {
        const parsed = extractStatusTimePhotos(r, 16, 17, 18, 19);
        const est = String(parsed.estado || '').trim().toLowerCase();
        if (est === 'abierta') openTotal++;
        if (est === 'gestionado') pendingTotal++;
        
        devMap[id] = {
          id: id,
          fecha: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, "yyyy-MM-dd HH:mm:ss") : r[1],
          usuario: r[3],
          cuenta: r[4],
          tienda: r[5],
          rms: r[6] || '',
          categoria: 'Dispositivo',
          tipologia: r[8] || '', 
          subcategoria: r[12],
          enviar: r[13] || '',
          motivo: r[14],
          descripcion: r[15],
          estado: parsed.estado,
          fechaCierre: parsed.fechaCierre,
          tiempo: parsed.tiempo,
          fotos: parsed.fotos,
          dispositivos: [item],
          tipo: `Dispositivo: ${r[12] || ''} > ${r[14] || ''}`
        };
      } else {
        devMap[id].dispositivos.push(item);
      }
    });
    
    // Volcar a allReports
    Object.keys(devMap).forEach(k => allReports.push(devMap[k]));
  }

  // 3. Procesar Pantalla
  const screenSheet = getSheetDefensive(ss, 'Reporte Pantalla');
  let screenReports = screenSheet ? getFastValues(screenSheet) : [];
  if (screenReports.length > 1) {
    screenReports.shift();
    screenReports.forEach((r, idx) => {
      const hasData = r.some(c => c !== '' && c !== null && c !== undefined);
      if (!hasData) return;
      const id = r[0] ? String(r[0]).trim() : ('SCR_AUTO_' + (idx + 1));
      const parsed = extractStatusTimePhotos(r, 8, 9, 10, 11);
      const est = String(parsed.estado || '').trim().toLowerCase();
      if (est === 'abierta') openTotal++;
      if (est === 'gestionado') pendingTotal++;

      allReports.push({
        id: id,
        fecha: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, "yyyy-MM-dd HH:mm:ss") : r[1],
        usuario: r[2],
        cuenta: r[3],
        tienda: r[4],
        rms: r[5] || '',
        categoria: 'Pantalla Digital',
        subcategoria: '',
        enviar: '',
        motivo: '',
        cantidad: 1,
        descripcion: r[7] || '',
        estado: parsed.estado || 'Abierta',
        fechaCierre: parsed.fechaCierre,
        tiempo: parsed.tiempo,
        fotos: parsed.fotos,
        tipo: 'Pantalla Digital'
      });
    });
  }

  // 4. Procesar Lonas
  const lonaSheet = getSheetDefensive(ss, 'Reportes Lonas');
  let lonaReports = lonaSheet ? getFastValues(lonaSheet) : [];
  if (lonaReports.length > 1) {
    lonaReports.shift();
    const lonaMap = {};
    lonaReports.forEach((r, idx) => {
      const hasData = r.some(c => c !== '' && c !== null && c !== undefined);
      if (!hasData) return;
      const id = r[0] ? String(r[0]).trim() : ('LONA_AUTO_' + (idx + 1));
      const item = {
        modelo: r[9] || '',
        codigoDispositivo: r[10] || '',
        cantidad: r[11] || 1
      };
      
      if (!lonaMap[id]) {
        const parsed = extractStatusTimePhotos(r, 14, 15, 16, 17);
        const est = String(parsed.estado || '').trim().toLowerCase();
        if (est === 'abierta') openTotal++;
        if (est === 'gestionado') pendingTotal++;
        
        lonaMap[id] = {
          id: id,
          fecha: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, "yyyy-MM-dd HH:mm:ss") : r[1],
          usuario: r[2],
          cuenta: r[3],
          tienda: r[4],
          rms: r[5] || '',
          categoria: 'Lona',
          tipologia: r[7] || '', 
          subcategoria: r[7] || '',
          enviar: r[12] || '',
          motivo: r[8] || '',
          descripcion: r[13] || '',
          estado: r[14] || 'Abierta',
          fechaCierre: r[15] || '',
          tiempo: r[16] || 0,
          fotos: r[17] || '',
          dispositivos: [item],
          tipo: `Lona: ${r[7] || ''} > ${r[8] || ''}`
        };
      } else {
        lonaMap[id].dispositivos.push(item);
      }
    });
    
    Object.keys(lonaMap).forEach(k => allReports.push(lonaMap[k]));
  }

  // Invertir para tener últimos primero por defecto en array separado de las incidencias de lanzamiento
  allReports = allReports.reverse();

  const incSheet = getSheetDefensive(ss, 'Incidencias Lanzamientos');
  let incidentStats = { total: 0, abiertos: 0, pendientes: 0 };
  let mappedIncidents = [];
  if (incSheet) {
    const incData = getFastValues(incSheet);
    if (incData.length > 1) {
      incData.shift();
      incidentStats.total = incData.length;
      incData.forEach(row => {
        const estado = String(row[8] || '').toLowerCase(); // Index 8 is Estado
        if (estado.includes('abiert') || estado.includes('open')) incidentStats.abiertos++;
        if (estado.includes('pendient')) incidentStats.pendientes++;
      });
      
      mappedIncidents = incData.map((r, idx) => {
        return {
          id: r[0] ? String(r[0]).trim() : ('INC_AUTO_' + (idx + 1)),
          fecha: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, "yyyy-MM-dd HH:mm:ss") : r[1],
          usuario: r[2],
          cuenta: r[3],
          tienda: r[4],
          rms: r[5] || '',
          tipo: 'Lanzamiento: ' + (r[6] || ''),
          cantidad: 1,
          enviar: '',
          descripcion: r[7],
          estado: r[8],
          tiempo: r[9],
          fotos: r[10] || ''
        };
      });
    }
  }

  const valSheet = getSheetDefensive(ss, 'Validaciones de Lanzamiento');
  let launchStats = { total: 0, realizadas: 0, pendientes: 0, conIncidente: 0 };
  if (valSheet) {
    const valData = getFastValues(valSheet);
    if (valData.length > 1) {
      valData.shift();
      launchStats.realizadas = valData.length;
    }
    launchStats.conIncidente = incidentStats.total;
  }

  // Combinar reportes e incidentes de lanzamiento
  let combined = [...allReports, ...mappedIncidents];
  combined.sort((a, b) => {
    const dateA = new Date(String(a.fecha).replace(/-/g, '/'));
    const dateB = new Date(String(b.fecha).replace(/-/g, '/'));
    return dateB - dateA;
  });

  return {
    totalReports: allReports.length + incidentStats.total,
    pendingReports: openTotal + pendingTotal + incidentStats.abiertos + incidentStats.pendientes,
    recentReports: combined,
    incidentStats: incidentStats,
    launchStats: launchStats
  };
}

function getLaunchStatuses(ss, usuario, lanzamiento) {
  const statuses = {};
  
  // Archivos externos de Google Forms
  const idECI = '1jlKgfjJlA44bbPL-SJGqXrhBk0jiRZiJm277EIIEUXM';
  const idMAC = '1kbu29XSbzEzKS7TmC4gUwzP-8gpR98rhL2-YzKB-LGs';
  
  try {
    // 1. Leer Archivo ECI
    try {
      const ssECI = SpreadsheetApp.openById(idECI);
      const sheetECI = ssECI.getSheets()[0];
      if (sheetECI && sheetECI.getLastRow() >= 2) {
        const dataECI = sheetECI.getRange(2, 2, sheetECI.getLastRow() - 1, 1).getValues(); // Columna B (Tienda)
        dataECI.forEach(row => {
          const storeName = String(row[0] || '').trim();
          if (storeName) {
            statuses[storeName] = { estado: 'Realizado' };
          }
        });
      }
    } catch (e) {
      console.error("Error leyendo archivo ECI: " + e);
    }
    
    // 2. Leer Archivo MAC (MM, Alcampo, Carrefour)
    try {
      const ssMAC = SpreadsheetApp.openById(idMAC);
      const sheetMAC = ssMAC.getSheets()[0];
      if (sheetMAC && sheetMAC.getLastRow() >= 2) {
        const dataMAC = sheetMAC.getRange(2, 2, sheetMAC.getLastRow() - 1, 1).getValues(); // Columna B (Tienda)
        dataMAC.forEach(row => {
          const storeName = String(row[0] || '').trim();
          if (storeName) {
            statuses[storeName] = { estado: 'Realizado' };
          }
        });
      }
    } catch (e) {
      console.error("Error leyendo archivo MAC: " + e);
    }
  } catch (globalError) {
      console.error("Error global en getLaunchStatuses externos: " + globalError);
  }
  
  // Sobrescribir/Priorizar incidentes si hay fila abierta en incidencias
  const incSheet = getSheetDefensive(ss, 'Incidencias Lanzamientos');
  if (incSheet) {
    const data = getFastValues(incSheet);
    data.shift();
    data.forEach(r => {
      if (usuario && String(r[2] || '').trim().toLowerCase() !== String(usuario).trim().toLowerCase()) return;
      if (lanzamiento && String(r[12] || '').trim().toLowerCase() !== String(lanzamiento).trim().toLowerCase()) return;
      
      const statusInc = String(r[8] || '').trim().toLowerCase();
      // El flujo de incidencias de lanzamientos se mantiene independiente.
      if (statusInc.includes('abiert') || statusInc.includes('pendient')) {
         // Si no existía en Validaciones lo creamos temporalmente para la vista
         if (!statuses[r[4]]) {
           statuses[r[4]] = {
              tienda: r[4],
              cuenta: r[3],
              lanzamiento: r[12]
           };
         }
         statuses[r[4]].estado = 'Incidente'; 
         statuses[r[4]].incId = r[0]; // Guardamos enlace a la incidencia por si hace falta
      }
    });
  }
  
  return statuses;
}

function handleSubmitReport(ss, data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT);
    
    // 1. Datos maestros compartidos
    let cuenta = '';
    let rms = '';
    let owner = String(data.owner || '').trim();
    const storesSheet = getSheetDefensive(ss, 'Tiendas');
    if (storesSheet) {
      const storesData = getFastValues(storesSheet);
      storesData.shift(); 
    
      if (!owner) {
        const searchTienda = String(data.tienda || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        const storeRow = storesData.find(r => {
          const rowTienda = String(r[2] || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return rowTienda === searchTienda;
        });
        
        if (storeRow) {
          rms = storeRow[0] || '';
          cuenta = storeRow[1] || '';
          owner = String(storeRow[3] || '').trim(); 
          if (!owner) owner = String(storeRow[4] || '').trim();
        }
      } else {
        const searchTienda = String(data.tienda || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const storeRow = storesData.find(r => {
          const rowTienda = String(r[2] || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return rowTienda === searchTienda;
        });
        if (storeRow) {
          rms = storeRow[0] || '';
          cuenta = storeRow[1] || '';
        }
      }
    }
  
    // Si encontramos un owner en Tiendas o vino desde frontend, lo usamos. Si no, usamos el usuario actual.
    const finalUser = owner || data.usuario || '';
    let now = new Date();
    if (data.updateId && data.originalFecha) {
      const parsedOrig = new Date(String(data.originalFecha).replace(/-/g, '/'));
      if (!isNaN(parsedOrig.getTime())) {
        now = parsedOrig;
      }
    }
    const finalPhotos = Array.isArray(data.photos) ? data.photos.join('\n') : (data.photos || '');
    
    const isFurniture = String(data.categoria).toLowerCase() === 'mobiliario';
    const isScreen = String(data.categoria).toLowerCase() === 'pantalla digital';
    const isLona = String(data.categoria).toLowerCase() === 'lona' || String(data.categoria).toLowerCase() === 'lonas';
    const updateId = data.updateId || '';
    
    // LOGICA DE EDICIÓN: Si estamos editando, borramos el rastro previo para machacar los datos limpiamente
    if (updateId) {
      Logger.log("🛠️ [EDIT MODE] Intentando sobreescribir reporte ID: " + updateId);
      const sheetNames = ['Reporte mobiliario', 'Reporte dispositivo', 'Reporte Pantalla', 'Reportes Lonas'];
      sheetNames.forEach(sn => {
        const sh = getSheetDefensive(ss, sn);
        if (sh) {
          const vals = getFastValues(sh);
          let countDeleted = 0;
          // Recorrer del revés para borrar filas de forma segura sin mover índices de las que quedan arriba
          for (let i = vals.length - 1; i >= 1; i--) {
            const rowId = String(vals[i][0] || '').trim().toUpperCase();
            const searchId = String(updateId).trim().toUpperCase();
            if (rowId === searchId && searchId !== "") {
              sh.deleteRow(i + 1);
              countDeleted++;
            }
          }
          if (countDeleted > 0) {
            Logger.log("✅ Filas borradas en '" + sn + "': " + countDeleted);
          }
        }
      });
    }
    
    // Mantenemos el ID original si estamos editando, sino generamos uno nuevo
    const finalId = updateId || generateUUID(isFurniture ? 'REP_M' : (isScreen ? 'REP_P' : (isLona ? 'REP_L' : 'REP_D')));
    
    const formulaTiempo = '';

    if (isFurniture) {
      const sheet = getSheetDefensive(ss, 'Reporte mobiliario');
      if (!sheet) return { success: false, message: 'Hoja "Reporte mobiliario" no encontrada' };
      
      const alarmadoList = (data.motivo === 'ALARMADO' && Array.isArray(data.dispositivos)) ? data.dispositivos : null;
      
      if (alarmadoList && alarmadoList.length > 0) {
        alarmadoList.forEach(item => {
          const row = [
            finalId,
            now,
            finalUser,
            cuenta,
            data.tienda || '',
            rms,
            data.categoria,
            data.subcategoria || '',
            data.enviar || '',  
            data.motivo || '',
            item.modelo || '',
            item.codigoDispositivo || '',
            item.cantidad || '',
            data.descripcion || '',
            data.estado || 'Abierta',
            '', // Fecha Cierre
            formulaTiempo,
            finalPhotos
          ];
          sheet.appendRow(row);
        });
      } else {
        const row = [
          finalId,
          now,
          finalUser,
          cuenta,
          data.tienda || '',
          rms,
          data.categoria,
          data.subcategoria || '',
          data.enviar || '',  
          data.motivo || '',
          data.modelo || '',
          data.codigoDispositivo || '',
          data.cantidad || '',
          data.descripcion || '',
          data.estado || 'Abierta',
          '', // Fecha Cierre
          formulaTiempo,
          finalPhotos
        ];
        sheet.appendRow(row);
      }
      
    } else if (isScreen) {
      const sheet = getSheetDefensive(ss, 'Reporte Pantalla');
      if (!sheet) return { success: false, message: 'Hoja "Reporte Pantalla" no encontrada' };
      
      const row = [
        finalId,                 // 1. ID
        now,                     // 2. Fecha
        finalUser,               // 3. Usuario
        cuenta,                  // 4. Cuenta
        data.tienda || '',       // 5. Tienda
        rms,                     // 6. Código RMS
        data.categoria,          // 7. Categoría
        data.descripcion || '',  // 8. Comentario
        data.estado || 'Abierta',// 9. Estado
        '',                      // 10. Fecha Cierre
        formulaTiempo || 0,      // 11. Tiempo
        finalPhotos              // 12. Fotos
      ];
      sheet.appendRow(row);
      
    } else if (isLona) {
      const sheet = getSheetDefensive(ss, 'Reportes Lonas');
      if (!sheet) return { success: false, message: 'Hoja "Reportes Lonas" no encontrada' };
      
      const lonaList = data.dispositivos || [];
      if (lonaList.length === 0) return { success: false, message: 'No se seleccionaron modelos de lona.' };
      
      lonaList.forEach(item => {
        const row = [
          finalId,                 // 1. ID
          now,                     // 2. Fecha
          finalUser,               // 3. Usuario
          cuenta,                  // 4. Cuenta
          data.tienda || '',       // 5. Tienda
          rms,                     // 6. Código RMS
          data.categoria,          // 7. Categoría
          data.tipologia || '',    // 8. Tipología
          data.motivo || '',       // 9. Motivo
          item.modelo || '',       // 10. Modelo
          item.codigoDispositivo || '', // 11. Código Dispositivo
          item.cantidad || 1,      // 12. Cantidad
          data.enviar || '',       // 13. Enviar
          data.descripcion || '',  // 14. Comentario
          data.estado || 'Abierta',// 15. Estado
          '',                      // 16. Fecha Cierre
          formulaTiempo || 0,      // 17. Tiempo
          finalPhotos              // 18. Fotos
        ];
        sheet.appendRow(row);
      });
      
    } else {
      const sheet = getSheetDefensive(ss, 'Reporte dispositivo');
      if (!sheet) return { success: false, message: 'Hoja "Reporte dispositivo" no encontrada' };
      
      const deviceList = data.dispositivos || [];
      if (deviceList.length === 0) return { success: false, message: 'No se seleccionaron dispositivos.' };
      
      deviceList.forEach(item => {
        const row = [
          finalId,
          now,
          item.tipoReporte || '',
          finalUser,
          cuenta,
          data.tienda || '',
          rms,
          data.categoria,
          data.tipologia || '',
          item.modelo || '',
          item.codigoDispositivo || '',
          item.cantidad || 1,
          data.subcategoria || '',
          data.enviar || '', 
          data.motivo || '',
          data.descripcion || '',
          data.estado || 'Abierta',
          '', // Fecha Cierre
          formulaTiempo,
          finalPhotos
        ];
        sheet.appendRow(row);
      });
    }
    
    return { success: true };
  } catch (e) {
    return { success: false, message: 'Error (Lock/Write): ' + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function handleSubmitCustomLaunchForm(mainSs, data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT);
    
    let targetSsId = '';
    const cuenta = String(data.cuenta).trim().toUpperCase();
    if (cuenta === 'ECI') {
      targetSsId = '1jlKgfjJlA44bbPL-SJGqXrhBk0jiRZiJm277EIIEUXM';
    } else {
      targetSsId = '1kbu29XSbzEzKS7TmC4gUwzP-8gpR98rhL2-YzKB-LGs';
    }
    
    const targetSs = SpreadsheetApp.openById(targetSsId);
    const targetSheet = targetSs.getSheets()[0];
    if (!targetSheet) throw new Error("Hoja de respuestas no encontrada en el destino.");
    
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
    
    let rowData = [];
    if (cuenta === 'ECI' || cuenta === 'EL CORTE INGLES' || cuenta === 'EL CORTE INGLÉS') {
      rowData = [
        timestamp,
        data.tienda,
        data.q_lampara,
        data.q_ldu,
        data.q_dummy,
        data.q_eco,
        data.q_filmina,
        data.q_lonas,
        data.q_wall,
        data.q_column,
        data.q_fichas,
        data.q_incidencias,
        data.q_escalerilla || 'No aplica', // 13. Has implantado la escalerilla
        data.photos, // 14. Sube fotos completas
        '' // 15. Foto de la escalerilla (dejamos vacío por ahora ya que se suben juntas)
      ];
    } else {
      rowData = [
        timestamp,
        data.tienda,
        data.q_lampara,
        data.q_ldu,
        data.q_dummy,
        data.q_eco,
        data.q_filmina,
        data.q_lonas,
        data.q_wall,
        data.q_column,
        data.q_fichas,
        data.q_incidencias,
        data.photos // 13. Sube fotos
      ];
    }
    
    targetSheet.appendRow(rowData);
    
    return { success: true };
  } catch(e) {
    return { success: false, message: e.message };
  } finally {
    lock.releaseLock();
  }
}

function handleSubmitLaunchChecklist(ss, data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT);
    const valSheet = getSheetDefensive(ss, 'Validaciones de Lanzamiento');
    const incSheet = getSheetDefensive(ss, 'Incidencias Lanzamientos');
    
    // Buscar el dueño (USUARIO) de la Tienda en la hoja 'Tiendas'
    let owner = '';
    const storesSheet = getSheetDefensive(ss, 'Tiendas');
    if (storesSheet) {
      const storesData = getFastValues(storesSheet);
      storesData.shift(); // remover cabecera
      const storeRow = storesData.find(r => String(r[2]).trim().toLowerCase() === String(data.tienda).trim().toLowerCase());
      if (storeRow) {
        owner = storeRow[3] || ''; // Columna D: USUARIO asignado a la tienda
      }
    }
    
    const finalUser = owner || data.usuario || '';
    
    // 1. Fila para Validaciones de Lanzamiento (9 columnas):
    // ID (0), Fecha (1), Columna C: Usuario (2), Cuenta (3), Tienda (4), Código RMS (5), ¿Instalación OK? (6), Comentario (7), Fotos (8)
    const valRow = [
      generateUUID('VAL'),                      // ID (0)
      new Date(),                               // Fecha (1)
      finalUser,                                // Usuario (dueño de la tienda) (2)
      data.cuenta || '',                        // Cuenta (3)
      data.tienda || '',                        // Tienda (4)
      data.rms || '',                           // Código RMS (5)
      data.instalacionOk ? 'OK' : 'Error',      // ¿Instalación OK? (6)
      data.descripcion || '',                   // Comentario (7)
      Array.isArray(data.photos) ? data.photos.join('\n') : (data.photos || ''), // Fotos (8)
      '',                                       // (9)
      '',                                       // (10)
      '',                                       // (11)
      data.lanzamiento || ''                    // Lanzamiento (12)
    ];
    
    // 2. Fila para Incidencias Lanzamientos (13 columnas):
    // ID (0), Fecha (1), Usuario (2), Cuenta (3), Tienda (4), Código RMS (5), Ruta Incidencia (6), Comentario (7), Estado (8), Tiempo (9), Fotos (10), Lanzamiento (12)
    const formulaTiempo = '';

    const incRow = [
      generateUUID('INC'),                      
      new Date(),                               
      finalUser,                                
      data.cuenta || '',                        
      data.tienda || '',                        
      data.rms || '',                           
      data.incidentPath || '',                  
      data.descripcion || '',                   
      'Abierta',                                
      formulaTiempo,
      Array.isArray(data.photos) ? data.photos.join('\n') : (data.photos || ''), 
      '',                                       
      data.lanzamiento || ''                    
    ];
    
    if (valSheet) valSheet.appendRow(valRow);
    if (data.isIncident && incSheet) incSheet.appendRow(incRow);
    
    return { success: true };
  } catch (e) {
    return { success: false, message: 'Error (Lock/Write): ' + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function handleFileUpload(data) {
  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const blob = Utilities.newBlob(Utilities.base64Decode(data.base64), data.mimeType, data.fileName);
    const file = folder.createFile(blob);
    
    const fileSize = file.getSize();
    Logger.log("📁 [FILE UPLOAD] Archivo creado con éxito: '" + data.fileName + "' (" + fileSize + " bytes) en ID: " + file.getId());
    
    let sharingWarning = "";
    // Intento defensivo de compartir por políticas de dominio corporativo (Salesland)
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      Logger.log("✅ Compartido públicamente: Anyone with link.");
    } catch (sharingError) {
      try {
        file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
        Logger.log("⚠️ Bloqueo Público. Compartido en dominio corporativo: Domain with link.");
      } catch (domError) {
        sharingWarning = "POLITICA_BLOQUEADA: El administrador de Google Workspace restringe el compartido externo de archivos programáticamente.";
        Logger.log("🚨 ERROR CRÍTICO COMPARTIDO: " + sharingWarning);
      }
    }
    
    return { 
      success: true, 
      url: file.getUrl(),
      fileId: file.getId(),
      size: fileSize,
      warning: sharingWarning
    };
  } catch (e) {
    Logger.log("❌ ERROR en handleFileUpload: " + e.toString());
    return { success: false, error: e.toString() };
  }
}

// ==================================================
// UTILITY: Convertir contraseñas a SHA-256
// Ejecuta esta función manualmente desde Apps Script 
// para encriptar las contraseñas actuales de la hoja Usuarios.
// ==================================================
function hashAllPasswords() {
  const ss = SpreadsheetApp.openById(CONFIG.SS_ID);
  const sheet = getSheetDefensive(ss, 'Usuarios');
  if (!sheet) return;
  
  const data = getFastValues(sheet);
  for (let i = 1; i < data.length; i++) {
    const plainPass = String(data[i][1] || '').trim();
    // Solo hashea si la contraseña no parece estar ya hasheada (un hash SHA-256 tiene 64 caracteres)
    if (plainPass && plainPass.length < 60) {
      const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, plainPass);
      let txtHash = '';
      for (let j = 0; j < rawHash.length; j++) {
        let hashVal = rawHash[j];
        if (hashVal < 0) {
          hashVal += 256;
        }
        if (hashVal.toString(16).length == 1) {
          txtHash += '0';
        }
        txtHash += hashVal.toString(16);
      }
      // Sobrescribe la columna B (índice 2 en formato R1C1) con el Hash
      sheet.getRange(i + 1, 2).setValue(txtHash);
    }
  }
}

// Ejecutar una única vez desde Apps Script después de desplegar esta versión.
// Solo modifica las columnas Estado de los cuatro reportes; no toca mensajes
// ni el flujo independiente de lanzamientos.
function migrateIncidentStatuses() {
  const ss = SpreadsheetApp.openById(CONFIG.SS_ID);
  const targets = [
    ['Reporte mobiliario', 15],
    ['Reporte dispositivo', 17],
    ['Reporte Pantalla', 9],
    ['Reportes Lonas', 15]
  ];
  let updated = 0;
  const details = {};

  targets.forEach(([sheetName, statusColumn]) => {
    const sheet = getSheetDefensive(ss, sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;
    const range = sheet.getRange(2, statusColumn, sheet.getLastRow() - 1, 1);
    const values = range.getValues();
    let changed = 0;
    values.forEach(row => {
      const status = String(row[0] || '').trim().toLowerCase();
      if (status === 'pendiente') {
        row[0] = 'Gestionado';
        changed++;
      } else if (status === 'cerrado' || status === 'cerrada') {
        // El flujo ya no contempla "Cerrado"; sus incidencias finalizadas
        // pasan al estado final único, "Solucionado".
        row[0] = 'Solucionado';
        changed++;
      }
    });
    if (changed) range.setValues(values);
    details[sheetName] = changed;
    updated += changed;
  });

  return { success: true, updated: updated, details: details };
}

function getDiagnostics(ss) {
  const sheets = ss.getSheets();
  const info = {};
  sheets.forEach(s => {
    const name = s.getName();
    const data = getFastValues(s);
    info[name] = {
      totalRows: data.length,
      columnsCount: data[0] ? data[0].length : 0,
      headers: data[0] || [],
      firstRow: data[1] || []
    };
  });
  return { success: true, sheets: info };
}

function resolveIncident(ss, data, session) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    
    const id = data.id;
    const status = String(data.estado || data.status || 'Solucionado').trim();
    const sessRol = String(session && session.rol || '').trim().toUpperCase();
    const sessEmail = String(session && session.email || '').trim().toUpperCase();
    const isAdmin = sessRol === 'ADMIN' || sessRol === 'ADMINISTRADOR' || sessRol.indexOf('ADMIN') !== -1 || sessRol.indexOf('COORDINAD') !== -1 || sessRol.indexOf('SUPER') !== -1 || sessRol.indexOf('DIRECC') !== -1 || sessRol.indexOf('GESTION') !== -1 || sessRol.indexOf('JEFE') !== -1 || sessEmail.indexOf('ALICIA') !== -1 || sessEmail.indexOf('MURUZABAL') !== -1;
    if (!['Abierta', 'Gestionado', 'Solucionado'].includes(status)) {
      return { success: false, error: 'Estado de incidencia no válido' };
    }
    if (status === 'Gestionado' && !isAdmin) {
      return { success: false, error: 'Solo un administrador puede marcar una incidencia como gestionada' };
    }
    const newPhotos = Array.isArray(data.photos) ? data.photos.join('\n') : (data.photos || '');
    
    function calculateDaysFromDate(dateVal) {
      if (!dateVal) return 0;
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 0;
      return Math.floor(Math.abs(Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    }

    // 1. Buscar en pestaña 'Reporte mobiliario'
    const mobSheet = getSheetDefensive(ss, 'Reporte mobiliario');
    if (mobSheet) {
      const reports = getFastValues(mobSheet);
      for (let i = 1; i < reports.length; i++) {
        if (String(reports[i][0]).trim() === String(id).trim()) {
          mobSheet.getRange(i + 1, 15).setValue(status); // Columna O (índice 14) es Estado
          if (status === 'Solucionado') {
            mobSheet.getRange(i + 1, 16).setValue(Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone() || "GMT", "yyyy-MM-dd HH:mm:ss")); // Columna P (índice 15) es Fecha Cierre
            mobSheet.getRange(i + 1, 17).setValue(calculateDaysFromDate(reports[i][1])); // Columna Q (índice 16) es Tiempo
          } else {
            mobSheet.getRange(i + 1, 16).setValue('');
            mobSheet.getRange(i + 1, 17).setValue('');
          }
          if (newPhotos) {
            const oldPhotos = reports[i][17] || ''; // Columna R (índice 17) es Fotos
            const combinedPhotos = oldPhotos ? oldPhotos + '\n' + newPhotos : newPhotos;
            mobSheet.getRange(i + 1, 18).setValue(combinedPhotos);
          }
          return { success: true };
        }
      }
    }

    // 2. Buscar en pestaña 'Reporte dispositivo'
    const devSheet = getSheetDefensive(ss, 'Reporte dispositivo');
    if (devSheet) {
      const reports = getFastValues(devSheet);
      let foundAny = false;
      for (let i = 1; i < reports.length; i++) {
        if (String(reports[i][0]).trim() === String(id).trim()) {
          foundAny = true;
          devSheet.getRange(i + 1, 17).setValue(status); // Columna Q (índice 16) es Estado
          if (status === 'Solucionado') {
            devSheet.getRange(i + 1, 18).setValue(Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone() || "GMT", "yyyy-MM-dd HH:mm:ss")); // Columna R (índice 17) es Fecha Cierre
            devSheet.getRange(i + 1, 19).setValue(calculateDaysFromDate(reports[i][1])); // Columna S (índice 18) es Tiempo
          } else {
            devSheet.getRange(i + 1, 18).setValue('');
            devSheet.getRange(i + 1, 19).setValue('');
          }
          if (newPhotos) {
            const oldPhotos = reports[i][19] || ''; // Columna T (índice 19) es Fotos
            const combinedPhotos = oldPhotos ? oldPhotos + '\n' + newPhotos : newPhotos;
            devSheet.getRange(i + 1, 20).setValue(combinedPhotos);
          }
        }
      }
      if (foundAny) return { success: true };
    }
    
    // 3. Buscar en pestaña 'Reportes Lonas'
    const lonaSheet = getSheetDefensive(ss, 'Reportes Lonas');
    if (lonaSheet) {
      const reports = getFastValues(lonaSheet);
      let foundAny = false;
      for (let i = 1; i < reports.length; i++) {
        if (String(reports[i][0]).trim() === String(id).trim()) {
          foundAny = true;
          lonaSheet.getRange(i + 1, 15).setValue(status); // Columna O (índice 14) es Estado
          if (status === 'Solucionado') {
            lonaSheet.getRange(i + 1, 16).setValue(Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone() || "GMT", "yyyy-MM-dd HH:mm:ss")); // Columna P (índice 15) es Fecha Cierre
            lonaSheet.getRange(i + 1, 17).setValue(calculateDaysFromDate(reports[i][1])); // Columna Q (índice 16) es Tiempo
          } else {
            lonaSheet.getRange(i + 1, 16).setValue('');
            lonaSheet.getRange(i + 1, 17).setValue('');
          }
          if (newPhotos) {
            const oldPhotos = reports[i][17] || ''; // Columna R (índice 17) es Fotos
            const combinedPhotos = oldPhotos ? oldPhotos + '\n' + newPhotos : newPhotos;
            lonaSheet.getRange(i + 1, 18).setValue(combinedPhotos);
          }
        }
      }
      if (foundAny) return { success: true };
    }
    
    // 4. Buscar en pestaña 'Reporte Pantalla'
    const screenSheet = getSheetDefensive(ss, 'Reporte Pantalla');
    if (screenSheet) {
      const reports = getFastValues(screenSheet);
      let foundAny = false;
      for (let i = 1; i < reports.length; i++) {
        if (String(reports[i][0]).trim() === String(id).trim()) {
          foundAny = true;
          screenSheet.getRange(i + 1, 9).setValue(status); // Columna I (índice 8) es Estado
          if (status === 'Solucionado') {
            screenSheet.getRange(i + 1, 10).setValue(Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone() || "GMT", "yyyy-MM-dd HH:mm:ss")); // Columna J (índice 9) es Fecha Cierre
            screenSheet.getRange(i + 1, 11).setValue(calculateDaysFromDate(reports[i][1])); // Columna K (índice 10) es Tiempo
          } else {
            screenSheet.getRange(i + 1, 10).setValue('');
            screenSheet.getRange(i + 1, 11).setValue('');
          }
          if (newPhotos) {
            const oldPhotos = reports[i][11] || ''; // Columna L (índice 11) es Fotos
            const combinedPhotos = oldPhotos ? oldPhotos + '\n' + newPhotos : newPhotos;
            screenSheet.getRange(i + 1, 12).setValue(combinedPhotos);
          }
        }
      }
      if (foundAny) return { success: true };
    }
    
    // 5. Buscar en pestaña 'Incidencias Lanzamientos'
    const incSheet = getSheetDefensive(ss, 'Incidencias Lanzamientos');
    if (incSheet) {
      const incs = getFastValues(incSheet);
      for (let i = 1; i < incs.length; i++) {
        if (String(incs[i][0]).trim() === String(id).trim()) {
          incSheet.getRange(i + 1, 9).setValue(status); // Columna I (índice 8) es Estado
          if (status === 'Solucionado') {
            incSheet.getRange(i + 1, 10).setValue(calculateDaysFromDate(incs[i][1])); // Congelar tiempo
          } else {
            incSheet.getRange(i + 1, 10).setValue('');
          }
          if (newPhotos) {
            const oldPhotos = incs[i][10] || ''; // Columna K (índice 10) es Fotos
            const combinedPhotos = oldPhotos ? oldPhotos + '\n' + newPhotos : newPhotos;
            incSheet.getRange(i + 1, 11).setValue(combinedPhotos);
          }
          return { success: true };
        }
      }
    }
    
    return { success: false, error: 'ID de reporte no encontrado' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * DISPARADOR AUTOMÁTICO DE HOJA DE CÁLCULO (Google Sheets onEdit)
 * Se ejecuta automáticamente cada vez que un usuario edita manualmente una celda en Google Sheets / Excel.
 * Automatiza el registro de Fecha Cierre y el recálculo de Tiempo.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  
  let colEstado = -1;
  let colFechaCierre = -1;
  let colTiempo = -1;
  let colFecha = 2; // Columna B es Fecha en todas
  
  if (sheetName === 'Reporte mobiliario' || sheetName === 'Reportes Lonas') {
    colEstado = 15;      // Col O
    colFechaCierre = 16;  // Col P
    colTiempo = 17;       // Col Q
  } else if (sheetName === 'Reporte dispositivo') {
    colEstado = 17;      // Col Q
    colFechaCierre = 18;  // Col R
    colTiempo = 19;       // Col S
  } else if (sheetName === 'Reporte Pantalla') {
    colEstado = 9;       // Col I
    colFechaCierre = 10;  // Col J
    colTiempo = 11;      // Col K
  } else {
    return; // No es una de las hojas de reportes
  }
  
  const startRow = e.range.getRow();
  const numRows = e.range.getNumRows();
  const startCol = e.range.getColumn();
  const numCols = e.range.getNumColumns();
  const endRow = startRow + numRows - 1;
  const endCol = startCol + numCols - 1;
  
  const tz = sheet.getParent().getSpreadsheetTimeZone() || "GMT";
  
  for (let r = Math.max(2, startRow); r <= endRow; r++) {
    // Caso 1: El usuario editó la columna de Estado
    if (startCol <= colEstado && endCol >= colEstado) {
      const val = String(sheet.getRange(r, colEstado).getValue() || '').trim().toLowerCase();
      const isClosed = (val === 'solucionado' || val === 'cerrado' || val === 'cerrada');
      
      if (isClosed) {
        // Si la fecha de cierre está vacía, poner fecha/hora actual
        const currentFechaCierre = sheet.getRange(r, colFechaCierre).getValue();
        const closeDate = currentFechaCierre ? new Date(currentFechaCierre) : new Date();
        if (!currentFechaCierre) {
          sheet.getRange(r, colFechaCierre).setValue(Utilities.formatDate(closeDate, tz, "yyyy-MM-dd HH:mm:ss"));
        }
        // Calcular días transcurridos entre Columna 2 (Fecha) y closeDate
        const fechaCreacion = sheet.getRange(r, colFecha).getValue();
        if (fechaCreacion) {
          const dCreacion = new Date(fechaCreacion);
          if (!isNaN(dCreacion.getTime())) {
            const diffDays = Math.max(0, Math.floor(Math.abs(closeDate.getTime() - dCreacion.getTime()) / (1000 * 60 * 60 * 24)));
            sheet.getRange(r, colTiempo).setValue(diffDays);
          }
        }
      } else if (val === 'abierta' || val === 'abierto' || val === 'gestionado') {
        // Reabierto: Limpiar fecha de cierre y tiempo congelado
        sheet.getRange(r, colFechaCierre).setValue('');
        sheet.getRange(r, colTiempo).setValue('');
      }
    }
    
    // Caso 2: El usuario editó manualmente la columna de Fecha Cierre
    if (startCol <= colFechaCierre && endCol >= colFechaCierre) {
      const cierreVal = sheet.getRange(r, colFechaCierre).getValue();
      if (cierreVal) {
        const dCierre = new Date(cierreVal);
        const fechaCreacion = sheet.getRange(r, colFecha).getValue();
        if (fechaCreacion && !isNaN(dCierre.getTime())) {
          const dCreacion = new Date(fechaCreacion);
          if (!isNaN(dCreacion.getTime())) {
            const diffDays = Math.max(0, Math.floor(Math.abs(dCierre.getTime() - dCreacion.getTime()) / (1000 * 60 * 60 * 24)));
            sheet.getRange(r, colTiempo).setValue(diffDays);
          }
        }
      }
    }
  }
}

/**
 * Utilidad para recalcular masivamente todas las incidencias 'Solucionado' existentes
 * en las 4 hojas que tengan Fecha Cierre o Tiempo vacío.
 */
function recalculateAllClosedReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsConfig = [
    { name: 'Reporte mobiliario', colEstado: 15, colFechaCierre: 16, colTiempo: 17, colFecha: 2 },
    { name: 'Reporte dispositivo', colEstado: 17, colFechaCierre: 18, colTiempo: 19, colFecha: 2 },
    { name: 'Reporte Pantalla', colEstado: 9, colFechaCierre: 10, colTiempo: 11, colFecha: 2 },
    { name: 'Reportes Lonas', colEstado: 15, colFechaCierre: 16, colTiempo: 17, colFecha: 2 }
  ];
  
  const tz = ss.getSpreadsheetTimeZone() || "GMT";
  let countUpdated = 0;
  
  sheetsConfig.forEach(cfg => {
    const sh = ss.getSheetByName(cfg.name);
    if (!sh) return;
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const est = String(row[cfg.colEstado - 1] || '').trim().toLowerCase();
      if (est === 'solucionado' || est === 'cerrado' || est === 'cerrada') {
        let fCierre = row[cfg.colFechaCierre - 1];
        let dCierre = fCierre ? new Date(fCierre) : new Date();
        if (!fCierre) {
          fCierre = Utilities.formatDate(dCierre, tz, "yyyy-MM-dd HH:mm:ss");
          sh.getRange(i + 1, cfg.colFechaCierre).setValue(fCierre);
        }
        const fCreacion = row[cfg.colFecha - 1];
        if (fCreacion) {
          const dCreacion = new Date(fCreacion);
          if (!isNaN(dCreacion.getTime()) && !isNaN(dCierre.getTime())) {
            const diffDays = Math.max(0, Math.floor(Math.abs(dCierre.getTime() - dCreacion.getTime()) / (1000 * 60 * 60 * 24)));
            sh.getRange(i + 1, cfg.colTiempo).setValue(diffDays);
            countUpdated++;
          }
        }
      }
    }
  });
  Logger.log("✅ Recálculo completado: " + countUpdated + " reportes actualizados.");
  return countUpdated;
}

/**
 * Borra una validación de la hoja de excel por ID.
 */
function deleteLaunchValidation(ss, id) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT);
    const sheet = getSheetDefensive(ss, 'Validaciones de Lanzamiento');
    if (!sheet) return { success: false, error: 'Hoja no encontrada' };
    
    const data = getFastValues(sheet);
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: 'ID no encontrado en validaciones.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Actualiza un registro de validación (Comentario, Fotos, Estado).
 */
function updateLaunchValidation(ss, data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT);
    const sheet = getSheetDefensive(ss, 'Validaciones de Lanzamiento');
    if (!sheet) return { success: false, error: 'Hoja no encontrada' };
    
    const sheetData = getFastValues(sheet);
    for (let i = 1; i < sheetData.length; i++) {
      if (String(sheetData[i][0]) === String(data.id)) {
        // Si envían fotos, las sobrescribimos o anexamos? Asumo sobrescribir para esta edición
        if (data.fotos) sheet.getRange(i + 1, 9).setValue(data.fotos); // Col I (índice 8)
        if (data.comentario !== undefined) sheet.getRange(i + 1, 8).setValue(data.comentario); // Col H (índice 7)
        
        // Actualizar Instalación OK status (Columna G -> Indice 6)
        if (data.instalacionOk) sheet.getRange(i + 1, 7).setValue(data.instalacionOk); // 'OK' o 'Error'
        
        return { success: true };
      }
    }
    return { success: false, error: 'ID no encontrado para actualizar.' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Borra permanentemente un reporte de la hoja correspondiente por su ID
 */
function deleteReport(ss, id) {
  if (!id) return { success: false, error: 'ID requerido' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT);
    const sheetsToCheck = ['Reporte mobiliario', 'Reporte dispositivo', 'Reporte Pantalla', 'Reportes Lonas', 'Incidencias Lanzamientos'];
    let deletedAny = false;
    sheetsToCheck.forEach(sn => {
      const sheet = getSheetDefensive(ss, sn);
      if (!sheet) return;
      const vals = getFastValues(sheet);
      for (let i = vals.length - 1; i >= 1; i--) {
        if (String(vals[i][0]).trim() === String(id).trim()) {
          sheet.deleteRow(i + 1);
          deletedAny = true;
        }
      }
    });
    return deletedAny ? { success: true } : { success: false, error: 'No encontrado' };
  } catch (e) { return { success: false, error: e.toString() }; } finally { lock.releaseLock(); }
}

/**
 * LEE LOS DATOS DE FORMA COMPLETA Y ROBUSTA SIN LIMITACIÓN DE FILAS
 * Lee hasta la última fila y columna con contenido real de la hoja,
 * sin depender exclusivamente de la Columna A ni quedar limitado por rangos fijos.
 */
function getFastValues(sheet) {
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return [];
  
  // Leemos todo el rango de datos reales hasta la última fila detectada
  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  
  // Limpieza defensiva de filas completamente vacías al final
  while (values.length > 0) {
    const last = values[values.length - 1];
    const hasData = last.some(cell => cell !== '' && cell !== null && cell !== undefined);
    if (hasData) break;
    values.pop();
  }
  return values;
}

// ==================================================
// NUEVO: MÓDULO PREMIUM DE MENSAJERÍA INTERNA
// ==================================================

function getOrCreateMessagesSheet(ss) {
  let sheet = ss.getSheetByName('Mensajes');
  if (!sheet) {
    sheet = ss.insertSheet('Mensajes');
    sheet.appendRow(['ID', 'Fecha', 'Remitente', 'Destinatario', 'Mensaje', 'Leido', 'Motivo']);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#ffe6cc');
  }
  return sheet;
}

function getMessagingUsers(ss) {
  const sheet = getSheetDefensive(ss, 'Usuarios');
  if (!sheet) return { success: false, error: 'Hoja Usuarios no encontrada' };
  
  const data = getFastValues(sheet);
  data.shift(); // Remover cabecera
  
  const users = data.map(r => ({
    email: String(r[0] || '').trim(),
    rol: String(r[2] || '').trim().toUpperCase()
  })).filter(u => u.email);
  
  return { success: true, users: users };
}

function sendInstantMessage(ss, data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = getOrCreateMessagesSheet(ss);
    
    const id = 'MSG_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const fecha = new Date().toISOString();
    const remitente = String(data.remitente || '').trim();
    const destinatario = String(data.destinatario || '').trim();
    const mensaje = String(data.mensaje || '').trim();
    const motivo = String(data.motivo || '').trim();
    const leido = 'Pendiente';
    
    if (!remitente || !destinatario || !mensaje) {
      return { success: false, error: 'Campos incompletos' };
    }
    
    sheet.appendRow([id, fecha, remitente, destinatario, mensaje, leido, motivo]);
    SpreadsheetApp.flush(); // Forzar guardado en disco inmediato antes de liberar bloqueo
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function markAllMessagesRead(ss, email, msgIdsStr) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = getOrCreateMessagesSheet(ss);
    
    const data = getFastValues(sheet);
    let modified = false;
    
    // Normalizar: quitar acentos y caracteres especiales para un cruce robusto (con failsafe por si V8 falla)
    const normalizeStr = (str) => {
      if (!str) return '';
      let s = String(str).toLowerCase();
      try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch(e) {}
      return s.replace(/[^a-z0-9]/g, '');
    };
    
    const targetEmail = normalizeStr(email);
    let targetIds = [];
    if (msgIdsStr) {
      try {
        targetIds = JSON.parse(msgIdsStr);
      } catch (e) {}
    }
    
    // Iteramos al revés por si queremos parar antes, o simplemente lo recorremos todo
    for (let i = 1; i < data.length; i++) {
      const msgId = String(data[i][0] || '').trim();
      const dest = normalizeStr(data[i][3]);
      let estadoNorm = normalizeStr(data[i][5]);
      
      // Si nos pasaron IDs exactos, los usamos. Si no, usamos el fallback del email
      let shouldMark = false;
      if (targetIds.length > 0) {
        shouldMark = targetIds.includes(msgId);
      } else {
        shouldMark = targetEmail && dest && (dest.includes(targetEmail) || targetEmail.includes(dest)) && estadoNorm !== 'leido';
      }
      
      if (shouldMark && estadoNorm !== 'leido') {
        sheet.getRange(i + 1, 6).setValue('Leido');
        modified = true;
      }
    }
    
    return { success: true, modified: modified };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function getUserMessages(ss, email) {
  const sheet = getOrCreateMessagesSheet(ss);
  const data = getFastValues(sheet);
  const cleanEmail = String(email || '').trim().toLowerCase();
  
  // Estadísticas de telemetría activas para el panel del frontend
  const debugStats = {
    filasTotales: data.length,
    emailBuscado: cleanEmail,
    columnas: sheet.getLastColumn()
  };
  
  if (data.length <= 1) {
    return { success: true, messages: [], debug: debugStats };
  }
  
  const rawRows = [...data];
  data.shift(); // Quitar cabecera
  
  const userMsgs = data.filter(r => {
    const from = String(r[2] || '').trim().toLowerCase();
    const to = String(r[3] || '').trim().toLowerCase();
    return from === cleanEmail || to === cleanEmail;
  }).map(r => ({
    id: r[0],
    fecha: r[1],
    remitente: r[2],
    destinatario: r[3],
    mensaje: r[4],
    leido: r[5],
    motivo: r[6] || ''
  }));
  
  // Ordenar cronológico descendente
  userMsgs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  
  debugStats.filtrados = userMsgs.length;
  if (rawRows.length > 1) {
    debugStats.primerRegistro = `De: "${rawRows[1][2]}" | Para: "${rawRows[1][3]}"`;
  }
  
  return { 
    success: true, 
    messages: userMsgs,
    debug: debugStats 
  };
}

function markInstantMessageRead(ss, messageId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = getOrCreateMessagesSheet(ss);
    const data = getFastValues(sheet);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === messageId) {
        sheet.getRange(i + 1, 6).setValue('Leido');
        return { success: true };
      }
    }
    return { success: false, error: 'Mensaje no encontrado' };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==================================================
// REPLICACIÓN Y GESTIÓN DE LDUS DUMMY STOCK Y DEVOLUCIONES EN GOOGLE SHEETS
// Pestañas maestras: 'LDUS DUMMY STOCK' y 'DEVOLUCIONES'
// ==================================================

function getLdusStockSheet(ss) {
  let sheet = getSheetDefensive(ss, 'LDUS DUMMY STOCK');
  if (!sheet) sheet = getSheetDefensive(ss, 'LDUS DUMMY STORE');
  return sheet;
}

function ensureLdusStockSheet(ss) {
  let sheet = getLdusStockSheet(ss);
  if (!sheet) {
    sheet = ss.insertSheet('LDUS DUMMY STOCK');
    sheet.appendRow([
      'Retailer', 'StoreCode', 'Tienda', 'Nº mesas', 'Mesa', 'Producto (listado)',
      'IMEI', 'Estado', 'Otros IMEI (unidades adicionales)', 'Observación'
    ]);
  }
  return sheet;
}

function getDevolucionesSheet(ss) {
  return getSheetDefensive(ss, 'DEVOLUCIONES');
}

function ensureDevolucionesSheet(ss) {
  let sheet = getDevolucionesSheet(ss);
  if (!sheet) {
    sheet = ss.insertSheet('DEVOLUCIONES');
    sheet.appendRow([
      'Retailer', 'StoreCode', 'Tienda', 'Dispositivo', 'FechaCheck',
      'IMEI', 'Estado', 'Mueble', 'Devoluciones FF', 'Tio de producto'
    ]);
  }
  return sheet;
}

function formatFechaCheck(d) {
  if (!d) d = new Date();
  if (typeof d === 'string') {
    if (d.includes('/')) return d;
    const parts = d.split('-');
    if (parts.length === 3) return parts[2].slice(0, 2) + '/' + parts[1] + '/' + parts[0];
    return d;
  }
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return new Date().toLocaleDateString('es-ES');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yyyy = dateObj.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
}

function handleRecordDevolucion(ss, data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = ensureDevolucionesSheet(ss);
    const fechaCheckStr = formatFechaCheck(data.fechaCheck || data.fecha);

    const row = [
      data.retailer || data.cuenta || '',
      data.storeCode || data.rms || '',
      data.tienda || '',
      data.dispositivo || data.dispositivoRetirado || data.modeloAnterior || data.modelo || '',
      fechaCheckStr,
      data.imei !== undefined ? String(data.imei) : (data.imeiRetirado !== undefined ? String(data.imeiRetirado) : (data.imeiAnterior ? String(data.imeiAnterior) : '')),
      data.estado || data.motivo || 'Cambio de terminal',
      data.mueble || data.mesa || 'Mesa 1',
      data.devolucionesFF || data.usuario || 'Field Force',
      data.tipoProducto || data.tioDeProducto || (data.isDummy ? 'Dummy' : 'LDU')
    ];

    sheet.appendRow(row);

    // Si el producto devuelto estaba en 'LDUS DUMMY STOCK', su fila debe desaparecer
    let deletedFromStock = false;
    try {
      const sheetStock = getLdusStockSheet(ss);
      if (sheetStock && sheetStock.getLastRow() >= 2) {
        let targetRow = Number(data.excelRow || data.row || 0);
        if (!targetRow || targetRow < 2) {
          const fastValues = getFastValues(sheetStock);
          const targetStore = String(data.storeCode || data.rms || data.tienda || '').trim().toLowerCase();
          const targetMesa = String(data.mueble || data.mesa || '').trim().toLowerCase();
          const targetMod = String(data.dispositivo || data.dispositivoRetirado || data.modelo || '').trim().toLowerCase();
          const targetImei = String(data.imei || data.imeiRetirado || '').trim().toLowerCase();
          for (let i = 1; i < fastValues.length; i++) {
            const rRms = String(fastValues[i][1] || '').trim().toLowerCase();
            const rTienda = String(fastValues[i][2] || '').trim().toLowerCase();
            const rMesa = String(fastValues[i][4] || '').trim().toLowerCase();
            const rMod = String(fastValues[i][5] || '').trim().toLowerCase();
            const rImei = String(fastValues[i][6] || '').trim().toLowerCase();
            if ((rRms === targetStore || rTienda === targetStore) &&
                (!targetMesa || rMesa === targetMesa) &&
                (rMod === targetMod || (targetImei && rImei === targetImei))) {
              targetRow = i + 1;
              break;
            }
          }
        }
        if (targetRow && targetRow >= 2 && targetRow <= sheetStock.getLastRow()) {
          sheetStock.deleteRow(targetRow);
          deletedFromStock = true;
        }
      }
    } catch(delErr) {
      console.warn('No se pudo borrar fila de stock:', delErr);
    }

    return {
      success: true,
      message: 'Devolución registrada en DEVOLUCIONES' + (deletedFromStock ? ' y eliminada de LDUS DUMMY STOCK.' : '.'),
      deletedFromStock: deletedFromStock,
      row: row
    };
  } catch (err) {
    return { success: false, message: 'Error registrando devolución: ' + err.toString() };
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function handleGetDevoluciones(ss) {
  try {
    const sheet = getDevolucionesSheet(ss);
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, count: 0, records: [] };
    }
    const data = getFastValues(sheet);
    const records = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      records.push({
        row: i + 1,
        retailer: r[0] || '',
        storeCode: r[1] || '',
        tienda: r[2] || '',
        dispositivo: r[3] || '',
        fechaCheck: r[4] || '',
        imei: r[5] || '',
        estado: r[6] || '',
        mueble: r[7] || '',
        devolucionesFF: r[8] || '',
        tipoProducto: r[9] || ''
      });
    }
    return { success: true, count: records.length, records: records.reverse() };
  } catch (err) {
    return { success: false, message: 'Error obteniendo devoluciones: ' + err.toString() };
  }
}

function handleReportTerminalChange(ss, data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const fechaCheckStr = formatFechaCheck(data.fechaCheck || data.fecha);

    // 1. REGISTRAR DEVOLUCIÓN EN LA PESTAÑA 'DEVOLUCIONES'
    const sheetDev = ensureDevolucionesSheet(ss);
    const devRow = [
      data.retailer || data.cuenta || '',
      data.storeCode || data.rms || '',
      data.tienda || '',
      data.dispositivoRetirado || data.modeloAnterior || data.modelo || '',
      fechaCheckStr,
      data.imeiRetirado !== undefined ? String(data.imeiRetirado) : (data.imeiAnterior !== undefined ? String(data.imeiAnterior) : ''),
      data.motivo || data.estado || 'Cambio de terminal',
      data.mueble || data.mesa || 'Mesa 1',
      data.devolucionesFF || data.usuario || 'Field Force',
      data.tipoProducto || (data.isDummy ? 'Dummy' : 'LDU')
    ];
    sheetDev.appendRow(devRow);

    // 2. ACTUALIZAR PUESTO EN LA PESTAÑA 'LDUS DUMMY STOCK'
    const sheetStock = ensureLdusStockSheet(ss);
    let targetRow = Number(data.excelRow || data.row || 0);
    const fastValues = getFastValues(sheetStock);
    const targetStore = String(data.storeCode || data.rms || data.tienda || '').trim().toLowerCase();
    const targetMesa = String(data.mueble || data.mesa || '').trim().toLowerCase();
    const targetModRet = String(data.dispositivoRetirado || data.modeloAnterior || data.modelo || '').trim().toLowerCase();
    const targetImei = String(data.imeiRetirado !== undefined ? data.imeiRetirado : (data.imeiAnterior || '')).trim();

    // Comprobar si targetRow apunta exactamente a la tienda y modelo/imei esperado
    let isRowDirectMatch = false;
    if (targetRow >= 2 && targetRow <= fastValues.length) {
      const r = fastValues[targetRow - 1];
      const rRms = String(r[1] || '').trim().toLowerCase();
      const rTienda = String(r[2] || '').trim().toLowerCase();
      const rMod = String(r[5] || '').trim().toLowerCase();
      const rImei = String(r[6] || '').trim();

      if ((!targetStore || rRms === targetStore || rTienda === targetStore) &&
          (!targetModRet || rMod === targetModRet || (targetImei && rImei === targetImei))) {
        isRowDirectMatch = true;
      }
    }

    // Si no coincide directamente (por eliminaciones previas que desplazaron las filas), buscar por contenido
    if (!isRowDirectMatch) {
      targetRow = 0;
      for (let i = 1; i < fastValues.length; i++) {
        const rRms = String(fastValues[i][1] || '').trim().toLowerCase();
        const rTienda = String(fastValues[i][2] || '').trim().toLowerCase();
        const rMesa = String(fastValues[i][4] || '').trim().toLowerCase();
        const rMod = String(fastValues[i][5] || '').trim().toLowerCase();
        const rImei = String(fastValues[i][6] || '').trim();

        const matchesStore = !targetStore || rRms === targetStore || rTienda === targetStore;
        const matchesMesa = !targetMesa || rMesa === targetMesa;
        const matchesModelOrImei = (!targetModRet || rMod === targetModRet) || (targetImei && rImei === targetImei);

        if (matchesStore && matchesMesa && matchesModelOrImei) {
          targetRow = i + 1;
          break;
        }
      }
    }

    let stockUpdated = false;
    const isDevolucionPura = data.isDevolucion === true || 
                             String(data.tipoAccion || data.motivo || '').toLowerCase().includes('devoluc') || 
                             !data.nuevoModelo;

    if (targetRow && targetRow >= 2 && targetRow <= sheetStock.getLastRow()) {
      if (isDevolucionPura) {
        // En devolución: la fila en LDUS DUMMY STOCK debe desaparecer completamente
        sheetStock.deleteRow(targetRow);
        stockUpdated = true;
      } else {
        // Col F (6): Producto (listado) -> Nuevo modelo que sustituye al retirado
        if (data.nuevoModelo) {
          sheetStock.getRange(targetRow, 6).setValue(String(data.nuevoModelo));
        }
        // Col G (7): IMEI -> Nuevo IMEI
        sheetStock.getRange(targetRow, 7).setValue(data.nuevoImei !== undefined ? String(data.nuevoImei) : '');
        // Col H (8): Estado
        sheetStock.getRange(targetRow, 8).setValue(data.isDummy ? 'Maqueta dummy' : 'Disponible en tienda');
        // Col J (10): Observación
        const obsTexto = (data.observaciones ? data.observaciones + ' · ' : '') + 
          `Sustitución ${fechaCheckStr}. Retirado a DEVOLUCIONES: ${data.dispositivoRetirado || ''} [${data.imeiRetirado || 'Sin IMEI'}]`;
        sheetStock.getRange(targetRow, 10).setValue(obsTexto);

        // Si la hoja tiene columnas adicionales K, L, M
        if (sheetStock.getLastColumn() >= 13) {
          sheetStock.getRange(targetRow, 11).setValue('Cambio de modelo');
          sheetStock.getRange(targetRow, 12).setValue(data.usuario || '');
          sheetStock.getRange(targetRow, 13).setValue(new Date());
        }
        stockUpdated = true;
      }
    }

    // 3. AUDITORÍA EN 'Registro_Feishu_IMEIs'
    let auditSheet = getSheetDefensive(ss, 'Registro_Feishu_IMEIs');
    if (!auditSheet) {
      auditSheet = ss.insertSheet('Registro_Feishu_IMEIs');
      auditSheet.appendRow([
        'Fecha/Hora', 'Retailer', 'StoreCode', 'Tienda', 'Mesa', 'Posición',
        'Modelo', 'Código', 'IMEI', 'Tipología', 'Acción', 'Motivo',
        'Modelo Anterior', 'IMEI Anterior', 'Observaciones', 'Usuario', 'Fila Hoja'
      ]);
    }
    auditSheet.appendRow([
      new Date().toISOString(),
      data.retailer || data.cuenta || '',
      data.storeCode || data.rms || '',
      data.tienda || '',
      data.mueble || data.mesa || '',
      data.posicion || 1,
      data.nuevoModelo || '',
      data.codigo || '',
      data.nuevoImei || '',
      data.tipoProducto || (data.isDummy ? 'Dummy' : 'LDU'),
      'Cambio de terminal',
      data.motivo || 'Cambio de terminal',
      data.dispositivoRetirado || data.modeloAnterior || '',
      data.imeiRetirado || data.imeiAnterior || '',
      data.observaciones || '',
      data.usuario || '',
      targetRow || ''
    ]);

    return {
      success: true,
      message: 'Cambio de terminal guardado: actualizado en LDUS DUMMY STOCK y añadido a DEVOLUCIONES.',
      stockUpdated: stockUpdated,
      targetRow: targetRow,
      devolucionRow: devRow
    };
  } catch (err) {
    return { success: false, message: 'Error en reportTerminalChange: ' + err.toString() };
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function handleUpdateFeishuImei(ss, data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = ensureLdusStockSheet(ss);
    
    // 1. Determinar fila exacta
    let targetRow = Number(data.excelRow || data.row || 0);

    // Si no tenemos número de fila o es inválido, buscar por StoreCode/Tienda + Mesa + Modelo
    if (!targetRow || targetRow < 2) {
      const fastValues = getFastValues(sheet);
      const targetStore = String(data.rms || data.storeCode || data.tienda || '').trim().toLowerCase();
      const targetMesa = String(data.mesa || '').trim().toLowerCase();
      const targetMod = String(data.modeloAnterior || data.modelo || '').trim().toLowerCase();

      for (let i = 1; i < fastValues.length; i++) {
        const rRms = String(fastValues[i][1] || '').trim().toLowerCase(); // Col B (StoreCode)
        const rTienda = String(fastValues[i][2] || '').trim().toLowerCase(); // Col C (Tienda)
        const rMesa = String(fastValues[i][4] || '').trim().toLowerCase(); // Col E (Mesa)
        const rMod = String(fastValues[i][5] || '').trim().toLowerCase(); // Col F (Producto)

        if ((rRms === targetStore || rTienda === targetStore) && rMesa === targetMesa && rMod === targetMod) {
          targetRow = i + 1;
          break;
        }
      }
    }

    let cloudUpdated = false;
    if (targetRow && targetRow >= 2 && targetRow <= sheet.getLastRow()) {
      // Si se envió un nuevo modelo (o cambio), actualizar Col F (6)
      if (data.modelo) {
        sheet.getRange(targetRow, 6).setValue(String(data.modelo));
      }
      // Col G (7): IMEI
      sheet.getRange(targetRow, 7).setValue(data.imei !== undefined ? String(data.imei) : '');
      // Col H (8): Estado
      sheet.getRange(targetRow, 8).setValue(data.estado || (data.isDummy ? 'Maqueta dummy' : 'Disponible en tienda'));
      // Col J (10): Observación
      if (data.observacionCambio || data.observaciones) {
        sheet.getRange(targetRow, 10).setValue(String(data.observacionCambio || data.observaciones));
      }
      if (sheet.getLastColumn() >= 13) {
        sheet.getRange(targetRow, 11).setValue(data.tipoAccion || 'Asignación IMEI');
        sheet.getRange(targetRow, 12).setValue(data.usuario || '');
        sheet.getRange(targetRow, 13).setValue(new Date());
      }
      cloudUpdated = true;
    }

    // Si es un cambio de modelo o rotura con sustitución, registrar automáticamente la devolución en 'DEVOLUCIONES'
    if (data.tipoAccion === 'Cambio de modelo' || data.modeloAnterior || data.isDevolucion) {
      try {
        handleRecordDevolucion(ss, {
          retailer: data.cuenta || data.retailer || '',
          storeCode: data.rms || data.storeCode || '',
          tienda: data.tienda || '',
          dispositivo: data.modeloAnterior || data.dispositivoRetirado || data.modelo || '',
          imei: data.imeiAnterior || data.imeiRetirado || '',
          estado: data.motivoCambio || data.tipoAccion || 'Cambio de modelo',
          mueble: data.mesa || 'Mesa 1',
          devolucionesFF: data.usuario || 'Field Force',
          tipoProducto: data.tipologia || (data.isDummy ? 'Dummy' : 'LDU'),
          fechaCheck: data.fecha || ''
        });
      } catch (devErr) {
        console.warn('Error registrando devolución automática:', devErr);
      }
    }

    // 2. Registro histórico de auditoría en 'Registro_Feishu_IMEIs'
    let auditSheet = getSheetDefensive(ss, 'Registro_Feishu_IMEIs');
    if (!auditSheet) {
      auditSheet = ss.insertSheet('Registro_Feishu_IMEIs');
      auditSheet.appendRow([
        'Fecha/Hora', 'Retailer', 'StoreCode', 'Tienda', 'Mesa', 'Posición',
        'Modelo', 'Código', 'IMEI', 'Tipología', 'Acción', 'Motivo',
        'Modelo Anterior', 'IMEI Anterior', 'Observaciones', 'Usuario', 'Fila Hoja'
      ]);
    }
    auditSheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.cuenta || data.retailer || '',
      data.rms || data.storeCode || '',
      data.tienda || data.storeName || '',
      data.mesa || '',
      data.posicion || '',
      data.modelo || '',
      data.codigo || '',
      data.imei || '',
      data.tipologia || '',
      data.tipoAccion || '',
      data.motivoCambio || '',
      data.modeloAnterior || '',
      data.imeiAnterior || '',
      data.observacionCambio || data.observaciones || '',
      data.usuario || '',
      targetRow || ''
    ]);

    return {
      success: true,
      cloudUpdated: cloudUpdated,
      row: targetRow,
      message: cloudUpdated 
        ? `Guardado directamente en Google Sheets (LDUS DUMMY STOCK, Fila ${targetRow})`
        : 'Registrado en el historial de la nube.'
    };
  } catch (err) {
    return { success: false, message: 'Error al guardar en Google Sheets: ' + err.toString() };
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function handleBulkUpdateFeishuImeis(ss, data) {
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) {
    return { success: true, count: 0, message: 'No hay elementos para actualizar' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const sheet = ensureLdusStockSheet(ss);
    const lastRow = sheet.getLastRow();
    let updatedCount = 0;

    // Actualización de celdas en LDUS DUMMY STOCK
    items.forEach(item => {
      const row = Number(item.excelRow || item.row || 0);
      if (row >= 2 && row <= lastRow) {
        if (item.modelo) {
          sheet.getRange(row, 6).setValue(String(item.modelo));
        }
        sheet.getRange(row, 7).setValue(item.imei !== undefined ? String(item.imei) : '');
        sheet.getRange(row, 8).setValue(item.estado || (item.isDummy ? 'Maqueta dummy' : 'Disponible en tienda'));
        if (item.observacionCambio || item.observaciones) {
          sheet.getRange(row, 10).setValue(String(item.observacionCambio || item.observaciones));
        }
        if (sheet.getLastColumn() >= 13) {
          sheet.getRange(row, 11).setValue(item.tipoAccion || 'Asignación IMEI');
          sheet.getRange(row, 12).setValue(item.usuario || data.usuario || '');
          sheet.getRange(row, 13).setValue(new Date());
        }
        updatedCount++;

        // Registrar devolución si es cambio de modelo
        if (item.tipoAccion === 'Cambio de modelo' || item.modeloAnterior) {
          try {
            handleRecordDevolucion(ss, {
              retailer: item.cuenta || item.retailer || '',
              storeCode: item.rms || item.storeCode || '',
              tienda: item.tienda || '',
              dispositivo: item.modeloAnterior || item.modelo || '',
              imei: item.imeiAnterior || '',
              estado: item.motivoCambio || item.tipoAccion || 'Cambio de modelo',
              mueble: item.mesa || 'Mesa 1',
              devolucionesFF: item.usuario || data.usuario || 'Field Force',
              tipoProducto: item.tipologia || (item.isDummy ? 'Dummy' : 'LDU'),
              fechaCheck: item.fecha || ''
            });
          } catch(e) {}
        }
      }
    });

    // Guardado en auditoría
    let auditSheet = getSheetDefensive(ss, 'Registro_Feishu_IMEIs');
    if (!auditSheet) {
      auditSheet = ss.insertSheet('Registro_Feishu_IMEIs');
      auditSheet.appendRow([
        'Fecha/Hora', 'Retailer', 'StoreCode', 'Tienda', 'Mesa', 'Posición',
        'Modelo', 'Código', 'IMEI', 'Tipología', 'Acción', 'Motivo',
        'Modelo Anterior', 'IMEI Anterior', 'Observaciones', 'Usuario', 'Fila Hoja'
      ]);
    }

    const auditRows = items.map(item => [
      item.timestamp || new Date().toISOString(),
      item.cuenta || item.retailer || '',
      item.rms || item.storeCode || '',
      item.tienda || item.storeName || '',
      item.mesa || '',
      item.posicion || '',
      item.modelo || '',
      item.codigo || '',
      item.imei || '',
      item.tipologia || '',
      item.tipoAccion || '',
      item.motivoCambio || '',
      item.modeloAnterior || '',
      item.imeiAnterior || '',
      item.observacionCambio || item.observaciones || '',
      item.usuario || data.usuario || '',
      item.excelRow || ''
    ]);

    const auditLastRow = auditSheet.getLastRow();
    auditSheet.getRange(auditLastRow + 1, 1, auditRows.length, 17).setValues(auditRows);

    return {
      success: true,
      count: items.length,
      updatedInSheet: updatedCount,
      cloudUpdated: true,
      message: `Se han actualizado ${items.length} terminales directamente en Google Sheets (LDUS DUMMY STOCK).`
    };
  } catch (err) {
    return { success: false, message: 'Error al sincronizar lote en Google Sheets: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function handleGetFeishuImeis(ss) {
  try {
    const sheet = getLdusStockSheet(ss);
    if (sheet && sheet.getLastRow() >= 2) {
      const data = getFastValues(sheet);
      const records = [];
      const storeMesas = {};
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const storeName = String(row[2] || '').trim();
        const numMesas = Number(row[3]) || 0;
        if (storeName && numMesas > 0) {
          storeMesas[storeName] = numMesas;
        }
        const modelo = String(row[5] || '').trim();
        const imei = String(row[6] || '').trim();
        const estado = String(row[7] || '').trim();
        const observacion = String(row[9] || '').trim();
        const tipoAccion = String(row[10] || '').trim();
        const isDummy = estado.toLowerCase().includes('dummy') || modelo.toLowerCase().includes('dummy');

        if (modelo || imei || tipoAccion || observacion || isDummy) {
          records.push({
            excelRow: i + 1,
            cuenta: row[0] || '',
            rms: row[1] || '',
            tienda: storeName,
            numMesas: numMesas,
            mesa: row[4] || '',
            modelo: modelo,
            imei: imei,
            estado: estado,
            isDummy: isDummy,
            observacionCambio: observacion,
            tipoAccion: tipoAccion,
            usuario: row[11] || '',
            fechaModificacion: row[12] || ''
          });
        }
      }
      return {
        success: true,
        source: 'google_sheets_ldus',
        count: records.length,
        totalRowsInSheet: data.length - 1,
        storeMesas: storeMesas,
        records: records
      };
    }

    // Fallback a Registro_Feishu_IMEIs si la pestaña principal aún no tiene datos
    const auditSheet = getSheetDefensive(ss, 'Registro_Feishu_IMEIs');
    if (!auditSheet) {
      return { success: true, source: 'none', records: [] };
    }
    const data = getFastValues(auditSheet);
    if (data.length <= 1) return { success: true, source: 'none', records: [] };
    const records = [];
    for (let i = 1; i < data.length; i++) {
      records.push({
        excelRow: data[i][16] || null,
        timestamp: data[i][0],
        cuenta: data[i][1],
        rms: data[i][2],
        tienda: data[i][3],
        mesa: data[i][4],
        posicion: data[i][5],
        modelo: data[i][6],
        codigo: data[i][7],
        imei: data[i][8],
        tipologia: data[i][9],
        tipoAccion: data[i][10],
        motivoCambio: data[i][11],
        modeloAnterior: data[i][12],
        imeiAnterior: data[i][13],
        observacionCambio: data[i][14],
        usuario: data[i][15]
      });
    }
    return { success: true, source: 'google_sheets_audit', records: records };
  } catch (err) {
    return { success: false, message: 'Error leyendo Google Sheets: ' + err.toString() };
  }
}

function handleGetLdusStockStatus(ss) {
  try {
    const sheet = getLdusStockSheet(ss);
    if (!sheet) {
      return { success: true, exists: false, totalRows: 0, message: 'La pestaña LDUS DUMMY STOCK no existe aún en Google Sheets.' };
    }
    const total = Math.max(0, sheet.getLastRow() - 1);
    let filled = 0;
    if (total > 0) {
      const vals = sheet.getRange(2, 7, total, 1).getValues();
      for (let i = 0; i < vals.length; i++) {
        if (String(vals[i][0] || '').trim()) filled++;
      }
    }
    return {
      success: true,
      exists: true,
      tabName: sheet.getName(),
      totalRows: total,
      filledImeis: filled,
      pendingImeis: total - filled,
      message: `Pestaña activa: '${sheet.getName()}'. Total registros: ${total}, Rellenados: ${filled}, Pendientes: ${total - filled}.`
    };
  } catch (err) {
    return { success: false, message: 'Error consultando estado de LDUS STOCK: ' + err.toString() };
  }
}

function handleInitLdusStockSheet(ss, data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    let sheet = getSheetDefensive(ss, 'LDUS DUMMY STOCK');
    if (!sheet) {
      sheet = ss.insertSheet('LDUS DUMMY STOCK');
    }
    
    const rows = Array.isArray(data.rows) ? data.rows : [];
    if (rows.length === 0) {
      return { success: false, message: 'No se recibieron filas para insertar.' };
    }

    if (data.clearExisting) {
      sheet.clear();
    }

    // Cabecera si la hoja está vacía
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Retailer', 'StoreCode', 'Tienda', 'Nº mesas', 'Mesa', 'Producto (listado)',
        'IMEI', 'Estado', 'Otros IMEI (unidades adicionales)', 'Observación',
        'Tipo Acción', 'Usuario Modificación', 'Fecha Modificación'
      ]);
    }

    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);

    return {
      success: true,
      message: `Se insertaron ${rows.length} filas en 'LDUS DUMMY STOCK'. Total filas en hoja: ${sheet.getLastRow()}.`,
      totalRows: sheet.getLastRow()
    };
  } catch (err) {
    return { success: false, message: 'Error inicializando hoja: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ==================================================
// SINCRONIZACIÓN DE TIENDAS MM (110 CON MESA) EN HOJA 'Tiendas'
// Actualiza Media Puerto Sagunto (MIESD03195) y añade Media Ponferrada (CES005180)
// Puede ejecutarse directamente desde el editor de Apps Script o vía Webhook
// ==================================================
function syncMissingMMStoresToSheet(ss) {
  if (!ss) ss = SpreadsheetApp.openById(CONFIG.SS_ID);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const sheet = getSheetDefensive(ss, 'Tiendas');
    if (!sheet) return { success: false, message: 'Hoja "Tiendas" no encontrada en la hoja de cálculo.' };

    const data = sheet.getDataRange().getValues();
    let saguntoUpdated = false;
    let saguntoRow = 0;
    let ponferradaExists = false;
    let ponferradaRow = 0;

    for (let i = 1; i < data.length; i++) {
      const rms = String(data[i][0] || '').trim();
      const tienda = String(data[i][2] || '').trim().toLowerCase();

      // 1. Media Puerto Sagunto (MIESD03195) -> Activar Mesa: 1, Top Table: 1, Tipo de mesa: 4.5
      if (rms === 'MIESD03195' || tienda.includes('sagunto')) {
        saguntoRow = i + 1;
        sheet.getRange(saguntoRow, 5).setValue(1);     // Col E (5): Mesa
        sheet.getRange(saguntoRow, 8).setValue(1);     // Col H (8): Top Table
        sheet.getRange(saguntoRow, 12).setValue(4.5);  // Col L (12): Tipo de mesa
        saguntoUpdated = true;
      }

      // 2. Ajustes según Hoja de ruta (Barakaldo, Majadahonda, Málaga, Toledo)
      if (rms === 'MIESS00030') { // Media Barakaldo-Bilbao -> 2 Mesas
        sheet.getRange(i + 1, 5).setValue(2);
      }
      if (rms === 'MIESD00190') { // Media Majadahonda -> 2 Mesas
        sheet.getRange(i + 1, 5).setValue(2);
      }
      if (rms === 'MIESO00041') { // Media Malaga -> 2 Mesas
        sheet.getRange(i + 1, 5).setValue(2);
      }
      if (rms === 'MIESD00199') { // Media Toledo -> 1 Mesa
        sheet.getRange(i + 1, 5).setValue(1);
      }

      // 3. Comprobar si Media Ponferrada ya existe
      if (rms === 'CES005180' || tienda.includes('ponferrada')) {
        ponferradaExists = true;
        ponferradaRow = i + 1;
      }
    }

    let ponferradaAdded = false;
    if (!ponferradaExists) {
      // Estructura: Codigo RMS | Cuenta | Tienda | USUARIO | Mesa | Columna | Wall | Top Table | Lightbox Column | Lightbox Wall | Url Guia | Tipo de mesa | AM
      const newStoreRow = [
        'CES005180',
        'MM',
        'Media Ponferrada',
        'Francisco Paz',
        1,
        0,
        0,
        1,
        0,
        0,
        '',
        4.5,
        'Luis Angel Minguez'
      ];
      sheet.appendRow(newStoreRow);
      ponferradaAdded = true;
      ponferradaRow = sheet.getLastRow();
    }

    SpreadsheetApp.flush();

    const resultMsg = `Sincronización finalizada: ` +
      (saguntoUpdated ? `Media Puerto Sagunto activada en fila ${saguntoRow} (Mesa=1). ` : `Media Puerto Sagunto no requirió cambio. `) +
      (ponferradaAdded ? `Media Ponferrada añadida en fila ${ponferradaRow} (Mesa=1).` : `Media Ponferrada ya existía en fila ${ponferradaRow}.`);

    Logger.log(resultMsg);
    return {
      success: true,
      message: resultMsg,
      saguntoUpdated: saguntoUpdated,
      saguntoRow: saguntoRow,
      ponferradaAdded: ponferradaAdded,
      ponferradaExists: ponferradaExists,
      ponferradaRow: ponferradaRow
    };
  } catch (err) {
    Logger.log('Error en syncMissingMMStoresToSheet: ' + err.toString());
    return { success: false, message: 'Error al sincronizar tiendas MM: ' + err.toString() };
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}


