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
    right: false
}

let keys = {}

let board
let gameData

let freshBoard = false

socket.on('mate', (d) => {
    alert(`Checkmate. ${d.winner} wins!`)
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
        if (Mouse.x < canvas.width && Mouse.y < canvas.height) {
            ctx.strokeStyle = 'black'

            if (Debug.showClickSquare && Mouse.left) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.25)'
                ctx.fillRect(Math.floor(Mouse.x / Settings.boardSquareSize) * Settings.boardSquareSize,
                    Math.floor(Mouse.y / Settings.boardSquareSize) * Settings.boardSquareSize,
                    Settings.boardSquareSize,
                    Settings.boardSquareSize)
            }

            ctx.strokeRect(Math.floor(Mouse.x / Settings.boardSquareSize) * Settings.boardSquareSize,
                Math.floor(Mouse.y / Settings.boardSquareSize) * Settings.boardSquareSize,
                Settings.boardSquareSize,
                Settings.boardSquareSize)

        }
    }

    if (freshBoard) freshBoard = false

    tick++
    requestAnimationFrame(main)
}

requestAnimationFrame(main)

//Kayden should drop out of programming
//bro
