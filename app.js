const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Board, attachSocket } = require('./engine/main');
const { User, takenUserIds } = require('./online/user');
let { Game, games, takenGameIds, serializeGame } = require('./online/game')

const app = express();
app.use(express.static('static')); // serve client files from /public

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('selectGame');
});

app.get('/game', (req, res) => {
    res.render('game');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' } // adjust for production
});

attachSocket(io, games);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

let users = []

io.on('connection', (socket) => {
    let user = new User(socket)
    // socket.is = user
    users.push(user);

    function getVisibleGames() {
        // console.log(games)
        return games.filter(g => {
            if (g.visibility === 'public') return true;
            if (Array.isArray(g.players) && g.players.some(p => p && p.id === user.id)) return true;
            if (Array.isArray(g.users) && g.users.some(u => u && u.id === user.id)) return true;
            return false;
        }).map(serializeGame);
    }

    socket.emit('gamesList', getVisibleGames());

    socket.on('gamesList', () => {
        socket.emit('gamesList', getVisibleGames());
    })

    console.log('A user connected:', user.id);

    socket.on('join', (gameId) => {
        for (let game of games) {
            if (game.joinCode == gameId) {
                game.join(user)
            } else if (game.id == gameId && game.visibility === 'public') {
                game.join(user)
            }
        }
    })

    socket.on('disconnect', () => {
        //const name = users[socket.id];
        //console.log(`${name} disconnected`)
        if (takenUserIds.includes(user.id)) {
            takenUserIds.splice(takenUserIds.indexOf(user.id), 1)
        }
        if (user.game) user.game.leave(user)
    })

    // socket.emit('youAre', {id: user.id, side: user.side})


    socket.on('newGame', (visibility = 'public') => {
        if (user.game) {
            user.game.leave(user)
        }
        console.log('newGame event received - creating board on server');
        let game = new Game(visibility)
        game.join(user)
        game.update()
        // broadcast public games to everyone
        io.emit('gamesList', games.filter(g => g.visibility === 'public').map(serializeGame))
        // send the updated visible-games list (including any private games the creator is in) to the creator only
        socket.emit('gamesList', getVisibleGames())
    });

    socket.on('updateBoard', (board) => {
        console.log('updateBoard event received');
        io.emit('updateBoard', board)
    });

    // When a message comes in
    socket.on('chatMessage', (msg) => {
        const sender = user.id
        io.emit('chatMessage', sender, msg );
    });
});

module.exports = { games }