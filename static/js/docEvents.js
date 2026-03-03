document.addEventListener('contextmenu', (e) => {
    e.preventDefault()

    if (Debug.logMouseEvents) console.log(e, Mouse)
})

// Helper: return true when the waiting-for-opponent overlay is visible
function isWaitingOverlayVisible() {
    try {
        const o = document.getElementById('waitingOverlay')
        return o && o.classList && o.classList.contains('show')
    } catch (err) {
        return false
    }
}

// Helper: update Mouse coordinates from touch/mouse event (account for canvas scaling)
function updateMousePosition(clientX, clientY) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    Mouse.x = (clientX - rect.left) * scaleX
    Mouse.y = (clientY - rect.top) * scaleY
}

document.addEventListener('mousemove', (e) => {
    // If waiting overlay is shown, ignore pointer movement to prevent interactions
    if (isWaitingOverlayVisible()) return

    updateMousePosition(e.clientX, e.clientY)

    if (Debug.logMouseEvents) console.log(e, Mouse)
})
document.addEventListener('keydown', (e) => {
    keys[e.key] = true
    try {
        // Don't navigate when typing in inputs or when overlay blocks interaction
        const active = document.activeElement && document.activeElement.tagName
        if (isWaitingOverlayVisible() || active === 'INPUT' || active === 'TEXTAREA' || active === 'SELECT' || document.activeElement && document.activeElement.isContentEditable) return

        if (e.key === 'ArrowLeft') {
            e.preventDefault()
            if (typeof navigateMoves === 'function') navigateMoves(-1)
        } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            if (typeof navigateMoves === 'function') navigateMoves(1)
        }
    } catch (err) { }
})
document.addEventListener('keyup', (e) => {
    keys[e.key] = false
})
document.addEventListener('mousedown', (e) => {
    // If waiting overlay is shown, ignore pointer presses so pieces cannot be selected
    if (isWaitingOverlayVisible()) return

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
    // If waiting overlay is shown, ignore pointer releases
    if (isWaitingOverlayVisible()) return

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
                    try {
                        // Determine the coordinates as they will be stored in the Arrow instance
                        let ax1, ay1, ax2, ay2
                        if (me && me.side == 'white') {
                            ax1 = csx; ay1 = csy; ax2 = cex; ay2 = cey
                        } else {
                            ax1 = csx; ay1 = 7 - csy; ax2 = cex; ay2 = 7 - cey
                        }

                        // Ensure arrows array exists
                        if (typeof arrows === 'undefined') arrows = []

                        // Look for an identical arrow and remove it if found (toggle behavior)
                        const existingIndex = arrows.findIndex(a => a.x1 === ax1 && a.y1 === ay1 && a.x2 === ax2 && a.y2 === ay2)
                        if (existingIndex !== -1) {
                            arrows.splice(existingIndex, 1)
                        } else {
                            arrows.push(new Arrow(ax1, ay1, ax2, ay2))
                        }
                    } catch (err) { }
                }
            }
        } catch (err) { }
        Mouse.dragStartX = Mouse.dragStartY = null
    }

    if (Debug.logMouseEvents) console.log(e, Mouse)
})

// ============================================
// TOUCH EVENT HANDLERS FOR MOBILE SUPPORT
// ============================================

// Track active touch for long press detection
let touchStartTime = 0
let touchStartPos = { x: 0, y: 0 }
let longPressTimer = null
let isLongPress = false
const LONG_PRESS_DURATION = 500 // milliseconds

canvas.addEventListener('touchstart', (e) => {
    // If waiting overlay is shown, ignore touch
    if (isWaitingOverlayVisible()) return

    // Prevent default to avoid double-firing mouse events
    e.preventDefault()

    const touch = e.touches && e.touches[0]
    if (!touch) return
    updateMousePosition(touch.clientX, touch.clientY)

    // Left-click equivalent (primary touch)
    Mouse.left = true
    Mouse.dragStartX = Mouse.x
    Mouse.dragStartY = Mouse.y

    // Setup long press detection for right-click equivalent
    touchStartTime = Date.now()
    touchStartPos = { x: Mouse.x, y: Mouse.y }
    isLongPress = false

    longPressTimer = setTimeout(() => {
        // After long press duration, simulate right-click
        isLongPress = true
        Mouse.right = true
        Mouse.left = false
        Mouse.dragStartX = touchStartPos.x
        Mouse.dragStartY = touchStartPos.y

        // Provide haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(50)
        }
    }, LONG_PRESS_DURATION)

    if (Debug.logMouseEvents) console.log('touchstart', e, Mouse)
}, { passive: false })

