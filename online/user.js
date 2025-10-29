class User {
    constructor(id, socket) {
        this.id = id
        this.side = 'spectating'
        this.socket = socket

        socket.emit('youAre', {id: this.id, side: this.side})
    }
}

module.exports = { User }