const socket = io()
const canvas = document.getElementById('canvas')
/** @type {CanvasRenderingContext2D} */
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))

socket.on('updateBoard', (newBoard) => {
    board = newBoard
})

function drawBoard() {
    color = 'light'
    for (let i = 0; i < 8; i++) {
        for (let a = 0; a < 8; a++) {
            if (color == 'light') {
                ctx.fillStyle = Settings.lightSquareColor
                color = 'dark'
            } else {
                ctx.fillStyle = Settings.darkSquareColor
                color = 'light'
            }
            ctx.fillRect(a * Settings.boardSquareSize, i * Settings.boardSquareSize, Settings.boardSquareSize, Settings.boardSquareSize)
        }
    }
}

function main() {
    // ...

    drawBoard()

    requestAnimationFrame(main)
}

requestAnimationFrame(main)

