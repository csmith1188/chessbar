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
            [new Rook('black',), new Knight('black'), new Bishop('black'), new King('black'), new Queen('black'), new Bishop('black'), new Knight('black'), new Rook('black')],
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

function attachSocket(io) {
    io.on('connection', (socket) => {

        socket.on('move', (board, player, piece, x2, y2) => {
            let x1 = piece.x
            let y1 = piece.y

            if (piece.side == 'black') {
                x1 = 7 - x1
                x2 = 7 - x2
                y1 = 7 - y1
                y2 = 7 - y2
            }

            console.log(`\n${board.turn}'s turn.`)
            console.log(`${piece.side} ${piece.name.toLowerCase()} (${x1}, ${y1}) is attempting to move to (${x2}, ${y2})`)

            if (board.turn == player.side && !(x1 == x2 && y1 == y2)) {

                if (board.layout[y1][x1] && y2 <= 7 && x2 <= 7 && x2 >= 0 && y2 >= 0) {

                    let foo = new classes[piece.name](piece.side, piece.moves)

                    if (board.layout[y2][x2].side != piece.side && foo.validMove(board.layout, x1, y1, x2, y2)) {
                        board.layout[y1][x1] = 0
                        if (board.layout[y2][x2]) board.captured.push({ name: board.layout[y2][x2].name, side: board.layout[y2][x2].side })
                        board.layout[y2][x2] = foo
                        foo.moves++
                        board.turn = board.turn == 'white' ? 'black' : 'white'
                        console.log(`Move successful, it's now ${board.turn}'s turn.`)
                        io.emit('updateBoard', board)
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