document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elementlarini topish ---
    const settingsBtn = document.getElementById('settings-btn');
    const newReportBtn = document.getElementById('new-report-btn');
    const adminModal = document.getElementById('admin-modal');
    const closeModalBtn = document.querySelector('.close-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const tableHead = document.querySelector('#main-table thead');
    const tableBody = document.querySelector('#main-table tbody');
    const tableFoot = document.querySelector('#main-table tfoot');
    const locationSelect = document.getElementById('location-select');
    const reportIdBadge = document.getElementById('report-id-badge');
    const datePicker = document.getElementById('date-picker');
    const confirmBtn = document.getElementById('confirm-btn');
    const excelBtn = document.getElementById('excel-btn');
    const savedReportsList = document.getElementById('saved-reports-list');
    const toastNotification = document.getElementById('toast-notification');
    // Yangi elementlar
    const summaryWrapper = document.getElementById('summary-wrapper');
    const summaryList = document.getElementById('summary-list');
    const summaryTotal = document.getElementById('summary-total');
    const searchInput = document.getElementById('search-input');


    // --- Ma'lumotlar bazasi (localStorage) va holat (state) ---
    let state = {
        settings: {
            columns: ["Накд", "Перечисление", "Терминал"],
            rows: ["Лалаку", "Соф", "Женс", "Гига", "арзони", "SUV", "LM", "ECO"],
            locations: ["Навоий", "Тошкент", "Самарқанд"],
            nextReportId: 1
        },
        savedReports: {},
        currentReport: { id: null, data: {} }
    };

    // --- XULOSA BLOKINI YARATISH UCHUN YANGI FUNKSIYA ---
    function renderSummary() {
        summaryList.innerHTML = ''; // Ro'yxatni tozalash

        // Har bir jadval qatori uchun
        tableBody.querySelectorAll('tr').forEach(row => {
            const rowName = row.querySelector('td:first-child').textContent;
            const rowTotalText = row.querySelector('.row-total').textContent;
            const rowTotalValue = parseFloat(rowTotalText.replace(/\s/g, '')) || 0;

            // Agar qator summasi 0 dan katta bo'lsa...
            if (rowTotalValue > 0) {
                const summaryItem = document.createElement('div');
                summaryItem.className = 'summary-item';
                summaryItem.innerHTML = `
                    <span class="item-name">${rowName}</span>
                    <span class="item-value">${rowTotalText} so'm</span>
                `;
                summaryList.appendChild(summaryItem);
            }
        });

        // Umumiy summani olish va ko'rsatish
        const grandTotalText = document.getElementById('grand-total').textContent;
        const grandTotalValue = parseFloat(grandTotalText.replace(/\s/g, '')) || 0;

        if (grandTotalValue > 0) {
            summaryTotal.textContent = `Umumiy summa: ${grandTotalText} so'm`;
            summaryWrapper.classList.remove('hidden'); // Xulosa blokini ko'rsatish
        } else {
            summaryWrapper.classList.add('hidden'); // Agar summa 0 bo'lsa, yashirish
        }
    }

    // --- Asosiy Funksiyalar ---

    function loadState() {
        const savedSettings = localStorage.getItem('hisobot_settings');
        const savedReports = localStorage.getItem('hisobot_reports');
        if (savedSettings) {
            const loadedSettings = JSON.parse(savedSettings);
            if (!loadedSettings.nextReportId || loadedSettings.nextReportId > 100000) {
                const maxId = savedReports ? Math.max(0, ...Object.keys(JSON.parse(savedReports)).map(Number)) : 0;
                loadedSettings.nextReportId = maxId >= 1 ? maxId + 1 : 1;
            }
            state.settings = { ...state.settings, ...loadedSettings };
        }
        if (savedReports) {
            state.savedReports = JSON.parse(savedReports);
        }
    }

    function saveState() {
        localStorage.setItem('hisobot_settings', JSON.stringify(state.settings));
        localStorage.setItem('hisobot_reports', JSON.stringify(state.savedReports));
    }

    function buildTable() {
        tableHead.innerHTML = '';
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `<th>Столбец 1</th>`;
        state.settings.columns.forEach(col => { headerRow.innerHTML += `<th>${col}</th>`; });
        headerRow.innerHTML += `<th>Жами</th>`;
        tableHead.appendChild(headerRow);
        tableBody.innerHTML = '';
        state.settings.rows.forEach(rowName => {
            const row = document.createElement('tr');
            let rowHTML = `<td data-label="Stolbets 1">${rowName}</td>`;
            state.settings.columns.forEach(colName => {
                const key = `${rowName}_${colName}`;
                const value = state.currentReport.data[key] || '';
                const formattedValue = value ? formatNumber(value) : '';
                rowHTML += `<td data-label="${colName}"><input type="text" class="numeric-input" data-key="${key}" value="${formattedValue}" placeholder="0"></td>`;
            });
            rowHTML += `<td data-label="Жами" class="row-total">0</td>`;
            row.innerHTML = rowHTML;
            tableBody.appendChild(row);
        });
        tableFoot.innerHTML = '';
        const footerRow = document.createElement('tr');
        let footerHTML = `<td>Жами</td>`;
        state.settings.columns.forEach(col => { footerHTML += `<td id="total-${col.replace(/\s/g, '_')}">0</td>`; });
        footerHTML += `<td id="grand-total">0</td>`;
        footerRow.innerHTML = footerHTML;
        tableFoot.appendChild(footerRow);
        if (state.currentReport.id) {
            tableBody.querySelectorAll('.numeric-input').forEach(input => input.disabled = true);
        }
        updateCalculations();
    }

    function updateCalculations() {
        let grandTotal = 0;
        const columnTotals = {};
        state.settings.columns.forEach(col => columnTotals[col] = 0);
        tableBody.querySelectorAll('tr').forEach(row => {
            let rowTotal = 0;
            row.querySelectorAll('.numeric-input').forEach(input => {
                const value = parseFloat(input.value.replace(/\s/g, '')) || 0;
                rowTotal += value;
                const colName = input.parentElement.dataset.label;
                if (columnTotals.hasOwnProperty(colName)) {
                    columnTotals[colName] += value;
                }
            });
            row.querySelector('.row-total').textContent = formatNumber(rowTotal);
            grandTotal += rowTotal;
        });
        state.settings.columns.forEach(col => {
            const totalCell = document.getElementById(`total-${col.replace(/\s/g, '_')}`);
            if (totalCell) {
                totalCell.textContent = formatNumber(columnTotals[col]);
            }
        });
        document.getElementById('grand-total').textContent = formatNumber(grandTotal);
        
        renderSummary();
    }

    function populateAdminModal() {
        const createSettingItem = (name, type) => `<div class="setting-item" data-type="${type}" data-original-name="${name}"><input type="text" value="${name}" class="setting-name-input"><button class="delete-item-btn">×</button></div>`;
        document.getElementById('columns-settings').innerHTML = state.settings.columns.map(col => createSettingItem(col, 'column')).join('');
        document.getElementById('rows-settings').innerHTML = state.settings.rows.map(row => createSettingItem(row, 'row')).join('');
        document.getElementById('locations-settings').innerHTML = state.settings.locations.map(loc => createSettingItem(loc, 'location')).join('');
    }

    function populateLocations() {
        locationSelect.innerHTML = '';
        state.settings.locations.forEach(loc => {
            locationSelect.innerHTML += `<option value="${loc}">${loc}</option>`;
        });
    }

    function createNewReport() {
        state.currentReport = { id: null, data: {} };
        reportIdBadge.textContent = 'YANGI';
        reportIdBadge.className = 'badge new';
        confirmBtn.textContent = 'TASDIQLASH VA SAQLASH';
        confirmBtn.disabled = false;
        datePicker.value = '';
        datePicker.classList.remove('pulse-error');
        buildTable();
        document.querySelectorAll('.report-item.active').forEach(item => item.classList.remove('active'));
        summaryWrapper.classList.add('hidden');
    }

    function formatReportId(id) {
        if (id > 100000) {
            return id;
        }
        return String(id).padStart(2, '0');
    }

    function renderSavedReports() {
        savedReportsList.innerHTML = '';
        const reportIds = Object.keys(state.savedReports).map(Number).sort((a, b) => b - a);
        if (reportIds.length === 0) {
            savedReportsList.innerHTML = '<p>Hozircha hisobotlar yo\'q.</p>';
            return;
        }
        reportIds.forEach(id => {
            const report = state.savedReports[id];
            const item = document.createElement('div');
            item.className = 'report-item';
            item.dataset.id = id;
            item.innerHTML = `<span>#${formatReportId(id)} - ${report.location} - ${report.date}</span>`;
            item.addEventListener('click', () => loadReport(id));
            savedReportsList.appendChild(item);
        });
    }

    function loadReport(id) {
        const report = state.savedReports[id];
        if (!report) return;
        const originalSettings = JSON.parse(JSON.stringify(state.settings));
        state.settings = report.settings;
        state.currentReport = JSON.parse(JSON.stringify({ id: id, data: report.data }));
        
        reportIdBadge.textContent = `#${formatReportId(id)}`;
        
        reportIdBadge.className = 'badge saved';
        datePicker.value = report.date;
        datePicker.classList.remove('pulse-error');
        populateLocations();
        locationSelect.value = report.location;
        buildTable();
        confirmBtn.textContent = 'SAQLANGAN';
        confirmBtn.disabled = true;
        document.querySelectorAll('.report-item.active').forEach(item => item.classList.remove('active'));
        const activeItem = document.querySelector(`.report-item[data-id='${id}']`);
        if (activeItem) activeItem.classList.add('active');
        state.settings = originalSettings;
    }

    function showToast(message) {
        toastNotification.textContent = message;
        toastNotification.classList.remove('hidden');
        setTimeout(() => {
            toastNotification.classList.add('hidden');
        }, 3000);
    }

    function formatNumber(numStr) {
        if (!numStr) return '';
        return numStr.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }

    // --- Hodisa Tinglovchilari ---

    settingsBtn.addEventListener('click', () => {
        populateAdminModal();
        adminModal.classList.remove('hidden');
    });
    closeModalBtn.addEventListener('click', () => adminModal.classList.add('hidden'));
    window.addEventListener('click', (e) => {
        if (e.target == adminModal) adminModal.classList.add('hidden');
    });
    newReportBtn.addEventListener('click', createNewReport);

    adminModal.addEventListener('click', (e) => {
        const addAndRender = (type, inputId) => {
            const input = document.getElementById(inputId);
            const name = input.value.trim();
            const list = state.settings[type + 's'];
            if (name && !list.includes(name)) {
                list.push(name);
                populateAdminModal();
                input.value = '';
            }
        };
        if (e.target.id === 'add-column-btn') addAndRender('column', 'new-column-name');
        if (e.target.id === 'add-row-btn') addAndRender('row', 'new-row-name');
        if (e.target.id === 'add-location-btn') addAndRender('location', 'new-location-name');
        if (e.target.classList.contains('delete-item-btn')) {
            const item = e.target.parentElement;
            const type = item.dataset.type;
            const originalName = item.dataset.originalName;
            state.settings[type + 's'] = state.settings[type + 's'].filter(i => i !== originalName);
            item.remove();
        }
    });

    saveSettingsBtn.addEventListener('click', () => {
        const tempSettings = { columns: [], rows: [], locations: [] };
        document.querySelectorAll('.setting-item').forEach(item => {
            const type = item.dataset.type;
            const newName = item.querySelector('.setting-name-input').value.trim();
            if (newName) {
                tempSettings[type + 's'].push(newName);
            }
        });
        state.settings.columns = tempSettings.columns;
        state.settings.rows = tempSettings.rows;
        state.settings.locations = tempSettings.locations;
        saveState();
        adminModal.classList.add('hidden');
        populateLocations();
        createNewReport();
    });

    tableBody.addEventListener('input', (e) => {
        if (e.target.classList.contains('numeric-input')) {
            const input = e.target;
            const key = input.dataset.key;
            const value = input.value.replace(/\s/g, '');
            state.currentReport.data[key] = parseFloat(value) || 0;
            const cursorPosition = input.selectionStart;
            const oldLength = input.value.length;
            const formattedValue = formatNumber(value.replace(/[^0-9]/g, ''));
            input.value = formattedValue;
            const newLength = input.value.length;
            input.setSelectionRange(cursorPosition + (newLength - oldLength), cursorPosition + (newLength - oldLength));
            updateCalculations();
        }
    });

    confirmBtn.addEventListener('click', () => {
        if (state.currentReport.id) return;

        if (!datePicker.value) {
            showToast("Iltimos, hisobot sanasini tanlang!");
            datePicker.classList.add('pulse-error');
            datePicker.focus();
            return;
        }

        const newId = state.settings.nextReportId;
        state.savedReports[newId] = {
            date: datePicker.value,
            location: locationSelect.value,
            data: JSON.parse(JSON.stringify(state.currentReport.data)),
            settings: JSON.parse(JSON.stringify(state.settings))
        };
        state.settings.nextReportId++;
        saveState();
        renderSavedReports();
        loadReport(newId);
    });

    excelBtn.addEventListener('click', () => {
        const reportId = state.currentReport.id;
        const isSavedReport = !!reportId;
        const reportToExport = isSavedReport ? state.savedReports[reportId] : null;
        const settings = isSavedReport ? reportToExport.settings : state.settings;
        const data = isSavedReport ? reportToExport.data : state.currentReport.data;
        const rows = [];
        const headers = ['Столбец 1', ...settings.columns, 'Жами'];
        rows.push(headers);
        const columnTotals = {};
        settings.columns.forEach(col => columnTotals[col] = 0);
        let grandTotal = 0;
        settings.rows.forEach(rowName => {
            const row = [rowName];
            let rowTotal = 0;
            settings.columns.forEach(colName => {
                const key = `${rowName}_${colName}`;
                const value = parseFloat(data[key]) || 0;
                row.push(value);
                rowTotal += value;
                columnTotals[colName] += value;
            });
            row.push(rowTotal);
            rows.push(row);
            grandTotal += rowTotal;
        });
        const footerRow = ['Жами'];
        settings.columns.forEach(colName => {
            footerRow.push(columnTotals[colName]);
        });
        footerRow.push(grandTotal);
        rows.push(footerRow);
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Hisobot");
        const date = isSavedReport ? reportToExport.date : datePicker.value;
        XLSX.writeFile(workbook, `Hisobot_${date || 'aniqlanmagan'}.xlsx`);
    });

    datePicker.addEventListener('input', () => {
        if (datePicker.value) {
            datePicker.classList.remove('pulse-error');
        }
    });

    // --- Dasturni Boshlash ---
    function init() {
        loadState();
        populateLocations();
        renderSavedReports();
        createNewReport();
    }
        // --- QIDIRUV MAYDONI UCHUN HODISA TINGLOVCHI ---
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const reportItems = savedReportsList.querySelectorAll('.report-item');

        reportItems.forEach(item => {
            const itemText = item.textContent.toLowerCase();
            if (itemText.includes(searchTerm)) {
                item.style.display = 'block'; // Agar mos kelsa, ko'rsatish
            } else {
                item.style.display = 'none'; // Agar mos kelmasa, yashirish
            }
        });
    });


    init();
});
