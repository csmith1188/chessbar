const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Board, attachSocket } = require('./engine/main');
const { User } = require('./online/user');
const { Game } = require('./online/game')

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
let games = []

io.on('connection', (socket) => {
    let user = new User(users.length, socket)
    // socket.is = user
    users.push(user);    

    console.log('A user connected:', user.id);

    //! Change this later!!!
    console.log('games:\n', games, '\n')
    if (games.length > 0) {
        games[0].join(user)
    }

    socket.on('disconnect', () => {
        console.log('User disconnected')
        const userIndex = users.findIndex(u => u.id === user.id);
        if (userIndex !== -1) {
            users.splice(userIndex, 1);
        }
    });

    // socket.emit('youAre', {id: user.id, side: user.side})

    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    socket.on('newBoard', () => {
        console.log('newBoard event received - creating board on server');
        let game = new Game(games.length, [user])
        games.push(game)
        io.emit('updateBoard', game.board)
    });

    socket.on('updateBoard', (board) => {
        console.log('updateBoard event received');
        io.emit('updateBoard', board)
    });
});