document.addEventListener('DOMContentLoaded', () => {
    // --- Global Holat (State) ---
    const state = {
        settings: { app_settings: { columns: [], rows: [], locations: [] } },
        savedReports: {},
        currentUser: null,
        currentReportId: null,
        isEditMode: false,
        activeFilter: 'all',
    };

    // --- DOM Elementlari ---
    const DOM = {
        body: document.body,
        tableHead: document.querySelector('#main-table thead'),
        tableBody: document.querySelector('#main-table tbody'),
        tableFoot: document.querySelector('#main-table tfoot'),
        locationSelect: document.getElementById('location-select'),
        reportIdBadge: document.getElementById('report-id-badge'),
        datePickerEl: document.getElementById('date-picker'),
        confirmBtn: document.getElementById('confirm-btn'),
        editBtn: document.getElementById('edit-btn'),
        excelBtn: document.getElementById('excel-btn'),
        newReportBtn: document.getElementById('new-report-btn'),
        logoutBtn: document.getElementById('logout-btn'),
        savedReportsList: document.getElementById('saved-reports-list'),
        searchInput: document.getElementById('search-input'),
        filterButtons: document.getElementById('report-filter-buttons'),
        summaryWrapper: document.getElementById('summary-wrapper'),
        summaryList: document.getElementById('summary-list'),
        summaryTotal: document.getElementById('summary-total'),
        historyBtn: document.getElementById('history-btn'),
        historyModal: document.getElementById('history-modal'),
        historyModalBody: document.getElementById('history-modal-body'),
        currentUsername: document.getElementById('current-username'),
        currentUserRole: document.getElementById('current-user-role'),
    };

    let datePickerFP = null; // Flatpickr instance

    // --- Yordamchi Funksiyalar ---
    const showToast = (message, isError = false) => {
        const toast = document.getElementById('toast-notification');
        toast.textContent = message;
        toast.className = `toast ${isError ? 'error' : ''}`;
        setTimeout(() => { toast.className = `toast ${isError ? 'error' : ''} hidden`; }, 3000);
    };
    const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const parseNumber = (str) => parseFloat(str.replace(/\s/g, '')) || 0;
    const formatReportId = (id) => String(id).padStart(4, '0');

    // --- Asosiy Funksiyalar ---
    async function init() {
        try {
            // 1. Foydalanuvchi va asosiy sozlamalarni yuklash
            const [userRes, settingsRes] = await Promise.all([
                fetch('/api/current-user'),
                fetch('/api/settings')
            ]);

            if (!userRes.ok) {
                window.location.href = '/login';
                return;
            }
            state.currentUser = await userRes.json();
            state.settings = await settingsRes.json();

            // 2. Rolga asoslangan interfeysni sozlash
            applyRolePermissions();
            updateUserInfo();

            // 3. Jadval va boshqa komponentlarni birinchi marta chizish
            setupDatePicker();
            populateLocations();
            buildTable();
            
            // 4. Hisobotlarni yuklash va ko'rsatish
            await fetchAndRenderReports();

            // 5. Hodisalarni sozlash
            setupEventListeners();
            feather.replace();
            
            // 6. Yangi hisobot rejimida boshlash
            createNewReport();

        } catch (error) {
            showToast("Ma'lumotlarni yuklashda jiddiy xatolik!", true);
            console.error("Initialization error:", error);
        }
    }

    function applyRolePermissions() {
        const { role } = state.currentUser;
        DOM.body.dataset.userRole = role; // CSS orqali elementlarni yashirish uchun
    }
    
    function updateUserInfo() {
        DOM.currentUsername.textContent = state.currentUser.username;
        DOM.currentUserRole.textContent = state.currentUser.role;
    }

    async function fetchAndRenderReports() {
        try {
            const reportsRes = await fetch('/api/reports');
            state.savedReports = await reportsRes.json();
            renderSavedReports();
        } catch (error) {
            showToast("Hisobotlarni yuklashda xatolik!", true);
        }
    }

    function setupDatePicker() {
        datePickerFP = flatpickr(DOM.datePickerEl, {
            locale: 'uz',
            dateFormat: 'Y-m-d',
            defaultDate: new Date(),
            altInput: true,
            altFormat: 'd.m.Y',
            onChange: () => DOM.datePickerEl.classList.remove('error-pulse'),
        });
    }

    function buildTable() {
        const { columns = [], rows = [] } = state.settings.app_settings;
        // Sarlavha (Thead)
        DOM.tableHead.innerHTML = `<tr><th>Ko'rsatkich</th>${columns.map(c => `<th>${c}</th>`).join('')}<th>Jami</th></tr>`;
        // Tana (Tbody)
        DOM.tableBody.innerHTML = rows.map(rowName => `
            <tr>
                <td data-label="Ko'rsatkich">${rowName}</td>
                ${columns.map(colName => `<td data-label="${colName}"><input type="text" class="form-control numeric-input" data-key="${rowName}_${colName}" placeholder="0"></td>`).join('')}
                <td data-label="Jami" class="row-total">0</td>
            </tr>`).join('');
        // Yakun (Tfoot)
        DOM.tableFoot.innerHTML = `<tr><td>Jami</td>${columns.map(c => `<td class="col-total" data-col="${c}">0</td>`).join('')}<td id="grand-total">0</td></tr>`;
    }

    function updateTableValues(reportData = {}) {
        DOM.tableBody.querySelectorAll('.numeric-input').forEach(input => {
            const value = reportData[input.dataset.key] || '';
            input.value = value ? formatNumber(value) : '';
        });
        updateCalculations();
    }

    function updateCalculations() {
        let grandTotal = 0;
        const columnTotals = {};
        state.settings.app_settings.columns.forEach(col => columnTotals[col] = 0);

        DOM.tableBody.querySelectorAll('tr').forEach(row => {
            let rowTotal = 0;
            row.querySelectorAll('.numeric-input').forEach(input => {
                const value = parseNumber(input.value);
                rowTotal += value;
                const colName = input.parentElement.dataset.label;
                if (columnTotals.hasOwnProperty(colName)) {
                    columnTotals[colName] += value;
                }
            });
            row.querySelector('.row-total').textContent = formatNumber(rowTotal);
            grandTotal += rowTotal;
        });

        DOM.tableFoot.querySelectorAll('.col-total').forEach(cell => {
            const colName = cell.dataset.col;
            cell.textContent = formatNumber(columnTotals[colName]);
        });
        document.getElementById('grand-total').textContent = formatNumber(grandTotal);
        renderSummary();
    }

    function renderSummary() {
        DOM.summaryList.innerHTML = '';
        let hasData = false;
        DOM.tableBody.querySelectorAll('tr').forEach(row => {
            const rowName = row.cells[0].textContent;
            const rowTotal = parseNumber(row.querySelector('.row-total').textContent);
            if (rowTotal > 0) {
                hasData = true;
                DOM.summaryList.innerHTML += `<div class="summary-item"><span>${rowName}</span><span>${formatNumber(rowTotal)} so'm</span></div>`;
            }
        });
        const grandTotalText = document.getElementById('grand-total').textContent;
        if (hasData) {
            DOM.summaryTotal.textContent = `Umumiy summa: ${grandTotalText} so'm`;
            DOM.summaryWrapper.classList.remove('hidden');
        } else {
            DOM.summaryWrapper.classList.add('hidden');
        }
    }

    function populateLocations() {
        const { locations = [] } = state.settings.app_settings;
        const userLocations = state.currentUser.locations;
        const locationsToShow = (state.currentUser.role !== 'admin' && userLocations.length > 0) ? userLocations : locations;
        DOM.locationSelect.innerHTML = locationsToShow.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    }

    function setInputsReadOnly(isReadOnly) {
        DOM.tableBody.querySelectorAll('.numeric-input').forEach(input => input.disabled = isReadOnly);
        datePickerFP.set('clickOpens', !isReadOnly);
        DOM.locationSelect.disabled = isReadOnly || (state.currentUser.role === 'operator' && state.currentUser.locations.length <= 1);
    }

    function createNewReport() {
        state.currentReportId = null;
        state.isEditMode = true;
        
        updateTableValues({});
        setInputsReadOnly(false);

        DOM.reportIdBadge.textContent = 'YANGI';
        DOM.reportIdBadge.className = 'badge new';
        DOM.confirmBtn.innerHTML = '<i data-feather="check-circle"></i> TASDIQLASH VA SAQLASH';
        
        datePickerFP.setDate(new Date(), true);
        if (state.currentUser.locations.length > 0) {
            DOM.locationSelect.value = state.currentUser.locations[0];
        }
        
        document.querySelectorAll('.report-item.active').forEach(item => item.classList.remove('active'));
        feather.replace();
    }

    function loadReport(reportId) {
        const report = state.savedReports[reportId];
        if (!report) return;

        state.currentReportId = reportId;
        state.isEditMode = false;

        // Muhim: Hisobotning o'z sozlamalari bilan jadvalni qayta chizish
        // Bu eski hisobotlar to'g'ri ko'rinishi uchun kerak
        const originalSettings = state.settings.app_settings;
        state.settings.app_settings = report.settings;
        buildTable();
        state.settings.app_settings = originalSettings;
        
        updateTableValues(report.data);
        setInputsReadOnly(true);

        DOM.reportIdBadge.textContent = `#${formatReportId(reportId)}`;
        DOM.reportIdBadge.className = 'badge saved';
        datePickerFP.setDate(report.date, true);
        DOM.locationSelect.value = report.location;

        document.querySelectorAll('.report-item.active').forEach(item => item.classList.remove('active'));
        document.querySelector(`.report-item[data-id='${reportId}']`)?.classList.add('active');
    }

    function renderSavedReports() {
        DOM.savedReportsList.innerHTML = ''; // Skeletni tozalash
        const reportIds = Object.keys(state.savedReports).map(Number).sort((a, b) => b - a);
        const searchTerm = DOM.searchInput.value.toLowerCase().trim();

        if (reportIds.length === 0) {
            DOM.savedReportsList.innerHTML = '<div class="empty-state">Hisobotlar topilmadi.</div>';
            return;
        }

        const filteredReports = reportIds.filter(id => {
            const report = state.savedReports[id];
            const searchMatch = `#${formatReportId(id)}`.includes(searchTerm) || report.location.toLowerCase().includes(searchTerm) || report.date.includes(searchTerm);
            const filterMatch = state.activeFilter === 'all' || (state.activeFilter === 'edited' && report.edit_count > 0) || (state.activeFilter === 'unedited' && report.edit_count === 0);
            return searchMatch && filterMatch;
        });

        if (filteredReports.length === 0) {
            DOM.savedReportsList.innerHTML = '<div class="empty-state">Filtrga mos hisobot topilmadi.</div>';
            return;
        }

        DOM.savedReportsList.innerHTML = filteredReports.map(id => {
            const report = state.savedReports[id];
            const editInfo = report.edit_count > 0 ? `<div class="report-edit-info">✍️ Tahrirlangan (${report.edit_count})</div>` : '';
            return `
                <div class="report-item" data-id="${id}">
                    <div class="report-item-content">#${formatReportId(id)} - ${report.location} - ${report.date}</div>
                    ${editInfo}
                </div>`;
        }).join('');
    }

    // --- Hodisa Tinglovchilari ---
    function setupEventListeners() {
        DOM.newReportBtn.addEventListener('click', createNewReport);
        DOM.logoutBtn.addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login';
        });
        DOM.savedReportsList.addEventListener('click', (e) => {
            const item = e.target.closest('.report-item');
            if (item) loadReport(item.dataset.id);
        });
        DOM.tableBody.addEventListener('input', (e) => {
            if (e.target.classList.contains('numeric-input')) {
                const input = e.target;
                const value = input.value.replace(/\s/g, '');
                const cursorPosition = input.selectionStart;
                const oldLength = input.value.length;
                input.value = formatNumber(value.replace(/[^0-9]/g, ''));
                const newLength = input.value.length;
                input.setSelectionRange(cursorPosition + (newLength - oldLength), cursorPosition + (newLength - oldLength));
                updateCalculations();
            }
        });
        DOM.confirmBtn.addEventListener('click', handleConfirm);
        DOM.editBtn.addEventListener('click', handleEdit);
        DOM.searchInput.addEventListener('input', renderSavedReports);
        DOM.filterButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                DOM.filterButtons.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                state.activeFilter = e.target.dataset.filter;
                renderSavedReports();
            }
        });
        // Boshqa hodisalar...
    }

    async function handleConfirm() {
        const selectedDate = datePickerFP.selectedDates[0];
        if (!selectedDate) {
            showToast("Iltimos, hisobot sanasini tanlang!", true);
            DOM.datePickerEl.classList.add('error-pulse');
            return;
        }

        const reportData = {
            date: datePickerFP.formatDate(selectedDate, 'Y-m-d'),
            location: DOM.locationSelect.value,
            settings: state.settings.app_settings,
            data: {},
        };
        DOM.tableBody.querySelectorAll('.numeric-input').forEach(input => {
            reportData.data[input.dataset.key] = parseNumber(input.value);
        });

        const isUpdating = state.currentReportId && state.isEditMode;
        const url = isUpdating ? `/api/reports/${state.currentReportId}` : '/api/reports';
        const method = isUpdating ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reportData) });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            
            showToast(result.message);
            await fetchAndRenderReports();
            const newId = isUpdating ? state.currentReportId : result.reportId;
            loadReport(newId);

        } catch (error) {
            showToast(error.message, true);
        }
    }

    function handleEdit() {
        state.isEditMode = true;
        setInputsReadOnly(false);
        DOM.confirmBtn.innerHTML = "<i data-feather='save'></i> O'ZGARISHLARNI SAQLASH";
        feather.replace();
    }

    // Dasturni ishga tushirish
    init();
});
