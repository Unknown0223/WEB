document.addEventListener('DOMContentLoaded', () => {
    // --- Global Holat (State) va DOM Elementlari ---
    const state = {
        settings: { app_settings: { columns: [], rows: [], locations: [] } },
        users: [],
        allReports: {},
        currentUser: null,
        pivotGrid: null,
        pivotTemplates: [],
    };

    const DOM = {
        body: document.body,
        sidebarNav: document.querySelector('.sidebar-nav'),
        pages: document.querySelectorAll('.page'),
        // Dashboard
        statsGrid: document.querySelector('#dashboard .stats-grid'),
        // Foydalanuvchilar
        userList: document.getElementById('user-list'),
        addUserForm: document.getElementById('add-user-form'),
        newUsernameInput: document.getElementById('new-username'),
        newPasswordInput: document.getElementById('new-password'),
        newUserRoleSelect: document.getElementById('new-user-role'),
        newUserLocationsGroup: document.getElementById('new-user-locations-group'),
        locationsCheckboxList: document.getElementById('locations-checkbox-list'),
        // Sozlamalar
        accordionContainer: document.querySelector('.accordion-container'),
        saveTableSettingsBtn: document.getElementById('save-table-settings-btn'),
        // Telegram
        saveTelegramBtn: document.getElementById('save-telegram-btn'),
        botTokenInput: document.getElementById('bot-token'),
        groupIdInput: document.getElementById('group-id'),
        // Pivot shablonlari
        saveTemplateBtn: document.getElementById('save-template-btn'),
        loadTemplatesBtn: document.getElementById('load-templates-btn'),
        saveTemplateModal: document.getElementById('save-template-modal'),
        loadTemplatesModal: document.getElementById('load-templates-modal'),
        confirmSaveTemplateBtn: document.getElementById('confirm-save-template-btn'),
        templateNameInput: document.getElementById('template-name-input'),
        templateListContainer: document.getElementById('template-list-container'),
        // Umumiy
        toast: document.getElementById('toast-notification'),
    };

    // --- Asosiy Funksiya (Initialization) ---
    async function init() {
        try {
            // 1. Avval joriy foydalanuvchini tekshiramiz
            const userRes = await fetch('/api/current-user');
            if (!userRes.ok) {
                window.location.href = '/login';
                return;
            }
            state.currentUser = await userRes.json();

            // Foydalanuvchi rolini body ga atribut sifatida qo'shish (CSS uchun)
            DOM.body.dataset.userRole = state.currentUser.role;

            // 2. Rolga qarab keraksiz sahifalarga kirishni cheklash
            if (state.currentUser.role !== 'admin' && state.currentUser.role !== 'manager') {
                showToast("Bu sahifaga kirish uchun ruxsat yo'q!", true);
                setTimeout(() => { window.location.href = '/'; }, 2000);
                return;
            }
            
            // 3. Qolgan barcha ma'lumotlarni parallel ravishda yuklash
            const [settingsRes, usersRes, reportsRes, templatesRes] = await Promise.all([
                fetch('/api/settings'),
                fetch('/api/users').catch(err => ({ ok: false, err })),
                fetch('/api/reports'),
                fetch('/api/pivot-templates')
            ]);

            state.settings = await settingsRes.json();
            state.allReports = await reportsRes.json();
            state.pivotTemplates = await templatesRes.json();
            if (usersRes.ok) state.users = await usersRes.json();

            // 4. Komponentlarni render qilish va hodisalarni sozlash
            renderAllComponents();
            setupEventListeners();
            feather.replace();

        } catch (error) {
            showToast("Sahifani yuklashda jiddiy xatolik yuz berdi.", true);
            console.error("Initialization Error:", error);
        }
    }

    // --- Komponentlarni Chizish (Render) Funksiyalari ---
    function renderAllComponents() {
        // Rolga qarab render qilish
        if (state.currentUser.role === 'admin') {
            renderDashboardStats();
            renderUsers();
            renderTableSettings();
            renderTelegramSettings();
        } else if (state.currentUser.role === 'manager') {
            // Menejer uchun faqat kerakli bo'limni ochish
            navigateToPage('pivot-reports');
        }
        renderPivotGrid();
    }

    function renderDashboardStats() {
        DOM.statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon" style="background-color: rgba(0, 123, 255, 0.1);"><i data-feather="users" style="color: #007bff;"></i></div>
                <div class="stat-info">
                    <span class="stat-label">Jami Foydalanuvchilar</span>
                    <span class="stat-value">${state.users.length}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background-color: rgba(40, 167, 69, 0.1);"><i data-feather="map-pin" style="color: #28a745;"></i></div>
                <div class="stat-info">
                    <span class="stat-label">Jami Filiallar</span>
                    <span class="stat-value">${state.settings.app_settings?.locations?.length || 0}</span>
                </div>
            </div>`;
        feather.replace();
    }

    function renderUsers() {
        DOM.userList.innerHTML = ''; // Skeletni tozalash
        if (state.users.length === 0) {
            DOM.userList.innerHTML = '<div class="empty-state">Foydalanuvchilar topilmadi.</div>';
            return;
        }
        state.users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = `user-item ${!user.is_active ? 'inactive' : ''}`;
            const locationsText = user.locations.join(', ') || 'Filial biriktirilmagan';
            const actionButton = user.is_active
                ? `<button class="deactivate-user-btn" data-id="${user.id}" title="Bloklash"><i data-feather="eye-off"></i></button>`
                : `<button class="activate-user-btn" data-id="${user.id}" title="Aktivlashtirish"><i data-feather="eye"></i></button>`;

            userItem.innerHTML = `
                <div class="user-info">
                    <span class="username">${user.username} <span class="user-role">(${user.role})</span></span>
                    <span class="locations">${locationsText}</span>
                </div>
                <div class="item-actions">
                    <button class="reset-password-btn" data-id="${user.id}" title="Parolni o'zgartirish"><i data-feather="key"></i></button>
                    ${state.currentUser.id !== user.id ? actionButton : ''}
                </div>`;
            DOM.userList.appendChild(userItem);
        });
        feather.replace();
    }

    function renderTableSettings() {
        const { columns = [], rows = [], locations = [] } = state.settings.app_settings || {};
        
        const renderList = (containerId, items) => {
            const container = document.getElementById(containerId);
            container.innerHTML = items.map(item => `
                <div class="setting-item" data-name="${item}">
                    <span class="setting-name">${item}</span>
                    <button class="delete-item-btn item-actions"><i data-feather="x"></i></button>
                </div>`).join('');
        };

        renderList('columns-settings', columns);
        renderList('rows-settings', rows);
        renderList('locations-settings', locations);
        
        DOM.locationsCheckboxList.innerHTML = locations.map(loc => `
            <label class="checkbox-item">
                <input type="checkbox" name="user-locations" value="${loc}">
                <span>${loc}</span>
            </label>`).join('');

        feather.replace();
    }

    function renderTelegramSettings() {
        DOM.botTokenInput.value = state.settings.telegram_bot_token || '';
        DOM.groupIdInput.value = state.settings.telegram_group_id || '';
    }

    function prepareDataForPivot() {
        // Bu funksiya o'zgarishsiz qoladi, chunki u to'g'ri ishlayapti
        const flatData = [];
        Object.values(state.allReports).forEach(report => {
            for (const key in report.data) {
                const value = report.data[key];
                if (value > 0) {
                    const [rowName, ...colParts] = key.split('_');
                    const colName = colParts.join('_');
                    flatData.push({
                        "ID": report.id, "Sana": report.date, "Filial": report.location,
                        "Ko'rsatkich": rowName, "To'lov turi": colName, "Summa": value
                    });
                }
            }
        });
        return flatData;
    }

    function renderPivotGrid() {
        if (state.pivotGrid) state.pivotGrid.dispose();
        state.pivotGrid = new WebDataRocks({
            container: "#pivot-container",
            toolbar: true,
            report: {
                dataSource: { data: prepareDataForPivot() },
                slice: {
                    rows: [{ uniqueName: "Filial" }, { uniqueName: "Ko'rsatkich" }],
                    columns: [{ uniqueName: "To'lov turi" }],
                    measures: [{ uniqueName: "Summa", aggregation: "sum" }]
                },
                options: { grid: { title: "Hisobotlar Jamlanmasi" } },
                formats: [{ name: "", thousandsSeparator: " ", decimalPlaces: 0, currencySymbol: " so'm", currencySymbolAlign: "right" }]
            },
            reportcomplete: () => state.pivotGrid.expandAllData()
        });
    }

    function renderTemplatesList() {
        DOM.templateListContainer.innerHTML = '';
        if (state.pivotTemplates.length === 0) {
            DOM.templateListContainer.innerHTML = '<div class="empty-state" style="border:none; padding: 20px 0;">Shablonlar mavjud emas.</div>';
            return;
        }
        state.pivotTemplates.forEach(template => {
            const canDelete = state.currentUser.role === 'admin' || state.currentUser.id === template.created_by;
            const item = document.createElement('div');
            item.className = 'template-item';
            item.innerHTML = `
                <span class="template-name">${template.name}</span>
                <div class="template-actions">
                    <button class="load-btn" data-id="${template.id}" title="Yuklash"><i data-feather="download"></i></button>
                    ${canDelete ? `<button class="delete-btn" data-id="${template.id}" title="O'chirish"><i data-feather="trash-2"></i></button>` : ''}
                </div>`;
            DOM.templateListContainer.appendChild(item);
        });
        feather.replace();
    }

    // --- Hodisalarni Sozlash (Event Listeners) ---
    function setupEventListeners() {
        DOM.sidebarNav.addEventListener('click', handleNavigation);
        
        // Rolga xos hodisalar
        if (state.currentUser.role === 'admin') {
            DOM.addUserForm.addEventListener('submit', handleAddUser);
            DOM.userList.addEventListener('click', handleUserActions);
            DOM.newUserRoleSelect.addEventListener('change', toggleLocationVisibility);
            DOM.saveTableSettingsBtn.addEventListener('click', saveTableSettings);
            DOM.accordionContainer.addEventListener('click', handleTableSettingsActions);
            DOM.saveTelegramBtn.addEventListener('click', saveTelegramSettings);
            document.querySelectorAll('.accordion-header').forEach(header => header.addEventListener('click', toggleAccordion));
        }
        
        // Barcha uchun hodisalar
        DOM.saveTemplateBtn.addEventListener('click', () => DOM.saveTemplateModal.classList.remove('hidden'));
        DOM.loadTemplatesBtn.addEventListener('click', () => {
            renderTemplatesList();
            DOM.loadTemplatesModal.classList.remove('hidden');
        });
        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => document.getElementById(btn.dataset.target).classList.add('hidden'));
        });
        DOM.confirmSaveTemplateBtn.addEventListener('click', savePivotTemplate);
        DOM.templateListContainer.addEventListener('click', handleTemplateActions);
    }

    // --- Hodisa Boshqaruvchilari (Event Handlers) ---
    function navigateToPage(pageId) {
        document.querySelectorAll('.nav-link.active').forEach(l => l.classList.remove('active'));
        document.querySelector(`.nav-link[data-page="${pageId}"]`)?.classList.add('active');
        DOM.pages.forEach(p => p.classList.remove('active'));
        document.getElementById(pageId)?.classList.add('active');
    }

    function handleNavigation(e) {
        const link = e.target.closest('.nav-link');
        if (!link) return;
        e.preventDefault();
        navigateToPage(link.dataset.page);
    }

    function toggleLocationVisibility() {
        const role = DOM.newUserRoleSelect.value;
        const display = (role === 'operator' || role === 'manager') ? 'block' : 'none';
        DOM.newUserLocationsGroup.style.display = display;
    }

    async function handleAddUser(e) {
        e.preventDefault();
        const username = DOM.newUsernameInput.value.trim();
        const password = DOM.newPasswordInput.value.trim();
        const role = DOM.newUserRoleSelect.value;
        const locations = Array.from(document.querySelectorAll('#locations-checkbox-list input:checked')).map(cb => cb.value);

        if (!username || !password) return showToast("Login va parol kiritilishi shart!", true);
        if (password.length < 8) return showToast("Parol kamida 8 belgidan iborat bo'lishi kerak!", true);
        if ((role === 'operator' || role === 'manager') && locations.length === 0) return showToast("Operator yoki Menejer uchun kamida bitta filial tanlanishi shart!", true);

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
            DOM.addUserForm.reset();
        } catch (error) {
            showToast(error.message, true);
        }
    }

    async function handleUserActions(e) {
        const button = e.target.closest('button');
        if (!button) return;
        const userId = button.dataset.id;

        if (button.classList.contains('deactivate-user-btn') || button.classList.contains('activate-user-btn')) {
            const is_active = button.classList.contains('activate-user-btn');
            if (confirm(`Rostdan ham bu foydalanuvchini ${is_active ? 'aktivlashtirmoqchimisiz' : 'bloklamoqchimisiz'}?`)) {
                try {
                    const res = await fetch(`/api/users/${userId}/status`, { 
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_active })
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    showToast(result.message);
                    const user = state.users.find(u => u.id == userId);
                    if (user) user.is_active = is_active;
                    renderUsers();
                } catch (error) { showToast(error.message, true); }
            }
        } else if (button.classList.contains('reset-password-btn')) {
            const newPassword = prompt("Yangi parolni kiriting (kamida 8 belgi):");
            if (newPassword && newPassword.length >= 8) {
                try {
                    const res = await fetch(`/api/users/${userId}/password`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ newPassword })
                    });
                    const result = await res.json();
                    if (!res.ok) throw new Error(result.message);
                    showToast(result.message);
                } catch (error) { showToast(error.message, true); }
            } else if (newPassword) {
                showToast("Parol juda qisqa! Kamida 8 belgi bo'lishi kerak.", true);
            }
        }
    }

    async function saveTableSettings() {
        const newSettings = { columns: [], rows: [], locations: [] };
        document.querySelectorAll('#columns-settings .setting-name').forEach(span => newSettings.columns.push(span.textContent));
        document.querySelectorAll('#rows-settings .setting-name').forEach(span => newSettings.rows.push(span.textContent));
        document.querySelectorAll('#locations-settings .setting-name').forEach(span => newSettings.locations.push(span.textContent));

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'app_settings', value: newSettings })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
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
            const type = button.id.split('-')[1]; // 'column', 'row', 'location'
            const input = document.getElementById(`new-${type}-name`);
            const list = document.getElementById(`${type}s-settings`);
            const name = input.value.trim();
            if (name) {
                const itemHTML = `
                    <div class="setting-item" data-name="${name}">
                        <span class="setting-name">${name}</span>
                        <button class="delete-item-btn item-actions"><i data-feather="x"></i></button>
                    </div>`;
                list.insertAdjacentHTML('beforeend', itemHTML);
                input.value = '';
                feather.replace();
            }
        }
    }

    async function saveTelegramSettings() {
        const token = DOM.botTokenInput.value.trim();
        const groupId = DOM.groupIdInput.value.trim();
        try {
            await Promise.all([
                fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'telegram_bot_token', value: token }) }),
                fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'telegram_group_id', value: groupId }) })
            ]);
            showToast("Telegram sozlamalari saqlandi!");
            state.settings.telegram_bot_token = token;
            state.settings.telegram_group_id = groupId;
        } catch (error) {
            showToast("Telegram sozlamalarini saqlashda xatolik!", true);
        }
    }

    function toggleAccordion(e) {
        const item = e.target.closest('.accordion-item');
        if (!item) return;
        const content = item.querySelector('.accordion-content');
        item.classList.toggle('active');
        if (item.classList.contains('active')) {
            content.style.maxHeight = content.scrollHeight + "px";
        } else {
            content.style.maxHeight = null;
        }
    }

    async function savePivotTemplate() {
        const name = DOM.templateNameInput.value.trim();
        if (!name) return showToast("Iltimos, shablonga nom bering!", true);
        
        const report = state.pivotGrid.getReport();
        try {
            const res = await fetch('/api/pivot-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, report })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            showToast("Shablon muvaffaqiyatli saqlandi!");
            state.pivotTemplates = await (await fetch('/api/pivot-templates')).json();
            DOM.saveTemplateModal.classList.add('hidden');
            DOM.templateNameInput.value = '';
        } catch (error) {
            showToast(error.message, true);
        }
    }

    async function handleTemplateActions(e) {
        const button = e.target.closest('button');
        if (!button) return;
        const id = button.dataset.id;

        if (button.classList.contains('load-btn')) {
            try {
                const res = await fetch(`/api/pivot-templates/${id}`);
                if (!res.ok) throw new Error((await res.json()).message);
                const report = await res.json();
                state.pivotGrid.setReport(report);
                DOM.loadTemplatesModal.classList.add('hidden');
                showToast("Shablon muvaffaqiyatli yuklandi.");
            } catch (error) { showToast(error.message, true); }
        } else if (button.classList.contains('delete-btn')) {
            if (confirm("Rostdan ham bu shablonni o'chirmoqchimisiz?")) {
                try {
                    const res = await fetch(`/api/pivot-templates/${id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error((await res.json()).message);
                    showToast("Shablon o'chirildi.");
                    state.pivotTemplates = state.pivotTemplates.filter(t => t.id != id);
                    renderTemplatesList();
                } catch (error) { showToast(error.message, true); }
            }
        }
    }

    // --- Yordamchi Funksiyalar ---
    function showToast(message, isError = false) {
        DOM.toast.textContent = message;
        DOM.toast.className = `toast ${isError ? 'error' : ''}`;
        setTimeout(() => {
            DOM.toast.className = `toast ${isError ? 'error' : ''} hidden`;
        }, 3000);
    }

    // Dasturni ishga tushirish
    init();
});
