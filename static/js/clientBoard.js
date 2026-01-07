let pieces = []
let selected = null
let arrows = []

function findKing() {
    // Return undefined if we don't yet know who "me" is
    if (!me) return

    let king
    king = pieces.find(piece => piece.name == 'King' && piece.side == me.side)
    // console.log(king)
    if (king) return king
}



class Arrow {
    constructor(x1, y1, x2, y2) {
        this.x1 = x1
        this.y1 = y1
        this.x2 = x2
        this.y2 = y2
    }

    draw() {
        if (!(this.x1 == this.x2 && this.y1 == this.y2)) {
            // Map board coordinates to canvas coordinates (center of square)
            let sx = this.x1
            let sy = this.y1
            let ex = this.x2
            let ey = this.y2

            // If player is black, the board is drawn flipped vertically elsewhere — match that here
            if (me && me.side === 'black') {
                sy = 7 - sy
                ey = 7 - ey
            }

            const startX = sx * Settings.boardSquareSize + Settings.boardSquareSize / 2
            const startY = sy * Settings.boardSquareSize + Settings.boardSquareSize / 2
            const endX = ex * Settings.boardSquareSize + Settings.boardSquareSize / 2
            const endY = ey * Settings.boardSquareSize + Settings.boardSquareSize / 2

            // Visual style: thick orange line with filled arrowhead
            const baseWidth = Math.max(6, Math.round(Settings.boardSquareSize * .25))
            let headLen = Math.max(10, Math.round(Settings.boardSquareSize * 0.3))

            ctx.save()
            ctx.strokeStyle = 'rgba(255, 157, 0, 0.7)'
            ctx.fillStyle = 'rgba(255, 157, 0, 0.7)'
            ctx.lineWidth = baseWidth
            ctx.lineCap = 'butt'

            // Compute angle and arrowhead geometry
            const angle = Math.atan2(endY - startY, endX - startX)

            // Offset the start a bit so the arrow doesn't draw over the piece at the origin
            const startOffset = Math.max(Math.round(Settings.boardSquareSize * 0.22), Math.round(baseWidth * 1.5))
            const offsetStartX = startX + Math.cos(angle) * startOffset
            const offsetStartY = startY + Math.sin(angle) * startOffset

            // Compute an end offset so the arrow tip doesn't overlap the target piece,
            // but guarantee there's room for a visible shaft (base) and the head
            const requestedEndOffset = Math.max(Math.round(Settings.boardSquareSize * 0.16), Math.round(baseWidth * 1.5))
            const len = Math.hypot(endX - startX, endY - startY)
            const desiredMinShaft = Math.max(baseWidth, Math.round(Settings.boardSquareSize * 0.08))

            // Max allowed endOffset so that: shaftLength = len - startOffset - endOffset - headLen >= desiredMinShaft
            const maxEndOffset = Math.max(0, Math.floor(len - startOffset - headLen - desiredMinShaft))
            let endOffset = Math.min(requestedEndOffset, maxEndOffset)

            // If there's little to no room even with endOffset reduced, shrink headLen (but keep a small minimum)
            if (len - startOffset - endOffset < desiredMinShaft + 4) {
                const newHead = Math.max(4, Math.floor(len - startOffset - endOffset - desiredMinShaft))
                if (newHead > 0) headLen = Math.min(headLen, newHead)
            }

            const tipX = endX - Math.cos(angle) * endOffset
            const tipY = endY - Math.sin(angle) * endOffset

            // Arrowhead (triangle) - compute base width from settings if available
            const arrowWidth = (typeof Settings !== 'undefined' && Settings.arrowHeadBaseWidth) ? Settings.arrowHeadBaseWidth : Math.max(10, Math.round(Settings.boardSquareSize * 0.3))

            // Base center is located `headLen` back from the tip along the shaft
            const baseCenterX = tipX - headLen * Math.cos(angle)
            const baseCenterY = tipY - headLen * Math.sin(angle)

            // Main shaft (start from the offset point, end at the base of the head)
            ctx.beginPath()
            ctx.moveTo(offsetStartX, offsetStartY)
            ctx.lineTo(baseCenterX, baseCenterY)
            ctx.stroke()

            // Perpendicular unit vector
            const perpX = Math.cos(angle + Math.PI / 2)
            const perpY = Math.sin(angle + Math.PI / 2)

            const half = arrowWidth / 2
            const p1x = baseCenterX + perpX * half
            const p1y = baseCenterY + perpY * half

            const p2x = baseCenterX - perpX * half
            const p2y = baseCenterY - perpY * half

            ctx.beginPath()
            ctx.moveTo(tipX, tipY)
            ctx.lineTo(p1x, p1y)
            ctx.lineTo(p2x, p2y)
            ctx.closePath()
            ctx.fill()

            ctx.restore()
        }
    }
}

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
        // If we don't know "me" yet or the server reports a promotion pending by the other side, block selection/dragging
        if (!me) return
        if (gameData && gameData.promotionPending && gameData.promotionSide && gameData.promotionSide !== me.side) {
            return
        }

        if (!selected && this.hover() && Mouse.left && this.side == me.side) {
            selected = this
            this.selected = true
            validMoves = []
            socket.emit('requestValidMoves', this.serialize())
        }

        if (this.selected) {
            this.x = Mouse.x - this.w / 2
            this.y = Mouse.y - this.h / 2
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

    serialize() {
        return {
            x: this.bx,
            y: this.by,
            name: this.name,
            side: this.side,
            moves: this.moves
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

// Valid moves for dots to draw
let validMoves = []

socket.on('validMoves', moves => {
    if (moves) validMoves = moves
})

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

            // Draw the selected piece highlight
            if (selected && selected.bx == x && selected.by == y) {
                ctx.fillStyle = Settings.moveColor
                ctx.fillRect(x * Settings.boardSquareSize, y * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
            }

            // Draw right-click highlights (red overlay) if present
            try {
                if (typeof highlightedSquares !== 'undefined') {
                    const key = `${x},${y}`
                    if (highlightedSquares.has(key)) {
                        ctx.fillStyle = 'rgba(255, 0, 0, 0.35)'
                        ctx.fillRect(x * Settings.boardSquareSize, y * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
                    }
                }
            } catch (err) { }

            // Dots to show where the pieces can move
            if (selected && validMoves && !pieces.some(piece => piece.bx == x && piece.by == y)) {
                const move = validMoves.find(m => m.x == x && m.y == y)

                if (move) {
                    const cx = x * Settings.boardSquareSize + Settings.boardSquareSize / 2;
                    const cy = y * Settings.boardSquareSize + Settings.boardSquareSize / 2;
                    const r = Settings.boardSquareSize / 8;

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

        }
        // Alternate colors at the edge of the board
        color = (color == 'light') ? 'dark' : 'light'
    }

    if (board) {
        // If the mouse is up and there IS a selected piece, (dragged, then dropped), then emit the move
        if (!Mouse.left && selected) {
            // If we don't know "me" yet or the server reports a promotion pending by the other side, do NOT emit any move — wait for promotion choice
            if (!me || (gameData && gameData.promotionPending && gameData.promotionSide && gameData.promotionSide !== me.side)) {
                // keep the piece selected until the promotion is resolved
            } else {
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
        }

        //check
        let king = findKing()
        if (on) {
            if (me && me.incheck == true && me.side == 'white') {
                ctx.fillStyle = Settings.checkColor
                ctx.fillRect(king.bx * Settings.boardSquareSize, king.by * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
                console.log('white check')
            }

            if (me && me.incheck == true && me.side == 'black') {
                ctx.fillStyle = Settings.checkColor
                ctx.fillRect(king.bx * Settings.boardSquareSize, king.by * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
                console.log('black check')
            }
        }

        // Draw the pieces
        for (let piece of pieces) {
            if (piece.img && piece.img.complete) {
                piece.draw()
            }
        }

        // Draw any arrows (on top of pieces)
        if (arrows && arrows.length) {
            for (let a of arrows) {
                a.draw()
            }
        }

        // Temporary arrow while right-dragging (not persisted until mouseup)
        try {
            if (Mouse && Mouse.right && Mouse.dragStartX !== null) {
                const sx = Math.floor(Mouse.dragStartX / Settings.boardSquareSize)
                const sy = Math.floor(Mouse.dragStartY / Settings.boardSquareSize)
                const ex = Math.floor(Mouse.x / Settings.boardSquareSize)
                const ey = Math.floor(Mouse.y / Settings.boardSquareSize)
                const clamp = (v) => Math.max(0, Math.min(7, v))
                let temp
                if (me.side == 'white') {
                    temp = new Arrow(clamp(sx), clamp(sy), clamp(ex), clamp(ey))
                } else {
                    temp = new Arrow(clamp(sx), clamp(7 - sy), clamp(ex), clamp(7 - ey))
                }
                temp.draw()
            }
        } catch (err) { }
    }

}

