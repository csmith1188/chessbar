class User {
    constructor(id, side, socket) {
        this.id = id
        this.side = side
        this.socket = socket
    }
}

module.exports = { User }