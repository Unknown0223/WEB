// middleware/auth.js

const { dbPromise } = require('../db.js');

/**
 * Foydalanuvchi tizimga kirganligini va sessiyasi aktiv ekanligini tekshiradi.
 * Agar sessiya aktiv bo'lsa, foydalanuvchining huquqlarini `req.session.user.permissions` ga yuklaydi.
 */
const isAuthenticated = async (req, res, next) => {
    try {
        if (req.session && req.session.user) {
            const db = await dbPromise;
            const sessionExists = await db.get("SELECT sid FROM sessions WHERE sid = ?", req.sessionID);
            
            if (sessionExists) {
                // Sessiyani yangilash
                req.session.last_activity = Date.now();
                // req.session.save() har doim ham kerak emas, express-session buni avtomatik boshqaradi.
                // Faqat o'zgarish bo'lganda o'zi saqlaydi.

                // Agar huquqlar sessiyada bo'lmasa, ularni bazadan yuklash (birinchi kirishda)
                if (!req.session.user.permissions) {
                    const permissions = await db.all(
                        "SELECT permission_key FROM role_permissions WHERE role_name = ?",
                        req.session.user.role
                    );
                    req.session.user.permissions = permissions.map(p => p.permission_key);
                }
                next();
            } else {
                // Agar sessiya DBda bo'lmasa, foydalanuvchini tizimdan chiqarish
                req.session.destroy((err) => {
                    if (err) {
                        return res.status(500).json({ message: "Sessiyani tugatishda xatolik." });
                    }
                    res.status(401).json({ message: "Sessiyangiz tugatildi. Iltimos, qayta kiring." });
                });
            }
        } else {
            res.status(401).json({ message: "Avtorizatsiyadan o'tmagansiz. Iltimos, tizimga kiring." });
        }
    } catch (error) {
        console.error("isAuthenticated middleware xatoligi:", error);
        res.status(500).json({ message: "Sessiyani tekshirishda ichki xatolik." });
    }
};

/**
 * Kerakli huquq(lar) borligini tekshiruvchi middleware generatori.
 * @param {string|string[]} requiredPermissions - Talab qilinadigan huquq(lar).
 * @returns {function} Express middleware funksiyasi.
 */
const hasPermission = (requiredPermissions) => {
    return (req, res, next) => {
        const userPermissions = req.session.user?.permissions || [];
        const permissionsToCheck = Array.isArray(requiredPermissions) 
            ? requiredPermissions 
            : [requiredPermissions];

        // Foydalanuvchida talab qilingan huquqlardan kamida bittasi bo'lsa, o'tkazib yuboradi.
        const hasAnyPermission = permissionsToCheck.some(p => userPermissions.includes(p));

        if (hasAnyPermission) {
            next();
        } else {
            res.status(403).json({ message: "Bu amalni bajarish uchun sizda yetarli huquq yo'q." });
        }
    };
};

// Eskicha moslashuvchanlik uchun qoldirilgan funksiyalar
const isAdmin = hasPermission('roles:manage'); // Adminning asosiy huquqi
const isManagerOrAdmin = hasPermission(['users:view', 'settings:view']); // Menejer yoki Admin huquqi

module.exports = {
    isAuthenticated,
    hasPermission,
    isAdmin,
    isManagerOrAdmin
};
