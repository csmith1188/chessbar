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
        if (Mouse.x <= this.x + this.w && Mouse.y <= this.y + this.h && Mouse.y >= this.y && Mouse.x >= this.x) return true
    }

    update() {
        if (!selected && this.hover() && Mouse.left && this.side == me.side) {
            selected = this
            this.selected = true
        }

        if (this.selected) {
            this.x = Mouse.x - this.w / 2
            this.y = Mouse.y - this.h / 2
        }
    }

    draw() {
        if (this.hover() && me.side == this.side) {
            ctx.drawImage(this.img, this.x - Settings.hoverSizeIncrease / 2, this.y - Settings.hoverSizeIncrease, this.w + Settings.hoverSizeIncrease, this.h + Settings.hoverSizeIncrease)
        } else {
            ctx.drawImage(this.img, this.x, this.y, this.w, this.h)
        }
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
    // if (selected) console.log(selected.moves)

    if (!Mouse.left && selected) {
        if (me.side == selected.side) {
            if (me.side == 'white') {
                socket.emit('move', board, me,
                    {
                        name: selected.name,
                        side: selected.side,
                        x: selected.bx,
                        y: selected.by,
                        moves: selected.moves
                    },
                    Math.floor((selected.x + selected.w / 2) / Settings.boardSquareSize), Math.floor((selected.y + selected.h / 2) / Settings.boardSquareSize))
            } else {
                socket.emit('move', board, me,
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
            // socket.emit('updateBoard', board)
        }
        selected.selected = false
        selected = null
    }
    for (let piece of pieces) {
        piece.update()
    }

    let color = 'light'
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            if (color == 'light') {
                ctx.fillStyle = Settings.lightSquareColor
                color = 'dark'
            } else {
                ctx.fillStyle = Settings.darkSquareColor
                color = 'light'
            }
            ctx.fillRect(x * Settings.boardSquareSize, y * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
        }
        color = (color == 'light') ? 'dark' : 'light'
    }
    for (let piece of pieces) {
        if (piece.img && piece.img.complete) {
            piece.draw()
        }
    }

}