window.switchView = async function(view) {
    const navF = document.getElementById('nav-ficha');
    const navH = document.getElementById('nav-historico');
    const pInput = document.getElementById('periodYear');
    const pSelect = document.getElementById('periodYearSelect');
    const title = document.getElementById('pageTitle');
    const header = document.getElementById('mainHeader');
    const amberClasses = ['bg-amber-50', 'text-amber-900', 'border-amber-300'];

    isHistoricMode = (view === 'historico');
    const useSelectInFicha = (typeof shouldUseYearSelectForFicha === 'function') ? shouldUseYearSelectForFicha() : false;

    if (pSelect) {
        if (isHistoricMode) amberClasses.forEach(c => pSelect.classList.add(c));
        else amberClasses.forEach(c => pSelect.classList.remove(c));
    }

    if(isHistoricMode) {
        navF.classList.remove('active'); navH.classList.add('active');
        pInput.classList.add('hidden'); pSelect.classList.remove('hidden');
        title.textContent = "Hist\u00f3rico de Indicadores";
        header.classList.replace('bg-slate-50', 'bg-amber-50');

        document.getElementById('indicatorName').value = "";
        // Disable indicator select until a year is chosen
        document.getElementById('indicatorName').disabled = true;
        // Populate years from backend using criterion: years with all months complete
        pSelect.innerHTML = "<option value=''>Cargando...</option>";
        if(currentArea) {
            try {
                const years = await apiCall('getValidYears', { area: currentArea, complete: 1 });
                const parsedYears = parseYearEntries(years);
                if(parsedYears.length > 0) {
                    setYearSelectOptions(pSelect, parsedYears, "Sin a\u00f1os completos");
                } else {
                    pSelect.innerHTML = "<option>Sin a\u00f1os completos</option>";
                }
            } catch(e) { pSelect.innerHTML = "<option>Sin a\u00f1os completos</option>"; }
        } else {
            pSelect.innerHTML = "<option>Seleccione \u00c1rea e ingrese sesi\u00f3n</option>";
        }
        resetUI();
        setFichaEditableState();

    } else {
        navF.classList.add('active'); navH.classList.remove('active');
        if (useSelectInFicha) {
            pInput.classList.add('hidden');
            pSelect.classList.remove('hidden');
        } else {
            pInput.classList.remove('hidden');
            pSelect.classList.add('hidden');
        }
        title.textContent = "Ficha T\u00e9cnica de Indicadores";
        header.classList.replace('bg-amber-50', 'bg-slate-50');

        currentYear = "";
        currentIndicator = "";
        if (pInput) pInput.value = "";
        if (pSelect) pSelect.value = "";
        document.getElementById('indicatorName').value = "";

        if (useSelectInFicha) {
            // Mismo flujo que hist\u00f3rico: primero a\u00f1o, luego indicador
            document.getElementById('indicatorName').disabled = true;
            if (typeof loadPeriodYearsForFicha === 'function') loadPeriodYearsForFicha();
        } else {
            // Admin u otro: flujo original con input de a\u00f1o
            const indSel = document.getElementById('indicatorName');
        if (indSel) indSel.disabled = !String(currentYear || '').trim();
            if (typeof loadPeriodYearsForFicha === 'function') loadPeriodYearsForFicha();
        }
        resetUI();
        setFichaEditableState();
    }
    renderTableStructure();
};
