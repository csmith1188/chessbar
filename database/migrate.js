const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error('Failed to open DB:', err)
})

class Table {
    constructor(name, columns, meta = "") {
        this.name = name
        this.columns = columns
        this.meta = meta
    }

    create() {
        const columnDefs = this.columns.map(col => `${col.name} ${col.meta}`).join(', ');
        const sql = `CREATE TABLE IF NOT EXISTS ${this.name} (${columnDefs}${this.meta ? ', ' + this.meta : ''})`;
        db.run(sql, (err) => {
            if (err) console.error(`Error creating table ${this.name}:`, err);
        });
    }
}

class Column {
    constructor(name, meta = "") {
        this.name = name
        this.meta = meta
    }

    checkExistence(table) {
        return new Promise((resolve, reject) => {
            db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                const exists = rows.some(row => row.name === this.name);
                resolve(exists);
            });
        });
    }

    create(table) {
        db.run(`ALTER TABLE ${table} ADD ${this.name} ${this.meta}`, (err) => {
            if (err) console.error(`Error adding column ${this.name} to ${table}:`, err);
        });
    }
}

const tables = [
    new Table('users', [
        new Column('chessbar_id', 'INTEGER PRIMARY KEY AUTOINCREMENT'),
        new Column('formbar_id', 'INTEGER NOT NULL'),
        new Column('tokens', 'INTEGER NOT NULL DEFAULT 0'),
        new Column('wins', 'INTEGER NOT NULL DEFAULT 0'),
        new Column('losses', 'INTEGER NOT NULL DEFAULT 0'),
        new Column('started', 'INTEGER NOT NULL DEFAULT 0'),
        new Column('finished', 'INTEGER NOT NULL DEFAULT 0'),
        new Column('draws', 'INTEGER NOT NULL DEFAULT 0'),
        new Column('display_name', 'TEXT DEFAULT ""'),
        new Column('avatar', 'TEXT DEFAULT ""')
    ]),

    new Table('friends', [
        new Column('friendship', 'INTEGER PRIMARY KEY AUTOINCREMENT'),
        new Column('id_1', 'INTEGER NOT NULL'),
        new Column('id_2', 'INTEGER NOT NULL'),
        new Column('status', 'TEXT NOT NULL DEFAULT "friends"'),
    ], 'UNIQUE(id_1, id_2)'),

    new Table('notifications', [
        new Column('notification', 'INTEGER PRIMARY KEY AUTOINCREMENT'),
        new Column('user', 'INTEGER NOT NULL'),
        new Column('type', 'TEXT DEFAULT ""'),
        new Column('message', 'TEXT NOT NULL'),
        new Column('status', 'TEXT NOT NULL DEFAULT "unread"'),
        new Column('created_time', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'),
        new Column('read_time', 'DATETIME'),
    ])
];

// Create / modify the database

(async () => {
    try {
        for (let table of tables) {
            table.create();

            for (let column of table.columns) {
                const exists = await column.checkExistence(table.name);
                if (!exists) column.create(table.name);
            }
        }
    } catch (err) {
        console.log(err)
    } finally {
        db.close()
    }
})();
