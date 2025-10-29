const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Board, attachSocket } = require('./board');
const { User } = require('./user');

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

let users = [];

io.on('connection', (socket) => {
    let currentUser;
    
    // Find the next available user ID
    let nextId = 1;
    while (users.find(user => user.id === nextId)) {
        nextId++;
    }
    
    // Determine user side based on existing users
    let userSide;
    if (nextId === 1) {
        userSide = 'white';
    } else if (nextId === 2) {
        userSide = 'black';
    } else {
        userSide = 'spectating';
    }

    currentUser = new User(nextId, userSide, socket);
    users.push(currentUser);    console.log('A user connected:', currentUser.id, currentUser.side);

    socket.on('disconnect', () => {
        console.log('User disconnected');
        const userIndex = users.findIndex(user => user.id === currentUser.id);
        if (userIndex !== -1) {
            users.splice(userIndex, 1);
        }
    });

    socket.emit('youAre', {id: currentUser.id, side: currentUser.side})

    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    socket.on('newBoard', () => {
        console.log('newBoard event received - creating board on server');
        let board = new Board();
        io.emit('updateBoard', board);
    });

    socket.on('updateBoard', (board) => {
        console.log('updateBoard event received');
        io.emit('updateBoard', board)
    });
});