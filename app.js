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

    // Run startup migrations to ensure schema is up-to-date
    runStartupMigrations()
})

const PLAY_PRICE = 100

// Startup migrations to handle schema changes for existing databases
function runStartupMigrations() {
    // Ensure notifications table has status column
    db.all("PRAGMA table_info(notifications);", [], (err, cols) => {
        if (err) {
            console.error('Migration error checking notifications table:', err)
            return
        }
        const hasStatus = Array.isArray(cols) && cols.some(c => c && c.name === 'status')
        if (!hasStatus) {
            db.run('ALTER TABLE notifications ADD COLUMN status TEXT DEFAULT "unread"', [], (alterErr) => {
                if (alterErr) {
                    console.error('Migration error adding status column:', alterErr)
                } else {
                    console.log('Migration: Added status column to notifications table')
                }
            })
        }
    })
}

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
const { error } = require('console')

const AUTH_URL = FORMBAR_URL
// callback URL that Formbar should redirect back to with ?token=JWT

const app = express()
app.use(express.static('static')) // serve client files from /public
app.use(express.json({ limit: '50mb' })) // allow base64 uploads up to ~50MB

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
// Make PLAY_PRICE available to all EJS templates
app.locals.PLAY_PRICE = PLAY_PRICE

// Also ensure each response has the value on `res.locals` so templates
// rendered with an explicit locals object still see `PLAY_PRICE`.
app.use((req, res, next) => {
    res.locals.PLAY_PRICE = app.locals.PLAY_PRICE
    next()
})

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

// Fetch unread notification count for the current user and make it available to templates
app.use((req, res, next) => {
    res.locals.unreadNotifCount = 0
    // Only fetch count for HTML page requests, not API/AJAX requests
    const isApiRequest = req.xhr || req.path.startsWith('/notifications/') ||
        req.path.startsWith('/api/') || req.headers.accept?.includes('application/json')
    if (isApiRequest || !req.session || !req.session.user) {
        return next()
    }

    const userId = Number(req.session.user.id || req.session.user.formbar_id || req.session.user.user_id) || 0
    if (userId) {
        db.get('SELECT COUNT(*) as count FROM notifications WHERE user = ? AND (status IS NULL OR status = ?)', [userId, 'unread'], (err, row) => {
            if (!err && row) {
                res.locals.unreadNotifCount = row.count || 0
            }
            next()
        })
        return
    }
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

    if (!formbarId) return res.render('profile', { avatarUrl: '/img/basic_avatar.png', notifications: [], friends: [], isOwnProfile: false })

    // Determine whether the visitor is viewing their own profile
    const signedInId = Number(req.session.user.id || req.session.user.formbar_id || req.session.user.user_id) || 0
    const viewingOwnProfile = signedInId && signedInId === Number(formbarId)

    // Helper to render with avatar, notifications, and friends
    function renderWith(avatarUrl, notifications, friends) {
        // ensure notifications and friends always provided to template
        return res.render('profile', {
            avatarUrl,
            notifications: Array.isArray(notifications) ? notifications : [],
            friends: Array.isArray(friends) ? friends : [],
            isOwnProfile: viewingOwnProfile
        })
    }

    // If viewing own profile, fetch notifications; otherwise only fetch avatar
    const fetchNotifications = viewingOwnProfile

    if (fetchNotifications) {
        const oneHourAgo = Date.now() - 60 * 60 * 1000

        const fetchAndRender = () => {
            db.all('SELECT notification, type, message, status, created_time FROM notifications WHERE user = ? ORDER BY notification DESC', [signedInId], (nerr, notes) => {
                if (nerr) {
                    console.error('DB error fetching notifications:', nerr)
                    notes = []
                }
                // Fetch friends
                                db.all(`SELECT u.formbar_id, u.display_name, u.avatar,
                                                             f.status AS friend_status,
                                                             CASE WHEN f.status = 'blocked' AND f.id_1 = ? THEN 1 ELSE 0 END AS blocked_by_me
                                                FROM friends f 
                                                JOIN users u ON (CASE WHEN f.id_1 = ? THEN f.id_2 ELSE f.id_1 END) = u.formbar_id 
                                                WHERE (f.id_1 = ? OR f.id_2 = ?)
                                                    AND (f.status = 'friends' OR (f.status = 'blocked' AND f.id_1 = ?))`,
                                        [signedInId, formbarId, formbarId, formbarId, signedInId], (ferr, friends) => {
                        if (ferr) {
                            console.error('DB error fetching friends:', ferr)
                            friends = []
                        }
                        // Now fetch avatar and render
                        db.get('SELECT avatar FROM users WHERE formbar_id = ?', [formbarId], (err, row) => {
                            if (err) {
                                console.error('DB error fetching avatar:', err)
                                return renderWith('/img/basic_avatar.png', notes, friends)
                            }
                            if (row && row.avatar) {
                                return renderWith(`/img/avatars/${row.avatar}`, notes, friends)
                            }
                            return renderWith('/img/basic_avatar.png', notes, friends)
                        })
                    })
            })
        }

        db.all('SELECT notification, read_time FROM notifications WHERE user = ? AND status = ? AND read_time IS NOT NULL', [signedInId, 'read'], (cerr, rows) => {
            if (cerr || !Array.isArray(rows) || rows.length === 0) {
                if (cerr) console.error('DB error fetching read notifications:', cerr)
                return fetchAndRender()
            }

            const toDelete = rows
                .map(r => ({ id: r.notification, time: Date.parse(r.read_time) }))
                .filter(r => Number.isFinite(r.time) && r.time <= oneHourAgo)
                .map(r => r.id)

            if (toDelete.length === 0) return fetchAndRender()

            const placeholders = toDelete.map(() => '?').join(',')
            db.run(`DELETE FROM notifications WHERE user = ? AND notification IN (${placeholders})`, [signedInId, ...toDelete], (derr) => {
                if (derr) console.error('DB error deleting old read notifications:', derr)
                return fetchAndRender()
            })
        })
    } else {
        // Fetch friends for the profile being viewed
        db.all(`SELECT u.formbar_id, u.display_name, u.avatar,
                   'friends' AS friend_status,
                   0 AS blocked_by_me
                FROM friends f 
                JOIN users u ON (CASE WHEN f.id_1 = ? THEN f.id_2 ELSE f.id_1 END) = u.formbar_id 
                WHERE (f.id_1 = ? OR f.id_2 = ?) AND f.status = 'friends'`,
            [formbarId, formbarId, formbarId], (ferr, friends) => {
                if (ferr) {
                    console.error('DB error fetching friends:', ferr)
                    friends = []
                }
                db.get('SELECT avatar FROM users WHERE formbar_id = ?', [formbarId], (err, row) => {
                    if (err) {
                        console.error('DB error fetching avatar:', err)
                        return renderWith('/img/basic_avatar.png', [], friends)
                    }
                    if (row && row.avatar) {
                        return renderWith(`/img/avatars/${row.avatar}`, [], friends)
                    }
                    return renderWith('/img/basic_avatar.png', [], friends)
                })
            })
    }
})

