const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Board, Piece, Pawn, King, Queen, Bishop, Knight, Rook  } = require('./game');

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });

    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    socket.on('newBoard', () => {
        console.log('newBoard event received - creating board on server');
        let board = new Board();
        io.emit('updateBoard', board.layout);
    });

    socket.on('updateBoard', (boardData) => {
        console.log('updateBoard event received');
        io.emit('updateBoard', boardData)
    });
});