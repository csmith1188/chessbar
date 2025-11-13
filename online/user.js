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
            game: this.game ? { id: this.game.id, joinCode: this.game.joinCode } : null
        })
    }

    getTokens(db) {
        db.get(`SELECT * FROM users WHERE id = ${this.id}`, (err, user) => {
            if (user) this.tokens = user.tokens
        })
        // console.log(this.tokens)

    }
    addTokens(db, amount = 1) {
        this.getTokens(db)
        db.get(`SELECT * FROM users WHERE id = ${this.id}`, (err, user) => {
            if(user) db.run(`UPDATE users SET tokens = ${this.tokens + amount} WHERE id = ${this.id}`)
            this.tokens += amount
        })
    }

    addToDb(db) {
        if (this.id > 0) {
            db.get(
                `SELECT * FROM users WHERE id = ?`,
                [this.id],
                (err, user) => {
                    if (err) return console.error(err);

                    if (!user) {
                        db.run(
                            `INSERT INTO users(id, tokens) VALUES (?, ?)`,
                            [this.id, 0],
                            (err) => {
                                if (err) return console.error(err);
                                console.log("Inserted new user:", this.id);
                            }
                        );
                    } else {
                        console.log("User already exists:", user);
                    }
                }
            )
        }
    }
}

module.exports = { User, takenUserIds }