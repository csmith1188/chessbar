const socket = io()
const canvas = document.getElementById('canvas')
/** @type {CanvasRenderingContext2D} */
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))
canvas.width = Settings.boardSquareSize * 8
canvas.height = Settings.boardSquareSize * 8

let Mouse = {
    x: 0,
    y: 0,
    left: false,
    right: false
}

let keys = {}

document.addEventListener('contextmenu', (e) => {
    e.preventDefault()

    if (Debug.logMouseEvents) console.log(e, Mouse)
})

document.addEventListener('mousemove', (e) => {
    Mouse.x = e.clientX - canvas.getBoundingClientRect().left
    Mouse.y = e.clientY - canvas.getBoundingClientRect().top

    if (Debug.logMouseEvents) console.log(e, Mouse)
})
document.addEventListener('keydown', (e) => {
    keys[e.key] = true
})
document.addEventListener('keyup', (e) => {
    keys[e.key] = false
})
document.addEventListener('mousedown', (e) => {
    if (e.button == 0) {
        Mouse.left = true
    } else if (e.button == 2) {
        Mouse.right = true
    }

    if (Debug.logMouseEvents) console.log(e, Mouse)
})
document.addEventListener('mouseup', (e) => {
    if (e.button == 0) {
        Mouse.left = false
    } else if (e.button == 2) {
        Mouse.right = false
    }

    if (Debug.logMouseEvents) console.log(e, Mouse)
})

let board

socket.emit('newBoard')
socket.on('updateBoard', (newBoard) => {
    for (let y of newBoard) {
        for (let obj of y) {
            let img = new Image
            img.src = obj.img
            obj.imgObj = img
        }
    }

    board = newBoard
})

function drawBoard() {
    color = 'light'
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

            if (board[y][x].img) {
                ctx.drawImage(board[y][x].imgObj,
                    x * Settings.boardSquareSize + Settings.defaultPieceMargin / 2,
                    y * Settings.boardSquareSize + Settings.defaultPieceMargin / 2,
                    Settings.boardSquareSize - Settings.defaultPieceMargin,
                    Settings.boardSquareSize - Settings.defaultPieceMargin
                )
            }
        }
        color = (color == 'light') ? 'dark' : 'light'
    }
}

function main() {
    if (board) drawBoard()

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

