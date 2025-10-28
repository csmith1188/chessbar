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
/*
 ::::::::  :::    ::: :::::::::: :::::::::: ::::    :::
:+:    :+: :+:    :+: :+:        :+:        :+:+:   :+:
+:+    +:+ +:+    +:+ +:+        +:+        :+:+:+  +:+
+#+    +:+ +#+    +:+ +#++:++#   +#++:++#   +#+ +:+ +#+
+#+  # +#+ +#+    +#+ +#+        +#+        +#+  +#+#+#
#+#   +#+  #+#    #+# #+#        #+#        #+#   #+#+#
 ###### ### ########  ########## ########## ###    ####
*/
class Queen extends Piece {
    constructor(side) {
        super(side)
    }

    validMove(board, x1, y1, x2, y2) {
        let validMoves = []

        let l, r, u, d, ne, se, sw, nw
        l = r = u = d = ne = se = sw = nw = true

        let ix = x1
        let iy = y1

        while (l) {
            ix--
            if (ix < 0) {
                l = false
                break
            }

            if (board[y1][ix]) {
                if (board[y1][ix].side == this.side) {
                    l = false
                } else {
                    validMoves.push({ x: ix, y: y1 })
                    l = false
                }
            } else {
                validMoves.push({ x: ix, y: y1 })
            }
        }

        ix = x1
        iy = y1

        while (r) {
            ix++
            if (ix > 7) {
                r = false
                break
            }

            if (board[y1][ix]) {
                if (board[y1][ix].side == this.side) {
                    r = false
                } else {
                    validMoves.push({ x: ix, y: y1 })
                    r = false
                }
            } else {
                validMoves.push({ x: ix, y: y1 })
            }
        }

        ix = x1
        iy = y1

        while (u) {
            iy++
            if (iy > 7) {
                u = false
                break
            }

            if (board[iy][x1]) {
                if (board[iy][x1].side == this.side) {
                    u = false
                } else {
                    validMoves.push({ x: x1, y: iy })
                    u = false
                }
            } else {
                validMoves.push({ x: x1, y: iy })
            }
        }

        ix = x1
        iy = y1

        while (d) {
            iy--
            if (iy < 0) {
                d = false
                break
            }

            if (board[iy][x1]) {
                if (board[iy][x1].side == this.side) {
                    d = false
                } else {
                    validMoves.push({ x: x1, y: iy })
                    d = false
                }
            } else {
                validMoves.push({ x: x1, y: iy })
            }
        }

        ix = x1
        iy = y1

        while (ne) {
            iy--
            ix++
            if (iy < 0) {
                ne = false
                break
            }
            if (ix > 7) {
                ne = false
                break
            }

            if (board[iy][ix]) {
                if (board[iy][ix].side == this.side) {
                    ne = false
                } else {
                    validMoves.push({ x: ix, y: iy })
                    ne = false
                }
            } else {
                validMoves.push({ x: ix, y: iy })
            }
        }

        ix = x1
        iy = y1

        while (se) {
            iy++
            ix++
            if (iy > 7) {
                se = false
                break
            }
            if (ix > 7) {
                se = false
                break
            }

            if (board[iy][ix]) {
                if (board[iy][ix].side == this.side) {
                    se = false
                } else {
                    validMoves.push({ x: ix, y: iy })
                    se = false
                }
            } else {
                validMoves.push({ x: ix, y: iy })
            }
        }

        ix = x1
        iy = y1

        while (sw) {
            iy++
            ix--
            if (iy > 7) {
                ne = false
                break
            }
            if (ix < 0) {
                ne = false
                break
            }

            if (board[iy][ix]) {
                if (board[iy][ix].side == this.side) {
                    ne = false
                } else {
                    validMoves.push({ x: ix, y: iy })
                    ne = false
                }
            } else {
                validMoves.push({ x: ix, y: iy })
            }
        }

        ix = x1
        iy = y1

        while (nw) {
            iy--
            ix--
            if (iy < 0) {
                ne = false
                break
            }
            if (ix < 0) {
                ne = false
                break
            }

            if (board[iy][ix]) {
                if (board[iy][ix].side == this.side) {
                    ne = false
                } else {
                    validMoves.push({ x: ix, y: iy })
                    ne = false
                }
            } else {
                validMoves.push({ x: ix, y: iy })
            }
        }

        for (let move of validMoves) {
            if (move.x == x2 && move.y == y2) return true
        }

        return false
    }
}
/*
::::::::: ::::::::::: ::::::::  :::    :::  ::::::::  :::::::::
:+:    :+:    :+:    :+:    :+: :+:    :+: :+:    :+: :+:    :+:
+:+    +:+    +:+    +:+        +:+    +:+ +:+    +:+ +:+    +:+
+#++:++#+     +#+    +#++:++#++ +#++:++#++ +#+    +:+ +#++:++#+
+#+    +#+    +#+           +#+ +#+    +#+ +#+    +#+ +#+
#+#    #+#    #+#    #+#    #+# #+#    #+# #+#    #+# #+#
######### ########### ########  ###    ###  ########  ###
*/
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
        let validMoves = []

        let l, r, u, d
        l = r = u = d = true

        let ix = x1
        let iy = y1

        while (l) {
            ix--
            if (ix < 0) {
                l = false
                break
            }

            if (board[y1][ix]) {
                if (board[y1][ix].side == this.side) {
                    l = false
                } else {
                    validMoves.push({ x: ix, y: y1 })
                    l = false
                }
            } else {
                validMoves.push({ x: ix, y: y1 })
            }
        }

        ix = x1
        iy = y1

        while (r) {
            ix++
            if (ix > 7) {
                r = false
                break
            }

            if (board[y1][ix]) {
                if (board[y1][ix].side == this.side) {
                    r = false
                } else {
                    validMoves.push({ x: ix, y: y1 })
                    r = false
                }
            } else {
                validMoves.push({ x: ix, y: y1 })
            }
        }

        ix = x1
        iy = y1

        while (u) {
            iy++
            if (iy > 7) {
                u = false
                break
            }

            if (board[iy][x1]) {
                if (board[iy][x1].side == this.side) {
                    u = false
                } else {
                    validMoves.push({ x: x1, y: iy })
                    u = false
                }
            } else {
                validMoves.push({ x: x1, y: iy })
            }
        }

        ix = x1
        iy = y1

        while (d) {
            iy--
            if (iy < 0) {
                d = false
                break
            }

            if (board[iy][x1]) {
                if (board[iy][x1].side == this.side) {
                    d = false
                } else {
                    validMoves.push({ x: x1, y: iy })
                    d = false
                }
            } else {
                validMoves.push({ x: x1, y: iy })
            }
        }

        for (let move of validMoves) {
            if (move.x == x2 && move.y == y2) return true
        }

        return false
    }
}

