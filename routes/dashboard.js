// routes/dashboard.js

const express = require('express');
const { dbPromise } = require('../db.js');
const { isManagerOrAdmin } = require('../middleware/auth.js');

const router = express.Router();

// GET /api/dashboard/status - Kunlik hisobot statusini olish
router.get('/status', isManagerOrAdmin, async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ message: "Sana parametri yuborilishi shart." });
    }
    try {
        const db = await dbPromise;
        const settingsRow = await db.get("SELECT value FROM settings WHERE key = 'app_settings'");
        if (!settingsRow) {
            return res.status(404).json({ message: "Ilova sozlamalari topilmadi." });
        }
        
        const allLocations = JSON.parse(settingsRow.value).locations || [];
        
        const submittedReports = await db.all("SELECT location FROM reports WHERE report_date = ?", date);
        const submittedLocations = submittedReports.map(r => r.location);
        
        const statusData = allLocations.map(location => ({
            name: location,
            submitted: submittedLocations.includes(location)
        }));
        
        res.json(statusData);
    } catch (error) {
        console.error("/api/dashboard/status GET xatoligi:", error);
        res.status(500).json({ message: "Dashboard statusini yuklashda xatolik" });
    }
});

module.exports = router;
