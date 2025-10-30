const socket = io()
const canvas = document.getElementById('canvas')
/** @type {CanvasRenderingContext2D} */
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))
canvas.width = Settings.boardSquareSize * 8
canvas.height = Settings.boardSquareSize * 8
if (Settings.pieceStyle == 'pixel') ctx.imageSmoothingEnabled = false

let me

let Mouse = {
    x: 0,
    y: 0,
    left: false,
    right: false
}

let keys = {}

let board

socket.on('youAre', (foo) => {
    // console.log('youAre event:', foo)
    me = foo
})

socket.on('updateBoard', (newBoard) => {
    {
        let layout = newBoard.layout
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
})

function main() {
    drawBoard()

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


    requestAnimationFrame(main)
}

requestAnimationFrame(main)

