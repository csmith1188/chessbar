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
            this.id = 1
            while (takenUserIds.includes(this.id)) {
                this.id++
            }
            takenUserIds.push(this.id)
        }

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
}

module.exports = { User, takenUserIds }