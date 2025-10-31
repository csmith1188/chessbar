const { Pawn, King, Queen, Bishop, Knight, Rook } = require('./pieces')
/*
:::::::::   ::::::::      :::     :::::::::  :::::::::
:+:    :+: :+:    :+:   :+: :+:   :+:    :+: :+:    :+:
+:+    +:+ +:+    +:+  +:+   +:+  +:+    +:+ +:+    +:+
+#++:++#+  +#+    +:+ +#++:++#++: +#++:++#:  +#+    +:+
+#+    +#+ +#+    +#+ +#+     +#+ +#+    +#+ +#+    +#+
#+#    #+# #+#    #+# #+#     #+# #+#    #+# #+#    #+#
#########   ########  ###     ### ###    ### #########
*/
class Board {
    constructor() {
        this.layout = [
            [new Rook('black',), new Knight('black'), new Bishop('black'), new Queen('black'), new King('black'), new Bishop('black'), new Knight('black'), new Rook('black')],
            [new Pawn('black'), new Pawn('black'), new Pawn('black'), new Pawn('black'), new Pawn('black'), new Pawn('black'), new Pawn('black'), new Pawn('black')],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [new Pawn('white'), new Pawn('white'), new Pawn('white'), new Pawn('white'), new Pawn('white'), new Pawn('white'), new Pawn('white'), new Pawn('white')],
            [new Rook('white'), new Knight('white'), new Bishop('white'), new Queen('white'), new King('white'), new Bishop('white'), new Knight('white'), new Rook('white')]
        ]
        this.turn = 'white'
        this.captured = []
    }

    occupied(x, y) {
        return !!this.layout[y][x]
    }

    // Find king coordinates for a side on a given layout (or current board if layout omitted)
    findKing(side, layout = null) {
        const board = layout || this.layout
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const p = board[y][x]
                if (p && p.name === 'King' && p.side === side) return { x, y }
            }
        }
        return null
    }

    // Determine if square x,y is attacked by any piece of bySide on provided layout (or current board)
    isSquareAttacked(x, y, bySide, layout = null) {
        const board = layout || this.layout
        // Copy layout rows so we can safely pass to piece.validMove without mutating original when needed
        const copy = board.map(row => row.slice())

        for (let py = 0; py < 8; py++) {
            for (let px = 0; px < 8; px++) {
                const attacker = copy[py][px]
                if (!attacker || attacker.side !== bySide) continue

                // Pawns attack differently than they move; handle explicitly
                if (attacker.name === 'Pawn') {
                    if (attacker.side === 'white') {
                        if (py - 1 === y && Math.abs(px - x) === 1) return true
                    } else {
                        if (py + 1 === y && Math.abs(px - x) === 1) return true
                    }
                    continue
                }

                // Kings attack adjacent squares
                if (attacker.name === 'King') {
                    if (Math.max(Math.abs(px - x), Math.abs(py - y)) === 1) return true
                    // skip castling logic for attack detection
                    continue
                }

                try {
                    if (attacker.validMove(copy, px, py, x, y)) return true
                } catch (e) {
                    // If a piece's validMove mutates the board (some castling code does), ignore errors
                }
            }
        }

        return false
    }

    inCheck(side) {
        const king = this.findKing(side)
        if (!king) return false
        const opponent = side === 'white' ? 'black' : 'white'
        return this.isSquareAttacked(king.x, king.y, opponent)
    }

    // Simulate a move on a copy of the board and return whether `side` would be in check after it
    wouldBeInCheckAfterMove(x1, y1, x2, y2) {
        const copy = this.layout.map(row => row.slice())
        const moving = copy[y1][x1]
        // if nothing to move, can't be in check by moving
        if (!moving) return false

        // perform move on copy
        copy[y2][x2] = moving
        copy[y1][x1] = 0

        const side = moving.side

        // find king on copy
        const king = this.findKing(side, copy)
        if (!king) return false

        const opponent = side === 'white' ? 'black' : 'white'
        return this.isSquareAttacked(king.x, king.y, opponent, copy)
    }

    // Return true if `side` has any legal move that does not leave them in check
    hasLegalMoves(side) {
        for (let y1 = 0; y1 < 8; y1++) {
            for (let x1 = 0; x1 < 8; x1++) {
                const p = this.layout[y1][x1]
                if (!p || p.side !== side) continue

                for (let y2 = 0; y2 < 8; y2++) {
                    for (let x2 = 0; x2 < 8; x2++) {
                        // skip null moves
                        if (x1 === x2 && y1 === y2) continue
                        // destination must be on board
                        if (x2 < 0 || x2 > 7 || y2 < 0 || y2 > 7) continue

                        // can't capture own pieces
                        const dest = this.layout[y2][x2]
                        if (dest && dest.side === side) continue

                        try {
                            // Use a fresh instance similar to move handling to validate move shape
                            const foo = new classes[p.name](p.side, p.moves)
                            if (!foo.validMove(this.layout, x1, y1, x2, y2)) continue
                        } catch (e) {
                            continue
                        }

                        // if move doesn't leave side in check, it's legal
                        if (!this.wouldBeInCheckAfterMove(x1, y1, x2, y2)) return true
                    }
                }
            }
        }

        return false
    }
}

