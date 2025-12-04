const socket = io()

socket.on('redirect', (url) => {
    console.log(`Redirecting to ${url}`)
    window.location.href = url
})

socket.on('youAre', (foo) => {
    me = foo
    // console.log(me)
})

//! Preload the sounds
const move = new Audio('sfx/move.mp3')
const check = new Audio('sfx/check.mp3')
const explosion = new Audio('sfx/explosion.mp3')
const smash = new Audio('sfx/smash.mp3')
const tada = new Audio('sfx/tada.mp3')

let soundMap = {
    move: move,
    check: check,
    explosion: explosion,
    smash: smash,
    tada: tada
}

socket.on('sound', (sound) => {
    console.log(`Playing sound ${sound}`)
    if (soundMap[sound]) {
        soundMap[sound].play()
    } else {
        console.log('Sound failed')
    }
})