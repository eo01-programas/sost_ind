async function loadIndicatorsList(year) {
    const sel = document.getElementById('indicatorName');
    if (!sel) return;
    const yearValue = String(year || "").trim();
    if (!isHistoricMode && !yearValue) {
        sel.innerHTML = '<option value="">-- Seleccione a\u00f1o primero --</option>';
        sel.disabled = true;
        return;
    }
    const params = { area: currentArea };
    if (yearValue) params.year = yearValue;

    let list = [];
    if (isHistoricMode) {
        params.complete = 1;
        const result = await apiCall('getIndicators', params);
        list = Array.isArray(result) ? result : [];
    } else {
        const norm = (value) => String(value || "").trim().toLowerCase();
        const [allList, completeList] = await Promise.all([
            apiCall('getIndicators', params),
            apiCall('getIndicators', { ...params, complete: 1 })
        ]);
        const allArr = Array.isArray(allList) ? allList : [];
        const completeArr = Array.isArray(completeList) ? completeList : [];
        const completeSet = new Set(completeArr.map(norm));
        list = allArr.filter(ind => !completeSet.has(norm(ind)));
    }

    if (!Array.isArray(list) || !list.length) {
        const emptyLabel = isHistoricMode ? 'Sin indicadores completos' : 'Sin indicadores con meses incompletos';
        sel.innerHTML = `<option value="">${emptyLabel}</option>`;
        sel.disabled = true;
        return;
    }
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
    sel.disabled = false;
}
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
        const validYears = await apiCall('getValidYears', { area: currentArea, indicator: indicator, complete: 1 });
        const yearSelect = document.getElementById('periodYearSelect');
        const parsedYears = parseYearEntries(validYears);

        if (parsedYears.length > 0) {
            setYearSelectOptions(yearSelect, parsedYears, "Sin a\u00f1os disponibles");
            currentYear = parsedYears[0];
            yearSelect.value = currentYear;

            renderTableStructure();
            loadData(indicator, currentYear);
        } else {
            yearSelect.innerHTML = "<option>Sin a\u00f1os disponibles</option>";
            resetUI(true);
            document.getElementById('indicatorObjective').value = "No existen registros completos para este indicador.";
        }
    } else {
        // Modo Ficha: requiere a\u00f1o seleccionado
        const yearValue = String(currentYear || "").trim();
        if (!yearValue) {
            resetUI(true);
            return;
        }
        renderTableStructure();
        loadData(indicator, yearValue);
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
        document.getElementById('prevGoal').value = formatDisplayValue(head.META_ANTERIOR || '', 2, unit === '%', unit) || '-';
        document.getElementById('comments').value = head.COMENTARIOS || '';
        document.getElementById('frequency').value = (head.FRECUENCIA || 'MENSUAL').toUpperCase();
        document.getElementById('resultUnit').value = unit;
        document.getElementById('sourceInfo').value = head.FUENTE_INFORMACION || '';
        if (head.FECHA_ACTUALIZACION) document.getElementById('updateDate').value = head.FECHA_ACTUALIZACION;

        const formulaNum = head.FORMULA_NUMERADOR || head['FORMULA NUMERADOR'] || head.FORMULA_NUM || head['FORMULA NUM'] || '';
        const formulaDen = head.FORMULA_DENOMINADOR || head['FORMULA DENOMINADOR'] || head.FORMULA_DEN || head['FORMULA DEN'] || '';
        labels.num = formulaNum || "Numerador";
        labels.den = formulaDen || "Denominador";

        const fDisp = document.getElementById('formulaDisplay');
        if (fDisp) {
            const escapeHtml = (value) => String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            const numLabel = escapeHtml(formulaNum || labels.num || 'Numerador');
            const denLabel = escapeHtml(formulaDen || '');
            const specialRaw = (head.CARACTER_ESPECIAL || head['CARACTER ESPECIAL'] || '').toString().trim();
            const calcText = String(head.FORMULA_CALCULO || '').trim();
            const extractSpecial = (value) => {
                if (!value) return '';
                const match = String(value).match(/([xX*]\s*[\d.,]+\s*%?)/i);
                return match ? match[1].replace(/\s+/g, ' ').trim() : '';
            };
            const specialLabel = specialRaw || extractSpecial(calcText);
            const specialSafe = escapeHtml(specialLabel);

            const stackHtml = denLabel
                ? `<div class="formula-stack"><div>${numLabel}</div><div class="formula-line"></div><div>${denLabel}</div></div>`
                : `<div class="formula-stack"><div>${numLabel}</div></div>`;
            const specialHtml = specialSafe ? `<span class="formula-special">${specialSafe}</span>` : '';

            fDisp.innerHTML = `<div class="formula-preview"><div class="formula-bracket">${stackHtml}</div>${specialHtml}</div>`;
        }
        const calcEl = document.getElementById('formulaCalcDisplay');
        if (calcEl) {
            const calcText = String(head.FORMULA_CALCULO || '').trim();
            if (calcText) {
                calcEl.textContent = `Cálculo: ${calcText}`;
                calcEl.classList.remove('hidden');
            } else {
                calcEl.textContent = '';
                calcEl.classList.add('hidden');
            }
        }

        rows.forEach(r => {
            const mes = r.MES_TABLA || '';
            const idx = baseMonths.findIndex(m => mes.startsWith(m));
            if (idx !== -1) {
                dataState.num[idx] = r.NUMERADOR;
                dataState.den[idx] = r.DENOMINADOR;
                const rawResult = r.RESULTADO;
                const hasStoredResult = rawResult !== null && rawResult !== undefined && String(rawResult).trim() !== '';
                if (hasStoredResult) {
                    dataState.res[idx] = rawResult;
                } else {
                    const num = (typeof parseNumericValue === 'function')
                        ? parseNumericValue(r.NUMERADOR)
                        : Number(String(r.NUMERADOR || '').replace(',', '.').trim());
                    const den = (typeof parseNumericValue === 'function')
                        ? parseNumericValue(r.DENOMINADOR)
                        : Number(String(r.DENOMINADOR || '').replace(',', '.').trim());
                    dataState.res[idx] = (Number.isFinite(num) && Number.isFinite(den) && den !== 0) ? (num / den) : '';
                }
                dataState.goal[idx] = r.META;
            }
        });
        toggleInputs(true);
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

    // --- Verificar estado SAC en segundo plano para meses que lo requieren ---
    if (rows && rows.length > 0) {
        const sacRequests = [];
        for (let idx = 0; idx < baseMonths.length; idx++) {
            if (needsSAC(dataState.res[idx], dataState.goal[idx])) {
                const period = baseMonths[idx] + (currentYear ? ` ${String(currentYear).slice(-2)}` : '');
                sacRequests.push({
                    id: `sac_${idx}`,
                    idx,
                    params: { area: currentArea, indicator: indicator, period: period, _force: true }
                });
            }
        }
        if (sacRequests.length > 0) {
            if (typeof apiBatchCall === 'function') {
                const batchPayload = sacRequests.map(req => ({ id: req.id, action: 'getSAC', params: req.params }));
                apiBatchCall(batchPayload, true)
                    .then(results => {
                        sacRequests.forEach(req => {
                            const sacData = results ? results[req.id] : null;
                            if (sacData && sacData.SAC_ID) {
                                const mapped = mapIncomingSACStatus(sacData.ESTADO);
                                sacStatusState[req.idx] = mapped || 'submitted';
                            }
                        });
                        renderTable();
                    })
                    .catch(() => { });
            } else {
                const sacChecks = sacRequests.map(req =>
                    apiCall('getSAC', req.params)
                        .then(sacData => {
                            if (sacData && sacData.SAC_ID) {
                                const mapped = mapIncomingSACStatus(sacData.ESTADO);
                                sacStatusState[req.idx] = mapped || 'submitted';
                            }
                        })
                        .catch(() => { })
                );
                Promise.all(sacChecks).then(() => {
                    renderTable();
                });
            }
        }
    }
}