// Accept avatar changes via either a data URL (from file upload) or a remote URL.
app.post('/profile/avatar', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Not authenticated' })

    const formbarId = getFormbarId(req)
    if (!formbarId) return res.status(400).json({ error: 'No user id available' })

    const avatarsDir = path.join(__dirname, 'static', 'img', 'avatars')
    ensureAvatarsDir(avatarsDir)

    ensureAvatarColumn((err) => {
        if (err) return res.status(500).json({ error: 'DB error' })
        if (req.body && req.body.data) return handleDataUrl(req, res, avatarsDir, formbarId)
        if (req.body && req.body.url) return handleRemoteUrl(req, res, avatarsDir, formbarId)
        return res.status(400).json({ error: 'No data or URL provided' })
    })

    // Helpers
    function getFormbarId(req) {
        return Number(req.session.user.id || req.session.user.formbar_id || req.session.user.user_id) || 0
    }

    function ensureAvatarsDir(dir) {
        try {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        } catch (e) { /* ignore */ }
    }

    function ensureAvatarColumn(cb) {
        db.all("PRAGMA table_info(users);", [], (err, cols) => {
            if (err) return cb(err)
            const hasAvatar = Array.isArray(cols) && cols.some(c => c && c.name === 'avatar')
            if (hasAvatar) return cb(null)
            db.run('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ""', [], (aerr) => {
                // ignore alter errors (could already exist concurrently) and continue
                cb(null)
            })
        })
    }

    function saveAvatarFilenameToDb(filename, cb) {
        db.run('UPDATE users SET avatar = ? WHERE formbar_id = ?', [filename, formbarId], function (uerr) {
            if (uerr) return cb(uerr)
            return cb(null, `/img/avatars/${filename}`)
        })
    }

    function handleDataUrl(req, res, avatarsDir, formbarId) {
        const dataUrl = String(req.body.data)
        const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/)
        if (!match) return res.status(400).json({ error: 'Invalid data URL' })

        const mime = match[1]
        const b64 = match[2]
        if (!mime.startsWith('image/')) return res.status(400).json({ error: 'Unsupported image MIME' })

        let ext = mime.split('/')[1] || 'png'
        if (ext === 'jpeg') ext = 'jpg'
        const filename = `${formbarId}_${Date.now()}.${ext}`
        const filePath = path.join(avatarsDir, filename)
        const buf = Buffer.from(b64, 'base64')

        fs.writeFile(filePath, buf, (werr) => {
            if (werr) return res.status(500).json({ error: 'Failed to save file' })
            saveAvatarFilenameToDb(filename, (uerr, url) => {
                if (uerr) return res.status(500).json({ error: 'DB update failed' })
                return res.json({ success: true, url })
            })
        })
    }

    function handleRemoteUrl(req, res, avatarsDir, formbarId) {
        let theUrl = String(req.body.url)
        let parsed
        try { parsed = new URL(theUrl) } catch (e) { return res.status(400).json({ error: 'Invalid URL' }) }

        fetchImageStream(theUrl, (err, resp) => {
            if (err) return res.status(400).json({ error: err.message || 'Failed to fetch URL' })

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
                    saveAvatarFilenameToDb(filename, (uerr, url) => {
                        if (uerr) return res.status(500).json({ error: 'DB update failed' })
                        return res.json({ success: true, url })
                    })
                })
            })

            fileStream.on('error', (e) => {
                try { fs.unlinkSync(filePath) } catch (e) { }
                return res.status(500).json({ error: 'Failed to save remote image' })
            })
        })
    }

    // Fetch an image response and follow a single redirect if necessary.
    function fetchImageStream(urlStr, cb) {
        const parsed = new URL(urlStr)
        const client = parsed.protocol === 'https:' ? https : httpReq

        const req = client.get(urlStr, (resp) => {
            const status = resp.statusCode || 0
            if (status >= 300 && status < 400 && resp.headers && resp.headers.location) {
                // follow one redirect
                try {
                    const loc = new URL(resp.headers.location, urlStr).toString()
                    const client2 = loc.startsWith('https:') ? https : httpReq
                    client2.get(loc, (r2) => cb(null, r2)).on('error', (e2) => cb(new Error('Failed to fetch redirected URL')))
                } catch (e) {
                    cb(new Error('Invalid redirect location'))
                }
                return
            }
            if (status < 200 || status >= 300) {
                resp.resume()
                return cb(new Error('Remote server returned non-OK status'))
            }
            return cb(null, resp)
        })

        req.on('error', (e) => cb(new Error('Failed to fetch URL')))
    }
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
                notification(id, 'Tokens', `God has gifted you ${amount} ${amount == 1 ? 'token' : 'tokens'}.`)
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
                notification(id, 'Tokens', `God has set your token balance to ${tokens}.`)
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
}

