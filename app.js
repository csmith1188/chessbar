console.clear()

const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const path = require('path')
const fs = require('fs')
const https = require('https')
const httpReq = require('http')
const { Board, attachSocket, classes } = require('./engine/main')
const { User, takenUserIds, userSocket } = require('./online/user')
let { Game, games, takenGameIds, serializeGame } = require('./online/game')
const { startClockManager } = require('./online/clockManager')
const { POOL_ID, FORMBAR_URL, THIS_URL, FORMBAR_API_KEY, FB_MIDDLEWARE_SECRET } = require('./config.js')
const sqlite3 = require('sqlite3')
let sql

const db = new sqlite3.Database('database/database.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) return console.error('Error connecting to database:', err.message)
})

const PLAY_PRICE = 25

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
})

//! End digipogs

const jwt = require('jsonwebtoken')
const session = require('express-session')

const AUTH_URL = FORMBAR_URL
// callback URL that Formbar should redirect back to with ?token=JWT

const app = express()
app.use(express.static('static')) // serve client files from /public
app.use(express.json({ limit: '50mb' })) // allow base64 uploads up to ~50MB

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

// Friendly error for payloads that exceed the JSON body parser limit
app.use((err, req, res, next) => {
    if (err && (err.type === 'entity.too.large' || err instanceof Error && err.status === 413)) {
        return res.status(413).json({ error: 'Payload too large' })
    }
    next(err)
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
    // If a specific user id is provided via query, show that user's profile.
    const viewingUser = req.query && req.query.usr ? Number(req.query.usr) : null
    const formbarId = viewingUser || Number(req.session.user.id || req.session.user.formbar_id || req.session.user.user_id) || 0

    if (!formbarId) return res.render('profile', { avatarUrl: '/img/basic_avatar.png' })

    db.get('SELECT avatar FROM users WHERE formbar_id = ?', [formbarId], (err, row) => {
        if (err) {
            console.error('DB error fetching avatar:', err)
            return res.render('profile', { avatarUrl: '/img/basic_avatar.png' })
        }
        if (row && row.avatar) {
            return res.render('profile', { avatarUrl: `/img/avatars/${row.avatar}` })
        }
        return res.render('profile', { avatarUrl: '/img/basic_avatar.png' })
    })
})

