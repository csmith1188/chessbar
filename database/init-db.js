const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Use an absolute path relative to this script so we always open the DB
// next to this file (avoids creating/using a different DB when running
// the script from a different working directory).
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error('Failed to open DB:', err);
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        chessbar_id INTEGER PRIMARY KEY NOT NULL DEFAULT 0,
        formbar_id INTEGER NOT NULL DEFAULT 0,
        tokens INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        started INTEGER NOT NULL DEFAULT 0,
        finished INTEGER NOT NULL DEFAULT 0,
        draws INTEGER NOT NULL DEFAULT 0
    );`);

    db.run(`INSERT INTO users (formbar_id, tokens, wins, losses, started, finished, draws) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [-1, 0, 0, 0, 0, 0, 0],
        (err) => {
            if (err) return console.error('Error updating default values:', err);
            console.log("Row inserted");

            // Verification: fetch and print the row we just inserted so you can
            // confirm values aren't null and we opened the correct DB file.
            db.get(`SELECT * FROM users WHERE formbar_id = ?`, [-1], (err, row) => {
                if (err) return console.error('Error querying inserted row:', err);
                console.log('Inserted row:', row);
            });
        }
    );
});