let users = []

function initUser(socket) {
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
        try { user.lastActiveAt = null } catch (e) { }
        try { user.youAre() } catch (e) { }
        // console.log(`User ${user.displayName || user.id} reconnected`)
        // Ensure the DB row exists and update display_name if missing on reload
        try { user.addToDb(db) } catch (e) { console.error('addToDb error on reconnect:', e) }
        user.getInfo(db)
    } else {
        users.push(user)
        console.log(`Created new user: ${user.displayName || user.id}`)
    }
    return user
}
/*
:::::::::  :::::::::  :::::::::: ::::::::      :::     ::::    ::::  ::::::::::
:+:    :+: :+:    :+: :+:       :+:    :+:   :+: :+:   +:+:+: :+:+:+ :+:
+:+    +:+ +:+    +:+ +:+       +:+         +:+   +:+  +:+ +:+:+ +:+ +:+
+#++:++#+  +#++:++#:  +#++:++#  :#:        +#++:++#++: +#+  +:+  +#+ +#++:++#
+#+        +#+    +#+ +#+       +#+   +#+# +#+     +#+ +#+       +#+ +#+
#+#        #+#    #+# #+#       #+#    #+# #+#     #+# #+#       #+# #+#
###        ###    ### ########## ########  ###     ### ###       ### ##########
*/

