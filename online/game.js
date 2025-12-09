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

        this.winner = null
        this.loser = null

        this.messages = []

        this.paid = []

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

        this.users.forEach(u => u.side = 'unassigned')

        for (let user of this.users) {

            if (!this.prevBlack && !this.prevWhite) {
                // If user hasn't paid and isnt spectating
                if (!this.paid.some(u => u.id == user.id)) {
                    console.log(user.tokens)
                    if (user.tokens > 0) {
                        user.pay()
                        this.paid.push(user)
                    } else {
                        console.log(`User ${user.id} has not paid.`)
                        user.socket.emit('redirect', `/pay?code=${this.joinCode}`)
                        this.users = this.users.filter(u => u.id != user.id)
                        continue
                    }
                }
            }

            if (this.prevBlack && user.id == this.prevBlack.id) {
                if (!this.paid.some(u => u.id == user.id)) {
                    console.log(user.tokens)
                    if (user.tokens > 0) {
                        user.pay()
                        this.paid.push(user)
                    } else {
                        console.log(`User ${user.id} has not paid.`)
                        user.socket.emit('redirect', `/pay?code=${this.joinCode}`)
                        this.users = this.users.filter(u => u.id != user.id)
                        continue
                    }
                }
                user.side = 'black'
                continue
            }

            if (this.prevWhite && user.id == this.prevWhite.id) {
                if (!this.paid.some(u => u.id == user.id)) {
                    if (user.tokens) {
                        user.pay()
                        this.paid.push(user)
                    } else {
                        user.socket.emit('redirect', `/pay?code=${this.joinCode}`)
                        this.users = this.users.filter(u => u.id != user.id)
                        continue
                    }
                }
                user.side = 'white'
                continue
            }

            if (!this.users.some(u => u.side == 'white')) {
                if (!this.prevWhite) {
                    user.side = 'white'
                    this.prevWhite = user
                    continue
                }
            }

            if (!this.users.some(u => u.side == 'black')) {
                if (!this.prevBlack) {
                    user.side = 'black'
                    this.prevBlack = user
                    continue
                }
            }
        }

        this.users.filter(u => u.side === 'unassigned').forEach(u => { u.side = 'spectator' })

        for (let user of this.activeUsers()) {
            user.youAre()
        }
    }

    assignEarlyQuit() {
        this.users.filter(u => u.side === 'unassigned').forEach(u => { u.side = 'spectator' })

        for (let user of this.activeUsers()) {
            user.youAre()
        }
    }

    join(user) {
        user.side = 'unassigned'
        this.users.push(user)
        user.game = this
        this.assignSides()
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

    update(move = {}, check = false, mate = false, opponent = null, winner = null, takenPiece) {
        let promotion = false
        for (let user of this.activeUsers()) {

            user.youAre()

            if (move && move.side == user.side && (move.y2 == 7 || move.y2 === 0) && move.name == 'Pawn') {
                user.socket.emit('promotion', move.x2, move.y2)
                promotion = true
            }

            user.socket.emit('updateBoard', serializeGame(this))

            if (check) {
                user.socket.emit('check', { side: opponent })
            }

            if (mate) {
                user.socket.emit('mate', { winner: winner })
                if (!this.winner) {
                    let foo = this.users.find(u => u.side == winner)
                    foo.win()
                    this.winner = foo
                }

                if (!this.loser) {
                    let foo2 = this.users.find(u => u.side == opponent)
                    foo2.lose()
                    this.loser = foo2
                }
            }
            if (takenPiece == 'Queen') {
                user.socket.emit('sound', 'smash')
            } else if (mate) {
                user.socket.emit('sound', 'explosion')
            } else if (promotion) {
                user.socket.emit('sound', 'tada')
            } else if (check) {
                user.socket.emit('sound', 'check')
            } else if (takenPiece) {
                user.socket.emit('sound', 'break')
            } else if (move) {
                user.socket.emit('sound', 'move')
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
        users: game.users.map(u => (u.serialize())),
        board: game.board,
        joinCode: game.joinCode,
        messages: game.messages,
        name: game.name,
        owner: game.owner.id,
        visibility: game.visibility,
        prevBlack: game.prevBlack ? game.prevBlack.serialize() : 'none',
        prevWhite: game.prevWhite ? game.prevWhite.serialize() : 'none'
    }
}

module.exports = { Game, games, takenGameIds, serializeGame }