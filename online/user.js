let takenUserIds = []
class User {
    constructor(socket) {
        this.id = 1
        while( takenUserIds.includes(this.id)) {
            this.id++
        }
        takenUserIds.push(this.id)

        this.side = 'spectating'
        this.socket = socket

        socket.emit('youAre', {id: this.id, side: this.side})
    }
}

module.exports = { User, takenUserIds }