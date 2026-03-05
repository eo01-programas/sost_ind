let isAdminUser = false;
const ADMIN_IDENTIFIERS = ['admin', 'administrador', 'adminitrador', 'administracion', 'adm'];
let adminCreateMessageTimeout = null;
let adminCreateTableState = {
    periods: [],
    data: { num: [], den: [], res: [], goal: [] }
};
let adminCreateMode = 'create';

const ADMIN_MODULE_MAP = {
    create: 'adminModuleCreate',
    historic: 'adminModuleHistoric',
    dashboard: 'adminModuleDashboard'
};

function normalizeAdminIdentity(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function isAdminRoleValue(value) {
    const normalizedRole = normalizeAdminIdentity(value);
    if (!normalizedRole) return false;
    return ['admin', 'administrador', 'superadmin', 'root'].some(role => normalizedRole.includes(role));
}

function isAdminYesToken(value) {
    const text = String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return ['si', 'true', '1', 'cerrado', 'cerrada', 'closed'].includes(text);
}

function setAdminCreateCloseFichaChecked(value) {
    const closeFichaEl = document.getElementById('adminCreateCloseFicha');
    if (!closeFichaEl) return;
    closeFichaEl.checked = !!value;
}

window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-admin-module]').forEach(btn => {
        btn.addEventListener('click', () => setActiveAdminModule(btn.dataset.adminModule));
    });

    const freqSelect = document.getElementById('adminCreateFrequency');
    const yearInput = document.getElementById('adminCreateYear');
    const updateDateInput = document.getElementById('adminCreateUpdateDate');
    const tableBody = document.getElementById('adminCreateTableBody');
    if (yearInput && !yearInput.value) yearInput.value = new Date().getFullYear();
    if (updateDateInput && !updateDateInput.value) updateDateInput.value = getTodayIsoDate();

    freqSelect?.addEventListener('change', renderAdminCreatePreview);
    yearInput?.addEventListener('input', renderAdminCreatePreview);
    ['adminCreateFormulaNum', 'adminCreateFormulaDen', 'adminCreateFormulaSpecial', 'adminCreateUnit'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            updateAdminCreateFormulaPreview();
            recalculateAdminCreateResults();
        });
    });
    tableBody?.addEventListener('input', handleAdminCreateTableInput);
    renderAdminCreatePreview();
    updateAdminCreateFormulaPreview();

    document.getElementById('adminCreateArea')?.addEventListener('change', (event) => {
        const area = (event.target?.value || '').trim();
        loadAdminCreateIndicators(area);
        loadAdminReferenceYears(area, (document.getElementById('adminCreateIndicator')?.value || '').trim());
    });
    document.getElementById('adminCreateIndicator')?.addEventListener('change', () => handleAdminCreateIndicatorChange());
    let adminIndicatorTimer;
    document.getElementById('adminCreateIndicator')?.addEventListener('input', () => {
        clearTimeout(adminIndicatorTimer);
        adminIndicatorTimer = setTimeout(() => { handleAdminCreateIndicatorChange(); }, 250);
    });
    document.getElementById('adminCreateReferenceYear')?.addEventListener('change', () => handleAdminCreateReferenceYearChange());
    document.getElementById('adminCreateCopyButton')?.addEventListener('click', () => handleAdminCreateCopyReference());
});

function getTodayIsoDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function evaluateAdminPrivileges() {
    const adminSection = document.getElementById('adminSection');
    const userSection = document.getElementById('userSection');
    const normalizedUser = normalizeAdminIdentity(currentUser);
    const normalizedArea = normalizeAdminIdentity(currentArea);
    const storedRole = (typeof currentUserRole !== 'undefined' && currentUserRole)
        ? currentUserRole
        : (localStorage.getItem('currentUserRole') || '');
    const matchesByName = ADMIN_IDENTIFIERS.some(key => {
        const normalizedKey = normalizeAdminIdentity(key);
        return normalizedUser.includes(normalizedKey) || normalizedArea.includes(normalizedKey);
    });
    const matches = matchesByName || isAdminRoleValue(storedRole);
    isAdminUser = matches;
    if (isAdminUser) {
        userSection?.classList.add('hidden');
        adminSection?.classList.remove('hidden');
        setAdminSidebarVisible(true);
        refreshAdminAreaOptions();
        setDefaultAdminSelections();
        const adminArea = getSelectedAdminArea();
        // Cargar datos admin en paralelo para mayor velocidad
        const adminLoads = [];
        if (typeof loadAdminHistoricYears === 'function') adminLoads.push(loadAdminHistoricYears(adminArea));
        if (typeof loadAdminDashboardIndicators === 'function') adminLoads.push(loadAdminDashboardIndicators(adminArea));
        if (typeof updateAdminDashboardYearInputs === 'function') adminLoads.push(updateAdminDashboardYearInputs(adminArea, null));
        adminLoads.push(loadAdminCreateIndicators(adminArea));
        Promise.all(adminLoads).catch(e => console.error('Admin parallel load error', e));
        setActiveAdminModule('create');
        setAdminCreateMode('create');
    } else {
        userSection?.classList.remove('hidden');
        adminSection?.classList.add('hidden');
        setAdminSidebarVisible(false);
    }
}

