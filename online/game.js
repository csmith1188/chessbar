const { Board } = require('../engine/main')
let games = []
let takenGameIds = []
let takenGameCodes = []

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
    constructor(visibility, name = null) {
        this.visibility = visibility
        this.id = 1

        while (takenGameIds.includes(this.id)) {
            this.id++
        }

        this.name = name ? name : this.id

        takenGameIds.push(this.id)

        this.users = []
        this.board = new Board()

        this.owner = null

        this.messages = []

        // generate a unique 6-digit join code
        let code = Math.floor(Math.random() * 900000) + 100000
        while (takenGameCodes.includes(code)) {
            code = Math.floor(Math.random() * 900000) + 100000
        }
        this.joinCode = code
        takenGameCodes.push(this.joinCode)

        games.push(this)
        // console.log('\nGames:\n', games)

        this.update()
    }

    assignSides() {

        if (!this.users.some(user => user.side == 'white')) {
            let foo = this.users.find(u => u.side == 'spectating')
            if (foo) foo.side = 'white'
        }

        if (!this.users.some(user => user.side == 'black')) {
            let foo = this.users.find(u => u.side == 'spectating')
            if (foo) foo.side = 'black'
        }

        for (let user of this.users) {
            user.youAre()
        }
    }

    join(user) {
        // console.log(`User ${user.id} is joining game ${this.id}.`)
        user.side = 'spectating'
        this.users.push(user)
        // if (this.users.length == 1) this.owner = user
        user.game = this
        this.assignSides()
        this.update()
    }

    leave(user) {
        // console.log(`User ${user.id} is leaving game ${this.id}.`)
        this.users = this.users.filter(u => u.id !== user.id)
        this.assignSides()
        this.update()
    }

    update(move = {}, check = false, mate = false, opponent = null, winner = null) {
        for (let user of this.users) {
            user.youAre()
            if (move && move.side == user.side && (move.y2 == 7 || move.y2 === 0) && move.name == 'Pawn') {
                user.socket.emit('promotion', move.x2, move.y2)
            }

            user.socket.emit('updateBoard', { board: this.board, move: move })
            if (check) user.socket.emit('check', { side: opponent })
            if (mate) user.socket.emit('mate', { winner: winner })
        }
    }

    chatMsg(sender, msg) {
        this.messages.push({ sender: sender, message: msg })
        for (let user of this.users) {
            user.socket.emit('chatMessage', sender, msg)
        }
    }
}

function serializeGame(game) {
    return {
        id: game.id,
        users: game.users.map(u => ({ id: u.id, side: u.side })),
        board: game.board,
        joinCode: game.joinCode,
        messages: game.messages,
        name: game.name,
        owner: game.owner.id,
        visibility: game.visibility
    }
}

module.exports = { Game, games, takenGameIds, serializeGame }