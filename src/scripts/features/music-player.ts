import { tradThis } from '../utils/translations.ts'

type PlayerAction = 'toggle' | 'back' | 'forward' | 'seek'

type MediaState = {
    title: string
    artist: string
    artwork: string
    currentTime: number
    duration: number
    paused: boolean
}

function mediaState(): MediaState | null {
    const elements = Array.from(document.querySelectorAll<HTMLMediaElement>('audio, video'))
    const activeMedia = elements.find((element) => !element.paused && element.readyState > 0)
    const media = activeMedia ?? elements.find((element) => element.readyState > 0) ?? elements[0]
    const session = navigator.mediaSession
    const spotifyPlayButton = document.querySelector<HTMLButtonElement>(
        'button[data-testid="control-button-playpause"]',
    ) ??
        Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label], button[title]')).find((button) => {
            const label = `${button.getAttribute('aria-label') ?? ''} ${button.title}`.toLowerCase()
            return /\b(play|pause)\b|재생|일시정지/.test(label)
        })
    const artwork = [...(session?.metadata?.artwork ?? [])].sort((left, right) =>
        Number.parseInt(left.sizes?.split('x')[0] || '0') -
        Number.parseInt(right.sizes?.split('x')[0] || '0')
    )
    const playLabel = (
        spotifyPlayButton?.getAttribute('aria-label') || spotifyPlayButton?.title || ''
    ).toLowerCase()
    const combinedPlayLabel = /play\s*\/\s*pause|pause\s*\/\s*play/.test(playLabel)
    const labelSaysPaused = !combinedPlayLabel && (/\bplay\b/.test(playLabel) || playLabel.includes('재생'))
    const labelSaysPlaying = !combinedPlayLabel && (
        playLabel.includes('pause') || playLabel.includes('일시정지') || playLabel.includes('일시 정지')
    )
    const sessionPaused = labelSaysPaused || (!labelSaysPlaying && session?.playbackState === 'paused')
    const readClock = (selector: string): number | null => {
        const text = document.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? ''
        const normalized = text.replace(/[^\d:]/g, '')
        const parts = normalized.split(':').map(Number)
        if (!text || parts.length < 2 || parts.some(Number.isNaN)) return null
        return parts.reduce((total, part) => total * 60 + part, 0)
    }
    const spotifyPosition = readClock('[data-testid="playback-position"]')
    const spotifyDuration = readClock('[data-testid="playback-duration"]')

    if (!media && !session?.metadata && !spotifyPlayButton) return null

    return {
        title: session?.metadata?.title || document.title,
        artist: session?.metadata?.artist || '',
        artwork: artwork.at(-1)?.src ||
            document.querySelector<HTMLImageElement>('[data-testid="cover-art-image"]')?.src || '',
        currentTime: location.hostname.endsWith('spotify.com') && spotifyPosition !== null
            ? spotifyPosition
            : media && Number.isFinite(media.duration) && media.duration > 0
            ? media.currentTime
            : spotifyPosition ?? 0,
        duration: location.hostname.endsWith('spotify.com') && spotifyDuration !== null
            ? spotifyDuration
            : media && Number.isFinite(media.duration) && media.duration > 0
            ? media.duration
            : spotifyDuration ?? 0,
        paused: location.hostname.endsWith('spotify.com')
            ? activeMedia
                ? false
                : labelSaysPaused
                ? true
                : labelSaysPlaying
                ? false
                : session?.playbackState
                ? session.playbackState !== 'playing'
                : media?.paused !== false
            : media
            ? media.paused
            : session?.playbackState
            ? session.playbackState !== 'playing'
            : sessionPaused,
    }
}

