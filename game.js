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

    validMove(x1, y1, x2, y2) {
        return true
    }
}

class King extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(x1, y1, x2, y2) {
        if ((Math.abs(x2 - x1) == 1 && y1 == y2) ||
            ((Math.abs(y2 - y1) == 1) && x1 == x2) ||
            ((Math.abs(x2 - x1) == 1) && (Math.abs(y2 - y1) == 1)) &&
            !this.board.occupied(x2, y2)) {
            return true
        }
    }
}

class Queen extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(x1, y1, x2, y2) {
        return true
    }
}

class Bishop extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(x1, y1, x2, y2) {
        return true
    }
}

class Knight extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(x1, y1, x2, y2) {
        return true
    }
}

class Rook extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(x1, y1, x2, y2) {
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
        if (this.layout[y][x]) return true
    }
}

module.exports = { Board, Piece, Pawn, King, Queen, Bishop, Knight, Rook };