import { darkmode, favicon, pageControl, tabTitle, textShadow } from './features/others.ts'
import { customFont, fontIsAvailableInSubset, systemfont } from './features/fonts.ts'
import { backgroundUpdate, initBackgroundOptions, toggleMuteStatus } from './features/backgrounds/index.ts'
import { buildBackgroundUrls, parseUrlList } from './features/backgrounds/urls.ts'
import { synchronization } from './features/synchronization/index.ts'
import { moveElements } from './features/move/index.ts'
import { hideElements } from './features/hide.ts'
import { linksImport } from './features/links/bookmarks.ts'
import { quickLinks } from './features/links/index.ts'
import { searchbar } from './features/searchbar.ts'
import { quotes } from './features/quotes.ts'
import { clock } from './features/clock/index.ts'
import { openSettingsButtonEvent } from './features/contextmenu.ts'

import { colorInput, fadeOut, inputThrottle, turnRefreshButton, webkitRangeTrackColor } from './shared/dom.ts'
import { BROWSER, IS_MOBILE, PLATFORM, SYNC_DEFAULT } from './defaults.ts'
import { toggleTraduction, tradThis, traduction } from './utils/translations.ts'
import { settingsNotifications } from './utils/notifications.ts'
import { getPermissions } from './utils/permissions.ts'
import { opacityFromHex } from './shared/generic.ts'
import { loadCallbacks } from './utils/onsettingsload.ts'
import { getLangForSite } from './utils/translations.ts'
import { onclickdown } from 'clickdown/mod'
import { filterData } from './compatibility/apply.ts'
import { parseSettingsFile, serializeSettingsFile } from './utils/settings-file.ts'
import { debounce } from './utils/debounce.ts'
import { langList } from './langs.ts'
import { storage } from './storage.ts'
import { parse } from './utils/parse.ts'

import type { Langs } from '../types/shared.ts'
import type { Sync } from '../types/sync.ts'
import type { DayCounter } from '../types/sync.ts'
import type { Local } from '../types/local.ts'

// Initialization

let settingsInitSync: Sync
let settingsInitLocal: Local
let configuredDayCounters: DayCounter[] = []
const defaultDayCounterLabels = new Set([
    '새 디데이',
    'New D-Day',
    '新しい記念日',
    'Nieuwe afteldag',
    'Nova contagem regressiva',
    'Новое событие',
    'วันสำคัญใหม่',
    '新纪念日',
    '新紀念日',
])

export function settingsInit(sync: Sync, local: Local): void {
    const showsettings = document.getElementById('show-settings')

    settingsInitSync = sync
    settingsInitLocal = local

    document.addEventListener('updateSettingsBeforeInit', (e) => {
        settingsInitSync = (e as CustomEvent).detail
    })

    document.body?.addEventListener('keydown', settingsInitEvent)
    showsettings?.addEventListener('pointerdown', settingsInitEvent)

    const openSettingsButtonsFromContextMenu = document.body.querySelectorAll<HTMLButtonElement>(
        `[data-action="openTheseSettings"]`,
    )

    openSettingsButtonsFromContextMenu.forEach((btn) => {
        btn?.addEventListener('pointerdown', settingsInitEvent)
    })
}

function settingsInitEvent(event: Event): void {
    const showsettings = document.getElementById('show-settings')
    const settings = document.getElementById('settings')

    // 1. When to load settings

    const settingsAreHidden = settings?.classList.contains('hidden')
    const isLeftClick = (event as PointerEvent)?.button === 0
    const isEscape = (event as KeyboardEvent)?.code === 'Escape'
    const canOpenSettings = settingsAreHidden && (isEscape || isLeftClick)

    if (!canOpenSettings) {
        return
    }

    // 2. To apply now

    const local = settingsInitLocal
    const sync = settingsInitSync

    settings?.removeAttribute('style')
    settings?.classList.remove('hidden')
    document.dispatchEvent(new Event('settings'))

    document.addEventListener(
        'toggle-settings',
        ((e: CustomEvent) => {
            settingsToggle(e)
        }) as EventListener,
    )

    // if init by touch, opens settings right away
    if ((event as PointerEvent).pointerType === 'touch') {
        // tricks the browser into thinking it's not the same event that inits and opens
        setTimeout(() => {
            // when requesting specific settings section
            if ((event.target as HTMLElement).getAttribute('data-attribute')) {
                openSettingsButtonEvent(event)
            } else {
                document.dispatchEvent(new CustomEvent('toggle-settings'))
            }
        }, 0)
    }

    document.body?.removeEventListener('keydown', settingsInitEvent)
    showsettings?.removeEventListener('pointerdown', settingsInitEvent)

    showall(sync.showall, false)
    traduction(settings, sync.lang)
    translatePlaceholders()
    localiseSiteLinks()
    initBackgroundOptions(sync, local)
    initOptionsValues(sync, local)
    initOptionsEvents()
    updateConfigurationEditor(sync)

    // 3. Can be deferred

    setTimeout(() => {
        initTimezone(sync)
        updateSettingsEvent()
        translateAriaLabels()
        settingsDrawerBar()
        loadCallbacks()

        settings?.classList.remove('init')
    }, 500)
}

function settingsToggle(event?: CustomEvent): void {
    const domshowsettings = document.getElementById('show-settings')
    const domsettings = document.getElementById('settings')
    const isClosed = domsettings?.classList.contains('shown') === false

    const scrollTo = event?.detail?.scrollTo ?? false
    const target = domsettings?.querySelector(scrollTo)

    // scrolls requested section into view
    if (target && domsettings) {
        // starts scrolling only once the settings have been rendered (otherwise starts full animation again even if unnecessary)
        requestAnimationFrame(() => {
            setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 0)
        })
    }

    // prevents closing if a scrollTo has been requested
    if (!isClosed && scrollTo) return

    domsettings?.classList.toggle('shown', isClosed)
    domshowsettings?.classList.toggle('shown', isClosed)

    if (isClosed) {
        updateConfigurationEditor()
    }

    domsettings?.style.removeProperty('transform')
    domsettings?.style.removeProperty('transition')
    document.dispatchEvent(new Event('close-edit'))
}

