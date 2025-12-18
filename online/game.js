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
    constructor(visibility, name = null, chatOn = true, startWhite = true) {
        this.visibility = visibility
        this.id = 1

        while (takenGameIds.includes(this.id)) {
            this.id++
        }

        this.chatOn = chatOn
        this.startWhite = startWhite

        this.name = name ? name : this.id

        takenGameIds.push(this.id)

        this.users = []
        this.board = new Board()

        this.owner = null
        this.prevWhite = null
        this.prevBlack = null

        this.winner = null
        this.loser = null

        this.prevMove = {}

        this.messages = []

        this.paid = []

        // Promotion state: whether a promotion is awaiting resolution and which side owns it
        this.promotionPending = false
        this.promotionSide = null
        this.promotionCoords = null

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
                // If user hasn't paid and isn't spectating, make them pay
                if (!this.paid.some(u => u.id == user.id)) {
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

            // If the player is already in the game on a certain side, reconnect them to the game. This also ensures nobody can take your place when you leave the game.
            if (this.prevBlack && user.id == this.prevBlack.id) {
                if (!this.paid.some(u => u.id == user.id)) {
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

            // Assign player sides once they have paid
            if (this.startWhite) {
                if (!this.users.some(u => u.side == 'white')) {
                    if (!this.prevWhite) {
                        user.side = 'white'
                        this.prevWhite = user
                        user.startedGame()
                        continue
                    }
                }

                if (!this.users.some(u => u.side == 'black')) {
                    if (!this.prevBlack) {
                        user.side = 'black'
                        this.prevBlack = user
                        user.startedGame()
                        continue
                    }
                }
            } else {
                // Do this in backwards order if startWhite is false
                if (!this.users.some(u => u.side == 'black')) {
                    if (!this.prevBlack) {
                        user.side = 'black'
                        this.prevBlack = user
                        user.startedGame()
                        continue
                    }
                }

                if (!this.users.some(u => u.side == 'white')) {
                    if (!this.prevWhite) {
                        user.side = 'white'
                        this.prevWhite = user
                        user.startedGame()
                        continue
                    }
                }
            }
        }

        this.users.filter(u => u.side === 'unassigned').forEach(u => { u.side = 'spectator' })

        for (let user of this.activeUsers()) {
            user.youAre()
        }

        this.update()
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

    update(move = {}, check = false, mate = false, opponent = null, winner = null, takenPiece = null) {
        if (move) this.prevMove = move

        let promotion = false
        for (let user of this.users) {

            user.youAre()

            // Only request promotion once per move: use a flag on the move object
            if (move && move.side == user.side && (move.y2 == 7 || move.y2 === 0) && move.name == 'Pawn') {
                // If we haven't already requested promotion for this move and it's not already handled
                if (!move._promotionRequested && !move._promotionHandled) {
                    // notify the mover client to pick promotion
                    user.socket.emit('promotion', move.x2, move.y2)
                    move._promotionRequested = true
                    promotion = true

                    // set server-side promotion state (only once)
                    if (!this.promotionPending) {
                        this.promotionPending = true
                        this.promotionSide = move.side
                        this.promotionCoords = { x: move.x2, y: move.y2 }
                    }
                }
            }

            // Update for the users
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

    // Helper to clear promotion state after server-side promotion handling completes
    startPromotion(x, y, side) {
        this.promotionPending = true
        this.promotionSide = side
        this.promotionCoords = { x, y }
        this.update() // broadcast updated state
    }

    endPromotion() {
        this.promotionPending = false
        this.promotionSide = null
        this.promotionCoords = null
        this.update() // broadcast updated state
    }

    // Apply a promotion choice coming from a client.
    // Validate the user is allowed to promote, attempt to update the Board,
    // then clear the promotion lock so the opponent can move.
    applyPromotionChoice(user, x, y, pieceName) {
        // Only accept if a promotion is pending and the requester is the promoting side
        if (!this.promotionPending) return
        if (!user || user.side !== this.promotionSide) return

        // Try to apply promotion using engine API if available
        try {
            if (this.board && typeof this.board.promote === 'function') {
                // engine-specific promote: signature may vary; try common shapes
                try {
                    // Prefer (x,y,pieceName,side)
                    this.board.promote(x, y, pieceName, user.side)
                } catch (e) {
                    // fallback to (x,y,pieceName)
                    this.board.promote(x, y, pieceName)
                }
            } else if (this.board && this.board.layout && Array.isArray(this.board.layout)) {
                // Best-effort fallback: replace layout cell with a simple object
                if (this.board.layout[y] && this.board.layout[y][x]) {
                    this.board.layout[y][x] = { name: pieceName, side: user.side, moves: [] }
                }
            }

            // Ensure the board turn advances so the opponent can move.
            if (this.board) {
                if (typeof this.board.turn !== 'undefined') {
                    this.board.turn = (user.side === 'white') ? 'black' : 'white'
                } else if (this.board.currentPlayer) {
                    this.board.currentPlayer = (user.side === 'white') ? 'black' : 'white'
                }
            }
        } catch (err) {
            console.error('applyPromotionChoice error:', err)
        }

        // Mark prevMove as handled so update() won't re-request promotion for the same move
        if (this.prevMove) {
            this.prevMove._promotionHandled = true
            // remove the requested flag to avoid confusion on future moves
            delete this.prevMove._promotionRequested
        }

        // Clear promotion state and broadcast the updated game so the opponent can move
        this.endPromotion()
        // endPromotion calls update(), broadcasting the cleared promotion and board state
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

    emptyUpdate(socket) {
        socket.emit('updateBoard', serializeGame(this))
    }
}

function serializeGame(game) {
    return {
        move: game.prevMove,
        id: game.id,
        users: game.users.map(u => (u.serialize())),
        board: game.board,
        joinCode: game.joinCode,
        messages: game.messages,
        name: game.name,
        owner: game.owner.id,
        visibility: game.visibility,
        prevBlack: game.prevBlack ? game.prevBlack.serialize() : null,
        prevWhite: game.prevWhite ? game.prevWhite.serialize() : null,
        // Promotion metadata so clients can disable moves while promotion is unresolved
        promotionPending: game.promotionPending || false,
        promotionSide: game.promotionSide || null,
        promotionCoords: game.promotionCoords || null
    }
}

module.exports = { Game, games, takenGameIds, serializeGame }