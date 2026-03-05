const API_URL = (window.APP_CONFIG && window.APP_CONFIG.API_URL)
    ? window.APP_CONFIG.API_URL
    : 'https://script.google.com/macros/s/AKfycbxkD5j3SVqPGtmP8mM5MepS6wpLHy_De3inQSMK_LvnIMqv5JHAGmHrrF88KAe2Oh7a3Q/exec';

const baseMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

let currentArea = "", currentUser = "";
let currentYear = "";
let currentIndicator = "";
let isHistoricMode = false;
let chartInstance = null;

let dataState = {
    num: Array(12).fill(''),
    den: Array(12).fill(''),
    res: Array(12).fill(''),
    goal: Array(12).fill('')
};
let labels = { num: "Numerador", den: "Denominador" };
let sacSelection = { period: "" };
let sacStatusState = Array(12).fill('idle');
const SAC_STATE_METADATA = {
    required: { label: 'SAC pendiente', cssClass: 'sac-state-required' },
    submitted: { label: 'SAC ingresado', cssClass: 'sac-state-submitted' },
    approved: { label: 'SAC validado', cssClass: 'sac-state-approved' },
    idle: { label: 'Sin SAC', cssClass: 'sac-state-idle' }
};

let loginDataCache = {};
let isAdminUser = false;
const ADMIN_IDENTIFIERS = ['admin', 'administrador', 'adm'];
let adminDrafts = [];
let adminEditingIndex = null;
let adminChartInstance = null;
let adminCreateMessageTimeout = null;

// --- FUNCIONES API (con cache, batch y debounce para mejorar rendimiento) ---
const API_CACHE_TTL = 5 * 60 * 1000; // 5 minutos (default)
const API_CACHE_TTL_LONG = 30 * 60 * 1000; // 30 min para datos estÃ¡ticos (login, years)
let apiCache = {};
try { apiCache = JSON.parse(localStorage.getItem('apiCache') || '{}'); } catch (e) { apiCache = {}; }
// Limpiar entradas expiradas al cargar
(function cleanExpiredCache() {
    const now = Date.now();
    let cleaned = false;
    Object.keys(apiCache).forEach(k => {
        if (apiCache[k] && apiCache[k].ts && (now - apiCache[k].ts) > API_CACHE_TTL_LONG) {
            delete apiCache[k];
            cleaned = true;
        }
    });
    if (cleaned) try { localStorage.setItem('apiCache', JSON.stringify(apiCache)); } catch (e) { }
})();

function saveCache() { try { localStorage.setItem('apiCache', JSON.stringify(apiCache)); } catch (e) { /* Si localStorage estÃ¡ lleno, limpiar cache viejo */ try { localStorage.removeItem('apiCache'); apiCache = {}; } catch (e2) { } } }

function makeCacheKey(action, params) { return action + '|' + JSON.stringify(params || {}); }

// TTL variable segÃºn tipo de acciÃ³n
function getCacheTTL(action) {
    if (action === 'getLoginData') return API_CACHE_TTL_LONG;
    if (action === 'getValidYears') return API_CACHE_TTL_LONG;
    if (action === 'getSAC') return 0; // Nunca cachear SAC (datos dinÃ¡micos)
    return API_CACHE_TTL;
}

async function runWithBusyCursor(task) {
    document.body.style.cursor = 'wait';
    try {
        return await task();
    } finally {
        document.body.style.cursor = 'default';
    }
}

async function apiCall(action, params = {}) {
    const force = params._force === true;
    const cleanParams = {};
    Object.keys(params).forEach(k => { if (k !== '_force') cleanParams[k] = params[k]; });
    const cacheKey = makeCacheKey(action, cleanParams);
    const now = Date.now();
    const ttl = getCacheTTL(action);
    if (!force && apiCache[cacheKey] && (now - apiCache[cacheKey].ts) < ttl) {
        return apiCache[cacheKey].data;
    }

    const url = new URL(API_URL);
    url.searchParams.append('action', action);
    Object.keys(cleanParams).forEach(k => url.searchParams.append(k, cleanParams[k]));
    try {
        const res = await runWithBusyCursor(() => fetch(url));
        const json = await res.json();
        apiCache[cacheKey] = { ts: Date.now(), data: json };
        saveCache();
        return json;
    } catch (e) { console.error(e); return {}; }
}

/**
 * Llamada batch: ejecuta mÃºltiples acciones en una sola peticiÃ³n HTTP.
 * requests: Array de { id, action, params }
 * Devuelve un objeto { [id]: resultado }
 */
async function apiBatchCall(requests, forceAll = false) {
    if (!requests || !requests.length) return {};

    const now = Date.now();
    const results = {};
    const pendingRequests = [];

    // Separar: lo que hay en cache vs lo que necesita ir al servidor
    requests.forEach(req => {
        const cleanParams = {};
        if (req.params) Object.keys(req.params).forEach(k => { if (k !== '_force') cleanParams[k] = req.params[k]; });
        const cacheKey = makeCacheKey(req.action, cleanParams);
        const ttl = getCacheTTL(req.action);
        if (!forceAll && apiCache[cacheKey] && (now - apiCache[cacheKey].ts) < ttl) {
            results[req.id] = apiCache[cacheKey].data;
        } else {
            pendingRequests.push({ id: req.id, action: req.action, params: cleanParams });
        }
    });

    // Si todo estaba en cache, retornar directo
    if (!pendingRequests.length) return results;

    // Enviar batch al servidor
    try {
        const url = new URL(API_URL);
        url.searchParams.append('action', 'getBatch');
        url.searchParams.append('requests', JSON.stringify(pendingRequests));
        const res = await runWithBusyCursor(() => fetch(url));
        const json = await res.json();

        if (json && json.results) {
            Object.keys(json.results).forEach(id => {
                results[id] = json.results[id];
                // Guardar cada resultado individualmente en cache
                const req = pendingRequests.find(r => r.id === id);
                if (req) {
                    const cacheKey = makeCacheKey(req.action, req.params);
                    apiCache[cacheKey] = { ts: Date.now(), data: json.results[id] };
                }
            });
            saveCache();
        }
    } catch (e) {
        console.error('Batch call failed, falling back to individual calls:', e);
        // Fallback: llamar individualmente en paralelo
        const fallbackPromises = pendingRequests.map(req =>
            apiCall(req.action, req.params || {}).then(data => ({ id: req.id, data }))
        );
        const fallbackResults = await Promise.all(fallbackPromises);
        fallbackResults.forEach(r => { results[r.id] = r.data; });
    }

    return results;
}

