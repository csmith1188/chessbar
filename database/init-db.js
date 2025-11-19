const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        chessbar_id INTEGER PRIMARY KEY,
        formbar_id INTEGER,
        tokens INTEGER,
        wins INTEGER,
        losses INTEGER
    );`);

    db.run(`INSERT INTO users (formbar_id, tokens) VALUES (?, ?)`,
        [-1, 0],
        (err) => {
            if (err) return console.error('Error updating default values:', err);
            console.log("Row inserted");
        }
    );
});
