const SAC_PENDING_KEY = 'pendingSAC';

// Mapeo de abreviaturas de áreas para SAC_ID (debe coincidir con backend)
const AREA_ABBREVIATIONS = {
    'Compras': 'COMP',
    'Sostenibilidad': 'SOST',
    'Mantenimiento': 'MANT',
    'Mantenimiento Hilandería': 'MAHI',
    'Corte': 'CORT',
    'Costura': 'COST',
    'Bordado': 'BORD',
    'Estampado': 'ESTA',
    'Habilitado': 'HABI',
    'Lavandería de paños': 'LAVP',
    'Lavandería efectos': 'LAVE',
    'Satisfacción de Cliente': 'SACL',
    'Aseguramiento de Calidad Textil': 'ACAT',
    'Aseguramiento de la Calidad': 'ASCA',
    'Atencion a Usuarios por Soporte Técnico': 'AUST',
    'Desarrollo Textil': 'DETE',
    'Desarrollo de Sistemas': 'DESI',
    'Desarollo Confección (Dias Molde)': 'DCDM',
    'Desarollo Confección (Dias muestra)': 'DCDU',
    'Desarollo Confección (Eficacia Muestras)': 'DCEM',
    'Evaluación de Competencias': 'EVCO',
    'Inducción, Capacitación y Entrenamiento': 'INCE',
    'Ing. Planta': 'INPL',
    'Ingeniería de Métodos y Tiempos': 'INMT',
    'Laboratorio de Hilandería': 'LAHI',
    'Laboratorio de Tintorería': 'LATI',
    'PCP Confecciones': 'PCPC',
    'PCP Textil': 'PCPT',
    'Produccion Hilanderia': 'PRHI',
    'Produccion Tejeduría': 'PRTE',
    'Reclutamiento, Selección y Contratación': 'RESC',
    'Tintoreria de Hilos': 'TIHI',
    'Tintoreria de telas': 'TITE',
    'Acabado, embalaje y almacenamiento': 'ACEA',
    'Almacenamiento y despacho de Avíos': 'ALAV',
    'Almacenamiento y Despacho de Tela': 'ALTE'
};

function loadPendingSACs() {
    try {
        const raw = localStorage.getItem(SAC_PENDING_KEY);
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function savePendingSACs(items) {
    try {
        localStorage.setItem(SAC_PENDING_KEY, JSON.stringify(items || []));
    } catch (e) { }
}

function buildPendingEntry(idx) {
    const yearValue = currentYear || '';
    const period = baseMonths[idx] + (yearValue ? ` ${String(yearValue).slice(-2)}` : '');
    return {
        area: currentArea,
        indicator: currentIndicator,
        year: yearValue,
        period,
        numerador: dataState.num ? dataState.num[idx] : '',
        denominador: dataState.den ? dataState.den[idx] : ''
    };
}

function addPendingSACEntry(entry) {
    if (!entry || !entry.period) return;
    const items = loadPendingSACs();
    const exists = items.some(item => item.area === entry.area && item.indicator === entry.indicator && item.period === entry.period);
    if (!exists) {
        items.push(entry);
        savePendingSACs(items);
    }
}

function removePendingSACEntry(entry) {
    if (!entry || !entry.period) return;
    const items = loadPendingSACs();
    const next = items.filter(item => !(item.area === entry.area && item.indicator === entry.indicator && item.period === entry.period));
    savePendingSACs(next);
}

function getSACEl(id) {
    return document.getElementById(id);
}

function getSACValue(id) {
    const el = getSACEl(id);
    return el ? String(el.value || '').trim() : '';
}

function setSACValue(id, value) {
    const el = getSACEl(id);
    if (!el) return;
    el.value = value === null || value === undefined ? '' : value;
}

function getSACChecked(id) {
    const el = getSACEl(id);
    return !!(el && el.checked);
}

function setSACChecked(id, value) {
    const el = getSACEl(id);
    if (!el) return;
    el.checked = !!value;
}

function hasSACText(value) {
    return String(value || '').trim() !== '';
}

function pickSACValue(data, keys) {
    if (!data || typeof data !== 'object' || !Array.isArray(keys)) return '';
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!(key in data)) continue;
        const value = data[key];
        if (value !== null && value !== undefined && String(value).trim() !== '') {
            return String(value);
        }
    }
    return '';
}

