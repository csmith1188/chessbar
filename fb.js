const jwt = require('jsonwebtoken')
const express = require('express')
const app = express()
const session = require('express-session')

const AUTH_URL = 'https://formbeta.yorktechapps.com'
const THIS_URL = 'http://localhost:3000/login'
const API_KEY = 'f5ce8558b3f929c31efe3e975c129be8a35cd36b56d249041ffb191fecab2bf6'

app.use(session({
	secret: 'ohnose!',
	resave: false,
	saveUninitialized: false
}))

function isAuthenticated(req, res, next) {
	console.log("Checking Auth")
	if (req.session.user) next()
	else res.redirect(`/login?redirectURL=${THIS_URL}`)
}

app.get('/', isAuthenticated, (req, res) => {
	console.log("Root")
	try {
		fetch(`${AUTH_URL}/api/me`, {
			method: 'GET',
			headers: {
				'API': API_KEY,
				'Content-Type': 'application/json'
			}
		})
			.then(response => {
				return response.json();
			})
			.then(data => {
				res.send(data);
			})
	}
	catch (error) {
		res.send(error.message)
	}
})

app.get('/login', (req, res) => {
	console.log(req.query.token)
	if (req.query.token) {
		let tokenData = jwt.decode(req.query.token)
		req.session.token = tokenData
		req.session.user = tokenData.displayName
		res.redirect('/')
	} else {
		res.redirect(`${AUTH_URL}/oauth?redirectURL=${THIS_URL}`)
	}
})

app.listen(3000)