const { Board, classes } = require('./engine/main')
const { Pawn } = require('./engine/pieces')

function cloneLayout() {
    const empty = Array(8).fill(0).map(() => Array(8).fill(0))
    return empty
}

const board = new Board()
// Clear board
board.layout = cloneLayout()

// Place a white pawn that can capture en-passant at (4,3)
board.layout[3][4] = new Pawn('white', 1)

// Place a black pawn that just moved two squares and sits adjacent at (3,5)?
// For en-passant: captured pawn must be on the same rank as the capturing pawn (y1)
board.layout[3][5] = new Pawn('black', 1)
board.layout[3][5].enPassant = true

// Coordinates for move: white pawn from (4,3) to (5,2)
const x1 = 4, y1 = 3, x2 = 5, y2 = 2

const foo = new Pawn('white', 1)
const dest = board.layout[y2][x2]

console.log('Before move:')
console.log('White pawn at', x1, y1, !!board.layout[y1][x1])
console.log('Black pawn at (capturable):', !!board.layout[y1][x2], board.layout[y1][x2] && board.layout[y1][x2].side, 'enPassant=', board.layout[y1][x2] && board.layout[y1][x2].enPassant)
console.log('Destination empty?', !dest)

const vm = foo.validMove(board.layout, x1, y1, x2, y2)
console.log('validMove returned:', vm)

if (( !dest || dest.side != foo.side) && vm) {
    // Clear existing enPassant
    for (let row of board.layout) for (let cell of row) if (cell && cell.enPassant) cell.enPassant = cell.enPassant

    if (vm === 'enPassant') foo.enPassant = true

    // perform move similar to main.js
    board.layout[y1][x1] = 0

    // handle en-passant capture
    if (foo.name === 'Pawn' && !dest && Math.abs(x2 - x1) === 1 && vm === true) {
        const capY = y1
        const capX = x2
        const capturedPawn = board.layout[capY] && board.layout[capY][capX]
        if (capturedPawn && capturedPawn.constructor.name === 'Pawn' && capturedPawn.enPassant) {
            board.captured.push({ name: capturedPawn.name, side: capturedPawn.side })
            board.layout[capY][capX] = 0
        }
    } else {
        if (dest) board.captured.push({ name: dest.name, side: dest.side })
    }

    board.layout[y2][x2] = foo
}

console.log('\nAfter move:')
console.log('Origin now:', board.layout[y1][x1])
console.log('Destination now:', board.layout[y2][x2] && board.layout[y2][x2].side)
console.log('Captured pawn square should be empty:', board.layout[3][5])
console.log('Captured array:', board.captured)