function controlMedia(action: PlayerAction, value?: number): void {
    const isSpotify = location.hostname.endsWith('spotify.com')

    if (isSpotify && action === 'seek' && value !== undefined) {
        const durationText =
            document.querySelector<HTMLElement>('[data-testid="playback-duration"]')?.textContent?.trim() ?? ''
        const durationFromText = durationText.replace(/[^\d:]/g, '').split(':').map(Number).reduce(
            (total, part) => total * 60 + part,
            0,
        )
        const duration = durationFromText ||
            Array.from(document.querySelectorAll<HTMLMediaElement>('audio, video')).find((item) =>
                Number.isFinite(item.duration) && item.duration > 0
            )?.duration || 0
        const nativeSlider = document.querySelector<HTMLInputElement>(
            'input[type="range"][data-testid*="progress" i], input[type="range"][aria-label*="progress" i], [data-testid="progress-bar"] input[type="range"]',
        )
        if (nativeSlider) {
            const maximum = Number(nativeSlider.max) || 100
            const sliderValue = maximum <= 100 && duration > 0 ? value / duration * maximum : value
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
            setter?.call(nativeSlider, Math.max(0, Math.min(maximum, sliderValue)).toString())
            nativeSlider.dispatchEvent(new Event('input', { bubbles: true }))
            nativeSlider.dispatchEvent(new Event('change', { bubbles: true }))
            return
        }

        const slider = document.querySelector<HTMLElement>(
            '[role="slider"][aria-label*="progress" i], [role="slider"][aria-label*="seek" i], [data-testid="progress-bar"], [data-testid="playback-progressbar"]',
        )
        if (slider) {
            const ariaMaximum = Number(slider.getAttribute('aria-valuemax'))
            const sliderDuration = duration || ariaMaximum
            const ratio = sliderDuration ? Math.max(0, Math.min(1, value / sliderDuration)) : 0
            const bounds = slider.getBoundingClientRect()
            const clientX = bounds.left + bounds.width * ratio
            const clientY = bounds.top + bounds.height / 2
            const target = document.elementFromPoint(clientX, clientY) ?? slider
            const pointerEvent = {
                bubbles: true,
                cancelable: true,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
                clientX,
                clientY,
            }
            target.dispatchEvent(new PointerEvent('pointerdown', pointerEvent))
            target.dispatchEvent(new PointerEvent('pointermove', pointerEvent))
            target.dispatchEvent(new PointerEvent('pointerup', pointerEvent))
            target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX, clientY }))
            return
        }

        const media = Array.from(document.querySelectorAll<HTMLMediaElement>('audio, video')).find((item) =>
            Number.isFinite(item.duration) && item.duration > 0
        )
        if (media) media.currentTime = Math.min(value, media.duration)
        return
    }

    if (isSpotify) {
        const selector = action === 'toggle'
            ? 'button[data-testid="control-button-playpause"]'
            : action === 'back'
            ? 'button[data-testid="control-button-skip-back"]'
            : 'button[data-testid="control-button-skip-forward"]'
        const button = document.querySelector<HTMLButtonElement>(selector) ??
            (action === 'toggle'
                ? Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label], button[title]')).find(
                    (item) => {
                        const label = `${item.getAttribute('aria-label') ?? ''} ${item.title}`.toLowerCase()
                        return /\b(play|pause)\b|재생|일시정지/.test(label)
                    },
                )
                : null)
        button?.click()
        return
    }

    const elements = Array.from(document.querySelectorAll<HTMLMediaElement>('audio, video'))
    const media = elements.find((element) => !element.paused && element.readyState > 0) ?? elements[0]

    if (!media) {
        const spotifyButton = action === 'toggle'
            ? document.querySelector<HTMLButtonElement>('button[data-testid="control-button-playpause"]')
            : action === 'back'
            ? document.querySelector<HTMLButtonElement>('button[data-testid="control-button-skip-back"]')
            : action === 'forward'
            ? document.querySelector<HTMLButtonElement>('button[data-testid="control-button-skip-forward"]')
            : null
        spotifyButton?.click()
        return
    }

    if (action === 'toggle') {
        if (media.paused) void media.play()
        else media.pause()
    }

    if (action === 'back') media.currentTime = Math.max(0, media.currentTime - 10)
    if (action === 'forward') media.currentTime = Math.min(media.duration || Infinity, media.currentTime + 10)
    if (action === 'seek' && value !== undefined) media.currentTime = value
}

