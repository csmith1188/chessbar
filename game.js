const socket = io()

class Piece {
    constructor(board, side, img) {
        this.board = board
        this.side = side

        this.img = new Image()
        this.img.src = img
    }

    move() { }
}

class Pawn {
    constructor(board, side, img) {
        super(board, side, img)
    }

    validMove(x1, y1, x2, y2) {
        return true
    }
}
class King {
    constructor(board, side, img) {
        super(board, side, img)
    }

    validMove(x1, y1, x2, y2) {
        if ((Math.abs(x2 - x1) = 1 && y1 == y2) ||
            ((Math.abs(y2 - y1) == 1) && x1 == x2) ||
            ((Math.abs(x2 - x1) == 1) && (Math.abs(y2 - y1) == 1)) &&
            !this.board.occupied(x2, y2)) {
            return true
        }
    }
}
class Queen {
    constructor(board, side, img) {
        super(board, side, img)
    }

    validMove(x1, y1, x2, y2) {
        return true
    }
}
class Bishop {
    constructor(board, side, img) {
        super(board, side, img)
    }

    validMove(x1, y1, x2, y2) {
        return true
    }
}
class Knight {
    constructor(board, side, img) {
        super(board, side, img)
    }

    validMove(x1, y1, x2, y2) {
        return true
    }
}
class Rook {
    constructor(board, side, img) {
        super(board, side, img)
    }

    validMove(x1, y1, x2, y2) {
        return true
    }
}

class Board {
    constructor() {
        this.layout = [
            [new Rook(this, 'black'), new Knight(this, 'black'), new Bishop(this, 'black'), new King(this, 'black'), new Queen(this, 'black'), new Bishop(this, 'black'), new Knight(this, 'black'), new Rook(this, 'black')],
            [new Pawn(this, 'black'), new Pawn(this, 'black'), new Pawn(this, 'black'), new Pawn(this, 'black'), new Pawn(this, 'black'), new Pawn(this, 'black'), new Pawn(this, 'black'), new Pawn(this, 'black')],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [new Pawn(this, 'white'), new Pawn(this, 'white'), new Pawn(this, 'white'), new Pawn(this, 'white'), new Pawn(this, 'white'), new Pawn(this, 'white'), new Pawn(this, 'white'), new Pawn(this, 'white')],
            [new Rook(this, 'white'), new Knight(this, 'white'), new Bishop(this, 'white'), new Queen(this, 'white'), new King(this, 'white'), new Bishop(this, 'white'), new Knight(this, 'white'), new Rook(this, 'white')]
        ]
    }

    occupied(x, y) {
        if(this.layout[y][x]) return true
    }

}