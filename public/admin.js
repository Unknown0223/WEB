document.addEventListener('DOMContentLoaded', async () => {
    // --- Holat (State) ---
    let state = {
        settings: { app_settings: { columns: [], rows: [], locations: [] } },
        users: [],
        allReports: {}, // Barcha hisobotlarni saqlash uchun yangi obyekt
        currentUser: null,
        pivotGrid: null, // Pivot Grid obyektini saqlash uchun
    };

    // --- Asosiy Funksiyalar ---
    async function init() {
        try {
            // Foydalanuvchi, sozlamalar, userlar va hisobotlarni parallel yuklash
            const [userRes, settingsRes, usersRes, reportsRes] = await Promise.all([
                fetch('/api/current-user'),
                fetch('/api/settings'),
                fetch('/api/users'),
                fetch('/api/reports') // Barcha hisobotlarni olish uchun yangi so'rov
            ]);

            if (!userRes.ok) {
                window.location.href = '/login';
                return;
            }
            
            state.currentUser = await userRes.json();
            state.settings = await settingsRes.json();
            state.users = await usersRes.json();
            state.allReports = await reportsRes.json();

            if (state.currentUser.role !== 'admin') {
                showToast("Bu sahifaga kirish uchun ruxsat yo'q!", true);
                setTimeout(() => { window.location.href = '/'; }, 2000);
                return;
            }

            renderAllComponents();
            setupEventListeners();
            feather.replace();

        } catch (error) {
            showToast("Ma'lumotlarni yuklashda xatolik!", true);
            console.error("Initialization Error:", error);
        }
    }

    // --- Komponentlarni Chizish (Render) Funksiyalari ---
    function renderAllComponents() {
        renderDashboardStats();
        renderUsers();
        renderTableSettings();
        renderTelegramSettings();
        renderPivotGrid(); // YANGI: Pivot jadvalni chizish funksiyasi
    }

    function renderDashboardStats() {
        document.getElementById('total-users-stat').textContent = state.users.length;
        document.getElementById('total-locations-stat').textContent = state.settings.app_settings?.locations?.length || 0;
    }

    function renderUsers() {
        const userList = document.getElementById('user-list');
        userList.innerHTML = ''; // "Skelet"ni tozalash
        
        if (state.users.length === 0) {
            userList.innerHTML = '<p class="empty-list-message">Foydalanuvchilar topilmadi.</p>';
            return;
        }

        state.users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            const locationsText = user.locations.join(', ') || user.role;
            userItem.innerHTML = `
                <div class="user-info">
                    <span class="username">${user.username}</span>
                    <span class="locations">${locationsText}</span>
                </div>
                <div class="item-actions">
                    <button class="reset-password-btn" data-id="${user.id}" title="Parolni o'zgartirish"><i data-feather="key"></i></button>
                    ${state.currentUser.id !== user.id ? `<button class="delete-user-btn" data-id="${user.id}" title="O'chirish"><i data-feather="trash-2"></i></button>` : ''}
                </div>
            `;
            userList.appendChild(userItem);
        });
        feather.replace();
    }

    function renderTableSettings() {
        const appSettings = state.settings.app_settings || { columns: [], rows: [], locations: [] };
        const createSettingItem = (name) => `
            <div class="setting-item">
                <input type="text" value="${name}" class="setting-name-input">
                <div class="item-actions">
                    <button class="delete-item-btn"><i data-feather="x"></i></button>
                </div>
            </div>`;
        
        document.getElementById('columns-settings').innerHTML = (appSettings.columns || []).map(createSettingItem).join('');
        document.getElementById('rows-settings').innerHTML = (appSettings.rows || []).map(createSettingItem).join('');
        document.getElementById('locations-settings').innerHTML = (appSettings.locations || []).map(createSettingItem).join('');
        
        const locationsCheckboxList = document.getElementById('locations-checkbox-list');
        locationsCheckboxList.innerHTML = '';
        (appSettings.locations || []).forEach(loc => {
            locationsCheckboxList.innerHTML += `<label class="checkbox-item"><input type="checkbox" name="user-locations" value="${loc}"> ${loc}</label>`;
        });

        feather.replace();
    }

    function renderTelegramSettings() {
        document.getElementById('bot-token').value = state.settings.telegram_bot_token || '';
        document.getElementById('group-id').value = state.settings.telegram_group_id || '';
    }

    // YORDAMCHI FUNKSIYA: Ma'lumotlarni Pivot Grid uchun tayyorlash
    function prepareDataForPivot() {
        const flatData = [];
        const reportsArray = Object.values(state.allReports);

        reportsArray.forEach(report => {
            for (const key in report.data) {
                const value = report.data[key];
                if (value > 0) {
                    const parts = key.split('_');
                    const rowName = parts[0];
                    const colName = parts.slice(1).join('_');

                    flatData.push({
                        "ID": report.id,
                        "Sana": report.date,
                        "Filial": report.location,
                        "Ko'rsatkich": rowName,
                        "To'lov turi": colName,
                        "Summa": value
                    });
                }
            }
        });
        return flatData;
    }

    // YANGI FUNKSIYA: Pivot Gridni chizish
    function renderPivotGrid() {
        if (state.pivotGrid) {
            state.pivotGrid.dispose();
        }
        
        const pivotData = prepareDataForPivot();

        state.pivotGrid = new WebDataRocks({
            container: "#pivot-container",
            toolbar: true,
            report: {
                dataSource: {
                    data: pivotData
                },
                slice: {
                    rows: [{ uniqueName: "Filial" }, { uniqueName: "Ko'rsatkich" }],
                    columns: [{ uniqueName: "To'lov turi" }],
                    measures: [{ uniqueName: "Summa", aggregation: "sum" }]
                },
                options: {
                    grid: {
                        title: "Hisobotlar Jamlanmasi",
                        showTotals: "on",
                        showGrandTotals: "on"
                    }
                },
                formats: [{
                    name: "",
                    thousandsSeparator: " ",
                    decimalPlaces: 0,
                    currencySymbol: " so'm",
                    currencySymbolAlign: "right"
                }]
            },
            reportcomplete: function() {
                state.pivotGrid.expandAllData();
            }
        });
    }

    // --- Hodisalarni Sozlash ---
    function setupEventListeners() {
        document.querySelector('.sidebar-nav').addEventListener('click', handleNavigation);
        document.getElementById('add-user-btn').addEventListener('click', addUser);
        document.getElementById('user-list').addEventListener('click', handleUserActions);
        document.getElementById('new-user-role').addEventListener('change', (e) => {
            document.getElementById('new-user-locations-group').style.display = e.target.value === 'operator' ? 'block' : 'none';
        });
        document.getElementById('save-table-settings-btn').addEventListener('click', saveTableSettings);
        document.querySelector('.table-settings-grid').addEventListener('click', handleTableSettingsActions);
        document.getElementById('save-telegram-btn').addEventListener('click', saveTelegramSettings);
    }

    // --- Hodisa Boshqaruvchilari (Event Handlers) ---
    function handleNavigation(e) {
        const link = e.target.closest('.nav-link');
        if (!link) return;

        e.preventDefault();
        const pageId = link.dataset.page;

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    }

    async function addUser() {
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value.trim();
        const role = document.getElementById('new-user-role').value;
        const locations = Array.from(document.querySelectorAll('#locations-checkbox-list input:checked')).map(cb => cb.value);

        if (!username || !password) return showToast("Login va parol kiritilishi shart!", true);
        if (role === 'operator' && locations.length === 0) return showToast("Operator uchun kamida bitta filial tanlanishi shart!", true);

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role, locations })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            
            showToast("Foydalanuvchi muvaffaqiyatli qo'shildi!");
            state.users = await (await fetch('/api/users')).json();
            renderUsers();
            renderDashboardStats();
            document.getElementById('new-username').value = '';
            document.getElementById('new-password').value = '';
        } catch (error) {
            showToast(error.message, true);
        }
    }

    async function handleUserActions(e) {
        const button = e.target.closest('button');
        if (!button) return;
        const userId = button.dataset.id;

        if (button.classList.contains('delete-user-btn')) {
            if (confirm("Rostdan ham bu foydalanuvchini o'chirmoqchimisiz?")) {
                try {
                    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error((await res.json()).message);
                    showToast("Foydalanuvchi o'chirildi.");
                    state.users = state.users.filter(u => u.id != userId);
                    renderUsers();
                    renderDashboardStats();
                } catch (error) { showToast(error.message, true); }
            }
        } else if (button.classList.contains('reset-password-btn')) {
            const newPassword = prompt("Yangi parolni kiriting (kamida 4 belgi):");
            if (newPassword && newPassword.length >= 4) {
                try {
                    const res = await fetch(`/api/users/${userId}/password`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ newPassword })
                    });
                    if (!res.ok) throw new Error((await res.json()).message);
                    showToast("Parol muvaffaqiyatli yangilandi.");
                } catch (error) { showToast(error.message, true); }
            } else if (newPassword) {
                showToast("Parol juda qisqa!", true);
            }
        }
    }

    async function saveTableSettings() {
        const newSettings = { columns: [], rows: [], locations: [] };
        document.querySelectorAll('#columns-settings .setting-item input').forEach(input => newSettings.columns.push(input.value.trim()));
        document.querySelectorAll('#rows-settings .setting-item input').forEach(input => newSettings.rows.push(input.value.trim()));
        document.querySelectorAll('#locations-settings .setting-item input').forEach(input => newSettings.locations.push(input.value.trim()));

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'app_settings', value: newSettings })
            });
            if (!res.ok) throw new Error((await res.json()).message);
            showToast("Jadval sozlamalari saqlandi!");
            state.settings.app_settings = newSettings;
            renderTableSettings();
            renderDashboardStats();
        } catch (error) {
            showToast(error.message, true);
        }
    }

    function handleTableSettingsActions(e) {
        const button = e.target.closest('button');
        if (!button) return;

        if (button.classList.contains('delete-item-btn')) {
            button.closest('.setting-item').remove();
        } else if (button.id.startsWith('add-')) {
            const type = button.id.split('-')[1];
            const input = document.getElementById(`new-${type}-name`);
            const list = document.getElementById(`${type}s-settings`);
            const name = input.value.trim();
            if (name) {
                const itemHTML = `
                    <div class="setting-item">
                        <input type="text" value="${name}" class="setting-name-input">
                        <div class="item-actions">
                            <button class="delete-item-btn"><i data-feather="x"></i></button>
                        </div>
                    </div>`;
                list.insertAdjacentHTML('beforeend', itemHTML);
                input.value = '';
                feather.replace();
            }
        }
    }

    async function saveTelegramSettings() {
        const token = document.getElementById('bot-token').value.trim();
        const groupId = document.getElementById('group-id').value.trim();
        try {
            await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'telegram_bot_token', value: token }) });
            await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'telegram_group_id', value: groupId }) });
            showToast("Telegram sozlamalari saqlandi!");
            state.settings.telegram_bot_token = token;
            state.settings.telegram_group_id = groupId;
        } catch (error) {
            showToast("Telegram sozlamalarini saqlashda xatolik!", true);
        }
    }

    // --- Yordamchi Funksiyalar ---
    function showToast(message, isError = false) {
        const toast = document.getElementById('toast-notification');
        toast.textContent = message;
        toast.className = `toast ${isError ? 'error' : ''}`;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Dasturni ishga tushirish
    init();
});
