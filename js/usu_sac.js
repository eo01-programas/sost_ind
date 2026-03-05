const SAC_PENDING_KEY = 'pendingSAC';

const SAC_MIN_DYNAMIC_ROWS = 5;
const SAC_MAX_DYNAMIC_ROWS = 10;
const SAC_MIN_VERIFICATION_ROWS = 1;
const SAC_EVAL_REFERENCE = [
    { nombre: 'Luis Rios', area: 'Sostenibilidad' },
    { nombre: 'Diego Dominguez', area: 'SIG' },
    { nombre: 'Zumy Lengua', area: 'SIG' },
    { nombre: 'Carlos Gonzales', area: 'Confecciones' }
];

function getSACRowCount(tbodyId) {
    const tbody = getSACEl(tbodyId);
    if (!tbody) return 0;
    return tbody.querySelectorAll('tr').length;
}

function getSACEvaluatorRowCount() {
    return getSACRowCount('sacEvaluatorBody');
}

function getSACActionRowCount() {
    return getSACRowCount('sacCorrectiveActions');
}

function getSACVerificationRowCount() {
    return getSACRowCount('sacVerification');
}

function trimSACRows(tbodyId, keepRows) {
    const tbody = getSACEl(tbodyId);
    if (!tbody) return;
    const safeKeep = Math.max(SAC_MIN_DYNAMIC_ROWS, Math.min(SAC_MAX_DYNAMIC_ROWS, Number(keepRows) || SAC_MIN_DYNAMIC_ROWS));
    while (tbody.querySelectorAll('tr').length > safeKeep) {
        tbody.removeChild(tbody.lastElementChild);
    }
}

function createSACEvaluatorRow(index) {
    const ref = SAC_EVAL_REFERENCE[index - 1] || {};
    const nombrePlaceholder = ref.nombre || 'Nombre evaluador';
    const areaPlaceholder = ref.area || 'Área';
    return `
        <tr>
            <td class="text-center">${index}</td>
            <td><input id="sacEval${index}Nombre" type="text" placeholder="${nombrePlaceholder}" class="table-input text-left pl-2"></td>
            <td><input id="sacEval${index}Area" type="text" placeholder="${areaPlaceholder}" class="table-input"></td>
            <td class="text-center"><input id="sacEval${index}Firma" type="checkbox"></td>
        </tr>
    `;
}

function createSACActionRow(index) {
    return `
        <tr>
            <td class="text-center">${index}</td>
            <td><input id="sacAcc${index}Accion" type="text" class="table-input text-left pl-2"></td>
            <td><input id="sacAcc${index}Responsable" type="text" class="table-input"></td>
            <td><input id="sacAcc${index}Fecha" type="date" class="table-input"></td>
            <td class="text-center"><input id="sacAcc${index}Firma" type="checkbox"></td>
        </tr>
    `;
}

function createSACVerificationRow(index) {
    return `
        <tr>
            <td class="text-center">${index}</td>
            <td><input id="sacVerif${index}Accion" type="text" class="table-input text-left pl-2"></td>
            <td><input id="sacVerif${index}Responsable" type="text" class="table-input"></td>
            <td><input id="sacVerif${index}Fecha" type="date" class="table-input"></td>
            <td class="text-center"><input id="sacVerif${index}Firma" type="checkbox"></td>
        </tr>
    `;
}

function ensureSACEvaluatorRows(minRows) {
    const tbody = getSACEl('sacEvaluatorBody');
    if (!tbody) return;
    const target = Math.max(SAC_MIN_DYNAMIC_ROWS, Math.min(SAC_MAX_DYNAMIC_ROWS, Number(minRows) || SAC_MIN_DYNAMIC_ROWS));
    while (tbody.querySelectorAll('tr').length < target) {
        const idx = tbody.querySelectorAll('tr').length + 1;
        tbody.insertAdjacentHTML('beforeend', createSACEvaluatorRow(idx));
    }
}

function ensureSACActionRows(minRows) {
    const tbody = getSACEl('sacCorrectiveActions');
    if (!tbody) return;
    const target = Math.max(SAC_MIN_DYNAMIC_ROWS, Math.min(SAC_MAX_DYNAMIC_ROWS, Number(minRows) || SAC_MIN_DYNAMIC_ROWS));
    while (tbody.querySelectorAll('tr').length < target) {
        const idx = tbody.querySelectorAll('tr').length + 1;
        tbody.insertAdjacentHTML('beforeend', createSACActionRow(idx));
    }
}