canvas.addEventListener('touchmove', (e) => {
    // If waiting overlay is shown, ignore touch movement
    if (isWaitingOverlayVisible()) return

    e.preventDefault()

    const touch = e.touches && e.touches[0]
    if (!touch) return
    updateMousePosition(touch.clientX, touch.clientY)

    // Cancel long press if user moves finger significantly
    if (longPressTimer && !isLongPress) {
        const dx = Math.abs(Mouse.x - touchStartPos.x)
        const dy = Math.abs(Mouse.y - touchStartPos.y)
        // If moved more than 10 pixels, cancel long press
        if (dx > 10 || dy > 10) {
            clearTimeout(longPressTimer)
            longPressTimer = null
        }
    }

    if (Debug.logMouseEvents) console.log('touchmove', e, Mouse)
}, { passive: false })

canvas.addEventListener('touchend', (e) => {
    // If waiting overlay is shown, ignore touch release
    if (isWaitingOverlayVisible()) return

    e.preventDefault()

    // Update final position from the last touch point (touches is empty on touchend)
    const endTouch = e.changedTouches && e.changedTouches[0]
    if (endTouch) updateMousePosition(endTouch.clientX, endTouch.clientY)

    // Clear long press timer
    if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
    }

    if (isLongPress) {
        // Handle right-click release
        Mouse.right = false

        // Same logic as mouseup with right button
        try {
            if (typeof arrows !== 'undefined' && Mouse.dragStartX !== null) {
                const sx = Math.floor(Mouse.dragStartX / Settings.boardSquareSize)
                const sy = Math.floor(Mouse.dragStartY / Settings.boardSquareSize)
                const ex = Math.floor(Mouse.x / Settings.boardSquareSize)
                const ey = Math.floor(Mouse.y / Settings.boardSquareSize)
                const clamp = (v) => Math.max(0, Math.min(7, v))
                const csx = clamp(sx), csy = clamp(sy), cex = clamp(ex), cey = clamp(ey)

                if (csx === cex && csy === cey) {
                    try {
                        if (typeof highlightedSquares === 'undefined') highlightedSquares = new Set()
                        const key = `${csx},${csy}`
                        if (highlightedSquares.has(key)) highlightedSquares.delete(key)
                        else highlightedSquares.add(key)
                    } catch (err) { }
                } else {
                    try {
                        let ax1, ay1, ax2, ay2
                        if (me && me.side == 'white') {
                            ax1 = csx; ay1 = csy; ax2 = cex; ay2 = cey
                        } else {
                            ax1 = csx; ay1 = 7 - csy; ax2 = cex; ay2 = 7 - cey
                        }

                        if (typeof arrows === 'undefined') arrows = []

                        const existingIndex = arrows.findIndex(a => a.x1 === ax1 && a.y1 === ay1 && a.x2 === ax2 && a.y2 === ay2)
                        if (existingIndex !== -1) {
                            arrows.splice(existingIndex, 1)
                        } else {
                            arrows.push(new Arrow(ax1, ay1, ax2, ay2))
                        }
                    } catch (err) { }
                }
            }
        } catch (err) { }
        Mouse.dragStartX = Mouse.dragStartY = null
        isLongPress = false
    } else {
        // Handle left-click release
        Mouse.left = false

        // Clear arrows on touch release (left-click equivalent)
        try { if (typeof arrows !== 'undefined') arrows = [] } catch (err) { }
        // Clear right-click highlights on left-click
        try { if (typeof highlightedSquares !== 'undefined') highlightedSquares.clear() } catch (err) { }
    }

    if (Debug.logMouseEvents) console.log('touchend', e, Mouse)
}, { passive: false })

canvas.addEventListener('touchcancel', (e) => {
    // Clean up on touch cancel
    if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
    }

    Mouse.left = false
    Mouse.right = false
    isLongPress = false
    Mouse.dragStartX = Mouse.dragStartY = null

    if (Debug.logMouseEvents) console.log('touchcancel', e, Mouse)
}, { passive: false })
