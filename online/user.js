let takenUserIds = []
class User {
    // sessionUser is the object from req.session.user (Formbar info) if present
    constructor(socket, sessionUser = null) {
        // Always create the `socket` property (may be `null` when disconnected)
        this.socket = socket || null

        // If the user signed in via Formbar, prefer their Formbar id
        if (sessionUser && sessionUser.id) {
            this.id = sessionUser.id
            // avoid duplicate entries in takenUserIds
            if (!takenUserIds.includes(this.id)) takenUserIds.push(this.id)
        } else {
            // Negative ID to show that a user is not signed in with Formbar
            this.id = -1
            while (takenUserIds.includes(this.id)) {
                this.id--
            }
            takenUserIds.push(this.id)
        }

        this.tokens = 0

        this.side = 'spectating'

        this.sessionUser = sessionUser || null

        this.started = 0
        this.finished = 0
        this.wins = 0
        this.losses = 0
        this.draws = 0

        this.game = null
        this.active = true
        // timestamp (ms since epoch) when the user went inactive; null when active
        this.lastActiveAt = null

        this.getInfo(db)
        // initialize a sensible displayName immediately, then emit it.
        this.displayName = this.computeDefaultDisplayName()
        this.youAre()
    }

    computeDefaultDisplayName() {
        if (this.sessionUser) {
            return this.sessionUser.displayName || this.sessionUser.display_name || this.sessionUser.name || this.sessionUser.email || `Guest${this.id}`
        }
        return `Guest${this.id}`
    }

    youAre() {
        // Emit current known info immediately; getInfo will re-emit if DB provides a different display_name.
        if (this.socket) this.socket.emit('youAre', this.serialize())
    }

    getInfo(db) {
        db.get(`SELECT * FROM users WHERE formbar_id = ?`, [this.id], (err, user) => {
            if (err) return console.error('DB error in getInfo:', err)
            if (user) {
                this.tokens = typeof user.tokens === 'number' ? user.tokens : this.tokens
                this.wins = typeof user.wins === 'number' ? user.wins : this.wins
                this.losses = typeof user.losses === 'number' ? user.losses : this.losses
                this.draws = typeof user.draws === 'number' ? user.draws : this.draws
                this.started = typeof user.started === 'number' ? user.started : this.started
                this.finished = typeof user.finished === 'number' ? user.finished : this.finished
                // prefer DB display_name if non-empty, otherwise persist a sensible fallback
                if (typeof user.display_name === 'string' && user.display_name.trim() !== '') {
                    this.displayName = user.display_name
                } else {
                    // DB is missing a display_name; ensure we have a reasonable default and persist it
                    const fallback = this.computeDefaultDisplayName()
                    if (fallback && fallback !== user.display_name) {
                        // update DB so future reads have the value
                        db.run(`UPDATE users SET display_name = ? WHERE formbar_id = ?`, [fallback, this.id], (updateErr) => {
                            if (updateErr) return console.error('Failed to set fallback display_name in getInfo:', updateErr)
                            this.displayName = fallback
                            if (this.socket) this.socket.emit('youAre', this.serialize())
                        })
                    } else {
                        this.displayName = fallback
                        if (this.socket) this.socket.emit('youAre', this.serialize())
                    }
                }
            }
        })

    }
    addTokens(db, amount = 1) {
        this.getInfo(db)
        db.get(`SELECT * FROM users WHERE formbar_id = ?`, [this.id], (err, user) => {
            if (err) return console.error('DB error in addTokens:', err)
            if (user) {
                const newTokens = this.tokens + amount
                db.run(`UPDATE users SET tokens = ? WHERE formbar_id = ?`, [newTokens, this.id])
                this.tokens = newTokens
            }
        })
    }

