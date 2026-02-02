const canvas = document.getElementById('canvas')
/** @type {CanvasRenderingContext2D} */
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))
canvas.width = Settings.boardSquareSize * 8
canvas.height = Settings.boardSquareSize * 8
if (Settings.pieceStyle == 'pixel') ctx.imageSmoothingEnabled = false

let moveAnimation = null
let me
let moveAnimationDuration = 120

let prevMove = {}

let Mouse = {
    x: 0,
    y: 0,
    left: false,
    right: false,
    dragStartX: null,
    dragStartY: null,
    dragEndX: null,
    dragEndY: null,
}

let keys = {}

let board
let gameData
// null = live view; otherwise number of half-moves applied from gameData.moves (0..n)
// NOTE: store the actual count (0..total). This avoids off-by-one confusion.
let movesViewCount = null

// Format seconds to MM:SS or show infinity symbol for null/undefined
function formatTime(seconds) {
    if (seconds === null || seconds === undefined) return '∞'
    const s = Math.max(0, Math.floor(Number(seconds) || 0))
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return `${mm}:${ss.toString().padStart(2, '0')}`
}

// Reusable client-side system alert popup helper
function showSystemPopup(title, message, duration = 6000, player = null) {
    try {
        let container = document.getElementById('systemAlert')
        if (!container) {
            container = document.createElement('div')
            container.id = 'systemAlert'
            container.setAttribute('aria-live', 'polite')
            container.setAttribute('aria-hidden', 'true')
            container.className = 'system-alert'
            const inner = document.createElement('div')
            inner.className = 'system-alert-inner'
            container.appendChild(inner)
            document.body.appendChild(container)
        }

        const inner = container.querySelector('.system-alert-inner')
        inner.innerHTML = ''
        if (title) {
            const h = document.createElement('div')
            h.className = 'system-alert-title'
            h.innerText = title
            inner.appendChild(h)
        }
        const p = document.createElement('div')
        p.className = 'system-alert-message'
        p.innerText = message
        inner.appendChild(p)

        container.classList.add('show')
        container.setAttribute('aria-hidden', 'false')

        if (container._timeout) clearTimeout(container._timeout)
        container._timeout = setTimeout(() => {
            container.classList.remove('show')
            container.setAttribute('aria-hidden', 'true')
            container._timeout = null
        }, duration)
    } catch (e) {
        try { alert(message) } catch (e) { }
    }
}

let freshBoard = false

socket.on('mate', (d) => {
    showSystemPopup('Checkmate', `Checkmate. ${d.winner} wins!`, 8000)
})

socket.on('stalemate', (d) => {
    showSystemPopup('Stalemate', `Stalemate. Draw.`, 8000)
})

socket.on('draw', (d) => {
    if (d && d.reason === 'lack-of-material') {
        showSystemPopup('Draw: Lack of material', `Draw: Lack of material`, 8000)
    } else {
        showSystemPopup('Draw', `Draw.`, 8000)
    }
})

// Time-up event (different from checkmate)
socket.on('timeUp', (d) => {
    const name = (d && d.winnerName) ? d.winnerName : (d && d.winner) ? d.winner : 'Player'
    showSystemPopup('Time Up', `Time. ${name} wins on time!`, 8000)
})

socket.on('resign', (u) => {
    showSystemPopup('Resign', `${u.displayName} has resigned.`, 6000, u)
})

// pending promotion coords and listener-guard
window.pendingPromotionX = null
window.pendingPromotionY = null
let promotionListenersAdded = false

