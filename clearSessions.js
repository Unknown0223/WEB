const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

// Clear all sessions for admin users
db.serialize(() => {
    // List admin users
    db.all("SELECT id, username, device_limit FROM users WHERE role = 'admin'", [], (err, rows) => {
        if (err) {
            console.error('Error fetching admin users:', err);
            return;
        }
        
        console.log('Admin users:');
        rows.forEach(row => {
            console.log(`ID: ${row.id}, Username: ${row.username}, Device Limit: ${row.device_limit}`);
        });
        
        // Clear all sessions
        db.run("DELETE FROM sessions", function(err) {
            if (err) {
                console.error('Error clearing sessions:', err);
            } else {
                console.log(`\nSuccessfully cleared all sessions. ${this.changes} sessions were removed.`);
                console.log('You can now log in with your admin credentials.');
            }
            
            // Close the database connection
            db.close();
        });
    });
});