function eficaciaTokenToSiNo(token) {
    const normalized = String(token || '').trim().toUpperCase();
    if (normalized === 'EFICAZ') return 'SI';
    if (normalized === 'NO_EFICAZ') return 'NO';
    return '';
}

function parseDataEficaciaToken(data) {
    const rawSiNo = pickSACValue(data, [
        'EFICAZ (SI/NO)',
        'EFICAZ',
        'EFICAZ SI NO'
    ]).toUpperCase();
    if (rawSiNo === 'SI') return 'EFICAZ';
    if (rawSiNo === 'NO') return 'NO_EFICAZ';

    const raw = pickSACValue(data, ['ESTADO', 'ESTADO (PENDIENTE / ENVIADO / VALIDADO)', 'EFICACIA'])
        .toUpperCase()
        .replace(/\s+/g, '_');
    if (raw === 'EFICAZ' || raw === 'NO_EFICAZ') return raw;
    return '';
}

function clearSACFormFields() {
    setSACValue('sacId', 'Generando...');
    setSACValue('sacDescripcion', '');
    setSACValue('sacAnalisis', '');
    setSACValue('sacAttachmentPath', '');

    // Limpiar acciones
    for (let i = 1; i <= 3; i++) {
        setSACValue(`sacAcc${i}Accion`, '');
        setSACValue(`sacAcc${i}Responsable`, '');
        setSACValue(`sacAcc${i}Fecha`, '');
        setSACChecked(`sacAcc${i}Firma`, false);
    }

    // Limpiar solo las firmas de evaluadores, NO los nombres/áreas (están prellenados en HTML)
    for (let i = 1; i <= 4; i++) {
        setSACChecked(`sacEval${i}Firma`, false);
    }

    // Limpiar verificación
    setSACValue('sacVerif1Accion', '');
    setSACValue('sacVerif1Responsable', '');
    setSACValue('sacVerif1Fecha', '');
    setSACChecked('sacVerif1Firma', false);

    setSACEficacia('');
}

function setSACEditable(isEditable) {
    const textIds = [
        'sacDescripcion',
        'sacAnalisis',
        'sacAttachmentPath',
        'sacEval1Nombre', 'sacEval1Area',
        'sacEval2Nombre', 'sacEval2Area',
        'sacEval3Nombre', 'sacEval3Area',
        'sacEval4Nombre', 'sacEval4Area',
        'sacAcc1Accion', 'sacAcc1Responsable', 'sacAcc1Fecha',
        'sacAcc2Accion', 'sacAcc2Responsable', 'sacAcc2Fecha',
        'sacAcc3Accion', 'sacAcc3Responsable', 'sacAcc3Fecha',
        'sacVerif1Accion', 'sacVerif1Responsable', 'sacVerif1Fecha'
    ];
    const checkIds = [
        'sacEval1Firma', 'sacEval2Firma', 'sacEval3Firma', 'sacEval4Firma',
        'sacAcc1Firma', 'sacAcc2Firma', 'sacAcc3Firma',
        'sacVerif1Firma'
    ];
    textIds.forEach(id => {
        const el = getSACEl(id);
        if (el) el.disabled = !isEditable;
    });
    checkIds.forEach(id => {
        const el = getSACEl(id);
        if (el) el.disabled = !isEditable;
    });

    const btnYes = getSACEl('sacEficazBtn');
    const btnNo = getSACEl('sacNoEficazBtn');
    if (btnYes) {
        btnYes.disabled = !isEditable;
        btnYes.classList.toggle('opacity-50', !isEditable);
    }
    if (btnNo) {
        btnNo.disabled = !isEditable;
        btnNo.classList.toggle('opacity-50', !isEditable);
    }
}