function setDefaultAdminSelections() {
    const preferredArea = String(currentArea || '').trim();
    ['adminCreateArea', 'adminHistoricArea', 'adminDashboardArea'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const hasPreferredArea = preferredArea && Array.from(el.options || []).some(option => option.value === preferredArea);
        if (hasPreferredArea) {
            el.value = preferredArea;
            return;
        }
        const firstValidOption = Array.from(el.options || []).find(option => option.value);
        if (firstValidOption) {
            el.value = firstValidOption.value;
            return;
        }
        el.value = '';
    });
}

function getSelectedAdminArea() {
    const preferred = ['adminCreateArea', 'adminHistoricArea', 'adminDashboardArea'];
    for (let i = 0; i < preferred.length; i++) {
        const value = (document.getElementById(preferred[i])?.value || '').trim();
        if (value) return value;
    }
    return '';
}

function setAdminCreateEditableState() {
    const ids = [
        'adminCreateArea','adminCreateResponsable','adminCreateUpdateDate','adminCreateYear','adminCreateIndicator',
        'adminCreateReferenceYear','adminCreateMeta','adminCreateObjective','adminCreatePrevGoal','adminCreateComments','adminCreateFrequency',
        'adminCreateUnit','adminCreateSource','adminCreateFormulaNum','adminCreateFormulaDen'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.removeAttribute('disabled');
        el.readOnly = false;
        el.classList.remove('bg-slate-50', 'text-slate-500');
    });

    const tableInputs = document.querySelectorAll('#adminCreateTableBody input');
    tableInputs.forEach(input => {
        const rowKey = (input.dataset?.row || '').toLowerCase();
        const isCalculated = rowKey === 'res' || rowKey === 'goal';
        input.removeAttribute('disabled');
        input.readOnly = isCalculated;
        input.classList.remove('bg-slate-50', 'text-slate-500');
    });

    const closeFichaEl = document.getElementById('adminCreateCloseFicha');
    if (closeFichaEl) {
        closeFichaEl.removeAttribute('disabled');
        closeFichaEl.classList.remove('opacity-60');
    }
}

function setAdminCreateReadonlyState() {
    const ids = [
        'adminCreateArea','adminCreateResponsable','adminCreateUpdateDate','adminCreateYear','adminCreateIndicator',
        'adminCreateReferenceYear','adminCreateMeta','adminCreateObjective','adminCreatePrevGoal','adminCreateComments','adminCreateFrequency',
        'adminCreateUnit','adminCreateSource','adminCreateFormulaNum','adminCreateFormulaDen'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const tag = (el.tagName || '').toUpperCase();
        if (tag === 'SELECT' || (tag === 'INPUT' && String(el.type || '').toLowerCase() === 'date')) {
            el.setAttribute('disabled', 'disabled');
        }
        el.readOnly = true;
        el.classList.add('bg-slate-50', 'text-slate-500');
    });

    const tableInputs = document.querySelectorAll('#adminCreateTableBody input');
    tableInputs.forEach(input => {
        input.setAttribute('disabled', 'disabled');
        input.readOnly = true;
        input.classList.add('bg-slate-50', 'text-slate-500');
    });

    const closeFichaEl = document.getElementById('adminCreateCloseFicha');
    if (closeFichaEl) {
        closeFichaEl.setAttribute('disabled', 'disabled');
        closeFichaEl.classList.add('opacity-60');
    }
}

function setAdminCreateMode(mode) {
    adminCreateMode = mode === 'historic' ? 'historic' : 'create';
    const isHistoricMode = adminCreateMode === 'historic';

    const title = document.getElementById('adminCreateTitle');
    if (title) {
        title.textContent = isHistoricMode ? 'Historico de ficha' : 'Crear nueva ficha';
    }

    ['adminCreateSaveButton', 'adminCreateDeleteButton', 'adminCreateResetButton'].forEach(id => {
        const button = document.getElementById(id);
        if (!button) return;
        button.classList.toggle('hidden', isHistoricMode);
    });

    if (isHistoricMode) {
        setAdminCreateReadonlyState();
    } else {
        setAdminCreateEditableState();
    }
}

function setActiveAdminModule(key) {
    Object.keys(ADMIN_MODULE_MAP).forEach(name => {
        const section = document.getElementById(ADMIN_MODULE_MAP[name]);
        const button = document.querySelector(`[data-admin-module="${name}"]`);
        const active = name === key;
        if (section) section.classList.toggle('hidden', !active);
        if (button) {
            button.classList.remove('bg-slate-900', 'text-white', 'bg-white', 'text-slate-600');
        }
    });
    if (key === 'create') setAdminCreateMode('create');
    setAdminSidebarActive(key);
}


