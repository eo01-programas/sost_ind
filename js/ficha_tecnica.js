async function loadIndicatorsList(year) {
    const params = { area: currentArea };
    if (year) params.year = year;
    const list = await apiCall('getIndicators', params);
    const sel = document.getElementById('indicatorName');
    sel.innerHTML = '<option value="">-- SELECCIONAR --</option>';
    const prevVal = currentIndicator;
    (list || []).forEach(i => sel.innerHTML += `<option value="${i}">${i}</option>`);

    // Auto-select if only one indicator
    if (list && list.length === 1) {
        sel.value = list[0];
        onIndicatorChange(list[0]);
    }
    // Or preserve if possible and no specific single item forced
    else if (prevVal && list.includes(prevVal)) {
        sel.value = prevVal;
        // No need to trigger change if we just want to keep it, but dashboard might have already loaded it. 
        // We ensure UI matches.
    }
}

// LÓGICA DE SELECCIÓN DE INDICADOR Y AÑOS HISTÓRICOS
window.onIndicatorChange = async function (indicator) {
    if (!indicator) { resetUI(); return; }
    currentIndicator = indicator;

    if (isHistoricMode) {
        // If user already selected year first, use that year and load data.
        if (currentYear) {
            renderTableStructure();
            loadData(indicator, currentYear);
            return;
        }
        // Fallback: ask backend for valid years for this indicator
        const validYears = await apiCall('getValidYears', { area: currentArea, indicator: indicator });
        const yearSelect = document.getElementById('periodYearSelect');
        const parsedYears = parseYearEntries(validYears);

        if (parsedYears.length > 0) {
            setYearSelectOptions(yearSelect, parsedYears);
            currentYear = parsedYears[0];
            yearSelect.value = currentYear;

            renderTableStructure();
            loadData(indicator, currentYear);
        } else {
            yearSelect.innerHTML = "<option>Sin años completos</option>";
            resetUI(true);
            document.getElementById('indicatorObjective').value = "No existen registros completos (12 meses sin vacíos) para este indicador.";
        }
    } else {
        // Modo Ficha: Si no se ha escrito año, limpiar
        if (!currentYear) {
            resetUI(true);
        } else {
            // Si ya se escribió año, intentar cargar lo que haya
            loadData(indicator, currentYear);
        }
    }
}

async function loadData(indicator, year) {
    dataState = { num: Array(12).fill(''), den: Array(12).fill(''), res: Array(12).fill(''), goal: Array(12).fill('') };
    const rows = await apiCall('getIndicatorData', { area: currentArea, indicator: indicator, year: year });

    if (rows && rows.length > 0) {
        const head = rows[0];
        document.getElementById('headerResponsable').value = head.USUARIO_RESPONSABLE || '';
        document.getElementById('indicatorObjective').value = head.OBETIVO_INDICADOR || '';
        const unit = (head.UNIDAD_MEDIDA || '%');
        document.getElementById('currentGoal').value = formatDisplayValue(head.META || '', 2, unit === '%', unit) || '';
        document.getElementById('prevGoal').value = head.META_ANTERIOR || '-';
        document.getElementById('comments').value = head.COMENTARIOS || '';
        document.getElementById('frequency').value = (head.FRECUENCIA || 'MENSUAL').toUpperCase();
        document.getElementById('resultUnit').value = unit;
        document.getElementById('sourceInfo').value = head.FUENTE_INFORMACION || '';
        if (head.FECHA_ACTUALIZACION) document.getElementById('updateDate').value = head.FECHA_ACTUALIZACION;

        labels.num = head.FORMULA_NUMERADOR || "Numerador";
        labels.den = head.FORMULA_DENOMINADOR || "Denominador";

        const fDisp = document.getElementById('formulaDisplay');
        if (head.FORMULA_CALCULO) fDisp.innerHTML = head.FORMULA_CALCULO;
        else fDisp.innerHTML = `<div class="fraction-content"><span class="fraction-num">${labels.num}</span><span class="fraction-den">${labels.den}</span></div>`;

        rows.forEach(r => {
            const mes = r.MES_TABLA || '';
            const idx = baseMonths.findIndex(m => mes.startsWith(m));
            if (idx !== -1) {
                dataState.num[idx] = r.NUMERADOR;
                dataState.den[idx] = r.DENOMINADOR;
                dataState.res[idx] = r.RESULTADO;
                dataState.goal[idx] = r.META;
            }
        });
        toggleInputs(isHistoricMode);
        document.getElementById('indicatorObjective').classList.remove('text-red-500', 'font-bold');

    } else {
        resetUI(true);
        if (isHistoricMode) {
            document.getElementById('indicatorObjective').value = `No se encontraron registros para el año ${currentYear}.`;
            document.getElementById('indicatorObjective').classList.add('text-red-500', 'font-bold');
        }
    }
    renderTable();
    updateChart();
    if (typeof setFichaEditableState === 'function') setFichaEditableState();
}
