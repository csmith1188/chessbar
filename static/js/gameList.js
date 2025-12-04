let availableGames = []
let me = null

socket.on('refreshGames', () => {
    socket.emit('gamesList')
})

socket.emit('gamesList')

socket.on('gamesList', (games) => {
    availableGames = games
    renderGameList()
})

function renderGameList() {
    const gameListElem = document.getElementById('gameList')
    gameListElem.innerHTML = ''

    if (!Array.isArray(availableGames) || availableGames.length === 0) {
        gameListElem.innerHTML = '<li>No available games</li>'
        return
    }

    for (const game of availableGames) {
        // console.log(game)
        const li = document.createElement('li')
        li.className = 'game-item'

        const playersCount = Array.isArray(game.users) ? game.users.length : (Array.isArray(game.players) ? game.players.length : 0)
        const meta = document.createElement('div')
        meta.className = 'meta'

        const title = document.createElement('div')
        title.className = 'title'
        title.innerHTML = `<h2><strong>${game.name}</strong> (${game.visibility})</h2> <p>Players: ${playersCount}/2</p>`
        meta.appendChild(title)

        const sub = document.createElement('div')
        sub.className = 'sub'
        if (Array.isArray(game.users) && game.users.length) {
            sub.textContent = 'Users: ' + game.users.map(u => `${u.id}${u.side ? ` (${u.side})` : ''}`).join(', ')
        } else {
            sub.textContent = 'Users: (none)'
        }
        meta.appendChild(sub)

    const owner = document.createElement('div')
    owner.className = 'sub'
    owner.textContent = (me && me.id == game.owner) ? `Owner: You` : `Owner: ${game.owner}`
        meta.appendChild(owner)

        li.appendChild(meta)

        const actions = document.createElement('div')
        actions.className = 'actions'

        if (playersCount < 2) {
            const actionBtn = document.createElement('button')
            actionBtn.className = 'join'
            actionBtn.textContent = 'Join'
            actionBtn.onclick = () => window.location.href = `/game?code=${encodeURIComponent(game.joinCode)}`
            actions.appendChild(actionBtn)
        } else {
            const actionBtn = document.createElement('button')
            actionBtn.className = 'join'
            actionBtn.textContent = 'Spectate'
            actionBtn.onclick = () => window.location.href = `/game?code=${encodeURIComponent(game.joinCode)}`
            actions.appendChild(actionBtn)
        }

        const previewBtn = document.createElement('button')
        previewBtn.className = 'preview'
        previewBtn.textContent = 'Preview'
        previewBtn.onclick = () => {
            const w = window.open()
            w.document.write('<pre>' + JSON.stringify(game, null, 2) + '</pre>')
        }
        actions.appendChild(previewBtn)

        if (game.owner == me.id) {
            const actionBtn = document.createElement('button')
            actionBtn.className = 'delete'
            actionBtn.textContent = 'Delete'

            // Confirm-on-second-click behavior:
            // First click changes the label to "Are you sure?" and starts a timeout.
            // Second click within the timeout emits the delete event.
            let confirmState = false
            let confirmTimer = null
            const CONFIRM_TIMEOUT_MS = 5000

            actionBtn.onclick = () => {
                if (!confirmState) {
                    confirmState = true
                    actionBtn.textContent = 'Are you sure?'
                    actionBtn.classList.add('confirm')

                    // Revert after timeout
                    confirmTimer = setTimeout(() => {
                        confirmState = false
                        actionBtn.textContent = 'Delete'
                        actionBtn.classList.remove('confirm')
                        confirmTimer = null
                    }, CONFIRM_TIMEOUT_MS)
                } else {
                    // second click -> proceed
                    if (confirmTimer) {
                        clearTimeout(confirmTimer)
                        confirmTimer = null
                    }
                    socket.emit('deleteGame', game.id)
                }
            }

            actions.appendChild(actionBtn)
        }

        li.appendChild(actions)

        gameListElem.appendChild(li)
    }
}

// Initial render
renderGameList()