// Accept avatar changes via either a data URL (from file upload) or a remote URL.
app.post('/profile/avatar', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Not authenticated' })
    const formbarId = Number(req.session.user.id || req.session.user.formbar_id || req.session.user.user_id) || 0
    if (!formbarId) return res.status(400).json({ error: 'No user id available' })

    const avatarsDir = path.join(__dirname, 'static', 'img', 'avatars')
    try { if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true }) } catch (e) { /* ignore */ }

    // Ensure `avatar` column exists on users table. If missing, add it.
    db.all("PRAGMA table_info(users);", [], (err, cols) => {
        if (err) return res.status(500).json({ error: 'DB error' })
        const hasAvatar = cols.some(c => c && c.name === 'avatar')
        const continueSave = () => {
            // Two supported flows: { data: dataUrl, filename } or { url }
            if (req.body && req.body.data) {
                // data URL (base64)
                const dataUrl = String(req.body.data)
                const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/)
                if (!match) return res.status(400).json({ error: 'Invalid data URL' })
                const mime = match[1]
                const b64 = match[2]
                if (!mime.startsWith('image/')) return res.status(400).json({ error: 'Unsupported image MIME' })
                let ext = mime.split('/')[1]
                if (ext === 'jpeg') ext = 'jpg'
                const filename = `${formbarId}_${Date.now()}.${ext}`
                const filePath = path.join(avatarsDir, filename)
                const buf = Buffer.from(b64, 'base64')
                fs.writeFile(filePath, buf, (werr) => {
                    if (werr) return res.status(500).json({ error: 'Failed to save file' })
                    db.run('UPDATE users SET avatar = ? WHERE formbar_id = ?', [filename, formbarId], function (uerr) {
                        if (uerr) return res.status(500).json({ error: 'DB update failed' })
                        return res.json({ success: true, url: `/img/avatars/${filename}` })
                    })
                })
            } else if (req.body && req.body.url) {
                let theUrl = String(req.body.url)
                let parsed
                try { parsed = new URL(theUrl) } catch (e) { return res.status(400).json({ error: 'Invalid URL' }) }
                const client = parsed.protocol === 'https:' ? https : httpReq
                client.get(theUrl, (resp) => {
                    const status = resp.statusCode || 0
                    if (status >= 300 && status < 400 && resp.headers && resp.headers.location) {
                        // follow simple redirects
                        return client.get(resp.headers.location, (r2) => resp = r2)
                    }
                    const ctype = (resp.headers && resp.headers['content-type']) ? String(resp.headers['content-type']) : ''
                    if (!ctype.startsWith('image/')) {
                        resp.resume()
                        return res.status(400).json({ error: 'Remote URL did not return an image' })
                    }
                    let ext = ctype.split('/')[1] || 'png'
                    if (ext === 'jpeg') ext = 'jpg'
                    const filename = `${formbarId}_${Date.now()}.${ext}`
                    const filePath = path.join(avatarsDir, filename)
                    const fileStream = fs.createWriteStream(filePath)
                    resp.pipe(fileStream)
                    fileStream.on('finish', () => {
                        fileStream.close(() => {
                            db.run('UPDATE users SET avatar = ? WHERE formbar_id = ?', [filename, formbarId], function (uerr) {
                                if (uerr) return res.status(500).json({ error: 'DB update failed' })
                                return res.json({ success: true, url: `/img/avatars/${filename}` })
                            })
                        })
                    })
                    fileStream.on('error', (e) => {
                        return res.status(500).json({ error: 'Failed to save remote image' })
                    })
                }).on('error', (e) => {
                    return res.status(400).json({ error: 'Failed to fetch URL' })
                })
            } else {
                return res.status(400).json({ error: 'No data or URL provided' })
            }
        }

        if (!hasAvatar) {
            db.run('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ""', [], (aerr) => {
                // ignore errors (column may be added concurrently); continue either way
                continueSave()
            })
        } else {
            continueSave()
        }
    })
})

// Admin page - restricted to users with an `admin` flag on their session user object
app.get('/admin', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login')
    }
    // Only allow specific Formbar IDs
    const fbId = Number(req.session.user && (req.session.user.id || req.session.user.formbar_id || req.session.user.user_id)) || 0
    const allowed = [37, 40]
    if (!allowed.includes(fbId)) {
        return res.status(403).send('Forbidden')
    }

    res.render('admin')
})

// Helper middleware to check admin by formbar id
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Not authenticated' })
    const fbId = Number(req.session.user && (req.session.user.id || req.session.user.formbar_id || req.session.user.user_id)) || 0
    const allowed = [37, 40]
    if (!allowed.includes(fbId)) return res.status(403).json({ error: 'Forbidden' })
    next()
}

// Return list of all users to admin
app.get('/admin/users', requireAdmin, (req, res) => {
    db.all('SELECT * FROM users ORDER BY display_name COLLATE NOCASE', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' })
        return res.json({ users: rows })
    })
})

// Award tokens (increment) to a user by formbar_id. Body: { amount: 1 }
app.post('/admin/users/:id/add', requireAdmin, (req, res) => {
    const id = Number(req.params.id)
    const amount = Number(req.body.amount) || 1
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' })

    db.get('SELECT * FROM users WHERE formbar_id = ?', [id], (err, user) => {
        if (err) return res.status(500).json({ error: 'DB error' })
        if (!user) return res.status(404).json({ error: 'User not found' })
        const newTokens = (typeof user.tokens === 'number' ? user.tokens : 0) + amount
        db.run('UPDATE users SET tokens = ? WHERE formbar_id = ?', [newTokens, id], function (updateErr) {
            if (updateErr) return res.status(500).json({ error: 'DB update error' })
            db.get('SELECT * FROM users WHERE formbar_id = ?', [id], (err2, updated) => {
                if (err2) return res.status(500).json({ error: 'DB error' })
                return res.json({ user: updated })
            })
        })
    })
})

