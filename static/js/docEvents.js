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
        Mouse.dragStartX = Mouse.x
        Mouse.dragStartY = Mouse.y
    } else if (e.button == 2) {
        Mouse.right = true
        // start a right-click drag for arrow drawing
        Mouse.dragStartX = Mouse.x
        Mouse.dragStartY = Mouse.y
    }

    if (Debug.logMouseEvents) console.log(e, Mouse)
})
document.addEventListener('mouseup', (e) => {
    if (e.button == 0) {
        Mouse.left = false
        // clear all arrows on left-click release
        try { if (typeof arrows !== 'undefined') arrows = [] } catch (err) { }
        // also clear any right-click highlights when the user left-clicks
        try { if (typeof highlightedSquares !== 'undefined') highlightedSquares.clear() } catch (err) { }
    } else if (e.button == 2) {
        Mouse.right = false
        // finalize right-click drag -> create arrow instance or toggle square highlight when it's a click
        try {
            if (typeof arrows !== 'undefined' && Mouse.dragStartX !== null) {
                const sx = Math.floor(Mouse.dragStartX / Settings.boardSquareSize)
                const sy = Math.floor(Mouse.dragStartY / Settings.boardSquareSize)
                const ex = Math.floor(Mouse.x / Settings.boardSquareSize)
                const ey = Math.floor(Mouse.y / Settings.boardSquareSize)
                // clamp coords to 0..7
                const clamp = (v) => Math.max(0, Math.min(7, v))
                const csx = clamp(sx), csy = clamp(sy), cex = clamp(ex), cey = clamp(ey)

                // If user right-clicked without dragging (same square), toggle highlight instead
                if (csx === cex && csy === cey) {
                    try {
                        if (typeof highlightedSquares === 'undefined') highlightedSquares = new Set()
                        const key = `${csx},${csy}`
                        if (highlightedSquares.has(key)) highlightedSquares.delete(key)
                        else highlightedSquares.add(key)
                    } catch (err) { }
                } else {
                    if (me.side == 'white') {
                        arrows.push(new Arrow(csx, csy, cex, cey))
                    } else {
                        arrows.push(new Arrow(csx, 7 - csy, cex, 7 - cey))
                    }
                }
            }
        } catch (err) { }
        Mouse.dragStartX = Mouse.dragStartY = null
    }

    if (Debug.logMouseEvents) console.log(e, Mouse)
})