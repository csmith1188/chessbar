// Default settings
const DEFAULT_SETTINGS = {
    boardSquareSize: 100,
    darkSquareColor: 'rgba(88, 51, 16, 1)',
    lightSquareColor: 'rgba(187, 123, 62, 1)',
    defaultPieceMargin: 0,
    pieceStyle: 'basic',
    hoverSizeIncrease: 5,
    moveColor: 'rgba(255, 230, 0, 0.39)',
    checkColor: 'rgba(255, 0, 0, 0.39)',
    arrowColor: 'rgba(0, 0, 0, 0.6)'
    ,
    // Width in pixels for the base of the arrowhead triangle
    arrowHeadBaseWidth: 30
}

const DEFAULT_DEBUG = {
    logMouseEvents: false,
    showHoverSquare: true,
    showClickSquare: false,
    logMoveEvents: false
}

let settingOpen = false

// Current in-memory settings (will be populated from localStorage if present)
let Settings = Object.assign({}, DEFAULT_SETTINGS)
let Debug = Object.assign({}, DEFAULT_DEBUG)

// Helper: parse stored values and merge with defaults
function loadSettingsFromStorage() {
    try {
        const s = JSON.parse(localStorage.getItem('chessbar_settings') || '{}')
        const d = JSON.parse(localStorage.getItem('chessbar_debug') || '{}')

        Settings = Object.assign({}, DEFAULT_SETTINGS, s)
        Debug = Object.assign({}, DEFAULT_DEBUG, d)
    } catch (e) {
        console.warn('Failed to load settings, using defaults', e)
        Settings = Object.assign({}, DEFAULT_SETTINGS)
        Debug = Object.assign({}, DEFAULT_DEBUG)
    }
}

function saveSettingsToStorage() {
    localStorage.setItem('chessbar_settings', JSON.stringify(Settings))
    localStorage.setItem('chessbar_debug', JSON.stringify(Debug))
}

