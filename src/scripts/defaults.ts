import { langList } from './langs.ts'

import type { Navigator } from '../types/shared.ts'
import type { Local } from '../types/local.ts'
import type { Sync } from '../types/sync.ts'

const navigator = globalThis.navigator as Navigator
const iosUA = 'iPad Simulator|iPhone Simulator|iPod Simulator|iPad|iPhone|iPod'.split('|')
const mobileUA = 'Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini'.split('|')

export const EXTENSION_NAME = 'Vitreous'
export const CURRENT_VERSION = '1.0.0'
export const ENVIRONNEMENT: 'PROD' | 'DEV' | 'TEST' = globalThis.ENV ?? 'TEST'

// attributes an ID to this tab to keep track of them
export const TAB_ID = crypto.randomUUID()
export const tabsBc = new BroadcastChannel('vitreous_tabs')

export const SYSTEM_OS = iosUA.includes(navigator.platform) ||
        (navigator.userAgent?.includes('Mac') && 'ontouchend' in document)
    ? 'ios'
    : navigator.appVersion?.includes('Macintosh')
    ? 'mac'
    : navigator.appVersion?.includes('Windows')
    ? 'windows'
    : navigator.userAgent?.toLowerCase()?.includes('android')
    ? 'android'
    : 'unknown'

export const PLATFORM = globalThis.location?.protocol === 'moz-extension:'
    ? 'firefox'
    : globalThis.location?.protocol === 'chrome-extension:'
    ? 'chrome'
    : globalThis.location?.protocol === 'safari-web-extension:'
    ? 'safari'
    : 'online'

export const BROWSER = navigator?.userAgentData?.brands.some((b) => b.brand === 'Microsoft Edge')
    ? 'edge'
    : navigator?.userAgentData?.brands.some((b) => b.brand === 'Opera')
    ? 'opera'
    : navigator?.userAgentData?.brands.some((b) => b.brand === 'Chromium')
    ? 'chrome'
    : navigator.userAgent?.toLowerCase()?.indexOf('firefox') > -1
    ? 'firefox'
    : navigator.userAgent?.toLowerCase()?.indexOf('safari') > -1
    ? 'safari'
    : 'other'

export const EXTENSION: typeof chrome | typeof browser | undefined = PLATFORM === 'online'
    ? undefined
    : PLATFORM === 'firefox'
    ? browser
    : chrome

export const IS_MOBILE = navigator.userAgentData
    ? navigator.userAgentData.mobile
    : mobileUA.some((ua) => navigator.userAgent.includes(ua))

const today = new Date()
const defaultDayCounterDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const DEFAULT_LANG = (() => {
    const locale = navigator.language?.replaceAll('_', '-').toLowerCase() ?? ''
    const exactLocale = Object.keys(langList).find((code) => code.toLowerCase() === locale)

    if (exactLocale) return exactLocale as keyof typeof langList
    if (locale.startsWith('zh')) return /tw|hk|hant/i.test(locale) ? 'zh-TW' : 'zh-CN'
    if (locale.startsWith('pt')) return 'pt-BR'
    if (locale.startsWith('nan')) return 'nan-Hant-TW'

    const baseLanguage = locale.split('-')[0]
    if (baseLanguage in langList) return baseLanguage as keyof typeof langList

    return 'en'
})()

// Countries that use imperial units (Fahrenheit): US, Liberia, Myanmar, some Caribbean islands
const DEFAULT_UNIT = (() => {
    const locale = navigator.language?.toLowerCase() ?? ''
    const imperialLocales = ['en-us', 'en-lr', 'my-mm', 'en-bs', 'en-bz', 'en-ky', 'en-pw']
    return imperialLocales.some((l) => locale.startsWith(l)) ? 'imperial' : 'metric'
})()

export const SEARCHBAR_ENGINES = [
    'default',
    'google',
    'ddg',
    'startpage',
    'qwant',
    'yahoo',
    'bing',
    'brave',
    'ecosia',
    'lilo',
    'baidu',
    'custom',
] as const

export const SYNC_DEFAULT: Sync = {
    about: {
        name: EXTENSION_NAME,
        browser: PLATFORM,
        version: CURRENT_VERSION,
    },
    advanced: {
        altMode: true,
        escKey: true,
    },
    showall: false,
    lang: 'ko',
    dark: 'system',
    favicon: '',
    tabtitle: '',
    pagegap: 1,
    pagewidth: 1600,
    time: true,
    main: false,
    dateformat: 'auto',
    quicklinks: true,
    textShadow: 0.2,
    announcements: 'major',
    review: 0,
    css: '',
    hide: { settingsicon: false },
    linkstyle: 'medium',
    linktitles: true,
    linkbackgrounds: true,
    linknewtab: false,
    linkiconradius: 1.1,
    linkgroups: {
        on: false,
        selected: 'default',
        groups: ['default'],
        pinned: [],
        synced: [],
    },
    backgrounds: {
        type: 'images',
        fadein: 600,
        blur: 5,
        bright: 0.8,
        frequency: 'pause',
        color: '#185A63',
        urls: '',
        images: 'picsum-images-daylight',
        videos: 'picsum-videos-daylight',
        mute: true,
        queries: {},
    },
    clock: {
        ampm: false,
        analog: false,
        seconds: false,
        ampmlabel: false,
        ampmposition: 'top-left',
        worldclocks: false,
        timezone: 'auto',
    },
    dayCounters: [{ label: 'D-Day', date: defaultDayCounterDate }],
    musicPlayer: true,
    analogstyle: {
        face: 'none',
        hands: 'modern',
        shape: 'round',
        border: '#ffff',
        background: '#fff2',
    },
    worldclocks: [],
    weather: {
        city: undefined,
        unit: DEFAULT_UNIT,
        show_unit: false,
        provider: '',
        moreinfo: 'none',
        forecast: 'auto',
        temperature: 'actual',
        geolocation: 'approximate',
    },
    notes: {
        on: false,
        width: 40,
        opacity: 0.1,
        align: 'left',
    },
    searchbar: {
        on: true,
        opacity: 0.1,
        newtab: false,
        suggestions: true,
        engine: 'google',
        request: '',
        placeholder: 'Search',
        width: 30,
    },
    quotes: {
        on: false,
        author: false,
        type: DEFAULT_LANG === 'zh-CN' ? 'hitokoto' : 'classic',
        frequency: 'day',
        last: undefined,
    },
    font: {
        family: 'Noto Sans KR',
        size: '14',
        system: false,
        color: '#ffffff',
        weightlist: ['100', '300', '400', '500', '700', '900'],
        weight: '400',
    },
    supporters: {
        enabled: true,
    },
    move: {
        selection: 'single',
        layouts: {},
    },
}

export const LOCAL_DEFAULT: Local = {
    syncType: PLATFORM === 'online' ? 'off' : 'browser',
    gistToken: '',
    userQuoteSelection: 0,
    translations: undefined,
    quotesCache: [],
    backgroundUrls: {},
    backgroundFiles: {},
    backgroundCollections: {},
    backgroundCompressFiles: true,
    backgroundLastChange: '',
    lastWeather: undefined,
}