function initOptionsValues(data: Sync, local: Local): void {
    const domsettings = document.getElementById('settings') as HTMLElement
    const userQuotes = data.quotes?.userlist?.[0] ? data.quotes?.userlist : undefined
    configuredDayCounters = (data.dayCounters ?? []).slice(0, 2)

    setInput('i_blur', data.backgrounds.blur ?? 15)
    setInput('i_bright', data.backgrounds.bright ?? 0.8)
    setInput('i_fadein', data.backgrounds.fadein ?? 400)
    setInput('i_linkiconradius', data.linkiconradius ?? 1.1)
    setInput('i_linkstyle', data.linkstyle || 'medium')
    setInput('i_type', data.backgrounds.type || 'images')
    setInput('i_freq', data.backgrounds?.frequency || 'hour')
    setInput('i_dark', data.dark || 'system')
    setInput('i_favicon', data.favicon ?? '')
    setInput('i_tabtitle', data.tabtitle ?? '')
    setInput('i_solid-background', data.backgrounds.color ?? '#185A63')
    setInput('i_pagewidth', data.pagewidth || 1600)
    setInput('i_pagegap', data.pagegap ?? 1)
    setInput('i_dateformat', data.dateformat || 'eu')
    setInput('i_textshadow', data.textShadow ?? 0.2)
    setInput('i_sbengine', data.searchbar?.engine || 'google')
    setInput('i_sbplaceholder', data.searchbar?.placeholder || '')
    setInput('i_sbwidth', data.searchbar?.width ?? 30)
    setInput('i_sbrequest', data.searchbar?.request || '')
    setInput('i_qtfreq', data.quotes?.frequency || 'day')
    setInput('i_qttype', data.quotes?.type || 'classic')
    setInput('i_qtlist', userQuotes ?? '')
    setInput('i_qturl', data.quotes?.url ?? '')
    setInput('i_ampm_position', data.clock.ampmposition || 'top-left')
    setInput('i_timezone', data.clock?.timezone || 'auto')
    setInput('i_weight', data.font?.weight || '300')
    setInput('i_font-color', data.font.color ?? '#ffffff')
    setInput('i_size', data.font?.size || (IS_MOBILE ? '11' : '14'))

    setInput('i_synctype', local.syncType ?? (PLATFORM === 'online' ? 'off' : 'browser'))
    setFormInput('i_customfont', systemfont.placeholder, data.font?.family)
    setFormInput('i_gistsync', 'github_pat_XX000X00X', local?.gistToken)
    setFormInput('i_urlsync', 'https://pastebin.com/raw/y7XhhiDs', local?.distantUrl)

    setCheckbox('i_showall', data.showall)
    setCheckbox('i_settingshide', data.hide?.settingsicon ?? false)
    setCheckbox('i_background-mute-videos', data.backgrounds.mute ?? true)
    setCheckbox('i_quicklinks', data.quicklinks)
    setCheckbox('i_linknewtab', data.linknewtab)
    setCheckbox('i_time', data.time)
    setCheckbox('i_seconds', data.clock?.seconds ?? false)
    setCheckbox('i_sb', data.searchbar?.on ?? false)
    setCheckbox('i_sbsuggestions', data.searchbar?.suggestions ?? true)
    setCheckbox('i_quotes', data.quotes?.on ?? false)
    setCheckbox('i_ampm', data.clock?.ampm ?? false)
    setCheckbox('i_ampm-label', data.clock?.ampmlabel ?? false)
    setCheckbox('i_sbnewtab', data.searchbar?.newtab ?? false)
    setCheckbox('i_music_player', data.musicPlayer ?? true)
    setCheckbox('i_qtauthor', data.quotes?.author ?? false)

    // this one's weird because it was a select made into a checkbox

    colorInput('solid-background', data.backgrounds.color)
    colorInput('font-color', data.font.color)

    // Change edit tips on mobile
    if (IS_MOBILE) {
        const tooltiptext = domsettings.querySelector('.tooltiptext .instructions')
        const text = tradThis('Edit your Quick Links by long-pressing the icon.')

        if (tooltiptext) {
            tooltiptext.textContent = text
        }
    }

    // inserts languages in select
    const langInput = paramId('i_lang')

    for (const [code, title] of Object.entries(langList)) {
        const option = document.createElement('option')
        option.value = code
        option.text = title
        langInput.appendChild(option)
    }

    // must be init after children appening
    setInput('i_lang', data.lang || 'en')

    // Activate feature options
    toggleSettingsDropdown('ampm_label', data.clock.ampm)
    toggleSettingsDropdown('ampm_position', data.clock.ampmlabel && data.clock.ampm)
    toggleSettingsDropdown('searchbar_request', data.searchbar?.engine === 'custom')

    // the events for these are in toggleWidgetInSettings()
    toggleSettingsDropdown('quicklinks_options', data.quicklinks)
    toggleSettingsDropdown('time_options', data.time)
    toggleSettingsDropdown('searchbar_options', data.searchbar?.on)
    toggleSettingsDropdown('quotes_options', data.quotes?.on)

    // Page layout
    const gridLayoutButtons = domsettings.querySelectorAll<HTMLButtonElement>('#grid-layout button')
    const selectedLayout = data.move?.selection || 'single'

    for (const button of gridLayoutButtons) {
        button?.classList.toggle('selected', button.dataset.layout === selectedLayout)
    }

    // Link show title
    paramId('b_showtitles').classList.toggle('on', data?.linktitles ?? true)
    paramId('b_showbackgrounds').classList.toggle('on', data?.linkbackgrounds ?? true)

    const dateOnly = data.hide?.clock
    const clockOnly = data.hide?.date
    let hideTime = 'all'

    if (dateOnly) {
        hideTime = 'date'
    } else if (clockOnly) {
        hideTime = 'clock'
    }

    setInput('i_timehide', hideTime)

    // Quotes option display
    paramId('quotes_userlist')?.classList.toggle('shown', data.quotes?.type === 'user')
    paramId('quotes_url')?.classList.toggle('shown', data.quotes?.type === 'url')

    const settingsForms = document.querySelectorAll<HTMLFormElement>('#settings form')

    for (const form of settingsForms) {
        const inputs = form.querySelectorAll<HTMLInputElement>('input')

        for (const input of inputs) {
            input.addEventListener('input', () => {
                form.classList.toggle('valid', form.checkValidity())
            })
        }
    }

    // Change Sync name based on browser
    const browserSyncOption = document.querySelector<HTMLElement>("#i_synctype option[value='browser']")

    if (browserSyncOption) {
        if (PLATFORM === 'firefox') {
            browserSyncOption.textContent = 'Firefox Sync'
        } else if (PLATFORM === 'chrome' && BROWSER === 'edge') {
            browserSyncOption.textContent = 'Edge Sync'
        } else if (PLATFORM === 'chrome') {
            browserSyncOption.textContent = 'Chrome Sync'
        } else if (PLATFORM === 'safari') {
            browserSyncOption.textContent = 'Safari'
        } else {
            browserSyncOption.textContent = tradThis('Automatic')
        }
    }

    // required for the range input's track color separation to work in webkit browsers
    // yes, it blows.
    for (const input of document.querySelectorAll<HTMLInputElement>('input[type="range"]')) {
        webkitRangeTrackColor(input)

        input.addEventListener('input', () => {
            input.style.setProperty('--value', input.value)
        })
    }
}

