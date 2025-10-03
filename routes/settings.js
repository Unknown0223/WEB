// routes/settings.js

const express = require('express');
const { dbPromise } = require('../db');
const { hasPermission } = require('../middleware/auth'); // O'ZGARTIRILDI

const router = express.Router();

// GET /api/settings - Barcha sozlamalarni olish
router.get('/', hasPermission('settings:view'), async (req, res) => { // O'ZGARTIRILDI
    try {
        const db = await dbPromise;
        const rows = await db.all("SELECT key, value FROM settings");
        const settings = {};
        rows.forEach(row => {
            try { 
                settings[row.key] = JSON.parse(row.value);
            } catch { 
                settings[row.key] = row.value; 
            }
        });
        
        // Standart qiymatlarni o'rnatish
        if (!settings.app_settings) {
            settings.app_settings = { columns: [], rows: [], locations: [] };
        }
        if (!settings.pagination_limit) {
            settings.pagination_limit = 20;
        }
        
        res.json(settings);
    } catch (error) {
        console.error("/api/settings GET xatoligi:", error);
        res.status(500).json({ message: "Sozlamalarni yuklashda xatolik" });
    }
});

// POST /api/settings - Sozlamalarni saqlash
router.post('/', hasPermission('settings:edit_general'), async (req, res) => { // YAXSHILANDI: Aniq huquq qo'yildi
    const { key, value } = req.body;
    if (!key || value === undefined) {
        return res.status(400).json({ message: "Kalit (key) va qiymat (value) yuborilishi shart." });
    }
    
    try {
        const db = await dbPromise;
        const valueToSave = (typeof value === 'object') ? JSON.stringify(value) : value;
        
        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, valueToSave);
        res.json({ message: "Sozlamalar muvaffaqiyatli saqlandi." });
    } catch (error) {
        console.error("/api/settings POST xatoligi:", error);
        res.status(500).json({ message: "Sozlamalarni saqlashda xatolik" });
    }
});

module.exports = router;
