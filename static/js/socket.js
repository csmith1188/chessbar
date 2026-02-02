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
const break1 = new Audio('sfx/break1.mp3')
const break2 = new Audio('sfx/break2.mp3')
const break3 = new Audio('sfx/break3.mp3')
const break4 = new Audio('sfx/break4.mp3')
const break5 = new Audio('sfx/break5.mp3')
const break6 = new Audio('sfx/break6.mp3')
const alarm = new Audio('sfx/clock/alarm.mp3')
const warning = new Audio('sfx/clock/warning.mp3')
const bullet_music = new Audio('sfx/clock/bullet_music.mp3')

let soundMap = {
    move: move,
    check: check,
    explosion: explosion,
    smash: smash,
    tada: tada,
    break1: break1,
    break2: break2,
    break3: break3,
    break4: break4,
    break5: break5,
    break6: break6,
    alarm: alarm,
    warning: warning,
    bullet_music: bullet_music,
}

socket.on('sound', (sound) => {
    let number = Math.floor(Math.random() * 6) + 1
    console.log(`Playing sound ${sound}`)

    if (sound == 'break') {
        soundMap[`break${number}`].play()
    } else if (soundMap[sound]) {
        soundMap[sound].play()
    } else {
        console.log('Sound failed')
    }
})