function ensureSACVerificationRows(minRows) {
    const tbody = getSACEl('sacVerification');
    if (!tbody) return;
    const target = Math.max(SAC_MIN_VERIFICATION_ROWS, Math.min(SAC_MAX_DYNAMIC_ROWS, Number(minRows) || SAC_MIN_VERIFICATION_ROWS));
    while (tbody.querySelectorAll('tr').length < target) {
        const idx = tbody.querySelectorAll('tr').length + 1;
        tbody.insertAdjacentHTML('beforeend', createSACVerificationRow(idx));
    }
}

function updateSACAddButtonsState(isEditable) {
    const evalBtn = getSACEl('sacAddEvaluatorRowBtn');
    const actionBtn = getSACEl('sacAddActionRowBtn');
    const verifBtn = getSACEl('sacAddVerificationRowBtn');
    const canAddEval = !!isEditable && getSACEvaluatorRowCount() < SAC_MAX_DYNAMIC_ROWS;
    const canAddAction = !!isEditable && getSACActionRowCount() < SAC_MAX_DYNAMIC_ROWS;
    const canAddVerif = !!isEditable && getSACVerificationRowCount() < SAC_MAX_DYNAMIC_ROWS;
    if (evalBtn) {
        evalBtn.disabled = !canAddEval;
        evalBtn.classList.toggle('opacity-50', !canAddEval);
        evalBtn.classList.toggle('cursor-not-allowed', !canAddEval);
    }
    if (actionBtn) {
        actionBtn.disabled = !canAddAction;
        actionBtn.classList.toggle('opacity-50', !canAddAction);
        actionBtn.classList.toggle('cursor-not-allowed', !canAddAction);
    }
    if (verifBtn) {
        verifBtn.disabled = !canAddVerif;
        verifBtn.classList.toggle('opacity-50', !canAddVerif);
        verifBtn.classList.toggle('cursor-not-allowed', !canAddVerif);
    }
}

window.addSACEvaluatorRow = function () {
    const current = getSACEvaluatorRowCount();
    if (current >= SAC_MAX_DYNAMIC_ROWS) return;
    ensureSACEvaluatorRows(current + 1);
    setSACEditable(!isHistoricMode);
};

window.addSACActionRow = function () {
    const current = getSACActionRowCount();
    if (current >= SAC_MAX_DYNAMIC_ROWS) return;
    ensureSACActionRows(current + 1);
    setSACEditable(!isHistoricMode);
};

window.addSACVerificationRow = function () {
    const current = getSACVerificationRowCount();
    if (current >= SAC_MAX_DYNAMIC_ROWS) return;
    ensureSACVerificationRows(current + 1);
    setSACEditable(!isHistoricMode);
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
    trimSACRows('sacEvaluatorBody', SAC_MIN_DYNAMIC_ROWS);
    trimSACRows('sacCorrectiveActions', SAC_MIN_DYNAMIC_ROWS);
    trimSACRows('sacVerification', SAC_MIN_VERIFICATION_ROWS);
    ensureSACEvaluatorRows(SAC_MIN_DYNAMIC_ROWS);
    ensureSACActionRows(SAC_MIN_DYNAMIC_ROWS);
    ensureSACVerificationRows(SAC_MIN_VERIFICATION_ROWS);

    setSACValue('sacId', 'Generando...');
    setSACValue('sacDescripcion', '');
    setSACValue('sacAnalisis', '');
    setSACValue('sacAttachmentPath', '');
    setSACValue('sacReportadoPor', '');

    // Limpiar acciones
    for (let i = 1; i <= SAC_MAX_DYNAMIC_ROWS; i++) {
        setSACValue(`sacAcc${i}Accion`, '');
        setSACValue(`sacAcc${i}Responsable`, '');
        setSACValue(`sacAcc${i}Fecha`, '');
        setSACChecked(`sacAcc${i}Firma`, false);
    }

    // Limpiar evaluadores (nombres, áreas y firmas)
    for (let i = 1; i <= SAC_MAX_DYNAMIC_ROWS; i++) {
        setSACValue(`sacEval${i}Nombre`, '');
        setSACValue(`sacEval${i}Area`, '');
        setSACChecked(`sacEval${i}Firma`, false);
    }

    // Limpiar verificación
    for (let i = 1; i <= SAC_MAX_DYNAMIC_ROWS; i++) {
        setSACValue(`sacVerif${i}Accion`, '');
        setSACValue(`sacVerif${i}Responsable`, '');
        setSACValue(`sacVerif${i}Fecha`, '');
        setSACChecked(`sacVerif${i}Firma`, false);
    }

    setSACEficacia('');
}