async function apiPost(action, payload) {
    const payloadStr = JSON.stringify(payload || {});
    let json = null;

    // --- GET con payload en URL (fiable con GAS, evita problemas de redirect POST) ---
    if (payloadStr.length < 6000) {
        try {
            const url = new URL(API_URL);
            url.searchParams.append('action', action);
            url.searchParams.append('payload', payloadStr);
            const res = await runWithBusyCursor(() => fetch(url));
            json = await res.json();
        } catch (getErr) {
            console.warn('[apiPost/GET] falló, intentando POST...', getErr);
            json = null;
        }
    }

    // --- POST clásico (fallback) ---
    if (!json || (!json.success && !json.error)) {
        try {
            const res = await runWithBusyCursor(() => fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action, payload }),
                redirect: 'follow'
            }));
            json = await res.json();
        } catch (postErr) {
            console.error('[apiPost/POST] Error:', postErr);
            json = { success: false, error: postErr.message || 'Error de red' };
        }
    }

    // Invalidar cache relevante si fue exitoso
    if (json && json.success) {
        try {
            const pIndicator = payload.indicator || payload.INDICADOR || '';
            const pYear = payload.year || payload.YEAR || '';
            const pPeriod = payload.period || payload.PERIODO || '';
            const pArea = payload.area || payload.AREA || '';
            if (pIndicator || pArea) {
                const keysToDelete = [];
                Object.keys(apiCache).forEach(k => {
                    if (k.startsWith('getIndicatorData') || k.startsWith('getSAC') ||
                        k.startsWith('getIndicators') || k.startsWith('getValidYears')) {
                        if ((pIndicator && k.includes(pIndicator)) ||
                            (pYear && k.includes(String(pYear))) ||
                            (pPeriod && k.includes(pPeriod)) ||
                            (pArea && k.includes(pArea))) {
                            keysToDelete.push(k);
                        }
                    }
                });
                keysToDelete.forEach(k => delete apiCache[k]);
            }
            saveCache();
        } catch (e) { }
    }

    return json || { success: false, error: 'No se obtuvo respuesta' };
}

// Debounce helper
function debounce(fn, wait) { let t; return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); }; }

const YEAR_FIELD_CANDIDATES = ['year', 'anio', 'aÃ±o', 'ANO', 'AÃ‘O', 'value', 'valor', 'VALUE'];

function getYearFromEntry(entry) {
    if (entry === null || entry === undefined) return null;
    if (typeof entry === 'string' || typeof entry === 'number') {
        return String(entry).trim();
    }
    if (typeof entry !== 'object') return null;
    for (const candidate of YEAR_FIELD_CANDIDATES) {
        if (candidate in entry) {
            const value = entry[candidate];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                return String(value).trim();
            }
        }
    }
    if ('years' in entry && Array.isArray(entry.years)) {
        return getYearFromEntry(entry.years[0]);
    }
    return null;
}

function parseYearEntries(payload) {
    if (!payload) return [];
    const entries = Array.isArray(payload) ? payload : (payload.years && Array.isArray(payload.years) ? payload.years : []);
    return entries.map(entry => getYearFromEntry(entry)).filter(Boolean);
}

function setYearSelectOptions(selectEl, yearLabels, emptyMessage = "Sin aÃ±os completos") {
    if (!yearLabels || yearLabels.length === 0) {
        selectEl.innerHTML = `<option>${emptyMessage}</option>`;
        return;
    }
    selectEl.innerHTML = `<option value="">-- SELECCIONAR AÃ‘O --</option>`;
    yearLabels.forEach(year => {
        selectEl.innerHTML += `<option value="${year}">${year}</option>`;
    });
}

// --- INICIALIZACIÃ“N ---
window.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('periodYear').value = "";

    // Pre-cargar datos de login desde cache local mientras se consulta la API
    let loginData = null;
    const cachedLoginKey = makeCacheKey('getLoginData', {});
    if (apiCache[cachedLoginKey]) {
        loginData = apiCache[cachedLoginKey].data;
        populateLoginUI(loginData);
    }

    // Cargar datos Login desde la API (actualiza si hay nuevo dato)
    const freshLoginData = await apiCall('getLoginData');
    if (freshLoginData && Object.keys(freshLoginData).length > 0) {
        loginData = freshLoginData;
        loginDataCache = freshLoginData;
        // Solo re-poblar si cambio algo o si es la primera vez
        if (!apiCache[cachedLoginKey] || JSON.stringify(freshLoginData) !== JSON.stringify(apiCache[cachedLoginKey].data)) {
            populateLoginUI(loginData);
        }
    }
    loginDataCache = loginData || {};

    refreshAdminAreaOptions();

    document.getElementById('loginSubmit').addEventListener('click', () => {
        currentArea = document.getElementById('loginArea').value;
        currentUser = document.getElementById('loginUser').value;
        if (!currentArea || !currentUser) return;

        localStorage.setItem('currentArea', currentArea);
        localStorage.setItem('currentUser', currentUser);

        document.getElementById('headerUpdatedBy').value = currentUser;
        document.getElementById('loginModal').classList.add('hidden');

        if (typeof loadIndicatorsList === 'function') loadIndicatorsList();
        renderTableStructure();
        initEmptyChart();
        setFichaEditableState();
        evaluateAdminPrivileges();
    });

    // Actualizar tabla/grÃ¡fico cuando cambie la unidad de resultado
    document.getElementById('resultUnit').addEventListener('change', () => { renderTable(); updateChart(); });
    // Listener cambio aÃ±o (solo en ficha tÃ©cnica)
    document.getElementById('periodYear').addEventListener('change', debounce((e) => {
        if (!isHistoricMode) {
            currentYear = e.target.value;
            renderTableStructure();
            if (currentIndicator) loadData(currentIndicator, currentYear);
        }
    }, 250));

    // Listener cambio aÃ±o histÃ³rico (Select)
    document.getElementById('periodYearSelect').addEventListener('change', debounce((e) => {
        if (isHistoricMode) {
            currentYear = e.target.value;
            renderTableStructure();
            // After choosing year, enable indicator select and load list
            const indSel = document.getElementById('indicatorName');
            indSel.disabled = false;
            loadIndicatorsList(currentYear);
            if (currentIndicator) loadData(currentIndicator, currentYear);
        }
    }, 250));

    document.querySelectorAll('[data-admin-module]').forEach(btn => {
        btn.addEventListener('click', () => setActiveAdminModule(btn.dataset.adminModule));
    });

    const adminHistoricArea = document.getElementById('adminHistoricArea');
    adminHistoricArea?.addEventListener('change', () => {
        const areaValue = adminHistoricArea.value;
        loadAdminHistoricYears(areaValue);
        const indicatorInput = document.getElementById('adminHistoricIndicator');
        if (indicatorInput) {
            indicatorInput.innerHTML = "<option value=''>Selecciona un aÃ±o primero</option>";
            indicatorInput.disabled = true;
        }
    });

    const adminHistoricYear = document.getElementById('adminHistoricYear');
    adminHistoricYear?.addEventListener('change', () => {
        const areaValue = adminHistoricArea?.value || "";
        const yearValue = adminHistoricYear.value;
        if (areaValue && yearValue) loadAdminHistoricIndicators(areaValue, yearValue);
    });

    const adminDashboardArea = document.getElementById('adminDashboardArea');
    adminDashboardArea?.addEventListener('change', () => {
        const areaValue = adminDashboardArea.value;
        loadAdminDashboardIndicators(areaValue);
        updateAdminDashboardYearInputs(areaValue, null);
    });

    const adminDashboardIndicator = document.getElementById('adminDashboardIndicator');
    adminDashboardIndicator?.addEventListener('change', () => {
        const areaValue = adminDashboardArea?.value || "";
        const indicatorValue = adminDashboardIndicator.value;
        if (areaValue && indicatorValue) updateAdminDashboardYearInputs(areaValue, indicatorValue);
    });

    setActiveAdminModule('create');
});

