const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Board, attachSocket, classes } = require('./engine/main');
const { User, takenUserIds } = require('./online/user');
let { Game, games, takenGameIds, serializeGame } = require('./online/game')

// FORMBAR!!!!
const jwt = require('jsonwebtoken');
const session = require('express-session');

const AUTH_URL = 'https://formbeta.yorktechapps.com';
// callback URL that Formbar should redirect back to with ?token=JWT
const THIS_URL = 'http://localhost:3000/login'

const app = express();
app.use(express.static('static')); // serve client files from /public

// session for Formbar login
app.use(session({
    secret: 'idekWhatToPutHere!@#$%^&*',
    resave: false,
    saveUninitialized: false
}));

// make the session user available to all templates via res.locals
app.use((req, res, next) => {
    res.locals.user = req.session ? req.session.user : null;
    next();
});

// simple JSON endpoint to get the current signed-in user from session
app.get('/me', (req, res) => {
    if (req.session && req.session.user) return res.json({ user: req.session.user, token: req.session.token || null });
    return res.status(200).json({ user: null });
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    // If the user is not signed in, send them to the login page.
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }

    // signed in — render the game selection page
    res.render('selectGame');
});

// app.get('/testing', (req, res) => {
//     res.redirect('/login');
// });

app.get('/game', (req, res) => {
    res.render('game');
});

// Login route for Formbar
app.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/');
    }
    
    // If Formbar redirected back with a token, decode it and store in session
    if (req.query && req.query.token) {
        try {
            let tokenData = jwt.decode(req.query.token);
            req.session.token = tokenData;
            // prefer displayName, fall back to name or email
            req.session.user = tokenData.displayName || tokenData.name || tokenData.email || 'unknown';
            console.log('User signed in via Formbar:', req.session.user);
            console.log(req.session.token.id)
            return res.redirect('/');
        } catch (err) {
            console.error('Invalid token on /login callback', err);
            return res.status(400).send('Invalid token');
        }
    }

    // otherwise render a simple login page with a link to Formbar's OAuth
    res.render('login', { authUrl: AUTH_URL, thisUrl: THIS_URL });
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
            if (g.owner == user) return true;
            if (g.owner.id == user.id) return true;
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
            if (user.game && user.game.messages) socket.emit('messageHistory', user.game.messages)
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

    socket.on('messageHistory', () => {
        // console.log(user)
        if (user.game && user.game.messages) socket.emit('messageHistory', user.game.messages)
    })

    socket.on('promotion', (x, y, newPiece) => {
        if (user.game.board.layout[y][x].constructor.name == 'Pawn') {
            user.game.board.layout[y][x] = new classes[newPiece](user.side, 0)
            user.game.update()
        }
    })

    socket.on('newGame', (visibility = 'public', name = '') => {
        if (user.game) {
            user.game.leave(user)
        }
        // console.log('newGame event received');
        let game = new Game(visibility, name)
        game.owner = user
        // console.log(game.id, game.joinCode, game.owner)
        game.update()
        // send the updated visible-games list (including any private games the creator is in) to the creator only
        socket.emit('gamesList', getVisibleGames())
        io.emit('refreshGames')
        socket.emit('redirect', `/game?code=${game.joinCode}`)
    });

    socket.on('updateBoard', (data) => {
        console.log('updateBoard event received');
        io.emit('updateBoard', data)
    });

    // When a message comes in
    socket.on('chatMessage', (msg) => {
        if (user && user.game) user.game.chatMsg(user.id, msg)
    });

    socket.on('deleteGame', (gameId) => {
        const game = games.find(g => g.id === gameId);

        if (game && game.owner.id === user.id) {
            // mutate the shared array instead of reassigning the variable
            const idx = games.findIndex(g => g.id === gameId);
            if (idx !== -1) games.splice(idx, 1);
            // console.log(`Game ${gameId} deleted by owner ${user.id}.`);
            io.emit('refreshGames');
        }
    });
});

module.exports = { games }
