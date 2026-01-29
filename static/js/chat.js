const msgInput = document.getElementById('msg');
const sendBtn = document.getElementById('send');
const messages = document.getElementById('messages');
const sidebar = document.getElementById('chat-sidebar');
const exportPgnBtn = document.getElementById('export-pgn');

let msgHistory = []
let prevSender

function renderMessages(history) {
    messages.innerHTML = '';
    history.forEach(({ sender, message }) => {
        renderMessage(sender, message)
    });
}

function renderMessage(sender, message) {
    const row = document.createElement('div');
    row.classList.add('message-row');
    row.classList.add(sender === me.displayName ? 'you' : 'other');

    let senderDiv

    // If me is not the sender and the previous message was not sent by the same person
    if (sender !== prevSender && sender !== me.displayName) {
        senderDiv = document.createElement('div');
        senderDiv.classList.add('sender');
        senderDiv.textContent = sender;
    }

    // If I am the sender and the previous sender is not me
    if (sender == me.displayName && sender !== prevSender) {
        row.style.marginTop = '20px'
    }

    const bubble = document.createElement('div');
    bubble.classList.add('message');
    bubble.textContent = message;

    if (senderDiv) row.appendChild(senderDiv);
    row.appendChild(bubble);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
    
    prevSender = sender
}

socket.on('messageHistory', (h) => {
    msgHistory = h;
    renderMessages(h);
});


// Send message
sendBtn.onclick = () => {
    const text = msgInput.value.trim();
    if (text !== '') {
        socket.emit('chatMessage', text);
        msgInput.value = '';
    }
}

// Receive new messages
socket.on('chatMessage', (sender, message) => {
    renderMessage(sender, message)
});

