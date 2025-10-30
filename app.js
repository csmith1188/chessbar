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

    socket.emit('gamesList', games.filter(g => g.visibility === 'public').map(serializeGame))

    socket.on('gamesList', () => {
        socket.emit('gamesList', games.filter(g => g.visibility === 'public').map(serializeGame))
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
        console.log('newGame event received - creating board on server');
        let game = new Game(visibility)
        game.join(user)
        game.update()
        io.emit('gamesList', games.filter(g => g.visibility === 'public').map(serializeGame))
    });

    socket.on('updateBoard', (board) => {
        console.log('updateBoard event received');
        io.emit('updateBoard', board)
    });

    //chat and siht
    socket.on('setName', (name) => {
        activeUsers[socket.id] = name;
        console.log(`${name} joined the chat`);

        // Send updated list of usernames to everyone
        io.emit('userList', Object.values(activeUsers));
    });

    // When a message comes in
    socket.on('chatMessage', (msg) => {
        const sender = activeUsers[socket.id] || "Anonymous";
        io.emit('chatMessage', { name: sender, message: msg });
    });
});

module.exports = { games }