async function loadAdminReferenceYears(area, indicator) {
    const select = document.getElementById('adminCreateReferenceYear');
    if (!select) return;
    const previousValue = (select.value || '').trim();
    if (!area) {
        select.innerHTML = '<option value="">Seleccione &aacute;rea</option>';
        return;
    }
    select.innerHTML = '<option value="">Cargando...</option>';
    try {
        const params = { area, complete: 0 };
        const yearsPayload = await apiCall('getValidYears', params);
        const years = Array.from(new Set(parseYearEntries(yearsPayload))).filter(Boolean).map(String);
        years.sort((a,b) => Number(b) - Number(a));
        if (!years.length) {
            select.innerHTML = '<option value="">Sin a&ntilde;os disponibles</option>';
            return;
        }
        select.innerHTML = '<option value="">-- Seleccionar a&ntilde;o --</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
        if (previousValue && years.includes(previousValue)) {
            select.value = previousValue;
        }
    } catch (err) {
        console.error(err);
        select.innerHTML = '<option value="">Error al cargar a&ntilde;os</option>';
    }
}

function applyAdminCreateHeadFromRow(head) {
    if (!head) return;
    const objectiveEl = document.getElementById('adminCreateObjective');
    const metaEl = document.getElementById('adminCreateMeta');
    const prevGoalEl = document.getElementById('adminCreatePrevGoal');
    const commentsEl = document.getElementById('adminCreateComments');
    const unitEl = document.getElementById('adminCreateUnit');
    const freqEl = document.getElementById('adminCreateFrequency');
    const sourceEl = document.getElementById('adminCreateSource');
    const formulaNumEl = document.getElementById('adminCreateFormulaNum');
    const formulaDenEl = document.getElementById('adminCreateFormulaDen');
    const formulaSpecialEl = document.getElementById('adminCreateFormulaSpecial');
    const responsibleEl = document.getElementById('adminCreateResponsable');
    const getHeadValue = (keys) => {
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (head[key] !== undefined && head[key] !== null && String(head[key]).trim() !== '') {
                return String(head[key]).trim();
            }
        }
        return '';
    };

    if (objectiveEl) objectiveEl.value = head.OBJETIVO || head.OBETIVO_INDICADOR || '';
    if (metaEl) metaEl.value = formatDisplayValue(head.META || '', 2, (head.UNIDAD_MEDIDA || '%') === '%', head.UNIDAD_MEDIDA || '') || '';
    if (prevGoalEl) prevGoalEl.value = head.META_ANTERIOR || '';
    if (commentsEl) commentsEl.value = head.COMENTARIOS || '';
    if (unitEl) unitEl.value = head.UNIDAD_MEDIDA || '%';
    if (sourceEl) sourceEl.value = head.FUENTE_INFORMACION || '';
    if (freqEl) freqEl.value = (head.FRECUENCIA || 'MENSUAL').toUpperCase();
    const formulaNum = getHeadValue(['FORMULA_NUMERADOR', 'FORMULA NUMERADOR', 'FORMULA_NUM', 'FORMULA NUM']);
    const formulaDen = getHeadValue(['FORMULA_DENOMINADOR', 'FORMULA DENOMINADOR', 'FORMULA_DEN', 'FORMULA DEN']);
    const formulaSpecial = getHeadValue(['CARACTER_ESPECIAL', 'CARACTER ESPECIAL', 'FORMULA_ESPECIAL', 'FORMULA ESPECIAL']);
    if (formulaNumEl) formulaNumEl.value = formulaNum;
    if (formulaDenEl) formulaDenEl.value = formulaDen;
    if (formulaSpecialEl) formulaSpecialEl.value = formulaSpecial;
    if (responsibleEl) responsibleEl.value = head.USUARIO_RESPONSABLE || currentUser || '';
    setAdminCreateCloseFichaChecked(isAdminYesToken(head.FICHA_CERRADA || head['FICHA CERRADA'] || head.CERRAR_FICHA || head['CERRAR FICHA']));
    const mode = (formulaDen || '').toString().trim() ? 'fraction' : 'single';
    applyAdminFormulaMode(mode);
}