const classes = { Pawn, Rook, Knight, Bishop, Queen, King }

function attachSocket(io, games) {
    io.on('connection', (socket) => {

        socket.on('move', (player, piece, x2, y2) => {
            // Find the player's game (client should include game id in `player.game`)
            const game = games.find(g => g.id == player.game.id)

            if (!game) {
                console.log('Move received but no game found for player:', player)
                // send back a no-op board to the requesting socket so client can re-sync
                socket.emit('updateBoard', {})
                return
            }

            const board = game.board

            let x1 = piece.x
            let y1 = piece.y

            if (piece.side == 'black') {
                // x1 = 7 - x1
                // x2 = 7 - x2
                y1 = 7 - y1
                y2 = 7 - y2
            }

            console.log(`\n${board.turn}'s turn.`)
            console.log(`${piece.side} ${piece.name.toLowerCase()} (${x1}, ${y1}) is attempting to move to (${x2}, ${y2})`)

            if (board.turn == player.side && !(x1 == x2 && y1 == y2)) {

                if (board.layout[y1] && board.layout[y1][x1] && y2 <= 7 && x2 <= 7 && x2 >= 0 && y2 >= 0) {

                    let foo = new classes[piece.name](piece.side, piece.moves)

                    // destination may be empty (0) or occupied by opponent
                    const dest = board.layout[y2][x2]
                    const destIsOpponent = !dest || dest.side != piece.side

                    if (destIsOpponent && foo.validMove(board.layout, x1, y1, x2, y2)) {
                        // Reject moves that leave your own king in check
                        if (board.wouldBeInCheckAfterMove(x1, y1, x2, y2)) {
                            console.log(`Still ${board.turn}'s turn, move failed (Would leave king in check).`)
                            socket.emit('updateBoard', board)
                            return
                        }

                        board.layout[y1][x1] = 0
                        if (dest) board.captured.push({ name: dest.name, side: dest.side })
                        board.layout[y2][x2] = foo
                        foo.moves++
                        board.turn = board.turn == 'white' ? 'black' : 'white'
                        console.log(`Move successful, it's now ${board.turn}'s turn.`)

                        // After move, check for check or mate against the side to move
                        const opponent = board.turn
                        const inCheck = board.inCheck(opponent)
                        const isMate = inCheck && !board.hasLegalMoves(opponent)
                        // Log check / mate to server console
                        if (inCheck) console.log(`${opponent} is in check.`)
                        if (isMate) console.log(`Checkmate! ${foo.side} wins.`)

                        // Only emit update to users in this game, plus check/mate events
                        for (let u of game.users) {
                            if (u && u.socket) u.socket.emit('updateBoard', board)
                            if (inCheck && u && u.socket) u.socket.emit('check', { side: opponent })
                            if (isMate && u && u.socket) u.socket.emit('mate', { winner: foo.side })
                        }
                    } else {
                        console.log(`Still ${board.turn}'s turn, move failed (Invalid).`)
                        socket.emit('updateBoard', board)
                    }
                } else {
                    console.log(`Still ${board.turn}'s turn, move failed (Off screen).`)
                    socket.emit('updateBoard', board)
                }
            } else if (player.side == 'spectating') {

                console.log(`Spectators can't play, move failed.`)
                socket.emit('updateBoard', board)

            } else {
                console.log(`Still ${board.turn}'s turn, move failed.`)
                socket.emit('updateBoard', board)
            }

        })

    })
}

module.exports = { Board, attachSocket };