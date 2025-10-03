document.addEventListener('DOMContentLoaded', () => {
    // --- Global Holat (State) va DOM Elementlari ---
    const state = {
<<<<<<< HEAD
        settings: { app_settings: { columns: [], rows: [], locations: [] }, pagination_limit: 20 },
        users: [],
        roles: [],
        allPermissions: {},
        currentUser: null,
        pivotGrid: null,
        pivotTemplates: [],
        // Add history state
        history: {
            data: [],
            currentPage: 1,
            itemsPerPage: 10,
            totalItems: 0
        }
=======
        settings: { app_settings: { columns: [], rows: [], locations: [] } },
        users: [],
        allReports: {},
        currentUser: null,
        pivotGrid: null,
        pivotTemplates: [],
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
    };

    const DOM = {
        body: document.body,
        sidebarNav: document.querySelector('.sidebar-nav'),
        pages: document.querySelectorAll('.page'),
<<<<<<< HEAD
        logoutBtn: document.getElementById('logout-btn'),
        // Dashboard
        statsGrid: document.getElementById('stats-grid'),
        dailyStatusGrid: document.getElementById('daily-status-grid'),
        dashboardDatePicker: document.getElementById('dashboard-date-picker'),
        // Foydalanuvchilar
        userList: document.getElementById('user-list'),
        openAddUserModalBtn: document.getElementById('open-add-user-modal-btn'),
        userFormModal: document.getElementById('user-form-modal'),
        userForm: document.getElementById('user-form'),
        userModalTitle: document.getElementById('user-modal-title'),
        editUserIdInput: document.getElementById('edit-user-id'),
        usernameInput: document.getElementById('user-username'),
        passwordInput: document.getElementById('user-password'),
        passwordGroup: document.getElementById('password-group'),
        userRoleSelect: document.getElementById('user-role'),
        deviceLimitInput: document.getElementById('user-device-limit'),
        userLocationsGroup: document.getElementById('user-locations-group'),
        locationsCheckboxList: document.getElementById('locations-checkbox-list'),
        // Sessiyalar
        sessionsModal: document.getElementById('sessions-modal'),
        sessionsModalTitle: document.getElementById('sessions-modal-title'),
        sessionsListContainer: document.getElementById('sessions-list-container'),
        // Rollar
        rolesContainer: document.getElementById('roles-container'),
        // Sozlamalar
        accordionContainer: document.querySelector('.accordion-container'),
        saveTableSettingsBtn: document.getElementById('save-table-settings-btn'),
        saveTelegramBtn: document.getElementById('save-telegram-btn'),
        botTokenInput: document.getElementById('bot-token'),
        groupIdInput: document.getElementById('group-id'),
        paginationLimitInput: document.getElementById('pagination-limit'),
        saveGeneralSettingsBtn: document.getElementById('save-general-settings-btn'),
        // Pivot
        pivotContainer: document.getElementById('pivot-container'),
=======
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
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
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

<<<<<<< HEAD
    let dashboardDatePickerFP = null;

    // --- Yordamchi Funksiya ---
    const showToast = (message, isError = false) => {
        if (!DOM.toast) return;
        DOM.toast.textContent = message;
        DOM.toast.className = `toast ${isError ? 'error' : ''}`;
        setTimeout(() => { DOM.toast.className = `toast ${isError ? 'error' : ''} hidden`; }, 3000);
    };

    // --- Admin Boshqaruvi uchun funksiyalar ---
    async function loadHistory() {
        try {
            const response = await fetch(`/api/history?page=${state.history.currentPage}&limit=${state.history.itemsPerPage}`);
            if (!response.ok) throw new Error('Tarix ma\'lumotlarini yuklashda xatolik');
            
            const data = await response.json();
            state.history.data = data.items || [];
            state.history.totalItems = data.total || 0;
            
            if (document.querySelector('#admin-controls.page.active')) {
                renderHistory();
            }
        } catch (error) {
            console.error('Error loading history:', error);
            showToast('Tarix ma\'lumotlarini yuklashda xatolik', true);
        }
    }
    
    function renderHistory() {
        const tbody = document.getElementById('history-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        state.history.data.forEach((item, index) => {
            const row = document.createElement('tr');
            const rowNum = (state.history.currentPage - 1) * state.history.itemsPerPage + index + 1;
            
            const formatValue = (value) => {
                if (value === null || value === undefined) return '-';
                if (typeof value === 'object') return JSON.stringify(value);
                // Format numbers with thousand separators
                if (!isNaN(value) && value !== '') {
                    return parseFloat(value).toLocaleString('ru-RU');
                }
                return value.toString();
            };
            
            // Only show rows where values actually changed
            if (item.old_value !== item.new_value) {
                row.innerHTML = `
                    <td>${rowNum}</td>
                    <td>${new Date(item.changed_at).toLocaleString()}</td>
                    <td>${item.location || '-'}</td>
                    <td>${item.field ? item.field.replace(/_/g, ' ') : '-'}</td>
                    <td class="old-value" style="color: #dc3545; text-decoration: line-through;">${formatValue(item.old_value)}</td>
                    <td class="new-value" style="color: #28a745; font-weight: 500;">${formatValue(item.new_value)}</td>
                    <td>${item.changed_by_username || '-'}</td>
                `;
                
                tbody.appendChild(row);
            }
        });
        
        // Update pagination info
        const pageInfo = document.getElementById('page-info');
        if (pageInfo) {
            const maxPage = Math.ceil(state.history.totalItems / state.history.itemsPerPage) || 1;
            pageInfo.textContent = `${state.history.currentPage} / ${maxPage}`;
            
            // Update button states
            const prevBtn = document.getElementById('prev-page');
            const nextBtn = document.getElementById('next-page');
            
            if (prevBtn) prevBtn.disabled = state.history.currentPage <= 1;
            if (nextBtn) nextBtn.disabled = state.history.currentPage >= maxPage;
        }
    }
    
    function setupAdminControls() {
        // Glow speed controls
        document.querySelectorAll('.glow-speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const speed = e.target.dataset.speed;
                document.querySelectorAll('.glow-speed-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update glow speed
                const brandLogos = document.querySelectorAll('.brand-logo');
                brandLogos.forEach(logo => {
                    logo.className = logo.className.replace(/glow-(slow|medium|fast)/g, '').trim();
                    if (speed !== 'medium') { // medium is default
                        logo.classList.add(`glow-${speed}`);
                    }
                    
                    // Update animation duration
                    const duration = speed === 'slow' ? 3 : speed === 'fast' ? 1 : 2;
                    logo.style.animationDuration = `${duration}s`;
                });
                
                // Save preference
                localStorage.setItem('glowSpeed', speed);
            });
        });
        
        // Clear cache button
        const clearCacheBtn = document.getElementById('clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch('/api/admin/clear-cache', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (response.ok) {
                        showToast('Kesh tozalandi');
                    } else {
                        throw new Error('Kesh tozalashda xatolik');
                    }
                } catch (error) {
                    console.error('Error clearing cache:', error);
                    showToast('Xatolik yuz berdi', true);
                }
            });
        }
        
        // History pagination
        const prevPageBtn = document.getElementById('prev-page');
        const nextPageBtn = document.getElementById('next-page');
        
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (state.history.currentPage > 1) {
                    state.history.currentPage--;
                    loadHistory();
                }
            });
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                const maxPage = Math.ceil(state.history.totalItems / state.history.itemsPerPage);
                if (state.history.currentPage < maxPage) {
                    state.history.currentPage++;
                    loadHistory();
                }
            });
        }
        
        // Load saved glow speed preference
        const savedSpeed = localStorage.getItem('glowSpeed') || 'medium';
        const speedBtn = document.querySelector(`.glow-speed-btn[data-speed="${savedSpeed}"]`);
        if (speedBtn) speedBtn.click();
    }

    // --- Asosiy Funksiya (Initialization) ---
    async function init() {
        try {
=======
    // --- Asosiy Funksiya (Initialization) ---
    async function init() {
        try {
            // 1. Avval joriy foydalanuvchini tekshiramiz
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
            const userRes = await fetch('/api/current-user');
            if (!userRes.ok) {
                window.location.href = '/login';
                return;
            }
            state.currentUser = await userRes.json();
<<<<<<< HEAD
            
            applyPermissions();

            const dataSources = [
                { key: 'settings', url: '/api/settings', permission: 'settings:view' },
                { key: 'users', url: '/api/users', permission: 'users:view' },
                { key: 'allReports', url: '/api/reports?limit=10000', permission: 'reports:view_all', transform: d => d.reports },
                { key: 'pivotTemplates', url: '/api/pivot-templates', permission: 'reports:view_all' },
                { key: 'rolesData', url: '/api/roles', permission: 'roles:manage' }
            ];

            const results = await Promise.all(dataSources.map(ds => fetchWithPermission(ds.url, ds.permission)));
            
            results.forEach((data, index) => {
                const { key, transform } = dataSources[index];
                if (data) {
                    if (key === 'rolesData') {
                        state.roles = data.roles;
                        state.allPermissions = data.all_permissions;
                    } else {
                        state[key] = transform ? transform(data) : data;
                    }
                }
            });

            // Load history if user has admin:manage permission
            if (state.currentUser.permissions.includes('admin:manage')) {
                await loadHistory();
            }

            renderAllComponents();
            setupEventListeners();
            setupAdminControls(); // Setup admin controls
=======

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
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
            feather.replace();

        } catch (error) {
            showToast("Sahifani yuklashda jiddiy xatolik yuz berdi.", true);
            console.error("Initialization Error:", error);
        }
    }

<<<<<<< HEAD
    // --- Huquqlarni Boshqarish ---
    function applyPermissions() {
        const userPermissions = state.currentUser.permissions || [];
        document.querySelectorAll('[data-permission]').forEach(el => {
            const requiredPermission = el.dataset.permission;
            if (!userPermissions.includes(requiredPermission)) {
                el.style.display = 'none';
            }
        });
    }

    async function fetchWithPermission(url, permission) {
        if (state.currentUser.permissions.includes(permission)) {
            try {
                const res = await fetch(url);
                return res.ok ? await res.json() : null;
            } catch {
                return null;
            }
        }
        return null;
    }

    // --- Komponentlarni Chizish (Render) Funksiyalari ---
    function renderAllComponents() {
        if (DOM.statsGrid) renderDashboardStats();
        if (DOM.userList) renderUsers();
        if (DOM.accordionContainer) renderTableSettings();
        if (DOM.paginationLimitInput) renderGeneralSettings();
        if (DOM.botTokenInput) renderTelegramSettings();
        if (DOM.pivotContainer) renderPivotGrid();
        if (DOM.rolesContainer) renderRoles();
        if (document.querySelector('#admin-controls.page.active')) {
            renderHistory();
        }
    }

    function renderDashboardStats() {
        if (!state.users || !state.settings.app_settings || !state.allReports) return;
=======
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
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
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
<<<<<<< HEAD
            </div>
             <div class="stat-card">
                <div class="stat-icon" style="background-color: rgba(255, 193, 7, 0.1);"><i data-feather="file-text" style="color: #ffc107;"></i></div>
                <div class="stat-info">
                    <span class="stat-label">Jami Hisobotlar</span>
                    <span class="stat-value">${Object.keys(state.allReports).length}</span>
                </div>
=======
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
            </div>`;
        feather.replace();
    }

<<<<<<< HEAD
    async function renderDailyStatus(date) {
        if (!DOM.dailyStatusGrid) return;
        DOM.dailyStatusGrid.innerHTML = '<div class="skeleton-item" style="grid-column: 1 / -1;"></div>';
        try {
            const res = await fetch(`/api/dashboard/status?date=${date}`);
            if (!res.ok) throw new Error('Statusni yuklab bo\'lmadi');
            const data = await res.json();
            DOM.dailyStatusGrid.innerHTML = data.map(item => `
                <div class="status-card ${item.submitted ? 'submitted' : 'not-submitted'}">
                    ${item.name}
                </div>
            `).join('');
        } catch (error) {
            DOM.dailyStatusGrid.innerHTML = `<div class="empty-state error" style="grid-column: 1 / -1;">${error.message}</div>`;
        }
    }

    function renderUsers() {
        if (!state.users) return;
        DOM.userList.innerHTML = state.users.length === 0
            ? '<div class="empty-state">Foydalanuvchilar topilmadi.</div>'
            : state.users.map(user => {
                const locationsText = user.locations.join(', ') || 'Filial biriktirilmagan';
                const statusClass = user.is_online ? 'online' : 'offline';
                const statusText = user.is_online 
                    ? '<span class="online-text">Onlayn</span>' 
                    : `<span>${user.last_activity ? 'Oxirgi faollik: ' + new Date(user.last_activity).toLocaleString() : 'Oflayn'}</span>`;

                return `
                <div class="user-item ${!user.is_active ? 'inactive' : ''}">
                    <div class="user-avatar">
                        <i data-feather="user"></i>
                        <div class="status-indicator ${statusClass}"></div>
                    </div>
                    <div class="user-details">
                        <div class="username">${user.username}</div>
                        <div class="user-meta">
                            <span class="role">${user.role}</span> | <span>${locationsText}</span>
                        </div>
                        <div class="user-status">${statusText}</div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-icon manage-sessions-btn" data-id="${user.id}" data-username="${user.username}" title="Aktiv sessiyalar (${user.active_sessions_count})" data-permission="users:manage_sessions"><i data-feather="monitor"></i></button>
                        <button class="btn-icon edit-user-btn" data-id="${user.id}" title="Tahrirlash" data-permission="users:edit"><i data-feather="edit-2"></i></button>
                        ${state.currentUser.id !== user.id ? (user.is_active
                            ? `<button class="btn-icon deactivate-user-btn" data-id="${user.id}" title="Bloklash" data-permission="users:change_status"><i data-feather="eye-off"></i></button>`
                            : `<button class="btn-icon activate-user-btn" data-id="${user.id}" title="Aktivlashtirish" data-permission="users:change_status"><i data-feather="eye"></i></button>`
                        ) : ''}
                    </div>
                </div>`;
            }).join('');
        feather.replace();
        applyPermissions();
    }

    function renderRoles() {
        if (!state.roles || !state.allPermissions) return;
        DOM.rolesContainer.innerHTML = state.roles.map(role => {
            let permissionsHtml = '';
            for (const category in state.allPermissions) {
                permissionsHtml += `
                    <div class="permission-category">
                        <h4 class="permission-category-title">${category}</h4>
                        <div class="permission-list">
                            ${state.allPermissions[category].map(perm => `
                                <label class="permission-item">
                                    <input type="checkbox" value="${perm.key}" ${role.permissions.includes(perm.key) ? 'checked' : ''}>
                                    <span>${perm.description}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>`;
            }
            return `
                <div class="card role-card" data-role="${role.role_name}">
                    <h3 class="card-title" style="text-transform: capitalize;">${role.role_name}</h3>
                    <div class="permissions-wrapper" style="flex-grow: 1;">${permissionsHtml}</div>
                    <div class="role-footer">
                        <button class="btn btn-primary save-role-btn" data-role="${role.role_name}">Huquqlarni Saqlash</button>
                    </div>
                </div>`;
        }).join('');
=======
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
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
    }

    function renderTableSettings() {
        const { columns = [], rows = [], locations = [] } = state.settings.app_settings || {};
<<<<<<< HEAD
        const renderList = (containerId, items) => {
            const container = document.getElementById(containerId);
            if (container) container.innerHTML = items.map(item => `<div class="setting-item" data-name="${item}"><span class="setting-name">${item}</span><button class="delete-item-btn btn-icon"><i data-feather="x"></i></button></div>`).join('');
        };
        renderList('columns-settings', columns);
        renderList('rows-settings', rows);
        renderList('locations-settings', locations);
        if (DOM.locationsCheckboxList) DOM.locationsCheckboxList.innerHTML = locations.map(loc => `<label class="checkbox-item"><input type="checkbox" name="user-locations" value="${loc}"><span>${loc}</span></label>`).join('');
        feather.replace();
    }

    function renderGeneralSettings() {
        if (DOM.paginationLimitInput) DOM.paginationLimitInput.value = state.settings.pagination_limit || 20;
    }

    function renderTelegramSettings() {
        if (DOM.botTokenInput) DOM.botTokenInput.value = state.settings.telegram_bot_token || '';
        if (DOM.groupIdInput) DOM.groupIdInput.value = state.settings.telegram_group_id || '';
    }

    function prepareDataForPivot() {
        if (!state.allReports) return [];
=======
        
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
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
        const flatData = [];
        Object.values(state.allReports).forEach(report => {
            for (const key in report.data) {
                const value = report.data[key];
                if (value > 0) {
                    const [rowName, ...colParts] = key.split('_');
                    const colName = colParts.join('_');
                    flatData.push({
                        "ID": report.id, "Sana": report.date, "Filial": report.location,
<<<<<<< HEAD
                        "Ko'rsatkich": rowName, "To'lov turi": colName, "Summa": value,
                        "Izoh": report.late_comment || ""
=======
                        "Ko'rsatkich": rowName, "To'lov turi": colName, "Summa": value
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
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
<<<<<<< HEAD
        if (!DOM.templateListContainer) return;
        DOM.templateListContainer.innerHTML = state.pivotTemplates.length === 0
            ? '<div class="empty-state" style="border:none; padding: 20px 0;">Shablonlar mavjud emas.</div>'
            : state.pivotTemplates.map(template => {
                const canDelete = state.currentUser.role === 'admin' || state.currentUser.id === template.created_by;
                return `
                <div class="template-item">
                    <span class="template-name">${template.name}</span>
                    <div class="template-actions">
                        <button class="btn-icon load-btn" data-id="${template.id}" title="Yuklash"><i data-feather="download"></i></button>
                        ${canDelete ? `<button class="btn-icon delete-btn" data-id="${template.id}" title="O'chirish"><i data-feather="trash-2"></i></button>` : ''}
                    </div>
                </div>`;
            }).join('');
=======
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
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
        feather.replace();
    }

    // --- Hodisalarni Sozlash (Event Listeners) ---
    function setupEventListeners() {
<<<<<<< HEAD
        const addSafeListener = (element, event, handler) => {
            if (element) element.addEventListener(event, handler);
        };

        addSafeListener(DOM.sidebarNav, 'click', handleNavigation);
        addSafeListener(DOM.logoutBtn, 'click', handleLogout);
        
        if (DOM.dashboardDatePicker) {
            dashboardDatePickerFP = flatpickr(DOM.dashboardDatePicker, {
                defaultDate: "today", dateFormat: "Y-m-d",
                onChange: (selectedDates) => renderDailyStatus(selectedDates[0] ? flatpickr.formatDate(selectedDates[0], 'Y-m-d') : '')
            });
            renderDailyStatus(flatpickr.formatDate(new Date(), 'Y-m-d'));
        }

        addSafeListener(DOM.openAddUserModalBtn, 'click', openUserModalForAdd);
        addSafeListener(DOM.userForm, 'submit', handleUserFormSubmit);
        addSafeListener(DOM.userList, 'click', handleUserActions);
        addSafeListener(DOM.userRoleSelect, 'change', toggleLocationVisibility);
        addSafeListener(DOM.rolesContainer, 'click', handleRoleSave);
        addSafeListener(DOM.saveTableSettingsBtn, 'click', saveTableSettings);
        addSafeListener(DOM.accordionContainer, 'click', handleTableSettingsActions);
        addSafeListener(DOM.saveTelegramBtn, 'click', saveTelegramSettings);
        addSafeListener(DOM.saveGeneralSettingsBtn, 'click', saveGeneralSettings);
        
        document.querySelectorAll('.accordion-header').forEach(header => addSafeListener(header, 'click', toggleAccordion));
        
        addSafeListener(DOM.saveTemplateBtn, 'click', () => DOM.saveTemplateModal?.classList.remove('hidden'));
        addSafeListener(DOM.loadTemplatesBtn, 'click', () => {
            renderTemplatesList();
            DOM.loadTemplatesModal?.classList.remove('hidden');
        });
        addSafeListener(DOM.confirmSaveTemplateBtn, 'click', savePivotTemplate);
        addSafeListener(DOM.templateListContainer, 'click', handleTemplateActions);
        addSafeListener(DOM.sessionsListContainer, 'click', handleSessionTermination);

        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            addSafeListener(btn, 'click', () => document.getElementById(btn.dataset.target)?.classList.add('hidden'));
        });
    }

    // --- Hodisa Boshqaruvchilari (Event Handlers) ---
    // Bu yerdan boshlab barcha handler funksiyalar (handleLogout, handleNavigation, va hokazo)
    // o'zgarishsiz qoladi, chunki ularning ichki logikasi to'g'ri.
    // Faqat DOM elementlari mavjudligini tekshirish uchun ba'zi joylarga `?` (optional chaining) qo'shish mumkin.
    
    async function handleLogout() {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
=======
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
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
    }

    function handleNavigation(e) {
        const link = e.target.closest('.nav-link');
        if (!link) return;
        e.preventDefault();
<<<<<<< HEAD
        document.querySelectorAll('.nav-link.active').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        DOM.pages.forEach(p => p.classList.remove('active'));
        document.getElementById(link.dataset.page)?.classList.add('active');
    }

    function toggleLocationVisibility() {
        const role = DOM.userRoleSelect?.value;
        const display = (role === 'operator' || role === 'manager') ? 'block' : 'none';
        if (DOM.userLocationsGroup) DOM.userLocationsGroup.style.display = display;
    }

    function openUserModalForAdd() {
        DOM.userForm?.reset();
        if (DOM.editUserIdInput) DOM.editUserIdInput.value = '';
        if (DOM.userModalTitle) DOM.userModalTitle.textContent = 'Yangi Foydalanuvchi Qo\'shish';
        if (DOM.passwordGroup) DOM.passwordGroup.style.display = 'block';
        if (DOM.passwordInput) DOM.passwordInput.required = true;
        if (DOM.userRoleSelect) DOM.userRoleSelect.innerHTML = state.roles.map(r => `<option value="${r.role_name}">${r.role_name}</option>`).join('');
        toggleLocationVisibility();
        DOM.userFormModal?.classList.remove('hidden');
    }

    function openUserModalForEdit(userId) {
        const user = state.users.find(u => u.id == userId);
        if (!user || !DOM.userForm) return;
        DOM.userForm.reset();
        DOM.editUserIdInput.value = user.id;
        DOM.userModalTitle.textContent = `"${user.username}"ni Tahrirlash`;
        DOM.usernameInput.value = user.username;
        DOM.passwordGroup.style.display = 'none';
        DOM.passwordInput.required = false;
        DOM.userRoleSelect.innerHTML = state.roles.map(r => `<option value="${r.role_name}" ${user.role === r.role_name ? 'selected' : ''}>${r.role_name}</option>`).join('');
        DOM.deviceLimitInput.value = user.device_limit;
        
        document.querySelectorAll('#locations-checkbox-list input').forEach(cb => {
            cb.checked = user.locations.includes(cb.value);
        });
        
        toggleLocationVisibility();
        DOM.userFormModal.classList.remove('hidden');
    }

    async function handleUserFormSubmit(e) {
        e.preventDefault();
        const userId = DOM.editUserIdInput.value;
        const isEditing = !!userId;

        const data = {
            username: DOM.usernameInput.value.trim(),
            role: DOM.userRoleSelect.value,
            device_limit: parseInt(DOM.deviceLimitInput.value) || 1,
            locations: Array.from(document.querySelectorAll('#locations-checkbox-list input:checked')).map(cb => cb.value)
        };
        if (!isEditing) {
            data.password = DOM.passwordInput.value;
        }

        const url = isEditing ? `/api/users/${userId}` : '/api/users';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
=======
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
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            
<<<<<<< HEAD
            showToast(result.message);
            state.users = await (await fetch('/api/users')).json();
            renderUsers();
            renderDashboardStats();
            DOM.userFormModal.classList.add('hidden');
=======
            showToast("Foydalanuvchi muvaffaqiyatli qo'shildi!");
            state.users = await (await fetch('/api/users')).json();
            renderUsers();
            renderDashboardStats();
            DOM.addUserForm.reset();
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
        } catch (error) {
            showToast(error.message, true);
        }
    }

    async function handleUserActions(e) {
        const button = e.target.closest('button');
        if (!button) return;
        const userId = button.dataset.id;

<<<<<<< HEAD
        if (button.classList.contains('edit-user-btn')) {
            openUserModalForEdit(userId);
        } else if (button.classList.contains('deactivate-user-btn') || button.classList.contains('activate-user-btn')) {
=======
        if (button.classList.contains('deactivate-user-btn') || button.classList.contains('activate-user-btn')) {
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
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
<<<<<<< HEAD
        } else if (button.classList.contains('manage-sessions-btn')) {
            const username = button.dataset.username;
            DOM.sessionsModalTitle.textContent = `"${username}"ning Aktiv Sessiyalari`;
            DOM.sessionsListContainer.innerHTML = '<div class="skeleton-item"></div>';
            DOM.sessionsModal.classList.remove('hidden');
            try {
                const res = await fetch(`/api/users/${userId}/sessions`);
                if (!res.ok) throw new Error('Sessiyalarni yuklab bo\'lmadi');
                const sessions = await res.json();
                DOM.sessionsListContainer.innerHTML = sessions.length > 0 ? sessions.map(s => `
                    <div class="session-item ${s.is_current ? 'current' : ''}">
                        <div class="session-details">
                            <div><strong>IP Manzil:</strong> ${s.ip_address || 'Noma\'lum'}</div>
                            <div><strong>Qurilma:</strong> ${s.user_agent || 'Noma\'lum'}</div>
                            <div><strong>Oxirgi faollik:</strong> ${new Date(s.last_activity).toLocaleString()}</div>
                        </div>
                        ${!s.is_current ? `<button class="btn btn-danger btn-sm terminate-session-btn" data-sid="${s.sid}">Tugatish</button>` : '<span class="badge" style="background-color: var(--green-color);">Joriy</span>'}
                    </div>
                `).join('') : '<div class="empty-state">Aktiv sessiyalar topilmadi.</div>';
            } catch (error) {
                DOM.sessionsListContainer.innerHTML = `<div class="empty-state error">${error.message}</div>`;
=======
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
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
            }
        }
    }

<<<<<<< HEAD
    async function handleSessionTermination(e) {
        const button = e.target.closest('.terminate-session-btn');
        if (!button) return;
        const sid = button.dataset.sid;
        if (confirm("Rostdan ham bu sessiyani tugatmoqchimisiz?")) {
            try {
                const res = await fetch(`/api/sessions/${sid}`, { method: 'DELETE' });
                const result = await res.json();
                if (!res.ok) throw new Error(result.message);
                showToast(result.message);
                button.closest('.session-item').remove();
            } catch (error) {
                showToast(error.message, true);
            }
        }
    }

    async function handleRoleSave(e) {
        const button = e.target.closest('.save-role-btn');
        if (!button) return;
        const roleName = button.dataset.role;
        const roleCard = button.closest('.role-card');
        const checkedPermissions = Array.from(roleCard.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

        try {
            const res = await fetch(`/api/roles/${roleName}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions: checkedPermissions })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            showToast(result.message);
        } catch (error) {
            showToast(error.message, true);
        }
    }

=======
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
    async function saveTableSettings() {
        const newSettings = { columns: [], rows: [], locations: [] };
        document.querySelectorAll('#columns-settings .setting-name').forEach(span => newSettings.columns.push(span.textContent));
        document.querySelectorAll('#rows-settings .setting-name').forEach(span => newSettings.rows.push(span.textContent));
        document.querySelectorAll('#locations-settings .setting-name').forEach(span => newSettings.locations.push(span.textContent));
<<<<<<< HEAD
        try {
            const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'app_settings', value: newSettings }) });
            if (!res.ok) throw new Error((await res.json()).message);
=======

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'app_settings', value: newSettings })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
            showToast("Jadval sozlamalari saqlandi!");
            state.settings.app_settings = newSettings;
            renderTableSettings();
            renderDashboardStats();
<<<<<<< HEAD
        } catch (error) { showToast(error.message, true); }
    }

    function handleTableSettingsActions(e) {
        const button = e.target
    }
//... oldingi kodning davomi

function handleTableSettingsActions(e) {
    const button = e.target.closest('button');
    if (!button) return;

    if (button.classList.contains('delete-item-btn')) {
        button.closest('.setting-item').remove();
    } else if (button.id.startsWith('add-')) {
        const type = button.id.replace('add-', '').replace('-btn', ''); // 'column', 'row', 'location'
        const input = document.getElementById(`new-${type}-name`);
        const list = document.getElementById(`${type}s-settings`);
        const name = input.value.trim();
        if (name && list) {
            list.insertAdjacentHTML('beforeend', `
                <div class="setting-item" data-name="${name}">
                    <span class="setting-name">${name}</span>
                    <button class="delete-item-btn btn-icon"><i data-feather="x"></i></button>
                </div>`);
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
    } catch (error) { showToast("Sozlamalarni saqlashda xatolik!", true); }
}

async function saveGeneralSettings() {
    const limit = DOM.paginationLimitInput.value;
    try {
        await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'pagination_limit', value: limit }) });
        showToast("Umumiy sozlamalar saqlandi!");
    } catch (error) { showToast("Sozlamalarni saqlashda xatolik!", true); }
}

function toggleAccordion(e) {
    const item = e.target.closest('.accordion-item');
    if (!item) return;
    const content = item.querySelector('.accordion-content');
    if (!content) return;
    
    item.classList.toggle('active');
    content.style.maxHeight = item.classList.contains('active') ? content.scrollHeight + "px" : null;
}

async function savePivotTemplate() {
    const name = DOM.templateNameInput.value.trim();
    if (!name) return showToast("Iltimos, shablonga nom bering!", true);
    if (!state.pivotGrid) return showToast("Pivot jadval topilmadi!", true);

    const report = state.pivotGrid.getReport();
    try {
        const res = await fetch('/api/pivot-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, report }) });
        if (!res.ok) throw new Error((await res.json()).message);
        showToast("Shablon muvaffaqiyatli saqlandi!");
        state.pivotTemplates = await (await fetch('/api/pivot-templates')).json();
        DOM.saveTemplateModal.classList.add('hidden');
        DOM.templateNameInput.value = '';
    } catch (error) { showToast(error.message, true); }
}

async function handleTemplateActions(e) {
    const button = e.target.closest('button');
    if (!button) return;
    const id = button.dataset.id;

    if (button.classList.contains('load-btn')) {
        try {
            const res = await fetch(`/api/pivot-templates/${id}`);
            if (!res.ok) throw new Error((await res.json()).message);
            if (state.pivotGrid) state.pivotGrid.setReport(await res.json());
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

// Dasturni ishga tushirish
init();
=======
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
>>>>>>> 3f04ba03669e96bdec9cf7001f305cafa9f03973
});
