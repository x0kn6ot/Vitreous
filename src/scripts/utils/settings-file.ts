import type { Link } from '../../types/shared.ts'
import type { Backgrounds, DayCounter, Font, Move, Sync } from '../../types/sync.ts'

interface SettingsFile {
    format: 'vitreous-settings'
    schemaVersion: 1
    general: {
        language: string
        theme: Sync['dark']
        showAllSettings: boolean
        page: { width: number; gap: number }
        font: Font
        textShadow: number
        favicon: string
        tabTitle: string
        hideSettingsIcon: boolean
        customCss: string
    }
    background: {
        mode: Exclude<Backgrounds['type'], 'videos'>
        changeInterval: Backgrounds['frequency']
        fadeDuration: number
        brightness: number
        blur: number
        color: string
        imageSource: string
        customUrls: string
        searchQueries: Record<string, string>
    }
    clock: {
        enabled: boolean
        use12Hour: boolean
        showAmPm: boolean
        amPmPosition: Sync['clock']['ampmposition']
        showSeconds: boolean
        timezone: string
        dateFormat: Sync['dateformat']
        visibility: 'all' | 'clock' | 'date'
    }
    dayCounters: DayCounter[]
    musicPlayer: { enabled: boolean }
    search: {
        enabled: boolean
        width: number
        opacity: number
        openInNewTab: boolean
        suggestions: boolean
        engine: string
        customRequest: string
        placeholder: string
        background?: string
    }
    dock: {
        enabled: boolean
        style: Sync['linkstyle']
        showTitles: boolean
        showBackgrounds: boolean
        openInNewTab: boolean
        iconRadius: number
        shortcuts: Link[]
    }
    quotes: {
        enabled: boolean
        showAuthor: boolean
        type: Sync['quotes']['type']
        frequency: Sync['quotes']['frequency']
        userList?: string
        url?: string
    }
    layout: {
        columns: Move['selection']
        widgets: Move['layouts']
    }
    advanced: {
        alternateMode: boolean
        escapeClosesSettings: boolean
    }
}

interface LegacySettingsFile {
    format: 'dambi-startpage-settings'
    schemaVersion: 1
    general?: SettingsFile['general']
    background?: Record<string, unknown>
    clock?: Record<string, unknown>
    dayCounters?: DayCounter[]
    musicPlayer?: { enabled?: boolean }
    search?: Record<string, unknown>
    dock?: Record<string, unknown>
    advanced?: Record<string, unknown>
}

export function serializeSettingsFile(data: Partial<Sync>): string {
    const backgroundMode = data.backgrounds?.type === 'videos' ? 'images' : data.backgrounds?.type ?? 'images'
    const visibility = data.hide?.clock ? 'date' : data.hide?.date ? 'clock' : 'all'
    const file: SettingsFile = {
        format: 'vitreous-settings',
        schemaVersion: 1,
        general: {
            language: data.lang ?? 'ko',
            theme: data.dark ?? 'system',
            showAllSettings: data.showall ?? false,
            page: { width: data.pagewidth ?? 1600, gap: data.pagegap ?? 1 },
            font: data.font ?? { family: '', size: '14', weight: '400', weightlist: [] },
            textShadow: data.textShadow ?? 0,
            favicon: data.favicon ?? '',
            tabTitle: data.tabtitle ?? '',
            hideSettingsIcon: data.hide?.settingsicon ?? false,
            customCss: data.css ?? '',
        },
        background: {
            mode: backgroundMode,
            changeInterval: data.backgrounds?.frequency ?? 'pause',
            fadeDuration: data.backgrounds?.fadein ?? 600,
            brightness: data.backgrounds?.bright ?? 0.8,
            blur: data.backgrounds?.blur ?? 0,
            color: data.backgrounds?.color ?? '#185A63',
            imageSource: data.backgrounds?.images ?? '',
            customUrls: data.backgrounds?.urls ?? '',
            searchQueries: data.backgrounds?.queries ?? {},
        },
        clock: {
            enabled: data.time ?? true,
            use12Hour: data.clock?.ampm ?? false,
            showAmPm: data.clock?.ampmlabel ?? false,
            amPmPosition: data.clock?.ampmposition ?? 'top-left',
            showSeconds: data.clock?.seconds ?? false,
            timezone: data.clock?.timezone ?? 'auto',
            dateFormat: data.dateformat ?? 'auto',
            visibility,
        },
        dayCounters: (data.dayCounters ?? []).slice(0, 2),
        musicPlayer: { enabled: data.musicPlayer ?? true },
        search: {
            enabled: data.searchbar?.on ?? true,
            width: data.searchbar?.width ?? 30,
            opacity: data.searchbar?.opacity ?? 0.1,
            openInNewTab: data.searchbar?.newtab ?? false,
            suggestions: data.searchbar?.suggestions ?? true,
            engine: data.searchbar?.engine ?? 'google',
            customRequest: data.searchbar?.request ?? '',
            placeholder: data.searchbar?.placeholder ?? 'Search',
            background: data.searchbar?.background,
        },
        dock: {
            enabled: data.quicklinks ?? true,
            style: data.linkstyle ?? 'medium',
            showTitles: data.linktitles ?? false,
            showBackgrounds: data.linkbackgrounds ?? true,
            openInNewTab: data.linknewtab ?? false,
            iconRadius: data.linkiconradius ?? 1.1,
            shortcuts: Object.entries(data)
                .filter(([key]) => key.length === 11 && key.startsWith('links'))
                .map(([, value]) => value as Link)
                .sort((first, second) => first.order - second.order),
        },
        quotes: {
            enabled: data.quotes?.on ?? false,
            showAuthor: data.quotes?.author ?? false,
            type: data.quotes?.type ?? 'classic',
            frequency: data.quotes?.frequency ?? 'day',
            userList: data.quotes?.userlist,
            url: data.quotes?.url,
        },
        layout: {
            columns: data.move?.selection ?? 'single',
            widgets: data.move?.layouts ?? {},
        },
        advanced: {
            alternateMode: data.advanced?.altMode ?? true,
            escapeClosesSettings: data.advanced?.escKey ?? true,
        },
    }

    return JSON.stringify(file, null, 2)
}