function applySACDataToForm(data) {
    console.log('[SAC] applySACDataToForm - data:', data);
    if (!data) {
        console.log('[SAC] No hay datos del servidor, usando valores por defecto del HTML');
        return;
    }

    setSACValue('sacId', pickSACValue(data, ['SAC_ID', 'ID']) || 'Generando...');
    setSACValue('sacFecha', pickSACValue(data, ['FECHA']) || getSACValue('sacFecha'));
    setSACValue('sacDescripcion', pickSACValue(data, ['DESCRIPCION_HALLAZGO', 'DESCRIPCION / ANALISIS', 'DESCRIPCIÓN / ANÁLISIS', 'DESCRIPCION']));
    setSACValue('sacAnalisis', pickSACValue(data, ['ANALISIS_CAUSA']));
    setSACValue('sacAttachmentPath', pickSACValue(data, ['ADJUNTOS (GUARDAR LISTA DE NOMBRES/LINKS)', 'ADJUNTOS', 'ADJUNTOS_RUTA']));

    setSACValue('sacResponsable', pickSACValue(data, ['RESPONSABLE']) || getSACValue('sacResponsable'));

    // Evaluadores: si no hay datos del servidor, mantener valores prellenados del HTML
    const eval1Nombre = pickSACValue(data, ['EVALUADOR_1_NOMBRE']) || getSACValue('sacEval1Nombre');
    const eval1Area = pickSACValue(data, ['EVALUADOR_1_AREA']) || getSACValue('sacEval1Area');
    console.log('[SAC] Evaluador 1:', eval1Nombre, eval1Area);
    setSACValue('sacEval1Nombre', eval1Nombre);
    setSACValue('sacEval1Area', eval1Area);
    setSACChecked('sacEval1Firma', pickSACValue(data, ['EVALUADOR_1_FIRMA']).toUpperCase() === 'SI');

    const eval2Nombre = pickSACValue(data, ['EVALUADOR_2_NOMBRE']) || getSACValue('sacEval2Nombre');
    const eval2Area = pickSACValue(data, ['EVALUADOR_2_AREA']) || getSACValue('sacEval2Area');
    console.log('[SAC] Evaluador 2:', eval2Nombre, eval2Area);
    setSACValue('sacEval2Nombre', eval2Nombre);
    setSACValue('sacEval2Area', eval2Area);
    setSACChecked('sacEval2Firma', pickSACValue(data, ['EVALUADOR_2_FIRMA']).toUpperCase() === 'SI');

    const eval3Nombre = pickSACValue(data, ['EVALUADOR_3_NOMBRE']) || getSACValue('sacEval3Nombre');
    const eval3Area = pickSACValue(data, ['EVALUADOR_3_AREA']) || getSACValue('sacEval3Area');
    console.log('[SAC] Evaluador 3:', eval3Nombre, eval3Area);
    setSACValue('sacEval3Nombre', eval3Nombre);
    setSACValue('sacEval3Area', eval3Area);
    setSACChecked('sacEval3Firma', pickSACValue(data, ['EVALUADOR_3_FIRMA']).toUpperCase() === 'SI');

    const eval4Nombre = pickSACValue(data, ['EVALUADOR_4_NOMBRE']) || getSACValue('sacEval4Nombre');
    const eval4Area = pickSACValue(data, ['EVALUADOR_4_AREA']) || getSACValue('sacEval4Area');
    console.log('[SAC] Evaluador 4:', eval4Nombre, eval4Area);
    setSACValue('sacEval4Nombre', eval4Nombre);
    setSACValue('sacEval4Area', eval4Area);
    setSACChecked('sacEval4Firma', pickSACValue(data, ['EVALUADOR_4_FIRMA']).toUpperCase() === 'SI');

    setSACValue('sacAcc1Accion', pickSACValue(data, ['ACCION_1']));
    setSACValue('sacAcc1Responsable', pickSACValue(data, ['ACCION_1_RESPONSABLE']));
    setSACValue('sacAcc1Fecha', pickSACValue(data, ['ACCION_1_FECHA']));
    setSACChecked('sacAcc1Firma', pickSACValue(data, ['ACCION_1_FIRMA']).toUpperCase() === 'SI');

    setSACValue('sacAcc2Accion', pickSACValue(data, ['ACCION_2']));
    setSACValue('sacAcc2Responsable', pickSACValue(data, ['ACCION_2_RESPONSABLE']));
    setSACValue('sacAcc2Fecha', pickSACValue(data, ['ACCION_2_FECHA']));
    setSACChecked('sacAcc2Firma', pickSACValue(data, ['ACCION_2_FIRMA']).toUpperCase() === 'SI');

    setSACValue('sacAcc3Accion', pickSACValue(data, ['ACCION_3']));
    setSACValue('sacAcc3Responsable', pickSACValue(data, ['ACCION_3_RESPONSABLE']));
    setSACValue('sacAcc3Fecha', pickSACValue(data, ['ACCION_3_FECHA']));
    setSACChecked('sacAcc3Firma', pickSACValue(data, ['ACCION_3_FIRMA']).toUpperCase() === 'SI');

    setSACValue('sacVerif1Accion', pickSACValue(data, ['VERIF_1_ACCION']));
    setSACValue('sacVerif1Responsable', pickSACValue(data, ['VERIF_1_RESPONSABLE']));
    setSACValue('sacVerif1Fecha', pickSACValue(data, ['VERIF_1_FECHA']));
    setSACChecked('sacVerif1Firma', pickSACValue(data, ['VERIF_1_FIRMA']).toUpperCase() === 'SI');

    const eficaciaToken = parseDataEficaciaToken(data);
    if (eficaciaToken) setSACEficacia(eficaciaToken);
}

