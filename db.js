// db.js

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const dbPromise = (async () => {
    try {
        const db = await open({ filename: './database.db', driver: sqlite3.Database });
        console.log('Ma\'lumotlar bazasiga muvaffaqiyatli ulanildi.');
        await db.exec(`PRAGMA foreign_keys = ON;`);
        
        // Jadvallarni yaratish va yangilash
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'operator',
                is_active BOOLEAN DEFAULT 1 NOT NULL,
                device_limit INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS user_locations (
                user_id INTEGER,
                location_name TEXT,
                PRIMARY KEY (user_id, location_name),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_date TEXT NOT NULL,
                location TEXT NOT NULL,
                data TEXT NOT NULL,
                settings TEXT NOT NULL,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_by INTEGER,
                updated_at DATETIME,
                late_comment TEXT,
                UNIQUE(report_date, location),
                FOREIGN KEY(created_by) REFERENCES users(id),
                FOREIGN KEY(updated_by) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS report_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id INTEGER NOT NULL,
                old_data TEXT NOT NULL,
                changed_by INTEGER NOT NULL,
                changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE,
                FOREIGN KEY(changed_by) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS pivot_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                report TEXT NOT NULL,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(created_by) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS sessions (
                sid TEXT PRIMARY KEY,
                sess TEXT NOT NULL,
                expire INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS roles (
                role_name TEXT PRIMARY KEY
            );
            CREATE TABLE IF NOT EXISTS permissions (
                permission_key TEXT PRIMARY KEY,
                description TEXT,
                category TEXT
            );
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_name TEXT,
                permission_key TEXT,
                PRIMARY KEY (role_name, permission_key),
                FOREIGN KEY (role_name) REFERENCES roles(role_name) ON DELETE CASCADE,
                FOREIGN KEY (permission_key) REFERENCES permissions(permission_key) ON DELETE CASCADE
            );
        `);

        // Jadvallarga kerakli ustunlar borligini tekshirish va qo'shish
        const userColumns = await db.all("PRAGMA table_info(users)");
        if (!userColumns.some(c => c.name === 'device_limit')) {
            await db.exec("ALTER TABLE users ADD COLUMN device_limit INTEGER NOT NULL DEFAULT 1");
        }
        const reportColumns = await db.all("PRAGMA table_info(reports)");
        if (!reportColumns.some(c => c.name === 'late_comment')) {
            await db.exec("ALTER TABLE reports ADD COLUMN late_comment TEXT");
        }

        // Boshlang'ich rollar va huquqlarni to'ldirish
        await db.run("INSERT OR IGNORE INTO roles (role_name) VALUES ('admin'), ('manager'), ('operator')");

        const allPermissions = [
            // Foydalanuvchilar
            { key: 'users:view', desc: 'Foydalanuvchilar ro\'yxatini ko\'rish', cat: 'Foydalanuvchilar' },
            { key: 'users:create', desc: 'Yangi foydalanuvchi yaratish', cat: 'Foydalanuvchilar' },
            { key: 'users:edit', desc: 'Foydalanuvchi ma\'lumotlarini tahrirlash', cat: 'Foydalanuvchilar' },
            { key: 'users:change_status', desc: 'Foydalanuvchini bloklash/aktivlashtirish', cat: 'Foydalanuvchilar' },
            { key: 'users:manage_sessions', desc: 'Foydalanuvchi sessiyalarini boshqarish', cat: 'Foydalanuvchilar' },
            // Hisobotlar
            { key: 'reports:view_all', desc: 'Barcha filiallar hisobotlarini ko\'rish', cat: 'Hisobotlar' },
            { key: 'reports:view_assigned', desc: 'O\'ziga biriktirilgan filiallar hisobotini ko\'rish', cat: 'Hisobotlar' },
            { key: 'reports:create', desc: 'Yangi hisobot yaratish', cat: 'Hisobotlar' },
            { key: 'reports:edit_all', desc: 'Barcha hisobotlarni tahrirlash', cat: 'Hisobotlar' },
            { key: 'reports:edit_assigned', desc: 'O\'ziga biriktirilgan filiallar hisobotini tahrirlash', cat: 'Hisobotlar' },
            { key: 'reports:edit_own', desc: 'Faqat o\'zi yaratgan hisobotni tahrirlash', cat: 'Hisobotlar' },
            // Sozlamalar
            { key: 'settings:view', desc: 'Sozlamalarni ko\'rish', cat: 'Sozlamalar' },
            { key: 'settings:edit_table', desc: 'Jadval (ustun, qator, filial) sozlamalarini o\'zgartirish', cat: 'Sozlamalar' },
            { key: 'settings:edit_telegram', desc: 'Telegram bot sozlamalarini o\'zgartirish', cat: 'Sozlamalar' },
            { key: 'settings:edit_general', desc: 'Umumiy (masalan, pagination) sozlamalarni o\'zgartirish', cat: 'Sozlamalar' },
            // Huquqlar
            { key: 'roles:manage', desc: 'Rollar va huquqlarni boshqarish', cat: 'Huquqlar' },
        ];

        const stmt = await db.prepare("INSERT OR IGNORE INTO permissions (permission_key, description, category) VALUES (?, ?, ?)");
        for (const p of allPermissions) {
            await stmt.run(p.key, p.desc, p.cat);
        }
        await stmt.finalize();

        // Standart huquqlarni belgilash
        const defaultPermissions = {
            admin: allPermissions.map(p => p.key), // Adminga barcha huquqlar
            manager: ['reports:view_assigned', 'reports:create', 'reports:edit_assigned'],
            operator: ['reports:view_assigned', 'reports:create', 'reports:edit_own']
        };

        const permStmt = await db.prepare("INSERT OR IGNORE INTO role_permissions (role_name, permission_key) VALUES (?, ?)");
        for (const role in defaultPermissions) {
            for (const perm of defaultPermissions[role]) {
                await permStmt.run(role, perm);
            }
        }
        await permStmt.finalize();


        // Boshlang'ich adminni tekshirish va yaratish
        const admin = await db.get("SELECT id FROM users WHERE role = 'admin'");
        if (!admin) {
            const bcrypt = require('bcrypt');
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash('admin123', saltRounds);
            await db.run("INSERT INTO users (username, password, role, device_limit) VALUES (?, ?, ?, ?)", 'admin', hashedPassword, 'admin', 5);
            console.log("Boshlang'ich admin yaratildi. Login: 'admin', Parol: 'admin123', Qurilma limiti: 5");
        }
        console.log('Barcha jadvallar tayyor.');
        return db;
    } catch (err) {
        console.error("DB ni ishga tushirishda xatolik:", err.message);
        throw err; // Xatolikni yuqoriga uzatish
    }
})();

module.exports = { dbPromise };
