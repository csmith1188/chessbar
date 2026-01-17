document.addEventListener('DOMContentLoaded', () => {
    // If we're viewing someone else's profile, don't enable the edit UI.
    if (typeof window !== 'undefined' && window.isOwnProfile === false) return

    const pfp = document.getElementById('pfp')
    const overlay = document.getElementById('pfp-overlay')
    const container = document.querySelector('.pfp-container')
    if (!pfp || !overlay || !container) return

    let hoverTimer = null
    const HOVER_MS = 1000

    function showOverlay() {
        overlay.style.opacity = '1'
        overlay.style.pointerEvents = 'auto'
        pfp.style.boxShadow = '0 0 0 4px rgba(233, 233, 233, 0.87)'
    }

    function hideOverlay() {
        overlay.style.opacity = '0'
        overlay.style.pointerEvents = 'none'
        pfp.style.boxShadow = ''
    }

    container.addEventListener('mouseenter', () => {
        hoverTimer = setTimeout(showOverlay, HOVER_MS)
    })
    container.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer)
        hideOverlay()
    })

    overlay.addEventListener('click', (e) => {
        e.preventDefault()
        showChangeModal()
    })

    // Modal UI with cropping
    function showChangeModal() {
        // create modal container (replace if existing)
        let modal = document.getElementById('pfp-modal')
        if (modal) modal.remove()
        modal = document.createElement('div')
        modal.id = 'pfp-modal'
        modal.style.position = 'fixed'
        modal.style.left = '0'
        modal.style.top = '0'
        modal.style.right = '0'
        modal.style.bottom = '0'
        modal.style.display = 'flex'
        modal.style.alignItems = 'center'
        modal.style.justifyContent = 'center'
        modal.style.background = 'rgba(0,0,0,0.6)'
        modal.style.zIndex = '9999'

        const box = document.createElement('div')
        box.style.width = '520px'
        box.style.maxWidth = '96%'
        box.style.background = '#081219'
        box.style.padding = '18px'
        box.style.borderRadius = '12px'
        box.style.border = '1px solid rgba(255,255,255,0.04)'
        box.style.color = '#eaf4fb'
        box.style.display = 'flex'
        box.style.flexDirection = 'column'
        box.style.gap = '12px'

        box.innerHTML = `
            <h3 style="margin:0;">Change profile picture</h3>
            <div style="display:flex;gap:12px;flex-direction:column">
              <label style="font-size:13px;color:#9aa">Upload a file (PNG/JPEG/GIF/WEBP)</label>
              <input id="pfp-file" type="file" accept="image/*" />
              <div style="height:6px"></div>
              <label style="font-size:13px;color:#9aa">Or provide an image URL</label>
              <input id="pfp-url" type="url" placeholder="https://example.com/image.png" style="width:100%; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); background:transparent; color:inherit" />
            </div>
            <div id="pfp-crop-area" style="display:none; gap:12px; align-items:start"></div>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:6px">
                <button id="pfp-cancel" class="btn secondary">Cancel</button>
                <button id="pfp-save" class="btn">Save</button>
            </div>
            <div id="pfp-msg" style="color:#f1c; margin-top:8px; font-size:13px"></div>
        `

        modal.appendChild(box)
        document.body.appendChild(modal)

        const fileInput = modal.querySelector('#pfp-file')
        const urlInput = modal.querySelector('#pfp-url')
        const cancel = modal.querySelector('#pfp-cancel')
        const saveBtn = modal.querySelector('#pfp-save')
        const msg = modal.querySelector('#pfp-msg')
        const cropArea = modal.querySelector('#pfp-crop-area')

        const CANVAS_SIZE = 200 // fixed avatar size in px
        const canvas = document.createElement('canvas')

        let img = new Image()
        let imgLoaded = false
        let imgNaturalW = 0, imgNaturalH = 0
        let tx = 0, ty = 0, scale = 1
        let isDragging = false, dragStart = null

        function showMessage(text) { msg.innerText = text }

        function createCropUI() {
            cropArea.innerHTML = ''
            cropArea.style.display = 'flex'
            cropArea.style.flexDirection = 'column'

            const previewWrap = document.createElement('div')
            previewWrap.style.width = CANVAS_SIZE + 'px'
            previewWrap.style.height = CANVAS_SIZE + 'px'
            previewWrap.style.overflow = 'hidden'
            previewWrap.style.position = 'relative'
            previewWrap.style.borderRadius = '50%'
            previewWrap.style.border = '2px solid rgba(255,255,255,0.06)'
            previewWrap.style.background = '#0b1418'

            const previewImg = document.createElement('img')
            previewImg.style.position = 'absolute'
            previewImg.style.left = '0'
            previewImg.style.top = '0'
            previewImg.style.transformOrigin = '0 0'
            previewImg.style.willChange = 'transform'
            previewImg.draggable = false
            previewImg.src = img.src
            previewWrap.appendChild(previewImg)

            const controls = document.createElement('div')
            controls.style.display = 'flex'
            controls.style.gap = '8px'
            controls.style.alignItems = 'center'
            controls.style.marginTop = '8px'

            const zoomLabel = document.createElement('div')
            zoomLabel.innerText = 'Zoom'
            zoomLabel.style.color = '#9aa'
            zoomLabel.style.fontSize = '13px'

            const zoom = document.createElement('input')
            zoom.type = 'range'
            zoom.min = '1'
            zoom.max = '3'
            zoom.step = '0.01'
            zoom.value = '1'
            zoom.style.flex = '1'

            controls.appendChild(zoomLabel)
            controls.appendChild(zoom)

            cropArea.appendChild(previewWrap)
            cropArea.appendChild(controls)

            // initialize transform
            function resetTransform() {
                // compute scale so image covers the square
                const iw = imgNaturalW
                const ih = imgNaturalH
                const s = Math.max(CANVAS_SIZE / iw, CANVAS_SIZE / ih)
                scale = s
                tx = (CANVAS_SIZE - iw * scale) / 2
                ty = (CANVAS_SIZE - ih * scale) / 2
                // apply transform with top-left origin so math is consistent
                previewImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
                zoom.min = String(s)
                zoom.value = String(s)
            }

            previewImg.addEventListener('load', resetTransform)
            // drag to move
            previewWrap.addEventListener('pointerdown', (ev) => {
                ev.preventDefault()
                isDragging = true
                dragStart = { x: ev.clientX, y: ev.clientY, tx, ty }
                previewWrap.setPointerCapture(ev.pointerId)
            })
            previewWrap.addEventListener('pointermove', (ev) => {
                if (!isDragging) return
                const dx = ev.clientX - dragStart.x
                const dy = ev.clientY - dragStart.y
                tx = dragStart.tx + dx
                ty = dragStart.ty + dy
                previewImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
            })
            previewWrap.addEventListener('pointerup', (ev) => {
                isDragging = false
            })
            previewWrap.addEventListener('pointercancel', () => { isDragging = false })

            zoom.addEventListener('input', () => {
                const newScale = parseFloat(zoom.value)
                // adjust tx/ty to keep image centered relative to previous center
                // compute center of view in image coordinates
                const cx = (-tx + CANVAS_SIZE / 2) / scale
                const cy = (-ty + CANVAS_SIZE / 2) / scale
                scale = newScale
                tx = CANVAS_SIZE / 2 - cx * scale
                ty = CANVAS_SIZE / 2 - cy * scale
                previewImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
            })

            // store previewImg for final crop
            previewWrap._imgEl = previewImg
        }

        function loadImageFromFile(file) {
            return new Promise((resolve, reject) => {
                if (!file.type || !file.type.startsWith('image/')) return reject(new Error('Unsupported file type'))
                const reader = new FileReader()
                reader.onload = () => {
                    img = new Image()
                    img.onload = () => {
                        imgNaturalW = img.naturalWidth
                        imgNaturalH = img.naturalHeight
                        imgLoaded = true
                        resolve()
                    }
                    img.onerror = reject
                    img.src = reader.result
                }
                reader.onerror = reject
                reader.readAsDataURL(file)
            })
        }

        function loadImageFromUrl(url) {
            return new Promise((resolve, reject) => {
                img = new Image()
                img.crossOrigin = 'Anonymous'
                img.onload = () => {
                    imgNaturalW = img.naturalWidth
                    imgNaturalH = img.naturalHeight
                    imgLoaded = true
                    resolve()
                }
                img.onerror = () => reject(new Error('Failed to load image from URL'))
                img.src = url
            })
        }

        fileInput.addEventListener('change', async (ev) => {
            const f = ev.target.files && ev.target.files[0]
            if (!f) return
            try {
                await loadImageFromFile(f)
                createCropUI()
                // set preview img src
                const previewImg = modal.querySelector('#pfp-crop-area img')
                if (previewImg) previewImg.src = img.src
                showMessage('Drag to position, use zoom to scale then Save')
            } catch (e) {
                showMessage('Failed to read file')
            }
        })

        urlInput.addEventListener('keydown', async (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault()
                const url = urlInput.value && urlInput.value.trim()
                if (!url) return
                try {
                    await loadImageFromUrl(url)
                    createCropUI()
                    const previewImg = modal.querySelector('#pfp-crop-area img')
                    if (previewImg) previewImg.src = img.src
                    showMessage('Drag to position, use zoom to scale then Save')
                } catch (e) {
                    showMessage('Failed to load remote image (CORS or invalid URL)')
                }
            }
        })

        cancel.addEventListener('click', () => { modal.remove(); hideOverlay() })

        saveBtn.addEventListener('click', async () => {
            if (!imgLoaded) { showMessage('Please choose a file or URL first'); return }
            // find preview image element and transform values
            const previewImg = modal.querySelector('#pfp-crop-area img')
            if (!previewImg) return
            // compute source rect in original image coordinates
            const s = scale
            const sourceX = Math.max(0, (-tx) / s)
            const sourceY = Math.max(0, (-ty) / s)
            const sourceW = CANVAS_SIZE / s
            const sourceH = CANVAS_SIZE / s
            // clamp
            const sx = Math.max(0, Math.min(imgNaturalW - 1, sourceX))
            const sy = Math.max(0, Math.min(imgNaturalH - 1, sourceY))
            const sw = Math.max(1, Math.min(imgNaturalW - sx, sourceW))
            const sh = Math.max(1, Math.min(imgNaturalH - sy, sourceH))

            const DPR = Math.max(1, window.devicePixelRatio || 1)
            canvas.width = CANVAS_SIZE * DPR
            canvas.height = CANVAS_SIZE * DPR
            // Keep CSS size equal to logical size so layout doesn't change
            canvas.style.width = CANVAS_SIZE + 'px'
            canvas.style.height = CANVAS_SIZE + 'px'
            const ctx = canvas.getContext('2d')
            // high-quality resampling
            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = 'high'
            // scale the context so drawing uses logical (CSS) pixels
            ctx.scale(DPR, DPR)
            // draw (fill background then draw sampled source into the logical CANVAS_SIZE)
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
            const dataUrl = canvas.toDataURL('image/png')

            // send to server
            try {
                saveBtn.disabled = true
                showMessage('Uploading...')
                const res = await fetch('/profile/avatar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: dataUrl, filename: 'avatar.png' })
                })
                const body = await res.json()
                if (body && body.success && body.url) {
                    pfp.src = body.url + '?t=' + Date.now()
                    modal.remove()
                    hideOverlay()
                } else {
                    showMessage((body && body.error) ? body.error : 'Upload failed')
                }
            } catch (e) {
                showMessage('Upload failed')
            } finally { saveBtn.disabled = false }
        })
    }
})