function initOptionsEvents(): void {
    onclickdown(paramId('b_accept-permissions'), async () => {
        await getPermissions('topSites', 'bookmarks')

        const sync = await storage.sync.get()
        const local = await storage.local.get()
        quickLinks({ sync, local })

        settingsNotifications({ 'accept-permissions': false })
    })

    // General

    onclickdown(paramId('i_showall'), (_, target) => {
        showall(target.checked, true)
    })

    paramId('i_lang').addEventListener('change', function (): void {
        switchLangs(this.value as Langs)
    })

    paramId('i_favicon').addEventListener('input', function (this: HTMLInputElement): void {
        favicon(this.value, true)
    })

    paramId('i_favicon').addEventListener('change', function (): void {
        this.blur()
    })

    paramId('i_tabtitle').addEventListener('input', function (): void {
        tabTitle(this.value, true)
    })

    paramId('i_tabtitle').addEventListener('change', function (): void {
        this.blur()
    })

    paramId('i_dark').addEventListener('change', function (): void {
        darkmode(this.value as 'auto' | 'system' | 'enable' | 'disable', true)
    })

    onclickdown(paramId('i_settingshide'), (_, target) => {
        hideElements({ settingsicon: target.checked }, { isEvent: true })
    })

    // Quick links

    onclickdown(paramId('i_quicklinks'), (_, target) => {
        moveElements(undefined, { widget: ['quicklinks', target.checked] })
    })

    paramId('f_addlink').addEventListener('submit', function (this, event: SubmitEvent): void {
        event.preventDefault()

        quickLinks(undefined, {
            addLinks: [
                {
                    title: paramId('i_addlink-title').value,
                    url: paramId('i_addlink-url').value,
                },
            ],
        })

        paramId('i_addlink-url').value = ''
        paramId('i_addlink-title').value = ''
        this.classList.remove('valid')
    })

    onclickdown(paramId('i_linknewtab'), (_, target) => {
        quickLinks(undefined, { newtab: target.checked })
    })

    paramId('i_linkstyle').addEventListener('change', function (this): void {
        quickLinks(undefined, { styles: { style: this.value } })
    })

    onclickdown(paramId('b_showtitles'), (_, target) => {
        quickLinks(undefined, {
            styles: { titles: !target.classList.contains('on') },
        })
    })

    onclickdown(paramId('b_showbackgrounds'), (_, target) => {
        quickLinks(undefined, {
            styles: { backgrounds: !target.classList.contains('on') },
        })
    })

    paramId('i_linkiconradius').addEventListener('input', function (this): void {
        quickLinks(undefined, { iconradius: this.value })
    })

    onclickdown(paramId('b_importbookmarks'), async () => {
        await getPermissions('topSites', 'bookmarks')
        linksImport()
    })

    // Backgrounds

    paramId('i_type').addEventListener('change', function (this: HTMLInputElement): void {
        backgroundUpdate({ type: this.value })
    })

    paramId('b_solid-background').addEventListener('click', function (): void {
        paramId('i_solid-background').click()
    })

    paramId('i_solid-background').addEventListener('input', function (): void {
        backgroundUpdate({ color: this.value })
    })

    paramId('i_background-provider').addEventListener('input', function (): void {
        backgroundUpdate({ provider: this.value })
    })

    paramId('f_background-user-coll').addEventListener('submit', function (this, event: SubmitEvent): void {
        backgroundUpdate({ query: event })
        event.preventDefault()
    })

    paramId('f_background-user-search').addEventListener('submit', function (this, event: SubmitEvent): void {
        backgroundUpdate({ query: event })
        event.preventDefault()
    })

    paramId('i_freq').addEventListener('change', function (this: HTMLInputElement): void {
        backgroundUpdate({ freq: this.value })
    })

    onclickdown(paramId('i_refresh'), (event) => {
        backgroundUpdate({ refresh: event })
    })

    paramId('i_background-upload').addEventListener('change', function (this: HTMLInputElement): void {
        backgroundUpdate({ files: this.files })
    })

    onclickdown(paramId('b_background-urls'), () => {
        backgroundUpdate({ urlsapply: true })
    })

    onclickdown(paramId('i_background-mute-videos'), (_, target) => {
        toggleMuteStatus(target.checked)
        backgroundUpdate({ mute: target.checked })
    })

    // Background filters

    paramId('i_blur').addEventListener('pointerdown', function (this: HTMLInputElement): void {
        backgroundUpdate({ blurenter: true })
    })

    paramId('i_blur').addEventListener('input', function (this: HTMLInputElement): void {
        backgroundUpdate({ blur: this.value })
    })

    paramId('i_bright').addEventListener('input', function (this: HTMLInputElement): void {
        backgroundUpdate({ bright: this.value })
    })

    paramId('i_fadein').addEventListener('input', function (this: HTMLInputElement): void {
        backgroundUpdate({ fadein: this.value })
    })

    // Time and date

    onclickdown(paramId('i_time'), (_, target) => {
        moveElements(undefined, { widget: ['time', target.checked] })
    })

    onclickdown(paramId('i_seconds'), (_, target) => {
        clock(undefined, { seconds: target.checked })
    })

    initDayCounterSettings(configuredDayCounters)

    const dayCounterList = document.getElementById('day-counter-settings')
    const addDayCounter = document.getElementById('add-day-counter')

    dayCounterList?.addEventListener('change', () => {
        saveDayCounterSettings()
    })

    dayCounterList?.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove-counter]')
        if (!button) return
        button.closest('.day-counter-setting')?.remove()
        saveDayCounterSettings()
    })

    addDayCounter?.addEventListener('click', () => {
        if (dataDayCounters().length >= 2) return
        const today = new Date()
        const date = [today.getFullYear(), today.getMonth() + 1, today.getDate()]
            .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0'))
            .join('-')
        const counter = { label: tradThis('New D-Day'), date }
        configuredDayCounters = [...dataDayCounters(), counter]
        const list = document.getElementById('day-counter-settings')
        list?.append(createDayCounterSetting(counter))
        saveDayCounterSettings()
    })

    onclickdown(paramId('i_music_player'), (_, target) => {
        storage.sync.set({ musicPlayer: target.checked })
        document.dispatchEvent(new CustomEvent('music-player-update', { detail: target.checked }))
    })

    onclickdown(paramId('i_ampm'), (_, target) => {
        clock(undefined, { ampm: target.checked })

        // shows/hides ampm_label option
        toggleSettingsDropdown('ampm_label', target.checked)

        // same for its position based on ampm_label AND 12h time toggle
        const ampm_toggle = document.querySelector('#i_ampm-label') as HTMLInputElement
        toggleSettingsDropdown('ampm_position', target.checked && ampm_toggle.checked)
    })

    onclickdown(paramId('i_ampm-label'), (_, target) => {
        clock(undefined, { ampmlabel: target.checked })

        // shows/hides ampm_position option
        toggleSettingsDropdown('ampm_position', target.checked)
    })

    paramId('i_ampm_position').addEventListener('change', function (this: HTMLInputElement): void {
        clock(undefined, { ampmposition: this.value })
    })

    paramId('i_timezone').addEventListener('change', function (this: HTMLInputElement): void {
        clock(undefined, { timezone: this.value })
    })

    paramId('i_dateformat').addEventListener('change', function (this): void {
        clock(undefined, { dateformat: this.value })
    })

    paramId('i_timehide').addEventListener('change', function (this: HTMLInputElement): void {
        hideElements({ clock: this.value === 'clock', date: this.value === 'date' }, { isEvent: true })
    })

    // Searchbar

    onclickdown(paramId('i_sb'), (_, target) => {
        moveElements(undefined, { widget: ['searchbar', target.checked] })
        getPermissions('search')
    })

    paramId('i_sbengine').addEventListener('change', function (this: HTMLInputElement): void {
        searchbar(undefined, { engine: this.value })
    })

    paramId('i_sbwidth').addEventListener('input', function (this: HTMLInputElement): void {
        searchbar(undefined, { width: this.value })
    })

    paramId('f_sbrequest').addEventListener('submit', function (this, event: SubmitEvent): void {
        searchbar(undefined, { request: true })
        event.preventDefault()
    })

    onclickdown(paramId('i_sbnewtab'), (_, target) => {
        searchbar(undefined, { newtab: target.checked })
    })

    onclickdown(paramId('i_sbsuggestions'), (_, target) => {
        searchbar(undefined, { suggestions: target.checked })
    })

    paramId('i_sbplaceholder').addEventListener('keyup', function (): void {
        searchbar(undefined, { placeholder: this.value })
    })

    paramId('i_sbplaceholder').addEventListener('change', () => {
        paramId('i_sbplaceholder').blur()
    })

    // Quotes

    onclickdown(paramId('i_quotes'), (_, target) => {
        moveElements(undefined, { widget: ['quotes', target.checked] })
    })

    paramId('i_qtfreq').addEventListener('change', function (): void {
        quotes(undefined, { frequency: this.value })
    })

    paramId('i_qttype').addEventListener('change', function (): void {
        quotes(undefined, { type: this.value })
    })

    onclickdown(paramId('i_qtrefresh'), (event, target) => {
        inputThrottle(target)
        turnRefreshButton(event, true)
        quotes(undefined, { refresh: true })
    })

    onclickdown(paramId('i_qtauthor'), (_, target) => {
        quotes(undefined, { author: target.checked })
    })

    paramId('i_qtlist').addEventListener('change', function (): void {
        quotes(undefined, { userlist: this.value })
    })

    paramId('f_qturl').addEventListener('submit', function (this, event: SubmitEvent): void {
        event.preventDefault()

        quotes(undefined, { url: paramId('i_qturl').value })
    })

    // Custom fonts

    paramId('i_customfont').addEventListener('pointerenter', () => {
        customFont(undefined, { autocomplete: true })
    })

    paramId('f_customfont').addEventListener('submit', (event) => {
        customFont(undefined, { family: paramId('i_customfont').value })
        event.preventDefault()
    })

    paramId('i_weight').addEventListener('input', function (): void {
        customFont(undefined, { weight: this.value })
    })

    paramId('b_font-color').addEventListener('click', function (): void {
        paramId('i_font-color').click()
    })

    paramId('i_font-color').addEventListener('input', function (): void {
        customFont(undefined, { color: this.value })
    })

    paramId('i_size').addEventListener('input', function (): void {
        customFont(undefined, { size: this.value })
    })

    paramId('i_textshadow').addEventListener('input', function (): void {
        textShadow(undefined, Number.parseFloat(this.value))
    })

    // Page layout

    onclickdown(paramId('b_editmove'), () => {
        moveElements(undefined, {
            toggle: !document.getElementById('interface')?.classList.contains('move-edit'),
        })
    })

    paramId('i_pagecolumns').addEventListener('change', function (): void {
        moveElements(undefined, { layout: this.value, toggle: true })
    })

    paramId('i_pagewidth').addEventListener('input', function (): void {
        pageControl({ width: Number.parseInt(this.value) }, true)
    })

    paramId('i_pagegap').addEventListener('input', function (): void {
        pageControl({ gap: Number.parseFloat(this.value) }, true)
    })

    paramId('i_pagewidth').addEventListener('touchstart', () => moveElements(undefined, { overlay: true }), {
        passive: true,
    })
    paramId('i_pagewidth').addEventListener('mousedown', () => moveElements(undefined, { overlay: true }))
    paramId('i_pagewidth').addEventListener('touchend', () => moveElements(undefined, { overlay: false }))
    paramId('i_pagewidth').addEventListener('mouseup', () => moveElements(undefined, { overlay: false }))

    // Updates

    // Sync

    paramId('i_synctype').addEventListener('change', function (this): void {
        synchronization(undefined, { type: this.value })
    })

    paramId('f_gistsync').addEventListener('submit', function (this, event): void {
        event.preventDefault()
        synchronization(undefined, { gistToken: paramId('i_gistsync').value })
    })

    paramId('f_urlsync').addEventListener('submit', function (this, event): void {
        event.preventDefault()
        synchronization(undefined, { url: paramId('i_urlsync').value })
    })

    onclickdown(paramId('b_storage-persist'), async () => {
        const persists = await navigator.storage.persist()
        synchronization(undefined, { firefoxPersist: persists })
    })

    onclickdown(paramId('b_gistup'), () => {
        synchronization(undefined, { up: true })
    })

    onclickdown(paramId('b_gistdown'), () => {
        synchronization(undefined, { down: true })
    })

    onclickdown(paramId('b_urldown'), () => {
        synchronization(undefined, { down: true })
    })

    // Settings management

    paramId('settings-management').addEventListener('dragenter', () => {
        paramId('settings-management').classList.add('dragging-file')
    })

    paramId('file-import').addEventListener('dragleave', () => {
        paramId('settings-management').classList.remove('dragging-file')
    })

    paramId('b_file-load').addEventListener('click', function (this): void {
        paramId('file-import')?.click()
    })

    paramId('b_file-save').addEventListener('click', () => {
        downloadConfigurationFile()
    })

    paramId('file-import').addEventListener('change', function (this): void {
        loadConfigurationFile(this)
    })

    paramId('b_settings-copy').addEventListener('click', () => {
        copyConfigurationJson()
    })

    paramId('settings-data').addEventListener('input', (event) => {
        toggleSettingsChangesButtons(event.type)
    })

    paramId('settings-data').addEventListener('focus', (event) => {
        toggleSettingsChangesButtons(event.type)
    })

    paramId('settings-data').addEventListener('blur', (event) => {
        toggleSettingsChangesButtons(event.type)
    })

    onclickdown(paramId('b_settings-cancel'), () => {
        toggleSettingsChangesButtons('cancel')
    })

    onclickdown(paramId('b_settings-apply'), () => {
        const val = paramId('settings-data').value
        applyImportedConfiguration(parseSettingsFile(parse<unknown>(val)) ?? {})
    })

    // applies settings-data when cmd/ctrl + enter
    paramId('settings-data').addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            paramId('b_settings-apply').click()
        }
    })

    onclickdown(paramId('b_reset-first'), () => {
        resetSettings('first')
    })

    onclickdown(paramId('b_reset-apply'), () => {
        resetSettings('yes')
    })

    onclickdown(paramId('b_reset-cancel'), () => {
        resetSettings('no')
    })

    // Other

    if (IS_MOBILE) {
        const rangeInputs = document.querySelectorAll<HTMLInputElement>("input[type='range'")

        const reduceSettingsOpacity = (event: TouchEvent) => {
            document.getElementById('settings')?.classList.toggle('see-through', event.type === 'touchstart')
        }

        for (const input of rangeInputs) {
            input.addEventListener('touchstart', reduceSettingsOpacity, { passive: true })
            input.addEventListener('touchend', reduceSettingsOpacity, { passive: true })
        }
    }

    // TODO: drag event not working ?
    const fileInputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]')

    for (const input of fileInputs) {
        const toggleDrag = (_: DragEvent) => {
            input.classList.toggle('dragover')
        }

        input?.addEventListener('dragenter', toggleDrag)
        input?.addEventListener('dragleave', toggleDrag)
        input?.addEventListener('drop', toggleDrag)
    }

    const tooltips = document.querySelectorAll<HTMLElement>('.tooltip')

    for (const tooltip of tooltips) {
        onclickdown(tooltip, () => {
            const classes = [...tooltip.classList]
            const ttclass = classes.filter((cl) => cl.startsWith('tt'))[0]
            const tttext = document.querySelector(`.tooltiptext.${ttclass}`)

            tttext?.classList.toggle('shown')
        })
    }

    const splitRangeButtons = document.querySelectorAll<HTMLButtonElement>('.split-range button')

    for (const button of splitRangeButtons) {
        onclickdown(button, () => {
            button.classList.toggle('on')
        })
    }
}

