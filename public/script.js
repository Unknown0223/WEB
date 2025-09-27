document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elementlarini topish ---
    const settingsBtn = document.getElementById('settings-btn');
    const newReportBtn = document.getElementById('new-report-btn');
    const logoutBtn = document.getElementById('logout-btn'); // YANGI
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
    const summaryWrapper = document.getElementById('summary-wrapper');
    const summaryList = document.getElementById('summary-list');
    const summaryTotal = document.getElementById('summary-total');
    const searchInput = document.getElementById('search-input');

    // --- Foydalanuvchi paneli elementlari (YANGI) ---
    const usersListDiv = document.getElementById('users-list');
    const addUserBtn = document.getElementById('add-user-btn');
    const newUserUsernameInput = document.getElementById('new-user-username');
    const newUserPasswordInput = document.getElementById('new-user-password');
    const newUserLocationSelect = document.getElementById('new-user-location');


    // --- Global o'zgaruvchilar ---
    let currentUser = null;
    let state = {
        settings: { columns: [], rows: [], locations: [] },
        savedReports: {},
        currentReport: { id: null, data: {} }
    };

    // --- Asosiy Funksiyalar ---

    async function loadInitialData() {
        try {
            const userRes = await fetch('/api/current-user');
            if (!userRes.ok) {
                window.location.href = '/login';
                return;
            }
            currentUser = await userRes.json();

            const settingsRes = await fetch('/api/settings');
            state.settings = await settingsRes.json();

            const reportsRes = await fetch('/api/reports');
            state.savedReports = await reportsRes.json();
            
            if (currentUser.role === 'admin') {
                settingsBtn.style.display = 'block';
            } else {
                settingsBtn.style.display = 'none';
            }

            if (currentUser.role === 'user' && currentUser.location) {
                locationSelect.value = currentUser.location;
                locationSelect.disabled = true;
            }

        } catch (error) {
            console.error("Boshlang'ich ma'lumotlarni yuklashda xatolik:", error);
            showToast("Serverdan ma'lumot yuklashda xatolik yuz berdi!", true);
        }
    }

    function buildTable() {
        tableHead.innerHTML = '';
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `<th>Stolbets 1</th>`;
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
            if (totalCell) totalCell.textContent = formatNumber(columnTotals[col]);
        });
        document.getElementById('grand-total').textContent = formatNumber(grandTotal);
        renderSummary();
    }

    function populateLocations() {
        const currentVal = locationSelect.value;
        locationSelect.innerHTML = '';
        newUserLocationSelect.innerHTML = '<option value="">Filialni tanlang</option>'; // YANGI
        state.settings.locations.forEach(loc => {
            const optionHTML = `<option value="${loc}">${loc}</option>`;
            locationSelect.innerHTML += optionHTML;
            newUserLocationSelect.innerHTML += optionHTML; // YANGI
        });
        locationSelect.value = currentVal;
    }

    function createNewReport() {
        state.currentReport = { id: null, data: {} };
        reportIdBadge.textContent = 'YANGI';
        reportIdBadge.className = 'badge new';
        confirmBtn.textContent = 'TASDIQLASH VA SAQLASH';
        confirmBtn.disabled = false;
        datePicker.valueAsDate = new Date();
        datePicker.classList.remove('pulse-error');
        
        if (currentUser && currentUser.role === 'user') {
            locationSelect.value = currentUser.location;
        }

        buildTable();
        document.querySelectorAll('.report-item.active').forEach(item => item.classList.remove('active'));
        summaryWrapper.classList.add('hidden');
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
            item.innerHTML = `<span>#${String(id).padStart(2, '0')} - ${report.location} - ${report.date}</span>`;
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
        
        reportIdBadge.textContent = `#${String(id).padStart(2, '0')}`;
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

    function showToast(message, isError = false) {
        toastNotification.textContent = message;
        toastNotification.className = isError ? 'toast error' : 'toast';
        toastNotification.classList.remove('hidden');
        setTimeout(() => {
            toastNotification.classList.add('hidden');
        }, 3000);
    }

    function formatNumber(numStr) {
        if (!numStr) return '';
        return numStr.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }

    // --- FOYDALANUVCHILARNI BOSHQARISH FUNKSIYALARI (YANGI) ---

    async function loadAndRenderUsers() {
        try {
            const res = await fetch('/api/users');
            if (!res.ok) throw new Error('Foydalanuvchilarni yuklab bo\'lmadi');
            const users = await res.json();
            
            usersListDiv.innerHTML = '';
            users.forEach(user => {
                const userEl = document.createElement('div');
                userEl.className = `user-item ${user.role === 'admin' ? 'admin-item' : ''}`;
                userEl.dataset.userId = user.id;
                
                let actions = '';
                // Admin o'zini o'chira olmaydi
                if (user.id !== currentUser.id) {
                    actions = `
                        <button class="reset-password-btn" title="Parolni o'zgartirish">🔑</button>
                        <button class="delete-user-btn" title="O'chirish">❌</button>
                    `;
                }

                userEl.innerHTML = `
                    <div class="user-info">
                        <span class="username">${user.username}</span>
                        <span class="location">${user.location || 'ADMIN'}</span>
                    </div>
                    <div class="user-actions">
                        ${actions}
                    </div>
                `;
                usersListDiv.appendChild(userEl);
            });
        } catch (error) {
            showToast(error.message, true);
        }
    }

    // --- Hodisa Tinglovchilari (Event Listeners) ---

    settingsBtn.addEventListener('click', async () => {
        // Sozlamalar oynasi ochilganda foydalanuvchilar ro'yxatini yuklash
        if (currentUser.role === 'admin') {
            await loadAndRenderUsers();
        }
        // Jadval sozlamalarini modalga yuklash
        const createSettingItem = (name, type) => `<div class="setting-item" data-type="${type}" data-original-name="${name}"><input type="text" value="${name}" class="setting-name-input"><button class="delete-item-btn">×</button></div>`;
        document.getElementById('columns-settings').innerHTML = state.settings.columns.map(col => createSettingItem(col, 'column')).join('');
        document.getElementById('rows-settings').innerHTML = state.settings.rows.map(row => createSettingItem(row, 'row')).join('');
        document.getElementById('locations-settings').innerHTML = state.settings.locations.map(loc => createSettingItem(loc, 'location')).join('');
        
        adminModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => adminModal.classList.add('hidden'));
    newReportBtn.addEventListener('click', createNewReport);

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch (error) {
            showToast('Tizimdan chiqishda xatolik', true);
        }
    });

    saveSettingsBtn.addEventListener('click', async () => {
        const tempSettings = { columns: [], rows: [], locations: [] };
        document.querySelectorAll('#admin-modal .settings-section:not(:first-child) .setting-item').forEach(item => {
            const type = item.dataset.type;
            const newName = item.querySelector('.setting-name-input').value.trim();
            if (newName) tempSettings[type + 's'].push(newName);
        });
        state.settings.columns = tempSettings.columns;
        state.settings.rows = tempSettings.rows;
        state.settings.locations = tempSettings.locations;
        
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state.settings)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            
            showToast("Jadval sozlamalari saqlandi!");
            populateLocations();
            createNewReport();
        } catch (error) {
            showToast(error.message, true);
        }
    });

    confirmBtn.addEventListener('click', async () => {
        if (state.currentReport.id) return;
        if (!datePicker.value) {
            showToast("Iltimos, hisobot sanasini tanlang!", true);
            datePicker.classList.add('pulse-error');
            datePicker.focus();
            return;
        }
        const reportData = {
            date: datePicker.value,
            location: locationSelect.value,
            data: state.currentReport.data,
            settings: { columns: state.settings.columns, rows: state.settings.rows, locations: state.settings.locations }
        };
        try {
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reportData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            showToast("Hisobot muvaffaqiyatli saqlandi!");
            const newId = result.reportId;
            state.savedReports[newId] = { id: newId, ...reportData };
            renderSavedReports();
            loadReport(newId);
        } catch (error) {
            showToast(error.message, true);
        }
    });

    excelBtn.addEventListener('click', () => {
        const reportId = state.currentReport.id;
        const isSavedReport = !!reportId;
        const reportToExport = isSavedReport ? state.savedReports[reportId] : null;
        const settings = isSavedReport ? reportToExport.settings : state.settings;
        const data = isSavedReport ? reportToExport.data : state.currentReport.data;
        const rows = [];
        const headers = ['Stolbets 1', ...settings.columns, 'Жами'];
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
        settings.columns.forEach(colName => footerRow.push(columnTotals[colName]));
        footerRow.push(grandTotal);
        rows.push(footerRow);
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Hisobot");
        const date = isSavedReport ? reportToExport.date : datePicker.value;
        XLSX.writeFile(workbook, `Hisobot_${date || 'aniqlanmagan'}.xlsx`);
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        savedReportsList.querySelectorAll('.report-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(searchTerm) ? 'block' : 'none';
        });
    });

    tableBody.addEventListener('input', (e) => {
        if (e.target.classList.contains('numeric-input')) {
            const input = e.target;
            const key = input.dataset.key;
            const value = input.value.replace(/\s/g, '');
            state.currentReport.data[key] = parseFloat(value) || 0;
            const cursorPosition = input.selectionStart;
            const oldLength = input.value.length;
            input.value = formatNumber(value.replace(/[^0-9]/g, ''));
            const newLength = input.value.length;
            input.setSelectionRange(cursorPosition + (newLength - oldLength), cursorPosition + (newLength - oldLength));
            updateCalculations();
        }
    });
    
    adminModal.addEventListener('click', (e) => {
        const addAndRender = (type, inputId) => {
            const input = document.getElementById(inputId);
            const name = input.value.trim();
            const list = state.settings[type + 's'];
            if (name && !list.includes(name)) {
                list.push(name);
                // Bu funksiya endi faqat jadval sozlamalarini chizadi
                const createSettingItem = (name, type) => `<div class="setting-item" data-type="${type}" data-original-name="${name}"><input type="text" value="${name}" class="setting-name-input"><button class="delete-item-btn">×</button></div>`;
                document.getElementById(type + 's-settings').innerHTML = list.map(item => createSettingItem(item, type)).join('');
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

    // --- FOYDALANUVCHILARNI BOSHQARISH HODISALARI (YANGI) ---

    addUserBtn.addEventListener('click', async () => {
        const username = newUserUsernameInput.value.trim();
        const password = newUserPasswordInput.value.trim();
        const location = newUserLocationSelect.value;

        if (!username || !password || !location) {
            showToast('Barcha maydonlarni to\'ldiring!', true);
            return;
        }

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, location, role: 'user' })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);

            showToast(result.message);
            newUserUsernameInput.value = '';
            newUserPasswordInput.value = '';
            newUserLocationSelect.value = '';
            await loadAndRenderUsers(); // Ro'yxatni yangilash
        } catch (error) {
            showToast(error.message, true);
        }
    });

    usersListDiv.addEventListener('click', async (e) => {
        const userId = e.target.closest('.user-item')?.dataset.userId;
        if (!userId) return;

        // Foydalanuvchini o'chirish
        if (e.target.classList.contains('delete-user-btn')) {
            if (confirm(`Rostdan ham bu foydalanuvchini o'chirmoqchimisiz?`)) {
                try {
                    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    showToast(result.message);
                    await loadAndRenderUsers();
                } catch (error) {
                    showToast(error.message, true);
                }
            }
        }

        // Parolni o'zgartirish
        if (e.target.classList.contains('reset-password-btn')) {
            const newPassword = prompt("Yangi parolni kiriting (kamida 4 belgi):");
            if (newPassword && newPassword.length >= 4) {
                try {
                    const res = await fetch(`/api/users/${userId}/password`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ newPassword })
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    showToast(result.message);
                } catch (error) {
                    showToast(error.message, true);
                }
            } else if (newPassword !== null) { // Agar "Cancel" bosilmagan bo'lsa
                showToast("Parol juda qisqa yoki kiritilmadi!", true);
            }
        }
    });

    // --- Dasturni Boshlash ---
    async function init() {
        await loadInitialData();
        if(currentUser) {
            populateLocations();
            renderSavedReports();
            createNewReport();
        }
    }

    init();
});
