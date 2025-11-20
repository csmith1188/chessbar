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
        this.prevWhite = null
        this.prevBlack = null

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

    assignSides(newUser = null) {

        if (!this.users.some(user => user.side == 'white')) {
            let foo = this.users.find(u => u.side == 'unassigned')
            console.log(!!foo, !!this.prevBlack, !!this.prevWhite)
            if (foo) {
                foo.side = 'white'
                if (!this.prevWhite) {
                    foo.side = 'white'
                    this.prevWhite = foo
                    newUser.startedGame()
                } else if (newUser) {
                    //! Detects if the person who joined is not the original player
                    if (newUser.id !== this.prevWhite.id) {
                        foo.side = 'white'
                        this.prevWhite = newUser
                        newUser.startedGame()
                    }
                } else {
                    foo.side = 'white'
                }
            }
        }

        if (!this.users.some(user => user.side == 'black')) {
            let foo = this.users.find(u => u.side == 'unassigned')
            if (foo) {
                foo.side = 'black'
                if (!this.prevBlack) {
                    foo.side = 'black'
                    this.prevBlack = foo
                } else if (newUser) {
                    if (newUser.id !== this.prevBlack.id) {
                        foo.side = 'black'
                        newUser.startedGame()
                    }
                } else {
                    foo.side = 'black'
                }
            }
        }

        this.users.filter(u => u.side === 'unassigned').forEach(u => { u.side = 'spectator' })

        for (let user of this.activeUsers()) {
            user.youAre()
        }
    }

    join(user) {
        // console.log(`User ${user.id} is joining game ${this.id}.`)
        user.side = 'unassigned'
        this.users.push(user)
        // if (this.users.length == 1) this.owner = user
        user.game = this
        this.assignSides(user)
        this.update()
    }

    leave(user) {
        this.users = this.users.filter(u => u.id !== user.id)
        this.assignSides()
        this.update()
    }

    disconnect(user) {
        let leaving = this.users.find(u => u.id == user.id)
        leaving.active = false
    }

    reconnect(user) {
        let foo = this.users.find(u => u.id == user.id)
        if (foo) {
            foo.active = true
            console.log('reconnection')
            return true
        }

        return false

    }

    update(move = {}, check = false, mate = false, opponent = null, winner = null) {
        for (let user of this.activeUsers()) {
            user.youAre()
            if (move && move.side == user.side && (move.y2 == 7 || move.y2 === 0) && move.name == 'Pawn') {
                user.socket.emit('promotion', move.x2, move.y2)
            }

            user.socket.emit('updateBoard', { board: this.board, move: move })
            if (check) user.socket.emit('check', { side: opponent })
            if (mate) {
                user.socket.emit('mate', { winner: winner })
                let foo = this.users.find(u => u.side == winner) 
                foo.win()
                let foo2 = this.users.find(u => u.side == opponent) 
                foo2.lose()
            }
        }
    }

    activeUsers() {
        return this.users.filter(u => u.active == true)
    }

    chatMsg(sender, msg) {
        this.messages.push({ sender: sender, message: msg })
        for (let user of this.activeUsers()) {
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