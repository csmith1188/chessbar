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
    res.render('index');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' } // adjust for production
});

attachSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

let users = []

io.on('connection', (socket) => {
    let user = new User(socket)
    // socket.is = user
    users.push(user);

    socket.emit('gamesList', games.map(serializeGame) )

    socket.on('gamesList', () => {
        socket.emit('gamesList', games.map(serializeGame))
    })

    console.log('A user connected:', user.id);

    socket.on('join', (gameId) => {
        for (let game of games) {
            if (game.id == gameId) {
                game.join(user)
            }
        }
    })

    socket.on('disconnect', () => {
        console.log('User disconnected')
        if (takenUserIds.includes(user.id)) {
            takenUserIds.splice(takenUserIds.indexOf(user.id), 1)
        }
    });

    // socket.emit('youAre', {id: user.id, side: user.side})

    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    socket.on('newGame', (visibility = 'public') => {
        console.log('newGame event received - creating board on server');
        let game = new Game(visibility)
        game.join(user)
        io.emit('updateBoard', game.board)
        io.emit('gamesList', games.map(serializeGame))
    });

    socket.on('updateBoard', (board) => {
        console.log('updateBoard event received');
        io.emit('updateBoard', board)
    });
});

module.exports = { games }