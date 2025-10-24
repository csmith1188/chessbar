class Piece {
    constructor(side) {
        this.side = side
        this.name = this.constructor.name
    }

    move() { }
}

class Pawn extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(board, x1, y1, x2, y2) {
        if (x1 == x2 && Math.abs(y2 - y1) <= 2) {
            if (y2 < y1) {
                if (y1 - y2 > 0 && this.side == 'white' && !board[y1 - 1][x1] && !board[y2][x2]) {
                    return true
                }
            } else {
                if (y1 - y2 < 0 && this.side == 'black' && !board[y1 + 1][x1] && !board[y2][x2]) {
                    return true
                }
            }
        } else if (Math.abs(x2 - x1) == 1 && Math.abs(y2 - y1) == 1 && board[y2][x2] && board[y2][x2].side != this.side) {
            if (this.side == 'white' && y2 < y1) {
                return true
            } else if (this.side == 'black' && y2 > y1) {
                return true
            }
        }

        return false
    }
}

class King extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(board, x1, y1, x2, y2) {
        if (
            (Math.abs(x2 - x1) == 1 && y1 == y2) ||
            (Math.abs(y2 - y1) == 1 && x1 == x2) ||
            ((Math.abs(x2 - x1) == 1 && Math.abs(y2 - y1) == 1) && board[y2][x2].side != this.side)
        ) {
            return true
        }
        return false
    }
}

class Queen extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(board, x1, y1, x2, y2) {
        return true
    }
}

class Bishop extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(board, x1, y1, x2, y2) {
        return true
    }
}

class Knight extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(board, x1, y1, x2, y2) {
        return true
    }
}

class Rook extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(board, x1, y1, x2, y2) {
        return true
    }
}

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
    }

    occupied(x, y) {
        return !!this.layout[y][x]
    }
}

const classes = { Pawn, Rook, Knight, Bishop, Queen, King }

function attachSocket(io) {
    io.on('connection', (socket) => {

        socket.on('move', (board, piece, x2, y2) => {

            let x1 = piece.x
            let y1 = piece.y

            if (board[y1][x1] && y2 <= 7 && x2 <= 7 && x2 >= 0 && y2 >= 0) {
                let foo = new classes[piece.name](piece.side)
                if (board[y2][x2].side != piece.side && foo.validMove(board, x1, y1, x2, y2)) {
                    board[y1][x1] = 0
                    board[y2][x2] = foo
                }
            }
            io.emit('updateBoard', board)
        })

    })
}

module.exports = { Board, Piece, Pawn, King, Queen, Bishop, Knight, Rook, attachSocket };