function getVisibleGames(user) {
    // Return games visible to the current "user" (relies on the surrounding scope's `user`)
    return games
        .filter(g => {
            if (g.visibility === 'public') return true
            if (g.owner && (g.owner == user || g.owner.id == user.id)) return true
            return false
        })
        .map(serializeGame)
}

function pregameEvents(socket, user) {
    // ---- Purchase tokens ----
    socket.on('purchaseToken', (pin, amount) => {
        const amt = parseInt(amount, 10) || 0
        if (amt <= 0 || !user || !user.id) {
            socket.emit('tokenTransactionComplete')
            return
        }

        let completed = 0
        const handleComplete = () => {
            completed += 1
            if (completed === amt) socket.emit('tokenTransactionComplete')
        }

        const buyOne = () => {
            const data = {
                from: user.id,
                to: POOL_ID,
                amount: PLAY_PRICE,
                reason: 'Chess Payment',
                pin: pin,
                pool: true
            }

            fbSocket.once('transferResponse', (res) => {
                socket.emit('transferResponse', res)

                const success = res && res.success === true
                if (!success) {
                    console.log('Payment failed:', res)
                    handleComplete()
                    return
                }

                const newTokenCount = (typeof user.tokens === 'number' ? user.tokens : 0) + 1
                db.run('UPDATE users SET tokens = ? WHERE formbar_id = ?', [newTokenCount, user.id], (err) => {
                    if (err) {
                        console.error('DB update error:', err)
                    } else {
                        user.tokens = newTokenCount
                        console.log('Player bought token', user.tokens)
                    }
                    handleComplete()
                })
            })

            fbSocket.emit('transferDigipogs', data)
        }

        for (let i = 0; i < amt; i++) buyOne()
    })

    // ---- Join game ----
    socket.on('join', (gameId) => {

        const found = games.find(game => (game.joinCode == gameId) || (game.id == gameId && game.visibility === 'public'))
        if (found) {
            found.join(user)
        } else[
            user.socket.emit('redirect', '/')
        ]

        if (user.game) {
            if (user.game.messages) socket.emit('messageHistory', user.game.messages)
            return
        }

        socket.emit('noGame')
        logUsers()
    })

    // ---- Request games list ----
    socket.on('gamesList', () => {
        socket.emit('gamesList', getVisibleGames(user))
    })

    // ---- New game ----
    socket.on('newGame', (visibility = 'public', name = '', chatOn = true, startWhite = true, musicOn = true, time = null) => {
        if (!(user && user.id > 0)) {
            socket.emit('redirect', '/login')
            return
        }

        if (user.game) user.game.leave(user)

        const parsed = Number(time)
        const t = Number.isFinite(parsed) && parsed > 0 ? parsed : null

        const game = new Game(visibility, name, chatOn, startWhite, musicOn, t)
        game.owner = user
        game.update()

        // creator only sees private games they're in, so emit to creator only
        socket.emit('gamesList', getVisibleGames(user))
        io.emit('refreshGames')
        socket.emit('redirect', `/game?code=${game.joinCode}`)

        logUsers()
    })

    // ---- Delete game ----
    socket.on('deleteGame', (gameId) => {
        const game = games.find(g => g.id === gameId)
        if (!game || !game.owner || game.owner.id !== user.id) {
            logUsers()
            return
        }

        const idx = games.findIndex(g => g.id === gameId)
        if (idx !== -1) games.splice(idx, 1)
        io.emit('refreshGames')
        logUsers()
    })
}

/*
::::::::::: ::::    :::  ::::::::      :::     ::::    ::::  ::::::::::
    :+:     :+:+:   :+: :+:    :+:   :+: :+:   +:+:+: :+:+:+ :+:
    +:+     :+:+:+  +:+ +:+         +:+   +:+  +:+ +:+:+ +:+ +:+
    +#+     +#+ +:+ +#+ :#:        +#++:++#++: +#+  +:+  +#+ +#++:++#
    +#+     +#+  +#+#+# +#+   +#+# +#+     +#+ +#+       +#+ +#+
    #+#     #+#   #+#+# #+#    #+# #+#     #+# #+#       #+# #+#
########### ###    ####  ########  ###     ### ###       ### ##########
*/

