require('dotenv').config({ quiet: true })

const PORT = process.env.PORT || 3000

const POOL_ID = process.env.POOL_ID || 1

const FORMBAR_URL = process.env.FORMBAR_URL || 'https://formbar.yorktechapps.com'
const THIS_URL = process.env.THIS_URL || 'http://localhost:3000'

const FORMBAR_API_KEY = process.env.FORMBAR_API_KEY || 'abcdef12356789'
const FB_MIDDLEWARE_SECRET = process.env.FB_MIDDLEWARE_SECRET || 'secret_key!?!?!??'

module.exports = { PORT, POOL_ID, FORMBAR_URL, THIS_URL, FORMBAR_API_KEY, FB_MIDDLEWARE_SECRET }