async function loadAdminCreateReferenceData(area, indicator, refYear) {
    try {
        const rows = await apiCall('getIndicatorData', { area, indicator, year: refYear });
        if (!Array.isArray(rows) || !rows.length) return false;
        applyAdminCreateHeadFromRow(rows[0]);
        renderAdminCreatePreview();
        populateAdminCreateTableData(rows);
        clearAdminCreateNumDen(true);
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

async function handleAdminCreateReferenceYearChange() {
    const area = (document.getElementById('adminCreateArea')?.value || '').trim();
    const indicator = (document.getElementById('adminCreateIndicator')?.value || '').trim();
    const refYear = (document.getElementById('adminCreateReferenceYear')?.value || '').trim();
    if (!refYear) return;
    if (!area) {
        showAdminCreateMessage('Selecciona &aacute;rea.', 'warn');
        return;
    }
    if (!indicator) {
        showAdminCreateMessage('Selecciona indicador.', 'warn');
        return;
    }
    const ok = await loadAdminCreateReferenceData(area, indicator, refYear);
    if (!ok) {
        showAdminCreateMessage('No hay datos para el a&ntilde;o de referencia.', 'warn');
        return;
    }
    showAdminCreateMessage('A&ntilde;o de referencia cargado.', 'success');
}



async function handleAdminCreateCopyReference() {
    const area = (document.getElementById('adminCreateArea')?.value || '').trim();
    const indicator = (document.getElementById('adminCreateIndicator')?.value || '').trim();
    const refYear = (document.getElementById('adminCreateReferenceYear')?.value || '').trim();
    const newYear = (document.getElementById('adminCreateYear')?.value || '').trim();
    if (!area || !indicator) {
        showAdminCreateMessage('Selecciona &aacute;rea e indicador.', 'warn');
        return;
    }
    if (!refYear || !newYear) {
        showAdminCreateMessage('Selecciona a&ntilde;o referencia y a&ntilde;o nuevo.', 'warn');
        return;
    }
    try {
        const yearInput = document.getElementById('adminCreateYear');
        if (yearInput) yearInput.value = newYear;
        const ok = await loadAdminCreateReferenceData(area, indicator, refYear);
        if (!ok) {
            showAdminCreateMessage('No hay datos para el a&ntilde;o de referencia.', 'warn');
            return;
        }
        showAdminCreateMessage('Datos copiados. Puedes editar todo.', 'success');
    } catch (err) {
        console.error(err);
        showAdminCreateMessage('Error al copiar el a&ntilde;o de referencia.', 'error');
    }
}

async function handleAdminFichaSave() {
    const area = (document.getElementById('adminCreateArea')?.value || '').trim();
    const year = (document.getElementById('adminCreateYear')?.value || '').trim();
    const indicator = (document.getElementById('adminCreateIndicator')?.value || '').trim();
    const frequency = (document.getElementById('adminCreateFrequency')?.value || '').trim();
    const objective = (document.getElementById('adminCreateObjective')?.value || '').trim();
    const meta = (document.getElementById('adminCreateMeta')?.value || '').trim();
    const prevGoal = (document.getElementById('adminCreatePrevGoal')?.value || '').trim();
    const comments = (document.getElementById('adminCreateComments')?.value || '').trim();
    const unit = (document.getElementById('adminCreateUnit')?.value || '').trim();
    const source = (document.getElementById('adminCreateSource')?.value || '').trim();
    const updateDate = (document.getElementById('adminCreateUpdateDate')?.value || '').trim();
    const responsable = (document.getElementById('adminCreateResponsable')?.value || '').trim();
    const closeFicha = !!document.getElementById('adminCreateCloseFicha')?.checked;
    let formulaNum = (document.getElementById('adminCreateFormulaNum')?.value || '').trim();
    let formulaDen = (document.getElementById('adminCreateFormulaDen')?.value || '').trim();
    let formulaSpecial = (document.getElementById('adminCreateFormulaSpecial')?.value || '').trim();
    const scale = '1';

    if (!area || !year || !indicator) {
        showAdminCreateMessage('Completa área, año e indicador antes de generar.', 'warn');
        return;
    }

    const refYear = (document.getElementById('adminCreateReferenceYear')?.value || '').trim();
    if (!formulaNum && !formulaDen && !formulaSpecial && refYear) {
        try {
            const rows = await apiCall('getIndicatorData', { area, indicator, year: refYear });
            const head = Array.isArray(rows) && rows.length ? rows[0] : {};
            const pick = (keys) => {
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    if (head[key] !== undefined && head[key] !== null && String(head[key]).trim() !== '') {
                        return String(head[key]).trim();
                    }
                }
                return '';
            };
            formulaNum = pick(['FORMULA_NUMERADOR', 'FORMULA NUMERADOR', 'FORMULA_NUM', 'FORMULA NUM']);
            formulaDen = pick(['FORMULA_DENOMINADOR', 'FORMULA DENOMINADOR', 'FORMULA_DEN', 'FORMULA DEN']);
            formulaSpecial = pick(['CARACTER_ESPECIAL', 'CARACTER ESPECIAL', 'FORMULA_ESPECIAL', 'FORMULA ESPECIAL']);
        } catch (err) {
            console.error('No se pudo cargar la fórmula de referencia', err);
        }
    }
    const formulaCalc = buildFormulaCalc(formulaNum, formulaDen, formulaSpecial);

    const rows = adminCreateTableState.periods.map((period, idx) => ({
        PERIODO: period.key,
        NUMERADOR: adminCreateTableState.data.num[idx] || '',
        DENOMINADOR: adminCreateTableState.data.den[idx] || '',
        RESULTADO: adminCreateTableState.data.res[idx] || '',
        META: adminCreateTableState.data.goal[idx] || ''
    }));

    const payload = {
        AREA: area,
        INDICADOR: indicator,
        ANO: year,
        YEAR: year,
        REF_YEAR: refYear,
        REFERENCE_YEAR: refYear,
        FRECUENCIA: frequency,
        UNIDAD_MEDIDA: unit,
        FUENTE_INFORMACION: source,
        FECHA_ACTUALIZACION: updateDate,
        USUARIO_RESPONSABLE: responsable || currentUser || '',
        COMENTARIOS: comments,
        META: meta,
        META_ANTERIOR: prevGoal,
        OBJETIVO: objective,
        FORMULA_NUMERADOR: formulaNum,
        FORMULA_DENOMINADOR: formulaDen,
        CARACTER_ESPECIAL: formulaSpecial,
        FORMULA_CALCULO: formulaCalc,
        FICHA_CERRADA: closeFicha ? 'SI' : 'NO',
        ESCALA_RESULTADO: scale,
        FILAS: rows
    };

    setAdminCreateProcessing(true);
    apiPost('createFicha', payload).then(res => {
        setAdminCreateProcessing(false);
        if (res && res.success) {
            showAdminCreateMessage(closeFicha ? 'Ficha guardada y cerrada para historico.' : 'Ficha generada correctamente.', 'success');
        } else {
            showAdminCreateMessage(res?.error || 'No se pudo crear la ficha.', 'error');
        }
    }).catch(err => {
        setAdminCreateProcessing(false);
        console.error(err);
        showAdminCreateMessage('Ocurrió un error al generar.', 'error');
    });
}

async function loadAdminHistoricFullFicha(area, indicator, year) {
    const safeArea = String(area || '').trim();
    const safeIndicator = String(indicator || '').trim();
    const safeYear = String(year || '').trim();
    if (!safeArea || !safeIndicator || !safeYear) {
        return { success: false, error: 'Completa area, ano e indicador.' };
    }

    try {
        const areaEl = document.getElementById('adminCreateArea');
        const indicatorEl = document.getElementById('adminCreateIndicator');
        const yearEl = document.getElementById('adminCreateYear');
        const referenceYearEl = document.getElementById('adminCreateReferenceYear');

        if (areaEl) areaEl.value = safeArea;
        await loadAdminCreateIndicators(safeArea);
        if (indicatorEl) indicatorEl.value = safeIndicator;
        await loadAdminReferenceYears(safeArea, safeIndicator);
        if (yearEl) yearEl.value = safeYear;
        if (referenceYearEl) referenceYearEl.value = safeYear;

        const rows = await apiCall('getIndicatorData', { area: safeArea, indicator: safeIndicator, year: safeYear });
        if (!Array.isArray(rows) || !rows.length) {
            return { success: false, error: 'No existen registros para ese criterio.' };
        }

        applyAdminCreateHeadFromRow(rows[0]);
        renderAdminCreatePreview();
        populateAdminCreateTableData(rows);

        setActiveAdminModule('create');
        setAdminCreateMode('historic');
        setAdminSidebarActive('historic');
        showAdminCreateMessage(`Ficha historica cargada: ${safeIndicator} (${safeYear}).`, 'success');
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: 'Ocurrio un error al cargar la ficha historica.' };
    }
}

