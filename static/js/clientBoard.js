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
            if (me && (me.side === 'black' || me.side === 'spectator')) {
                sy = 7 - sy
                ey = 7 - ey
            }

            const startX = sx * Settings.boardSquareSize + Settings.boardSquareSize / 2
            const startY = sy * Settings.boardSquareSize + Settings.boardSquareSize / 2
            const endX = ex * Settings.boardSquareSize + Settings.boardSquareSize / 2
            const endY = ey * Settings.boardSquareSize + Settings.boardSquareSize / 2

            // Visual style: thick orange line with filled arrowhead
            const baseWidth = Math.max(6, Math.round(Settings.boardSquareSize * .2))
            let headLen = Math.max(10, Math.round(Settings.boardSquareSize * 0.3))

            ctx.save()
            ctx.strokeStyle = 'rgba(255, 157, 0, 0.5)'
            ctx.fillStyle = 'rgba(255, 157, 0, 0.5)'
            ctx.lineWidth = baseWidth
            ctx.lineCap = 'butt'

            // Compute angle and arrowhead geometry
            const dxSquares = Math.abs(ex - sx)
            const dySquares = Math.abs(ey - sy)
            const isLShape = (dxSquares === 2 && dySquares === 1) || (dxSquares === 1 && dySquares === 2)

            // For straight arrows use single angle; for L-shape we'll compute two segment angles
            const angle = Math.atan2(endY - startY, endX - startX)

            // Offset the start a bit so the arrow doesn't draw over the piece at the origin
            const startOffset = Math.max(Math.round(Settings.boardSquareSize * 0.32), Math.round(baseWidth * 1.5))
            // For L-shaped arrows we'll offset along the first leg, otherwise along the straight angle
            let offsetStartX, offsetStartY

            // Compute an end offset so the arrow tip doesn't overlap the target piece,
            // but guarantee there's room for a visible shaft (base) and the head
            const requestedEndOffset = Math.max(Math.round(Settings.boardSquareSize * 0.16), Math.round(baseWidth * 1.5))
            const desiredMinShaft = Math.max(baseWidth, Math.round(Settings.boardSquareSize * 0.08))

            let tipX, tipY, endOffset, baseCenterX, baseCenterY, angle2

            if (!isLShape) {
                const len = Math.hypot(endX - startX, endY - startY)
                // Max allowed endOffset so that: shaftLength = len - startOffset - endOffset - headLen >= desiredMinShaft
                const maxEndOffset = Math.max(0, Math.floor(len - startOffset - headLen - desiredMinShaft))
                endOffset = Math.min(requestedEndOffset, maxEndOffset)

                // If there's little to no room even with endOffset reduced, shrink headLen (but keep a small minimum)
                if (len - startOffset - endOffset < desiredMinShaft + 4) {
                    const newHead = Math.max(4, Math.floor(len - startOffset - endOffset - desiredMinShaft))
                    if (newHead > 0) headLen = Math.min(headLen, newHead)
                }

                // Place tip at center of destination square
                tipX = endX
                tipY = endY

                // Offset start along the straight angle
                offsetStartX = startX + Math.cos(angle) * startOffset
                offsetStartY = startY + Math.sin(angle) * startOffset

                // Arrowhead (triangle) - compute base width from settings if available
                const arrowWidth = (typeof Settings !== 'undefined' && Settings.arrowHeadBaseWidth) ? Settings.arrowHeadBaseWidth : Math.max(10, Math.round(Settings.boardSquareSize * 0.3))

                // Base center is located `headLen` back from the tip along the shaft
                baseCenterX = tipX - headLen * Math.cos(angle)
                baseCenterY = tipY - headLen * Math.sin(angle)
                angle2 = angle

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
            } else {
                // L-shaped arrow: route via a corner (like a knight's L). Choose horizontal-first if dx>dy
                const horizontalFirst = Math.abs(ex - sx) > Math.abs(ey - sy)

                const midX = horizontalFirst ? endX : startX
                const midY = horizontalFirst ? startY : endY

                const seg1Angle = Math.atan2(midY - startY, midX - startX)
                const seg2Angle = Math.atan2(endY - midY, endX - midX)

                // Offset start along first segment
                offsetStartX = startX + Math.cos(seg1Angle) * startOffset
                offsetStartY = startY + Math.sin(seg1Angle) * startOffset

                // Compute length of second segment to determine endOffset/head fitting
                const seg2Len = Math.hypot(endX - midX, endY - midY)
                const maxEndOffset2 = Math.max(0, Math.floor(seg2Len - headLen - desiredMinShaft))
                endOffset = Math.min(requestedEndOffset, maxEndOffset2)

                // If necessary shrink headLen to fit
                if (seg2Len - endOffset < desiredMinShaft + 4) {
                    const newHead = Math.max(4, Math.floor(seg2Len - endOffset - desiredMinShaft))
                    if (newHead > 0) headLen = Math.min(headLen, newHead)
                }

                // Place tip at center of destination square
                tipX = endX
                tipY = endY

                // Arrowhead base center back from tip along final segment
                baseCenterX = tipX - headLen * Math.cos(seg2Angle)
                baseCenterY = tipY - headLen * Math.sin(seg2Angle)
                angle2 = seg2Angle

                // Compute arrowhead width
                const arrowWidth = (typeof Settings !== 'undefined' && Settings.arrowHeadBaseWidth) ? Settings.arrowHeadBaseWidth : Math.max(10, Math.round(Settings.boardSquareSize * 0.3))

                // Main shaft: draw two connected segments: offsetStart -> corner -> baseCenter
                ctx.beginPath()
                ctx.moveTo(offsetStartX, offsetStartY)
                const cornerX = horizontalFirst ? endX : startX
                const cornerY = horizontalFirst ? startY : endY
                ctx.lineTo(cornerX, cornerY)
                ctx.lineTo(baseCenterX, baseCenterY)
                ctx.stroke()

                // Perpendicular unit vector for final leg
                const perpX2 = Math.cos(angle2 + Math.PI / 2)
                const perpY2 = Math.sin(angle2 + Math.PI / 2)
                const half2 = arrowWidth / 2
                const q1x = baseCenterX + perpX2 * half2
                const q1y = baseCenterY + perpY2 * half2
                const q2x = baseCenterX - perpX2 * half2
                const q2y = baseCenterY - perpY2 * half2

                ctx.beginPath()
                ctx.moveTo(tipX, tipY)
                ctx.lineTo(q1x, q1y)
                ctx.lineTo(q2x, q2y)
                ctx.closePath()
                ctx.fill()
            }

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
                    const r = Settings.boardSquareSize / 7;

                    ctx.fillStyle = 'rgba(88, 88, 88, 0.27)';
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
            }

            if (me && me.incheck == true && me.side == 'black') {
                ctx.fillStyle = Settings.checkColor
                ctx.fillRect(king.bx * Settings.boardSquareSize, king.by * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
            }
        }

        // Draw the pieces
        for (let piece of pieces) {
            if (piece.img && piece.img.complete) {
                piece.draw()
            }
        }

        // Draw any arrows (after pieces)
        if (arrows && arrows.length) {
            for (let a of arrows) {
                a.draw()
            }
        }

    }

}