    addToDb(db) {
        if (this.id > 0) {
            db.get(
                `SELECT * FROM users WHERE formbar_id = ?`,
                [this.id],
                (err, user) => {
                    if (err) return console.error('Error adding user to database:', err);

                    if (!user) {
                        // Insert with display_name included. Use parameterized query.
                        const toInsertName = this.displayName || this.computeDefaultDisplayName()
                        db.run(
                            `INSERT INTO users(formbar_id, tokens, wins, losses, draws, started, finished, display_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                            [this.id, 0, 0, 0, 0, 0, 0, toInsertName],
                            (err) => {
                                if (err) return console.error('Error inserting new user in database:', err);
                                console.log('Inserted new user:', this.id);
                            }
                        );
                    } else {
                        // If the DB row exists but lacks `display_name`, add the column and update it.
                        if (typeof user.display_name === 'undefined') {
                            db.run(`ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''`, (alterErr) => {
                                if (alterErr) return console.error('Failed to add display_name column:', alterErr)
                                const nameToSet = this.displayName || this.computeDefaultDisplayName()
                                db.run(`UPDATE users SET display_name = ? WHERE formbar_id = ?`, [nameToSet, this.id], (updateErr) => {
                                    if (updateErr) return console.error('Failed to set display_name for existing user:', updateErr)
                                    console.log('Added display_name for existing user:', this.id)
                                })
                            })
                        } else if ((!user.display_name || user.display_name.trim() === '') && this.displayName) {
                            // Column exists but empty, set it to current displayName or computed fallback
                            const nameToSet = this.displayName || this.computeDefaultDisplayName()
                            db.run(`UPDATE users SET display_name = ? WHERE formbar_id = ?`, [nameToSet, this.id], (updateErr) => {
                                if (updateErr) return console.error('Failed to update display_name for existing user:', updateErr)
                            })
                        }
                    }
                }
            )
        }
    }

    startedGame() {
        // console.log(this.started)
        this.started++
        db.run(`UPDATE users SET started = ${this.started} WHERE formbar_id = ${this.id}`)
    }

    win() {
        this.wins++
        db.run(`UPDATE users SET wins = ${this.wins} WHERE formbar_id = ${this.id}`)
        this.finishGame()
    }

    lose() {
        this.losses++
        db.run(`UPDATE users SET losses = ${this.losses} WHERE formbar_id = ${this.id}`)
        this.finishGame()
    }

    draw() {
        this.draws++
        db.run(`UPDATE users SET draws = ${this.draws} WHERE formbar_id = ${this.id}`)
        this.finishGame()
    }

    finishGame() {
        this.finished++
        db.run(`UPDATE users SET finished = ${this.finished} WHERE formbar_id = ${this.id}`)
    }

    pay() {
        // console.log(`Pay function called for ${this.displayName}. They currently have ${this.tokens} tokens`)
        this.getInfo(db)
        if (this.tokens > 0) {
            this.tokens--
            db.run(`UPDATE users SET tokens = ${this.tokens} WHERE formbar_id = ${this.id}`)
            this.getInfo(db)
            return true
        }
        this.getInfo(db)
        return false
    }

    serialize() {
        return {
            id: this.id,
            side: this.side,
            started: this.started,
            finished: this.finished,
            wins: this.wins,
            losses: this.losses,
            draws: this.draws,
            // derive `active` from the current socket connection state when possible
            active: (this.socket && this.socket.connected === true) ? true : !!this.active,
            lastActiveAt: this.lastActiveAt || null,
            displayName: this.displayName,
            game: this.game ? { id: this.game.id, joinCode: this.game.joinCode } : null
        }
    }
}

let db

function userSocket(io, db1) {
    db = db1
    io.on('connection', (socket) => {
        socket.on('getUser', (uid) => {
            db.get('SELECT * FROM users WHERE formbar_id = ?', [uid], (err, dbUser) => {
                if (err || !dbUser) return socket.emit('noUser');

                return socket.emit('foundUser', dbUser);
            })
        })
    })
}

module.exports = { User, takenUserIds, userSocket }