let adminChartInstance = null;

window.addEventListener('DOMContentLoaded', () => {
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

    const startSelect = document.getElementById('adminDashboardStartYear');
    const endSelect = document.getElementById('adminDashboardEndYear');
    startSelect?.addEventListener('change', () => syncAdminDashboardYearRange());
    endSelect?.addEventListener('change', () => syncAdminDashboardYearRange());
});

async function loadAdminDashboardIndicators(area) {
    const select = document.getElementById('adminDashboardIndicator');
    if (!select) return;
    select.innerHTML = `<option value="">Cargando...</option>`;
    if (!area) {
        select.innerHTML = `<option value="">Selecciona un área</option>`;
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
        start.innerHTML = `<option value="">Seleccione área</option>`;
        end.innerHTML = `<option value="">Seleccione área</option>`;
        return;
    }
    try {
        const parsed = parseYearEntries(await apiCall('getValidYears', { area, indicator }));
        const numericYears = Array.from(new Set(parsed.map(y => Number(y)).filter(Number.isFinite))).sort((a, b) => a - b);
        if (!numericYears.length) {
            start.innerHTML = `<option value="">Sin años disponibles</option>`;
            end.innerHTML = `<option value="">Sin años disponibles</option>`;
            return;
        }
        const optionsHtml = numericYears.map(y => `<option value="${y}">${y}</option>`).join('');
        start.innerHTML = `<option value="">-- Seleccionar año --</option>${optionsHtml}`;
        end.innerHTML = `<option value="">-- Seleccionar año --</option>${optionsHtml}`;
        start.value = String(numericYears[0]);
        end.value = String(numericYears[numericYears.length - 1]);
    } catch (error) {
        console.error(error);
        start.innerHTML = `<option value="">Error al cargar años</option>`;
        end.innerHTML = `<option value="">Error al cargar años</option>`;
    }
}

async function handleAdminDashboardQuery() {
    const area = (document.getElementById('adminDashboardArea')?.value || "").trim();
    const indicator = (document.getElementById('adminDashboardIndicator')?.value || "").trim();
    const startYear = Number(document.getElementById('adminDashboardStartYear')?.value);
    const endYear = Number(document.getElementById('adminDashboardEndYear')?.value);
    if (!area || !indicator || !startYear || !endYear) {
        setAdminMessage('adminDashboardMessage', 'Ingresa área, indicador y rango válido.', 'warn');
        return;
    }
    if (startYear > endYear) {
        setAdminMessage('adminDashboardMessage', 'El año inicio debe ser menor o igual al año fin.', 'warn');
        return;
    }
    setAdminMessage('adminDashboardMessage', '', 'info');
    const summaries = [];
    const yearEntries = [];
    let resolvedFrequency = '';
    let resolvedUnit = '';

    // Usar batch para cargar todos los años en una sola llamada HTTP
    const batchRequests = [];
    for (let year = startYear; year <= endYear; year++) {
        batchRequests.push({
            id: 'year_' + year,
            action: 'getIndicatorData',
            params: { area, indicator, year: String(year) }
        });
    }

    try {
        const batchResults = await apiBatchCall(batchRequests);
        for (let year = startYear; year <= endYear; year++) {
            const rows = batchResults['year_' + year];
            const safeRows = Array.isArray(rows) ? rows : [];
            summaries.push(buildDashboardSummary(year, safeRows));
            yearEntries.push({ year, rows: safeRows });
            if (!resolvedFrequency && safeRows.length) {
                resolvedFrequency = String(safeRows[0].FRECUENCIA || '').trim().toUpperCase();
            }
            if (!resolvedUnit && safeRows.length) {
                resolvedUnit = String(safeRows[0].UNIDAD_MEDIDA || safeRows[0].UNIDAD || '').trim();
            }
        }
    } catch (error) {
        console.error('Batch failed, loading individually:', error);
        for (let year = startYear; year <= endYear; year++) {
            try {
                const rows = await apiCall('getIndicatorData', { area, indicator, year });
                const safeRows = Array.isArray(rows) ? rows : [];
                summaries.push(buildDashboardSummary(year, safeRows));
                yearEntries.push({ year, rows: safeRows });
                if (!resolvedFrequency && safeRows.length) {
                    resolvedFrequency = String(safeRows[0].FRECUENCIA || '').trim().toUpperCase();
                }
                if (!resolvedUnit && safeRows.length) {
                    resolvedUnit = String(safeRows[0].UNIDAD_MEDIDA || safeRows[0].UNIDAD || '').trim();
                }
            } catch (err) {
                console.error(err);
                summaries.push({ year, avgResult: null, avgGoal: null, months: 0 });
                yearEntries.push({ year, rows: [] });
            }
        }
    }
    renderAdminDashboardSummary(summaries, resolvedUnit);
    const frequency = resolvedFrequency || 'MENSUAL';
    const hasData = yearEntries.some(entry => entry.rows && entry.rows.length);
    const timeline = hasData ? buildAdminDashboardTimeline(yearEntries, frequency) : { labels: [], results: [], goals: [] };
    renderAdminDashboardChart(timeline, resolvedUnit);
    setAdminMessage('adminDashboardMessage', `Comportamiento ${indicator} · ${area} (${startYear}-${endYear})`, 'success');
}