function setSACEditable(isEditable) {
    const textIds = [
        'sacDescripcion',
        'sacAnalisis',
        'sacAttachmentPath',
        'sacReportadoPor'
    ];
    const checkIds = [
    ];
    for (let i = 1; i <= SAC_MAX_DYNAMIC_ROWS; i++) {
        textIds.push(`sacEval${i}Nombre`, `sacEval${i}Area`);
        textIds.push(`sacAcc${i}Accion`, `sacAcc${i}Responsable`, `sacAcc${i}Fecha`);
        textIds.push(`sacVerif${i}Accion`, `sacVerif${i}Responsable`, `sacVerif${i}Fecha`);
        checkIds.push(`sacEval${i}Firma`, `sacAcc${i}Firma`, `sacVerif${i}Firma`);
    }
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
    updateSACAddButtonsState(isEditable);
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
    setSACValue('sacReportadoPor', pickSACValue(data, ['REPORTADO_POR', 'USUARIO']) || getSACValue('sacReportadoPor'));
    let maxEvalRows = SAC_MIN_DYNAMIC_ROWS;
    let maxActionRows = SAC_MIN_DYNAMIC_ROWS;
    let maxVerifRows = SAC_MIN_VERIFICATION_ROWS;
    for (let i = 1; i <= SAC_MAX_DYNAMIC_ROWS; i++) {
        const evalNombre = pickSACValue(data, [`EVALUADOR_${i}_NOMBRE`]);
        const evalArea = pickSACValue(data, [`EVALUADOR_${i}_AREA`]);
        const accion = pickSACValue(data, [`ACCION_${i}`]);
        const responsable = pickSACValue(data, [`ACCION_${i}_RESPONSABLE`]);
        const fecha = pickSACValue(data, [`ACCION_${i}_FECHA`]);
        const verifAccion = pickSACValue(data, [`VERIF_${i}_ACCION`]);
        const verifResponsable = pickSACValue(data, [`VERIF_${i}_RESPONSABLE`]);
        const verifFecha = pickSACValue(data, [`VERIF_${i}_FECHA`]);
        if (hasSACText(evalNombre) || hasSACText(evalArea)) maxEvalRows = i;
        if (hasSACText(accion) || hasSACText(responsable) || hasSACText(fecha)) maxActionRows = i;
        if (hasSACText(verifAccion) || hasSACText(verifResponsable) || hasSACText(verifFecha)) maxVerifRows = i;
    }
    ensureSACEvaluatorRows(maxEvalRows);
    ensureSACActionRows(maxActionRows);
    ensureSACVerificationRows(maxVerifRows);

    for (let i = 1; i <= SAC_MAX_DYNAMIC_ROWS; i++) {
        setSACValue(`sacEval${i}Nombre`, pickSACValue(data, [`EVALUADOR_${i}_NOMBRE`]));
        setSACValue(`sacEval${i}Area`, pickSACValue(data, [`EVALUADOR_${i}_AREA`]));
        setSACChecked(`sacEval${i}Firma`, pickSACValue(data, [`EVALUADOR_${i}_FIRMA`]).toUpperCase() === 'SI');

        setSACValue(`sacAcc${i}Accion`, pickSACValue(data, [`ACCION_${i}`]));
        setSACValue(`sacAcc${i}Responsable`, pickSACValue(data, [`ACCION_${i}_RESPONSABLE`]));
        setSACValue(`sacAcc${i}Fecha`, pickSACValue(data, [`ACCION_${i}_FECHA`]));
        setSACChecked(`sacAcc${i}Firma`, pickSACValue(data, [`ACCION_${i}_FIRMA`]).toUpperCase() === 'SI');

        setSACValue(`sacVerif${i}Accion`, pickSACValue(data, [`VERIF_${i}_ACCION`]));
        setSACValue(`sacVerif${i}Responsable`, pickSACValue(data, [`VERIF_${i}_RESPONSABLE`]));
        setSACValue(`sacVerif${i}Fecha`, pickSACValue(data, [`VERIF_${i}_FECHA`]));
        setSACChecked(`sacVerif${i}Firma`, pickSACValue(data, [`VERIF_${i}_FIRMA`]).toUpperCase() === 'SI');
    }

    const eficaciaToken = parseDataEficaciaToken(data);
    if (eficaciaToken) setSACEficacia(eficaciaToken);
    setSACEditable(!isHistoricMode);
}

function normalizeSignatureFlag(checked) {
    return checked ? 'SI' : 'NO';
}

