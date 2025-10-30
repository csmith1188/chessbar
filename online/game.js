const { Board } = require('../engine/main')
let games = []
let takenGameIds = []

/*
 ::::::::      :::     ::::    ::::  ::::::::::
:+:    :+:   :+: :+:   +:+:+: :+:+:+ :+:
+:+         +:+   +:+  +:+ +:+:+ +:+ +:+
:#:        +#++:++#++: +#+  +:+  +#+ +#++:++#
+#+   +#+# +#+     +#+ +#+       +#+ +#+
#+#    #+# #+#     #+# #+#       #+# #+#
 ########  ###     ### ###       ### ##########
*/

class Game {
    constructor(visibility) {
        this.visibility = visibility
        this.id = 1

        while (takenGameIds.includes(this.id)) {
            this.id++
        }
        takenGameIds.push(this.id)

        this.users = []
        this.board = new Board()

        if (this.visibility == 'public') games.push(this)
        // console.log('\nGames:\n', games)

        this.update()
    }

    assignSides() {
        if (this.users[0]) this.users[0].side = 'white'
        if (this.users[1]) this.users[1].side = 'black'

        for (let user of this.users) {
            user.youAre()
        }
    }

    join(user) {
        console.log(`User ${user.id} is joining game ${this.id}.`)
        user.side = 'spectating'
        this.users.push(user)
        user.game = this
        this.assignSides()
        this.update()
    }

    leave(user) {
        console.log(`User ${user.id} is leaving game ${this.id}.`)
        this.users = this.users.filter(u => u.id !== user.id)
        this.assignSides()
        this.update()
    }

    update() {
        console.log(`Updating for ${this.users.length} user(s).`);

        for (let user of this.users) {
            user.youAre()
            user.socket.emit('updateBoard', this.board);
        }
    }
}

function serializeGame(game) {
    return {
        id: game.id,
        users: game.users.map(u => ({ id: u.id, side: u.side })),
        board: game.board // make sure board itself is serializable
    }
}

module.exports = { Game, games, takenGameIds, serializeGame }