function syncAdminDashboardYearRange() {
    const start = document.getElementById('adminDashboardStartYear');
    const end = document.getElementById('adminDashboardEndYear');
    if (!start || !end) return;
    const startYear = Number(start.value);
    const endYear = Number(end.value);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return;
    if (startYear > endYear) {
        end.value = String(startYear);
    }
}

function buildDashboardSummary(year, rows) {
    const dataRows = Array.isArray(rows) ? rows : [];
    const resultValues = dataRows.map(r => parseNumericValue(r.RESULTADO)).filter(Number.isFinite);
    const goalValues = dataRows.map(r => parseNumericValue(r.META)).filter(Number.isFinite);
    const avgResult = resultValues.length ? resultValues.reduce((acc, val) => acc + val, 0) / resultValues.length : null;
    const avgGoal = goalValues.length ? goalValues.reduce((acc, val) => acc + val, 0) / goalValues.length : null;
    return { year, avgResult, avgGoal, months: dataRows.length };
}

function buildAdminDashboardTimeline(yearEntries, frequency) {
    const freq = (frequency || 'MENSUAL').toUpperCase();
    const labels = [];
    const results = [];
    const goals = [];
    const entries = Array.isArray(yearEntries) ? yearEntries : [];

    entries.forEach(entry => {
        const year = entry.year;
        const rows = Array.isArray(entry.rows) ? entry.rows : [];
        const periods = getAdminDashboardPeriodsForYear(year, freq);
        periods.forEach(period => {
            const row = findAdminDashboardRow(rows, freq, period.key);
            labels.push(period.label);
            results.push(row ? row.RESULTADO : null);
            goals.push(row ? row.META : null);
        });
    });

    return { labels, results, goals, frequency: freq };
}