function normalizeSignatureFlag(checked) {
    return checked ? 'SI' : 'NO';
}

function collectSACPayload() {
    const desc = getSACValue('sacDescripcion');
    const analisis = getSACValue('sacAnalisis');
    const attachmentPath = getSACValue('sacAttachmentPath');
    const eficaciaToken = getSACValue('sacEficacia');
    const eficaciaSiNo = eficaciaTokenToSiNo(eficaciaToken);

    // Leer nombres de evaluadores directamente (incluye pre-llenados del HTML)
    const eval1Nombre = getSACValue('sacEval1Nombre');
    const eval2Nombre = getSACValue('sacEval2Nombre');
    const eval3Nombre = getSACValue('sacEval3Nombre');
    const eval4Nombre = getSACValue('sacEval4Nombre');

    const actions = [
        getSACValue('sacAcc1Accion'),
        getSACValue('sacAcc2Accion'),
        getSACValue('sacAcc3Accion')
    ].filter(hasSACText);

    const evaluators = [
        eval1Nombre, eval2Nombre, eval3Nombre, eval4Nombre
    ].filter(hasSACText);

    const today = new Date().toISOString().split('T')[0];

    const sacIdRaw = getSACValue('sacId');
    const isValidSacId = sacIdRaw &&
        sacIdRaw !== 'Generando...' &&
        !sacIdRaw.startsWith('Nuevo') &&
        !sacIdRaw.startsWith('Se genera');

    const payload = {
        SAC_ID: isValidSacId ? sacIdRaw : '',
        AREA: currentArea,
        INDICADOR: currentIndicator,
        PERIODO: sacSelection.period,
        CODIGO: 'FP-GG-SIG-05-02',
        VERSION: '02',
        FECHA: getSACValue('sacFecha') || today,
        RESPONSABLE: getSACValue('sacResponsable') || currentUser,
        USUARIO: currentUser,
        DESCRIPCION: desc,
        DESCRIPCION_HALLAZGO: desc,
        ANALISIS_CAUSA: analisis,
        ACCION_CORRECTIVA_RESUMEN: actions.join(' | '),
        EQUIPO_EVALUADOR: evaluators.join(', '),

        EVALUADOR_1_NOMBRE: eval1Nombre,
        EVALUADOR_1_AREA: getSACValue('sacEval1Area'),
        EVALUADOR_1_FIRMA: normalizeSignatureFlag(getSACChecked('sacEval1Firma')),

        EVALUADOR_2_NOMBRE: eval2Nombre,
        EVALUADOR_2_AREA: getSACValue('sacEval2Area'),
        EVALUADOR_2_FIRMA: normalizeSignatureFlag(getSACChecked('sacEval2Firma')),

        EVALUADOR_3_NOMBRE: eval3Nombre,
        EVALUADOR_3_AREA: getSACValue('sacEval3Area'),
        EVALUADOR_3_FIRMA: normalizeSignatureFlag(getSACChecked('sacEval3Firma')),

        EVALUADOR_4_NOMBRE: eval4Nombre,
        EVALUADOR_4_AREA: getSACValue('sacEval4Area'),
        EVALUADOR_4_FIRMA: normalizeSignatureFlag(getSACChecked('sacEval4Firma')),

        ACCION_1: getSACValue('sacAcc1Accion'),
        ACCION_1_RESPONSABLE: getSACValue('sacAcc1Responsable'),
        ACCION_1_FECHA: getSACValue('sacAcc1Fecha'),
        ACCION_1_FIRMA: normalizeSignatureFlag(getSACChecked('sacAcc1Firma')),

        ACCION_2: getSACValue('sacAcc2Accion'),
        ACCION_2_RESPONSABLE: getSACValue('sacAcc2Responsable'),
        ACCION_2_FECHA: getSACValue('sacAcc2Fecha'),
        ACCION_2_FIRMA: normalizeSignatureFlag(getSACChecked('sacAcc2Firma')),

        ACCION_3: getSACValue('sacAcc3Accion'),
        ACCION_3_RESPONSABLE: getSACValue('sacAcc3Responsable'),
        ACCION_3_FECHA: getSACValue('sacAcc3Fecha'),
        ACCION_3_FIRMA: normalizeSignatureFlag(getSACChecked('sacAcc3Firma')),

        VERIF_1_ACCION: getSACValue('sacVerif1Accion'),
        VERIF_1_RESPONSABLE: getSACValue('sacVerif1Responsable'),
        VERIF_1_FECHA: getSACValue('sacVerif1Fecha'),
        VERIF_1_FIRMA: normalizeSignatureFlag(getSACChecked('sacVerif1Firma')),

        EFICAZ: eficaciaSiNo,
        FECHA_EFICACIA: eficaciaSiNo ? today : '',
        USUARIO_EFICACIA: eficaciaSiNo ? currentUser : '',

        ADJUNTOS: attachmentPath,
        ADJUNTOS_RUTA: attachmentPath
    };

    const hasBodyContent = [
        payload.DESCRIPCION_HALLAZGO,
        payload.ANALISIS_CAUSA,
        payload.ACCION_1,
        payload.ACCION_2,
        payload.ACCION_3,
        payload.VERIF_1_ACCION
    ].some(hasSACText);

    payload.ESTADO = payload.EFICAZ === 'SI' ? 'VALIDADO' : (hasBodyContent ? 'ENVIADO' : 'PENDIENTE');

    // Log para depuración
    console.log('[SAC] Payload a enviar:', JSON.stringify(payload, null, 2));

    return payload;
}

