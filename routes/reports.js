// routes/reports.js

const express = require('express');
const { dbPromise } = require('../db.js');
const { isAuthenticated, hasPermission } = require('../middleware/auth.js');
const { sendToTelegram } = require('../utils/telegram.js');

const router = express.Router();

// GET /api/reports - Hisobotlar ro'yxatini olish
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const db = await dbPromise;
        const user = req.session.user;
        const page = parseInt(req.query.page) || 1;
        
        const limitSetting = await db.get("SELECT value FROM settings WHERE key = 'pagination_limit'");
        const limit = parseInt(JSON.parse(limitSetting?.value || '20'));
        const offset = (page - 1) * limit;

        const { startDate, endDate, searchTerm } = req.query;
        
        let whereClauses = [];
        let params = [];

        // Rolga/huquqqa qarab filtrlash
        if (!user.permissions.includes('reports:view_all')) {
            if (user.locations.length === 0) {
                return res.json({ reports: {}, total: 0, pages: 0, currentPage: 1 });
            }
            const placeholders = user.locations.map(() => '?').join(',');
            whereClauses.push(`r.location IN (${placeholders})`);
            params.push(...user.locations);
        }

        // Boshqa filtrlar
        if (startDate) { whereClauses.push("r.report_date >= ?"); params.push(startDate); }
        if (endDate) { whereClauses.push("r.report_date <= ?"); params.push(endDate); }
        if (searchTerm) { whereClauses.push("(r.id LIKE ? OR r.location LIKE ?)"); params.push(`%${searchTerm}%`, `%${searchTerm}%`); }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const reportsQuery = `
            SELECT r.id, r.report_date, r.location, r.data, r.settings, r.created_by, r.late_comment,
                   (SELECT COUNT(h.id) FROM report_history h WHERE h.report_id = r.id) as edit_count
            FROM reports r ${whereString} ORDER BY r.id DESC LIMIT ? OFFSET ?`;
        
        const countQuery = `SELECT COUNT(DISTINCT r.id) as total FROM reports r ${whereString}`;

        const [reports, totalResult] = await Promise.all([
            db.all(reportsQuery, ...params, limit, offset),
            db.get(countQuery, ...params)
        ]);

        const total = totalResult.total;
        const pages = Math.ceil(total / limit);

        const formattedReports = {};
        reports.forEach(report => {
            formattedReports[report.id] = {
                id: report.id,
                date: report.report_date,
                location: report.location,
                data: JSON.parse(report.data),
                settings: JSON.parse(report.settings),
                edit_count: report.edit_count,
                created_by: report.created_by,
                late_comment: report.late_comment
            };
        });

        res.json({ reports: formattedReports, total, pages, currentPage: page });
    } catch (error) {
        console.error("/api/reports GET xatoligi:", error);
        res.status(500).json({ message: "Hisobotlarni yuklashda xatolik" });
    }
});

// POST /api/reports - Yangi hisobot yaratish
router.post('/', isAuthenticated, hasPermission('reports:create'), async (req, res) => {
    const { date, location, data, settings, late_comment } = req.body;
    const user = req.session.user;

    if (!user.permissions.includes('reports:view_all') && !user.locations.includes(location)) {
        return res.status(403).json({ message: "Siz faqat o'zingizga biriktirilgan filiallar uchun hisobot qo'sha olasiz." });
    }

    try {
        const db = await dbPromise;
        const result = await db.run(
            "INSERT INTO reports (report_date, location, data, settings, created_by, late_comment) VALUES (?, ?, ?, ?, ?, ?)",
            date, location, JSON.stringify(data), JSON.stringify(settings), user.id, late_comment
        );
        
        sendToTelegram({ type: 'new', report_id: result.lastID, location, date, author: user.username, data, settings, late_comment });
        
        res.status(201).json({ message: "Hisobot muvaffaqiyatli saqlandi.", reportId: result.lastID });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: `Ushbu sana (${date}) uchun "${location}" filialida hisobot allaqachon mavjud.` });
        }
        console.error("/api/reports POST xatoligi:", error);
        res.status(500).json({ message: "Hisobotni saqlashda xatolik" });
    }
});

// PUT /api/reports/:id - Hisobotni tahrirlash
router.put('/:id', isAuthenticated, async (req, res) => {
    const reportId = req.params.id;
    const { date, location, data, settings } = req.body;
    const user = req.session.user;

    try {
        const db = await dbPromise;
        const oldReport = await db.get("SELECT * FROM reports WHERE id = ?", reportId);
        if (!oldReport) {
            return res.status(404).json({ message: "Hisobot topilmadi." });
        }

        // Tahrirlashga ruxsatni tekshirish
        const canEditAll = user.permissions.includes('reports:edit_all');
        const canEditAssigned = user.permissions.includes('reports:edit_assigned') && user.locations.includes(oldReport.location);
        const canEditOwn = user.permissions.includes('reports:edit_own') && oldReport.created_by === user.id;

        if (!canEditAll && !canEditAssigned && !canEditOwn) {
            return res.status(403).json({ message: "Bu hisobotni tahrirlash uchun sizda ruxsat yo'q." });
        }

        // Agar sana yoki filial o'zgarsa, dublikatni tekshirish
        if (date !== oldReport.report_date || location !== oldReport.location) {
            const existingReport = await db.get("SELECT id FROM reports WHERE report_date = ? AND location = ? AND id != ?", date, location, reportId);
            if (existingReport) {
                return res.status(409).json({ message: `Ushbu sana (${date}) uchun "${location}" filialida boshqa hisobot allaqachon mavjud.` });
            }
        }

        await db.run("INSERT INTO report_history (report_id, old_data, changed_by) VALUES (?, ?, ?)", reportId, oldReport.data, user.id);
        
        await db.run(
            "UPDATE reports SET report_date = ?, location = ?, data = ?, settings = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?",
            date, location, JSON.stringify(data), JSON.stringify(settings), user.id, reportId
        );
        
        sendToTelegram({ type: 'edit', report_id: reportId, author: user.username, data, old_data: JSON.parse(oldReport.data), settings });
        
        res.json({ message: "Hisobot muvaffaqiyatli yangilandi." });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: `Ushbu sana (${date}) uchun "${location}" filialida boshqa hisobot allaqachon mavjud.` });
        }
        console.error(`/api/reports/${reportId} PUT xatoligi:`, error);
        res.status(500).json({ message: "Hisobotni yangilashda xatolik." });
    }
});

// GET /api/reports/:id/history - Hisobot tarixini olish
router.get('/:id/history', isAuthenticated, async (req, res) => {
    // Bu joyda ham huquqni tekshirish mumkin, masalan, faqat o'z filialidagi tarixni ko'rish
    try {
        const db = await dbPromise;
        const history = await db.all(
            "SELECT h.*, u.username as changed_by_username FROM report_history h JOIN users u ON h.changed_by = u.id WHERE h.report_id = ? ORDER BY h.changed_at DESC",
            req.params.id
        );
        res.json(history);
    } catch (error) {
        console.error(`/api/reports/${req.params.id}/history GET xatoligi:`, error);
        res.status(500).json({ message: "Hisobot tarixini olishda xatolik" });
    }
});

module.exports = router;
