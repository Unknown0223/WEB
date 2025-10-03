// routes/roles.js

const express = require('express');
const { dbPromise } = require('../db.js');
const { isAuthenticated, hasPermission } = require('../middleware/auth.js');

const router = express.Router();

// GET /api/roles - Barcha rollar va ularning huquqlarini olish
router.get('/', isAuthenticated, hasPermission('roles:manage'), async (req, res) => {
    try {
        const db = await dbPromise;
        const roles = await db.all("SELECT role_name FROM roles");
        const permissions = await db.all("SELECT * FROM permissions ORDER BY category");
        const rolePermissions = await db.all("SELECT * FROM role_permissions");

        const permissionsByCategory = permissions.reduce((acc, p) => {
            if (!acc[p.category]) {
                acc[p.category] = [];
            }
            acc[p.category].push({ key: p.permission_key, description: p.description });
            return acc;
        }, {});

        const result = roles.map(role => {
            const assignedPermissions = rolePermissions
                .filter(rp => rp.role_name === role.role_name)
                .map(rp => rp.permission_key);
            return {
                role_name: role.role_name,
                permissions: assignedPermissions
            };
        });

        res.json({ roles: result, all_permissions: permissionsByCategory });

    } catch (error) {
        console.error("/api/roles GET xatoligi:", error);
        res.status(500).json({ message: "Rollar va huquqlarni yuklashda xatolik." });
    }
});

// PUT /api/roles/:role_name - Rolning huquqlarini yangilash
router.put('/:role_name', isAuthenticated, hasPermission('roles:manage'), async (req, res) => {
    const { role_name } = req.params;
    const { permissions } = req.body; // permissions - bu huquqlar kalitlarining massivi

    if (!Array.isArray(permissions)) {
        return res.status(400).json({ message: "Huquqlar massiv formatida yuborilishi kerak." });
    }
    // Admin rolini o'zgartirishga yo'l qo'ymaslik
    if (role_name === 'admin') {
        return res.status(403).json({ message: "Admin rolini huquqlarini o'zgartirish mumkin emas." });
    }

    try {
        const db = await dbPromise;
        
        // Tranzaksiyani boshlash
        await db.exec('BEGIN TRANSACTION');

        // Rolning eski huquqlarini o'chirish
        await db.run("DELETE FROM role_permissions WHERE role_name = ?", role_name);

        // Yangi huquqlarni qo'shish
        if (permissions.length > 0) {
            const stmt = await db.prepare("INSERT INTO role_permissions (role_name, permission_key) VALUES (?, ?)");
            for (const permKey of permissions) {
                await stmt.run(role_name, permKey);
            }
            await stmt.finalize();
        }

        // Tranzaksiyani yakunlash
        await db.exec('COMMIT');

        res.json({ message: `"${role_name}" roli uchun huquqlar muvaffaqiyatli yangilandi.` });

    } catch (error) {
        const db = await dbPromise;
        await db.exec('ROLLBACK'); // Xatolik yuz bersa, o'zgarishlarni bekor qilish
        console.error(`/api/roles/${role_name} PUT xatoligi:`, error);
        res.status(500).json({ message: "Rol huquqlarini yangilashda xatolik." });
    }
});

module.exports = router;
