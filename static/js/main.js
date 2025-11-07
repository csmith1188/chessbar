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

let freshBoard = false

socket.on('mate', (d) => {
    alert(`Checkmate. ${d.winner} wins!`)
})

socket.on('promotion', (x, y) => {
    let piece = ''

    while (!(piece == 'Knight' || piece == 'Queen' || piece == 'Rook' || piece == 'Bishop')) {
        piece = prompt("Queen Rook Bishop Knight (capitol letter to start)", 'Queen')
    }

    socket.emit('promotion', x, y, piece)
})

socket.on('updateBoard', (data) => {
    selected = null
    //kayden added this
    me.incheck = false
    freshBoard = true
    newBoard = data.board
    // console.log(data)
    prevMove = data.move
    if (prevMove && prevMove.x2 !== null && prevMove.y2 !== null && prevMove.name && prevMove.side && me.side != prevMove.side) {
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
})

// check socket go here
socket.on('check', (data) => {
    if (data.side == me.side) {
        me.incheck = true
        console.log(check)
    }
})

let tick = 0

function main() {

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
