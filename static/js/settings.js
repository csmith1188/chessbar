// Default settings
const DEFAULT_SETTINGS = {
    boardSquareSize: 100,
    darkSquareColor: 'rgba(88, 51, 16, 1)',
    lightSquareColor: 'rgba(187, 123, 62, 1)',
    defaultPieceMargin: 0,
    pieceStyle: 'basic',
    hoverSizeIncrease: 5
}

const DEFAULT_DEBUG = {
    logMouseEvents: false,
    showHoverSquare: false,
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
        // also set inline style and aria for robustness
        try { modal.style.display = 'grid' } catch (e) { }
        modal.setAttribute('aria-hidden', 'false')
        // focus first focusable element for accessibility
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
        // return focus to settings button
        const btn = document.getElementById('settings-btn')
        if (btn) btn.focus()
    }
    settingOpen = false
}

function populateUI() {
    const el = (id) => document.getElementById(id)
    if (!el('boardSquareSize')) return

    // Set both value and placeholder so saved values are visible after reload
    el('boardSquareSize').value = Settings.boardSquareSize
    el('boardSquareSize').placeholder = Settings.boardSquareSize

    const lightHex = rgbaToHex(Settings.lightSquareColor)
    el('lightSquareColor').value = lightHex
    el('lightSquareColor').placeholder = lightHex

    const darkHex = rgbaToHex(Settings.darkSquareColor)
    el('darkSquareColor').value = darkHex
    el('darkSquareColor').placeholder = darkHex

    el('defaultPieceMargin').value = Settings.defaultPieceMargin
    el('defaultPieceMargin').placeholder = Settings.defaultPieceMargin

    el('pieceStyle').value = Settings.pieceStyle
    // set a data-placeholder on select (selects don't have placeholders)
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
    Settings.boardSquareSize = parseInt(el('boardSquareSize').value || Settings.boardSquareSize, 10)
    Settings.lightSquareColor = hexToRgba(el('lightSquareColor').value, 1)
    Settings.darkSquareColor = hexToRgba(el('darkSquareColor').value, 1)
    Settings.defaultPieceMargin = parseInt(el('defaultPieceMargin').value || 0, 10)
    Settings.pieceStyle = el('pieceStyle').value
    Settings.hoverSizeIncrease = parseInt(el('hoverSizeIncrease').value || 0, 10)

    Debug.logMouseEvents = el('logMouseEvents').checked
    Debug.showHoverSquare = el('showHoverSquare').checked
    Debug.showClickSquare = el('showClickSquare').checked
    Debug.logMoveEvents = el('logMoveEvents').checked
}

function resetToDefaults() {
    localStorage.removeItem('chessbar_settings')
    localStorage.removeItem('chessbar_debug')
    loadSettingsFromStorage()
    populateUI()
}

function initSettingsUI() {
    loadSettingsFromStorage()

    // wire buttons
    const btn = document.getElementById('settings-btn')
    if (btn) btn.addEventListener('click', () => { populateUI(); openSettingsUI() })

    const close = document.getElementById('close-settings')
    if (close) {
        // attach both bubble and capture listeners to be extra robust
        close.addEventListener('click', () => closeSettingsUI())
        close.addEventListener('click', () => closeSettingsUI(), { capture: true })
    }

    const save = document.getElementById('save-settings')
    if (save) save.addEventListener('click', () => {
        readUIToSettings()
        saveSettingsToStorage()
        // Reload to apply changes (canvas size, piece images etc.)
        location.reload()
    })

    const reset = document.getElementById('reset-settings')
    if (reset) reset.addEventListener('click', () => {
        resetToDefaults()
    })

    // close when clicking backdrop
    const modal = document.getElementById('settings-modal')
    if (modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSettingsUI()
    })

    // Delegated click handler (robust if elements are re-rendered)
    document.addEventListener('click', (e) => {
        const t = e.target
        if (!t) return
        if (t.id === 'close-settings') closeSettingsUI()
    })

    // Close on Escape key for accessibility
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modalEl = document.getElementById('settings-modal')
            if (modalEl && !modalEl.classList.contains('hidden')) {
                closeSettingsUI()
            }
        }
    })

    // Populate UI immediately so saved values appear as placeholders/values after reload
    populateUI()
}

// Ensure stored settings are loaded immediately so other scripts (main.js, clientBoard.js)
// which run after this file see the persisted values.
loadSettingsFromStorage()

// initialize UI wiring when DOM ready
// (initSettingsUI will call loadSettingsFromStorage again — that's fine)
// initialize when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initSettingsUI(); closeSettingsUI(); })
} else {
    initSettingsUI()
    // ensure modal is closed on immediate init
    closeSettingsUI()
}

// Expose Settings and Debug globals for other scripts (keeps existing usage)
window.Settings = Settings
window.Debug = Debug