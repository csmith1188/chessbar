const socket = io()

let availableGames = []

socket.on('refreshGames', () => {
    socket.emit('gamesList')
})

socket.emit('gamesList')

socket.on('gamesList', (games) => {
    availableGames = games
    renderGameList()
})

socket.on('youAre', (foo) => {
    // console.log('youAre event:', foo)
    me = foo
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
        title.textContent = `Game name: ${game.name} | Players: ${playersCount}/2`
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
        owner.clasName = 'sub'
        owner.textContent = me.id == game.owner ? `Owner: you` : `Owner: ${game.owner}`
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
        }

        const previewBtn = document.createElement('button')
        previewBtn.className = 'preview'
        previewBtn.textContent = 'Preview'
        previewBtn.onclick = () => {
            const w = window.open()
            w.document.write('<pre>' + JSON.stringify(game, null, 2) + '</pre>')
        }
        actions.appendChild(previewBtn)

        li.appendChild(actions)

        gameListElem.appendChild(li)
    }
}

// Initial render
renderGameList()