function getAdminDashboardPeriodsForYear(year, frequency) {
    const freq = (frequency || 'MENSUAL').toUpperCase();
    const yy = String(year).slice(-2);
    if (freq === 'TRIMESTRAL') {
        const quarters = ['1ER', '2DO', '3ER', '4TO'];
        return quarters.map(q => ({ key: q, label: `${q}${yy}` }));
    }
    if (freq === 'ANUAL') {
        return [{ key: String(year), label: String(year) }];
    }
    const months = (typeof baseMonths !== 'undefined' ? baseMonths : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic']);
    return months.map(m => ({ key: String(m).trim().toUpperCase().slice(0, 3), label: `${m} ${yy}` }));
}

function findAdminDashboardRow(rows, frequency, periodKey) {
    const dataRows = Array.isArray(rows) ? rows : [];
    const key = normalizeAdminDashboardPeriod(periodKey);
    const freq = (frequency || 'MENSUAL').toUpperCase();
    for (const row of dataRows) {
        const raw = normalizeAdminDashboardPeriod(row.MES_TABLA);
        if (!raw) continue;
        if (freq === 'MENSUAL' || freq === 'TRIMESTRAL') {
            if (raw.startsWith(key)) return row;
            continue;
        }
        if (raw === key || raw.startsWith(key)) return row;
    }
    return null;
}

function normalizeAdminDashboardPeriod(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function renderAdminDashboardSummary(summaries, unit = '') {
    const tbody = document.getElementById('adminDashboardSummaryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const statsEl = document.getElementById('adminDashboardStats');
    if (!summaries.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-3 text-center text-xs text-slate-400">No hay datos.</td></tr>`;
        if (statsEl) statsEl.innerHTML = `<p class="text-slate-500 text-xs">Sin información disponible.</p>`;
        return;
    }
    const isPercentUnit = unit === '%';
    const sorted = [...summaries].sort((a, b) => a.year - b.year);
    sorted.forEach(summary => {
        const resultDisplay = formatDisplayValue(summary.avgResult, 2, isPercentUnit, unit) || '-';
        const goalDisplay = formatDisplayValue(summary.avgGoal, 2, isPercentUnit, unit) || '-';
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
        const overallResult = validResults.length ? formatDisplayValue(validResults.reduce((acc, item) => acc + item.avgResult, 0) / validResults.length, 2, isPercentUnit, unit) : '-';
        const overallGoal = validGoals.length ? formatDisplayValue(validGoals.reduce((acc, item) => acc + item.avgGoal, 0) / validGoals.length, 2, isPercentUnit, unit) : '-';
        statsEl.innerHTML = `
            <p>Promedio general resultado: <span class="font-semibold">${overallResult}</span></p>
            <p>Promedio general meta: <span class="font-semibold">${overallGoal}</span></p>
            <p>Total de períodos consultados: <span class="font-semibold">${sorted.length}</span></p>
        `;
    }
}

function renderAdminDashboardChart(timeline, unit = '') {
    const ctx = document.getElementById('adminDashboardChart');
    if (!ctx) return;
    if (adminChartInstance) adminChartInstance.destroy();
    const labels = (timeline && timeline.labels) ? timeline.labels : [];
    if (!labels.length) {
        adminChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: { maintainAspectRatio: false, responsive: true, plugins: { title: { display: true, text: 'Sin Datos' } } }
        });
        return;
    }
    const resultData = (timeline.results || []).map(val => {
        const scaled = scaleForUnit(val, unit);
        return scaled === null ? null : scaled;
    });
    const goalData = (timeline.goals || []).map(val => {
        const scaled = scaleForUnit(val, unit);
        return scaled === null ? null : scaled;
    });
    const isPercentUnit = unit === '%';
    const plugins = (typeof ChartDataLabels !== 'undefined') ? [ChartDataLabels] : [];
    const yOpts = {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { font: { size: 11 } }
    };
    if (isPercentUnit) yOpts.suggestedMax = 105;

    adminChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Meta',
                    data: goalData,
                    borderColor: '#fbbf24',
                    borderWidth: 3,
                    pointRadius: 0,
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
                    data: resultData,
                    backgroundColor: '#0c4a6e',
                    borderRadius: 4,
                    order: 1,
                    datalabels: {
                        color: '#0f172a',
                        anchor: 'center',
                        align: 'center',
                        backgroundColor: '#ffffff',
                        borderRadius: 6,
                        padding: { top: 2, bottom: 2, left: 6, right: 6 },
                        font: { weight: 'bold', size: 11 },
                        formatter: function (value) {
                            if (value === null || value === undefined || value === '') return '';
                            return isPercentUnit ? Math.round(value) + '%' : value;
                        }
                    }
                }
            ]
        },
        plugins,
        options: {
            maintainAspectRatio: false,
            responsive: true,
            scales: {
                y: yOpts,
                x: { grid: { display: false }, ticks: { font: { size: 11 } } }
            },
            plugins: {
                legend: { labels: { usePointStyle: true, boxWidth: 6 } },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    padding: 8,
                    titleFont: { size: 12 },
                    bodyFont: { size: 12 }
                },
                datalabels: { display: true }
            }
        }
    });
}
