// server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
const PORT = 3000; // Dasturimiz 3000-portda ishlaydi

// Middleware'lar
app.use(express.json()); // Kiruvchi JSON so'rovlarini tushunish uchun
app.use(express.static('public')); // 'public' papkasidagi fayllarni to'g'ridan-to'g'ri ochish uchun

let db;

// Ma'lumotlar bazasiga asinxron ulanish
(async () => {
    db = await open({
        filename: './database.db', // Baza fayli nomi
        driver: sqlite3.Database
    });

    console.log('Ma\'lumotlar bazasiga muvaffaqiyatli ulanildi.');

    // Agar jadvallar mavjud bo'lmasa, ularni yaratish
    await db.exec(`
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_date TEXT NOT NULL,
            location TEXT NOT NULL,
            data TEXT NOT NULL,
            settings TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);
    console.log('Jadvallar tayyor.');

})();


// Bosh sahifani ochish
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});


// Serverni ishga tushirish
app.listen(PORT, () => {
    console.log(`Server http://localhost:${PORT} manzilida ishga tushdi` );
});