/**
 * Llena la UI de login con los datos (usado tanto para cache como para datos frescos).
 */
function populateLoginUI(loginData) {
    if (!loginData) return;
    const areaSel = document.getElementById('loginArea');
    areaSel.innerHTML = '';
    Object.keys(loginData).forEach(a => areaSel.innerHTML += `<option value="${a}">${a}</option>`);

    // Remover listeners previos clonando el elemento
    const newAreaSel = areaSel.cloneNode(true);
    areaSel.parentNode.replaceChild(newAreaSel, areaSel);

    newAreaSel.addEventListener('change', () => {
        const uSel = document.getElementById('loginUser');
        uSel.innerHTML = "";
        (loginData[newAreaSel.value] || []).forEach(u => uSel.innerHTML += `<option value="${u}">${u}</option>`);
    });

    // CHECK SESSION
    const savedArea = localStorage.getItem('currentArea');
    const savedUser = localStorage.getItem('currentUser');
    if (savedArea && savedUser && loginData[savedArea]) {
        newAreaSel.value = savedArea;
        newAreaSel.dispatchEvent(new Event('change')); // Populates users
        setTimeout(() => {
            const uSel = document.getElementById('loginUser');
            uSel.value = savedUser;
            // Auto-login
            document.getElementById('loginSubmit').click();
        }, 10);
    } else {
        if (newAreaSel.options.length > 0) newAreaSel.dispatchEvent(new Event('change'));
    }
}

function resetUI(keepIndicator = false) {
    if (!keepIndicator) {
        document.getElementById('indicatorName').value = "";
        currentIndicator = "";
    }
    ['headerResponsable', 'indicatorObjective', 'currentGoal', 'prevGoal', 'comments', 'sourceInfo', 'updateDate'].forEach(id => {
        const el = document.getElementById(id);
        el.value = "";
        el.classList.remove('text-red-500', 'font-bold');
    });
    document.getElementById('formulaDisplay').innerHTML = "";
    dataState = { num: Array(12).fill(''), den: Array(12).fill(''), res: Array(12).fill(''), goal: Array(12).fill('') };
    sacStatusState = Array(12).fill('idle');
    renderTable();
    initEmptyChart();
}

function toggleInputs(disable) {
    const inputs = document.querySelectorAll('.section-container input, .section-container textarea, .section-container select');
    inputs.forEach(el => {
        if (el.id !== 'indicatorName') {
            el.disabled = disable;
            if (disable) el.classList.add('bg-slate-50', 'text-slate-500');
            else el.classList.remove('bg-slate-50', 'text-slate-500');
        }
    });
}

function setFichaEditableState() {
    if (isHistoricMode) {
        toggleInputs(true);
        return;
    }
    // Default: block everything, then enable only required fields
    toggleInputs(true);
    const yearInput = document.getElementById('periodYear');
    if (yearInput) {
        yearInput.disabled = false;
        yearInput.classList.remove('bg-slate-50', 'text-slate-500');
    }
    const indicatorSelect = document.getElementById('indicatorName');
    if (indicatorSelect) {
        indicatorSelect.disabled = false;
        indicatorSelect.classList.remove('bg-slate-50', 'text-slate-500');
    }
}

function parseNumericValue(value) {
    if (value === null || value === undefined) return NaN;
    const normalized = String(value).replace(',', '.').replace(/%/g, '').trim();
    if (normalized === '') return NaN;
    return Number(normalized);
}

function scaleForUnit(value, unit) {
    const num = parseNumericValue(value);
    if (!isFinite(num)) return null;
    if (unit === '%') return num * 100;
    return num;
}

function formatNumber(value, decimals = 2) {
    if (!isFinite(value)) return null;
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(value * factor) / factor;
    const fixed = rounded.toFixed(decimals);
    return fixed.replace(/\.?0+$/, '');
}

function formatDisplayValue(rawValue, decimals, appendPercent = false, unit = '') {
    const scaled = scaleForUnit(rawValue, unit);
    if (scaled === null) return null;
    const formatted = formatNumber(scaled, decimals);
    if (formatted === null) return null;
    return appendPercent ? `${formatted}%` : formatted;
}