function buildFormulaCalc(num, den, special) {
    const numText = String(num || '').trim();
    const denText = String(den || '').trim();
    const specialText = String(special || '').trim();
    const left = [numText, specialText].filter(Boolean).join(' ').trim();
    if (denText) {
        return left ? `${left} / ${denText}` : denText;
    }
    return left;
}

function handleAdminFichaDelete() {
    const area = (document.getElementById('adminCreateArea')?.value || '').trim();
    const year = (document.getElementById('adminCreateYear')?.value || '').trim();
    const indicator = (document.getElementById('adminCreateIndicator')?.value || '').trim();
    if (!area || !year || !indicator) {
        showAdminCreateMessage('Completa área, año e indicador antes de eliminar.', 'warn');
        return;
    }
    const confirmed = window.confirm(`¿Eliminar la ficha ${indicator} (${year}) del área ${area}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    const payload = { AREA: area, INDICADOR: indicator, YEAR: year, AÑO: year };
    apiPost('deleteFicha', payload).then(res => {
        if (res && res.success) {
            const count = Number(res.deleted || 0);
            const msg = count ? `Ficha eliminada. Se borraron ${count} registros.` : 'No se encontraron registros para eliminar.';
            showAdminCreateMessage(msg, 'success');
        } else {
            showAdminCreateMessage(res?.error || 'No se pudo eliminar la ficha.', 'error');
        }
    }).catch(err => {
        console.error(err);
        showAdminCreateMessage('Ocurrió un error al eliminar.', 'error');
    });
}

function setAdminCreateProcessing(isProcessing) {
    const btn = document.getElementById('adminCreateSaveButton');
    if (!btn) return;
    btn.disabled = isProcessing;
    btn.textContent = isProcessing ? 'Generando...' : 'Generar nueva ficha';
}

function renderAdminCreatePreview() {
    const header = document.getElementById('adminCreateTableHeader');
    const body = document.getElementById('adminCreateTableBody');
    if (!header || !body) return;

    const yearVal = Number(document.getElementById('adminCreateYear')?.value);
    const frequency = (document.getElementById('adminCreateFrequency')?.value || 'MENSUAL').toUpperCase();
    const year = Number.isFinite(yearVal) && yearVal > 0 ? yearVal : new Date().getFullYear();
    const periods = buildAdminCreatePeriods(year, frequency);

    adminCreateTableState.periods = periods;
    adminCreateTableState.data = {
        num: periods.map(() => ''),
        den: periods.map(() => ''),
        res: periods.map(() => ''),
        goal: periods.map(() => '')
    };

    while (header.children.length > 1) header.removeChild(header.lastChild);
    periods.forEach(period => {
        const th = document.createElement('th');
        th.className = 'p-2 border-r border-slate-600 text-center min-w-[80px]';
        th.textContent = period.label;
        header.appendChild(th);
    });

    body.innerHTML = '';
    const rows = [
        { key: 'num', label: 'Numerador' },
        { key: 'den', label: 'Denominador' },
        { key: 'res', label: 'Resultado' },
        { key: 'goal', label: 'Meta' }
    ];

    rows.forEach(def => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<th class="p-3 text-left bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-700 sticky left-0 shadow-sm">${def.label}</th>`;
        periods.forEach((period, idx) => {
            const isResultRow = def.key === 'res' || def.key === 'goal';
            tr.innerHTML += `
                <td class="border-r border-slate-200 p-0 h-10 min-w-[80px]">
                    <input class="w-full h-full text-center text-xs ${isResultRow ? 'bg-slate-50 text-slate-500' : 'bg-white'} focus:outline-none" ${isResultRow ? 'readonly' : ''} data-row="${def.key}" data-idx="${idx}" placeholder="-" />
                </td>`;
        });
        body.appendChild(tr);
    });

    writeAdminCreateTableInputs();
    updateAdminCreateFormulaPreview();
    recalculateAdminCreateResults();
}

