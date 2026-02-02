(() => {
    const sidebar = document.querySelector('[data-sidebar]')
    if (!sidebar) return

    const toggle = sidebar.querySelector('[data-sidebar-toggle]')
    const chevron = toggle ? toggle.querySelector('.chevron') : null
    const body = document.body
    const storageKey = 'sidebar-state'

    const saved = (() => {
        try { return localStorage.getItem(storageKey) } catch (e) { return null }
    })()
    const prefersCollapsed = window.matchMedia('(max-width: 900px)').matches
    let collapsed = saved ? saved === 'collapsed' : prefersCollapsed

    function applyState() {
        body.classList.add('with-sidebar')
        body.classList.toggle('sidebar-collapsed', collapsed)
        if (toggle) toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
        if (chevron) chevron.textContent = collapsed ? '>' : '<'
    }

    applyState()

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