function collectSACPayload() {
    ensureSACEvaluatorRows(SAC_MIN_DYNAMIC_ROWS);
    ensureSACActionRows(SAC_MIN_DYNAMIC_ROWS);
    ensureSACVerificationRows(SAC_MIN_VERIFICATION_ROWS);

    const desc = getSACValue('sacDescripcion');
    const analisis = getSACValue('sacAnalisis');
    const attachmentPath = getSACValue('sacAttachmentPath');
    const reportadoPor = getSACValue('sacReportadoPor') || currentUser;
    const eficaciaToken = getSACValue('sacEficacia');
    const eficaciaSiNo = eficaciaTokenToSiNo(eficaciaToken);
    const actions = [];
    const evaluators = [];
    const verifications = [];

    const today = new Date().toISOString().split('T')[0];

    // Obtener SAC_ID si ya fue generado
    const sacIdEl = getSACEl('sacId');
    const sacIdVal = sacIdEl ? String(sacIdEl.value || '').trim() : '';

    // SAC_ID válido: no vacío, no placeholder
    const isValidSacId = sacIdVal &&
        sacIdVal !== 'Generando...' &&
        !sacIdVal.startsWith('Nuevo') &&
        !sacIdVal.startsWith('Se genera');

    const payload = {
        SAC_ID: isValidSacId ? sacIdVal : '',
        AREA: currentArea,
        INDICADOR: currentIndicator,
        PERIODO: sacSelection.period,
        CODIGO: 'FP-GG-SIG-05-02',
        VERSION: '02',
        FECHA: getSACValue('sacFecha') || today,
        RESPONSABLE: getSACValue('sacResponsable') || currentUser,
        REPORTADO_POR: reportadoPor,
        USUARIO: reportadoPor,
        DESCRIPCION: desc,
        DESCRIPCION_HALLAZGO: desc,
        ANALISIS_CAUSA: analisis,

        EFICAZ: eficaciaSiNo,
        FECHA_EFICACIA: eficaciaSiNo ? today : '',
        USUARIO_EFICACIA: eficaciaSiNo ? currentUser : '',

        ADJUNTOS: attachmentPath,
        ADJUNTOS_RUTA: attachmentPath
    };

    for (let i = 1; i <= SAC_MAX_DYNAMIC_ROWS; i++) {
        const evalNombre = getSACValue(`sacEval${i}Nombre`);
        const evalArea = getSACValue(`sacEval${i}Area`);
        const evalFirma = getSACChecked(`sacEval${i}Firma`);
        payload[`EVALUADOR_${i}_NOMBRE`] = evalNombre;
        payload[`EVALUADOR_${i}_AREA`] = evalArea;
        payload[`EVALUADOR_${i}_FIRMA`] = (hasSACText(evalNombre) || hasSACText(evalArea) || evalFirma)
            ? normalizeSignatureFlag(evalFirma)
            : '';
        if (hasSACText(evalNombre)) evaluators.push(evalNombre);

        const accion = getSACValue(`sacAcc${i}Accion`);
        const responsable = getSACValue(`sacAcc${i}Responsable`);
        const fecha = getSACValue(`sacAcc${i}Fecha`);
        const firma = getSACChecked(`sacAcc${i}Firma`);
        payload[`ACCION_${i}`] = accion;
        payload[`ACCION_${i}_RESPONSABLE`] = responsable;
        payload[`ACCION_${i}_FECHA`] = fecha;
        payload[`ACCION_${i}_FIRMA`] = (hasSACText(accion) || hasSACText(responsable) || hasSACText(fecha) || firma)
            ? normalizeSignatureFlag(firma)
            : '';
        if (hasSACText(accion)) actions.push(accion);

        const verifAccion = getSACValue(`sacVerif${i}Accion`);
        const verifResponsable = getSACValue(`sacVerif${i}Responsable`);
        const verifFecha = getSACValue(`sacVerif${i}Fecha`);
        const verifFirma = getSACChecked(`sacVerif${i}Firma`);
        payload[`VERIF_${i}_ACCION`] = verifAccion;
        payload[`VERIF_${i}_RESPONSABLE`] = verifResponsable;
        payload[`VERIF_${i}_FECHA`] = verifFecha;
        payload[`VERIF_${i}_FIRMA`] = (hasSACText(verifAccion) || hasSACText(verifResponsable) || hasSACText(verifFecha) || verifFirma)
            ? normalizeSignatureFlag(verifFirma)
            : '';
        if (hasSACText(verifAccion)) verifications.push(verifAccion);
    }

    payload.ACCION_CORRECTIVA_RESUMEN = actions.join(' | ');
    payload.EQUIPO_EVALUADOR = evaluators.join(', ');

    const hasBodyContent = [
        payload.DESCRIPCION_HALLAZGO,
        payload.ANALISIS_CAUSA,
    ].some(hasSACText);
    const hasAnyAction = actions.some(hasSACText);
    const hasAnyVerification = verifications.some(hasSACText);

    payload.ESTADO = payload.EFICAZ === 'SI' ? 'VALIDADO' : ((hasBodyContent || hasAnyAction || hasAnyVerification) ? 'ENVIADO' : 'PENDIENTE');

    // Log para depuración — verificar que todos los campos se capturan
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


    document.getElementById('sacModal').classList.remove('hidden');
    setSACValue('sacArea', currentArea);
    setSACValue('sacIndicador', currentIndicator);
    setSACValue('sacPeriodo', period);
    setSACValue('sacResponsable', currentUser);
    setSACValue('sacFecha', new Date().toISOString().split('T')[0]);
    clearSACFormFields();
    setSACValue('sacReportadoPor', currentUser);
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
            console.log('[SAC] No hay registro previo, generando SAC_ID...');
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

    // Limpiar TODA la cache de getSAC para garantizar datos frescos en la próxima apertura
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

/**
 * Crea un registro SAC PENDIENTE en el backend (sin llenar el formulario).
 * Genera SAC_ID automáticamente y usa ESTADO='PENDIENTE'.
 */
window.createPendingSACBackend = async function (idx) {
    if (!currentArea || !currentIndicator || !currentYear) return;
    const period = baseMonths[idx] + (currentYear ? ` ${String(currentYear).slice(-2)}` : '');
    const today = new Date().toISOString().split('T')[0];

    sacStatusState[idx] = 'pending_entry';
    renderTable();

    const payload = {
        SAC_ID: '',
        AREA: currentArea,
        INDICADOR: currentIndicator,
        PERIODO: period,
        CODIGO: 'FP-GG-SIG-05-02',
        VERSION: '02',
        FECHA: today,
        RESPONSABLE: currentUser,
        REPORTADO_POR: currentUser,
        USUARIO: currentUser,
        DESCRIPCION: '',
        DESCRIPCION_HALLAZGO: '',
        ANALISIS_CAUSA: '',
        ACCION_CORRECTIVA_RESUMEN: '',
        EQUIPO_EVALUADOR: '',
        ESTADO: 'PENDIENTE'
    };

    console.log('[SAC] Creando SAC PENDIENTE para', period);
    try {
        const res = await apiPost('saveSAC', payload);
        console.log('[SAC] Respuesta PENDIENTE:', res);
        if (res && res.success) {
            // Limpiar cache de getSAC
            Object.keys(apiCache).forEach(k => {
                if (k.startsWith('getSAC') || k.startsWith('generateSACID')) delete apiCache[k];
            });
            saveCache();
        }
    } catch (e) {
        console.error('[SAC] Error creando PENDIENTE:', e);
    }
}

/**
 * Muestra el modal de prompt SAC para un mes dado.
 * Retorna una promesa que resuelve a 'yes', 'no', o 'dismiss'.
 */
window.showSACPrompt = function (idx) {
    return new Promise((resolve) => {
        const modal = document.getElementById('sacPromptModal');
        const periodLabel = document.getElementById('sacPromptPeriod');
        const btnYes = document.getElementById('sacPromptYes');
        const btnNo = document.getElementById('sacPromptNo');
        const btnClose = document.getElementById('sacPromptClose');
        if (!modal || !btnYes) { resolve('dismiss'); return; }

        const period = baseMonths[idx] + (currentYear ? ` ${String(currentYear).slice(-2)}` : '');
        if (periodLabel) periodLabel.textContent = period;

        // Limpiar listeners anteriores clonando botón principal
        const newYes = btnYes.cloneNode(true);
        btnYes.parentNode.replaceChild(newYes, btnYes);
        // Compatibilidad con HTML en caché: ocultar botón "No" si todavía existe
        if (btnNo) btnNo.classList.add('hidden');

        let newClose = null;
        if (btnClose && btnClose.parentNode) {
            newClose = btnClose.cloneNode(true);
            btnClose.parentNode.replaceChild(newClose, btnClose);
        }

        let done = false;
        const finish = (answer) => {
            if (done) return;
            done = true;
            modal.classList.add('hidden');
            modal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKeydown);
            resolve(answer);
        };

        const onBackdrop = (event) => {
            if (event.target === modal) finish('no');
        };
        const onKeydown = (event) => {
            if (event.key === 'Escape') finish('no');
        };

        modal.classList.remove('hidden');
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKeydown);

        newYes.addEventListener('click', () => finish('yes'));
        if (newClose) newClose.addEventListener('click', () => finish('no'));
    });
}
