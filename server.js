// server.js (YAKUNIY VERSIYA)

const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const SQLiteStore = require('connect-sqlite3')(session);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.static('public'));

// Sessiyani sozlash
app.use(session({
    store: new SQLiteStore({ db: 'database.db', dir: './' }),
    secret: process.env.SESSION_SECRET || 'a-very-strong-and-long-secret-key-for-session',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 1 kun
}));

// Yordamchi funksiyalar va DB ni import qilish
const { dbPromise } = require('./db.js');
const { isAuthenticated, isManagerOrAdmin } = require('./middleware/auth.js');

// Markaziy routerni ulash
app.use('/api', require('./routes')); // Bu qator o'zi routes/index.js ni topib oladi

// --- Sahifalarni ko'rsatish (HTML Routing) ---
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', isAuthenticated, isManagerOrAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Asosiy sahifaga kirishni tekshirish
app.get('/', (req, res) => {
    if (req.session.user) {
        // Agar sessiya mavjud bo'lsa, isAuthenticated middleware'dan o'tgan bo'ladi.
        // Shunchaki rolga qarab yo'naltiramiz.
        if (req.session.user.role === 'admin' || req.session.user.role === 'manager') {
            res.redirect('/admin');
        } else {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
    } else {
        // Agar sessiya umuman bo'lmasa, login sahifasiga.
        res.redirect('/login');
    }
});


// Serverni ishga tushirish
dbPromise.then(() => {
    app.listen(PORT, () => {
        console.log(`Server http://localhost:${PORT} manzilida ishga tushdi` );
    });
}).catch(err => {
    console.error("Serverni ishga tushirishda DB bilan bog'liq xatolik:", err);
});
