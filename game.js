const socket = io()

class Piece {
    constructor (x, y, img) {
        this.x = x
        this.y = y
        this.img = new Image()
        this.img.src = img
    }
}

class Pawn {}
class King {}
class Queen {}
class Bishop {}
class Knight {}
class Rook {}

let board = [
    ['Br', 'Bkn', 'Bb', 'Bki', 'Bq', 'Bb', 'Bkn', 'Br'],
    ['Bp', 'Bp', 'Bp', 'Bp', 'Bp', 'Bp', 'Bp', 'Bp'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['Wp', 'Wp', 'Wp', 'Wp', 'Wp', 'Wp', 'Wp', 'Wp'],
    ['Wr', 'Wkn', 'Wb', 'Wq', 'Wki', 'Wb', 'Wkn', 'Wr']
]