// Pawn promotion menu
function showPromoteMenu(overrideSide) {
    const menu = document.getElementById('promotion');
    const queen = document.getElementById('queen');
    const rook = document.getElementById('rook');
    const bishop = document.getElementById('bishop');
    const knight = document.getElementById('knight');

    queen.width = Settings.boardSquareSize
    queen.height = Settings.boardSquareSize
    rook.width = Settings.boardSquareSize
    rook.height = Settings.boardSquareSize
    bishop.width = Settings.boardSquareSize
    bishop.height = Settings.boardSquareSize
    knight.width = Settings.boardSquareSize
    knight.height = Settings.boardSquareSize

    // determine piece style and side with safe fallbacks
    const pieceStyle = (typeof Settings !== 'undefined' && Settings.pieceStyle) ? Settings.pieceStyle : 'basic';
    // Use safe default if "me" isn't set yet
    let side = (me && me.side) ? me.side : 'white';
    if (overrideSide) side = overrideSide;
    else if (typeof obj !== 'undefined' && obj && obj.side) side = obj.side;

    // unhide menu and update accessibility flag
    menu.style.display = 'flex'; // use flex so images layout horizontally
    menu.style.justifyContent = 'center';
    menu.setAttribute('aria-hidden', 'false');

    queen.src = `img/${pieceStyle}/${side}_queen.png`;
    rook.src = `img/${pieceStyle}/${side}_rook.png`;
    bishop.src = `img/${pieceStyle}/${side}_bishop.png`;
    knight.src = `img/${pieceStyle}/${side}_knight.png`;

    // Add click handlers once to avoid duplication
    if (!promotionListenersAdded) {
        promotionListenersAdded = true
        const choose = (pieceName) => {
            if (window.pendingPromotionX === null || window.pendingPromotionY === null) return
            socket.emit('promotion', window.pendingPromotionX, window.pendingPromotionY, pieceName)
            hidePromoteMenu()
            window.pendingPromotionX = window.pendingPromotionY = null
        }
        if (queen) queen.addEventListener('click', () => choose('Queen'))
        if (rook) rook.addEventListener('click', () => choose('Rook'))
        if (bishop) bishop.addEventListener('click', () => choose('Bishop'))
        if (knight) knight.addEventListener('click', () => choose('Knight'))
    }
}

// Hide promotion menu
function hidePromoteMenu() {
    const menu = document.getElementById('promotion');
    if (!menu) return;
    // hide and update accessibility
    menu.style.display = 'none';
    menu.setAttribute('aria-hidden', 'true');

    // clear images to avoid leftover visuals / resource usage
    ['queen', 'rook', 'bishop', 'knight'].forEach(id => {
        const img = document.getElementById(id);
        if (img) img.src = '';
    });

    // clear pending coords just in case
    window.pendingPromotionX = window.pendingPromotionY = null
}

socket.on('promotion', (x, y) => {
    window.pendingPromotionX = x
    window.pendingPromotionY = y
    showPromoteMenu()
})

