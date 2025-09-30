// server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;
const PYTHON_BOT_URL = process.env.PYTHON_BOT_URL || 'http://127.0.0.1:5001/send-report';

// Middlewares
app.use(express.json( ));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-strong-and-long-secret-key-for-session',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 1 kun
}));

// Ma'lumotlar bazasi (DB)
let db;

// Asinxron IIFE (Immediately Invoked Function Expression) yordamida DB ni ishga tushirish
(async () => {
    try {
        db = await open({ filename: './database.db', driver: sqlite3.Database });
        console.log('Ma\'lumotlar bazasiga muvaffaqiyatli ulanildi.');
        await db.exec(`PRAGMA foreign_keys = ON;`);
        // Jadvallarni yaratish (agar mavjud bo'lmasa)
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'operator',
                is_active BOOLEAN DEFAULT 1 NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_locations (
                user_id INTEGER,
                location_name TEXT,
                PRIMARY KEY (user_id, location_name),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_date TEXT NOT NULL,
                location TEXT NOT NULL,
                data TEXT NOT NULL,
                settings TEXT NOT NULL,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_by INTEGER,
                updated_at DATETIME,
                FOREIGN KEY(created_by) REFERENCES users(id),
                FOREIGN KEY(updated_by) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS report_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id INTEGER NOT NULL,
                old_data TEXT NOT NULL,
                changed_by INTEGER NOT NULL,
                changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE,
                FOREIGN KEY(changed_by) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS pivot_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                report TEXT NOT NULL,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(created_by) REFERENCES users(id)
            );
        `);
        // Boshlang'ich adminni tekshirish va yaratish
        const admin = await db.get("SELECT id FROM users WHERE role = 'admin'");
        if (!admin) {
            const hashedPassword = await bcrypt.hash('admin123', saltRounds);
            await db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", 'admin', hashedPassword, 'admin');
            console.log("Boshlang'ich admin yaratildi. Login: 'admin', Parol: 'admin123'");
        }
        console.log('Barcha jadvallar tayyor.');
    } catch (err) {
        console.error("DB ni ishga tushirishda xatolik:", err.message);
    }
})();

// --- Ruxsatlarni tekshiruvchi Middlewares ---
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ message: "Avtorizatsiyadan o'tmagansiz. Iltimos, tizimga kiring." });
    }
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: "Bu amal uchun sizda admin huquqi yo'q." });
    }
};

const isManagerOrAdmin = (req, res, next) => {
    if (req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'manager')) {
        next();
    } else {
        res.status(403).json({ message: "Bu amal uchun sizda yetarli huquq yo'q." });
    }
};

// --- API Endpoints ---

// POST /api/login - Tizimga kirish
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Login va parol kiritilishi shart." });
    try {
        const user = await db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', username);
        if (!user) return res.status(401).json({ message: "Login yoki parol noto'g'ri yoki foydalanuvchi faol emas." });

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            const locations = await db.all('SELECT location_name FROM user_locations WHERE user_id = ?', user.id);
            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role,
                locations: locations.map(l => l.location_name)
            };
            // Rolga qarab yo'naltirish
            const redirectUrl = (user.role === 'admin' || user.role === 'manager') ? '/admin' : '/';
            res.json({ message: "Tizimga muvaffaqiyatli kirildi.", user: req.session.user, redirectUrl });
        } else {
            res.status(401).json({ message: "Login yoki parol noto'g'ri." });
        }
    } catch (error) {
        console.error("/api/login xatoligi:", error);
        res.status(500).json({ message: "Serverda kutilmagan xatolik yuz berdi." });
    }
});

// POST /api/logout - Tizimdan chiqish
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: "Tizimdan chiqishda xatolik." });
        res.clearCookie('connect.sid');
        res.json({ message: "Tizimdan muvaffaqiyatli chiqdingiz." });
    });
});

// GET /api/current-user - Joriy foydalanuvchi ma'lumotlari
app.get('/api/current-user', isAuthenticated, (req, res) => {
    res.json(req.session.user);
});

// GET /api/settings - Barcha sozlamalarni olish
app.get('/api/settings', isAuthenticated, async (req, res) => {
    try {
        const rows = await db.all("SELECT key, value FROM settings");
        const settings = {};
        rows.forEach(row => {
            try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
        });
        // Agar asosiy sozlamalar bo'lmasa, standart qiymatlarni berish
        if (!settings.app_settings) {
            settings.app_settings = {
                columns: ["Naqd", "Per.", "Terminal"],
                rows: ["Lalaku", "Sof", "Giga", "Arzon"],
                locations: ["Navoiy", "Toshkent", "Samarqand"]
            };
        }
        res.json(settings);
    } catch (error) {
        console.error("/api/settings GET xatoligi:", error);
        res.status(500).json({ message: "Sozlamalarni yuklashda xatolik" });
    }
});

// POST /api/settings - Sozlamalarni saqlash (faqat admin)
app.post('/api/settings', isAdmin, async (req, res) => {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ message: "Kalit (key) va qiymat (value) yuborilishi shart." });
    try {
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, JSON.stringify(value));
        res.json({ message: "Sozlamalar muvaffaqiyatli saqlandi." });
    } catch (error) {
        console.error("/api/settings POST xatoligi:", error);
        res.status(500).json({ message: "Sozlamalarni saqlashda xatolik" });
    }
});

// GET /api/reports - Hisobotlar ro'yxatini olish
app.get('/api/reports', isAuthenticated, async (req, res) => {
    try {
        const user = req.session.user;
        let query;
        let params = [];
        // O'zgarishlar sonini hisoblash uchun COUNT qo'shildi
        let baseQuery = `
            SELECT r.id, r.report_date, r.location, r.data, r.settings, COUNT(h.id) as edit_count
            FROM reports r
            LEFT JOIN report_history h ON r.id = h.report_id
        `;

        if (user.role === 'admin') {
            query = `${baseQuery} GROUP BY r.id ORDER BY r.id DESC`;
        } else { // Operator va Menejer uchun
            if (user.locations.length === 0) return res.json({}); // Agar biriktirilgan filial bo'lmasa, bo'sh ro'yxat
            const placeholders = user.locations.map(() => '?').join(',');
            query = `${baseQuery} WHERE r.location IN (${placeholders}) GROUP BY r.id ORDER BY r.id DESC`;
            params = user.locations;
        }

        const reports = await db.all(query, ...params);
        const formattedReports = {};
        reports.forEach(report => {
            formattedReports[report.id] = {
                id: report.id,
                date: report.report_date,
                location: report.location,
                data: JSON.parse(report.data),
                settings: JSON.parse(report.settings),
                edit_count: report.edit_count
            };
        });
        res.json(formattedReports);
    } catch (error) {
        console.error("/api/reports GET xatoligi:", error);
        res.status(500).json({ message: "Hisobotlarni yuklashda xatolik" });
    }
});

// POST /api/reports - Yangi hisobot yaratish
app.post('/api/reports', isAuthenticated, async (req, res) => {
    const { date, location, data, settings } = req.body;
    const user = req.session.user;

    // Operator yoki menejer faqat o'ziga biriktirilgan filialga qo'sha oladi
    if (user.role !== 'admin' && !user.locations.includes(location)) {
        return res.status(403).json({ message: "Siz faqat o'zingizga biriktirilgan filiallar uchun hisobot qo'sha olasiz." });
    }

    try {
        const result = await db.run("INSERT INTO reports (report_date, location, data, settings, created_by) VALUES (?, ?, ?, ?, ?)", date, location, JSON.stringify(data), JSON.stringify(settings), user.id);
        const newReportId = result.lastID;
        
        // Telegramga asinxron ravishda yuborish
        sendToTelegram({ type: 'new', report_id: newReportId, location, date, author: user.username, data, settings });
        
        res.status(201).json({ message: "Hisobot muvaffaqiyatli saqlandi.", reportId: newReportId });
    } catch (error) {
        console.error("/api/reports POST xatoligi:", error);
        res.status(500).json({ message: "Hisobotni saqlashda xatolik" });
    }
});

// PUT /api/reports/:id - Hisobotni tahrirlash (Admin va Menejer uchun)
app.put('/api/reports/:id', isManagerOrAdmin, async (req, res) => {
    const reportId = req.params.id;
    const { date, location, data, settings } = req.body;
    const user = req.session.user;

    try {
        const oldReport = await db.get("SELECT * FROM reports WHERE id = ?", reportId);
        if (!oldReport) return res.status(404).json({ message: "Hisobot topilmadi." });

        // Menejer faqat o'z filialidagi hisobotni tahrirlay oladi
        if (user.role === 'manager' && !user.locations.includes(oldReport.location)) {
            return res.status(403).json({ message: "Siz faqat o'zingizga biriktirilgan filialdagi hisobotni tahrirlay olasiz." });
        }

        // O'zgarishlar tarixini saqlash
        await db.run("INSERT INTO report_history (report_id, old_data, changed_by) VALUES (?, ?, ?)", reportId, oldReport.data, user.id);
        
        // Hisobotni yangilash
        await db.run(
            "UPDATE reports SET report_date = ?, location = ?, data = ?, settings = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?",
            date, location, JSON.stringify(data), JSON.stringify(settings), user.id, reportId
        );
        
        // Telegramga asinxron ravishda yuborish
        sendToTelegram({ type: 'edit', report_id: reportId, author: user.username, data, old_data: JSON.parse(oldReport.data), settings });
        
        res.json({ message: "Hisobot muvaffaqiyatli yangilandi." });
    } catch (error) {
        console.error(`/api/reports/${reportId} PUT xatoligi:`, error);
        res.status(500).json({ message: "Hisobotni yangilashda xatolik" });
    }
});

// GET /api/reports/:id/history - Hisobot tarixini olish (Admin va Menejer uchun)
app.get('/api/reports/:id/history', isManagerOrAdmin, async (req, res) => {
    try {
        const history = await db.all("SELECT h.*, u.username as changed_by_username FROM report_history h JOIN users u ON h.changed_by = u.id WHERE h.report_id = ? ORDER BY h.changed_at DESC", req.params.id);
        res.json(history);
    } catch (error) {
        console.error(`/api/reports/${req.params.id}/history GET xatoligi:`, error);
        res.status(500).json({ message: "Hisobot tarixini olishda xatolik" });
    }
});

// --- Foydalanuvchilarni boshqarish (Faqat Admin uchun) ---

// GET /api/users - Barcha foydalanuvchilarni olish (OPTIMALLASHTIRILGAN)
app.get('/api/users', isAdmin, async (req, res) => {
    try {
        // "N+1" muammosini bartaraf etish uchun JOIN va GROUP_CONCAT ishlatildi
        const users = await db.all(`
            SELECT 
                u.id, u.username, u.role, u.is_active, 
                GROUP_CONCAT(ul.location_name) as locations
            FROM users u
            LEFT JOIN user_locations ul ON u.id = ul.user_id
            GROUP BY u.id
            ORDER BY u.username
        `);
        // locations string'ini massivga o'tkazish
        users.forEach(user => {
            user.locations = user.locations ? user.locations.split(',') : [];
        });
        res.json(users);
    } catch (error) {
        console.error("/api/users GET xatoligi:", error);
        res.status(500).json({ message: "Foydalanuvchilarni olishda xatolik." });
    }
});

// POST /api/users - Yangi foydalanuvchi yaratish
app.post('/api/users', isAdmin, async (req, res) => {
    const { username, password, role, locations = [] } = req.body;
    if (!username || !password || !role) return res.status(400).json({ message: "Login, parol va rol kiritilishi shart." });
    if (password.length < 8) return res.status(400).json({ message: "Parol kamida 8 belgidan iborat bo'lishi kerak." });
    if ((role === 'operator' || role === 'manager') && locations.length === 0) {
        return res.status(400).json({ message: "Operator yoki Menejer uchun kamida bitta filial tanlanishi shart." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const result = await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', username, hashedPassword, role);
        const userId = result.lastID;

        if (role === 'operator' || role === 'manager') {
            const stmt = await db.prepare('INSERT INTO user_locations (user_id, location_name) VALUES (?, ?)');
            for (const location of locations) {
                await stmt.run(userId, location);
            }
            await stmt.finalize();
        }
        res.status(201).json({ message: "Foydalanuvchi muvaffaqiyatli qo'shildi." });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ message: "Bu nomdagi foydalanuvchi allaqachon mavjud." });
        console.error("/api/users POST xatoligi:", error);
        res.status(500).json({ message: "Foydalanuvchi qo'shishda xatolik." });
    }
});

// PUT /api/users/:id - Foydalanuvchini tahrirlash (rol, filiallar)
app.put('/api/users/:id', isAdmin, async (req, res) => {
    const userId = req.params.id;
    const { role, locations = [] } = req.body;

    if (!role) return res.status(400).json({ message: "Rol kiritilishi shart." });
    if ((role === 'operator' || role === 'manager') && locations.length === 0) {
        return res.status(400).json({ message: "Operator yoki Menejer uchun kamida bitta filial tanlanishi shart." });
    }

    try {
        // 1. Rolni yangilash
        await db.run("UPDATE users SET role = ? WHERE id = ?", role, userId);
        
        // 2. Eski filiallarini o'chirish
        await db.run("DELETE FROM user_locations WHERE user_id = ?", userId);

        // 3. Yangi filiallarini qo'shish
        if (role === 'operator' || role === 'manager') {
            const stmt = await db.prepare('INSERT INTO user_locations (user_id, location_name) VALUES (?, ?)');
            for (const location of locations) {
                await stmt.run(userId, location);
            }
            await stmt.finalize();
        }
        res.json({ message: "Foydalanuvchi ma'lumotlari muvaffaqiyatli yangilandi." });
    } catch (error) {
        console.error(`/api/users/${userId} PUT xatoligi:`, error);
        res.status(500).json({ message: "Foydalanuvchini yangilashda xatolik." });
    }
});


// PUT /api/users/:id/status - Foydalanuvchi holatini (aktiv/passiv) o'zgartirish
app.put('/api/users/:id/status', isAdmin, async (req, res) => {
    const userId = req.params.id;
    const { is_active } = req.body;
    if (Number(userId) === req.session.user.id) return res.status(403).json({ message: "Siz o'zingizning holatingizni o'zgartira olmaysiz." });

    try {
        await db.run("UPDATE users SET is_active = ? WHERE id = ?", is_active ? 1 : 0, userId);
        const message = is_active ? "Foydalanuvchi muvaffaqiyatli aktivlashtirildi." : "Foydalanuvchi muvaffaqiyatli bloklandi.";
        res.json({ message });
    } catch (error) {
        console.error(`/api/users/${userId}/status PUT xatoligi:`, error);
        res.status(500).json({ message: "Foydalanuvchi holatini o'zgartirishda xatolik." });
    }
});

// PUT /api/users/:id/password - Foydalanuvchi parolini o'zgartirish
app.put('/api/users/:id/password', isAdmin, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: "Yangi parol kamida 8 belgidan iborat bo'lishi kerak." });
    try {
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        await db.run("UPDATE users SET password = ? WHERE id = ?", hashedPassword, req.params.id);
        res.json({ message: "Parol muvaffaqiyatli yangilandi." });
    } catch (error) {
        console.error(`/api/users/${req.params.id}/password PUT xatoligi:`, error);
        res.status(500).json({ message: "Parolni yangilashda xatolik." });
    }
});

// --- Pivot Hisobot Shablonlari ---
app.get('/api/pivot-templates', isManagerOrAdmin, async (req, res) => {
    try {
        const templates = await db.all("SELECT id, name, created_by FROM pivot_templates");
        res.json(templates);
    } catch (error) { res.status(500).json({ message: "Shablonlarni yuklashda xatolik", error: error.message }); }
});
app.post('/api/pivot-templates', isManagerOrAdmin, async (req, res) => {
    const { name, report } = req.body;
    if (!name || !report) return res.status(400).json({ message: "Shablon nomi va hisobot ma'lumoti yuborilishi shart." });
    try {
        await db.run("INSERT INTO pivot_templates (name, report, created_by) VALUES (?, ?, ?)", name, JSON.stringify(report), req.session.user.id);
        res.status(201).json({ message: "Shablon muvaffaqiyatli saqlandi." });
    } catch (error) { res.status(500).json({ message: "Shablonni saqlashda xatolik", error: error.message }); }
});
app.delete('/api/pivot-templates/:id', isManagerOrAdmin, async (req, res) => {
    try {
        const template = await db.get("SELECT created_by FROM pivot_templates WHERE id = ?", req.params.id);
        if (!template) return res.status(404).json({ message: "Shablon topilmadi." });
        if (req.session.user.role !== 'admin' && template.created_by !== req.session.user.id) {
            return res.status(403).json({ message: "Siz faqat o'zingiz yaratgan shablonlarni o'chira olasiz." });
        }
        await db.run("DELETE FROM pivot_templates WHERE id = ?", req.params.id);
        res.json({ message: "Shablon muvaffaqiyatli o'chirildi." });
    } catch (error) { res.status(500).json({ message: "Shablonni o'chirishda xatolik", error: error.message }); }
});
app.get('/api/pivot-templates/:id', isManagerOrAdmin, async (req, res) => {
    try {
        const template = await db.get("SELECT report FROM pivot_templates WHERE id = ?", req.params.id);
        if (!template) return res.status(404).json({ message: "Shablon topilmadi." });
        res.json(JSON.parse(template.report));
    } catch (error) { res.status(500).json({ message: "Shablonni olishda xatolik", error: error.message }); }
});


// --- Yordamchi Funksiyalar ---

// Telegramga xabar yuborish funksiyasi (ASINXRON)
async function sendToTelegram(payload) {
    try {
        const tokenSetting = await db.get("SELECT value FROM settings WHERE key = 'telegram_bot_token'");
        const groupIdSetting = await db.get("SELECT value FROM settings WHERE key = 'telegram_group_id'");
        
        const token = tokenSetting ? JSON.parse(tokenSetting.value) : null;
        const groupId = groupIdSetting ? JSON.parse(groupIdSetting.value) : null;

        if (!token || !groupId) {
            console.error("Telegram sozlamalari (token yoki guruh ID) to'liq emas. Xabar yuborilmadi.");
            return;
        }

        const fullPayload = { ...payload, bot_token: token, group_id: groupId };
        
        // Python botiga so'rov yuborish
        const response = await axios.post(PYTHON_BOT_URL, fullPayload);
        console.log(`Python botiga so'rov muvaffaqiyatli jo'natildi. Status: ${response.status}`);

    } catch (error) {
        // Xatolikni batafsil loglash
        if (error.response) {
            console.error(`Python botidan xatolik keldi: Status ${error.response.status}, Ma'lumot: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            console.error(`Python botiga ulanib bo'lmadi. So'rov yuborildi, lekin javob kelmadi. URL: ${PYTHON_BOT_URL}`);
        } else {
            console.error("Telegramga yuborish funksiyasida kutilmagan xatolik:", error.message);
        }
    }
}

// --- Sahifalarni ko'rsatish (Routing) ---
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', isAuthenticated, isManagerOrAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
    if (req.session.user) {
        // Agar admin yoki menejer bo'lsa, /admin sahifasiga yo'naltirish
        if (req.session.user.role === 'admin' || req.session.user.role === 'manager') {
            res.redirect('/admin');
        } else {
            // Aks holda asosiy ishchi sahifasiga
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
    } else {
        // Agar sessiya bo'lmasa, login sahifasiga
        res.redirect('/login');
    }
});

// Serverni ishga tushirish
app.listen(PORT, () => {
    console.log(`Server http://localhost:${PORT} manzilida ishga tushdi` );
});
