const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')
const { Board, attachSocket, classes } = require('./engine/main')
const { User, takenUserIds, userSocket } = require('./online/user')
let { Game, games, takenGameIds, serializeGame } = require('./online/game')
const { EMPLOYEE_ID_1, EMPLOYEE_ID_2, EMPLOYEE_PIN_1, EMPLOYEE_PIN_2, POOL_ID, FORMBAR_URL, THIS_URL, FORMBAR_API_KEY, FB_MIDDLEWARE_SECRET } = require('./INFO.js')
const sqlite3 = require('sqlite3')
let sql

const db = new sqlite3.Database('database/database.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) return console.error('Error connecting to database:', err.message)
})

// db.all('SELECT * FROM users', (err, rows) => {
// console.log(rows)
// })

const PLAY_PRICE = 1
// const WIN_AMOUNT = 110

//! For digipogs

// Connect to Formbar WS API
const fbIo = require('socket.io-client')
// Replace this address with the address of the Formbar you want to use.
const fbSocket = fbIo(FORMBAR_URL, {
    extraHeaders: {
        api: FORMBAR_API_KEY
    }
})

// Wait for successful connection
fbSocket.on('connect', () => {
    console.log('Connected to Formbar server')
    // Send the transfer
})

// fbSocket.on('transferResponse', (response) => {
// console.log('Transfer Response:', response)
// response will be: { success: true/false, message: '...' }
// })

//! End digipogs

const jwt = require('jsonwebtoken')
const session = require('express-session')

const AUTH_URL = FORMBAR_URL
// callback URL that Formbar should redirect back to with ?token=JWT

const app = express()
app.use(express.static('static')) // serve client files from /public

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

// session for Formbar login
const sessionMiddleware = session({
    secret: FB_MIDDLEWARE_SECRET,
    resave: false,
    saveUninitialized: false
})

app.use(sessionMiddleware)

// make the session user available to all templates via res.locals
app.use((req, res, next) => {
    res.locals.user = req.session ? req.session.user : null
    next()
})

// simple JSON endpoint to get the current signed-in user from session
app.get('/me', (req, res) => {
    if (req.session && req.session.user) return res.json({ user: req.session.user, token: req.session.token || null })
    return res.status(200).json({ user: null })
})

app.get('/', (req, res) => {
    // If the user is not signed in, send them to the login page.
    if (!req.session || !req.session.user) {
        return res.redirect('/login')
    }

    // signed in — render the game selection page
    res.render('selectGame')
})

app.get('/pay', (req, res) => {
    // If the user is not signed in, send them to the login page.
    if (!req.session || !req.session.user) {
        return res.redirect('/login')
    }

    res.render('pay')
})

app.get('/game', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login')
    }
    res.render('game')
})

// Login route for Formbar
app.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/')
    }

    // If Formbar redirected back with a token, decode it and store in session
    if (req.query && req.query.token) {
        try {
            let tokenData = jwt.decode(req.query.token)
            req.session.token = tokenData
            // prefer displayName, fall back to name or email
            req.session.user = tokenData
            // console.log('User signed in via Formbar:', req.session.user)
            // console.log(req.session.token.id)
            return res.redirect('/')
        } catch (err) {
            console.error('Invalid token on /login callback', err)
            return res.status(400).send('Invalid token')
        }
    }

    // otherwise render a simple login page with a link to Formbar's OAuth
    res.render('login', { authUrl: AUTH_URL, thisUrl: `${THIS_URL}/login` })
})

app.get('/profile', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login')
    }

    res.render('profile')
})

const server = http.createServer(app)
const io = new Server(server, {
    cors: { origin: '*' } // adjust for production
})

// Attach express session to socket.io so we can access req.session in socket handlers
io.use((socket, next) => {
    // sessionMiddleware will populate socket.request.session
    sessionMiddleware(socket.request, socket.request.res || {}, next)
})

// Attack sockets
attachSocket(io, games)
userSocket(io, db)

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

let users = []

