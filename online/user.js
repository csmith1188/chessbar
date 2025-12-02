let takenUserIds = []
class User {
    // sessionUser is the object from req.session.user (Formbar info) if present
    constructor(socket, sessionUser = null) {
        this.socket = socket

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

        this.youAre()
    }

    youAre() {
        this.displayName = this.sessionUser && this.sessionUser.displayName ? this.sessionUser.displayName : `Guest${this.id}`
        this.socket.emit('youAre', {
            id: this.id,
            side: this.side,
            displayName: this.displayName,
            game: this.game ? { id: this.game.id, joinCode: this.game.joinCode } : null,
            tokens: this.tokens
        })
    }

    getInfo(db) {
        db.get(`SELECT * FROM users WHERE formbar_id = ${this.id}`, (err, user) => {
            if (user) {
                this.tokens = user.tokens
                this.wins = user.wins
                this.losses = user.losses
                this.draws = user.draws
                this.started = user.started
                this.finished = user.finished
            }
        })

    }
    addTokens(db, amount = 1) {
        this.getInfo(db)
        db.get(`SELECT * FROM users WHERE formbar_id = ${this.id}`, (err, user) => {
            if (user) db.run(`UPDATE users SET tokens = ${this.tokens + amount} WHERE formbar_id = ${this.id}`)
            this.tokens += amount
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
                        db.run(
                            `INSERT INTO users(formbar_id, tokens, wins, losses, draws, started, finished) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [this.id, 0, 0, 0, 0, 0, 0],
                            (err) => {
                                if (err) return console.error('Error updating user in database:', err);
                                console.log('Inserted new user:', this.id);
                            }
                        );
                    } else {
                        // console.log('User already exists:', user);
                    }
                }
            )
        }
    }

    startedGame() {
        // console.log(this.started)
        this.started++
        db.run(`UPDATE users SET started = ${this.started} WHERE formbar_id = ${this.id}`)
        // console.log(this.started)
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

    finishGame() {
        this.finished++
        db.run(`UPDATE users SET finished = ${this.finished} WHERE formbar_id = ${this.id}`)
    }

    spend(db) {
        this.getInfo(db)
        if (this.tokens > 0) {
            this.tokens--
            db.run(`UPDATE users SET tokens = ${this.tokens} WHERE formbar_id = ${this.id}`)
            return true
        } 
        return false
    }
}

let db

function userSocket(io, db1) {
    db = db1
    io.on('connection', (socket) => {
        socket.on('getUser', (uid) => {
            db.get('SELECT * FROM users WHERE formbar_id = ?', [uid], (err, user) => {
                if (err || !user) return socket.emit('noUser');

                return socket.emit('foundUser', user);
            })
        })
    })
}

module.exports = { User, takenUserIds, userSocket }