// Set tokens to an exact value. Body: { tokens: 10 }
app.post('/admin/users/:id/set', requireAdmin, (req, res) => {
    const id = Number(req.params.id)
    const tokens = Number(req.body.tokens)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' })
    if (!Number.isInteger(tokens) || tokens < 0) return res.status(400).json({ error: 'Invalid tokens' })

    db.get('SELECT * FROM users WHERE formbar_id = ?', [id], (err, user) => {
        if (err) return res.status(500).json({ error: 'DB error' })
        if (!user) return res.status(404).json({ error: 'User not found' })
        db.run('UPDATE users SET tokens = ? WHERE formbar_id = ?', [tokens, id], function (updateErr) {
            if (updateErr) return res.status(500).json({ error: 'DB update error' })
            db.get('SELECT * FROM users WHERE formbar_id = ?', [id], (err2, updated) => {
                if (err2) return res.status(500).json({ error: 'DB error' })
                return res.json({ user: updated })
            })
        })
    })
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

// Start the background clock manager (non-blocking)
startClockManager(io, games)

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})

function logUsers() {
    console.clear()
    console.log('Users:')
    users.forEach(u => console.log(`Name: ${u.displayName} | ID: ${u.id} | Active: ${u.active ? ' Active ' : 'Inactive'} | Tokens: ${u.tokens}`))
    console.log()
    console.log('Games:')
    games.forEach(g => {
        const ownerName = g.owner && g.owner.displayName ? g.owner.displayName : 'None'
        console.log(`Owner: ${ownerName} | Name: ${g.name} | ID: ${g.id} | Visibility: ${g.visibility} | Users:`)
        g.users.forEach(u => console.log(`  Name: ${u.displayName}`))
    })
    console.log()
}

let users = []