function computeWeightedAverage(unit) {
    let totalWeight = 0;
    let weightedSum = 0;
    for (let i = 0; i < baseMonths.length; i++) {
        const resVal = scaleForUnit(dataState.res[i], unit);
        const weight = parseNumericValue(dataState.den[i]);
        const weightVal = isFinite(weight) && weight !== 0 ? weight : 1;
        if (!isFinite(resVal)) continue;
        totalWeight += weightVal;
        weightedSum += resVal * weightVal;
    }
    if (totalWeight === 0) return null;
    return weightedSum / totalWeight;
}

function needsSAC(resultValue, goalValue) {
    const resultNum = parseNumericValue(resultValue);
    const goalNum = parseNumericValue(goalValue);
    if (!isFinite(resultNum) || !isFinite(goalNum)) return false;
    const tolerance = 0.01;
    return Math.abs(resultNum - goalNum) > tolerance;
}

function mapIncomingSACStatus(rawStatus) {
    if (!rawStatus && rawStatus !== 0) return null;
    const normalized = String(rawStatus).toLowerCase();
    if (normalized.includes('aprob') || normalized.includes('valid')) return 'approved';
    if (normalized.includes('pend') || normalized.includes('ingres') || normalized.includes('enviado') || normalized.includes('espera') || normalized.includes('revis')) return 'submitted';
    return null;
}

function refreshSACStates() {
    const needs = baseMonths.map((_, idx) => needsSAC(dataState.res[idx], dataState.goal[idx]));
    sacStatusState = sacStatusState.map((state, idx) => {
        if (!needs[idx]) return 'idle';
        if (state === 'approved') return 'approved';
        if (state === 'submitted') return 'submitted';
        return 'required';
    });
    return needs;
}

function setSACState(idx, status) {
    if (typeof idx !== 'number' || idx < 0 || idx >= baseMonths.length) return;
    if (!status || !(status in SAC_STATE_METADATA)) return;
    sacStatusState[idx] = status;
    renderTable();
}

function renderTableStructure() {
    const suffix = currentYear ? ` ${String(currentYear).slice(-2)}` : '';
    const currentMonths = baseMonths.map(m => `${m}${suffix}`);
    const thead = document.getElementById('tableHeaderRow');
    while (thead.children.length > 1) thead.removeChild(thead.lastChild);
    currentMonths.forEach(m => {
        const th = document.createElement('th');
        th.className = "p-2 border-r border-slate-600 text-center min-w-[80px]";
        th.textContent = m;
        thead.appendChild(th);
    });
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('horizontalTableBody');
    tbody.innerHTML = '';
    const unitEl = document.getElementById('resultUnit');
    const unit = unitEl ? (unitEl.value || '') : '';
    const isPercentUnit = unit === '%';
    const resLabel = `Resultado (${unit})`;
    const needsSacFlags = refreshSACStates();
    const actionStates = sacStatusState.slice();

    const rows = [
        { key: 'num', label: labels.num },
        { key: 'den', label: labels.den },
        { key: 'res', label: resLabel, isResult: true, formatDecimals: 2, appendPercent: isPercentUnit, showStar: true },
        { key: 'goal', label: 'Meta', formatDecimals: 2, appendPercent: isPercentUnit },
        { key: 'action', label: 'AcciÃ³n', isAction: true }
    ];

    rows.forEach(def => {
        const tr = document.createElement('tr');
        if (def.showStar) {
            tr.innerHTML = `
                <th class="p-3 text-left bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-700 sticky left-0 shadow-sm">
                    <span class="inline-flex items-center gap-2">
                        ${def.label}
                        <button type="button" onclick="openWeightedModal()" title="Promedio ponderado" class="text-amber-500 hover:text-amber-600">
                            <i class="fa-solid fa-star"></i>
                        </button>
                    </span>
                </th>`;
        } else {
            tr.innerHTML = `<th class="p-3 text-left bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-700 sticky left-0 shadow-sm">${def.label}</th>`;
        }
        const values = def.isAction ? actionStates : dataState[def.key];
        values.forEach((val, idx) => {
            if (def.isAction) {
                const status = actionStates[idx] || 'idle';
                const meta = SAC_STATE_METADATA[status] || SAC_STATE_METADATA.idle;
                const actionHtml = `<button type="button" class="sac-icon-button" onclick="openSAC(${idx})" title="${meta.label}" aria-label="${meta.label}"><i class="fa-solid fa-book sac-icon ${meta.cssClass}"></i></button>`;
                tr.innerHTML += `<td class="border-r border-slate-200 p-0 h-10 min-w-[80px]"><div class="flex items-center justify-center h-full">${actionHtml}</div></td>`;
                return;
            }

            const isRes = def.isResult;
            const clickAttr = isRes ? `onclick="openSAC(${idx})"` : '';
            let readonly = "readonly";
            let isEditable = false;
            if (!isHistoricMode && (def.key === 'num' || def.key === 'den')) {
                isEditable = true;
                readonly = "";
            }
            const dangerClass = isRes && needsSacFlags[idx] ? 'sac-needed-input' : '';
            const classes = `w-full h-full text-center text-xs ${isEditable ? 'bg-white' : 'bg-transparent'} focus:outline-none ${isRes ? 'font-bold text-blue-700 cursor-pointer hover:bg-blue-50' : ''} ${dangerClass}`;

            let displayVal = (val === null || val === undefined) ? '' : String(val).trim();
            if (def.formatDecimals) {
                const formatted = formatDisplayValue(val, def.formatDecimals, def.appendPercent, unit);
                if (formatted !== null) displayVal = formatted;
            }

            tr.innerHTML += `<td class="border-r border-slate-200 p-0 h-10 min-w-[80px]"><input class="${classes.trim()}" value="${displayVal || ''}" ${readonly} ${clickAttr}></td>`;
        });
        tbody.appendChild(tr);
    });
}

function initEmptyChart() {
    const ctx = document.getElementById('indicatorChart');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: baseMonths, datasets: [] },
        options: { maintainAspectRatio: false, responsive: true, scales: { y: { beginAtZero: true } }, plugins: { title: { display: true, text: 'Sin Datos' } } }
    });
}