function inGameEvents(socket, user) {
    // ---- Promotion ----
    socket.on('promotion', (x, y, newPiece) => {
        if (!user.game || !user.game.promotionPending) return
        const cell = user.game.board.layout[y][x]
        if (!cell || cell.constructor.name !== 'Pawn') return

        user.game.board.layout[y][x] = new classes[newPiece](user.side, 0)

        const opponent = user.side === 'white' ? 'black' : 'white'
        const inCheck = user.game.board.inCheck(opponent)
        const isMate = inCheck && !user.game.board.hasLegalMoves(opponent)
        const isStalemate = !inCheck && !user.game.board.hasLegalMoves(opponent)
        const isKingOnly = user.game.board.onlyKingsLeft()

        user.game.endPromotion()

        const move = user.game.moves.find(m => m.to.x === x && m.to.y === y)
        if (move) move.promotion = newPiece
        console.log('Promotion:', user.game.moves)

        user.game.update({}, inCheck, isMate, isStalemate, isKingOnly, opponent, user.side, null)
    })

    // ---- Board updates ----
    socket.on('updateBoard', (data) => {
        if (!user.game) return
        if (data) user.game.update(data)
        else user.game.emptyUpdate()
        logUsers()
    })

    // ---- Resign ----
    socket.on('resign', () => {
        if (!user.game) return
        user.game.resign(user)
    })

    // ---- Clock placeholder (no-op) ----
    socket.on('updateClock', () => {
        // kept for compatibility; no action required here
    })

    // ---- Valid moves request ----
    socket.on('requestValidMoves', (piece) => {
        if (
            !piece || !piece.name || !piece.side ||
            !user || !user.game || user.game.finished ||
            !Number.isInteger(piece.x) || !Number.isInteger(piece.y)
        ) {
            socket.emit('validMoves', [])
            return
        }

        const validMoves = []
        const boardLayout = user.game.board.layout
        const ownSide = user.side

        const addIfValid = (fromX, fromY, toX, toY, pushX, pushY) => {
            const pieceObj = new classes[piece.name](piece.side, piece.moves)
            if (!pieceObj) return
            if (!pieceObj.validMove(boardLayout, fromX, fromY, toX, toY)) return
            if (boardLayout[toY][toX].side === ownSide) return
            if (user.game.board.wouldBeInCheckAfterMove(fromX, fromY, toX, toY)) return
            validMoves.push({ x: pushX, y: pushY })
        }

        if (ownSide === 'white') {
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    addIfValid(piece.x, piece.y, x, y, x, y)
                }
            }
        } else { // black: flip coordinates
            const fromX = piece.x
            const fromY = 7 - piece.y
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    addIfValid(fromX, fromY, x, y, x, 7 - y)
                }
            }
        }

        socket.emit('validMoves', validMoves)
    })
}

/*
 ::::::::  :::    :::     ::: :::::::::::
:+:    :+: :+:    :+:   :+: :+:   :+:
+:+        +:+    +:+  +:+   +:+  +:+
+#+        +#++:++#++ +#++:++#++: +#+
+#+        +#+    +#+ +#+     +#+ +#+
#+#    #+# #+#    #+# #+#     #+# #+#
 ########  ###    ### ###     ### ###
*/

function chatEvents(socket, user) {
    const CHAT_LIMIT = 5        // max messages
    const CHAT_WINDOW = 10_000  // cool-down window in ms

    const chatState = {
        count: 0,
        lastReset: Date.now()
    }

    const isRateLimited = () => {
        const now = Date.now()
        if (now - chatState.lastReset > CHAT_WINDOW) {
            chatState.count = 0
            chatState.lastReset = now
        }
        if (chatState.count >= CHAT_LIMIT) return true
        chatState.count++
        return chatState.count > CHAT_LIMIT
    }

    socket.on('chatMessage', (msg) => {
        if (!user.game || !user.game.chatOn) {
            if (user.socket) user.socket.emit('chatOff')
            return
        }

        if (socket.mutedUntil && Date.now() < socket.mutedUntil) {
            socket.emit('chatMessage', 'System', 'You are currently muted.')
            return
        }

        if (isRateLimited()) {
            socket.emit('chatMessage', 'System', 'You are sending messages too fast. Please wait a few seconds.')
            socket.mutedUntil = Date.now() + 10_000
            socket.emit('chatMessage', 'System', 'Muted for 10 seconds for spamming.')
            return
        }

        user.game.chatMsg(user.displayName, msg)
    })

    socket.on('messageHistory', () => {
        if (user.game && user.game.messages) socket.emit('messageHistory', user.game.messages)
    })
}

