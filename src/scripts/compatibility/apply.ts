import { removeLinkgroupDuplicates, removeWorldClocksDuplicate, toggleMoveWidgets } from './filters.ts'
import { CURRENT_VERSION, EXTENSION_NAME, PLATFORM, SYNC_DEFAULT } from '../defaults.ts'
import { filterByVersion } from './versions.ts'
import { deepmergeAll } from '@victr/deepmerge'
import { toSemVer } from '../utils/semver.ts'
import type { Sync } from '../../types/sync.ts'

/**
 * 1. Add condition for the latest version in versions.ts
 * 2. Create needed filters for this version in filters.ts
 * 3. Export these filters in your condition
 */

export function filterData(from: 'update', current: Sync): Sync
export function filterData(from: 'import', current: Sync, target: Partial<Sync>): Sync
export function filterData(from: 'update' | 'import', current: Sync, target?: Partial<Sync>): Sync {
    let newcurrent = current
    let newtarget = target ?? {}

    if (from === 'update') {
        const user = toSemVer(newcurrent.about.version)
        newcurrent = filterByVersion(newcurrent, user) as Sync
    }

    if (from === 'import') {
        // Prepare imported data compatibility
        newtarget = filterByVersion(newtarget, toSemVer(undefined))

        // Detect if merging between settings is needed
        const currentKeyAmount = Object.keys(newcurrent).length
        const targetKeyAmount = Object.keys(newtarget).length
        const needMerging = targetKeyAmount !== currentKeyAmount

        if (needMerging) {
            newcurrent = deepmergeAll(newcurrent, newtarget) as Sync

            // After merge only
            newcurrent = removeLinkgroupDuplicates(newcurrent)
            newcurrent = removeWorldClocksDuplicate(newcurrent, newtarget)
            newcurrent = toggleMoveWidgets(newcurrent, newtarget)
        } else {
            newcurrent = newtarget as Sync
        }

        if (Array.isArray(newtarget.dayCounters)) {
            newcurrent.dayCounters = structuredClone(newtarget.dayCounters)
        }
    }

    //

    newcurrent.about = {
        name: EXTENSION_NAME,
        browser: PLATFORM,
        version: CURRENT_VERSION,
    }

    delete newcurrent.syncbookmarks
    delete newcurrent.settingssync
    delete newcurrent.custom_every
    delete newcurrent.custom_time
    delete newcurrent.searchbar_newtab
    delete newcurrent.searchbar_newtab
    delete newcurrent.searchbar_engine
    delete newcurrent.cssHeight
    delete newcurrent.linktabs
    delete newcurrent.links
    delete newcurrent.dynamic
    delete newcurrent.unsplash
    delete newcurrent.background_blur
    delete newcurrent.background_bright
    delete newcurrent.background_type
    delete newcurrent.usdate
    //@ts-ignore -> Property '...' does not exist on type '...'
    delete newcurrent?.weather?.location
    //@ts-ignore -> Property '...' does not exist on type '...'
    delete newcurrent?.weather?.lastState
    //@ts-ignore -> Property '...' does not exist on type '...'
    delete newcurrent?.weather?.lastCall

    const validCounters = Array.isArray(newcurrent.dayCounters)
        ? newcurrent.dayCounters.filter((counter) => {
            if (!counter || typeof counter !== 'object') return false
            const { label, date } = counter
            if (typeof label !== 'string' || !label.trim() || typeof date !== 'string') return false
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
            const [year, month, day] = date.split('-').map(Number)
            const parsed = new Date(Date.UTC(year, month - 1, day))
            return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
        })
        : []
    newcurrent.dayCounters = !Array.isArray(newcurrent.dayCounters)
        ? structuredClone(SYNC_DEFAULT.dayCounters)
        : newcurrent.dayCounters.length === 0
        ? []
        : validCounters.length
        ? validCounters.slice(0, 2)
        : structuredClone(SYNC_DEFAULT.dayCounters)

    if (newcurrent.backgrounds.type === 'videos') {
        newcurrent.backgrounds.type = 'images'
        newcurrent.backgrounds.images = 'picsum-images-daylight'
    }
    if (newcurrent.backgrounds.type === 'images' && !newcurrent.backgrounds.images.startsWith('picsum-images-')) {
        newcurrent.backgrounds.images = 'picsum-images-daylight'
    }

    return newcurrent
}