let __chartUpdateTimer = null;
function updateChart() {
    clearTimeout(__chartUpdateTimer);
    __chartUpdateTimer = setTimeout(() => {
        const ctx = document.getElementById('indicatorChart');
        if (chartInstance) chartInstance.destroy();

        // Register plugin if not already registered (though UMD usually handles this, specific inclusion is safer for options)
        // Note: With UMD ChartDataLabels is usually global. We'll pass it in plugins array if needed or configure options.

        const unitEl = document.getElementById('resultUnit');
        const unit = unitEl ? (unitEl.value || '') : '';

        const suffix = currentYear ? ` ${String(currentYear).slice(-2)}` : '';
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: baseMonths.map(m => `${m}${suffix}`),
                datasets: [
                    {
                        type: 'line',
                        label: 'Meta',
                        data: dataState.goal.map(v => scaleForUnit(v, unit) === null ? null : scaleForUnit(v, unit)),
                        borderColor: '#fbbf24', // Amber for goal 
                        borderWidth: 3,
                        pointRadius: 0, // Hide points for cleaner look
                        borderDash: [5, 5],
                        order: 0,
                        datalabels: {
                            align: 'right',
                            anchor: 'start',
                            backgroundColor: '#fff',
                            borderRadius: 4,
                            color: '#d97706',
                            font: { weight: 'bold', size: 10 },
                            offset: 4,
                            display: function (context) {
                                return context.dataIndex === context.dataset.data.length - 1;
                            }
                        }
                    },
                    {
                        type: 'bar',
                        label: 'Resultado',
                        data: dataState.res.map(v => scaleForUnit(v, unit) === null ? null : scaleForUnit(v, unit)),
                        backgroundColor: '#0c4a6e', // Dark blue for result
                        borderRadius: 4,
                        order: 1,
                        datalabels: {
                            color: '#334155',
                            anchor: 'end',
                            align: 'top',
                            offset: 0,
                            font: { weight: 'bold', size: 11 },
                            formatter: function (value) {
                                return value === null ? '' : (unit === '%' ? Math.round(value) + '%' : value);
                            }
                        }
                    }
                ]
            },
            plugins: [ChartDataLabels], // Enable the plugin
            options: (function () {
                const unitEl = document.getElementById('resultUnit');
                const unit = unitEl ? (unitEl.value || '') : '';
                const yOpts = {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { size: 11 } }
                };
                if (unit === '%') yOpts.suggestedMax = 105; // Little space on top

                return {
                    maintainAspectRatio: false,
                    responsive: true,
                    scales: {
                        y: yOpts,
                        x: { grid: { display: false } }
                    },
                    plugins: {
                        legend: { labels: { usePointStyle: true, boxWidth: 6 } },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            padding: 10,
                            bodyFont: { size: 13 }
                        },
                        datalabels: {
                            // Global defaults
                            display: true
                        }
                    }
                };
            })()
        });
    }, 60);
}

window.logout = function () {
    localStorage.removeItem('currentArea');
    localStorage.removeItem('currentUser');
    location.reload();
};

window.openWeightedModal = function () {
    const unitEl = document.getElementById('resultUnit');
    const unit = unitEl ? (unitEl.value || '') : '';
    const avg = computeWeightedAverage(unit);
    const display = formatNumber(avg, 2);
    const valueEl = document.getElementById('weightedValue');
    if (valueEl) valueEl.textContent = display === null ? '-' : (unit === '%' ? `${display}%` : display);
    const modal = document.getElementById('weightedModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeWeightedModal = function () {
    const modal = document.getElementById('weightedModal');
    if (modal) modal.classList.add('hidden');
};

const ADMIN_MODULE_MAP = {
    create: 'adminModuleCreate',
    historic: 'adminModuleHistoric',
    dashboard: 'adminModuleDashboard'
};

function refreshAdminAreaOptions() {
    const selectors = ['adminCreateArea', 'adminHistoricArea', 'adminDashboardArea'];
    const areas = Object.keys(loginDataCache || {}).sort((a, b) => a.localeCompare(b));
    const hasAreas = areas.length > 0;
    const optionsHtml = areas.map(area => `<option value="${area}">${area}</option>`).join('');
    selectors.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (hasAreas) {
            el.innerHTML = `<option value="">-- Seleccione Ã¡rea --</option>${optionsHtml}`;
        } else {
            el.innerHTML = `<option value="">No hay Ã¡reas disponibles</option>`;
        }
    });
    const bulk = document.getElementById('adminBulkAreas');
    if (bulk) {
        bulk.innerHTML = hasAreas ? optionsHtml : '';
    }
}

function evaluateAdminPrivileges() {
    const adminSection = document.getElementById('adminSection');
    const userSection = document.getElementById('userSection');
    const normalize = (value) => String(value || '').toLowerCase();
    const matches = ADMIN_IDENTIFIERS.some(key => normalize(currentUser).includes(key) || normalize(currentArea).includes(key));
    isAdminUser = matches;
    if (isAdminUser) {
        userSection?.classList.add('hidden');
        adminSection?.classList.remove('hidden');
        refreshAdminAreaOptions();
        setDefaultAdminSelections();
        loadAdminHistoricYears(currentArea);
        loadAdminDashboardIndicators(currentArea);
        updateAdminDashboardYearInputs(currentArea, null);
        setActiveAdminModule('create');
    } else {
        userSection?.classList.remove('hidden');
        adminSection?.classList.add('hidden');
    }
}

function setDefaultAdminSelections() {
    if (!currentArea) return;
    ['adminCreateArea', 'adminHistoricArea', 'adminDashboardArea'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = currentArea;
    });
}

function setActiveAdminModule(key) {
    Object.keys(ADMIN_MODULE_MAP).forEach(name => {
        const section = document.getElementById(ADMIN_MODULE_MAP[name]);
        const button = document.querySelector(`[data-admin-module="${name}"]`);
        const active = name === key;
        if (section) section.classList.toggle('hidden', !active);
        if (button) {
            button.classList.toggle('bg-slate-900', active);
            button.classList.toggle('text-white', active);
            button.classList.toggle('bg-white', !active);
            button.classList.toggle('text-slate-600', !active);
        }
    });
}