function handleAdminCreateTableInput(event) {
    const target = event.target;
    if (!target || !target.dataset) return;
    const rowKey = target.dataset.row;
    const idx = Number(target.dataset.idx);
    if (!rowKey || !Number.isFinite(idx)) return;
    if (!adminCreateTableState.data[rowKey]) return;
    adminCreateTableState.data[rowKey][idx] = target.value;
    if (rowKey === 'num' || rowKey === 'den') {
        recalculateAdminCreateResults();
    }
}

function clearAdminCreateNumDen(silent = false) {
    if (!adminCreateTableState || !adminCreateTableState.periods) return;
    const count = adminCreateTableState.periods.length;
    adminCreateTableState.data.num = Array.from({ length: count }, () => '');
    adminCreateTableState.data.den = Array.from({ length: count }, () => '');
    recalculateAdminCreateResults();
    if (!silent) showAdminCreateMessage('Numerador y denominador limpiados.', 'info');
}

function shouldClearAdminCreateNumbers(sourceYear) {
    const targetYear = (document.getElementById('adminCreateYear')?.value || '').trim();
    if (!sourceYear || !targetYear) return false;
    return String(sourceYear).trim() !== String(targetYear).trim();
}

function recalculateAdminCreateResults() {
    const scaleValue = 1;
    const unit = (document.getElementById('adminCreateUnit')?.value || '').trim();
    adminCreateTableState.periods.forEach((period, idx) => {
        const num = parseAdminNumber(adminCreateTableState.data.num[idx]);
        const den = parseAdminNumber(adminCreateTableState.data.den[idx]);
        if (isFinite(num) && isFinite(den) && den !== 0) {
            const raw = (num / den) * (isFinite(scaleValue) ? scaleValue : 1);
            adminCreateTableState.data.res[idx] = formatAdminNumber(raw);
        } else {
            adminCreateTableState.data.res[idx] = '';
        }
        if (unit && adminCreateTableState.data.res[idx]) {
            adminCreateTableState.data.res[idx] = `${adminCreateTableState.data.res[idx]} ${unit}`;
        }
    });
    writeAdminCreateTableInputs();
}

function writeAdminCreateTableInputs() {
    const tbody = document.getElementById('adminCreateTableBody');
    if (!tbody) return;
    Object.keys(adminCreateTableState.data).forEach(key => {
        adminCreateTableState.data[key].forEach((val, idx) => {
            const input = tbody.querySelector(`input[data-row="${key}"][data-idx="${idx}"]`);
            if (input) input.value = val || '';
        });
    });
}

