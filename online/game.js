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
    constructor(visibility, name = null, chatOn = true, startWhite = true, time = null) {
        this.visibility = visibility
        this.id = 1

        while (takenGameIds.includes(this.id)) {
            this.id++
        }

        this.chatOn = chatOn
        this.startWhite = startWhite

        this.name = name ? name : this.id

        takenGameIds.push(this.id)

        //kayden's time
        this.whiteClock = time
        this.blackClock = time

        this.users = []
        this.board = new Board()

        // track leave timers keyed by user id so we can cancel if they rejoin
        this.leaveTimers = {}
        this.owner = null
        this.prevWhite = null
        this.prevBlack = null

        /* 
        List of moves so that players can scroll through them (should also come with serialized game).
        Example move:
        {
            from: {x, y}, 
            to: {x, y},
            takes: {false || name, side} 
        } 
        */
        this.moves = []

        this.winner = null
        this.loser = null

        this.prevMove = {}

        this.messages = []

        this.paid = []

        this.finished = false

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
        // If the joining user had an outstanding leave timer, cancel it (they rejoined)
        if (this.leaveTimers[user.id]) {
            clearTimeout(this.leaveTimers[user.id])
            delete this.leaveTimers[user.id]
        }

        this.users.push(user)
        user.game = this
        this.assignSides()
        this.update()
    }

    leave(user) {
        // Remove the user from the game users list
        this.users = this.users.filter(u => u.id !== user.id)

        // If the leaving user was a player (white/black), start a 60s timer to auto-resign them
        if (user.side === 'white' || user.side === 'black') {
            // Clear any existing timer for safety
            if (this.leaveTimers[user.id]) {
                clearTimeout(this.leaveTimers[user.id])
            }

            this.leaveTimers[user.id] = setTimeout(() => {
                // Only auto-resign if they did not rejoin
                const stillHere = this.users.some(u => u.id === user.id)
                if (!stillHere) {
                    this.autoResignById(user.id)
                }
                delete this.leaveTimers[user.id]
            }, 60 * 1000) //! Timeout goes here
        }

        this.assignSides()
        this.update()
    }

    update(move = {}, check = false, mate = false, stalemate = false, draw = false, opponent = null, winner = null, takenPiece = null) {
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
            // Also send clocks so clients get immediate clock values on updates
            try {
                user.socket.emit('updateClock', { whiteTime: this.whiteClock, blackTime: this.blackClock })
            } catch (e) {
                // ignore socket errors
            }

            if (check) {
                user.socket.emit('check', { side: opponent })
            }

            if (mate) {
                this.finished = true
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
                // Game finished by mate: clear any outstanding leave timers
                if (this.leaveTimers) {
                    for (let k in this.leaveTimers) {
                        try { clearTimeout(this.leaveTimers[k]) } catch (e) { }
                    }
                    this.leaveTimers = {}
                }
            }
            if (stalemate || draw) {
                this.finished = true

                // Emit a specific event for lack-of-material draws, keep 'stalemate' for true stalemate
                if (stalemate) {
                    user.socket.emit('stalemate', {})
                } else if (draw) {
                    user.socket.emit('draw', { reason: 'lack-of-material' })
                }

                // Record draws for both players once (prefer prevWhite/prevBlack if available)
                if (!this.drawRecorded) {
                    const whitePlayer = this.prevWhite || this.users.find(u => u.side == 'white')
                    const blackPlayer = this.prevBlack || this.users.find(u => u.side == 'black')
                    if (whitePlayer) whitePlayer.draw()
                    if (blackPlayer) blackPlayer.draw()
                    this.drawRecorded = true
                }

                // Clear any outstanding leave timers when the game finishes by stalemate/draw
                if (this.leaveTimers) {
                    for (let k in this.leaveTimers) {
                        try { clearTimeout(this.leaveTimers[k]) } catch (e) { }
                    }
                    this.leaveTimers = {}
                }
            }
            if (takenPiece == 'Queen') {
                user.socket.emit('sound', 'smash')
            } else if (mate) {
                user.socket.emit('sound', 'explosion')
            } else if (stalemate || draw) {
                user.socket.emit('sound', 'tada')
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
        this.emptyUpdate() // broadcast updated state
    }

    resign(user) {
        if (!this.finished && (user.side == 'white' || user.side == 'black')) {
            this.loser = user
            if (user.side == 'white') {
                this.winner = this.prevBlack
            } else {
                this.winner = this.prevWhite
            }

            if (this.winner && this.loser) {
                this.winner.win()
                this.loser.lose()

                this.users.forEach(u => u.socket.emit('resign', user.serialize()))

                this.finished = true

                // Clear any outstanding leave timers when the game finishes by resign
                if (this.leaveTimers) {
                    for (let k in this.leaveTimers) {
                        try { clearTimeout(this.leaveTimers[k]) } catch (e) { }
                    }
                    this.leaveTimers = {}
                }
            }
        }
    }

    autoResignById(userId) {
        // If game already finished do nothing
        if (this.finished) return

        // If the user rejoined, cancel
        if (this.users.some(u => u.id === userId)) return

        // Try to find the user object in prevWhite/prevBlack
        let userObj = null
        if (this.prevWhite && this.prevWhite.id === userId) userObj = this.prevWhite
        else if (this.prevBlack && this.prevBlack.id === userId) userObj = this.prevBlack

        if (!userObj) return

        // perform resign
        this.resign(userObj)

        // Emit a dedicated socket event to active users to display an alert (separate from chat)
        try {
            const name = userObj.displayName || `Player${userObj.id}`
            const payload = {
                type: 'auto-resign',
                title: 'Auto-Resign',
                message: `${name} has auto-resigned because of inactivity`,
                player: userObj.serialize()
            }

            for (let u of this.activeUsers()) {
                try { u.socket.emit('systemAlert', payload) } catch (e) { }
            }
        } catch (e) {
            // ignore failures
        }
    }

    endPromotion() {
        this.promotionPending = false
        this.promotionSide = null
        this.promotionCoords = null
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
        if (socket) {
            try { socket.emit('updateBoard', serializeGame(this)) } catch (e) { }
            return
        }

        // Broadcast to all users so clients are kept in sync when no socket is provided
        for (let u of this.users) {
            try { u.socket.emit('updateBoard', serializeGame(this)) } catch (e) { }
        }
    }
}

function serializeGame(game) {
    return {
        move: game.prevMove,
        id: game.id,
        users: game.users.map(u => (u.serialize())),
        board: game.board,
        whiteClock: typeof game.whiteClock === 'number' ? game.whiteClock : null,
        blackClock: typeof game.blackClock === 'number' ? game.blackClock : null,
        joinCode: game.joinCode,
        messages: game.messages,
        name: game.name,
        owner: game.owner ? game.owner.id : null,
        visibility: game.visibility,
        prevBlack: game.prevBlack ? game.prevBlack.serialize() : null,
        prevWhite: game.prevWhite ? game.prevWhite.serialize() : null,
        // Promotion metadata so clients can disable moves while promotion is unresolved
        promotionPending: game.promotionPending || false,
        promotionSide: game.promotionSide || null,
        promotionCoords: game.promotionCoords || null,
        finished: game.finished,
        moves: game.moves
    }
}

module.exports = { Game, games, takenGameIds, serializeGame }