function initDayCounterSettings(counters: DayCounter[]): void {
    const list = document.getElementById('day-counter-settings')
    if (!list) return
    list.replaceChildren()

    for (const counter of counters.slice(0, 2)) {
        list.append(createDayCounterSetting(counter))
    }
    updateDayCounterAddButton()
}

function updateDayCounterAddButton(): void {
    const button = document.getElementById('add-day-counter') as HTMLButtonElement | null
    const list = document.getElementById('day-counter-settings')
    if (button) button.disabled = (list?.children.length ?? 0) >= 2
}

function createDayCounterSetting(counter: DayCounter): HTMLElement {
    const row = document.createElement('div')
    const nameField = document.createElement('label')
    const nameLabel = document.createElement('span')
    const name = document.createElement('input')
    const dateField = document.createElement('label')
    const dateLabel = document.createElement('span')
    const date = document.createElement('input')
    const remove = document.createElement('button')

    row.className = 'day-counter-setting'
    nameLabel.className = 'trn'
    nameLabel.textContent = 'Name'
    name.type = 'text'
    name.maxLength = 32
    name.value = counter.label
    name.setAttribute('aria-label', tradThis('D-Day name'))
    nameField.append(nameLabel, name)
    dateLabel.className = 'trn'
    dateLabel.textContent = 'Start date'
    date.type = 'date'
    date.value = counter.date
    date.setAttribute('aria-label', tradThis('D-Day start date'))
    dateField.append(dateLabel, date)
    remove.type = 'button'
    remove.className = 'param-btn trn'
    remove.dataset.removeCounter = 'true'
    remove.textContent = tradThis('Remove')
    row.append(nameField, dateField, remove)
    traduction(row, settingsInitSync.lang)
    return row
}