function updateAdminCreateFormulaPreview() {
    const numLabel = document.getElementById('adminCreateFormulaNum')?.value || 'Numerador';
    const denLabel = document.getElementById('adminCreateFormulaDen')?.value || 'Denominador';
    const special = document.getElementById('adminCreateFormulaSpecial')?.value || '';
    const mode = document.getElementById('adminCreateFormulaMode')?.value || 'fraction';
    const preview = document.getElementById('adminCreateFormulaPreview');
    if (!preview) return;

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const numSafe = escapeHtml(numLabel);
    const denSafe = escapeHtml(denLabel);
    const specialSafe = escapeHtml(special).trim();

    const hasDen = mode !== 'single';
    const stackHtml = hasDen
        ? `<div class="formula-stack"><div>${numSafe}</div><div class="formula-line"></div><div>${denSafe}</div></div>`
        : `<div class="formula-stack"><div>${numSafe}</div></div>`;

    const specialHtml = specialSafe ? `<span class="formula-special">${specialSafe}</span>` : '';

    preview.innerHTML = `<div class="formula-preview"><div class="formula-bracket">${stackHtml}</div>${specialHtml}</div>`;
}

function applyAdminFormulaMode(mode) {
    const modeInput = document.getElementById('adminCreateFormulaMode');
    const denWrapper = document.getElementById('adminCreateDenWrapper');
    const denInput = document.getElementById('adminCreateFormulaDen');
    if (modeInput) modeInput.value = mode;
    const single = mode === 'single';
    if (denWrapper) denWrapper.classList.toggle('hidden', single);
    if (single && denInput) denInput.value = '';
    updateAdminCreateFormulaPreview();
}

window.openAdminFormulaModal = function () {
    const modal = document.getElementById('formulaConfigModal');
    const specialInput = document.getElementById('adminFormulaSpecialInput');
    const hiddenSpecial = document.getElementById('adminCreateFormulaSpecial');
    const mode = document.getElementById('adminCreateFormulaMode')?.value || 'fraction';
    const radios = document.querySelectorAll('input[name="adminFormulaMode"]');
    radios.forEach(r => { r.checked = (r.value === mode); });
    if (specialInput) specialInput.value = hiddenSpecial?.value || '';
    modal?.classList.remove('hidden');
    setTimeout(() => { specialInput?.focus(); }, 0);
};

window.closeAdminFormulaModal = function () {
    document.getElementById('formulaConfigModal')?.classList.add('hidden');
};

window.saveAdminFormulaModal = function () {
    const selected = document.querySelector('input[name="adminFormulaMode"]:checked');
    const mode = selected ? selected.value : 'fraction';
    const specialInput = document.getElementById('adminFormulaSpecialInput');
    const hiddenSpecial = document.getElementById('adminCreateFormulaSpecial');
    if (hiddenSpecial) hiddenSpecial.value = (specialInput?.value || '').trim();
    applyAdminFormulaMode(mode);
    window.closeAdminFormulaModal();
};

window.handleAdminFormulaKey = function (event) {
    if (!event) return;
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.openAdminFormulaModal();
    }
};


function formatAdminNumber(value, decimals = 2) {
    if (!isFinite(value)) return '';
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(value * factor) / factor;
    const formatted = rounded.toFixed(decimals).replace(/\.0+$/, '').replace(/\.(\d*?)0+$/, '.$1');
    return formatted;
}

function parseAdminNumber(value) {
    if (value === null || value === undefined) return NaN;
    const normalized = String(value).replace(',', '.').trim();
    if (normalized === '') return NaN;
    return Number(normalized);
}

async function handleAdminCreateIndicatorChange() {
    const area = (document.getElementById('adminCreateArea')?.value || '').trim();
    const indicator = (document.getElementById('adminCreateIndicator')?.value || '').trim();
    if (!area || !indicator) return;
    const refYear = (document.getElementById('adminCreateReferenceYear')?.value || '').trim();
    await loadAdminCreateBaselineData(area, indicator, refYear || undefined);
    await loadAdminReferenceYears(area, indicator);
}

async function loadAdminCreateIndicators(area) {
    const input = document.getElementById('adminCreateIndicator');
    const listEl = document.getElementById('adminCreateIndicatorList');
    if (!input || !listEl) return;
    listEl.innerHTML = '';
    if (!area) {
        input.placeholder = 'Selecciona un area primero';
        return;
    }
    try {
        const list = await apiCall('getIndicators', { area });
        if (!Array.isArray(list) || !list.length) {
            input.placeholder = 'Escribe nuevo indicador';
            return;
        }
        input.placeholder = 'Escribe o selecciona indicador';
        list.forEach(ind => {
            const opt = document.createElement('option');
            opt.value = ind;
            listEl.appendChild(opt);
        });
    } catch (error) {
        console.error(error);
        input.placeholder = 'Escribe nuevo indicador';
    }
}


