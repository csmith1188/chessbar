const socket = io()

function sendPageContext() {
    try {
        socket.emit('pageContext', {
            path: window.location && window.location.pathname ? window.location.pathname : ''
        })
    } catch (e) { }
}

socket.on('connect', () => {
    sendPageContext()
})

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
    bullet_music: bullet_music
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

// Notification
const notifBox = document.getElementById('notif_popup')
const notifType = document.getElementById('notif_type')
const notifMsg = document.getElementById('notif_message')

socket.on('notification', (type, message) => {
    if (!notifBox || !notifType || !notifMsg) return
    if (!notifBox.classList.contains('hide-popup')) return
    notifType.innerHTML = type
    notifMsg.innerHTML = message

    notifBox.classList.toggle('hide-popup')

    setTimeout(() => { notifBox.classList.add('hide-popup') }, 5000)
})

// Function to update the notification badge count in the sidebar
function updateNotifBadge(delta) {
    const profileLink = document.querySelector('.sidebar-link[href="/profile"]')
    if (!profileLink) return
    
    let badge = profileLink.querySelector('.notif-badge')
    let currentCount = badge ? parseInt(badge.textContent) || 0 : 0
    let newCount = Math.max(0, currentCount + delta)
    
    if (newCount > 0) {
        if (!badge) {
            badge = document.createElement('span')
            badge.className = 'notif-badge'
            profileLink.appendChild(badge)
        }
        badge.textContent = newCount
    } else if (badge) {
        badge.remove()
    }
}

// Function to fetch unread notifications
async function fetchUnreadNotifications() {
    try {
        const response = await fetch('/notifications/unread'); 
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data.count; // The endpoint returns { count: ... }
    } catch (error) {
        console.error('Error fetching unread notifications:', error);
        return 0; // Return 0 if there's an error
    }
}

// Function to update the notification badge
function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge'); 
    if (badge) {
        badge.textContent = count > 0 ? count : '';
        badge.style.display = count > 0 ? 'block' : 'none';
    }
}

// Check unread notifications on page load
window.addEventListener('load', async function() {
    const unreadCount = await fetchUnreadNotifications();
    updateNotificationBadge(unreadCount);
});

