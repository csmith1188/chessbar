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

// Format seconds to MM:SS or show infinity symbol for null/undefined
function formatTime(seconds) {
    if (seconds === null || seconds === undefined) return '∞'
    const s = Math.max(0, Math.floor(Number(seconds) || 0))
    const mm = Math.floor(s / 60)
    const ss = s % 60
    return `${mm}:${ss.toString().padStart(2, '0')}`
}

let freshBoard = false

socket.on('mate', (d) => {
    alert(`Checkmate. ${d.winner} wins!`)
})

// Time-up event (different from checkmate)
socket.on('timeUp', (d) => {
    const name = (d && d.winnerName) ? d.winnerName : (d && d.winner) ? d.winner : 'Player'
    alert(`Time. ${name} wins on time!`)
})

socket.on('resign', (u) => {
    alert(`${u.displayName} has resigned.`)
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
