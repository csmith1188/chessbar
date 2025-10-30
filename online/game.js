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
        // console.log('Users:', this.users)

        this.users[0].side = 'white'
        // console.log('First user:', this.users[0])

        if (this.users[1]) this.users[1].side = 'black'

        for (let user of this.users) {
            user.socket.emit('youAre', {id: user.id, side: user.side})
        }
    }

    join(user) {
        console.log(`User ${user.id} is joining game ${this.id}.`)
        user.side = 'spectating'
        this.users.push(user)
        this.assignSides()
        this.update()
    }

    update() {
        console.log(`Updating for ${this.users.length} user(s).`);
    
        for (let user of this.users) {
            user.socket.emit('youAre', { id: user.id, side: user.side });
            // console.log(user.socket, this.board)
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