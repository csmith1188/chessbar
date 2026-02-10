const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error('Failed to open DB:', err);
});

db.all("PRAGMA table_info(friends);", (err, rows) => {
    if (err) {
        console.error('Error reading friends schema:', err);
    } else {
        console.log('friends table schema:');
        rows.forEach(r => console.log(JSON.stringify(r)));
    }
    db.close();
});