io.on('connection', (socket) => {
    // if the HTTP session had a Formbar user stored on it, pass that along so the User object
    // can use the Formbar id instead of a generated numeric id.
    const sessionUser = socket.request && socket.request.session ? socket.request.session.user : null
    let user = new User(socket, sessionUser)
    user.addToDb(db)
    user.getInfo(db)
    if (users.some(u => u.id == user.id)) {
        user = users.find(u => u.id == user.id)
        user.socket = socket
        user.sessionUser = sessionUser
        user.active = true
        // clear inactivity timestamp when the user reconnects
        try { user.lastActiveAt = null } catch (e) {}
        try { user.youAre() } catch (e) {}
        // console.log(`User ${user.displayName || user.id} reconnected`)
        // Ensure the DB row exists and update display_name if missing on reload
        try { user.addToDb(db) } catch (e) { console.error('addToDb error on reconnect:', e) }
        user.getInfo(db)
    } else {
        users.push(user)
        console.log(`Created new user: ${user.displayName || user.id}`)
    }

    logUsers()

    function getVisibleGames() {
        // console.log(games)
        return games.filter(g => {
            if (g.visibility === 'public') return true
            if (g.owner && (g.owner == user || g.owner.id == user.id)) return true
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

    // When a user resigns
    socket.on(('resign'), () => {
        if (user.game) {
            user.game.resign(user)
        }
    })

    socket.on('join', (gameId) => {
        for (let game of games) {
            if (game.joinCode == gameId) {
                game.join(user)
                break
            } else if (game.id == gameId && game.visibility === 'public') {
                game.join(user)
                break
            }
        }

        if (user.game) {
            if (user.game.messages) {
                socket.emit('messageHistory', user.game.messages)
            }
            return
        }

        socket.emit('noGame')
        logUsers()
    })

    //! Disconnection
    socket.on('disconnect', () => {
        user.active = false
        // record when the user went inactive so clients can show duration
        try { user.lastActiveAt = Date.now() } catch (e) {}
        // clear the socket reference so serialize() can accurately reflect connection state
        try { user.socket = null } catch (e) {}
        if (user.game) user.game.leave(user)

        if (user.id <= 0) {
            if (takenUserIds.includes(user.id)) {
                takenUserIds.splice(takenUserIds.indexOf(user.id), 1)
            }
        }

        logUsers()
    })

    socket.on('messageHistory', () => {
        // console.log(user)
        if (user.game && user.game.messages) socket.emit('messageHistory', user.game.messages)
    })

    socket.on('promotion', (x, y, newPiece) => {
        if (!user.game.promotionPending) return
        if (user.game.board.layout[y][x].constructor.name == 'Pawn') {
            user.game.board.layout[y][x] = new classes[newPiece](user.side, 0)
            const opponent = user.side == 'white' ? 'black' : 'white'
            const inCheck = user.game.board.inCheck(opponent)
            const isMate = inCheck && !user.game.board.hasLegalMoves(opponent)
            const isStalemate = !inCheck && !user.game.board.hasLegalMoves(opponent)
            const isKingOnly = user.game.board.onlyKingsLeft()
            user.game.endPromotion()
            user.game.update({}, inCheck, isMate, isStalemate, isKingOnly, opponent, user.side, null)
        }
    })

    socket.on('newGame', (visibility = 'public', name = '', chatOn = true, startWhite = true, time = null) => {
        if (user.id > 0) {
            if (user.game) {
                user.game.leave(user)
            }
            // console.log('newGame event received')
            // Normalize time: treat non-finite and non-positive values (including 0) as null => infinite clock
            const parsed = Number(time)
            const t = Number.isFinite(parsed) && parsed > 0 ? parsed : null
            let game = new Game(visibility, name, chatOn, startWhite, t)
            game.owner = user
            // console.log(game.id, game.joinCode, game.owner)
            game.update()
            // send the updated visible-games list (including any private games the creator is in) to the creator only
            socket.emit('gamesList', getVisibleGames())
            io.emit('refreshGames')
            socket.emit('redirect', `/game?code=${game.joinCode}`)
        } else {
            socket.emit('redirect', '/login')
        }
        logUsers()
    })

    socket.on('updateBoard', (data) => {
        // console.log('updateBoard event received')
        if (data) {
            user.game.update(data)
        } else {
            user.game.emptyUpdate()
        }
        logUsers()
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
        if (user.game.chatOn) {
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
        } else {
            user.socket.emit('chatOff')
        }

    })

    //kayden's clock
    socket.on('updateClock', () => {
        if (user.game) {
            user.side
        }
    })

    socket.on('deleteGame', (gameId) => {
        const game = games.find(g => g.id === gameId)

        if (game && game.owner && game.owner.id === user.id) {
            // mutate the shared array instead of reassigning the variable
            const idx = games.findIndex(g => g.id === gameId)
            if (idx !== -1) games.splice(idx, 1)
            // console.log(`Game ${gameId} deleted by owner ${user.id}.`)
            io.emit('refreshGames')
        }
        logUsers()
    })

    socket.on('requestValidMoves', (piece) => {
        // Ensure we have a game and valid numeric coordinates (0 is valid)
        if (
            piece && piece.name && piece.side &&
            user && user.game && !user.game.finished &&
            Number.isInteger(piece.x) && Number.isInteger(piece.y)
        ) {
            let validMoves = []
            if (user.side == 'white') {
                // instantiate with side/moves so `this.side` is set in piece methods
                const pieceObj = new classes[piece.name](piece.side, piece.moves)
                if (pieceObj) {
                    for (let y = 0; y < 8; y++) {
                        for (let x = 0; x < 8; x++) {
                            // pass the actual 2D array layout, not the Board object
                            if (pieceObj.validMove(user.game.board.layout, piece.x, piece.y, x, y) &&
                                user.game.board.layout[y][x].side != user.side &&
                                !user.game.board.wouldBeInCheckAfterMove(piece.x, piece.y, x, y)) {
                                validMoves.push({ x, y })
                            }
                        }
                    }
                }
            } else if (user.side == 'black') {
                piece.y = 7 - piece.y
                // instantiate with side/moves so `this.side` is set in piece methods
                const pieceObj = new classes[piece.name](piece.side, piece.moves)
                if (pieceObj) {
                    for (let y = 0; y < 8; y++) {
                        for (let x = 0; x < 8; x++) {
                            // pass the actual 2D array layout, not the Board object
                            if (pieceObj.validMove(user.game.board.layout, piece.x, piece.y, x, y) &&
                                user.game.board.layout[y][x].side != user.side &&
                                !user.game.board.wouldBeInCheckAfterMove(piece.x, piece.y, x, y)) {
                                validMoves.push({ x: x, y: 7 - y })
                            }
                        }
                    }
                }
            }
            socket.emit('validMoves', validMoves)
        }
    })
})


module.exports = { games }