/*
:::::::::: :::::::::  ::::::::::: :::::::::: ::::    ::: :::::::::   ::::::::
:+:        :+:    :+:     :+:     :+:        :+:+:   :+: :+:    :+: :+:    :+:
+:+        +:+    +:+     +:+     +:+        :+:+:+  +:+ +:+    +:+ +:+
:#::+::#   +#++:++#:      +#+     +#++:++#   +#+ +:+ +#+ +#+    +:+ +#++:++#++
+#+        +#+    +#+     +#+     +#+        +#+  +#+#+# +#+    +#+        +#+
#+#        #+#    #+#     #+#     #+#        #+#   #+#+# #+#    #+# #+#    #+#
###        ###    ### ########### ########## ###    #### #########   ########
*/

function notification(usr, type, message) {
    let foo = users.find(u => u.id == usr)
    let status = 'unread'
    let read = null
    if (foo && foo.socket) {
        status = 'read'
        read = new Date().toString()
    }
    db.run('INSERT INTO notifications (user, type, message, status, read_time) VALUES (?, ?, ?, ?, ?)', [usr, type, message, status, read])

    if (foo && foo.socket) {
        foo.socket.emit('notification', type, message)
    }
}

function friendEvents(socket, user) {

    function getStatus(user1, user2) {
        return new Promise((resolve) => {
            db.get('SELECT status FROM friends WHERE (id_1 = ? AND id_2 = ?) OR (id_2 = ? AND id_1 = ?)',
                [user1, user2, user1, user2], (err, row) => {
                    if (err) {
                        console.log(err)
                        return resolve(null)
                    }
                    if (row && row.status) return resolve(row.status)
                    return resolve(null)
                }
            )
        })
    }

    function getFirstUser(user1, user2) {
        return new Promise((resolve) => {
            db.get('SELECT id_1 FROM friends WHERE (id_1 = ? AND id_2 = ?) OR (id_2 = ? AND id_1 = ?)',
                [user1, user2, user1, user2], (err, row) => {
                    if (err) {
                        console.log(err)
                        return resolve(null)
                    }
                    if (row && row.id_1) return resolve(row.id_1)
                    return resolve(null)
                }
            )
        })
    }

    function newFriendRecord(user1, user2) {

        console.log(`Creating new friendship between ${user1} and ${user2}.`)

        getStatus(user1, user2).then((status) => {
            if (!status) {
                db.run('INSERT INTO friends (id_1, id_2, status) VALUES (?, ?, "pending")', [user1, user2], (err) => { if (err) console.log(err) })
            }
        })
    }

    function updateFriendRecord(user1, user2, status) {
        console.log(`Updating friendship between ${user1} and ${user2} to be status ${status}.`)

        getStatus(user1, user2).then((existing) => {
            if (existing) {
                db.run('UPDATE friends SET status = ? WHERE (id_1 = ? AND id_2 = ?) OR (id_2 = ? AND id_1 = ?)', [status, user1, user2, user1, user2], (err) => { if (err) console.log(err) })
            }
        })
    }

    function linkTo(usr) {
        return `<a href="/profile?usr=${usr}">${usr}</a>`
    }

    socket.on('friendRequest', (from, to) => {
        console.log('Friend request event:', from, to)

        from = Number(from)
        to = Number(to)

        if (!Number.isFinite(from) || !Number.isFinite(to)) return
        if (from == to) return


        getStatus(from, to).then((status) => {
            if (status == 'friends') return notification(from, 'Friendship', `You are already friends with ${linkTo(to)}.`)
            if (status == 'pending') {
                getFirstUser(from, to).then((u) => {
                    if (u == from) return notification(from, 'Friendship', `You already have a pending request for ${linkTo(to)}.`)

                    updateFriendRecord(from, to, 'friends')

                    notification(to, 'Friendship', `You are now friends with ${linkTo(from)}.`)
                    notification(from, 'Friendship', `You are now friends with ${linkTo(to)}.`)
                })
            } else if (status == 'blocked') {
                notification(from, 'Friendship', `You cannot send a friend request to ${linkTo(to)}.`)
            } else {
                newFriendRecord(from, to)
                notification(from, 'Friendship', `Sent a friend request to ${linkTo(to)}.`)
                notification(to, 'Friendship', `You have a friend request from ${linkTo(from)}.`)
            }
        })
    })

    socket.on('blockFriend', (targetUserId) => {
        const targetId = Number(targetUserId)
        const meId = Number(user.id)
        if (!Number.isFinite(targetId) || targetId <= 0 || targetId === meId) {
            socket.emit('friendBlocked', { success: false, targetId })
            return
        }

        db.get(
            'SELECT friendship FROM friends WHERE (id_1 = ? AND id_2 = ?) OR (id_2 = ? AND id_1 = ?)',
            [meId, targetId, meId, targetId],
            (err, row) => {
                if (err) {
                    console.log(err)
                    socket.emit('friendBlocked', { success: false, targetId })
                    return
                }

                if (row && row.friendship) {
                    db.run(
                        'UPDATE friends SET id_1 = ?, id_2 = ?, status = ? WHERE friendship = ?',
                        [meId, targetId, 'blocked', row.friendship],
                        (uerr) => {
                            if (uerr) {
                                console.log(uerr)
                                socket.emit('friendBlocked', { success: false, targetId })
                                return
                            }
                            socket.emit('friendBlocked', { success: true, targetId })
                        }
                    )
                    return
                }

                db.run(
                    'INSERT INTO friends (id_1, id_2, status) VALUES (?, ?, ?)',
                    [meId, targetId, 'blocked'],
                    (ierr) => {
                        if (ierr) {
                            console.log(ierr)
                            socket.emit('friendBlocked', { success: false, targetId })
                            return
                        }
                        socket.emit('friendBlocked', { success: true, targetId })
                    }
                )
            }
        )
    })

    socket.on('unblockFriend', (targetUserId) => {
        const targetId = Number(targetUserId)
        const meId = Number(user.id)
        if (!Number.isFinite(targetId) || targetId <= 0 || targetId === meId) {
            socket.emit('friendUnblocked', { success: false, targetId })
            return
        }

        db.run(
            'UPDATE friends SET status = ? WHERE id_1 = ? AND id_2 = ? AND status = ?',
            ['friends', meId, targetId, 'blocked'],
            function (err) {
                if (err) {
                    console.log(err)
                    socket.emit('friendUnblocked', { success: false, targetId })
                    return
                }
                if (!this || this.changes < 1) {
                    socket.emit('friendUnblocked', { success: false, targetId })
                    return
                }
                socket.emit('friendUnblocked', { success: true, targetId })
            }
        )
    })

    socket.on('dm', (to, message) => {
        to = Number(to)
        const text = typeof message === 'string' ? message.trim() : ''
        if (!Number.isFinite(to) || to <= 0 || to === Number(user.id) || !text) return

        getStatus(user.id, to).then((status) => {
            if (status !== 'friends') return

            const createdTime = new Date().toString()
            db.run(
                'INSERT INTO dms (id_1, id_2, message, created_time) VALUES (?, ?, ?, ?)',
                [user.id, to, text, createdTime],
                (err) => {
                    if (err) {
                        console.log(err)
                        return
                    }

                    const payload = {
                        from: Number(user.id),
                        to: Number(to),
                        message: text,
                        createdTime
                    }

                    socket.emit('dmMessage', payload)
                    const recipient = users.find(u => Number(u.id) === Number(to))
                    if (recipient && recipient.socket) {
                        recipient.socket.emit('dmMessage', payload)
                    }

                    const recipientOnProfile = recipient && recipient.socket && recipient.socket.currentPath === '/profile'
                    if (!recipientOnProfile) {
                        notification(to, 'DM', `New message from ${linkTo(user.id)}. "${message}"`)
                    }
                }
            )
        })
    })

    socket.on('dmThread', (otherUserId) => {
        const otherId = Number(otherUserId)
        if (!Number.isFinite(otherId) || otherId <= 0 || otherId === Number(user.id)) {
            socket.emit('dmThread', { withUser: otherId, messages: [] })
            return
        }

        getStatus(user.id, otherId).then((status) => {
            if (status !== 'friends') {
                socket.emit('dmThread', { withUser: otherId, messages: [] })
                return
            }

            db.all(
                `SELECT id_1, id_2, message, created_time
                 FROM dms
                 WHERE (id_1 = ? AND id_2 = ?) OR (id_1 = ? AND id_2 = ?)
                 ORDER BY dm ASC`,
                [user.id, otherId, otherId, user.id],
                (err, rows) => {
                    if (err) {
                        console.log(err)
                        socket.emit('dmThread', { withUser: otherId, messages: [] })
                        return
                    }

                    const msgs = Array.isArray(rows)
                        ? rows.map(r => ({
                            from: Number(r.id_1),
                            to: Number(r.id_2),
                            message: r.message || '',
                            createdTime: r.created_time || ''
                        }))
                        : []

                    socket.emit('dmThread', { withUser: otherId, messages: msgs })
                }
            )
        })
    })
}

