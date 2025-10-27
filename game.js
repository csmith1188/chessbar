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
            if (y1 - y2 > 0 && !board[y1 - 1][x1] && !board[y2][x2]) {
                return true
            }
            if (y1 - y2 < 0 && !board[y1 + 1][x1] && !board[y2][x2]) {
                return true
            }
        } else if (Math.abs(x2 - x1) == 1 && Math.abs(y2 - y1) == 1 && board[y2][x2] && board[y2][x2].side != this.side) {
            return true
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
        // Bishop moves diagonally - the absolute difference in x and y must be equal
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        
        if (dx !== dy || dx === 0) {
            return false;
        }
        
        // Check if the path is clear
        const xStep = x2 > x1 ? 1 : -1;
        const yStep = y2 > y1 ? 1 : -1;
        
        let x = x1 + xStep;
        let y = y1 + yStep;
        
        while (x !== x2 || y !== y2) {
            if (board[y][x]) {
                return false; // Path is blocked
            }
            x += xStep;
            y += yStep;
        }
        
        // Destination must be empty or contain opponent's piece
        return !board[y2][x2] || board[y2][x2].side !== this.side;
    }
}

class Knight extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(board, x1, y1, x2, y2) {
        if (Math.abs(y2 - y1) == 1 && Math.abs(x2 - x1) == 2 && (!board[y2][x2] || board[y2][x2].side != this.side)) {
            return true
        } else if (Math.abs(x2 - x1) == 1 && Math.abs(y2 - y1) == 2 && (!board[y2][x2] || board[y2][x2].side != this.side)) {
            return true
        }
        return false
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
        this.turn = 'white'
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

            if (piece.side == 'black') {
                x1 = 7 - x1
                x2 = 7 - x2
                y1 = 7 - y1
                y2 = 7 - y2
            }

            console.log(`\n${board.turn}'s turn.`)
            console.log(`${piece.side} ${piece.name.toLowerCase()} (${x1}, ${y1}) is attempting to move to (${x2}, ${y2})`)

            if (board.turn == piece.side && !(x1 == x2 && y1 == y2)) {

                if (board.layout[y1][x1] && y2 <= 7 && x2 <= 7 && x2 >= 0 && y2 >= 0) {

                    let foo = new classes[piece.name](piece.side)

                    if (board.layout[y2][x2].side != piece.side && foo.validMove(board.layout, x1, y1, x2, y2)) {
                        board.layout[y1][x1] = 0
                        board.layout[y2][x2] = foo
                        board.turn = board.turn == 'white' ? 'black' : 'white'
                        console.log(`Move successful, it's now ${board.turn}'s turn.`)
                    }
                }
            } else {
                console.log(`Still ${board.turn}'s turn, move failed.`)
            }
            io.emit('updateBoard', board)
        })

    })
}

module.exports = { Board, Piece, Pawn, King, Queen, Bishop, Knight, Rook, attachSocket };