io.on('connection', (socket) => {
    // if the HTTP session had a Formbar user stored on it, pass that along so the User object
    // can use the Formbar id instead of a generated numeric id.
    const sessionUser = socket.request && socket.request.session ? socket.request.session.user : null
    let user = new User(socket, sessionUser)
    user.addToDb(db)
    user.getInfo(db)
    users.push(user)

    function getVisibleGames() {
        // console.log(games)
        return games.filter(g => {
            if (g.visibility === 'public') return true
            if (g.owner == user) return true
            if (g.owner.id == user.id) return true
            return false
        }).map(serializeGame)
    }

    socket.emit('gamesList', getVisibleGames())

    socket.on('purchaseToken', (pin, amount) => {
        // console.log('purchaseToken', pin, amount)

        const amt = parseInt(amount) || 0
        if (amt <= 0) {
            socket.emit('tokenTransactionComplete')
            return
        }

        let completed = 0

        // For each requested token: attach a one-time response handler BEFORE emitting
        // the transfer, to avoid missing fast responses. Count completions and only
        // notify the client when all transfers have returned.
        for (let i = 0; i < amt; i++) {
            if (user.id) {
                const data = {
                    from: user.id,
                    to: POOL_ID,
                    amount: PLAY_PRICE,
                    reason: 'Chess Payment',
                    pin: pin,
                    pool: true
                }

                fbSocket.once('transferResponse', res => {
                    socket.emit('transferResponse', res)

                    if (res && res.success === true) {
                        // Use parameterized query to avoid accidental SQL issues
                        db.run('UPDATE users SET tokens = ? WHERE formbar_id = ?', [user.tokens + 1, user.id], function (err) {
                            if (err) console.error('DB update error:', err)
                            else {
                                user.tokens++
                                console.log('Player bought token', user.tokens)
                            }
                        })
                    } else {
                        console.log('Payment failed:', res)
                    }

                    completed++
                    if (completed === amt) {
                        socket.emit('tokenTransactionComplete')
                    }
                })

                // Emit after the listener is attached so we don't miss fast responses
                fbSocket.emit('transferDigipogs', data)
            } else {
                // No user id available; still count this iteration toward completion
                completed++
                if (completed === amt) socket.emit('tokenTransactionComplete')
            }
        }
    })

    socket.on('gamesList', () => {
        socket.emit('gamesList', getVisibleGames())
    })

    // console.log('A user connected:', user.id)

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
        //const name = users[socket.id]
        //console.log(`${name} disconnected`)
        if (takenUserIds.includes(user.id)) {
            takenUserIds.splice(takenUserIds.indexOf(user.id), 1)
        }
        if (user.game) user.game.leave(user)
    })

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

    socket.on('newGame', (visibility = 'public', name = '', pin = 0) => {
        if (user.game) {
            user.game.leave(user)
        }
        // console.log('newGame event received')
        let game = new Game(visibility, name)
        game.owner = user
        // console.log(game.id, game.joinCode, game.owner)
        game.update()
        // send the updated visible-games list (including any private games the creator is in) to the creator only
        socket.emit('gamesList', getVisibleGames())
        io.emit('refreshGames')
        socket.emit('redirect', `/game?code=${game.joinCode}`)
    })
    //         })
    //     }
    // }

    socket.on('updateBoard', (data) => {
        // console.log('updateBoard event received')
        io.emit('updateBoard', data)
    })

    // kayden's chat limiter
    const chatLimit = {
        count: 0,
        lastReset: Date.now()
    }
    const CHAT_LIMIT = 5        // max messages
    const CHAT_WINDOW = 10_000  // cool-down window in ms

    // When a message comes in
    socket.on('chatMessage', (msg) => {
        const now = Date.now()

        if (now - chatLimit.lastReset > CHAT_WINDOW) {
            chatLimit.count = 0
            chatLimit.lastReset = now
        }

        if (chatLimit.count >= CHAT_LIMIT) {
            // Emit a chat message instead of an error message
            socket.emit('chatMessage', 'System', 'You are sending messages too fast. Please wait a few seconds.');
            return;
        }
        chatLimit.count++;

        if (chatLimit.count >= CHAT_LIMIT) {
            // Emit a chat message for muting
            socket.emit('chatMessage', 'System', 'Muted for 10 seconds for spamming.')
            socket.mutedUntil = Date.now() + 10_000;
            return;
        }

        // Broadcast the actual chat message
        user.game.chatMsg(user.displayName, msg)

    })

    socket.on('deleteGame', (gameId) => {
        const game = games.find(g => g.id === gameId)

        if (game && game.owner.id === user.id) {
            // mutate the shared array instead of reassigning the variable
            const idx = games.findIndex(g => g.id === gameId)
            if (idx !== -1) games.splice(idx, 1)
            // console.log(`Game ${gameId} deleted by owner ${user.id}.`)
            io.emit('refreshGames')
        }
    })
})


module.exports = { games }