function dataDayCounters(): DayCounter[] {
    return Array.from(document.querySelectorAll<HTMLElement>('.day-counter-setting')).map((row) => ({
        label: row.querySelector<HTMLInputElement>('input[type="text"]')?.value.trim() ?? '',
        date: row.querySelector<HTMLInputElement>('input[type="date"]')?.value ?? '',
    })).filter((counter) => counter.label && counter.date)
}

function saveDayCounterSettings(): void {
    configuredDayCounters = dataDayCounters().slice(0, 2)
    updateDayCounterAddButton()
    storage.sync.set({ dayCounters: configuredDayCounters })
    document.dispatchEvent(new CustomEvent('day-counters-update', { detail: configuredDayCounters }))
}

function initTimezone(data: Sync): void {
    const template = document.getElementById('timezones-select-template') as HTMLTemplateElement
    const timezone = document.querySelector<HTMLSelectElement>('#i_timezone')

    if (timezone) {
        timezone.appendChild(template.content.cloneNode(true))
        timezone.value = data.clock.timezone
    }
}
function translatePlaceholders(): void {
    const cases = [
        ['i_title', 'Name'],
        ['i_tabtitle', 'New tab'],
        ['i_sbrequest', 'Search query: %s'],
        ['i_sbplaceholder', 'Search'],
        ['css-editor-textarea', 'Type in your custom CSS'],
        ['i_importtext', 'or paste as text'],
        ['i_addlink-title', 'Title'],
        ['i_addlink-url', 'example.com'],
        ['i_qtlist', 'Author, Your quote.\nAuthor, Your second quote.'],
    ]

    for (const [id, text] of cases) {
        document.getElementById(id)?.setAttribute('placeholder', tradThis(text))
    }
}