function updateBoard(data) {
    gameData = data
    selected = null
    // When a fresh board arrives (a new move), return to the live/current view
    movesViewCount = null
    //kayden added this

    freshBoard = true
    newBoard = data.board
    // console.log(data)
    prevMove = data.move

    // Guard against "me" not being set yet before checking me.side
    const isOpponentMove = me && prevMove && prevMove.x2 !== null && prevMove.y2 !== null && prevMove.name && prevMove.side && me.side != prevMove.side
    if (isOpponentMove) {
        const pieceImg = `img/${Settings.pieceStyle}/${prevMove.side}_${prevMove.name.toLowerCase()}.png`
        moveAnimation = me.side == 'white' ? new MovePiece(prevMove.x1, prevMove.y1, prevMove.x2, prevMove.y2, pieceImg, prevMove.name, prevMove.side) : new MovePiece(prevMove.x1, 7 - prevMove.y1, prevMove.x2, 7 - prevMove.y2, pieceImg, prevMove.name, prevMove.side)
    }
    let layout = data.board.layout
    // console.log('Received board update:', newBoard)
    board = null
    pieces = []

    let x = 0
    let y2 = 0

    if (me.side == 'white') {
        for (let y of layout) {
            x = 0
            for (let obj of y) {
                if (obj) new Piece(x * Settings.boardSquareSize + Settings.defaultPieceMargin / 2, y2 * Settings.boardSquareSize + Settings.defaultPieceMargin / 2, `img/${Settings.pieceStyle}/${obj.side}_${obj.name.toLowerCase()}.png`, obj.name, obj.side, obj.moves)
                x++
            }
            y2++
        }
    } else {
        for (let y of [...layout].reverse()) {
            x = 0
            for (let obj of y) {
                if (obj) new Piece(x * Settings.boardSquareSize + Settings.defaultPieceMargin / 2, y2 * Settings.boardSquareSize + Settings.defaultPieceMargin / 2, `img/${Settings.pieceStyle}/${obj.side}_${obj.name.toLowerCase()}.png`, obj.name, obj.side, obj.moves)
                x++
            }
            y2++
        }
    }

    board = newBoard
    // Render captured pieces (if provided): sort by worth and show material diff
    try {
        const blackCapturedEl = document.getElementById('blackCaptured')
        const whiteCapturedEl = document.getElementById('whiteCaptured')
        if (blackCapturedEl) blackCapturedEl.innerHTML = ''
        if (whiteCapturedEl) whiteCapturedEl.innerHTML = ''

        // value map
        const valueMap = {
            pawn: 1,
            knight: 3,
            bishop: 3,
            rook: 5,
            queen: 8
        }

        let blackList = []
        let whiteList = []

        if (data.board && Array.isArray(data.board.captured)) {
            for (const cap of data.board.captured) {
                const name = (cap && cap.name) ? String(cap.name).toLowerCase() : ''
                const side = cap && cap.side ? String(cap.side) : ''
                const val = valueMap[name] || 0
                const item = { name, side, val }
                if (side === 'black') blackList.push(item)
                else if (side === 'white') whiteList.push(item)
            }

            // Sort ascending by value (reversed order: lower-value pieces first)
            const sorter = (a, b) => a.val - b.val || a.name.localeCompare(b.name)
            blackList.sort(sorter)
            whiteList.sort(sorter)

            // compute totals (points taken by white = sum of captured black pieces)
            const pointsTakenByWhite = blackList.reduce((s, p) => s + p.val, 0)
            const pointsTakenByBlack = whiteList.reduce((s, p) => s + p.val, 0)
            const diff = pointsTakenByWhite - pointsTakenByBlack

            const size = Math.max(14, Math.round(Settings.boardSquareSize * 0.5)) + 'px'

            for (const cap of blackList) {
                try {
                    const img = document.createElement('img')
                    img.src = `img/${Settings.pieceStyle}/black_${cap.name}.png`
                    img.alt = `black ${cap.name}`
                    img.title = `black ${cap.name}`
                    img.className = 'captured-piece'
                    if (blackCapturedEl) blackCapturedEl.appendChild(img)
                } catch (e) { }
            }

            for (const cap of whiteList) {
                try {
                    const img = document.createElement('img')
                    img.src = `img/${Settings.pieceStyle}/white_${cap.name}.png`
                    img.alt = `white ${cap.name}`
                    img.title = `white ${cap.name}`
                    img.className = 'captured-piece'
                    if (whiteCapturedEl) whiteCapturedEl.appendChild(img)
                } catch (e) { }
            }
            // Remove any lingering advantage badges before deciding to add new ones
            if (whiteCapturedEl) {
                const old = whiteCapturedEl.querySelectorAll('.cap-adv')
                old.forEach(n => n.remove())
            }
            if (blackCapturedEl) {
                const old = blackCapturedEl.querySelectorAll('.cap-adv')
                old.forEach(n => n.remove())
            }

            // advantage from black's perspective (black captured white pieces)
            // Only create the badge when the advantage is strictly positive (> 0)
            if (whiteCapturedEl && whiteList.length) {
                const advB = -diff // pointsTakenByBlack - pointsTakenByWhite
                if (advB > 0) {
                    const advSpanB = document.createElement('span')
                    advSpanB.className = 'cap-adv positive'
                    advSpanB.innerText = `+${advB}`
                    whiteCapturedEl.appendChild(advSpanB)
                }
            }

            // advantage from white's perspective (white captured black pieces)
            // Only create the badge when the advantage is strictly positive (> 0)
            if (blackCapturedEl && blackList.length) {
                const advW = diff // pointsTakenByWhite - pointsTakenByBlack
                if (advW > 0) {
                    const advSpanW = document.createElement('span')
                    advSpanW.className = 'cap-adv positive'
                    advSpanW.innerText = `+${advW}`
                    blackCapturedEl.appendChild(advSpanW)
                }
            }
        }
    } catch (e) {
        // ignore DOM errors
    }

    // Update clock display if provided
    try {
        if (data.whiteClock !== undefined) {
            const el = document.getElementById('whiteClock')
            if (el) el.innerText = formatTime(data.whiteClock)
            if (typeof whiteTime !== 'undefined') whiteTime = data.whiteClock
        }
        if (data.blackClock !== undefined) {
            const el = document.getElementById('blackClock')
            if (el) el.innerText = formatTime(data.blackClock)
            if (typeof blackTime !== 'undefined') blackTime = data.blackClock
        }
    } catch (e) {
        // ignore DOM errors
    }
}