// Mark a notification as read (AJAX from profile page)
app.post('/notifications/:id/read', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Not authenticated' })
    const nid = Number(req.params.id)
    if (!Number.isInteger(nid) || nid <= 0) return res.status(400).json({ error: 'Invalid id' })
    const userId = Number(req.session.user.id || req.session.user.formbar_id || req.session.user.user_id) || 0

    db.get('SELECT user FROM notifications WHERE notification = ?', [nid], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB error' })
        if (!row) return res.status(404).json({ error: 'Notification not found' })
        if (Number(row.user) !== userId) return res.status(403).json({ error: 'Forbidden' })

        db.run('UPDATE notifications SET status = ? WHERE notification = ?', ['read', nid], function (uerr) {
            if (uerr) return res.status(500).json({ error: 'DB update error' })
        })

        db.run('UPDATE notifications SET read_time = ? WHERE notification = ?', [new Date().toString(), nid], function (uerr) {
            if (uerr) return res.status(500).json({ error: 'DB update error' })
            return res.json({ success: true })
        })
    })
})

// Delete a notification (AJAX from profile page)
app.post('/notifications/:id/delete', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Not authenticated' })
    const nid = Number(req.params.id)
    if (!Number.isInteger(nid) || nid <= 0) return res.status(400).json({ error: 'Invalid id' })
    const userId = Number(req.session.user.id || req.session.user.formbar_id || req.session.user.user_id) || 0

    db.get('SELECT user FROM notifications WHERE notification = ?', [nid], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB error' })
        if (!row) return res.status(404).json({ error: 'Notification not found' })
        if (Number(row.user) !== userId) return res.status(403).json({ error: 'Forbidden' })

        db.run('DELETE FROM notifications WHERE notification = ?', [nid], function (uerr) {
            if (uerr) return res.status(500).json({ error: 'DB delete error' })
            return res.json({ success: true })
        })
    })
})