function handleAdminFichaSave() {
    const area = (document.getElementById('adminCreateArea')?.value || "").trim();
    const year = (document.getElementById('adminCreateYear')?.value || "").trim();
    const indicator = (document.getElementById('adminCreateIndicator')?.value || "").trim();
    const frequency = (document.getElementById('adminCreateFrequency')?.value || "").trim();
    const objective = (document.getElementById('adminCreateObjective')?.value || "").trim();
    const meta = (document.getElementById('adminCreateMeta')?.value || "").trim();
    const comments = (document.getElementById('adminCreateComments')?.value || "").trim();

    if (!area || !year || !indicator) {
        showAdminCreateMessage('Completa Ã¡rea, aÃ±o e indicador antes de guardar.', 'warn');
        return;
    }

    const payload = { area, year, indicator, frequency, objective, meta, comments };
    if (adminEditingIndex !== null) {
        adminDrafts[adminEditingIndex] = { ...payload, updatedAt: new Date().toISOString() };
        showAdminCreateMessage('Ficha actualizada en los borradores.', 'success');
        adminEditingIndex = null;
    } else {
        adminDrafts.unshift({ ...payload, createdAt: new Date().toISOString() });
        showAdminCreateMessage('Ficha agregada a los borradores.', 'success');
    }
    renderAdminDrafts();
    resetAdminCreateForm();
}

function handleAdminMassCreate() {
    const year = (document.getElementById('adminCreateYear')?.value || "").trim();
    const indicator = (document.getElementById('adminCreateIndicator')?.value || "").trim();
    const frequency = (document.getElementById('adminCreateFrequency')?.value || "").trim();
    const objective = (document.getElementById('adminCreateObjective')?.value || "").trim();
    const meta = (document.getElementById('adminCreateMeta')?.value || "").trim();
    const comments = (document.getElementById('adminCreateComments')?.value || "").trim();
    const bulkSelect = document.getElementById('adminBulkAreas');
    const selectedAreas = Array.from(bulkSelect?.selectedOptions || []).map(opt => opt.value).filter(Boolean);

    if (!selectedAreas.length) {
        showAdminCreateMessage('Selecciona al menos un Ã¡rea para la creaciÃ³n masiva.', 'warn');
        return;
    }

    if (!year || !indicator) {
        showAdminCreateMessage('Define indicador y aÃ±o antes de crear fichas masivas.', 'warn');
        return;
    }

    selectedAreas.forEach(area => {
        adminDrafts.unshift({
            area,
            year,
            indicator,
            frequency,
            objective,
            meta,
            comments,
            bulk: true,
            createdAt: new Date().toISOString()
        });
    });

    showAdminCreateMessage(`Se agregaron ${selectedAreas.length} fichas en borrador.`, 'success');
    renderAdminDrafts();
    resetAdminCreateForm();
    if (bulkSelect) bulkSelect.selectedIndex = -1;
}

