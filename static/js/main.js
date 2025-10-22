const socket = io()
const canvas = document.getElementById('canvas')
/** @type {CanvasRenderingContext2D} */
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))
canvas.width = Settings.boardSquareSize * 8
canvas.height = Settings.boardSquareSize * 8

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
    // ...

    if (board) drawBoard()

    requestAnimationFrame(main)
}

requestAnimationFrame(main)