// Color helpers: convert between rgba string and hex for color input
function rgbaToHex(rgba) {
    // rgba like 'rgba(187, 123, 62, 1)'
    const m = rgba.match(/rgba?\s*\(\s*(\d+),\s*(\d+),\s*(\d+)/i)
    if (!m) return '#000000'
    return '#' + [1, 2, 3].map(i => parseInt(m[i]).toString(16).padStart(2, '0')).join('')
}

function hexToRgba(hex, a = 1) {
    if (!hex) return `rgba(0,0,0,${a})`
    const h = hex.replace('#', '')
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${a})`
}

// UI wiring: populate inputs, handle save/reset
function openSettingsUI() {
    settingOpen = true
    const modal = document.getElementById('settings-modal')
    if (modal) {
        modal.classList.remove('hidden')
        try { modal.style.display = 'grid' } catch (e) { }
        modal.setAttribute('aria-hidden', 'false')
        const closeBtn = document.getElementById('close-settings')
        if (closeBtn) closeBtn.focus()
    }
}

function closeSettingsUI() {
    const modal = document.getElementById('settings-modal')
    if (modal) {
        modal.classList.add('hidden')
        try { modal.style.display = 'none' } catch (e) { }
        modal.setAttribute('aria-hidden', 'true')
        const btn = document.getElementById('settings-btn')
        if (btn) btn.focus()
    }
    settingOpen = false
}

function populateUI() {
    const el = (id) => document.getElementById(id)
    if (!el('boardSquareSize')) return

    el('boardSquareSize').value = Settings.boardSquareSize
    el('boardSquareSize').placeholder = Settings.boardSquareSize

    const lightHex = rgbaToHex(Settings.lightSquareColor)
    el('lightSquareColor').value = lightHex
    el('lightSquareColor').placeholder = lightHex

    const darkHex = rgbaToHex(Settings.darkSquareColor)
    el('darkSquareColor').value = darkHex
    el('darkSquareColor').placeholder = darkHex

    const moveHex = rgbaToHex(Settings.moveColor)
    el('moveColor').value = moveHex
    el('moveColor').placeholder = moveHex

    // also show alpha slider if you add one
    const moveAlpha = parseFloat(Settings.moveColor.match(/rgba\([^,]+,[^,]+,[^,]+,([^)]+)\)/)?.[1] || 1)
    const moveAlphaInput = el('moveAlpha')
    if (moveAlphaInput) moveAlphaInput.value = moveAlpha

    //copy for arrow color
    const arrowHex = rgbaToHex(Settings.arrowColor)
    el('arrowColor').value = arrowHex
    el('arrowColor').placeholder = arrowHex

    const arrowAlpha = parseFloat(Settings.arrowColor.match(/rgba\([^,]+,[^,]+,[^,]+,([^)]+)\)/)?.[1] || 1)
    const arrowAlphaInput = el('arrowAlpha')
    if (arrowAlphaInput) arrowAlphaInput.value = arrowAlpha

    // optional arrow head base width input
    const arrowBaseEl = el('arrowHeadBaseWidth')
    if (arrowBaseEl) {
        arrowBaseEl.value = Settings.arrowHeadBaseWidth
        arrowBaseEl.placeholder = Settings.arrowHeadBaseWidth
    }


    el('defaultPieceMargin').value = Settings.defaultPieceMargin
    el('defaultPieceMargin').placeholder = Settings.defaultPieceMargin

    el('pieceStyle').value = Settings.pieceStyle
    el('pieceStyle').setAttribute('data-placeholder', Settings.pieceStyle)

    el('hoverSizeIncrease').value = Settings.hoverSizeIncrease
    el('hoverSizeIncrease').placeholder = Settings.hoverSizeIncrease

    el('logMouseEvents').checked = !!Debug.logMouseEvents
    el('showHoverSquare').checked = !!Debug.showHoverSquare
    el('showClickSquare').checked = !!Debug.showClickSquare
    el('logMoveEvents').checked = !!Debug.logMoveEvents
}

function readUIToSettings() {
    const el = (id) => document.getElementById(id)

    // required inputs (boardSquareSize should always exist)
    const boardEl = el('boardSquareSize')
    if (boardEl) Settings.boardSquareSize = parseInt(boardEl.value || Settings.boardSquareSize, 10)

    // colors (guard each element in case some optional inputs were removed from the UI)
    const lightEl = el('lightSquareColor')
    if (lightEl && lightEl.value) Settings.lightSquareColor = hexToRgba(lightEl.value, 1)

    const darkEl = el('darkSquareColor')
    if (darkEl && darkEl.value) Settings.darkSquareColor = hexToRgba(darkEl.value, 1)

    // read RGBA (with adjustable alpha)
    const moveEl = el('moveColor')
    const moveAlphaEl = el('moveAlpha')
    const moveAlpha = moveAlphaEl ? parseFloat(moveAlphaEl.value || 0.31) : 0.31
    if (moveEl && moveEl.value) Settings.moveColor = hexToRgba(moveEl.value, isNaN(moveAlpha) ? 0.31 : moveAlpha)

    const checkEl = el('checkColor')
    const checkAlphaEl = el('checkAlpha')
    const checkAlpha = checkAlphaEl ? parseFloat(checkAlphaEl.value || 0.31) : 0.31
    if (checkEl && checkEl.value) Settings.checkColor = hexToRgba(checkEl.value, isNaN(checkAlpha) ? 0.31 : checkAlpha)

    const arrowEl = el('arrowColor')
    const arrowAlphaEl = el('arrowAlpha')
    const arrowAlpha = arrowAlphaEl ? parseFloat(arrowAlphaEl.value || 0.6) : 0.6
    if (arrowEl && arrowEl.value) Settings.arrowColor = hexToRgba(arrowEl.value, isNaN(arrowAlpha) ? 0.6 : arrowAlpha)

    const arrowBaseEl = el('arrowHeadBaseWidth')
    if (arrowBaseEl) Settings.arrowHeadBaseWidth = parseInt(arrowBaseEl.value || Settings.arrowHeadBaseWidth, 10)

    const marginEl = el('defaultPieceMargin')
    if (marginEl) Settings.defaultPieceMargin = parseInt(marginEl.value || 0, 10)

    const styleEl = el('pieceStyle')
    if (styleEl) Settings.pieceStyle = styleEl.value

    const hoverEl = el('hoverSizeIncrease')
    if (hoverEl) Settings.hoverSizeIncrease = parseInt(hoverEl.value || 0, 10)

    // debug flags
    const logMouseEl = el('logMouseEvents')
    if (logMouseEl) Debug.logMouseEvents = !!logMouseEl.checked
    const hoverSquareEl = el('showHoverSquare')
    if (hoverSquareEl) Debug.showHoverSquare = !!hoverSquareEl.checked
    const clickSquareEl = el('showClickSquare')
    if (clickSquareEl) Debug.showClickSquare = !!clickSquareEl.checked
    const logMoveEl = el('logMoveEvents')
    if (logMoveEl) Debug.logMoveEvents = !!logMoveEl.checked
}

function resetToDefaults() {
    localStorage.removeItem('chessbar_settings')
    localStorage.removeItem('chessbar_debug')
    loadSettingsFromStorage()
    populateUI()
}

function initSettingsUI() {
    loadSettingsFromStorage()

    const btn = document.getElementById('settings-btn')
    if (btn) btn.addEventListener('click', () => { populateUI(); openSettingsUI() })

    const close = document.getElementById('close-settings')
    if (close) {
        // single click handler is enough; avoid duplicate listeners
        close.addEventListener('click', () => closeSettingsUI())
    }

    const save = document.getElementById('save-settings')
    if (save) save.addEventListener('click', () => {
        readUIToSettings()
        saveSettingsToStorage()
        location.reload()
    })

    const reset = document.getElementById('reset-settings')
    if (reset) reset.addEventListener('click', () => {
        resetToDefaults()
    })

    const modal = document.getElementById('settings-modal')
    if (modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSettingsUI()
    })

    document.addEventListener('click', (e) => {
        const t = e.target
        if (!t) return
        if (t.id === 'close-settings') closeSettingsUI()
    })

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modalEl = document.getElementById('settings-modal')
            if (modalEl && !modalEl.classList.contains('hidden')) {
                closeSettingsUI()
            }
        }
    })

    populateUI()
}

// Ensure stored settings are loaded immediately so other scripts (main.js, clientBoard.js)
// which run after this file see the persisted values.
loadSettingsFromStorage()

// initialize UI wiring when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initSettingsUI(); closeSettingsUI(); })
} else {
    initSettingsUI()
    closeSettingsUI()
}

// Expose Settings and Debug globals for other scripts (keeps existing usage)
window.Settings = Settings
window.Debug = Debug
