(() => {
    const sidebar = document.querySelector('[data-sidebar]')
    if (!sidebar) return

    const toggle = sidebar.querySelector('[data-sidebar-toggle]')
    const body = document.body
    const storageKey = 'sidebar-state'

    const saved = (() => {
        try { return localStorage.getItem(storageKey) } catch (e) { return null }
    })()
    const prefersCollapsed = window.matchMedia('(max-width: 900px)').matches
    let collapsed = saved ? saved === 'collapsed' : prefersCollapsed
    let shouldAutoClose = collapsed === false  // Track if sidebar should auto-close on load

    function applyState(skipAnimation = false) {
        body.classList.add('with-sidebar')
        if (skipAnimation) {
            body.classList.add('no-transition')
        }
        body.classList.toggle('sidebar-collapsed', collapsed)
        if (skipAnimation) {
            // Trigger reflow to apply no-transition class, then remove it
            void body.offsetWidth
            body.classList.remove('no-transition')
        }
        if (toggle) {
            toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
            toggle.classList.toggle('is-active', !collapsed)
                // Switch icon between hamburger, <, and X
                const chevron = toggle.querySelector('.chevron')
                const closeX = toggle.querySelector('.close-x')
                const hamburger = toggle.querySelector('.hamburger')
                if (chevron && closeX && hamburger) {
                    if (!collapsed) {
                        chevron.style.display = 'none'
                        closeX.style.display = ''
                        hamburger.style.display = 'none'
                    } else {
                        chevron.style.display = 'none'
                        closeX.style.display = 'none'
                        hamburger.style.display = ''
                    }
                }
        }
    }

    // Initial state
    applyState(true)
    
    // Auto-close after initial render to trigger animation
    if (shouldAutoClose) {
        requestAnimationFrame(() => {
            collapsed = true
            applyState(false)
        })
    }

    if (toggle) {
        toggle.addEventListener('click', () => {
            collapsed = !collapsed
            applyState()
            try { localStorage.setItem(storageKey, collapsed ? 'collapsed' : 'open') } catch (e) { /* ignore */ }
        })
    }

    // Auto-collapse when resizing to narrow viewports if the user has not chosen a state yet
    const mq = window.matchMedia('(max-width: 900px)')
    mq.addEventListener('change', (ev) => {
        if (saved) return
        collapsed = ev.matches
        applyState()
    })
})()