function resetAdminCreateForm() {
    ['adminCreateYear', 'adminCreateIndicator', 'adminCreateObjective', 'adminCreateMeta', 'adminCreateComments'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    adminEditingIndex = null;
    const btn = document.getElementById('adminCreateSaveButton');
    if (btn) btn.textContent = 'Guardar ficha';
}

function renderAdminDrafts() {
    const tbody = document.getElementById('adminDraftTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!adminDrafts.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-3 text-center text-xs text-slate-400">No hay fichas guardadas.</td></tr>`;
        return;
    }
    adminDrafts.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="py-2 px-3">${entry.area || '-'}</td>
            <td class="py-2 px-3">${entry.indicator || '-'}</td>
            <td class="py-2 px-3 text-center">${entry.year || '-'}</td>
            <td class="py-2 px-3">${entry.meta || '-'}</td>
            <td class="py-2 px-3 text-center space-x-1">
                <button type="button" class="text-blue-600 text-xs font-semibold" onclick="editAdminDraft(${index})">Editar</button>
                <button type="button" class="text-rose-500 text-xs font-semibold" onclick="deleteAdminDraft(${index})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function editAdminDraft(index) {
    const entry = adminDrafts[index];
    if (!entry) return;
    adminEditingIndex = index;
    const areaEl = document.getElementById('adminCreateArea');
    if (areaEl) areaEl.value = entry.area || areaEl.value || '';
    const yearEl = document.getElementById('adminCreateYear');
    if (yearEl) yearEl.value = entry.year || '';
    const indicatorEl = document.getElementById('adminCreateIndicator');
    if (indicatorEl) indicatorEl.value = entry.indicator || '';
    const freqEl = document.getElementById('adminCreateFrequency');
    if (freqEl) freqEl.value = entry.frequency || 'MENSUAL';
    const objectiveEl = document.getElementById('adminCreateObjective');
    if (objectiveEl) objectiveEl.value = entry.objective || '';
    const metaEl = document.getElementById('adminCreateMeta');
    if (metaEl) metaEl.value = entry.meta || '';
    const commentsEl = document.getElementById('adminCreateComments');
    if (commentsEl) commentsEl.value = entry.comments || '';
    const btn = document.getElementById('adminCreateSaveButton');
    if (btn) btn.textContent = 'Actualizar ficha';
    document.getElementById('adminModuleCreate')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteAdminDraft(index) {
    if (adminEditingIndex === index) resetAdminCreateForm();
    adminDrafts.splice(index, 1);
    renderAdminDrafts();
}

function clearAdminDrafts() {
    adminDrafts = [];
    adminEditingIndex = null;
    renderAdminDrafts();
    showAdminCreateMessage('Borradores eliminados.', 'info');
}

function showAdminCreateMessage(text, tone = 'success') {
    const el = document.getElementById('adminCreateMessage');
    if (!el) return;
    clearTimeout(adminCreateMessageTimeout);
    if (!text) {
        el.textContent = "";
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
        el.textContent = "";
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

async function loadAdminHistoricYears(area) {
    const yearSelect = document.getElementById('adminHistoricYear');
    if (!yearSelect) return;
    yearSelect.innerHTML = `<option value="">Cargando...</option>`;
    if (!area) {
        yearSelect.innerHTML = `<option value="">Selecciona un Ã¡rea</option>`;
        return;
    }
    try {
        const years = await apiCall('getValidYears', { area });
        const parsed = Array.from(new Set(parseYearEntries(years)));
        if (!parsed.length) {
            yearSelect.innerHTML = `<option value="">Sin aÃ±os completos</option>`;
            return;
        }
        parsed.sort((a, b) => b - a);
        yearSelect.innerHTML = `<option value="">-- Seleccione aÃ±o --</option>`;
        parsed.forEach(year => yearSelect.innerHTML += `<option value="${year}">${year}</option>`);
    } catch (error) {
        console.error(error);
        yearSelect.innerHTML = `<option value="">Error al cargar aÃ±os</option>`;
    }
}

async function loadAdminHistoricIndicators(area, year) {
    const indicatorSelect = document.getElementById('adminHistoricIndicator');
    if (!indicatorSelect) return;
    indicatorSelect.disabled = true;
    indicatorSelect.innerHTML = `<option value="">Cargando...</option>`;
    if (!area || !year) {
        indicatorSelect.innerHTML = `<option value="">Selecciona Ã¡rea y aÃ±o</option>`;
        return;
    }
    try {
        const list = await apiCall('getIndicators', { area, year });
        if (!list || list.length === 0) {
            indicatorSelect.innerHTML = `<option value="">Sin indicadores</option>`;
            return;
        }
        indicatorSelect.innerHTML = `<option value="">-- Seleccionar indicador --</option>`;
        list.forEach(ind => indicatorSelect.innerHTML += `<option value="${ind}">${ind}</option>`);
        indicatorSelect.disabled = false;
    } catch (error) {
        console.error(error);
        indicatorSelect.innerHTML = `<option value="">Error al cargar indicadores</option>`;
    }
}

async function handleAdminHistoricQuery() {
    const area = (document.getElementById('adminHistoricArea')?.value || "").trim();
    const year = (document.getElementById('adminHistoricYear')?.value || "").trim();
    const indicator = (document.getElementById('adminHistoricIndicator')?.value || "").trim();
    if (!area || !year || !indicator) {
        setAdminMessage('adminHistoricMessage', 'Selecciona Ã¡rea, aÃ±o e indicador.', 'warn');
        return;
    }
    setAdminMessage('adminHistoricMessage', '', 'info');
    try {
        const rows = await apiCall('getIndicatorData', { area, indicator, year });
        if (!rows || !rows.length) {
            renderAdminHistoricTable([], area, indicator, year);
            setAdminMessage('adminHistoricMessage', 'No existen registros para el criterio seleccionado.', 'warn');
            return;
        }
        renderAdminHistoricTable(rows, area, indicator, year);
        setAdminMessage('adminHistoricMessage', `HistÃ³rico cargado para ${indicator} (${year}).`, 'success');
    } catch (error) {
        console.error(error);
        setAdminMessage('adminHistoricMessage', 'OcurriÃ³ un error al consultar el histÃ³rico.', 'error');
    }
}

function renderAdminHistoricTable(rows, area, indicator, year) {
    const tbody = document.getElementById('adminHistoricTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!rows || !rows.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-3 text-center text-xs text-slate-400">Sin datos.</td></tr>`;
        const summaryEl = document.getElementById('adminHistoricSummary');
        if (summaryEl) summaryEl.textContent = '';
        return;
    }
    const ordered = [...rows].sort((a, b) => {
        const idx = (row) => baseMonths.findIndex(m => m.toLowerCase() === String(row.MES_TABLA || '').toLowerCase());
        return idx(a) - idx(b);
    });
    let totalResult = 0;
    let totalGoal = 0;
    let resultCount = 0;
    let goalCount = 0;
    ordered.forEach(row => {
        const unit = (row.UNIDAD_MEDIDA || '').toString();
        const formattedResult = formatDisplayValue(row.RESULTADO, 2, unit === '%', unit) || String(row.RESULTADO || '-');
        const formattedGoal = formatDisplayValue(row.META, 2, unit === '%', unit) || String(row.META || '-');
        const numerador = row.NUMERADOR || '-';
        const denominador = row.DENOMINADOR || '-';
        const month = row.MES_TABLA || '-';
        const resNum = parseNumericValue(row.RESULTADO);
        if (isFinite(resNum)) {
            totalResult += resNum;
            resultCount++;
        }
        const goalNum = parseNumericValue(row.META);
        if (isFinite(goalNum)) {
            totalGoal += goalNum;
            goalCount++;
        }
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-2 px-3">${month}</td>
            <td class="py-2 px-3 text-right">${numerador}</td>
            <td class="py-2 px-3 text-right">${denominador}</td>
            <td class="py-2 px-3 text-right">${formattedResult}</td>
            <td class="py-2 px-3 text-right">${formattedGoal}</td>
        `;
        tbody.appendChild(tr);
    });
    const averageResult = resultCount ? formatDisplayValue(totalResult / resultCount, 2, false, '') : '-';
    const averageGoal = goalCount ? formatDisplayValue(totalGoal / goalCount, 2, false, '') : '-';
    const summaryEl = document.getElementById('adminHistoricSummary');
    if (summaryEl) {
        summaryEl.textContent = `Meses descargados: ${ordered.length}. Promedio resultado: ${averageResult} Â· Meta promedio: ${averageGoal}.`;
    }
}

async function loadAdminDashboardIndicators(area) {
    const select = document.getElementById('adminDashboardIndicator');
    if (!select) return;
    select.innerHTML = `<option value="">Cargando...</option>`;
    if (!area) {
        select.innerHTML = `<option value="">Selecciona un Ã¡rea</option>`;
        return;
    }
    try {
        const list = await apiCall('getIndicators', { area });
        if (!list || !list.length) {
            select.innerHTML = `<option value="">Sin indicadores disponibles</option>`;
            return;
        }
        select.innerHTML = `<option value="">-- Seleccionar indicador --</option>`;
        list.forEach(ind => select.innerHTML += `<option value="${ind}">${ind}</option>`);
    } catch (error) {
        console.error(error);
        select.innerHTML = `<option value="">Error al cargar indicadores</option>`;
    }
}

async function updateAdminDashboardYearInputs(area, indicator) {
    const start = document.getElementById('adminDashboardStartYear');
    const end = document.getElementById('adminDashboardEndYear');
    if (!start || !end) return;
    if (!area) {
        start.value = "";
        end.value = "";
        return;
    }
    try {
        const parsed = parseYearEntries(await apiCall('getValidYears', { area, indicator }));
        const numericYears = Array.from(new Set(parsed.map(y => Number(y)).filter(Number.isFinite))).sort((a, b) => a - b);
        if (!numericYears.length) {
            start.value = "";
            end.value = "";
            return;
        }
        start.value = numericYears[0];
        end.value = numericYears[numericYears.length - 1];
    } catch (error) {
        console.error(error);
        start.value = "";
        end.value = "";
    }
}

async function handleAdminDashboardQuery() {
    const area = (document.getElementById('adminDashboardArea')?.value || "").trim();
    const indicator = (document.getElementById('adminDashboardIndicator')?.value || "").trim();
    const startYear = Number(document.getElementById('adminDashboardStartYear')?.value);
    const endYear = Number(document.getElementById('adminDashboardEndYear')?.value);
    if (!area || !indicator || !startYear || !endYear) {
        setAdminMessage('adminDashboardMessage', 'Ingresa Ã¡rea, indicador y rango vÃ¡lido.', 'warn');
        return;
    }
    if (startYear > endYear) {
        setAdminMessage('adminDashboardMessage', 'El aÃ±o inicio debe ser menor o igual al aÃ±o fin.', 'warn');
        return;
    }
    setAdminMessage('adminDashboardMessage', '', 'info');

    // Usar batch para cargar todos los aÃ±os en una sola llamada
    const batchRequests = [];
    for (let year = startYear; year <= endYear; year++) {
        batchRequests.push({
            id: 'year_' + year,
            action: 'getIndicatorData',
            params: { area, indicator, year: String(year) }
        });
    }

    const summaries = [];
    try {
        const batchResults = await apiBatchCall(batchRequests);
        for (let year = startYear; year <= endYear; year++) {
            const rows = batchResults['year_' + year];
            summaries.push(buildDashboardSummary(year, rows));
        }
    } catch (error) {
        console.error(error);
        // Fallback: cargar en paralelo con Promise.all
        const promises = [];
        for (let year = startYear; year <= endYear; year++) {
            promises.push(
                apiCall('getIndicatorData', { area, indicator, year: String(year) })
                    .then(rows => buildDashboardSummary(year, rows))
                    .catch(() => ({ year, avgResult: null, avgGoal: null, months: 0 }))
            );
        }
        summaries.push(...await Promise.all(promises));
    }

    renderAdminDashboardSummary(summaries);
    setAdminMessage('adminDashboardMessage', `Comportamiento ${indicator} Â· ${area} (${startYear}-${endYear})`, 'success');
}

function buildDashboardSummary(year, rows) {
    const dataRows = Array.isArray(rows) ? rows : [];
    const resultValues = dataRows.map(r => parseNumericValue(r.RESULTADO)).filter(Number.isFinite);
    const goalValues = dataRows.map(r => parseNumericValue(r.META)).filter(Number.isFinite);
    const avgResult = resultValues.length ? resultValues.reduce((acc, val) => acc + val, 0) / resultValues.length : null;
    const avgGoal = goalValues.length ? goalValues.reduce((acc, val) => acc + val, 0) / goalValues.length : null;
    return { year, avgResult, avgGoal, months: dataRows.length };
}

function renderAdminDashboardSummary(summaries) {
    const tbody = document.getElementById('adminDashboardSummaryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const statsEl = document.getElementById('adminDashboardStats');
    if (!summaries.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-3 text-center text-xs text-slate-400">No hay datos.</td></tr>`;
        if (statsEl) statsEl.innerHTML = `<p class="text-slate-500 text-xs">Sin informaciÃ³n disponible.</p>`;
        if (adminChartInstance) {
            adminChartInstance.destroy();
            adminChartInstance = null;
        }
        return;
    }
    const sorted = [...summaries].sort((a, b) => a.year - b.year);
    sorted.forEach(summary => {
        const resultDisplay = formatDisplayValue(summary.avgResult, 2, false, '') || '-';
        const goalDisplay = formatDisplayValue(summary.avgGoal, 2, false, '') || '-';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="py-2 px-3">${summary.year}</td>
            <td class="py-2 px-3 text-right">${resultDisplay}</td>
            <td class="py-2 px-3 text-right">${goalDisplay}</td>
            <td class="py-2 px-3 text-center">${summary.months}</td>
        `;
        tbody.appendChild(row);
    });
    if (statsEl) {
        const validResults = sorted.filter(s => typeof s.avgResult === 'number');
        const validGoals = sorted.filter(s => typeof s.avgGoal === 'number');
        const overallResult = validResults.length ? formatDisplayValue(validResults.reduce((acc, item) => acc + item.avgResult, 0) / validResults.length, 2, false, '') : '-';
        const overallGoal = validGoals.length ? formatDisplayValue(validGoals.reduce((acc, item) => acc + item.avgGoal, 0) / validGoals.length, 2, false, '') : '-';
        statsEl.innerHTML = `
            <p>Promedio general resultado: <span class="font-semibold">${overallResult}</span></p>
            <p>Promedio general meta: <span class="font-semibold">${overallGoal}</span></p>
            <p>Total de perÃ­odos consultados: <span class="font-semibold">${sorted.length}</span></p>
        `;
    }
    renderAdminDashboardChart(sorted);
}

function renderAdminDashboardChart(summaries) {
    const ctx = document.getElementById('adminDashboardChart');
    if (!ctx) return;
    if (!summaries.length) {
        if (adminChartInstance) {
            adminChartInstance.destroy();
            adminChartInstance = null;
        }
        return;
    }
    if (adminChartInstance) adminChartInstance.destroy();
    const labels = summaries.map(s => String(s.year));
    const resultData = summaries.map(s => (typeof s.avgResult === 'number' ? s.avgResult : null));
    const goalData = summaries.map(s => (typeof s.avgGoal === 'number' ? s.avgGoal : null));
    adminChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Resultado promedio',
                    data: resultData,
                    borderColor: '#0c4a6e',
                    backgroundColor: 'rgba(12,74,110,0.15)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4
                },
                {
                    label: 'Meta promedio',
                    data: goalData,
                    borderColor: '#f97316',
                    backgroundColor: 'transparent',
                    borderDash: [6, 4],
                    tension: 0.3,
                    pointRadius: 4
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { font: { size: 11 } }
                },
                x: {
                    ticks: { font: { size: 11 } }
                }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    padding: 8,
                    titleFont: { size: 12 },
                    bodyFont: { size: 12 }
                }
            }
        }
    });
}


