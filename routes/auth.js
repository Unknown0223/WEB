// routes/auth.js

const express = require('express');
const bcrypt = require('bcrypt');
const { dbPromise } = require('../db.js');
const { isAuthenticated } = require('../middleware/auth.js');

const router = express.Router();
const saltRounds = 10;

// POST /api/login - Tizimga kirish
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "Login va parol kiritilishi shart." });
    }

    try {
        const db = await dbPromise;
        const user = await db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', username);
        if (!user) {
            return res.status(401).json({ message: "Login yoki parol noto'g'ri yoki foydalanuvchi faol emas." });
        }

        // Qurilma limitini tekshirish
        const sessions = await db.all("SELECT sess FROM sessions");
        const activeUserSessions = sessions.filter(s => {
            try {
                const sessData = JSON.parse(s.sess);
                return sessData.user && sessData.user.id === user.id;
            } catch {
                return false;
            }
        });

        if (activeUserSessions.length >= user.device_limit) {
            return res.status(403).json({ message: `Qurilmalar limiti (${user.device_limit}) to'lgan. Boshqa qurilmadan chiqib, qayta urinib ko'ring.` });
        }

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            const locations = await db.all('SELECT location_name FROM user_locations WHERE user_id = ?', user.id);
            const permissions = await db.all('SELECT permission_key FROM role_permissions WHERE role_name = ?', user.role);
            
            // Sessiyani yaratish
            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role,
                locations: locations.map(l => l.location_name),
                permissions: permissions.map(p => p.permission_key) // HUQUQLARNI QO'SHISH
            };
            req.session.ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            req.session.user_agent = req.headers['user-agent'];
            req.session.last_activity = Date.now();

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
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: "Tizimdan chiqishda xatolik." });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Tizimdan muvaffaqiyatli chiqdingiz." });
    });
});

// GET /api/current-user - Joriy foydalanuvchi ma'lumotlari
router.get('/current-user', isAuthenticated, (req, res) => {
    res.json(req.session.user);
});

module.exports = router;
