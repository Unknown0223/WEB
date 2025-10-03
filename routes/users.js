// routes/users.js

const express = require('express');
const bcrypt = require('bcrypt');
const { dbPromise } = require('../db.js');
const { isAdmin } = require('../middleware/auth.js');

const router = express.Router();
const saltRounds = 10;

// GET /api/users - Barcha foydalanuvchilarni olish (ONLAYN STATUS BILAN)
router.get('/', isAdmin, async (req, res) => {
    try {
        const db = await dbPromise;
        const users = await db.all(`
            SELECT u.id, u.username, u.role, u.is_active, u.device_limit,
                   GROUP_CONCAT(ul.location_name) as locations
            FROM users u LEFT JOIN user_locations ul ON u.id = ul.user_id
            GROUP BY u.id ORDER BY u.username
        `);
        
        const sessions = await db.all("SELECT sess FROM sessions");
        const activeSessions = sessions.map(s => {
            try { return JSON.parse(s.sess); } catch { return null; }
        }).filter(Boolean);

        const usersWithStatus = users.map(user => {
            const userSessions = activeSessions.filter(s => s.user && s.user.id === user.id);
            const isOnline = userSessions.length > 0;
            let lastActivity = null;
            if (isOnline) {
                // Sessiyalardagi eng so'nggi faollik vaqtini topish
                lastActivity = Math.max(...userSessions.map(s => s.last_activity || 0));
            }
            return {
                ...user,
                locations: user.locations ? user.locations.split(',') : [],
                is_online: isOnline,
                last_activity: lastActivity ? new Date(lastActivity).toISOString() : null,
                active_sessions_count: userSessions.length
            };
        });

        res.json(usersWithStatus);
    } catch (error) {
        console.error("/api/users GET xatoligi:", error);
        res.status(500).json({ message: "Foydalanuvchilarni olishda xatolik." });
    }
});

// GET /api/users/:id/sessions - Foydalanuvchining aktiv sessiyalarini olish
router.get('/:id/sessions', isAdmin, async (req, res) => {
    const userId = req.params.id;
    try {
        const db = await dbPromise;
        const sessions = await db.all("SELECT sid, sess FROM sessions");
        
        const userSessions = sessions.map(s => {
            try {
                const sessData = JSON.parse(s.sess);
                if (sessData.user && sessData.user.id == userId) {
                    return {
                        sid: s.sid,
                        ip_address: sessData.ip_address,
                        user_agent: sessData.user_agent,
                        last_activity: new Date(sessData.last_activity).toISOString()
                    };
                }
                return null;
            } catch {
                return null;
            }
        }).filter(Boolean);

        res.json(userSessions);
    } catch (error) {
        console.error(`/api/users/${userId}/sessions GET xatoligi:`, error);
        res.status(500).json({ message: "Sessiyalarni olishda xatolik." });
    }
});


// POST /api/users - Yangi foydalanuvchi yaratish
router.post('/', isAdmin, async (req, res) => {
    const { username, password, role, locations = [], device_limit = 1 } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ message: "Login, parol va rol kiritilishi shart." });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: "Parol kamida 8 belgidan iborat bo'lishi kerak." });
    }
    if ((role === 'operator' || role === 'manager') && locations.length === 0) {
        return res.status(400).json({ message: "Operator yoki Menejer uchun kamida bitta filial tanlanishi shart." });
    }

    try {
        const db = await dbPromise;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const result = await db.run('INSERT INTO users (username, password, role, device_limit) VALUES (?, ?, ?, ?)', username, hashedPassword, role, device_limit);
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
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ message: "Bu nomdagi foydalanuvchi allaqachon mavjud." });
        }
        console.error("/api/users POST xatoligi:", error);
        res.status(500).json({ message: "Foydalanuvchi qo'shishda xatolik." });
    }
});

// PUT /api/users/:id - Foydalanuvchini tahrirlash
router.put('/:id', isAdmin, async (req, res) => {
    const userId = req.params.id;
    const { role, locations = [], device_limit } = req.body;
    if (!role) {
        return res.status(400).json({ message: "Rol kiritilishi shart." });
    }
    if ((role === 'operator' || role === 'manager') && locations.length === 0) {
        return res.status(400).json({ message: "Operator yoki Menejer uchun kamida bitta filial tanlanishi shart." });
    }

    try {
        const db = await dbPromise;
        await db.run("UPDATE users SET role = ?, device_limit = ? WHERE id = ?", role, device_limit, userId);
        await db.run("DELETE FROM user_locations WHERE user_id = ?", userId);

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

// PUT /api/users/:id/status - Foydalanuvchi holatini o'zgartirish
router.put('/:id/status', isAdmin, async (req, res) => {
    const userId = req.params.id;
    const { is_active } = req.body;
    if (Number(userId) === req.session.user.id) {
        return res.status(403).json({ message: "Siz o'zingizning holatingizni o'zgartira olmaysiz." });
    }

    try {
        const db = await dbPromise;
        await db.run("UPDATE users SET is_active = ? WHERE id = ?", is_active ? 1 : 0, userId);

        if (!is_active) { // Agar foydalanuvchi bloklansa, uning barcha sessiyalarini o'chirish
            const sessions = await db.all("SELECT sid, sess FROM sessions");
            const userSessionIds = sessions.filter(s => {
                try { return JSON.parse(s.sess).user?.id == userId; } catch { return false; }
            }).map(s => s.sid);

            if (userSessionIds.length > 0) {
                const placeholders = userSessionIds.map(() => '?').join(',');
                await db.run(`DELETE FROM sessions WHERE sid IN (${placeholders})`, ...userSessionIds);
            }
        }
        const message = is_active ? "Foydalanuvchi muvaffaqiyatli aktivlashtirildi." : "Foydalanuvchi muvaffaqiyatli bloklandi va barcha sessiyalari tugatildi.";
        res.json({ message });
    } catch (error) {
        console.error(`/api/users/${userId}/status PUT xatoligi:`, error);
        res.status(500).json({ message: "Foydalanuvchi holatini o'zgartirishda xatolik." });
    }
});

// PUT /api/users/:id/password - Foydalanuvchi parolini o'zgartirish
router.put('/:id/password', isAdmin, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: "Yangi parol kamida 8 belgidan iborat bo'lishi kerak." });
    }
    try {
        const db = await dbPromise;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        await db.run("UPDATE users SET password = ? WHERE id = ?", hashedPassword, req.params.id);
        res.json({ message: "Parol muvaffaqiyatli yangilandi." });
    } catch (error) {
        console.error(`/api/users/${req.params.id}/password PUT xatoligi:`, error);
        res.status(500).json({ message: "Parolni yangilashda xatolik." });
    }
});

module.exports = router;