// Build a simple PGN string from the game's moves array and paste it into the chat input.
function buildPGNFromMoves(moves, meta = {}) {
    if (!Array.isArray(moves)) return ''

    const files = 'abcdefgh'

    function square(coord) {
        if (!coord || typeof coord.x !== 'number' || typeof coord.y !== 'number') return '??'
        const f = files[coord.x] || '?'
        const r = 8 - coord.y
        return `${f}${r}`
    }

    // Initialize standard starting board (matching engine/main.js layout)
    function initBoard() {
        // rows y=0 (black backrank) .. y=7 (white backrank)
        const B = (n) => ({ name: n, side: 'black' })
        const W = (n) => ({ name: n, side: 'white' })
        return [
            [B('Rook'), B('Knight'), B('Bishop'), B('Queen'), B('King'), B('Bishop'), B('Knight'), B('Rook')],
            [B('Pawn'), B('Pawn'), B('Pawn'), B('Pawn'), B('Pawn'), B('Pawn'), B('Pawn'), B('Pawn')],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [W('Pawn'), W('Pawn'), W('Pawn'), W('Pawn'), W('Pawn'), W('Pawn'), W('Pawn'), W('Pawn')],
            [W('Rook'), W('Knight'), W('Bishop'), W('Queen'), W('King'), W('Bishop'), W('Knight'), W('Rook')]
        ]
    }

    function applyMoveToBoard(bd, m) {
        const fx = m.from.x, fy = m.from.y
        const tx = m.to.x, ty = m.to.y
        const mover = bd[fy] && bd[fy][fx]
        if (!mover) {
            // If mover missing, create a generic piece (best-effort)
            bd[ty] = bd[ty] || []
            bd[ty][tx] = { name: 'Pawn', side: m.side }
            if (bd[fy]) bd[fy][fx] = null
            return
        }

        // Handle en-passant capture removal: captured pawn sits at (to.x, from.y)
        if (m.enPassant) {
            if (bd[fy] && bd[fy][tx]) {
                bd[fy][tx] = null
            }
        }

        // Handle castling: king moves two squares horizontally
        if (mover.name === 'King' && Math.abs(tx - fx) === 2) {
            // kingside
            if (tx === 6) {
                // move rook from h to f
                const ry = fy
                bd[ry][5] = bd[ry][7]
                bd[ry][7] = null
            } else if (tx === 2) {
                // queenside: move rook from a to d
                const ry = fy
                bd[ry][3] = bd[ry][0]
                bd[ry][0] = null
            }
        }

        // Normal capture removal (destination overwritten)
        bd[ty] = bd[ty] || []
        bd[ty][tx] = mover
        if (bd[fy]) bd[fy][fx] = null

        // Handle promotion
        if (m.promotion) {
            mover.name = m.promotion
        }
    }

    // Build SAN-ish notation (basic): pawns as e4 / exd5, pieces as Nf3 / Rxa1, castling O-O/O-O-O, promotions =Q
    const boardState = initBoard()
    const parts = []

    function adjustMoveCoords(m) {
        if (!m) return m
        // Server stores coords normalized to the mover's perspective (black moves have y flipped).
        // Convert stored coords back to absolute board coordinates used by boardState.
        const fromY = (m.side === 'black') ? 7 - m.from.y : m.from.y
        const toY = (m.side === 'black') ? 7 - m.to.y : m.to.y
        return Object.assign({}, m, { from: { x: m.from.x, y: fromY }, to: { x: m.to.x, y: toY } })
    }

    for (let i = 0; i < moves.length; i += 2) {
        const moveNumber = (i / 2) + 1
        const rawWhite = moves[i]
        const rawBlack = moves[i + 1]
        const whiteMove = rawWhite ? adjustMoveCoords(rawWhite) : null
        const blackMove = rawBlack ? adjustMoveCoords(rawBlack) : null

        function sanFor(m) {
            if (!m || !m.from || !m.to) return ''
            const from = m.from
            const to = m.to
            const mover = (boardState[from.y] && boardState[from.y][from.x]) || { name: 'Pawn', side: m.side }

            // Castling detection
            if (mover.name === 'King' && Math.abs(to.x - from.x) === 2) {
                return (to.x === 6) ? 'O-O' : 'O-O-O'
            }

            const toSq = square(to)

            if (mover.name === 'Pawn') {
                if (m.takes) {
                    const file = files[from.x]
                    let s = `${file}x${toSq}`
                    if (m.promotion) s += `=${String(m.promotion).charAt(0).toUpperCase()}`
                    return s
                } else {
                    let s = `${toSq}`
                    if (m.promotion) s += `=${String(m.promotion).charAt(0).toUpperCase()}`
                    return s
                }
            }

            // Other pieces
            const letterMap = { 'Knight': 'N', 'Bishop': 'B', 'Rook': 'R', 'Queen': 'Q', 'King': 'K' }
            const pLetter = letterMap[mover.name] || ''
            const capture = m.takes ? 'x' : ''
            return `${pLetter}${capture}${toSq}`
        }

        const whiteSAN = whiteMove ? sanFor(whiteMove) : ''
        // Apply white move to boardState
        if (whiteMove) applyMoveToBoard(boardState, whiteMove)

        const blackSAN = blackMove ? sanFor(blackMove) : ''
        if (blackMove) applyMoveToBoard(boardState, blackMove)

        if (whiteSAN || blackSAN) {
            let line = `${moveNumber}.`
            if (whiteSAN) line += ` ${whiteSAN}`
            if (blackSAN) line += ` ${blackSAN}`
            parts.push(line)
        }
    }

    // Headers
    const headers = []
    const today = new Date()
    const y = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const dateStr = `${y}.${mm}.${dd}`

    headers.push(`[Event "Chessbar Game"]`)
    headers.push(`[Site "${location.hostname}"]`)
    headers.push(`[Date "${dateStr}"]`)
    headers.push(`[Round "-"]`)
    headers.push(`[White "${(meta.white && meta.white.displayName) ? meta.white.displayName : (meta.whiteName || 'White')}"]`)
    headers.push(`[Black "${(meta.black && meta.black.displayName) ? meta.black.displayName : (meta.blackName || 'Black')}" ]`)
    headers.push(`[Result "*"]`)

    const movetext = parts.join('\n')
    return headers.join('\n') + '\n\n' + movetext + '\n*'
}

function exportPGNToChat() {
    try {
        if (typeof gameData === 'undefined' || !gameData || !Array.isArray(gameData.moves)) {
            alert('No game moves available to export.')
            return
        }

        const meta = {
            white: gameData.prevWhite || null,
            black: gameData.prevBlack || null,
            whiteName: (gameData.prevWhite && gameData.prevWhite.displayName) ? gameData.prevWhite.displayName : null,
            blackName: (gameData.prevBlack && gameData.prevBlack.displayName) ? gameData.prevBlack.displayName : null
        }

        const pgn = buildPGNFromMoves(gameData.moves, meta)

        // Log PGN to console instead of pasting into chat input
        try {
            console.log('--- Exported PGN START ---')
            console.log(pgn)
            console.log('--- Exported PGN END ---')
        } catch (e) {
            // fallback: put into chat input if console fails for some reason
            if (msgInput) {
                msgInput.value = pgn
                msgInput.focus()
                try { msgInput.select() } catch (e) {}
            }
        }
    } catch (e) {
        console.error('Failed to export PGN', e)
        alert('Failed to export PGN. See console for details.')
    }
}

if (exportPgnBtn) exportPgnBtn.addEventListener('click', exportPGNToChat)

// Update user list
socket.on('userList', (users) => {
    sidebar.innerHTML = '<h2>Users</h2>';
    users.forEach(u => {
        const p = document.createElement('p');
        p.textContent = u;
        sidebar.appendChild(p);
    });
});