const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error('Failed to open DB:', err);
});

// Define the desired schema for the `users` table. We avoid attempting to
// alter primary-key constraints on existing tables; instead we only add
// missing columns that can be added safely with ALTER TABLE.
const desiredColumns = {
    chessbar_id: 'INTEGER PRIMARY KEY NOT NULL DEFAULT 0',
    formbar_id: 'INTEGER NOT NULL DEFAULT 0',
    tokens: 'INTEGER NOT NULL DEFAULT 0',
    wins: 'INTEGER NOT NULL DEFAULT 0',
    losses: 'INTEGER NOT NULL DEFAULT 0',
    started: 'INTEGER NOT NULL DEFAULT 0',
    finished: 'INTEGER NOT NULL DEFAULT 0',
    draws: 'INTEGER NOT NULL DEFAULT 0',
    display_name: "TEXT NOT NULL DEFAULT ''"
};

function ensureUsersTable(cb) {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
        if (err) return cb(err);
        if (!row) {
            // Table doesn't exist; create it with full desired schema.
            const cols = Object.entries(desiredColumns).map(([name, def]) => `${name} ${def}`).join(',\n        ');
            const createSql = `CREATE TABLE IF NOT EXISTS users (\n        ${cols}\n    );`;
            db.run(createSql, (err) => cb(err));
        } else {
            cb(null);
        }
    });
}

function getExistingColumns(cb) {
    db.all("PRAGMA table_info(users);", (err, rows) => {
        if (err) return cb(err);
        const cols = rows.map(r => r.name);
        cb(null, cols);
    });
}

function addMissingColumns(existing, cb) {
    const toAdd = Object.keys(desiredColumns).filter(c => !existing.includes(c));

    // Skip adding `chessbar_id` if missing because adding a PRIMARY KEY to an
    // existing table is not supported by simple ALTER TABLE. We log if it's
    // missing so the operator can take manual action if desired.
    const safeToAdd = toAdd.filter(c => c !== 'chessbar_id');

    if (toAdd.includes('chessbar_id')) {
        console.warn('Migration: column `chessbar_id` is missing. This script will not attempt to add a PRIMARY KEY column automatically.');
    }

    if (safeToAdd.length === 0) return cb(null);

    db.serialize(() => {
        safeToAdd.forEach((col) => {
            const def = desiredColumns[col];
            const sql = `ALTER TABLE users ADD COLUMN ${col} ${def}`;
            db.run(sql, (err) => {
                if (err) console.error(`Failed to add column ${col}:`, err);
                else console.log(`Added column ${col}`);
            });
        });
        // Give async statements a tick to run then callback
        db.wait ? db.wait(cb) : setTimeout(cb, 50);
    });
}

function ensureDefaultRow(cb) {
    db.get('SELECT COUNT(1) AS cnt FROM sqlite_master WHERE type = "table" AND name = "users"', (err, row) => {
        if (err) return cb(err);
        // Verify table exists, then ensure default row with formbar_id = -1
        db.get('SELECT COUNT(1) AS cnt FROM users WHERE formbar_id = ?', [-1], (err, r) => {
            if (err) return cb(err);
            if (r.cnt > 0) {
                console.log('Default user row exists.');
                return cb(null);
            }

            // Build an insert that only includes columns that exist in the table.
            getExistingColumns((err, cols) => {
                if (err) return cb(err);
                const insertCols = [];
                const insertVals = [];
                const placeholders = [];

                const valuesFor = {
                    chessbar_id: 0,
                    formbar_id: -1,
                    tokens: 0,
                    wins: 0,
                    losses: 0,
                    started: 0,
                    finished: 0,
                    draws: 0,
                    display_name: ''
                };

                cols.forEach(col => {
                    if (valuesFor.hasOwnProperty(col)) {
                        insertCols.push(col);
                        insertVals.push(valuesFor[col]);
                        placeholders.push('?');
                    }
                });

                const sql = `INSERT INTO users (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`;
                db.run(sql, insertVals, function (err) {
                    if (err) return cb(err);
                    console.log('Inserted default user row with formbar_id = -1');
                    cb(null);
                });
            });
        });
    });
}

// Run migration steps sequentially
db.serialize(() => {
    ensureUsersTable((err) => {
        if (err) return console.error('Failed to ensure users table:', err);
        getExistingColumns((err, existing) => {
            if (err) return console.error('Failed to read existing columns:', err);
            console.log('Existing columns:', existing.join(', '));
            addMissingColumns(existing, (err) => {
                if (err) return console.error('Failed to add missing columns:', err);
                ensureDefaultRow((err) => {
                    if (err) return console.error('Failed to ensure default row:', err);
                    console.log('Migration complete.');
                    db.close();
                });
            });
        });
    });
});
