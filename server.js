// server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const axios = require('axios');
require('dotenv').config(); // .env faylini o'qish uchun

const app = express();
const PORT = 3000;
const saltRounds = 10;
// Manzilni .env faylidan o'qiydi. Agar topilmasa, standart "localhost" manzilini oladi.
const PYTHON_BOT_URL = process.env.PYTHON_BOT_URL || 'http://127.0.0.1:5001/send-report';

// --- Middleware'lar ---
app.use(express.json( ));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'default-secret-key-please-change-it',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 1 kun
}));

let db;

// --- Ma'lumotlar bazasini sozlash ---
(async () => {
    try {
        db = await open({ filename: './database.db', driver: sqlite3.Database });
        console.log('Ma\'lumotlar bazasiga muvaffaqiyatli ulanildi.');

        await db.exec(`PRAGMA foreign_keys = ON;`);

        // Jadvallarni yaratish
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'operator'
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
        `);

        // Boshlang'ich adminni tekshirish va yaratish
        const admin = await db.get("SELECT * FROM users WHERE role = 'admin'");
        if (!admin) {
            const hashedPassword = await bcrypt.hash('admin123', saltRounds);
            await db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", 'admin', hashedPassword, 'admin');
            console.log("Boshlang'ich admin yaratildi. Login: 'admin', Parol: 'admin123'");
        }
        console.log('Barcha jadvallar tayyor.');
    } catch (err) {
        console.error("Baza bilan ishlashda xatolik:", err.message);
    }
})();

// --- Ruxsatlarni tekshiruvchi Middleware'lar ---
const isAuthenticated = (req, res, next) => { if (req.session.user) { next(); } else { res.status(401).json({ message: "Avval tizimga kiring." }); } };
const isAdmin = (req, res, next) => { if (req.session.user && req.session.user.role === 'admin') { next(); } else { res.status(403).json({ message: "Bu amal uchun sizda ruxsat yo'q." }); } };

// --- Asosiy API Endpoints ---

// Tizimga kirish
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Login va parol kiritilishi shart." });
    try {
        const user = await db.get('SELECT * FROM users WHERE username = ?', username);
        if (!user) return res.status(401).json({ message: "Login yoki parol noto'g'ri." });

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            const locations = await db.all('SELECT location_name FROM user_locations WHERE user_id = ?', user.id);
            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role,
                locations: locations.map(l => l.location_name)
            };
            res.json({ message: "Tizimga muvaffaqiyatli kirildi.", user: req.session.user });
        } else {
            res.status(401).json({ message: "Login yoki parol noto'g'ri." });
        }
    } catch (error) {
        res.status(500).json({ message: "Tizimga kirishda xatolik.", error: error.message });
    }
});

// Tizimdan chiqish
app.post('/api/logout', (req, res) => { req.session.destroy(err => { if (err) return res.status(500).json({ message: "Tizimdan chiqishda xatolik." }); res.clearCookie('connect.sid'); res.json({ message: "Tizimdan muvaffaqiyatli chiqdingiz." }); }); });

// Joriy foydalanuvchi ma'lumotlarini olish
app.get('/api/current-user', isAuthenticated, (req, res) => { res.json(req.session.user); });

// --- Sozlamalar API ---
app.get('/api/settings', isAuthenticated, async (req, res) => {
    try {
        const rows = await db.all("SELECT key, value FROM settings");
        const settings = {};
        rows.forEach(row => {
            try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
        });
        if (!settings.app_settings) {
            settings.app_settings = {
                columns: ["Накд", "Перечисление", "Терминал"],
                rows: ["Лалаку", "Соф", "Женс", "Гига", "арзони", "SUV", "LM", "ECO"],
                locations: ["Навоий", "Тошкент", "Самарқанд"]
            };
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: "Sozlamalarni yuklashda xatolik", error: error.message });
    }
});

app.post('/api/settings', isAdmin, async (req, res) => {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ message: "Kalit (key) va qiymat (value) yuborilishi shart." });
    try {
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, JSON.stringify(value));
        res.json({ message: "Sozlamalar muvaffaqiyatli saqlandi." });
    } catch (error) {
        res.status(500).json({ message: "Sozlamalarni saqlashda xatolik", error: error.message });
    }
});

// --- Hisobotlar API ---
app.get('/api/reports', isAuthenticated, async (req, res) => {
    try {
        const user = req.session.user;
        let query;
        let params = [];

        let baseQuery = `
            SELECT 
                r.id, r.report_date, r.location, r.data, r.settings,
                COUNT(h.id) as edit_count
            FROM reports r
            LEFT JOIN report_history h ON r.id = h.report_id
        `;

        if (user.role === 'operator') {
            if (user.locations.length === 0) return res.json({});
            const placeholders = user.locations.map(() => '?').join(',');
            query = `${baseQuery} WHERE r.location IN (${placeholders}) GROUP BY r.id ORDER BY r.id DESC`;
            params = user.locations;
        } else {
            query = `${baseQuery} GROUP BY r.id ORDER BY r.id DESC`;
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
        res.status(500).json({ message: "Hisobotlarni yuklashda xatolik", error: error.message });
    }
});

app.post('/api/reports', isAuthenticated, async (req, res) => {
    const { date, location, data, settings } = req.body;
    const user = req.session.user;
    if (user.role === 'operator' && !user.locations.includes(location)) return res.status(403).json({ message: "Siz faqat o'zingizga biriktirilgan filiallar uchun hisobot qo'sha olasiz." });
    try {
        const result = await db.run("INSERT INTO reports (report_date, location, data, settings, created_by) VALUES (?, ?, ?, ?, ?)", date, location, JSON.stringify(data), JSON.stringify(settings), user.id);
        const newReportId = result.lastID;
        
        sendToTelegram({ type: 'new', report_id: newReportId, location, date, author: user.username, data, settings });
        
        res.status(201).json({ message: "Hisobot muvaffaqiyatli saqlandi.", reportId: newReportId });
    } catch (error) {
        res.status(500).json({ message: "Hisobotni saqlashda xatolik", error: error.message });
    }
});

app.put('/api/reports/:id', isAdmin, async (req, res) => {
    const reportId = req.params.id;
    const { date, location, data, settings } = req.body;
    const user = req.session.user;
    try {
        const oldReport = await db.get("SELECT * FROM reports WHERE id = ?", reportId);
        if (!oldReport) return res.status(404).json({ message: "Hisobot topilmadi." });
        
        await db.run("INSERT INTO report_history (report_id, old_data, changed_by) VALUES (?, ?, ?)", reportId, oldReport.data, user.id);
        await db.run("UPDATE reports SET report_date = ?, location = ?, data = ?, settings = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?", date, location, JSON.stringify(data), JSON.stringify(settings), user.id, reportId);
        
        sendToTelegram({ type: 'edit', report_id: reportId, author: user.username, data, old_data: JSON.parse(oldReport.data), settings });
        
        res.json({ message: "Hisobot muvaffaqiyatli yangilandi." });
    } catch (error) {
        res.status(500).json({ message: "Hisobotni yangilashda xatolik", error: error.message });
    }
});

app.get('/api/reports/:id/history', isAdmin, async (req, res) => {
    try {
        const history = await db.all("SELECT h.*, u.username as changed_by_username FROM report_history h JOIN users u ON h.changed_by = u.id WHERE h.report_id = ? ORDER BY h.changed_at DESC", req.params.id);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: "Hisobot tarixini olishda xatolik", error: error.message });
    }
});

// --- Foydalanuvchilar API ---
app.get('/api/users', isAdmin, async (req, res) => {
    try {
        const users = await db.all("SELECT id, username, role FROM users");
        for (const user of users) {
            const locations = await db.all("SELECT location_name FROM user_locations WHERE user_id = ?", user.id);
            user.locations = locations.map(l => l.location_name);
        }
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Foydalanuvchilarni olishda xatolik.", error: error.message });
    }
});

app.post('/api/users', isAdmin, async (req, res) => {
    const { username, password, role, locations = [] } = req.body;
    if (!username || !password || !role) return res.status(400).json({ message: "Login, parol va rol kiritilishi shart." });
    if (role === 'operator' && locations.length === 0) return res.status(400).json({ message: "Operator uchun kamida bitta filial tanlanishi shart." });
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const result = await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', username, hashedPassword, role);
        const userId = result.lastID;
        if (role === 'operator') {
            for (const location of locations) {
                await db.run('INSERT INTO user_locations (user_id, location_name) VALUES (?, ?)', userId, location);
            }
        }
        res.status(201).json({ message: "Foydalanuvchi muvaffaqiyatli qo'shildi." });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ message: "Bu nomdagi foydalanuvchi allaqachon mavjud." });
        res.status(500).json({ message: "Foydalanuvchi qo'shishda xatolik.", error: error.message });
    }
});

app.delete('/api/users/:id', isAdmin, async (req, res) => { const userId = req.params.id; if (Number(userId) === req.session.user.id) return res.status(403).json({ message: "Siz o'zingizni o'chira olmaysiz." }); try { await db.run("DELETE FROM users WHERE id = ?", userId); res.json({ message: "Foydalanuvchi muvaffaqiyatli o'chirildi." }); } catch (error) { res.status(500).json({ message: "Foydalanuvchini o'chirishda xatolik.", error: error.message }); } });
app.put('/api/users/:id/password', isAdmin, async (req, res) => { const { newPassword } = req.body; if (!newPassword || newPassword.length < 4) return res.status(400).json({ message: "Yangi parol kamida 4 belgidan iborat bo'lishi kerak." }); try { const hashedPassword = await bcrypt.hash(newPassword, saltRounds); await db.run("UPDATE users SET password = ? WHERE id = ?", hashedPassword, req.params.id); res.json({ message: "Parol muvaffaqiyatli yangilandi." }); } catch (error) { res.status(500).json({ message: "Parolni yangilashda xatolik.", error: error.message }); } });

// --- Markazlashtirilgan Telegramga yuborish funksiyasi ---
async function sendToTelegram(payload) {
    try {
        const tokenSetting = await db.get("SELECT value FROM settings WHERE key = 'telegram_bot_token'");
        const groupIdSetting = await db.get("SELECT value FROM settings WHERE key = 'telegram_group_id'");

        const token = tokenSetting ? JSON.parse(tokenSetting.value) : null;
        const groupId = groupIdSetting ? JSON.parse(groupIdSetting.value) : null;

        if (!token || !groupId) {
            console.error("Telegram sozlamalari (token yoki guruh ID) ma'lumotlar bazasida to'liq emas.");
            return;
        }
        
        const fullPayload = { ...payload, bot_token: token, group_id: groupId };
        
        axios.post(PYTHON_BOT_URL, fullPayload)
            .then(response => console.log(`Python botiga so'rov muvaffaqiyatli jo'natildi. Status: ${response.status}`))
            .catch(error => console.error(`Python botiga ulanishda xatolik: ${error.message}`));

    } catch (error) {
        console.error("Telegramga yuborish funksiyasida xatolik:", error.message);
    }
}

// --- Sahifalarni ochish (YANGILANGAN QISM) ---
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// YANGI YO'L: Admin sahifasini ochish uchun qo'shildi
app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Asosiy sahifani ochish yo'li
app.get('/', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.redirect('/login');
    }
});

// --- Serverni ishga tushirish ---
app.listen(PORT, () => {
    console.log(`Server http://localhost:${PORT} manzilida ishga tushdi` );
});