export function parseSettingsFile(value: unknown): Partial<Sync> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const input = value as Record<string, unknown>

    if (input.format === 'dambi-startpage-settings') return parseLegacySettings(input)
    if (input.format === 'vitreous-settings') return parseVitreousSettings(input)
    if (typeof input.format === 'string') return null

    const supportedKeys = new Set([
        'advanced', 'showall', 'time', 'quicklinks', 'pagegap', 'pagewidth', 'linkiconradius', 'linkstyle',
        'linknewtab', 'linktitles', 'linkbackgrounds', 'textShadow', 'css', 'lang', 'favicon', 'tabtitle',
        'hide', 'dark', 'dateformat', 'backgrounds', 'clock', 'dayCounters', 'musicPlayer', 'searchbar',
        'quotes', 'font', 'move', 'linksrow',
    ])
    const supported = Object.fromEntries(
        Object.entries(input).filter(([key]) => supportedKeys.has(key) || /^links.{6}$/.test(key)),
    )
    if (supported.backgrounds && typeof supported.backgrounds === 'object') {
        const backgrounds = { ...(supported.backgrounds as Record<string, unknown>) }
        if (backgrounds.type === 'videos') {
            backgrounds.type = 'images'
            delete backgrounds.videos
            delete backgrounds.mute
        }
        supported.backgrounds = backgrounds
    }
    if (Array.isArray(supported.dayCounters)) supported.dayCounters = supported.dayCounters.slice(0, 2)
    if (input.hide && typeof input.hide === 'object') {
        const hide = input.hide as Record<string, unknown>
        supported.hide = { settingsicon: hide.settingsicon, clock: hide.clock, date: hide.date }
    }
    return removeUndefined(supported) as Partial<Sync>
}

function parseVitreousSettings(input: Record<string, unknown>): Partial<Sync> | null {
    if (input.schemaVersion !== 1) return null
    const file = input as unknown as SettingsFile
    const output: Partial<Sync> = {
        lang: file.general?.language,
        dark: file.general?.theme,
        showall: file.general?.showAllSettings,
        pagewidth: file.general?.page?.width,
        pagegap: file.general?.page?.gap,
        font: file.general?.font,
        textShadow: file.general?.textShadow,
        favicon: file.general?.favicon,
        tabtitle: file.general?.tabTitle,
        hide: { settingsicon: file.general?.hideSettingsIcon },
        css: file.general?.customCss,
        backgrounds: file.background ? {
            type: file.background.mode,
            frequency: file.background.changeInterval,
            fadein: file.background.fadeDuration,
            bright: file.background.brightness,
            blur: file.background.blur,
            color: file.background.color,
            images: file.background.imageSource,
            urls: file.background.customUrls,
            mute: true,
            queries: file.background.searchQueries,
        } as Backgrounds : undefined,
        time: file.clock?.enabled,
        clock: file.clock ? {
            ampm: file.clock.use12Hour,
            analog: false,
            seconds: file.clock.showSeconds,
            timezone: file.clock.timezone,
            ampmlabel: file.clock.showAmPm,
            ampmposition: file.clock.amPmPosition,
            worldclocks: false,
        } : undefined,
        dateformat: file.clock?.dateFormat,
        dayCounters: file.dayCounters?.slice(0, 2),
        musicPlayer: file.musicPlayer?.enabled,
        searchbar: file.search ? {
            on: file.search.enabled,
            width: file.search.width,
            opacity: file.search.opacity,
            newtab: file.search.openInNewTab,
            suggestions: file.search.suggestions,
            engine: file.search.engine,
            request: file.search.customRequest,
            placeholder: file.search.placeholder,
            background: file.search.background,
        } : undefined,
        quicklinks: file.dock?.enabled,
        linkstyle: file.dock?.style,
        linktitles: file.dock?.showTitles,
        linkbackgrounds: file.dock?.showBackgrounds,
        linknewtab: file.dock?.openInNewTab,
        linkiconradius: file.dock?.iconRadius,
        quotes: file.quotes ? {
            on: file.quotes.enabled,
            author: file.quotes.showAuthor,
            type: file.quotes.type,
            frequency: file.quotes.frequency,
            userlist: file.quotes.userList,
            url: file.quotes.url,
        } : undefined,
        move: file.layout ? { selection: file.layout.columns, layouts: file.layout.widgets } : undefined,
        advanced: file.advanced ? {
            altMode: file.advanced.alternateMode,
            escKey: file.advanced.escapeClosesSettings,
        } : undefined,
    }
    output.hide = {
        settingsicon: file.general?.hideSettingsIcon,
        clock: file.clock?.visibility === 'date' ? true : undefined,
        date: file.clock?.visibility === 'clock' ? true : undefined,
    }
    for (const link of file.dock?.shortcuts ?? []) {
        if (link && typeof link === 'object' && typeof link._id === 'string') output[link._id] = link
    }
    return removeUndefined(output) as Partial<Sync>
}

