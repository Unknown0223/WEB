document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elementlarini topish ---
    const settingsBtn = document.getElementById('settings-btn');
    const newReportBtn = document.getElementById('new-report-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const tableHead = document.querySelector('#main-table thead');
    const tableBody = document.querySelector('#main-table tbody');
    const tableFoot = document.querySelector('#main-table tfoot');
    const locationSelect = document.getElementById('location-select');
    const reportIdBadge = document.getElementById('report-id-badge');
    const datePicker = document.getElementById('date-picker');
    let datePickerFP = null; // Flatpickr instance
    const confirmBtn = document.getElementById('confirm-btn');
    const excelBtn = document.getElementById('excel-btn');
    const savedReportsList = document.getElementById('saved-reports-list');
    const toastNotification = document.getElementById('toast-notification');
    const summaryWrapper = document.getElementById('summary-wrapper');
    const summaryList = document.getElementById('summary-list');
    const summaryTotal = document.getElementById('summary-total');
    const searchInput = document.getElementById('search-input');
    const historyBtn = document.getElementById('history-btn');
    const editBtn = document.getElementById('edit-btn');
    const historyModal = document.getElementById('history-modal');
    const historyModalBody = document.getElementById('history-modal-body');
    const filterButtonsContainer = document.getElementById('report-filter-buttons');
    
    // --- Holat (State) ---
    let state = {
        settings: { app_settings: { columns: [], rows: [], locations: [] } },
        savedReports: {},
        currentReport: { id: null, data: {} },
        currentUser: null,
        isEditMode: false,
        activeFilter: 'all'
    };

    // --- Yordamchi Funksiyalar ---
    function showToast(message, isError = false) {
        toastNotification.textContent = message;
        toastNotification.className = `toast ${isError ? 'error' : ''}`;
        toastNotification.classList.remove('hidden');
        setTimeout(() => { toastNotification.classList.add('hidden'); }, 3000);
    }
    function formatNumber(numStr) { return numStr ? numStr.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") : ''; }
    function formatReportId(id) { return String(id).padStart(2, '0'); }

    // --- Asosiy Funksiyalar ---
    async function init() {
        try {
            const userRes = await fetch('/api/current-user');
            if (!userRes.ok) { window.location.href = '/login'; return; }
            state.currentUser = await userRes.json();

            const [settingsRes, reportsRes] = await Promise.all([fetch('/api/settings'), fetch('/api/reports')]);
            state.settings = await settingsRes.json();
            state.savedReports = await reportsRes.json();

            // Init modern date picker (Flatpickr)
            // Custom locale to ensure Monday is the first day and labels match grid
            const uzLocale = {
                firstDayOfWeek: 1,
                weekdays: {
                    shorthand: ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sha'],
                    longhand: [
                        'Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'
                    ]
                },
                months: {
                    shorthand: ['Yan','Fev','Mar','Apr','May','Iyun','Iyul','Avg','Sen','Okt','Noy','Dek'],
                    longhand: [
                        'Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'
                    ]
                }
            };
            datePickerFP = flatpickr(datePicker, {
                locale: uzLocale,
                dateFormat: 'Y-m-d',
                defaultDate: new Date(),
                disableMobile: true,
                monthSelectorType: 'dropdown',
                altInput: true,
                altFormat: 'd.m.Y',
                allowInput: true,
                altInputClass: 'date-badge',
                showMonths: 1,
                onReady: (selectedDates, dateStr, instance) => {
                    instance.calendarContainer.classList.add('custom-calendar');
                    const currentMonthWrap = instance.calendarContainer.querySelector('.flatpickr-current-month');
                    const nativeMonthSelect = instance.calendarContainer.querySelector('.flatpickr-monthDropdown-months');
                    const nativeYearInput = currentMonthWrap?.querySelector('.numInput.cur-year');

                    // Hide native month/year controls (we'll keep them for internal sync)
                    if (nativeMonthSelect) nativeMonthSelect.style.display = 'none';
                    if (nativeYearInput) nativeYearInput.style.display = 'none';

                    // Create interactive header chips
                    const head = document.createElement('div');
                    head.className = 'fp-head';
                    const monthBtn = document.createElement('button');
                    monthBtn.type = 'button';
                    monthBtn.className = 'fp-chip';
                    const yearBtn = document.createElement('button');
                    yearBtn.type = 'button';
                    yearBtn.className = 'fp-chip';
                    head.append(monthBtn, yearBtn);
                    currentMonthWrap.appendChild(head);

                    // Month panel (grid)
                    const monthPanel = document.createElement('div');
                    monthPanel.className = 'fp-dropdown fp-month-panel';
                    const monthGrid = document.createElement('div');
                    monthGrid.className = 'fp-month-grid';
                    uzLocale.months.longhand.forEach((mName, idx) => {
                        const b = document.createElement('button');
                        b.type = 'button';
                        b.className = 'fp-month-item';
                        b.textContent = mName;
                        b.addEventListener('click', () => {
                            const y = instance.currentYear;
                            const d = (instance.selectedDates[0] || new Date()).getDate();
                            const newDate = new Date(y, idx, Math.min(d, 28));
                            instance.setDate(newDate, false);
                            instance.jumpToDate(newDate);
                            closeAll();
                            refreshLabels();
                        });
                        monthGrid.appendChild(b);
                    });
                    monthPanel.appendChild(monthGrid);

                    // Year panel (scrollable list with +/-)
                    const yearPanel = document.createElement('div');
                    yearPanel.className = 'fp-dropdown fp-year-panel';
                    const yearControls = document.createElement('div');
                    yearControls.className = 'fp-year-controls';
                    const decBtn = document.createElement('button'); decBtn.type = 'button'; decBtn.className = 'fp-year-step'; decBtn.textContent = '−';
                    const incBtn = document.createElement('button'); incBtn.type = 'button'; incBtn.className = 'fp-year-step'; incBtn.textContent = '+';
                    yearControls.append(decBtn, incBtn);
                    const yearList = document.createElement('div');
                    yearList.className = 'fp-year-list';
                    yearPanel.append(yearControls, yearList);

                    const YEAR_MIN = 2015;
                    const YEAR_MAX = 2035;
                    function fillYears(centerY) {
                        yearList.innerHTML = '';
                        const startY = Math.max(YEAR_MIN, centerY - 6);
                        const endY = Math.min(YEAR_MAX, centerY + 6);
                        for (let y = startY; y <= endY; y++) {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = 'fp-year-item' + (y === instance.currentYear ? ' active' : '');
                            btn.textContent = String(y);
                            btn.addEventListener('click', () => {
                                const m = instance.currentMonth;
                                const d = (instance.selectedDates[0] || new Date()).getDate();
                                const newDate = new Date(y, m, d);
                                instance.setDate(newDate, false);
                                instance.jumpToDate(newDate);
                                closeAll();
                                refreshLabels();
                            });
                            yearList.appendChild(btn);
                        }
                    }

                    decBtn.addEventListener('click', () => fillYears(Math.max(YEAR_MIN, instance.currentYear - 12)));
                    incBtn.addEventListener('click', () => fillYears(Math.min(YEAR_MAX, instance.currentYear + 12)));
                    yearList.addEventListener('wheel', (e) => {
                        e.preventDefault();
                        const next = instance.currentYear + (e.deltaY > 0 ? 1 : -1);
                        fillYears(Math.min(YEAR_MAX, Math.max(YEAR_MIN, next)));
                    }, { passive: false });

                    // Insert panels
                    currentMonthWrap.style.position = 'relative';
                    currentMonthWrap.append(monthPanel, yearPanel);

                    function clampPanel(panel){
                        const calRect = instance.calendarContainer.getBoundingClientRect();
                        const pRect = panel.getBoundingClientRect();
                        const overflowLeft = calRect.left + (calRect.width/2) - pRect.width/2 < 0;
                        const overflowRight = calRect.left + (calRect.width/2) + pRect.width/2 > window.innerWidth;
                        if (overflowLeft) { panel.style.left = '10px'; panel.style.transform = 'translateX(0)'; }
                        if (overflowRight) { panel.style.left = 'auto'; panel.style.right = '10px'; panel.style.transform = 'none'; }
                    }

                    function closeAll() { monthPanel.classList.remove('open'); yearPanel.classList.remove('open'); }
                    monthBtn.addEventListener('click', (e) => { e.stopPropagation(); yearPanel.classList.remove('open'); monthPanel.classList.toggle('open'); if(monthPanel.classList.contains('open')) clampPanel(monthPanel); });
                    yearBtn.addEventListener('click', (e) => { e.stopPropagation(); monthPanel.classList.remove('open'); yearPanel.classList.toggle('open'); if(yearPanel.classList.contains('open')) clampPanel(yearPanel); });
                    instance.calendarContainer.addEventListener('click', (e) => {
                        if (!currentMonthWrap.contains(e.target)) closeAll();
                    });
                    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

                    function refreshLabels() {
                        monthBtn.textContent = uzLocale.months.longhand[instance.currentMonth];
                        yearBtn.textContent = String(instance.currentYear);
                        // Active month highlight
                        monthGrid.querySelectorAll('.fp-month-item').forEach((el, idx) => {
                            el.classList.toggle('active', idx === instance.currentMonth);
                        });
                        // Refill years around current (within fixed range)
                        const center = Math.min(YEAR_MAX, Math.max(YEAR_MIN, instance.currentYear));
                        fillYears(center);
                    }

                    refreshLabels();
                    instance._refreshHeader = refreshLabels;
                }
                ,onYearChange: (selectedDates, dateStr, instance) => {
                    if (instance._refreshHeader) instance._refreshHeader();
                }
                ,onMonthChange: (selectedDates, dateStr, instance) => {
                    if (instance._refreshHeader) instance._refreshHeader();
                }
            });

            applyRolePermissions();
            populateLocations();
            renderSavedReports();
            createNewReport();
        } catch (error) { showToast("Ma'lumotlarni yuklashda xatolik!", true); console.error(error); }
    }

    function applyRolePermissions() {
        const { role } = state.currentUser;
        // Sozlamalar tugmasini faqat admin uchun ko'rsatish
        if (role !== 'admin') {
            settingsBtn.style.display = 'none';
        }
        if (role === 'manager') {
            newReportBtn.style.display = 'none';
            confirmBtn.style.display = 'none';
        } else if (role === 'operator') {
            // Operator uchun sozlamalar tugmasi yuqorida yashirilgan
        }
    }

    function buildTable() {
        const appSettings = state.settings.app_settings;
        tableHead.innerHTML = '';
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `<th>Ko'rsatkich</th>`;
        (appSettings.columns || []).forEach(col => { headerRow.innerHTML += `<th>${col}</th>`; });
        headerRow.innerHTML += `<th>Jami</th>`;
        tableHead.appendChild(headerRow);

        tableBody.innerHTML = '';
        (appSettings.rows || []).forEach(rowName => {
            const row = document.createElement('tr');
            let rowHTML = `<td data-label="Ko'rsatkich">${rowName}</td>`;
            (appSettings.columns || []).forEach(colName => {
                const key = `${rowName}_${colName}`;
                const value = state.currentReport.data[key] || '';
                const formattedValue = value ? formatNumber(value) : '';
                rowHTML += `<td data-label="${colName}"><input type="text" class="numeric-input" data-key="${key}" value="${formattedValue}" placeholder="0"></td>`;
            });
            rowHTML += `<td data-label="Jami" class="row-total">0</td>`;
            row.innerHTML = rowHTML;
            tableBody.appendChild(row);
        });

        tableFoot.innerHTML = '';
        const footerRow = document.createElement('tr');
        let footerHTML = `<td>Jami</td>`;
        (appSettings.columns || []).forEach(col => { footerHTML += `<td id="total-${col.replace(/\s/g, '_')}">0</td>`; });
        footerHTML += `<td id="grand-total">0</td>`;
        footerRow.innerHTML = footerHTML;
        tableFoot.appendChild(footerRow);

        const isReadOnly = (state.currentReport.id && !state.isEditMode) || state.currentUser.role === 'manager';
        tableBody.querySelectorAll('.numeric-input').forEach(input => input.disabled = isReadOnly);
        datePicker.disabled = isReadOnly;
        if (datePickerFP) { datePickerFP.set('clickOpens', !isReadOnly); }
        locationSelect.disabled = isReadOnly || (state.currentUser.role === 'operator' && state.currentUser.locations.length <= 1);
        
        updateCalculations();
    }

    function updateCalculations() {
        let grandTotal = 0;
        const columnTotals = {};
        const appSettings = state.settings.app_settings;
        (appSettings.columns || []).forEach(col => columnTotals[col] = 0);
        tableBody.querySelectorAll('tr').forEach(row => {
            let rowTotal = 0;
            row.querySelectorAll('.numeric-input').forEach(input => {
                const value = parseFloat(input.value.replace(/\s/g, '')) || 0;
                rowTotal += value;
                const colName = input.parentElement.dataset.label;
                if (columnTotals.hasOwnProperty(colName)) { columnTotals[colName] += value; }
            });
            row.querySelector('.row-total').textContent = formatNumber(rowTotal);
            grandTotal += rowTotal;
        });
        (appSettings.columns || []).forEach(col => {
            const totalCell = document.getElementById(`total-${col.replace(/\s/g, '_')}`);
            if (totalCell) totalCell.textContent = formatNumber(columnTotals[col]);
        });
        document.getElementById('grand-total').textContent = formatNumber(grandTotal);
        renderSummary();
    }

    function renderSummary() {
        summaryList.innerHTML = '';
        let hasData = false;
        tableBody.querySelectorAll('tr').forEach(row => {
            const rowName = row.querySelector('td:first-child').textContent;
            const rowTotalText = row.querySelector('.row-total').textContent;
            const rowTotalValue = parseFloat(rowTotalText.replace(/\s/g, '')) || 0;
            if (rowTotalValue > 0) {
                hasData = true;
                const summaryItem = document.createElement('div');
                summaryItem.className = 'summary-item';
                summaryItem.innerHTML = `<span class="item-name">${rowName}</span><span class="item-value">${rowTotalText} so'm</span>`;
                summaryList.appendChild(summaryItem);
            }
        });
        const grandTotalText = document.getElementById('grand-total').textContent;
        if (hasData) {
            summaryTotal.textContent = `Umumiy summa: ${grandTotalText} so'm`;
            summaryWrapper.classList.remove('hidden');
        } else {
            summaryWrapper.classList.add('hidden');
        }
    }

    function populateLocations() {
        const appSettings = state.settings.app_settings;
        const currentVal = locationSelect.value;
        locationSelect.innerHTML = '';
        const locationsToShow = (state.currentUser.role === 'operator' && state.currentUser.locations.length > 0) ? state.currentUser.locations : (appSettings.locations || []);
        locationsToShow.forEach(loc => { locationSelect.add(new Option(loc, loc)); });
        if (currentVal && locationsToShow.includes(currentVal)) { locationSelect.value = currentVal; }
    }

    function createNewReport() {
        state.isEditMode = false;
        state.currentReport = { id: null, data: {} };
        reportIdBadge.textContent = 'YANGI';
        reportIdBadge.className = 'badge new';
        confirmBtn.textContent = 'TASDIQLASH VA SAQLASH';
        confirmBtn.classList.remove('hidden');
        editBtn.classList.add('hidden');
        historyBtn.classList.add('hidden');
        if (datePickerFP) { datePickerFP.setDate(new Date(), true); } else { datePicker.valueAsDate = new Date(); }
        if (state.currentUser.role === 'operator' && state.currentUser.locations.length > 0) {
            locationSelect.value = state.currentUser.locations[0];
        }
        buildTable();
        document.querySelectorAll('.report-item.active').forEach(item => item.classList.remove('active'));
        summaryWrapper.classList.add('hidden');
    }

    function renderSavedReports() {
        savedReportsList.innerHTML = '';
        const reportIds = Object.keys(state.savedReports).map(Number).sort((a, b) => b - a);
        const searchTerm = searchInput.value.toLowerCase().trim();

        if (reportIds.length === 0) {
            savedReportsList.innerHTML = '<p>Hozircha hisobotlar yo\'q.</p>';
            return;
        }

        let hasVisibleReports = false;
        reportIds.forEach(id => {
            const report = state.savedReports[id];
            const item = document.createElement('div');
            item.className = 'report-item';
            item.dataset.id = id;
            item.dataset.edited = report.edit_count > 0;

            const editIndicator = report.edit_count > 0 ? `<span class="edit-indicator">✍️ (${report.edit_count})</span>` : '';
            
            item.innerHTML = `<span>#${formatReportId(id)} - ${report.location} - ${report.date}</span>${editIndicator}`;
            item.addEventListener('click', () => loadReport(id));
            
            const matchesSearch = item.textContent.toLowerCase().includes(searchTerm);
            const matchesFilter = (state.activeFilter === 'all') ||
                                  (state.activeFilter === 'edited' && report.edit_count > 0) ||
                                  (state.activeFilter === 'unedited' && report.edit_count === 0);

            if (matchesSearch && matchesFilter) {
                item.style.display = 'block';
                hasVisibleReports = true;
            } else {
                item.style.display = 'none';
            }

            savedReportsList.appendChild(item);
        });

        if (!hasVisibleReports) {
            savedReportsList.innerHTML = '<p>Filtrga mos hisobotlar topilmadi.</p>';
        }
    }

    function loadReport(id) {
        const report = state.savedReports[id];
        if (!report) return;
        state.isEditMode = false;
        state.currentReport = { id: id, data: { ...report.data } };
        reportIdBadge.textContent = `#${formatReportId(id)}`;
        reportIdBadge.className = 'badge saved';
        if (datePickerFP) { datePickerFP.setDate(report.date, true); } else { datePicker.value = report.date; }
        populateLocations();
        locationSelect.value = report.location;
        
        // Hisobotga saqlangan sozlamalarni vaqtinchalik ishlatish
        const originalSettings = state.settings.app_settings;
        state.settings.app_settings = report.settings;
        buildTable();
        state.settings.app_settings = originalSettings; // Asl sozlamalarni qaytarish
        
        confirmBtn.classList.add('hidden');
        if (state.currentUser.role === 'admin') {
            editBtn.classList.remove('hidden');
            historyBtn.classList.remove('hidden');
        }
        document.querySelectorAll('.report-item.active').forEach(item => item.classList.remove('active'));
        document.querySelector(`.report-item[data-id='${id}']`)?.classList.add('active');
    }

    // --- Hodisa Tinglovchilari ---

    // YAGI O'ZGARTIRISH: Sozlamalar tugmasi endi admin sahifasiga olib boradi
    settingsBtn.addEventListener('click', () => {
        window.location.href = '/admin';
    });

    historyModal.querySelector('.close-btn').addEventListener('click', () => historyModal.classList.add('hidden'));
    window.addEventListener('click', (e) => { if (e.target == historyModal) historyModal.classList.add('hidden'); });
    newReportBtn.addEventListener('click', createNewReport);
    logoutBtn.addEventListener('click', async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = '/login'; });

    excelBtn.addEventListener('click', () => {
        try {
            const data = [];
            const headerCells = tableHead.querySelectorAll('tr th');
            const headerRow = Array.from(headerCells).map(th => th.textContent);
            data.push(headerRow);

            tableBody.querySelectorAll('tr').forEach(tr => {
                const rowData = [];
                rowData.push(tr.querySelector('td:first-child').textContent);
                tr.querySelectorAll('.numeric-input').forEach(input => {
                    const numericValue = parseFloat(input.value.replace(/\s/g, '')) || 0;
                    rowData.push(numericValue);
                });
                const rowTotal = parseFloat(tr.querySelector('.row-total').textContent.replace(/\s/g, '')) || 0;
                rowData.push(rowTotal);
                data.push(rowData);
            });

            const footerCells = tableFoot.querySelectorAll('tr td');
            const footerRow = Array.from(footerCells).map(td => {
                const value = td.textContent;
                const numericValue = parseFloat(value.replace(/\s/g, ''));
                return isNaN(numericValue) ? value : numericValue;
            });
            data.push(footerRow);

            const worksheet = XLSX.utils.aoa_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Hisobot');

            const reportId = state.currentReport.id ? `#${formatReportId(state.currentReport.id)}` : 'Yangi';
            const location = locationSelect.value;
            const date = datePickerFP && datePickerFP.selectedDates[0]
                ? datePickerFP.formatDate(datePickerFP.selectedDates[0], 'Y-m-d')
                : datePicker.value;
            const fileName = `Hisobot_${reportId}_${location}_${date}.xlsx`;
            XLSX.writeFile(workbook, fileName);

            showToast("Excel fayl muvaffaqiyatli yaratildi!");
        } catch (error) {
            console.error("Excel eksport qilishda xatolik:", error);
            showToast("Excel faylni yaratishda xatolik yuz berdi!", true);
        }
    });

    confirmBtn.addEventListener('click', async () => {
        const isUpdating = state.currentReport.id && state.isEditMode;
        const url = isUpdating ? `/api/reports/${state.currentReport.id}` : '/api/reports';
        const method = isUpdating ? 'PUT' : 'POST';
        const selectedDateStr = (datePickerFP && datePickerFP.selectedDates[0])
            ? datePickerFP.formatDate(datePickerFP.selectedDates[0], 'Y-m-d')
            : datePicker.value;
        if (!selectedDateStr) { showToast("Iltimos, hisobot sanasini tanlang!", true); return; }
        const reportData = { date: selectedDateStr, location: locationSelect.value, data: state.currentReport.data, settings: state.settings.app_settings };
        try {
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reportData) });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            showToast(result.message);
            const reportsRes = await fetch('/api/reports');
            state.savedReports = await reportsRes.json();
            renderSavedReports();
            const newId = isUpdating ? state.currentReport.id : result.reportId;
            loadReport(newId);
        } catch (error) { showToast(error.message, true); }
    });

    editBtn.addEventListener('click', () => { state.isEditMode = true; buildTable(); confirmBtn.textContent = "O'ZGARISHLARNI SAQLASH"; confirmBtn.classList.remove('hidden'); editBtn.classList.add('hidden'); });

    historyBtn.addEventListener('click', async () => {
        if (!state.currentReport.id) return;
        try {
            const res = await fetch(`/api/reports/${state.currentReport.id}/history`);
            if (!res.ok) throw new Error("Tarixni yuklab bo'lmadi");
            const history = await res.json();
            historyModalBody.innerHTML = '';
            if (history.length === 0) { historyModalBody.innerHTML = '<p>Bu hisobot uchun o\'zgarishlar tarixi mavjud emas.</p>'; }
            else {
                history.forEach(item => {
                    const oldData = JSON.parse(item.old_data);
                    const currentData = state.savedReports[item.report_id].data;
                    let diffHtml = '';
                    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(currentData)]);
                    allKeys.forEach(key => {
                        const oldValue = oldData[key] || 0;
                        const newValue = currentData[key] || 0;
                        if (oldValue !== newValue) {
                            diffHtml += `<div>${key.replace(/_/g, ' ')}: <span class="old-value">${formatNumber(oldValue)}</span> → <span class="new-value">${formatNumber(newValue)}</span></div>`;
                        }
                    });
                    if (diffHtml) {
                        historyModalBody.innerHTML += `<div class="history-item"><div class="history-header"><span class="changed-by">${item.changed_by_username} tomonidan</span><span>${new Date(item.changed_at).toLocaleString()}</span></div><div class="history-data-diff">${diffHtml}</div></div>`;
                    }
                });
            }
            historyModal.classList.remove('hidden');
        } catch (error) { showToast(error.message, true); }
    });

    tableBody.addEventListener('input', (e) => { if (e.target.classList.contains('numeric-input')) { const input = e.target; const key = input.dataset.key; const value = input.value.replace(/\s/g, ''); state.currentReport.data[key] = parseFloat(value) || 0; const cursorPosition = input.selectionStart; const oldLength = input.value.length; input.value = formatNumber(value.replace(/[^0-9]/g, '')); const newLength = input.value.length; input.setSelectionRange(cursorPosition + (newLength - oldLength), cursorPosition + (newLength - oldLength)); updateCalculations(); } });
    
    searchInput.addEventListener('input', renderSavedReports);
    filterButtonsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            filterButtonsContainer.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            state.activeFilter = e.target.dataset.filter;
            renderSavedReports();
        }
    });

    init();
});