window.showPendingSACModal = function () {
    const modal = document.getElementById('sacPendingModal');
    const tbody = document.getElementById('sacPendingBody');
    if (!modal || !tbody) return;
    const items = loadPendingSACs().filter(item => !currentArea || item.area === currentArea);
    if (!items.length) return;
    tbody.innerHTML = items.map(item => `
        <tr class="border-b border-slate-100">
            <td class="py-2 px-3">${item.year || '-'}</td>
            <td class="py-2 px-3">${item.indicator || '-'}</td>
            <td class="py-2 px-3 text-right">${item.numerador ?? ''}</td>
            <td class="py-2 px-3 text-right">${item.denominador ?? ''}</td>
        </tr>
    `).join('');
    modal.classList.remove('hidden');
}

window.closePendingSACModal = function () {
    const modal = document.getElementById('sacPendingModal');
    if (modal) modal.classList.add('hidden');
}

window.openSAC = async function (idx) {
    console.log('[SAC] Abriendo SAC para índice:', idx);
    if (!currentIndicator || !currentYear) {
        console.error('[SAC] Faltan datos: currentIndicator o currentYear');
        return;
    }
    const period = baseMonths[idx] + (currentYear ? ` ${String(currentYear).slice(-2)}` : '');
    sacSelection.period = period;
    console.log('[SAC] Período:', period, 'Area:', currentArea, 'Indicador:', currentIndicator);

    const currentStatus = Array.isArray(sacStatusState) ? sacStatusState[idx] : null;
    const shouldPrompt = !isHistoricMode && typeof needsSAC === 'function' && needsSAC(dataState.res[idx], dataState.goal[idx]) && currentStatus !== 'submitted' && currentStatus !== 'approved';
    if (shouldPrompt) {
        const doNow = confirm('Hacer SAC ahora.');
        if (!doNow) {
            addPendingSACEntry(buildPendingEntry(idx));
            return;
        }
    }

    document.getElementById('sacModal').classList.remove('hidden');
    setSACValue('sacArea', currentArea);
    setSACValue('sacIndicador', currentIndicator);
    setSACValue('sacPeriodo', period);
    setSACValue('sacResponsable', currentUser);
    setSACValue('sacFecha', new Date().toISOString().split('T')[0]);
    clearSACFormFields();
    setSACEditable(!isHistoricMode);

    console.log('[SAC] Obteniendo datos del servidor...');
    try {
        // Siempre forzar lectura fresca (no usar cache para SAC)
        const data = await Promise.race([
            apiCall('getSAC', { area: currentArea, indicator: currentIndicator, period: period, _force: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
        ]);
        console.log('[SAC] Datos recibidos:', data);

        if (data && typeof data === 'object') {
            applySACDataToForm(data);
            const incomingStatus = mapIncomingSACStatus(pickSACValue(data, ['ESTADO', 'ESTADO (PENDIENTE / ENVIADO / VALIDADO)']));
            if (incomingStatus) {
                setSACState(idx, incomingStatus);
            } else if (pickSACValue(data, ['DESCRIPCION', 'DESCRIPCION_HALLAZGO'])) {
                setSACState(idx, 'submitted');
            }
        } else {
            // No hay registro previo - pre-generar SAC_ID desde el servidor
            console.log('[SAC] No hay registro previo para:', { area: currentArea, indicator: currentIndicator, period });
            console.log('[SAC] Generando SAC_ID...');
            try {
                const idData = await apiCall('generateSACID', { area: currentArea, _force: true });
                console.log('[SAC] SAC_ID generado:', idData);
                if (idData && idData.sacId) {
                    setSACValue('sacId', idData.sacId);
                } else {
                    setSACValue('sacId', 'Nuevo (se genera al guardar)');
                }
            } catch (idErr) {
                console.warn('[SAC] No se pudo pre-generar SAC_ID:', idErr);
                setSACValue('sacId', 'Nuevo (se genera al guardar)');
            }
        }
    } catch (error) {
        console.error('[SAC] Error al obtener datos:', error);
        setSACValue('sacId', 'Nuevo (se genera al guardar)');
    }
    console.log('[SAC] Modal abierto correctamente');
}

window.saveCurrentSAC = async function () {
    const payload = collectSACPayload();
    console.log('[SAC] Enviando payload al servidor...', payload);
    const res = await apiPost('saveSAC', payload);
    console.log('[SAC] Respuesta del servidor:', res);

    // Limpiar TODA la cache de getSAC para garantizar datos frescos
    try {
        Object.keys(apiCache).forEach(k => {
            if (k.startsWith('getSAC') || k.startsWith('generateSACID')) {
                delete apiCache[k];
            }
        });
        saveCache();
    } catch (e) { console.warn('[SAC] Error limpiando cache:', e); }

    if (res && res.success) {
        // Actualizar el SAC_ID en la interfaz si fue generado
        if (res.sacId) {
            setSACValue('sacId', res.sacId);
        }
        alert('SAC Guardado' + (res.sacId ? ` (${res.sacId})` : ''));
        document.getElementById('sacModal').classList.add('hidden');
        const targetIdx = baseMonths.findIndex(m => sacSelection.period.startsWith(m));
        if (targetIdx !== -1) {
            if (payload.ESTADO === 'VALIDADO') setSACState(targetIdx, 'approved');
            else setSACState(targetIdx, 'submitted');
        }
        removePendingSACEntry({ area: currentArea, indicator: currentIndicator, period: sacSelection.period });
        return;
    }
    alert((res && res.error) ? `No se pudo guardar SAC: ${res.error}` : 'No se pudo guardar SAC');
}

window.setSACEficacia = function (value) {
    const normalized = String(value || '').trim().toUpperCase();
    const hidden = document.getElementById('sacEficacia');
    if (hidden) hidden.value = normalized;

    const btnYes = document.getElementById('sacEficazBtn');
    const btnNo = document.getElementById('sacNoEficazBtn');
    const yesActive = normalized === 'EFICAZ';
    const noActive = normalized === 'NO_EFICAZ';

    if (btnYes) {
        btnYes.classList.toggle('ring-2', yesActive);
        btnYes.classList.toggle('ring-emerald-300', yesActive);
    }
    if (btnNo) {
        btnNo.classList.toggle('ring-2', noActive);
        btnNo.classList.toggle('ring-rose-300', noActive);
    }

    if (!sacSelection.period) return;
    const targetIdx = baseMonths.findIndex(m => sacSelection.period.startsWith(m));
    if (targetIdx === -1) return;
    if (yesActive) setSACState(targetIdx, 'approved');
    else if (noActive) setSACState(targetIdx, 'required');
}

function markSACEficaz() {
    setSACEficacia('EFICAZ');
}
