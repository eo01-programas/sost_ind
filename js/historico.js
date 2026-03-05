window.switchView = async function(view) {
    const navF = document.getElementById('nav-ficha');
    const navH = document.getElementById('nav-historico');
    const pInput = document.getElementById('periodYear');
    const pSelect = document.getElementById('periodYearSelect');
    const title = document.getElementById('pageTitle');
    const header = document.getElementById('mainHeader');

    isHistoricMode = (view === 'historico');

    if(isHistoricMode) {
        navF.classList.remove('active'); navH.classList.add('active');
        pInput.classList.add('hidden'); pSelect.classList.remove('hidden');
        title.textContent = "Histórico de Indicadores";
        header.classList.replace('bg-slate-50', 'bg-amber-50');

        document.getElementById('indicatorName').value = "";
        // Disable indicator select until a year is chosen
        document.getElementById('indicatorName').disabled = true;
        // Populate years from backend using criterion: years with all months complete
        pSelect.innerHTML = "<option value=''>Cargando...</option>";
        if(currentArea) {
            try {
                const years = await apiCall('getValidYears', { area: currentArea });
                const parsedYears = parseYearEntries(years);
                if(parsedYears.length > 0) {
                    setYearSelectOptions(pSelect, parsedYears);
                } else {
                    pSelect.innerHTML = "<option>Sin años completos</option>";
                }
            } catch(e) { pSelect.innerHTML = "<option>Sin años completos</option>"; }
        } else {
            pSelect.innerHTML = "<option>Seleccione Área e ingrese sesión</option>";
        }
        resetUI();
        setFichaEditableState();

    } else {
        navF.classList.add('active'); navH.classList.remove('active');
        pInput.classList.remove('hidden'); pSelect.classList.add('hidden');
        title.textContent = "Ficha Técnica de Indicadores";
        header.classList.replace('bg-amber-50', 'bg-slate-50');

        currentYear = "";
        pInput.value = "";
        resetUI();
        setFichaEditableState();
        document.getElementById('indicatorName').disabled = false;
    }
    renderTableStructure();
};