function parseLegacySettings(input: Record<string, unknown>): Partial<Sync> | null {
    if (input.schemaVersion !== 1) return null
    const file = input as unknown as LegacySettingsFile
    const background = file.background as Record<string, unknown> | undefined
    const clock = file.clock as Record<string, unknown> | undefined
    const search = file.search as Record<string, unknown> | undefined
    const dock = file.dock as Record<string, unknown> | undefined
    const advanced = file.advanced as Record<string, unknown> | undefined
    const legacy = file as unknown as Record<string, unknown>
    const output: Partial<Sync> = {
        lang: file.general?.language,
        dark: file.general?.theme,
        pagewidth: file.general?.page?.width,
        pagegap: file.general?.page?.gap,
        font: file.general?.font,
        textShadow: file.general?.textShadow,
        favicon: file.general?.favicon,
        tabtitle: file.general?.tabTitle,
        hide: { settingsicon: file.general?.hideSettingsIcon },
        css: file.general?.customCss,
        backgrounds: background ? {
            type: background.mode === 'videos' ? 'images' : background.mode,
            frequency: background.changeInterval,
            fadein: background.fadeDuration,
            bright: background.brightness,
            blur: background.blur,
            color: background.color,
            images: background.imageSource,
            urls: background.customUrls,
            mute: true,
            queries: background.searchQueries,
        } as Backgrounds : undefined,
        time: clock?.enabled as boolean | undefined,
        clock: clock ? {
            ampm: clock.use12Hour as boolean,
            analog: false,
            seconds: clock.showSeconds as boolean,
            timezone: clock.timezone as string,
            ampmlabel: false,
            worldclocks: false,
        } : undefined,
        dateformat: clock?.dateFormat as Sync['dateformat'] | undefined,
        dayCounters: Array.isArray(file.dayCounters) ? file.dayCounters.slice(0, 2) : undefined,
        musicPlayer: (file.musicPlayer?.enabled ?? true),
        searchbar: search ? {
            on: search.enabled as boolean,
            width: search.width as number,
            opacity: search.opacity as number,
            newtab: search.openInNewTab as boolean,
            suggestions: search.suggestions as boolean,
            engine: search.engine as string,
            request: search.customRequest as string,
            placeholder: search.placeholder as string,
            background: search.background as string | undefined,
        } : undefined,
        quicklinks: dock?.enabled as boolean | undefined,
        linkstyle: dock?.style as Sync['linkstyle'] | undefined,
        linktitles: dock?.showTitles as boolean | undefined,
        linkbackgrounds: dock?.showBackgrounds as boolean | undefined,
        linknewtab: dock?.openInNewTab as boolean | undefined,
        linkiconradius: dock?.iconRadius as number | undefined,
        advanced: advanced ? {
            altMode: advanced.alternateMode as boolean,
            escKey: advanced.escapeClosesSettings as boolean,
        } : undefined,
    }
    for (const link of (dock?.shortcuts as Link[] | undefined) ?? []) {
        if (link && typeof link === 'object' && typeof link._id === 'string') output[link._id] = link
    }
    const clockVisibility = legacy.clock as { visibility?: string } | undefined
    if (clockVisibility?.visibility === 'date') output.hide = { ...output.hide, clock: true }
    if (clockVisibility?.visibility === 'clock') output.hide = { ...output.hide, date: true }
    return removeUndefined(output) as Partial<Sync>
}

function removeUndefined(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(removeUndefined)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(
        Object.entries(value)
            .filter(([, child]) => child !== undefined)
            .map(([key, child]) => [key, removeUndefined(child)]),
    )
}