function translateAriaLabels(): void {
    for (const element of document.querySelectorAll('[title]')) {
        const title = element.getAttribute('title') ?? ''

        element.setAttribute('title', tradThis(title))
        element.setAttribute('aria-label', tradThis(title))
    }
}

function localiseSiteLinks(): void {
    const siteLang = getLangForSite()

    if (siteLang === 'en') return

    for (const link of document.querySelectorAll<HTMLLinkElement>('a.site-link')) {
        const url = new URL(link.href)

        url.pathname = `/${siteLang}${url.pathname}`
        link.href = url.toString()
    }
}

async function switchLangs(nextLang: Langs): Promise<void> {
    await toggleTraduction(nextLang)
    const data = await storage.sync.get()
    const local = await storage.local.get(['quotesCache', 'userQuoteSelection'])

    data.lang = nextLang
    data.dayCounters = data.dayCounters.map((counter) =>
        defaultDayCounterLabels.has(counter.label) ? { ...counter, label: tradThis('New D-Day') } : counter
    )
    configuredDayCounters = data.dayCounters
    initDayCounterSettings(configuredDayCounters)
    document.documentElement.setAttribute('lang', nextLang)
    storage.sync.set({ lang: nextLang, dayCounters: data.dayCounters })
    document.dispatchEvent(new CustomEvent('day-counters-update', { detail: data.dayCounters }))
    storage.local.remove('quotesCache')

    clock(data)
    quotes({ sync: data, local })
    tabTitle(data.tabtitle)
    customFont(undefined, { lang: true })
    translatePlaceholders()
    translateAriaLabels()
}

