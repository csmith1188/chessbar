const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

// Small helpers to run queries with Promises
function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve(this);
    }));
}

function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
}

(async function migrate() {
    try {
        // Read `init-db.js` and extract all CREATE TABLE statements so we create
        // any tables present in the initializer but missing from the DB.
        const initPath = path.join(__dirname, 'init-db.js');
        const initContent = fs.readFileSync(initPath, 'utf8');

        // Capture SQL blocks that start with CREATE TABLE and end at the first closing
        // ");" following that (non-greedy).
        const createRe = /CREATE\s+TABLE[\s\S]*?\);/gi;
        const stmts = [];
        let m;
        while ((m = createRe.exec(initContent)) !== null) {
            // Normalize whitespace: trim leading/trailing and ensure it starts with CREATE
            const stmt = m[0].trim();
            stmts.push(stmt);
        }

        // Run each CREATE TABLE statement using IF NOT EXISTS semantics (should already
        // be present in the statements from init-db.js). This will create any missing tables.
        for (const s of stmts) {
            // If the statement already contains IF NOT EXISTS, use it as-is; otherwise add it.
            let withIf = s;
            if (!/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS/i.test(s)) {
                withIf = s.replace(/CREATE\s+TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
            }
            try {
                await runAsync(withIf);
                console.log('Ensured table from init script:', (withIf.split('\n')[0] || withIf).trim());
            } catch (err) {
                // Log and continue with other statements
                console.warn('Failed to run statement (continuing):', err.message || err);
            }
            // After ensuring the table exists, make sure all columns declared in the
            // init script are present in the actual table. For each missing column,
            // attempt to `ALTER TABLE ADD COLUMN` using a safe subset of the
            // original column definition (type + DEFAULT if present).
            try {
                const tableMatch = s.match(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+["'`]?([A-Za-z0-9_]+)["'`]*/i);
                if (tableMatch) {
                    const tableName = tableMatch[1];
                    const colBlockMatch = s.match(/\(([\s\S]*)\)\s*;?$/);
                    if (colBlockMatch) {
                        const colBlock = colBlockMatch[1];
                        // Split on commas that are not inside parentheses (to avoid splitting
                        // constraints that might contain commas).
                        const parts = colBlock.split(/,(?![^()]*\))/g).map(p => p.trim()).filter(Boolean);

                        const existingColsRows = await allAsync(`PRAGMA table_info(${tableName});`);
                        const existingCols = existingColsRows.map(r => r.name);

                        for (const part of parts) {
                            // Skip table-level constraints
                            if (/^(UNIQUE|CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY)/i.test(part)) continue;

                            const colMatch = part.match(/^["'`]?([A-Za-z0-9_]+)["'`]?[\s\t]+([\s\S]*)$/);
                            if (!colMatch) continue;
                            const colName = colMatch[1];
                            const rest = colMatch[2];

                            if (existingCols.includes(colName)) continue;

                            // Extract type (first token(s) until a constraint keyword) and DEFAULT if present
                            const typeMatch = rest.match(/^([A-Za-z0-9_()\s]+?)(?=\s+(NOT\s+NULL|DEFAULT|PRIMARY|UNIQUE|CHECK|REFERENCES)|$)/i);
                            const defaultMatch = rest.match(/DEFAULT\s+((?:'[^']*')|(?:"[^"]*")|[^\s)]+)/i);

                            const colType = typeMatch ? typeMatch[1].trim() : '';
                            const colDefault = defaultMatch ? defaultMatch[1] : null;

                            // Build a safe ADD COLUMN clause: include type and DEFAULT if present.
                            let addClause = '"' + colName + '"';
                            if (colType) addClause += ' ' + colType;
                            if (colDefault !== null) addClause += ' DEFAULT ' + colDefault;

                            try {
                                await runAsync(`ALTER TABLE "${tableName}" ADD COLUMN ${addClause}`);
                                console.log(`Added missing column ${colName} to ${tableName}`);
                            } catch (err) {
                                console.warn(`Failed to add column ${colName} to ${tableName} (continuing):`, err.message || err);
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn('Column sync check failed (continuing):', err.message || err);
            }
        }

        // Read existing columns from users and ensure a default formbar_id = -1 row exists
        const info = await allAsync("PRAGMA table_info(users);");
        const existing = info.map(r => r.name);

        const rows = await allAsync('SELECT COUNT(1) AS cnt FROM users WHERE formbar_id = ?', [-1]);
        if (rows.length === 0 || rows[0].cnt === 0) {
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

            const insertCols = [];
            const placeholders = [];
            const insertVals = [];

            for (const [k, v] of Object.entries(valuesFor)) {
                if (existing.includes(k)) {
                    insertCols.push(k);
                    placeholders.push('?');
                    insertVals.push(v);
                }
            }

            if (insertCols.length) {
                const sql = `INSERT INTO users (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`;
                await runAsync(sql, insertVals);
                console.log('Inserted default user row with formbar_id = -1');
            }
        }

        console.log('Migration complete.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        db.close();
    }
})();
