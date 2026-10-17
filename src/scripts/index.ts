import { altMode, darkmode, favicon, pageControl, tabTitle, textShadow } from './features/others.ts'
import { synchronization } from './features/synchronization/index.ts'
import { backgroundsInit } from './features/backgrounds/index.ts'
import { moveElements } from './features/move/index.ts'
import { hideElements } from './features/hide.ts'
import { customFont } from './features/fonts.ts'
import { quickLinks } from './features/links/index.ts'
import { searchbar } from './features/searchbar.ts'
import { customCss } from './features/css.ts'
import { quotes } from './features/quotes.ts'
import { dayCounters } from './features/day-counters.ts'
import { musicPlayer } from './features/music-player.ts'
import { clock } from './features/clock/index.ts'
import './features/contextmenu.ts'

import { displayInterface, onInterfaceDisplay } from './shared/display.ts'
import { setTranslationCache, traduction } from './utils/translations.ts'
import { setPotatoComputerMode } from './startup/potato.ts'
import { userDate } from './shared/time.ts'
import { onlineAndMobile } from './startup/online.ts'
import { serviceWorker } from './startup/serviceworker.ts'
import { tabsTracking } from './startup/tabstracking.ts'
import { settingsInit } from './settings.ts'
import { userActions } from './events.ts'
import { filterData } from './compatibility/apply.ts'
import { storage } from './storage.ts'

import { BROWSER, CURRENT_VERSION, LOCAL_DEFAULT, PLATFORM, SYNC_DEFAULT, SYSTEM_OS } from './defaults.ts'

try {
    startup()
    serviceWorker()
    onlineAndMobile()
} catch (_) {
    console.warn('Startup failed')
}

async function startup(): Promise<void> {
    let { sync, local } = await storage.init()
    const oldVersion = sync?.about?.version

    if (!sync || !local) {
        console.warn('Storage failed, loading Vitreous with default settings')
        sync = structuredClone(SYNC_DEFAULT)
        local = structuredClone(LOCAL_DEFAULT)
    }

    if (oldVersion !== CURRENT_VERSION) {
        console.info(`Updated Vitreous, ${oldVersion} => ${CURRENT_VERSION}`)

        localStorage.setItem('update-archive', JSON.stringify(sync))

        sync = filterData('update', sync)

        local.translations = undefined
        storage.local.remove('translations')
        local = { ...LOCAL_DEFAULT, ...local }

        // <!> do not move
        // <!> must delete old keys before upgrading storage
        await storage.sync.clear()
        await storage.sync.set(sync)
    }

    await setTranslationCache(sync.lang, local)

    displayInterface(undefined, sync)
    traduction(null, sync.lang)
    userDate(sync.clock.timezone)
    customFont(sync.font)
    textShadow(sync.textShadow)
    favicon(sync.favicon)
    tabTitle(sync.tabtitle)
    clock(sync)
    dayCounters(sync.dayCounters)
    musicPlayer(sync.musicPlayer)
    darkmode(sync.dark)
    searchbar(sync.searchbar)
    quotes({ sync, local })
    moveElements(sync.move)
    customCss(sync.css)
    hideElements(sync.hide)
    backgroundsInit(sync, local, true)
    quickLinks({ sync, local })
    synchronization(local)
    settingsInit(sync, local)
    pageControl({ width: sync.pagewidth, gap: sync.pagegap })
    tabsTracking()

    if (sync.advanced.altMode) {
        altMode()
    }

    document.documentElement.dataset.system = SYSTEM_OS as string
    document.documentElement.dataset.browser = BROWSER as string
    document.documentElement.dataset.platform = PLATFORM as string

    document.getElementById('time')?.classList.toggle('hidden', !sync.time)

    onInterfaceDisplay(() => {
        document.body.classList.remove('init')

        setPotatoComputerMode()
        userActions(sync.advanced)
    })
}