function showall(val: boolean, event: boolean): void {
    document.getElementById('settings')?.classList.toggle('all', val)

    if (event) {
        storage.sync.set({ showall: val })
    }
}

// 	Mobile settings drawer bar

function settingsDrawerBar(): void {
    const drawerDragDebounce = debounce(() => {
        ;(document.getElementById('settings-footer') as HTMLDivElement).style.removeProperty('padding')
        drawerDragEvents()
    }, 600)

    globalThis.addEventListener('resize', () => {
        drawerDragDebounce()

        // removes transition to prevent weird movement when changing to mobile styling
        // /!\ this is dependent on settingsToggle() to remove inline styling /!\
        if (!document.getElementById('settings')?.style.transition) {
            document.getElementById('settings')?.setAttribute('style', 'transition: none')
        }
    })

    drawerDragEvents()
}

function drawerDragEvents(): void {
    const mobileDragZone = document.getElementById('mobile-drag-zone') as HTMLElement
    const settingsDom = document.getElementById('settings') as HTMLElement
    let settingsVh = -75
    let firstPos = 0
    let startTouchY = 0

    mobileDragZone?.addEventListener('touchstart', dragStart, {
        passive: false,
    })
    mobileDragZone?.addEventListener('pointerdown', dragStart, {
        passive: false,
    })

    function dragStart(e: Event): void {
        e.preventDefault()

        // prevents touchEvent and pointerEvent from firing at the same time
        if (settingsDom.classList.contains('dragging-mobile-settings')) {
            return
        }

        // Get mouse / touch y position
        if (e.type === 'pointerdown') {
            startTouchY = (e as MouseEvent).clientY
        }
        if (e.type === 'touchstart') {
            startTouchY = (e as TouchEvent).touches[0].clientY
        }

        // First time dragging, sets maximum y pos at which to block
        if (firstPos === 0) {
            firstPos = startTouchY
        }

        // Add mouse / touch moves events
        globalThis.addEventListener('touchmove', dragMove)
        globalThis.addEventListener('pointermove', dragMove)
        document.body.addEventListener('touchend', dragEnd)
        document.body.addEventListener('pointerup', dragEnd)

        document.body.classList.add('dragging-mobile-settings')
    }

    function dragMove(e: Event): void {
        let clientY = 0

        // Get mouse / touch y position
        if (e.type === 'pointermove') {
            clientY = (e as MouseEvent).clientY
        }
        if (e.type === 'touchmove') {
            clientY = (e as TouchEvent).touches[0].clientY
        }

        // element is below max height: move
        if (clientY > 60) {
            const touchPosition = clientY - 25
            const inverseHeight = 100 - (touchPosition / globalThis.innerHeight) * 100

            settingsVh = +inverseHeight.toFixed(2)
            settingsDom.style.transform = `translateY(-${settingsVh}dvh)`
            settingsDom.style.transition = 'transform .0s'
        }
    }

    function dragEnd(e: Event): void {
        let clientY = 0

        // Get mouse / touch y position
        if (e.type === 'pointerup') {
            clientY = (e as MouseEvent).clientY
        }
        if (e.type === 'touchend') {
            clientY = (e as TouchEvent).changedTouches[0].clientY
        }

        globalThis.removeEventListener('touchmove', dragMove)
        globalThis.removeEventListener('pointermove', dragMove)
        document.body.removeEventListener('touchend', dragEnd)
        document.body.removeEventListener('pointerup', dragEnd)

        startTouchY = 0

        const footer = document.getElementById('settings-footer') as HTMLDivElement
        footer.style.paddingBottom = `${100 - Math.abs(settingsVh)}dvh`

        settingsDom.style.removeProperty('padding')
        settingsDom.style.removeProperty('width')
        settingsDom.style.removeProperty('overflow')
        settingsDom.classList.remove('dragging')

        // small enough ? close settings
        if (clientY > globalThis.innerHeight - 100) {
            settingsToggle()
        }
    }
}

//	Settings management

function copyConfigurationJson(): void {
    const copybtn = document.querySelector('#b_settings-copy span')
    const pre = document.getElementById('settings-data') as HTMLTextAreaElement | null

    try {
        navigator.clipboard.writeText(pre?.value ?? '{}')

        if (copybtn) {
            copybtn.textContent = tradThis('Copied!')
            setTimeout(() => {
                copybtn.textContent = tradThis('Copy')
            }, 1000)
        }
    } catch (_error) {
        // ...
    }
}

async function downloadConfigurationFile(): Promise<void> {
    const a = document.getElementById('file-download')

    if (!a) {
        return
    }

    const date = new Date()
    const data = ((await storage.sync.get()) as Sync) ?? {}
    const zero = (n: number) => (n.toString().length === 1 ? `0${n}` : n.toString())
    const yyyymmdd = date.toISOString().slice(0, 10)
    const hhmmss = `${zero(date.getHours())}_${zero(date.getMinutes())}_${zero(date.getSeconds())}`

    const bytes = new TextEncoder().encode(serializeSettingsFile(data))
    const blob = new Blob([bytes], { type: 'application/json;charset=utf-8' })
    const href = URL.createObjectURL(blob)

    a.setAttribute('href', href)
    a.setAttribute('tabindex', '-1')
    a.setAttribute('download', `vitreous-settings ${yyyymmdd} ${hhmmss}.json`)
    a.click()
}

