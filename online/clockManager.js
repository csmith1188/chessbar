// Simple non-blocking clock manager for chess games
// Ticks every `tickMs` milliseconds and updates in-memory game clocks.

const warnSeconds = [30, 20, 10, 5, 3, 2, 1]

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

                // Determine presence of both sides
                const whitePlayer = game.users.find(u => u.side === 'white')
                const blackPlayer = game.users.find(u => u.side === 'black')

                // Start the clock only once both players have been assigned to sides.
                // Once started, the clock continues ticking even if a player becomes inactive.
                if (!game._clockStarted) {
                    if (whitePlayer && blackPlayer) {
                        game._clockStarted = true
                    }
                }

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

                    // Clock warning sounds
                    if (u.side == 'white' && warnSeconds.includes(game.whiteClock)) u.socket.emit('sound', 'warning')
                    if (u.side == 'black' && warnSeconds.includes(game.blackClock)) u.socket.emit('sound', 'warning')
                }

                // If any clock has hit zero or below, finish the game by time
                if (game.whiteClock <= 0 || game.blackClock <= 0) {
                    if (!game.finished) {
                        game.finished = true

                        const loserSide = game.whiteClock <= 0 ? 'white' : 'black'
                        const winnerSide = loserSide === 'white' ? 'black' : 'white'

                        if (loserSide == 'white') {
                            game.prevWhite.socket.emit('sound', 'alarm')
                        } else {
                            game.prevBlack.socket.emit('sound', 'alarm')
                        }

                        const loser = game.users.find(u => u.side === loserSide)
                        const winner = game.users.find(u => u.side === winnerSide)

                        // record winner/loser on the game object
                        if (winner) game.winner = winner
                        if (loser) game.loser = loser

                        if (winner && typeof winner.win === 'function') winner.win()
                        if (loser && typeof loser.lose === 'function') loser.lose()

                        // Notify players about time loss with a dedicated event (so client doesn't show checkmate)
                        const payload = { winner: winnerSide, winnerId: winner ? winner.id : null, winnerName: winner ? winner.displayName : null }
                        for (const u of game.users) {
                            if (u && u.socket) u.socket.emit('timeUp', payload)
                        }

                        // send a final board/clock update to sync clients
                        try {
                            if (typeof game.update === 'function') game.update()
                        } catch (e) {
                            // ignore
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