class Board {
    constructor() {
        this.layout = [
            [new Rook('black',), new Knight('black'), new Bishop('black'), new King('black'), new Queen('black'), new Bishop('black'), new Knight('black'), new Rook('black')],
            [new Pawn('black'), new Pawn('black'), new Pawn('black'), new Pawn('black'), new Pawn('black'), new Pawn('black'), new Pawn('black'), new Pawn('black')],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, new Queen('white'), 0, 0, 0],
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

                    let foo = new classes[piece.name](piece.side)

                    if (board.layout[y2][x2].side != piece.side && foo.validMove(board.layout, x1, y1, x2, y2)) {
                        board.layout[y1][x1] = 0
                        board.layout[y2][x2] = foo
                        board.turn = board.turn == 'white' ? 'black' : 'white'
                        console.log(`Move successful, it's now ${board.turn}'s turn.`)
                    } else {
                        console.log(`Still ${board.turn}'s turn, move failed (Invalid).`)
                    }
                } else {
                    console.log(`Still ${board.turn}'s turn, move failed (Off screen).`)
                }
            } else if (player.side == 'spectating') {

                console.log(`Spectators can't play, move failed.`)

            } else {

                console.log(`Still ${board.turn}'s turn, move failed.`)

            }
            io.emit('updateBoard', board)
        })

    })
}

module.exports = { Board, Piece, Pawn, King, Queen, Bishop, Knight, Rook, attachSocket };