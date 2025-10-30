document.addEventListener('contextmenu', (e) => {
    e.preventDefault()

    if (Debug.logMouseEvents) console.log(e, Mouse)
})

document.addEventListener('mousemove', (e) => {
    Mouse.x = e.clientX - canvas.getBoundingClientRect().left
    Mouse.y = e.clientY - canvas.getBoundingClientRect().top

    if (Debug.logMouseEvents) console.log(e, Mouse)
})
document.addEventListener('keydown', (e) => {
    keys[e.key] = true
})
document.addEventListener('keyup', (e) => {
    keys[e.key] = false
})
document.addEventListener('mousedown', (e) => {
    if (e.button == 0) {
        Mouse.left = true
    } else if (e.button == 2) {
        Mouse.right = true
    }

    if (Debug.logMouseEvents) console.log(e, Mouse)
})
document.addEventListener('mouseup', (e) => {
    if (e.button == 0) {
        Mouse.left = false
    } else if (e.button == 2) {
        Mouse.right = false
    }

    if (Debug.logMouseEvents) console.log(e, Mouse)
})