// check socket go here
// Build a board state (layout array like server `board.layout`) by applying
// the first `count` half-moves from `moves` (count may be 0..moves.length).
function buildBoardFromMoves(moves, count) {
    const B = (n) => ({ name: n, side: 'black', moves: 0 })
    const W = (n) => ({ name: n, side: 'white', moves: 0 })
    const boardState = [
        [B('Rook'), B('Knight'), B('Bishop'), B('Queen'), B('King'), B('Bishop'), B('Knight'), B('Rook')],
        [B('Pawn'), B('Pawn'), B('Pawn'), B('Pawn'), B('Pawn'), B('Pawn'), B('Pawn'), B('Pawn')],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [W('Pawn'), W('Pawn'), W('Pawn'), W('Pawn'), W('Pawn'), W('Pawn'), W('Pawn'), W('Pawn')],
        [W('Rook'), W('Knight'), W('Bishop'), W('Queen'), W('King'), W('Bishop'), W('Knight'), W('Rook')]
    ]

    function adjustMoveCoords(m) {
        if (!m) return m
        const fromY = (m.side === 'black') ? 7 - m.from.y : m.from.y
        const toY = (m.side === 'black') ? 7 - m.to.y : m.to.y
        return Object.assign({}, m, { from: { x: m.from.x, y: fromY }, to: { x: m.to.x, y: toY } })
    }

    function applyMoveToBoard(bd, m) {
        const fx = m.from.x, fy = m.from.y
        const tx = m.to.x, ty = m.to.y
        const mover = bd[fy] && bd[fy][fx]
        if (!mover) {
            bd[ty] = bd[ty] || []
            bd[ty][tx] = { name: 'Pawn', side: m.side, moves: 0 }
            if (bd[fy]) bd[fy][fx] = null
            return
        }

        if (m.enPassant) {
            if (bd[fy] && bd[fy][tx]) {
                bd[fy][tx] = null
            }
        }

        if (mover.name === 'King' && Math.abs(tx - fx) === 2) {
            if (tx === 6) {
                const ry = fy
                bd[ry][5] = bd[ry][7]
                bd[ry][7] = null
            } else if (tx === 2) {
                const ry = fy
                bd[ry][3] = bd[ry][0]
                bd[ry][0] = null
            }
        }

        bd[ty] = bd[ty] || []
        bd[ty][tx] = mover
        if (bd[fy]) bd[fy][fx] = null

        if (m.promotion) {
            mover.name = m.promotion
        }
    }

    const upto = Math.max(0, Math.min(count || 0, Array.isArray(moves) ? moves.length : 0))
    for (let i = 0; i < upto; i++) {
        const m = adjustMoveCoords(moves[i])
        if (m) applyMoveToBoard(boardState, m)
    }

    return boardState
}