app.get('/notifications/unread', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = Number(req.session.user.id || req.session.user.formbar_id || req.session.user.user_id) || 0;
    if (userId) {
        db.get('SELECT COUNT(*) as count FROM notifications WHERE user = ? AND status = ?', [userId, 'unread'], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ unreadCount: row.count || 0, count: row.count || 0 });
        });
    } else {
        res.json({ unreadCount: 0, count: 0 });
    }
});

/*
 ::::::::   ::::::::  ::::    ::: ::::    ::: :::::::::: :::::::: :::::::::::
:+:    :+: :+:    :+: :+:+:   :+: :+:+:   :+: :+:       :+:    :+:    :+:
+:+        +:+    +:+ :+:+:+  +:+ :+:+:+  +:+ +:+       +:+           +:+
+#+        +#+    +:+ +#+ +:+ +#+ +#+ +:+ +#+ +#++:++#  +#+           +#+
+#+        +#+    +#+ +#+  +#+#+# +#+  +#+#+# +#+       +#+           +#+
#+#    #+# #+#    #+# #+#   #+#+# #+#   #+#+# #+#       #+#    #+#    #+#
 ########   ########  ###    #### ###    #### ########## ########     ###
*/

io.on('connection', (socket) => {
    // Set up the user and register with database if needed
    let user = initUser(socket)

    socket.on('pageContext', (ctx) => {
        const currentPath = (ctx && typeof ctx.path === 'string') ? ctx.path : ''
        socket.currentPath = currentPath
        if (user) user.currentPath = currentPath
    })

    logUsers()

    socket.emit('gamesList', getVisibleGames(user))

    pregameEvents(socket, user)
    inGameEvents(socket, user)
    chatEvents(socket, user)
    friendEvents(socket, user)

    //! Disconnection
    socket.on('disconnect', () => {
        user.active = false
        // record when the user went inactive so clients can show duration
        try { user.lastActiveAt = Date.now() } catch (e) { }
        // clear the socket reference so serialize() can accurately reflect connection state
        try { user.socket = null } catch (e) { }
        if (user.game) user.game.leave(user)

        if (user.id <= 0) {
            if (takenUserIds.includes(user.id)) {
                takenUserIds.splice(takenUserIds.indexOf(user.id), 1)
            }
        }

        logUsers()
    })
})


module.exports = { games }