function setButtonIcon(button: HTMLButtonElement, icon: 'play' | 'pause' | 'back' | 'forward'): void {
    if (button.dataset.icon === icon) return
    const image = document.createElement('img')
    image.className = `music-player-icon music-player-icon-${icon}`
    image.src = `src/assets/interface/music/${icon}.png`
    image.alt = ''
    image.setAttribute('aria-hidden', 'true')
    button.replaceChildren(image)
    button.dataset.icon = icon
}

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
    const minutes = Math.floor(seconds / 60)
    const remainder = Math.floor(seconds % 60).toString().padStart(2, '0')
    return `${minutes}:${remainder}`
}

const permissionRequest: chrome.permissions.Permissions = {
    permissions: ['tabs', 'scripting'],
    origins: ['<all_urls>'],
}

export function musicPlayer(enabled = true): void {
    const time = document.getElementById('time')
    if (!time || document.getElementById('music-player')) return
    let playerEnabled = enabled

    const player = document.createElement('section')
    const cover = document.createElement('img')
    const title = document.createElement('span')
    const artist = document.createElement('span')
    const back = document.createElement('button')
    const toggle = document.createElement('button')
    const forward = document.createElement('button')
    const controls = document.createElement('div')
    const progress = document.createElement('input')
    const timeline = document.createElement('div')
    const elapsed = document.createElement('span')
    const remaining = document.createElement('span')

    player.id = 'music-player'
    player.classList.toggle('hidden', !playerEnabled)
    player.setAttribute('aria-label', 'Chrome music controls')
    cover.id = 'music-player-cover'
    cover.alt = '앨범 표지'
    cover.hidden = true
    title.id = 'music-player-title'
    title.textContent = tradThis('Please play music')
    artist.id = 'music-player-artist'
    back.type = 'button'
    back.className = 'music-player-button'
    back.setAttribute('aria-label', '이전 곡')
    back.title = '이전 곡'
    setButtonIcon(back, 'back')
    toggle.type = 'button'
    toggle.className = 'music-player-button music-player-toggle'
    toggle.setAttribute('aria-label', '재생')
    toggle.title = '재생'
    setButtonIcon(toggle, 'play')
    forward.type = 'button'
    forward.className = 'music-player-button'
    forward.setAttribute('aria-label', '다음 곡')
    forward.title = '다음 곡'
    setButtonIcon(forward, 'forward')
    controls.className = 'music-player-controls'
    progress.id = 'music-player-progress'
    progress.type = 'range'
    progress.min = '0'
    progress.max = '0'
    progress.step = '0.1'
    progress.value = '0'
    progress.disabled = true
    progress.setAttribute('aria-label', '재생 위치')
    timeline.className = 'music-player-timeline'
    elapsed.className = 'music-player-time music-player-elapsed'
    remaining.className = 'music-player-time music-player-remaining'
    timeline.append(progress, elapsed, remaining)
    controls.append(back, toggle, forward)
    player.append(cover, title, artist, timeline, controls)
    document.body.append(player)

    const positionPlayer = (): void => {
        const counters = document.getElementById('day-counters')
        const clockBounds = time.getBoundingClientRect()
        const hasCounters = counters && !counters.classList.contains('empty')

        if (!hasCounters && clockBounds.height === 0) {
            player.style.top = getComputedStyle(time).top || '50px'
            return
        }

        const top = hasCounters ? counters.getBoundingClientRect().bottom + 16 : clockBounds.bottom + 16
        player.style.top = `${top}px`
    }

    positionPlayer()
    document.addEventListener('day-counters-resized', positionPlayer)
    const counters = document.getElementById('day-counters')
    if (counters) new ResizeObserver(positionPlayer).observe(counters)
    window.addEventListener('resize', positionPlayer)
    document.addEventListener(
        'music-player-update',
        ((event: CustomEvent<boolean>) => {
            playerEnabled = event.detail
            player.style.transition = 'opacity 240ms ease'
            if (playerEnabled) {
                player.classList.remove('hidden')
                player.style.opacity = '0'
                requestAnimationFrame(() => {
                    player.style.opacity = '1'
                })
                void update()
                window.setTimeout(() => {
                    if (!playerEnabled) return
                    player.style.removeProperty('opacity')
                    player.style.removeProperty('transition')
                }, 260)
            } else {
                player.style.opacity = '0'
                window.setTimeout(() => {
                    if (playerEnabled) return
                    player.classList.add('hidden')
                    player.style.removeProperty('opacity')
                    player.style.removeProperty('transition')
                }, 260)
            }
        }) as EventListener,
    )

    let connectedTabId: number | undefined
    let currentState: MediaState | null = null
    let updateToken = 0
    let seekPending = false
    let timeAnchor = 0
    let timeAnchorAt = performance.now()
    let timeRunning = false
    let currentTrackKey = ''

    const renderProgress = (): void => {
        if (currentState) {
            const duration = Math.max(0, currentState.duration)
            const position = Math.min(
                duration,
                seekPending
                    ? Number(progress.value)
                    : timeAnchor + (timeRunning ? (performance.now() - timeAnchorAt) / 1000 : 0),
            )
            if (!seekPending) progress.value = position.toString()
            progress.style.setProperty(
                '--music-progress',
                `${duration ? Math.min(100, position / duration * 100) : 0}%`,
            )
            elapsed.textContent = formatTime(position)
            remaining.textContent = `-${formatTime(Math.max(0, duration - position))}`
        } else {
            elapsed.textContent = '0:00'
            remaining.textContent = '-0:00'
        }
        window.requestAnimationFrame(renderProgress)
    }

    const update = async (): Promise<void> => {
        if (!playerEnabled) return
        const token = ++updateToken
        let granted: boolean
        try {
            granted = await chrome.permissions.contains(permissionRequest)
        } catch {
            return
        }
        if (token !== updateToken || !player.isConnected) return

        if (!granted) {
            currentState = null
            timeRunning = false
            title.textContent = tradThis('Please play music')
            artist.textContent = ''
            setButtonIcon(toggle, 'play')
            toggle.setAttribute('aria-label', '재생')
            toggle.title = '재생'
            player.classList.remove('is-playing')
            cover.hidden = true
            player.classList.remove('has-cover')
            connectedTabId = undefined
            return
        }

        let allTabs: chrome.tabs.Tab[]
        try {
            allTabs = await chrome.tabs.query({})
        } catch {
            return
        }
        if (token !== updateToken || !player.isConnected) return
        const tabs = allTabs.filter((item) =>
            item.id !== undefined &&
            (item.audible || item.url?.includes('open.spotify.com'))
        )
        tabs.sort((left, right) =>
            Number(right.id === connectedTabId) - Number(left.id === connectedTabId) ||
            Number(right.audible) - Number(left.audible) ||
            (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0)
        )
        let tab: chrome.tabs.Tab | undefined
        let detectedState: MediaState | null = null

        for (const candidate of tabs) {
            if (candidate.id === undefined) continue
            try {
                const result = await chrome.scripting.executeScript({
                    target: { tabId: candidate.id },
                    func: mediaState,
                })
                const state = result[0]?.result ?? null
                if (token !== updateToken) return
                if (state && (!state.paused || candidate.audible || candidate.id === connectedTabId)) {
                    tab = candidate
                    detectedState = state
                    break
                }
            } catch {
                continue
            }
        }

        if (!tab && connectedTabId !== undefined) {
            try {
                tab = await chrome.tabs.get(connectedTabId)
                const result = await chrome.scripting.executeScript({
                    target: { tabId: connectedTabId },
                    func: mediaState,
                })
                detectedState = result[0]?.result ?? null
            } catch {
                connectedTabId = undefined
            }
        }

        if (token !== updateToken || !player.isConnected) return

        if (tab?.id === undefined) {
            currentState = null
            timeRunning = false
            title.textContent = tradThis('Please play music')
            artist.textContent = ''
            player.classList.remove('is-playing')
            setButtonIcon(toggle, 'play')
            toggle.setAttribute('aria-label', '재생')
            toggle.title = '재생'
            cover.hidden = true
            player.classList.remove('has-cover')
            return
        }

        try {
            currentState = detectedState
            connectedTabId = currentState ? tab.id : undefined

            if (!currentState) {
                title.textContent = tradThis('Please play music')
                artist.textContent = ''
                player.classList.remove('is-playing')
                setButtonIcon(toggle, 'play')
                toggle.setAttribute('aria-label', '재생')
                toggle.title = '재생'
                cover.hidden = true
                player.classList.remove('has-cover')
                return
            }

            title.textContent = currentState.title || '음악'
            artist.textContent = currentState.artist
            const duration = Math.max(0, currentState.duration)
            progress.max = duration.toString()
            progress.disabled = duration <= 0
            const now = performance.now()
            const incomingPosition = Math.min(duration, Math.max(0, currentState.currentTime))
            const predictedPosition = timeAnchor + (timeRunning ? (now - timeAnchorAt) / 1000 : 0)
            const trackKey = `${currentState.title}|${currentState.artist}`
            const playing = !currentState.paused
            const trackChanged = trackKey !== currentTrackKey
            const positionJumped = Math.abs(incomingPosition - predictedPosition) > 2.5

            if (!seekPending) {
                if (trackChanged || positionJumped || (playing && !timeRunning)) timeAnchor = incomingPosition
                else if (!playing && timeRunning) timeAnchor = predictedPosition
                else if (playing) timeAnchor = Math.max(predictedPosition, incomingPosition)
                else timeAnchor = incomingPosition
                timeAnchorAt = now
            }

            currentTrackKey = trackKey
            timeRunning = playing
            player.classList.toggle('is-playing', !currentState.paused)
            setButtonIcon(toggle, currentState.paused ? 'play' : 'pause')
            toggle.setAttribute('aria-label', currentState.paused ? '재생' : '일시정지')
            toggle.title = currentState.paused ? '재생' : '일시정지'
            cover.hidden = !currentState.artwork
            player.classList.toggle('has-cover', Boolean(currentState.artwork))
            if (currentState.artwork && cover.src !== currentState.artwork) cover.src = currentState.artwork
        } catch {
            connectedTabId = undefined
            currentState = null
            title.textContent = tradThis('Please play music')
        }
    }

    const runAction = async (action: PlayerAction): Promise<void> => {
        if (connectedTabId === undefined) return

        try {
            await chrome.scripting.executeScript({
                target: { tabId: connectedTabId },
                func: controlMedia,
                args: [action],
            })
            await new Promise((resolve) => window.setTimeout(resolve, 300))
            await update()
        } catch {
            title.textContent = 'Spotify 탭에서 음악을 재생해 주세요'
            connectedTabId = undefined
        }
    }

    const requestAccessAndRun = (action: PlayerAction): void => {
        chrome.permissions.request(permissionRequest, (granted) => {
            if (chrome.runtime.lastError || !granted) {
                title.textContent = tradThis('Please play music')
                return
            }
            void update().then(() => runAction(action))
        })
    }

    const handleControl = (action: PlayerAction): void => {
        requestAccessAndRun(action)
    }

    back.addEventListener('click', () => handleControl('back'))
    toggle.addEventListener('click', () => handleControl('toggle'))
    forward.addEventListener('click', () => handleControl('forward'))
    progress.addEventListener('input', () => {
        seekPending = true
        elapsed.textContent = formatTime(Number(progress.value))
        remaining.textContent = `-${formatTime(Math.max(0, Number(progress.max) - Number(progress.value)))}`
        progress.style.setProperty(
            '--music-progress',
            `${progress.max === '0' ? 0 : Number(progress.value) / Number(progress.max) * 100}%`,
        )
    })
    progress.addEventListener('change', () => {
        seekPending = false
        const seconds = Number(progress.value)
        timeAnchor = seconds
        timeAnchorAt = performance.now()
        void runSeek(seconds)
    })

    async function runSeek(seconds: number): Promise<void> {
        if (connectedTabId === undefined) return
        try {
            await chrome.scripting.executeScript({
                target: { tabId: connectedTabId },
                func: controlMedia,
                args: ['seek', seconds],
            })
            await new Promise((resolve) => window.setTimeout(resolve, 300))
            await update()
        } catch {
            connectedTabId = undefined
        }
    }

    window.requestAnimationFrame(renderProgress)
    void update()
    window.setInterval(() => void update(), 700)
}