// Adjust a stored move's Y coordinates (server stores coords normalized to mover's perspective)
function adjustStoredMove(m) {
    if (!m) return null
    const fromY = (m.side === 'black') ? 7 - m.from.y : m.from.y
    const toY = (m.side === 'black') ? 7 - m.to.y : m.to.y
    return Object.assign({}, m, { from: { x: m.from.x, y: fromY }, to: { x: m.to.x, y: toY } })
}

// Render a snapshot of the game by applying `count` half-moves. `count` is number of half-moves applied (1..n), 0 => starting position
function renderMovesView(count) {
    if (!gameData || !Array.isArray(gameData.moves)) return
    if (count === null) return

    const layout = buildBoardFromMoves(gameData.moves, count)
    pieces = []
    let y2 = 0
    if (me && me.side == 'white') {
        for (let y of layout) {
            let x = 0
            for (let obj of y) {
                if (obj) new Piece(x * Settings.boardSquareSize + Settings.defaultPieceMargin / 2, y2 * Settings.boardSquareSize + Settings.defaultPieceMargin / 2, `img/${Settings.pieceStyle}/${obj.side}_${obj.name.toLowerCase()}.png`, obj.name, obj.side, obj.moves)
                x++
            }
            y2++
        }
    } else {
        for (let y of [...layout].reverse()) {
            let x = 0
            for (let obj of y) {
                if (obj) new Piece(x * Settings.boardSquareSize + Settings.defaultPieceMargin / 2, y2 * Settings.boardSquareSize + Settings.defaultPieceMargin / 2, `img/${Settings.pieceStyle}/${obj.side}_${obj.name.toLowerCase()}.png`, obj.name, obj.side, obj.moves)
                x++
            }
            y2++
        }
    }

    board = { layout: layout, captured: [] }
    const last = gameData.moves[count - 1]
    if (last) {
        if (last.side == 'white') {
            prevMove = { x1: last.from.x, y1: last.from.y, x2: last.to.x, y2: last.to.y, side: last.side }
        } else {
            prevMove = { x1: last.from.x, y1: 7 - last.from.y, x2: last.to.x, y2: 7 - last.to.y, side: last.side }
        }
    } else prevMove = {}
}

