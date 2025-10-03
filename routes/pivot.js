// routes/pivot.js

const express = require('express');
const { dbPromise } = require('../db.js');
const { isManagerOrAdmin } = require('../middleware/auth.js');

const router = express.Router();

// GET /api/pivot-templates - Barcha shablonlarni olish
router.get('/', isManagerOrAdmin, async (req, res) => {
    try {
        const db = await dbPromise;
        const templates = await db.all("SELECT id, name, created_by FROM pivot_templates");
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: "Shablonlarni yuklashda xatolik", error: error.message });
    }
});

// POST /api/pivot-templates - Yangi shablon yaratish
router.post('/', isManagerOrAdmin, async (req, res) => {
    const { name, report } = req.body;
    if (!name || !report) {
        return res.status(400).json({ message: "Shablon nomi va hisobot ma'lumoti yuborilishi shart." });
    }
    try {
        const db = await dbPromise;
        await db.run("INSERT INTO pivot_templates (name, report, created_by) VALUES (?, ?, ?)", name, JSON.stringify(report), req.session.user.id);
        res.status(201).json({ message: "Shablon muvaffaqiyatli saqlandi." });
    } catch (error) {
        res.status(500).json({ message: "Shablonni saqlashda xatolik", error: error.message });
    }
});

// GET /api/pivot-templates/:id - Muayyan shablonni olish
router.get('/:id', isManagerOrAdmin, async (req, res) => {
    try {
        const db = await dbPromise;
        const template = await db.get("SELECT report FROM pivot_templates WHERE id = ?", req.params.id);
        if (!template) {
            return res.status(404).json({ message: "Shablon topilmadi." });
        }
        res.json(JSON.parse(template.report));
    } catch (error) {
        res.status(500).json({ message: "Shablonni olishda xatolik", error: error.message });
    }
});

// DELETE /api/pivot-templates/:id - Shablonni o'chirish
router.delete('/:id', isManagerOrAdmin, async (req, res) => {
    try {
        const db = await dbPromise;
        const template = await db.get("SELECT created_by FROM pivot_templates WHERE id = ?", req.params.id);
        if (!template) {
            return res.status(404).json({ message: "Shablon topilmadi." });
        }
        // Faqat admin yoki shablon egasi o'chira oladi
        if (req.session.user.role !== 'admin' && template.created_by !== req.session.user.id) {
            return res.status(403).json({ message: "Siz faqat o'zingiz yaratgan shablonlarni o'chira olasiz." });
        }
        await db.run("DELETE FROM pivot_templates WHERE id = ?", req.params.id);
        res.json({ message: "Shablon muvaffaqiyatli o'chirildi." });
    } catch (error) {
        res.status(500).json({ message: "Shablonni o'chirishda xatolik", error: error.message });
    }
});

module.exports = router;
