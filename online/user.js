let takenUserIds = []
class User {
    constructor(socket) {
        this.id = 1
        while (takenUserIds.includes(this.id)) {
            this.id++
        }
        takenUserIds.push(this.id)

        this.side = 'spectating'
        this.socket = socket

        this.game = null

        this.youAre()
    }

    youAre() {
        this.socket.emit('youAre', {
            id: this.id, 
            side: this.side, 
            game: this.game ? { id: this.game.id, joinCode: this.game.joinCode } : null
        })
    }
}

module.exports = { User, takenUserIds }