// Navigate through half-move history: dir = -1 (left), +1 (right)
window.navigateMoves = function (dir) {
    if (!gameData || !Array.isArray(gameData.moves)) return
    const total = gameData.moves.length

    // currentCount is the number of half-moves currently shown (total when live)
    const currentCount = (movesViewCount === null) ? total : movesViewCount

    // newCount: what we want to show after this navigation
    let newCount = currentCount
    if (dir === -1) {
        newCount = Math.max(0, currentCount - 1)
    } else if (dir === 1) {
        newCount = Math.min(total, currentCount + 1)
    }

    // Update movesViewCount to reflect newCount (null == live / full)
    if (newCount === total) movesViewCount = null
    else movesViewCount = Math.max(0, newCount)

    // Attempt to animate the move that corresponds to newCount (the last applied half-move)
    const rawMoveIndex = (dir === -1) ? newCount : (newCount - 1)
    if (newCount >= 0 && Array.isArray(gameData.moves) && gameData.moves[rawMoveIndex]) {
        try {
            const rawMove = gameData.moves[rawMoveIndex]
            const adj = adjustStoredMove(rawMove)
            if (adj) {
                // If navigating backwards (undo), animate the piece moving from its post-move
                // square back to its pre-move square. Otherwise animate the forward move.
                if (dir === -1) {
                    // Board after the move was applied (so the mover is at the 'to' square)
                    // `newCount` is the count after navigation (one less than before),
                    // so the board with the move applied is `newCount + 1`.
                    const afterLayout = buildBoardFromMoves(gameData.moves, newCount + 1)
                    const mover = (afterLayout && afterLayout[adj.to.y] && afterLayout[adj.to.y][adj.to.x]) || { name: 'Pawn', side: rawMove.side }
                    const pieceImg = `img/${Settings.pieceStyle}/${mover.side}_${mover.name.toLowerCase()}.png`

                    let x1 = adj.to.x
                    let y1 = adj.to.y
                    let x2 = adj.from.x
                    let y2 = adj.from.y

                    // Mirror for black viewer to match rendering elsewhere
                    if (me && me.side && me.side !== 'white') {
                        y1 = 7 - y1
                        y2 = 7 - y2
                    }

                    moveAnimation = new MovePiece(x1, y1, x2, y2, pieceImg, mover.name, mover.side)
                } else {
                    // Board just before this move (for forward animation)
                    const beforeLayout = buildBoardFromMoves(gameData.moves, newCount - 1)
                    const mover = (beforeLayout && beforeLayout[adj.from.y] && beforeLayout[adj.from.y][adj.from.x]) || { name: 'Pawn', side: rawMove.side }
                    const pieceImg = `img/${Settings.pieceStyle}/${mover.side}_${mover.name.toLowerCase()}.png`

                    let x1 = adj.from.x
                    let y1 = adj.from.y
                    let x2 = adj.to.x
                    let y2 = adj.to.y

                    // Mirror for black viewer to match rendering elsewhere
                    if (me && me.side && me.side !== 'white') {
                        y1 = 7 - y1
                        y2 = 7 - y2
                    }

                    moveAnimation = new MovePiece(x1, y1, x2, y2, pieceImg, mover.name, mover.side)
                }
            }
        } catch (e) {
            moveAnimation = null
        }
    }

    if (movesViewCount === null) {
        if (gameData && gameData.board) updateBoard(gameData)
    } else {
        renderMovesView(movesViewCount)
    }
}

socket.on('check', (data) => {
    if (data.side == me.side) {
        me.incheck = true
        console.log('me in check')
    }
})

let tick = 0
let on = false

function main() {

    if (tick % 60 == 0) {
        on = !on
    }

    if (keys['Enter'] && msgInput.value) {
        sendBtn.click()
    }

    drawBoard()

    if (moveAnimation) {
        moveAnimation.updateAndDraw()
        if (moveAnimation.done) moveAnimation = null
    }

    if (Debug.showHoverSquare) {
        ctx.lineWidth = 5
        if (Mouse.x < canvas.width && Mouse.y < canvas.height && selected) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.54)'

            if (Debug.showClickSquare && Mouse.left) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.25)'
                ctx.fillRect(Math.floor(Mouse.x / Settings.boardSquareSize) * Settings.boardSquareSize,
                    Math.floor(Mouse.y / Settings.boardSquareSize) * Settings.boardSquareSize,
                    Settings.boardSquareSize,
                    Settings.boardSquareSize)
            }

            // 2.5 & 5 are for stroke width offsets

            ctx.strokeRect(Math.floor(Mouse.x / Settings.boardSquareSize) * Settings.boardSquareSize + 2.5,
                Math.floor(Mouse.y / Settings.boardSquareSize) * Settings.boardSquareSize + 2.5,
                Settings.boardSquareSize - 5,
                Settings.boardSquareSize - 5)

        }
    }

    if (freshBoard) freshBoard = false

    tick++
    requestAnimationFrame(main)
}

requestAnimationFrame(main)

//Kayden should drop out of programming
//bro

// Handle server-sent system alerts (structured notifications)
socket.on('systemAlert', (payload) => {
    // delegate to shared popup helper
    if (!payload) return
    showSystemPopup(payload.title || '', payload.message || '', payload.duration || 6000, payload.player || null)
})
