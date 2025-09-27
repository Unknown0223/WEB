document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Elementlarini topish ---
    const settingsBtn = document.getElementById('settings-btn');
    const newReportBtn = document.getElementById('new-report-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const adminModal = document.getElementById('admin-modal');
    const closeModalBtn = adminModal.querySelector('.close-btn');
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
    const historyBtn = document.getElementById('history-btn');
    const editBtn = document.getElementById('edit-btn');
    const historyModal = document.getElementById('history-modal');
    const historyModalBody = document.getElementById('history-modal-body');
    const filterButtonsContainer = document.getElementById('report-filter-buttons'); // YANGI
    
    // --- Holat (State) ---
    let state = {
        settings: { app_settings: { columns: [], rows: [], locations: [] } },
        savedReports: {},
        currentReport: { id: null, data: {} },
        currentUser: null,
        isEditMode: false,
        activeFilter: 'all' // YANGI: Faol filtrni saqlash uchun
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

            applyRolePermissions();
            populateLocations();
            renderSavedReports(); // Endi bu funksiya filtrni ham hisobga oladi
            createNewReport();
        } catch (error) { showToast("Ma'lumotlarni yuklashda xatolik!", true); console.error(error); }
    }

    function applyRolePermissions() {
        const { role } = state.currentUser;
        if (role === 'manager') {
            newReportBtn.style.display = 'none';
            settingsBtn.style.display = 'none';
            confirmBtn.style.display = 'none';
        } else if (role === 'operator') {
            settingsBtn.style.display = 'none';
        }
    }

    function buildTable() {
        const appSettings = state.settings.app_settings;
        tableHead.innerHTML = '';
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `<th>Stolbets 1</th>`;
        (appSettings.columns || []).forEach(col => { headerRow.innerHTML += `<th>${col}</th>`; });
        headerRow.innerHTML += `<th>Жами</th>`;
        tableHead.appendChild(headerRow);

        tableBody.innerHTML = '';
        (appSettings.rows || []).forEach(rowName => {
            const row = document.createElement('tr');
            let rowHTML = `<td data-label="Stolbets 1">${rowName}</td>`;
            (appSettings.columns || []).forEach(colName => {
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
        (appSettings.columns || []).forEach(col => { footerHTML += `<td id="total-${col.replace(/\s/g, '_')}">0</td>`; });
        footerHTML += `<td id="grand-total">0</td>`;
        footerRow.innerHTML = footerHTML;
        tableFoot.appendChild(footerRow);

        const isReadOnly = (state.currentReport.id && !state.isEditMode) || state.currentUser.role === 'manager';
        tableBody.querySelectorAll('.numeric-input').forEach(input => input.disabled = isReadOnly);
        datePicker.disabled = isReadOnly;
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
        datePicker.valueAsDate = new Date();
        if (state.currentUser.role === 'operator' && state.currentUser.locations.length > 0) {
            locationSelect.value = state.currentUser.locations[0];
        }
        buildTable();
        document.querySelectorAll('.report-item.active').forEach(item => item.classList.remove('active'));
        summaryWrapper.classList.add('hidden');
    }

    // YAngi funksiya: Hisobotlar ro'yxatini filtr va qidiruv bilan chizish
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
            item.dataset.edited = report.edit_count > 0; // Filtr uchun data-attribut

            // Tahrirlanganlik belgisini qo'shish
            const editIndicator = report.edit_count > 0 ? `<span class="edit-indicator">✍️ (${report.edit_count})</span>` : '';
            
            item.innerHTML = `<span>#${formatReportId(id)} - ${report.location} - ${report.date}</span>${editIndicator}`;
            item.addEventListener('click', () => loadReport(id));
            
            // Filtr va qidiruv logikasi
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
        datePicker.value = report.date;
        populateLocations();
        locationSelect.value = report.location;
        const originalSettings = state.settings.app_settings;
        state.settings.app_settings = report.settings;
        buildTable();
        state.settings.app_settings = originalSettings;
        confirmBtn.classList.add('hidden');
        if (state.currentUser.role === 'admin') {
            editBtn.classList.remove('hidden');
            historyBtn.classList.remove('hidden');
        }
        document.querySelectorAll('.report-item.active').forEach(item => item.classList.remove('active'));
        document.querySelector(`.report-item[data-id='${id}']`)?.classList.add('active');
    }

    // --- Admin Paneli Funksiyalari ---
    async function populateAdminModal() {
        const appSettings = state.settings.app_settings;
        const createSettingItem = (name, type) => `<div class="setting-item" data-type="${type}" data-original-name="${name}"><input type="text" value="${name}" class="setting-name-input"><button class="delete-item-btn">×</button></div>`;
        document.getElementById('columns-settings').innerHTML = (appSettings.columns || []).map(col => createSettingItem(col, 'column')).join('');
        document.getElementById('rows-settings').innerHTML = (appSettings.rows || []).map(row => createSettingItem(row, 'row')).join('');
        document.getElementById('locations-settings').innerHTML = (appSettings.locations || []).map(loc => createSettingItem(loc, 'location')).join('');
        document.getElementById('bot-token').value = state.settings.telegram_bot_token || '';
        document.getElementById('group-id').value = state.settings.telegram_group_id || '';
        await loadUsersAndLocationsForAdmin();
    }

    async function loadUsersAndLocationsForAdmin() {
        try {
            const users = await (await fetch('/api/users')).json();
            const userList = document.getElementById('user-list');
            userList.innerHTML = '';
            users.forEach(user => {
                const userItem = document.createElement('div');
                userItem.className = `user-item ${user.role}-item`;
                const locationsText = user.locations.join(', ') || user.role.toUpperCase();
                userItem.innerHTML = `<div class="user-info"><span class="username">${user.username}</span><span class="locations">${locationsText}</span></div><div class="user-actions"><button class="reset-password-btn" data-id="${user.id}" title="Parolni o'zgartirish">🔑</button>${state.currentUser.id !== user.id ? `<button class="delete-user-btn" data-id="${user.id}" title="O'chirish">🗑️</button>` : ''}</div>`;
                userList.appendChild(userItem);
            });
            const checkboxList = document.getElementById('locations-checkbox-list');
            checkboxList.innerHTML = '';
            (state.settings.app_settings.locations || []).forEach(loc => { checkboxList.innerHTML += `<label class="checkbox-item"><input type="checkbox" name="user-locations" value="${loc}"> ${loc}</label>`; });
        } catch (error) { showToast(error.message, true); }
    }

    // --- Hodisa Tinglovchilari ---
    settingsBtn.addEventListener('click', () => { populateAdminModal(); adminModal.classList.remove('hidden'); });
    closeModalBtn.addEventListener('click', () => adminModal.classList.add('hidden'));
    historyModal.querySelector('.close-btn').addEventListener('click', () => historyModal.classList.add('hidden'));
    window.addEventListener('click', (e) => { if (e.target == adminModal) adminModal.classList.add('hidden'); if (e.target == historyModal) historyModal.classList.add('hidden'); });
    newReportBtn.addEventListener('click', createNewReport);
    logoutBtn.addEventListener('click', async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = '/login'; });

    confirmBtn.addEventListener('click', async () => {
        const isUpdating = state.currentReport.id && state.isEditMode;
        const url = isUpdating ? `/api/reports/${state.currentReport.id}` : '/api/reports';
        const method = isUpdating ? 'PUT' : 'POST';
        if (!datePicker.value) { showToast("Iltimos, hisobot sanasini tanlang!", true); return; }
        const reportData = { date: datePicker.value, location: locationSelect.value, data: state.currentReport.data, settings: state.settings.app_settings };
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
    
    // Qidiruv va Filtr hodisalari
    searchInput.addEventListener('input', renderSavedReports);
    filterButtonsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            filterButtonsContainer.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            state.activeFilter = e.target.dataset.filter;
            renderSavedReports();
        }
    });

    // --- Admin Paneli Hodisalari ---
    document.getElementById('save-table-settings-btn').addEventListener('click', async () => {
        const newSettings = { columns: [], rows: [], locations: [] };
        document.querySelectorAll('#admin-panel-body .table-settings-grid .setting-item').forEach(item => {
            const type = item.dataset.type;
            const newName = item.querySelector('.setting-name-input').value.trim();
            if (newName) newSettings[type + 's'].push(newName);
        });
        try {
            const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'app_settings', value: newSettings }) });
            if (!res.ok) throw new Error((await res.json()).message);
            showToast("Jadval sozlamalari saqlandi!");
            state.settings.app_settings = newSettings;
            adminModal.classList.add('hidden');
            populateLocations();
            createNewReport();
        } catch (error) { showToast(error.message, true); }
    });

    document.getElementById('save-telegram-btn').addEventListener('click', async () => {
        const token = document.getElementById('bot-token').value.trim();
        const groupId = document.getElementById('group-id').value.trim();
        try {
            await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'telegram_bot_token', value: token }) });
            await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'telegram_group_id', value: groupId }) });
            showToast("Telegram sozlamalari saqlandi!");
            state.settings.telegram_bot_token = token;
            state.settings.telegram_group_id = groupId;
        } catch (error) { showToast("Telegram sozlamalarini saqlashda xatolik!", true); }
    });

    document.getElementById('add-user-btn').addEventListener('click', async () => {
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value.trim();
        const role = document.getElementById('new-user-role').value;
        const selectedLocations = Array.from(document.querySelectorAll('#locations-checkbox-list input:checked')).map(cb => cb.value);
        if (!username || !password) { showToast("Login va parol kiritilishi shart!", true); return; }
        if (role === 'operator' && selectedLocations.length === 0) { showToast("Operator uchun kamida bitta filial tanlanishi shart!", true); return; }
        try {
            const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, role, locations: selectedLocations }) });
            if (!res.ok) throw new Error((await res.json()).message);
            showToast("Foydalanuvchi qo'shildi!");
            await populateAdminModal();
            document.getElementById('new-username').value = '';
            document.getElementById('new-password').value = '';
        } catch (error) { showToast(error.message, true); }
    });

    document.getElementById('new-user-role').addEventListener('change', (e) => { document.getElementById('new-user-locations-group').style.display = e.target.value === 'operator' ? 'block' : 'none'; });
    
    document.getElementById('user-list').addEventListener('click', async (e) => {
        const target = e.target;
        const userId = target.dataset.id;
        if (!userId) return;
        if (target.classList.contains('delete-user-btn')) {
            if (confirm("Rostdan ham bu foydalanuvchini o'chirmoqchimisiz?")) {
                try {
                    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error((await res.json()).message);
                    showToast("Foydalanuvchi o'chirildi.");
                    await populateAdminModal();
                } catch (error) { showToast(error.message, true); }
            }
        } else if (target.classList.contains('reset-password-btn')) {
            const newPassword = prompt("Yangi parolni kiriting (kamida 4 belgi):");
            if (newPassword && newPassword.length >= 4) {
                try {
                    const res = await fetch(`/api/users/${userId}/password`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword }) });
                    if (!res.ok) throw new Error((await res.json()).message);
                    showToast("Parol muvaffaqiyatli yangilandi.");
                } catch (error) { showToast(error.message, true); }
            } else if (newPassword) {
                showToast("Parol juda qisqa!", true);
            }
        }
    });

    init();
});
