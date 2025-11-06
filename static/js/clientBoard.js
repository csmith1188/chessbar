let pieces = []
selected = null

class Piece {
    constructor(x, y, img, name, side, moves) {
        this.x = x
        this.y = y
        this.w = Settings.boardSquareSize - Settings.defaultPieceMargin
        this.h = Settings.boardSquareSize - Settings.defaultPieceMargin

        this.moves = moves

        this.name = name
        this.side = side

        this.bx = Math.floor((x + this.w / 2) / Settings.boardSquareSize)
        this.by = Math.floor((y + this.h / 2) / Settings.boardSquareSize)

        this.img = new Image()
        this.img.src = img

        this.selected = false

        pieces.push(this)
    }

    hover() {
        if (!settingOpen && Mouse.x <= this.x + this.w && Mouse.y <= this.y + this.h && Mouse.y >= this.y && Mouse.x >= this.x) return true
    }

    update() {
        if (!selected && this.hover() && Mouse.left && this.side == me.side) {
            selected = this
            this.selected = true
        }

        if (this.selected) {
            this.x = Mouse.x - this.w / 2
            this.y = Mouse.y - this.h / 2
            prevMove = this.side == 'white' ? { x1: this.bx, y1: this.by, x2: null, y2: null } : { x1: this.bx, y1: 7 - this.by, x2: null, y2: null }
        }
    }

    draw() {
        if (!moveAnimation || (moveAnimation.bx2 !== this.bx || moveAnimation.by2 !== this.by) || moveAnimation.side !== this.side) {
            if (this.hover() && me.side == this.side) {
                ctx.drawImage(this.img, this.x - Settings.hoverSizeIncrease / 2, this.y - Settings.hoverSizeIncrease, this.w + Settings.hoverSizeIncrease, this.h + Settings.hoverSizeIncrease)
            } else {
                ctx.drawImage(this.img, this.x, this.y, this.w, this.h)
            }
        }
    }
}

class MovePiece {
    constructor(x1, y1, x2, y2, img, name, side) {
        this.x1 = x1 * Settings.boardSquareSize
        this.y1 = y1 * Settings.boardSquareSize
        this.x2 = x2 * Settings.boardSquareSize
        this.y2 = y2 * Settings.boardSquareSize

        this.bx2 = x2
        this.by2 = y2

        this.name = name
        this.side = side

        this.img = new Image()
        this.img.src = img

        this.startTime = performance.now()
        this.duration = moveAnimationDuration // ms
        this.done = false
    }

    updateAndDraw() {
        const elapsed = performance.now() - this.startTime
        const t = Math.min(elapsed / this.duration, 1) // 0→1

        // easeOutQuad for smooth slide
        const ease = 1 - Math.pow(1 - t, 2)

        const x = this.x1 + (this.x2 - this.x1) * ease
        const y = this.y1 + (this.y2 - this.y1) * ease

        const w = Settings.boardSquareSize - Settings.defaultPieceMargin
        const h = Settings.boardSquareSize - Settings.defaultPieceMargin

        ctx.drawImage(this.img, x + Settings.defaultPieceMargin / 2, y + Settings.defaultPieceMargin / 2, w, h)

        if (t >= 1) this.done = true
    }
}

/*
:::::::::  :::::::::      :::     :::       :::
:+:    :+: :+:    :+:   :+: :+:   :+:       :+:
+:+    +:+ +:+    +:+  +:+   +:+  +:+       +:+
+#+    +:+ +#++:++#:  +#++:++#++: +#+  +:+  +#+
+#+    +#+ +#+    +#+ +#+     +#+ +#+ +#+#+ +#+
#+#    #+# #+#    #+# #+#     #+#  #+#+# #+#+#
#########  ###    ### ###     ###   ###   ###
*/

function drawBoard() {

    for (let piece of pieces) {
        piece.update()
    }

    // Draw the board
    let color = (me && me.side == 'white') ? 'dark' : 'light'
    // Loop through 8x8 board
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {

            // Set alternating board square colors
            if (color == 'light') {
                ctx.fillStyle = Settings.lightSquareColor
                color = 'dark'
            } else {
                ctx.fillStyle = Settings.darkSquareColor
                color = 'light'
            }
            // Draw the square
            ctx.fillRect(x * Settings.boardSquareSize, y * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)

            // Draw the prevmove yellow highlight
            if (me && me.side == 'white') {
                // Make sure prevmove exists and has the properties we need

                // From square
                if (prevMove && prevMove.x1 == x && prevMove.y1 == y) {
                    ctx.fillStyle = Settings.moveColor
                    ctx.fillRect(x * Settings.boardSquareSize, y * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
                }

                // To square
                if (prevMove && prevMove.x2 !== null && prevMove.x2 == x && prevMove.y2 == y) {
                    ctx.fillStyle = Settings.moveColor
                    ctx.fillRect(x * Settings.boardSquareSize, y * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
                }

            } else {
                // If me is black, draw on the opposite side of the board

                // From
                if (prevMove && prevMove.x1 == x && 7 - prevMove.y1 == y) {
                    ctx.fillStyle = Settings.moveColor
                    ctx.fillRect(x * Settings.boardSquareSize, y * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
                }

                // To
                if (prevMove && prevMove.x2 !== null && prevMove.x2 == x && 7 - prevMove.y2 == y) {
                    ctx.fillStyle = Settings.moveColor
                    ctx.fillRect(x * Settings.boardSquareSize, y * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
                }
            }
            //check
            if (me && me.incheck == 'true' && me.side == 'white') {
                //find white king ???
                
                ctx.fillStyle = Settings.checkColor
                ctx.fillRect(x * Settings.boardSquareSize, y * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
            }
            if (me && me.incheck == 'true' && me.side == 'black') {
                //find black king
                ctx.fillStyle = Settings.checkColor
                ctx.fillRect(x * Settings.boardSquareSize, y * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
            }
        }
        // Alternate colors at the edge of the board
        color = (color == 'light') ? 'dark' : 'light'
    }

    if (board) {
        // If the mouse is up and there IS a selected piece, (dragged, then dropped), then emit the move
        if (!Mouse.left && selected) {
            // Make sure the piece I'm moving is one of mine
            if (me.side == selected.side) {
                // If I'm playing as black, make the move on the opposite side of the board.
                if (me.side == 'white') {
                    socket.emit('move', me,
                        // Piece
                        {
                            name: selected.name,
                            side: selected.side,
                            x: selected.bx,
                            y: selected.by,
                            moves: selected.moves
                        },
                        Math.floor((selected.x + selected.w / 2) / Settings.boardSquareSize), Math.floor((selected.y + selected.h / 2) / Settings.boardSquareSize))
                } else {
                    socket.emit('move', me,
                        {
                            name: selected.name,
                            side: selected.side,
                            x: selected.bx,
                            y: selected.by,
                            moves: selected.moves
                        },
                        Math.floor((selected.x + selected.w / 2) / Settings.boardSquareSize), Math.floor((selected.y + selected.h / 2) / Settings.boardSquareSize))
                }
            } else {
                // socket.emit('updateBoard', {board: board, move: {}})
            }

            // Nullify selected
            selected.selected = false
            selected = null
        }

        // Draw the pieces
        for (let piece of pieces) {
            if (piece.img && piece.img.complete) {
                piece.draw()
            }
        }
    }

}