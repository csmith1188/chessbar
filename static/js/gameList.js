const socket = io()

let availableGames = []

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
        const title = document.createElement('div')
        title.textContent = `Game ID: ${game.id} | Players: ${playersCount}/2`
        li.appendChild(title)

        const usersDiv = document.createElement('div')
        usersDiv.className = 'game-users'
        if (Array.isArray(game.users) && game.users.length) {
            usersDiv.textContent = 'Users: ' + game.users.map(u => `${u.id}${u.side ? ` (${u.side})` : ''}`).join(', ')
        } else {
            usersDiv.textContent = 'Users: (none)'
        }
        li.appendChild(usersDiv)

        const actionBtn = document.createElement('button')
        if (playersCount < 2) {
            actionBtn.textContent = 'Join Game'
            actionBtn.onclick = () => {
                window.location.href = `/game?code=${encodeURIComponent(game.joinCode)}`
            }
        }
        li.appendChild(actionBtn)

        const previewBtn = document.createElement('button')
        previewBtn.textContent = 'Preview'
        previewBtn.onclick = () => {
            const w = window.open()
            w.document.write('<pre>' + JSON.stringify(game, null, 2) + '</pre>')
        }
        li.appendChild(previewBtn)

        gameListElem.appendChild(li)
    }
}

// Initial render
renderGameList()