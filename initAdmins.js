const { dbPromise } = require('./db');
const bcrypt = require('bcrypt');

async function initializeAdmins() {
    try {
        const db = await dbPromise;
        
        // Default admin users
        const adminUsers = [
            { username: 'admin1', password: 'admin123', role: 'admin' },
            { username: 'admin2', password: 'admin456', role: 'admin' }
        ];

        // Check existing admins
        const existingAdmins = await db.all('SELECT username FROM users WHERE role = ?', ['admin']);
        console.log(`Found ${existingAdmins.length} existing admin(s):`, existingAdmins.map(a => a.username));

        // Hash passwords and prepare users
        for (const admin of adminUsers) {
            const hashedPassword = await bcrypt.hash(admin.password, 10);
            
            // Check if admin already exists
            const existingAdmin = await db.get('SELECT id FROM users WHERE username = ?', [admin.username]);
            
            if (existingAdmin) {
                // Update existing admin
                await db.run(
                    'UPDATE users SET password = ?, role = ?, is_active = 1 WHERE username = ?',
                    [hashedPassword, admin.role, admin.username]
                );
                console.log(`Updated admin: ${admin.username}`);
            } else {
                // Insert new admin
                await db.run(
                    'INSERT INTO users (username, password, role, is_active) VALUES (?, ?, ?, 1)',
                    [admin.username, hashedPassword, admin.role]
                );
                console.log(`Created admin: ${admin.username}`);
            }
        }

        console.log('Admin users have been initialized successfully');
    } catch (error) {
        console.error('Error initializing admin users:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

initializeAdmins();
