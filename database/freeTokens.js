const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error('Failed to open DB:', err);
});

db.run('UPDATE users SET tokens = 9999999999 WHERE formbar_id = 3')

db.get(`SELECT * FROM users WHERE formbar_id = 3`,[], (err, row) => {
    if (err) return console.error('Error querying inserted row:', err);
    console.log('Inserted row:', row);
});