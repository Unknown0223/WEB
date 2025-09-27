// server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = 3000;
const saltRounds = 10;

app.use(express.json());
app.use(express.static('public'));

app.use(session({
    secret: 'bu-juda-maxfiy-kalit-bolishi-kerak-albatta-ozgartiring',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    } 
}));

let db;

(async () => {
    try {
        db = await open({
            filename: './database.db',
            driver: sqlite3.Database
        });
        console.log('Ma\'lumotlar bazasiga muvaffaqiyatli ulanildi.');

        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                location TEXT,
                role TEXT NOT NULL DEFAULT 'user'
            );
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_date TEXT NOT NULL,
                location TEXT NOT NULL,
                data TEXT NOT NULL,
                settings TEXT NOT NULL,
                user_id INTEGER,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);

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

const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ message: "Avval tizimga kiring." });
    }
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: "Bu amal uchun sizda ruxsat yo'q." });
    }
};

// --- API Endpoints ---

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Login va parol kiritilishi shart." });
    try {
        const user = await db.get('SELECT * FROM users WHERE username = ?', username);
        if (!user) return res.status(401).json({ message: "Login yoki parol noto'g'ri." });
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = { id: user.id, username: user.username, location: user.location, role: user.role };
            res.json({ message: "Tizimga muvaffaqiyatli kirildi.", user: req.session.user });
        } else {
            res.status(401).json({ message: "Login yoki parol noto'g'ri." });
        }
    } catch (error) {
        res.status(500).json({ message: "Tizimga kirishda xatolik.", error: error.message });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ message: "Tizimdan chiqishda xatolik." });
        res.clearCookie('connect.sid');
        res.json({ message: "Tizimdan muvaffaqiyatli chiqdingiz." });
    });
});

app.get('/api/current-user', isAuthenticated, (req, res) => {
    res.json(req.session.user);
});

app.get('/api/settings', isAuthenticated, async (req, res) => {
    try {
        const settingsRow = await db.get("SELECT value FROM settings WHERE key = 'app_settings'");
        if (settingsRow) {
            res.json(JSON.parse(settingsRow.value));
        } else {
            res.json({
                columns: ["Накд", "Перечисление", "Терминал"],
                rows: ["Лалаку", "Соф", "Женс", "Гига", "арзони", "SUV", "LM", "ECO"],
                locations: ["Навоий", "Тошкент", "Самарқанд"]
            });
        }
    } catch (error) {
        res.status(500).json({ message: "Sozlamalarni yuklashda xatolik", error: error.message });
    }
});

app.post('/api/settings', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const settingsValue = JSON.stringify(req.body);
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", 'app_settings', settingsValue);
        res.json({ message: "Sozlamalar muvaffaqiyatli saqlandi." });
    } catch (error) {
        res.status(500).json({ message: "Sozlamalarni saqlashda xatolik", error: error.message });
    }
});

app.get('/api/reports', isAuthenticated, async (req, res) => {
    try {
        let reports;
        if (req.session.user.role === 'admin') {
            reports = await db.all("SELECT * FROM reports ORDER BY id DESC");
        } else {
            reports = await db.all("SELECT * FROM reports WHERE location = ? ORDER BY id DESC", req.session.user.location);
        }
        const formattedReports = {};
        reports.forEach(report => {
            formattedReports[report.id] = {
                id: report.id,
                date: report.report_date,
                location: report.location,
                data: JSON.parse(report.data),
                settings: JSON.parse(report.settings)
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
    if (user.role !== 'admin' && user.location !== location) {
        return res.status(403).json({ message: "Siz faqat o'z filialingiz uchun hisobot qo'sha olasiz." });
    }
    try {
        const result = await db.run(
            "INSERT INTO reports (report_date, location, data, settings, user_id) VALUES (?, ?, ?, ?, ?)",
            date, location, JSON.stringify(data), JSON.stringify(settings), user.id
        );
        res.status(201).json({ message: "Hisobot muvaffaqiyatli saqlandi.", reportId: result.lastID });
    } catch (error) {
        res.status(500).json({ message: "Hisobotni saqlashda xatolik", error: error.message });
    }
});

// --- Foydalanuvchilarni boshqarish (Admin uchun) ---

app.get('/api/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const users = await db.all("SELECT id, username, location, role FROM users");
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Foydalanuvchilarni olishda xatolik.", error: error.message });
    }
});

app.post('/api/users', isAuthenticated, isAdmin, async (req, res) => {
    const { username, password, location, role } = req.body;
    if (!username || !password || !role || (role === 'user' && !location)) {
        return res.status(400).json({ message: "Kerakli ma'lumotlar to'liq kiritilmagan." });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const result = await db.run(
            'INSERT INTO users (username, password, location, role) VALUES (?, ?, ?, ?)',
            username, hashedPassword, location, role
        );
        res.status(201).json({ message: "Foydalanuvchi muvaffaqiyatli qo'shildi.", userId: result.lastID });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ message: "Bu nomdagi foydalanuvchi allaqachon mavjud." });
        }
        res.status(500).json({ message: "Foydalanuvchi qo'shishda xatolik.", error: error.message });
    }
});

// YANGI: Foydalanuvchini o'chirish
app.delete('/api/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    const userId = req.params.id;
    // Admin o'zini o'chira olmasligi kerak
    if (Number(userId) === req.session.user.id) {
        return res.status(403).json({ message: "Siz o'zingizni o'chira olmaysiz." });
    }
    try {
        const result = await db.run("DELETE FROM users WHERE id = ?", userId);
        if (result.changes === 0) {
            return res.status(404).json({ message: "Foydalanuvchi topilmadi." });
        }
        res.json({ message: "Foydalanuvchi muvaffaqiyatli o'chirildi." });
    } catch (error) {
        res.status(500).json({ message: "Foydalanuvchini o'chirishda xatolik.", error: error.message });
    }
});

// YANGI: Foydalanuvchi parolini o'zgartirish
app.put('/api/users/:id/password', isAuthenticated, isAdmin, async (req, res) => {
    const userId = req.params.id;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ message: "Yangi parol kamida 4 belgidan iborat bo'lishi kerak." });
    }
    try {
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        const result = await db.run("UPDATE users SET password = ? WHERE id = ?", hashedPassword, userId);
        if (result.changes === 0) {
            return res.status(404).json({ message: "Foydalanuvchi topilmadi." });
        }
        res.json({ message: "Parol muvaffaqiyatli yangilandi." });
    } catch (error) {
        res.status(500).json({ message: "Parolni yangilashda xatolik.", error: error.message });
    }
});


// --- Sahifalarni ochish ---

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.redirect('/login');
    }
});

app.listen(PORT, () => {
    console.log(`Server http://localhost:${PORT} manzilida ishga tushdi` );
});
