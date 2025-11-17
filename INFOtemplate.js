const EMPLOYEE_ID_1 = 1 // First employee ID
const EMPLOYEE_ID_2 = 2 // Second employee ID

const EMPLOYEE_PIN_1 = 1 // First employee pin
const EMPLOYEE_PIN_2 = 2 // Second employee pin

const POOL_ID = 0 // Pool ID

//! For both FORMBAR_URL and THIS_URL:
// Using `localhost:port` is generally a bad idea. Use your IP address instead, unless you are the only one testing.
//! BE SURE TO INCLUDE http://
const FORMBAR_URL = 'https://formbar.url.com'
const THIS_URL = '192.0.0.1:3000' // Don't forget your port

const FORMBAR_API_KEY = 'abcdef12356789' // Your API key (on your Formbar profile page)
const FB_MIDDLEWARE_SECRET = 'secret_key!?!?!??' // Secret key for Formbar Oauth middleware

module.exports = { EMPLOYEE_ID_1, EMPLOYEE_ID_2, EMPLOYEE_PIN_1, EMPLOYEE_PIN_2, POOL_ID, FORMBAR_URL, THIS_URL, FORMBAR_API_KEY, FB_MIDDLEWARE_SECRET }