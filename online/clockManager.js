// Simple non-blocking clock manager for chess games
// Ticks every `tickMs` milliseconds and updates in-memory game clocks.

function startClockManager(io, games, tickMs = 1000) {
    // prevent double-starting when module is required multiple times
    if (global.__clockManagerStarted) return
    global.__clockManagerStarted = true

    setInterval(() => {
        try {
            for (const game of games) {
                if (!game) continue
                if (game.finished) continue

                // only operate on games with clocks configured
                if (typeof game.whiteClock !== 'number' || typeof game.blackClock !== 'number') continue

                // Only tick when both players (white and black) are present in the game
                const whitePlayer = game.users.find(u => u.side === 'white')
                const blackPlayer = game.users.find(u => u.side === 'black')
                if (!whitePlayer || !blackPlayer) continue

                const side = game.board && game.board.turn
                if (!side) continue

                // decrement the clock for the side to move
                if (side === 'white') {
                    if (game.whiteClock > 0) game.whiteClock -= 1
                } else {
                    if (game.blackClock > 0) game.blackClock -= 1
                }

                // Broadcast the updated clock values to sockets in this game
                const payload = { whiteTime: game.whiteClock, blackTime: game.blackClock }
                for (const u of game.users) {
                    if (u && u.socket) u.socket.emit('updateClock', payload)
                }

                // If any clock has hit zero or below, finish the game by time
                if (game.whiteClock <= 0 || game.blackClock <= 0) {
                    if (!game.finished) {
                        game.finished = true

                        const loserSide = game.whiteClock <= 0 ? 'white' : 'black'
                        const winnerSide = loserSide === 'white' ? 'black' : 'white'

                        const loser = game.users.find(u => u.side === loserSide)
                        const winner = game.users.find(u => u.side === winnerSide)

                        if (winner && typeof winner.win === 'function') winner.win()
                        if (loser && typeof loser.lose === 'function') loser.lose()

                        // Notify players about time loss. Reuse existing client event handlers where appropriate.
                        for (const u of game.users) {
                            if (u && u.socket) u.socket.emit('mate', { winner: winnerSide })
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Clock manager error:', e)
        }
    }, tickMs)
}

module.exports = { startClockManager }
