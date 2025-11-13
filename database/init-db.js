const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        tokens INTEGER
    );`);

    db.run(`INSERT INTO users (id, tokens) VALUES (?, ?)`,
        [0, 0],
        (err) => {
            if (err) return console.error(err);
            console.log("Row inserted");
        }
    );
});
