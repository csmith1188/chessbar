/*
::::::::: ::::::::::: :::::::::: ::::::::  ::::::::::
:+:    :+:    :+:     :+:       :+:    :+: :+:
+:+    +:+    +:+     +:+       +:+        +:+
+#++:++#+     +#+     +#++:++#  +#+        +#++:++#
+#+           +#+     +#+       +#+        +#+
#+#           #+#     #+#       #+#    #+# #+#
###       ########### ########## ########  ##########
*/
class Piece {
    constructor(side, moves = 0) {
        this.side = side
        this.name = this.constructor.name
        this.moves = moves
    }

    move() { }
}
/*
:::::::::     :::     :::       ::: ::::    :::
:+:    :+:  :+: :+:   :+:       :+: :+:+:   :+:
+:+    +:+ +:+   +:+  +:+       +:+ :+:+:+  +:+
+#++:++#+ +#++:++#++: +#+  +:+  +#+ +#+ +:+ +#+
+#+       +#+     +#+ +#+ +#+#+ +#+ +#+  +#+#+#
#+#       #+#     #+#  #+#+# #+#+#  #+#   #+#+#
###       ###     ###   ###   ###   ###    ####
*/
class Pawn extends Piece {
    constructor(side, moves = 0) {
        super(side, moves)
    }

    validMove(board, x1, y1, x2, y2) {
        if (x1 == x2 && Math.abs(y2 - y1) == 1) {
            if (y1 - y2 > 0 && !board[y1 - 1][x1] && !board[y2][x2]) {
                return true
            }
            if (y1 - y2 < 0 && !board[y1 + 1][x1] && !board[y2][x2]) {
                return true
            }
        } else if (Math.abs(x2 - x1) == 1 && Math.abs(y2 - y1) == 1 && board[y2][x2] && board[y2][x2].side != this.side) {
            return true
        } else if (x1 == x2 && Math.abs(y2 - y1) == 2 && this.moves == 0) {
            if (y1 - y2 > 0 && !board[y1 - 1][x1] && !board[y2][x2]) {
                return true
            }
            if (y1 - y2 < 0 && !board[y1 + 1][x1] && !board[y2][x2]) {
                return true
            }
        }

        return false
    }
}
/*
:::    ::: ::::::::::: ::::    :::  ::::::::
:+:   :+:      :+:     :+:+:   :+: :+:    :+:
+:+  +:+       +:+     :+:+:+  +:+ +:+
+#++:++        +#+     +#+ +:+ +#+ :#:
+#+  +#+       +#+     +#+  +#+#+# +#+   +#+#
#+#   #+#      #+#     #+#   #+#+# #+#    #+#
###    ### ########### ###    ####  ########
*/
class King extends Piece {
    constructor(side, moves = 0) {
        super(side, moves)
    }

    validMove(board, x1, y1, x2, y2) {
        if (
            (Math.abs(x2 - x1) == 1 && y1 == y2) ||
            (Math.abs(y2 - y1) == 1 && x1 == x2) ||
            ((Math.abs(x2 - x1) == 1 && Math.abs(y2 - y1) == 1) && board[y2][x2].side != this.side)
        ) {
            return true
        } else if (y1 == y2 && this.moves == 0) {
            if (Math.abs(x2 - x1) == 2) {
                // Castling attempt: determine side (kingside if x2>x1, queenside if x2<x1)
                const dir = x2 - x1 > 0 ? 1 : -1
                const rookX = dir > 0 ? 7 : 0
                const rook = board[y1][rookX]

                // rook must exist, be a rook, same side, and not have moved
                if (!rook || rook.name !== 'Rook' || rook.side !== this.side || rook.moves !== 0) {
                    return false
                }

                // squares between king and rook must be empty
                const start = Math.min(x1, rookX) + 1
                const end = Math.max(x1, rookX) - 1
                for (let x = start; x <= end; x++) {
                    if (board[y1][x]) return false
                }

                // Move the rook to its castled square (next to the king's destination)
                const newRookX = x1 + dir
                board[y1][newRookX] = rook
                board[y1][rookX] = 0

                return true
            }
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
    constructor(side, moves = 0) {
        super(side, moves)
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
                nw = false
                break
            }
            if (ix < 0) {
                nw = false
                break
            }

            if (board[iy][ix]) {
                if (board[iy][ix].side == this.side) {
                    nw = false
                } else {
                    validMoves.push({ x: ix, y: iy })
                    nw = false
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
    constructor(side, moves = 0) {
        super(side, moves)
    }

    validMove(board, x1, y1, x2, y2) {

        let validMoves = []
        let ne, se, sw, nw
        ne = se = sw = nw = true

        let ix = x1
        let iy = y1

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
                nw = false
                break
            }
            if (ix < 0) {
                nw = false
                break
            }

            if (board[iy][ix]) {
                if (board[iy][ix].side == this.side) {
                    nw = false
                } else {
                    validMoves.push({ x: ix, y: iy })
                    nw = false
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
:::    ::: ::::    ::: ::::::::::: ::::::::  :::    ::: :::::::::::
:+:   :+:  :+:+:   :+:     :+:    :+:    :+: :+:    :+:     :+:
+:+  +:+   :+:+:+  +:+     +:+    +:+        +:+    +:+     +:+
+#++:++    +#+ +:+ +#+     +#+    :#:        +#++:++#++     +#+
+#+  +#+   +#+  +#+#+#     +#+    +#+   +#+# +#+    +#+     +#+
#+#   #+#  #+#   #+#+#     #+#    #+#    #+# #+#    #+#     #+#
###    ### ###    #### ########### ########  ###    ###     ###
*/
class Knight extends Piece {
    constructor(side, moves = 0) {
        super(side, moves)
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
/*
:::::::::   ::::::::   ::::::::  :::    :::
:+:    :+: :+:    :+: :+:    :+: :+:   :+:
+:+    +:+ +:+    +:+ +:+    +:+ +:+  +:+
+#++:++#:  +#+    +:+ +#+    +:+ +#++:++
+#+    +#+ +#+    +#+ +#+    +#+ +#+  +#+
#+#    #+# #+#    #+# #+#    #+# #+#   #+#
###    ###  ########   ########  ###    ###
*/
class Rook extends Piece {
    constructor(side, moves = 0) {
        super(side, moves)
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
module.exports = { Piece, Pawn, King, Queen, Bishop, Knight, Rook, }