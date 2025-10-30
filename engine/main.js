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
                        board.layout[y1][x1] = 0
                        if (dest) board.captured.push({ name: dest.name, side: dest.side })
                        board.layout[y2][x2] = foo
                        foo.moves++
                        board.turn = board.turn == 'white' ? 'black' : 'white'
                        console.log(`Move successful, it's now ${board.turn}'s turn.`)

                        // Only emit update to users in this game
                        for (let u of game.users) {
                            if (u && u.socket) u.socket.emit('updateBoard', board)
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