function loadConfigurationFile(target: HTMLInputElement): void {
    function decodeExportFile(str: string): unknown {
        let result: unknown = {}

        try {
            // Tries to decode base64 from previous versions
            result = parse<unknown>(atob(str)) ?? {}
        } catch {
            try {
                // If base64 failed, parse raw string
                result = parse<unknown>(str) ?? {}
            } catch (_) {
                // If all failed, return empty object
                result = {}
            }
        }

        return result
    }

    if (!target.files || (target.files && target.files.length === 0)) {
        return
    }

    const file = target.files[0]
    const reader = new FileReader()

    reader.onload = () => {
        if (typeof reader.result !== 'string') {
            return false
        }

        const importData = parseSettingsFile(decodeExportFile(reader.result))

        // data has at least one valid key from default sync storage => import
        if (importData && Object.keys(SYNC_DEFAULT).some((key) => key in importData)) {
            applyImportedConfiguration(importData)
        }
    }
    reader.readAsText(file)
}

async function applyImportedConfiguration(imported: Partial<Sync>): Promise<void> {
    try {
        let data = await storage.sync.get()

        // #308 - verify font subset before importing
        if (imported?.font?.system === false) {
            const family = imported?.font?.family
            const lang = imported?.lang
            const correctSubset = await fontIsAvailableInSubset(lang, family)

            if (correctSubset === false) {
                imported.font.family = ''
            }
        }

        if (imported?.searchbar?.on) {
            getPermissions('search')
        }

        data = filterData('import', data, imported)

        storage.sync.clear()
        storage.sync.set(data)

        if (imported?.backgrounds?.type === 'urls') {
            const urls = parseUrlList(imported.backgrounds.urls ?? '')

            if (urls.length > 0) {
                storage.local.set({ backgroundUrls: buildBackgroundUrls(urls) })
            }
        }

        fadeOut()
    } catch (_) {
        // ...
    }
}

function resetSettings(action: 'yes' | 'no' | 'first'): void {
    if (action === 'yes') {
        storage.clearall().then(fadeOut)
        return
    }

    document.getElementById('reset-first')?.classList.toggle('shown', action === 'no')
    document.getElementById('reset-conf')?.classList.toggle('shown', action === 'first')
}

export function updateConfigurationEditor(data?: Sync): void {
    try {
        data ? updateTextArea(data) : storage.sync.get().then(updateTextArea)
    } catch (err) {
        console.warn(err)
    }

    function updateTextArea(data: Sync): void {
        const pre = document.getElementById('settings-data') as HTMLTextAreaElement | null

        if (pre) {
            const orderedJson = serializeSettingsFile(data)
            pre.value = orderedJson
        }
    }
}

function updateSettingsEvent(): void {
    // On settings changes, update export code
    const storageUpdate = () => updateConfigurationEditor()
    const removeListener = () => chrome.storage.onChanged.removeListener(storageUpdate)

    if (PLATFORM === 'online') {
        globalThis.addEventListener('storage', storageUpdate)
    } else {
        chrome.storage.onChanged.addListener(storageUpdate)
        globalThis.addEventListener('beforeunload', removeListener, { once: true })
    }
}

async function toggleSettingsChangesButtons(action: string): Promise<void> {
    const textarea = paramId('settings-data')
    const data = await storage.sync.get()
    let hasChanges = false

    if (action === 'input') {
        const current = serializeSettingsFile(data)
        let user = ''

        try {
            const parsed = parseSettingsFile(JSON.parse(textarea.value ?? '{}'))
            if (parsed) user = serializeSettingsFile(parsed)
        } catch (_) {
            //
        }

        hasChanges = user.length > 2 && current !== user

        if (hasChanges) {
            paramId('b_settings-apply')?.removeAttribute('disabled')
        } else {
            paramId('b_settings-apply')?.setAttribute('disabled', '')
        }
    }

    if (action === 'cancel') {
        textarea.value = serializeSettingsFile(data)
        hasChanges = false
    }

    if (action === 'focus') {
        paramId('settings-files-options')?.classList.add('hidden')
        paramId('settings-changes-options')?.classList.remove('hidden')
    }

    if (action === 'blur') {
        paramId('settings-changes-options')?.classList.add('hidden')
        paramId('settings-files-options')?.classList.remove('hidden')
    }
}

// this needs to be implemented little by little to replace the billion "paramId('smth')?.classList.toggle('shown', true)" stuff
// doing it all at once is way too scary
export function toggleSettingsDropdown(dropdownId: string, shown: boolean): void {
    const dropdown = document.getElementById(dropdownId)

    if (!dropdown) {
        console.error(`Couldn't find settings dropdown to toggle: #${dropdownId}`)
        return
    }

    dropdown.classList.toggle('shown', shown)

    // makes inputs and selects non focusable when tabbing
    dropdown.querySelectorAll('input, select').forEach((el) => {
        if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
            el.disabled = !shown
        }
    })
}

//	Helpers

function paramId(str: string): HTMLInputElement {
    return document.getElementById(str) as HTMLInputElement
}

function setCheckbox(id: string, cat: boolean): void {
    const checkbox = paramId(id) as HTMLInputElement
    checkbox.checked = cat
}

function setInput(id: string, val: string | number): void {
    const input = paramId(id) as HTMLInputElement
    input.value = typeof val === 'string' ? val : val?.toString()
}

function setFormInput(id: string, defaults: string, value?: string): void {
    const input = paramId(id) as HTMLInputElement

    if (value) {
        input.value = value
        input.setAttribute('placeholder', value)
    } else {
        input.setAttribute('placeholder', defaults)
    }
}
