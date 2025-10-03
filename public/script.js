document.addEventListener('DOMContentLoaded', ( ) => {
    // --- Global Holat (State) ---
    const state = {
        settings: { app_settings: { columns: [], rows: [], locations: [] }, pagination_limit: 20 },
        savedReports: {},
        currentUser: null,
        currentReportId: null,
        isEditMode: false,
        filters: { page: 1, searchTerm: '', startDate: '', endDate: '', filter: 'all' },
        pagination: { total: 0, pages: 0, currentPage: 1 }
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
        adminPanelBtn: document.getElementById('admin-panel-btn'),
        savedReportsList: document.getElementById('saved-reports-list'),
        searchInput: document.getElementById('search-input'),
        summaryWrapper: document.getElementById('summary-wrapper'),
        summaryList: document.getElementById('summary-list'),
        summaryTotal: document.getElementById('summary-total'),
        historyBtn: document.getElementById('history-btn'),
        historyModal: document.getElementById('history-modal'),
        historyModalBody: document.getElementById('history-modal-body'),
        currentUsername: document.getElementById('current-username'),
        currentUserRole: document.getElementById('current-user-role'),
        filterDateRange: document.getElementById('filter-date-range'),
        reportFilterButtons: document.getElementById('report-filter-buttons'),
        paginationControls: document.getElementById('pagination-controls'),
        lateCommentModal: document.getElementById('late-comment-modal'),
        lateCommentForm: document.getElementById('late-comment-form'),
        lateCommentInput: document.getElementById('late-comment-input'),
        toast: document.getElementById('toast-notification')
    };

    let datePickerFP = null;
    let dateFilterFP = null;

    // --- Yordamchi Funksiyalar ---
    const showToast = (message, isError = false) => {
        if (!DOM.toast) return;
        DOM.toast.textContent = message;
        DOM.toast.className = `toast ${isError ? 'error' : ''}`;
        setTimeout(() => { DOM.toast.className = `toast ${isError ? 'error' : ''} hidden`; }, 3000);
    };
    const formatNumber = (num) => num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "0";
    const parseNumber = (str) => parseFloat(String(str).replace(/\s/g, '')) || 0;
    const formatReportId = (id) => String(id).padStart(4, '0');
    const debounce = (func, delay) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // --- Asosiy Funksiyalar ---
    async function init() {
        try {
            const userRes = await fetch('/api/current-user');
            if (!userRes.ok) {
                window.location.href = '/login';
                return;
            }
            state.currentUser = await userRes.json();
            
            updateUserInfo();
            applyRolePermissions();

            const settingsRes = await fetch('/api/settings');
            state.settings = settingsRes.ok ? await settingsRes.json() : state.settings;

            setupDatePickers();
            populateLocations();
            buildTable();
            
            await fetchAndRenderReports();
            setupEventListeners();
            feather.replace();
            
            if (state.currentUser.permissions.includes('reports:create')) {
                createNewReport();
            } else {
                if(DOM.tableBody) DOM.tableBody.innerHTML = '<tr><td colspan="100%"><div class="empty-state">Yangi hisobot yaratish uchun ruxsat yo\'q.</div></td></tr>';
                if (DOM.confirmBtn) DOM.confirmBtn.classList.add('hidden');
            }

        } catch (error) {
            showToast("Sahifani yuklashda jiddiy xatolik yuz berdi!", true);
            console.error("Initialization error:", error);
        }
    }
    
    function applyRolePermissions() {
        const userPermissions = state.currentUser.permissions || [];
        if (userPermissions.includes('roles:manage') || userPermissions.includes('users:view')) {
            if (DOM.adminPanelBtn) DOM.adminPanelBtn.classList.remove('hidden');
        }
        document.querySelectorAll('[data-permission]').forEach(el => {
            const requiredPermission = el.dataset.permission;
            if (!userPermissions.includes(requiredPermission)) {
                el.style.display = 'none';
            }
        });
    }
    
    function updateUserInfo() {
        if (DOM.currentUsername) DOM.currentUsername.textContent = state.currentUser.username;
        if (DOM.currentUserRole) DOM.currentUserRole.textContent = state.currentUser.role;
    }

    async function fetchAndRenderReports() {
        if (!state.currentUser.permissions.includes('reports:view_own') && !state.currentUser.permissions.includes('reports:view_all')) {
            if (DOM.savedReportsList) DOM.savedReportsList.innerHTML = '<div class="empty-state">Hisobotlarni ko\'rish uchun ruxsat yo\'q.</div>';
            return;
        }
        if (DOM.savedReportsList) DOM.savedReportsList.innerHTML = Array(4).fill('<div class="skeleton-item"></div>').join('');
        try {
            const params = new URLSearchParams(state.filters);
            const res = await fetch(`/api/reports?${params.toString()}`);
            if (!res.ok) throw new Error("Hisobotlarni yuklashda xatolik.");
            
            const data = await res.json();
            state.savedReports = data.reports;
            state.pagination = { total: data.total, pages: data.pages, currentPage: data.currentPage };

            renderSavedReports();
            renderPagination();
        } catch (error) {
            showToast(error.message, true);
            if (DOM.savedReportsList) DOM.savedReportsList.innerHTML = `<div class="empty-state error">${error.message}</div>`;
        }
    }

    function setupDatePickers() {
        if (DOM.datePickerEl) {
            datePickerFP = flatpickr(DOM.datePickerEl, {
                locale: 'uz', dateFormat: 'Y-m-d', defaultDate: new Date(), altInput: true, altFormat: 'd.m.Y',
            });
        }
        if (DOM.filterDateRange) {
            dateFilterFP = flatpickr(DOM.filterDateRange, {
                mode: "range", dateFormat: "Y-m-d", locale: 'uz',
                onChange: (selectedDates) => {
                    state.filters.startDate = selectedDates[0] ? flatpickr.formatDate(selectedDates[0], 'Y-m-d') : '';
                    state.filters.endDate = selectedDates[1] ? flatpickr.formatDate(selectedDates[1], 'Y-m-d') : '';
                    state.filters.page = 1;
                    fetchAndRenderReports();
                }
            });
        }
    }

    function buildTable() {
        const { columns = [], rows = [] } = state.settings.app_settings || {};
        if (DOM.tableHead) DOM.tableHead.innerHTML = `<tr><th>Ko'rsatkich</th>${columns.map(c => `<th>${c}</th>`).join('')}<th>Jami</th></tr>`;
        if (DOM.tableBody) DOM.tableBody.innerHTML = rows.map(rowName => `
            <tr>
                <td data-label="Ko'rsatkich">${rowName}</td>
                ${columns.map(colName => `<td data-label="${colName}"><input type="text" class="form-control numeric-input" data-key="${rowName}_${colName}" placeholder="0"></td>`).join('')}
                <td data-label="Jami" class="row-total">0</td>
            </tr>`).join('');
        if (DOM.tableFoot) DOM.tableFoot.innerHTML = `<tr><td>Jami</td>${columns.map(c => `<td class="col-total" data-col="${c}">0</td>`).join('')}<td id="grand-total">0</td></tr>`;
    }

    function updateTableValues(reportData = {}) {
        if (!DOM.tableBody) return;
        DOM.tableBody.querySelectorAll('.numeric-input').forEach(input => {
            const value = reportData[input.dataset.key] || '';
            input.value = value ? formatNumber(value) : '';
        });
        updateCalculations();
    }

    function updateCalculations() {
        let grandTotal = 0;
        const columns = state.settings.app_settings?.columns || [];
        const columnTotals = columns.reduce((acc, col) => ({ ...acc, [col]: 0 }), {});

        if (DOM.tableBody) DOM.tableBody.querySelectorAll('tr').forEach(row => {
            let rowTotal = 0;
            row.querySelectorAll('.numeric-input').forEach(input => {
                const value = parseNumber(input.value);
                rowTotal += value;
                const colName = input.parentElement.dataset.label;
                if (columnTotals.hasOwnProperty(colName)) {
                    columnTotals[colName] += value;
                }
            });
            const rowTotalCell = row.querySelector('.row-total');
            if (rowTotalCell) rowTotalCell.textContent = formatNumber(rowTotal);
            grandTotal += rowTotal;
        });

        if (DOM.tableFoot) {
            DOM.tableFoot.querySelectorAll('.col-total').forEach(cell => {
                cell.textContent = formatNumber(columnTotals[cell.dataset.col]);
            });
            const grandTotalCell = document.getElementById('grand-total');
            if (grandTotalCell) grandTotalCell.textContent = formatNumber(grandTotal);
        }
        renderSummary();
    }

    function renderSummary() {
        if (!DOM.summaryList || !DOM.summaryWrapper || !DOM.summaryTotal) return;
        DOM.summaryList.innerHTML = '';
        let hasData = false;
        if (DOM.tableBody) DOM.tableBody.querySelectorAll('tr').forEach(row => {
            const rowName = row.cells[0].textContent;
            const rowTotal = parseNumber(row.querySelector('.row-total')?.textContent);
            if (rowTotal > 0) {
                hasData = true;
                DOM.summaryList.innerHTML += `<div class="summary-item"><span>${rowName}</span><span>${formatNumber(rowTotal)} so'm</span></div>`;
            }
        });
        const grandTotalText = document.getElementById('grand-total')?.textContent;
        if (hasData) {
            DOM.summaryTotal.textContent = `Umumiy summa: ${grandTotalText} so'm`;
            DOM.summaryWrapper.classList.remove('hidden');
        } else {
            DOM.summaryWrapper.classList.add('hidden');
        }
    }

    function populateLocations() {
        if (!DOM.locationSelect) return;
        const { locations = [] } = state.settings.app_settings || {};
        const userLocations = state.currentUser.locations || [];
        const canViewAll = state.currentUser.permissions.includes('reports:view_all');
        const locationsToShow = canViewAll ? locations : userLocations;
        DOM.locationSelect.innerHTML = locationsToShow.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    }

    function setInputsReadOnly(isReadOnly) {
        if (DOM.tableBody) DOM.tableBody.querySelectorAll('.numeric-input').forEach(input => input.disabled = isReadOnly);
        if (datePickerFP) datePickerFP.set('clickOpens', !isReadOnly);
        if (DOM.locationSelect) DOM.locationSelect.disabled = isReadOnly || (state.currentUser.role === 'operator' && state.currentUser.locations.length <= 1);
    }

    function updateUIForReportState() {
        const isNew = state.currentReportId === null;
        const report = state.savedReports[state.currentReportId];
        const canEdit = state.currentUser.permissions.includes('reports:edit_all') ||
                        (state.currentUser.permissions.includes('reports:edit_assigned') && state.currentUser.locations.includes(report?.location)) ||
                        (state.currentUser.permissions.includes('reports:edit_own') && report?.created_by === state.currentUser.id);
        
        if (DOM.confirmBtn) DOM.confirmBtn.classList.toggle('hidden', !state.isEditMode);
        if (DOM.editBtn) DOM.editBtn.classList.toggle('hidden', isNew || state.isEditMode || !canEdit);
        if (DOM.historyBtn) DOM.historyBtn.classList.toggle('hidden', isNew);
    }

    function createNewReport() {
        if (!state.currentUser.permissions.includes('reports:create')) {
            return showToast("Sizda yangi hisobot yaratish uchun ruxsat yo'q.", true);
        }
        state.currentReportId = null;
        state.isEditMode = true;
        
        buildTable();
        updateTableValues({});
        setInputsReadOnly(false);

        if (DOM.reportIdBadge) {
            DOM.reportIdBadge.textContent = 'YANGI';
            DOM.reportIdBadge.className = 'badge new';
        }
        if (DOM.confirmBtn) DOM.confirmBtn.innerHTML = '<i data-feather="check-circle"></i> TASDIQLASH VA SAQLASH';
        
        if (datePickerFP) datePickerFP.setDate(new Date(), true);
        if (DOM.locationSelect && state.currentUser.locations.length > 0) {
            DOM.locationSelect.value = state.currentUser.locations[0];
        }
        
        document.querySelectorAll('.report-item.active').forEach(item => item.classList.remove('active'));
        updateUIForReportState();
        feather.replace();
    }

    function loadReport(reportId) {
        const report = state.savedReports[reportId];
        if (!report) return;

        state.currentReportId = reportId;
        state.isEditMode = false;

        const originalSettings = state.settings.app_settings;
        state.settings.app_settings = report.settings;
        buildTable();
        state.settings.app_settings = originalSettings;
        
        updateTableValues(report.data);
        setInputsReadOnly(true);

        if (DOM.reportIdBadge) {
            DOM.reportIdBadge.textContent = `#${formatReportId(reportId)}`;
            DOM.reportIdBadge.className = 'badge saved';
        }
        if (datePickerFP) datePickerFP.setDate(report.date, true);
        if (DOM.locationSelect) DOM.locationSelect.value = report.location;

        document.querySelectorAll('.report-item.active').forEach(item => item.classList.remove('active'));
        document.querySelector(`.report-item[data-id='${reportId}']`)?.classList.add('active');
        updateUIForReportState();
    }

    function renderSavedReports() {
        if (!DOM.savedReportsList) return;
        const reportIds = Object.keys(state.savedReports);
        if (reportIds.length === 0) {
            DOM.savedReportsList.innerHTML = '<div class="empty-state">Hisobotlar topilmadi.</div>';
            return;
        }
        DOM.savedReportsList.innerHTML = reportIds.map(id => {
            const report = state.savedReports[id];
            const editInfo = report.edit_count > 0 ? `<div class="report-edit-info">✍️ Tahrirlangan (${report.edit_count})</div>` : '';
            return `
                <div class="report-item" data-id="${id}">
                    <div class="report-item-content">#${formatReportId(id)} - ${report.location} - ${report.date}</div>
                    ${editInfo}
                </div>`;
        }).join('');
    }

    function renderPagination() {
        if (!DOM.paginationControls) return;
        const { pages, currentPage } = state.pagination;
        if (pages <= 1) {
            DOM.paginationControls.classList.add('hidden');
            return;
        }
        DOM.paginationControls.classList.remove('hidden');
        DOM.paginationControls.innerHTML = `
            <button id="prev-page-btn" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}><i data-feather="chevron-left"></i></button>
            <span id="page-info">${currentPage} / ${pages}</span>
            <button id="next-page-btn" class="pagination-btn" ${currentPage === pages ? 'disabled' : ''}><i data-feather="chevron-right"></i></button>
        `;
        feather.replace();
    }

    function setupEventListeners() {
        if (DOM.newReportBtn) DOM.newReportBtn.addEventListener('click', createNewReport);
        if (DOM.logoutBtn) DOM.logoutBtn.addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login';
        });
        if (DOM.savedReportsList) DOM.savedReportsList.addEventListener('click', e => {
            const item = e.target.closest('.report-item');
            if (item) loadReport(item.dataset.id);
        });
        if (DOM.tableBody) DOM.tableBody.addEventListener('input', e => {
            if (e.target.classList.contains('numeric-input')) {
                const input = e.target;
                const value = input.value.replace(/\s/g, '');
                const cursorPosition = input.selectionStart;
                const oldLength = input.value.length;
                input.value = formatNumber(value.replace(/[^0-9]/g, ''));
                const newLength = input.value.length;
                if (cursorPosition !== null) {
                    input.setSelectionRange(cursorPosition + (newLength - oldLength), cursorPosition + (newLength - oldLength));
                }
                updateCalculations();
            }
        });
        if (DOM.confirmBtn) DOM.confirmBtn.addEventListener('click', () => handleConfirm(null));
        if (DOM.editBtn) DOM.editBtn.addEventListener('click', handleEdit);
        if (DOM.searchInput) DOM.searchInput.addEventListener('input', debounce(e => {
            state.filters.searchTerm = e.target.value;
            state.filters.page = 1;
            fetchAndRenderReports();
        }, 300));
        if (DOM.paginationControls) DOM.paginationControls.addEventListener('click', e => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.id === 'prev-page-btn' && state.pagination.currentPage > 1) {
                state.filters.page--;
                fetchAndRenderReports();
            } else if (btn.id === 'next-page-btn' && state.pagination.currentPage < state.pagination.pages) {
                state.filters.page++;
                fetchAndRenderReports();
            }
        });
        if (DOM.historyBtn) DOM.historyBtn.addEventListener('click', showHistory);
        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => document.getElementById(btn.dataset.target)?.classList.add('hidden'));
        });
        if (DOM.lateCommentForm) DOM.lateCommentForm.addEventListener('submit', e => {
            e.preventDefault();
            const comment = DOM.lateCommentInput.value.trim();
            if (comment) {
                DOM.lateCommentModal?.classList.add('hidden');
                handleConfirm(comment);
            } else {
                showToast("Iltimos, kechikish sababini kiriting!", true);
            }
        });
    }

    async function handleConfirm(lateComment) {
        const selectedDate = datePickerFP?.selectedDates[0];
        if (!selectedDate) return showToast("Iltimos, hisobot sanasini tanlang!", true);

        if (!state.currentReportId && lateComment === null) {
            const now = new Date();
            const reportDate = new Date(selectedDate);
            reportDate.setDate(reportDate.getDate() + 1);
            reportDate.setHours(9, 0, 0, 0);
            if (now > reportDate) {
                if (DOM.lateCommentInput) DOM.lateCommentInput.value = '';
                if (DOM.lateCommentModal) DOM.lateCommentModal.classList.remove('hidden');
                return;
            }
        }

        const reportData = {
            date: flatpickr.formatDate(selectedDate, 'Y-m-d'),
            location: DOM.locationSelect.value,
            settings: state.settings.app_settings,
            data: {},
            late_comment: lateComment
        };
        DOM.tableBody?.querySelectorAll('.numeric-input').forEach(input => {
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
            setTimeout(() => {
                const reportElement = document.querySelector(`.report-item[data-id='${newId}']`);
                if (reportElement) {
                    reportElement.click();
                } else {
                    loadReport(newId);
                }
            }, 200);
        } catch (error) {
            showToast(error.message, true);
        }
    }

    function handleEdit() {
        state.isEditMode = true;
        setInputsReadOnly(false);
        if (DOM.confirmBtn) DOM.confirmBtn.innerHTML = "<i data-feather='save'></i> O'ZGARISHLARNI SAQLASH";
        updateUIForReportState();
        feather.replace();
    }

    async function showHistory() {
        if (!state.currentReportId || !DOM.historyModal || !DOM.historyModalBody) return;
        DOM.historyModalBody.innerHTML = '<div class="skeleton-item"></div>';
        DOM.historyModal.classList.remove('hidden');
        try {
            const res = await fetch(`/api/reports/${state.currentReportId}/history`);
            if (!res.ok) throw new Error('Tarixni yuklab bo\'lmadi');
            const history = await res.json();
            DOM.historyModalBody.innerHTML = history.length > 0 ? history.map(h => {
                const oldData = JSON.parse(h.old_data);
                const changes = Object.keys(oldData).map(key => 
                    `<div class="change-item">
                        <span>${key.replace(/_/g, ' ')}:</span>
                        <span>${formatNumber(oldData[key])}</span>
                    </div>`
                ).join('');
                return `
                <div class="history-entry">
                    <div class="history-meta">
                        <strong>${new Date(h.changed_at).toLocaleString('uz-UZ')}</strong> / <strong>${h.changed_by_username}</strong>
                    </div>
                    <div class="history-changes">${changes || '<em>(Ma\'lumotlar o\'zgarmagan)</em>'}</div>
                </div>`;
            }).join('') : '<div class="empty-state">O\'zgarishlar tarixi topilmadi.</div>';
        } catch (error) {
            DOM.historyModalBody.innerHTML = `<div class="empty-state error">${error.message}</div>`;
        }
    }

    // Dasturni ishga tushirish
    init();
});
