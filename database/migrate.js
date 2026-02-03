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

// Desired schema for `friends` table (kept in sync with `database/init-db.js`).
const desiredFriendsColumns = {
    // Use an INTEGER PRIMARY KEY so SQLite will auto-increment the value
    // when the column is omitted from INSERT statements.
    friendship: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    id_1: 'INTEGER NOT NULL',
    id_2: 'INTEGER NOT NULL',
    status: "TEXT NOT NULL"
};

function ensureFriendsTable(cb) {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='friends'", (err, row) => {
        if (err) return cb(err);
        if (!row) {
            const cols = Object.entries(desiredFriendsColumns).map(([name, def]) => `${name} ${def}`).join(',\n        ');
            const createSql = `CREATE TABLE IF NOT EXISTS "friends" (\n        ${cols}\n    );`;
            db.run(createSql, (err) => cb(err));
        } else {
            cb(null);
        }
    });
}

function getExistingFriendColumns(cb) {
    db.all("PRAGMA table_info(friends);", (err, rows) => {
        if (err) return cb(err);
        const cols = rows.map(r => r.name);
        cb(null, cols);
    });
}

// Return full PRAGMA info for friends columns (used to inspect primary key)
function getFriendColumnsInfo(cb) {
    db.all("PRAGMA table_info(friends);", (err, rows) => {
        if (err) return cb(err);
        cb(null, rows);
    });
}

// If the `friendship` column exists but is NOT an INTEGER PRIMARY KEY,
// recreate the table with the correct schema and copy rows over. This
// will assign new autoincremented `friendship` ids to existing rows.
function ensureFriendshipIsPrimaryKey(cb) {
    getFriendColumnsInfo((err, rows) => {
        if (err) return cb(err);
        const friendshipCol = rows.find(r => r.name === 'friendship');
        if (!friendshipCol) return cb(null); // missing column handled elsewhere

        const isInteger = /^INTEGER/i.test(friendshipCol.type || '');
        const isPK = friendshipCol.pk === 1;

        if (isInteger && isPK) return cb(null); // already correct

        console.warn('Migration: `friendship` column exists but is not an INTEGER PRIMARY KEY. Recreating table to fix schema.');

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            const createSql = `CREATE TABLE IF NOT EXISTS friends_new (
        friendship INTEGER PRIMARY KEY AUTOINCREMENT,
        id_1 INTEGER NOT NULL,
        id_2 INTEGER NOT NULL,
        status TEXT NOT NULL
    );`;
            db.run(createSql, (err) => {
                if (err) {
                    console.error('Failed to create temporary friends_new table:', err);
                    db.run('ROLLBACK', () => cb(err));
                    return;
                }

                // Copy only id_1,id_2,status so new friendship ids are generated.
                db.run('INSERT INTO friends_new (id_1, id_2, status) SELECT id_1, id_2, status FROM friends', (err) => {
                    if (err) {
                        console.error('Failed to copy rows into friends_new:', err);
                        db.run('ROLLBACK', () => cb(err));
                        return;
                    }

                    db.run('DROP TABLE friends', (err) => {
                        if (err) {
                            console.error('Failed to drop old friends table:', err);
                            db.run('ROLLBACK', () => cb(err));
                            return;
                        }

                        db.run('ALTER TABLE friends_new RENAME TO friends', (err) => {
                            if (err) {
                                console.error('Failed to rename friends_new to friends:', err);
                                db.run('ROLLBACK', () => cb(err));
                                return;
                            }

                            db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('Failed to commit friends table migration:', err);
                                    return cb(err);
                                }
                                console.log('Recreated `friends` table with `friendship INTEGER PRIMARY KEY AUTOINCREMENT`.');
                                cb(null);
                            });
                        });
                    });
                });
            });
        });
    });
}

function addMissingFriendColumns(existing, cb) {
    const toAdd = Object.keys(desiredFriendsColumns).filter(c => !existing.includes(c));

    // Skip adding `friendship` if missing because adding a PRIMARY KEY or
    // changing the table's primary key isn't supported via simple ALTER TABLE.
    const safeToAdd = toAdd.filter(c => c !== 'friendship');

    if (toAdd.includes('friendship')) {
        console.warn('Migration: column `friendship` is missing. This script will not attempt to add a PRIMARY KEY/ AUTOINCREMENT column automatically. Manual migration may be required.');
    }

    if (safeToAdd.length === 0) return cb(null);

    db.serialize(() => {
        safeToAdd.forEach((col) => {
            const def = desiredFriendsColumns[col];
            const sql = `ALTER TABLE friends ADD COLUMN ${col} ${def}`;
            db.run(sql, (err) => {
                if (err) console.error(`Failed to add column ${col} to friends:`, err);
                else console.log(`Added column ${col} to friends`);
            });
        });
        db.wait ? db.wait(cb) : setTimeout(cb, 50);
    });
}

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
                // Ensure friends table exists and has required columns.
                ensureFriendsTable((err) => {
                    if (err) return console.error('Failed to ensure friends table:', err);
                    getExistingFriendColumns((err, fExisting) => {
                        if (err) return console.error('Failed to read existing friends columns:', err);
                        console.log('Existing friends columns:', fExisting.join(', '));
                        addMissingFriendColumns(fExisting, (err) => {
                            if (err) return console.error('Failed to add missing friends columns:', err);
                            // Ensure friendship is a proper INTEGER PRIMARY KEY AUTOINCREMENT
                            ensureFriendshipIsPrimaryKey((err) => {
                                if (err) return console.error('Failed to ensure friendship primary key:', err);
                                ensureDefaultRow((err) => {
                                    if (err) return console.error('Failed to ensure default row:', err);
                                    console.log('Migration complete.');
                                    db.close();
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