async function loadAdminCreateBaselineData(area, indicator, referenceYear) {
    try {
        const yearsPayload = await apiCall('getValidYears', { area, indicator });
        const parsedYears = Array.from(new Set(parseYearEntries(yearsPayload))).filter(Boolean).map(Number).filter(Number.isFinite);
        if (!parsedYears.length) {
            setAdminCreateCloseFichaChecked(false);
            renderAdminCreatePreview();
            return;
        }
        parsedYears.sort((a, b) => b - a);
        const baselineYear = referenceYear ? String(referenceYear) : String(parsedYears[0]);
        const yearInput = document.getElementById('adminCreateYear');
        const currentYear = (yearInput?.value || '').trim();
        const shouldSetYear = !currentYear || !/^\d{4}$/.test(currentYear);
        if (yearInput && shouldSetYear) yearInput.value = baselineYear;
        const rows = await apiCall('getIndicatorData', { area, indicator, year: baselineYear });
        if (!Array.isArray(rows) || !rows.length) {
            setAdminCreateCloseFichaChecked(false);
            renderAdminCreatePreview();
            return;
        }
        applyAdminCreateHeadFromRow(rows[0]);

        renderAdminCreatePreview();
        populateAdminCreateTableData(rows);
        if (shouldClearAdminCreateNumbers(baselineYear)) {
            clearAdminCreateNumDen(true);
        }
    } catch (error) {
        console.error(error);
        setAdminCreateCloseFichaChecked(false);
        renderAdminCreatePreview();
    }
}

function populateAdminCreateTableData(rows) {
    const periods = adminCreateTableState.periods;
    ['num', 'den', 'res', 'goal'].forEach(key => {
        adminCreateTableState.data[key] = periods.map(() => '');
    });
    rows.forEach(row => {
        const mes = normalizeAdminCreatePeriod(row.MES_TABLA || '');
        const idx = periods.findIndex(period => normalizeAdminCreatePeriod(period.key) === mes);
        if (idx === -1) return;
        adminCreateTableState.data.num[idx] = row.NUMERADOR || '';
        adminCreateTableState.data.den[idx] = row.DENOMINADOR || '';
        adminCreateTableState.data.res[idx] = row.RESULTADO || '';
        adminCreateTableState.data.goal[idx] = row.META || '';
    });
    writeAdminCreateTableInputs();
    updateAdminCreateFormulaPreview();
    recalculateAdminCreateResults();
}

function normalizeAdminCreatePeriod(value) {
    return String(value || '').trim().toUpperCase();
}

function setAdminSidebarVisible(isVisible) {
    const adminCreate = document.getElementById('nav-admin-create');
    const adminHistoric = document.getElementById('nav-admin-historic');
    const adminDashboard = document.getElementById('nav-admin-dashboard');

    [adminCreate, adminHistoric, adminDashboard].forEach(link => {
        if (!link) return;
        link.classList.toggle('hidden', !isVisible);
    });

    const userLinks = [document.getElementById('nav-ficha'), document.getElementById('nav-historico')];
    userLinks.forEach(link => {
        if (!link) return;
        link.classList.toggle('hidden', isVisible);
        if (!isVisible) link.classList.remove('hidden');
    });
}

function setAdminSidebarActive(key) {
    const map = {
        create: 'nav-admin-create',
        historic: 'nav-admin-historic',
        dashboard: 'nav-admin-dashboard'
    };
    Object.keys(map).forEach(name => {
        const link = document.getElementById(map[name]);
        if (!link) return;
        link.classList.toggle('active', name === key);
    });
}

function showAdminCreateMessage(text, tone = 'success') {
    const el = document.getElementById('adminCreateMessage');
    if (!el) return;
    clearTimeout(adminCreateMessageTimeout);
    if (!text) {
        el.textContent = '';
        el.classList.add('hidden');
        return;
    }
    el.classList.remove('hidden', 'text-emerald-600', 'text-amber-600', 'text-rose-600', 'text-slate-500');
    el.textContent = text;
    const toneClassMap = {
        success: 'text-emerald-600',
        warn: 'text-amber-600',
        error: 'text-rose-600',
        info: 'text-slate-500'
    };
    el.classList.add(toneClassMap[tone] || 'text-slate-500');
    adminCreateMessageTimeout = setTimeout(() => el.classList.add('hidden'), 2400);
}

function setAdminMessage(id, text, tone = 'info') {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden', 'text-emerald-600', 'text-amber-600', 'text-rose-600', 'text-slate-500');
    if (!text) {
        el.textContent = '';
        el.classList.add('hidden');
        return;
    }
    el.textContent = text;
    const toneClassMap = {
        success: 'text-emerald-600',
        warn: 'text-amber-600',
        error: 'text-rose-600',
        info: 'text-slate-500'
    };
    el.classList.add(toneClassMap[tone] || 'text-slate-500');
}

function buildAdminCreatePeriods(year, frequency) {
    if (frequency === 'ANUAL') {
        return [{ key: String(year), label: String(year) }];
    }
    if (frequency === 'TRIMESTRAL') {
        const yy = String(year).slice(-2);
        const labels = ['1ER', '2DO', '3ER', '4TO'];
        return labels.map(label => ({ key: `${label}${yy}`, label: `${label}${yy}` }));
    }
    const suffix = String(year).slice(-2);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
    return months.map(m => ({ key: m, label: `${m} ${suffix}` }));
}
