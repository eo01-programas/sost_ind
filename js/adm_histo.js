const HISTORIC_DEFAULT_MESSAGES = {
    selectYearFirst: 'Selecciona un ano primero',
    selectArea: 'Selecciona un area',
    loading: 'Cargando...',
    noCompleteYears: 'Sin anos completos',
    yearPrompt: '-- Seleccione ano --',
    selectAreaYear: 'Selecciona area y ano',
    noIndicators: 'Sin indicadores',
    indicatorPrompt: '-- Seleccionar indicador --'
};

window.addEventListener('DOMContentLoaded', () => {
    const areaSelect = document.getElementById('adminHistoricArea');
    const yearSelect = document.getElementById('adminHistoricYear');
    const indicatorSelect = document.getElementById('adminHistoricIndicator');

    areaSelect?.addEventListener('change', () => {
        const area = (areaSelect.value || '').trim();
        loadAdminHistoricYears(area);
        if (indicatorSelect) {
            indicatorSelect.innerHTML = `<option value="">${HISTORIC_DEFAULT_MESSAGES.selectYearFirst}</option>`;
            indicatorSelect.disabled = true;
        }
    });

    yearSelect?.addEventListener('change', () => {
        const area = (areaSelect?.value || '').trim();
        const year = (yearSelect.value || '').trim();
        if (area && year) loadAdminHistoricIndicators(area, year);
    });
});

async function loadAdminHistoricYears(area) {
    const yearSelect = document.getElementById('adminHistoricYear');
    if (!yearSelect) return;

    yearSelect.innerHTML = `<option value="">${HISTORIC_DEFAULT_MESSAGES.loading}</option>`;
    if (!area) {
        yearSelect.innerHTML = `<option value="">${HISTORIC_DEFAULT_MESSAGES.selectArea}</option>`;
        return;
    }

    try {
        const years = await apiCall('getValidYears', { area, complete: 1 });
        const parsedYears = Array.from(new Set(parseYearEntries(years)));

        if (!parsedYears.length) {
            yearSelect.innerHTML = `<option value="">${HISTORIC_DEFAULT_MESSAGES.noCompleteYears}</option>`;
            return;
        }

        parsedYears.sort((a, b) => Number(b) - Number(a));
        yearSelect.innerHTML = `<option value="">${HISTORIC_DEFAULT_MESSAGES.yearPrompt}</option>`;
        parsedYears.forEach(year => {
            yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
        });
    } catch (error) {
        console.error('loadAdminHistoricYears:', error);
        yearSelect.innerHTML = '<option value="">Error al cargar anos</option>';
    }
}

async function loadAdminHistoricIndicators(area, year) {
    const indicatorSelect = document.getElementById('adminHistoricIndicator');
    if (!indicatorSelect) return;

    indicatorSelect.disabled = true;
    indicatorSelect.innerHTML = `<option value="">${HISTORIC_DEFAULT_MESSAGES.loading}</option>`;
    if (!area || !year) {
        indicatorSelect.innerHTML = `<option value="">${HISTORIC_DEFAULT_MESSAGES.selectAreaYear}</option>`;
        return;
    }

    try {
        const list = await apiCall('getIndicators', { area, year, complete: 1 });
        if (!Array.isArray(list) || !list.length) {
            indicatorSelect.innerHTML = `<option value="">${HISTORIC_DEFAULT_MESSAGES.noIndicators}</option>`;
            return;
        }

        indicatorSelect.innerHTML = `<option value="">${HISTORIC_DEFAULT_MESSAGES.indicatorPrompt}</option>`;
        list.forEach(indicator => {
            indicatorSelect.innerHTML += `<option value="${indicator}">${indicator}</option>`;
        });
        indicatorSelect.disabled = false;
    } catch (error) {
        console.error('loadAdminHistoricIndicators:', error);
        indicatorSelect.innerHTML = '<option value="">Error al cargar indicadores</option>';
    }
}

async function handleAdminHistoricQuery() {
    const area = (document.getElementById('adminHistoricArea')?.value || '').trim();
    const year = (document.getElementById('adminHistoricYear')?.value || '').trim();
    const indicator = (document.getElementById('adminHistoricIndicator')?.value || '').trim();

    if (!area || !year || !indicator) {
        setAdminMessage('adminHistoricMessage', 'Selecciona area, ano e indicador.', 'warn');
        return;
    }

    setAdminMessage('adminHistoricMessage', '', 'info');

    try {
        if (typeof loadAdminHistoricFullFicha !== 'function') {
            setAdminMessage('adminHistoricMessage', 'No se pudo abrir la ficha completa en este momento.', 'error');
            return;
        }

        const result = await loadAdminHistoricFullFicha(area, indicator, year);
        if (!result || !result.success) {
            setAdminMessage('adminHistoricMessage', result?.error || 'No existen registros para el criterio seleccionado.', 'warn');
            return;
        }

        setAdminMessage('adminHistoricMessage', `Ficha completa cargada para ${indicator} (${year}).`, 'success');
    } catch (error) {
        console.error('handleAdminHistoricQuery:', error);
        setAdminMessage('adminHistoricMessage', 'Ocurrio un error al consultar el historico.', 'error');
    }
}
