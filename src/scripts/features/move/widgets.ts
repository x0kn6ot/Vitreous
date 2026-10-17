import { addOverlay, removeOverlay, removeSelection, setAllAligns, setGridAreas } from './dom.ts'
import { toggleSettingsDropdown } from '../../settings.ts'
import { transitioner } from '../../utils/transitioner.ts'
import { storage } from '../../storage.ts'
import {
    addGridWidget,
    getLayout,
    gridParse,
    gridStringify,
    isEditing,
    removeGridWidget,
    updateWidgetsStorage,
} from './helpers.ts'

import type { Widgets } from '../../../types/shared.ts'
import type { Sync } from '../../../types/sync.ts'

export function toggleWidget(data: Sync, widget: [Widgets, boolean]): void {
    if (!widget) {
        return
    }

    const [id, on] = widget
    const gridToggle = on ? addGridWidget : removeGridWidget
    const interfaceTransition = transitioner()
    const selection = data.move.selection
    const layout = getLayout(data)
    const grid = gridParse(gridToggle(gridStringify(layout.grid), id, selection))

    data.move.layouts[selection] = { items: layout.items, grid: grid }
    const newdata = updateWidgetsStorage([widget], data)
    storage.sync.set(newdata)
    const domids: { [key in Widgets]: string } = {
        time: 'time',
        main: 'main',
        quicklinks: 'linkblocks',
        quotes: 'quotes_container',
        searchbar: 'sb_container',
    }
    const target = document.getElementById(domids[id])

    interfaceTransition.first(() => {
        toggleWidgetInSettings([[id, on]])
        if (target) {
            target.style.transition = 'opacity 200ms cubic-bezier(.215,.61,.355,1)'
            target.style.opacity = '0'
        }
    })

    interfaceTransition.after(() => {
        const layout = getLayout(newdata)
        setGridAreas(layout.grid)
        setAllAligns(layout.items)
        toggleWidgetOnInterface([[id, on]])
        if (on && target) {
            target.style.opacity = '0'
            requestAnimationFrame(() => {
                target.style.opacity = '1'
            })
        }
        removeSelection()

        // add/remove widget overlay only when editing move
        if (isEditing()) {
            on ? addOverlay(id) : removeOverlay(id)
        }
    })

    interfaceTransition.finally(() => {
        if (target) {
            setTimeout(() => {
                target.style.removeProperty('opacity')
                target.style.removeProperty('transition')
            }, 200)
        }
    })

    interfaceTransition.transition(200)
}

export function toggleWidgetInSettings(states: [Widgets, boolean][]): void {
    const inputids: { [key in Widgets]: string } = {
        time: 'i_time',
        main: 'i_main',
        quicklinks: 'i_quicklinks',
        quotes: 'i_quotes',
        searchbar: 'i_sb',
    }

    for (const [widget, on] of states) {
        const input = document.getElementById(inputids[widget]) as HTMLInputElement
        input.checked = on

        toggleSettingsDropdown(`${widget}_options`, on)
    }
}

export function toggleWidgetOnInterface(states: [Widgets, boolean][]): void {
    const domids: { [key in Widgets]: string } = {
        time: 'time',
        main: 'main',
        quicklinks: 'linkblocks',
        quotes: 'quotes_container',
        searchbar: 'sb_container',
    }

    for (const [widget, on] of states) {
        const elem = document.getElementById(domids[widget]) as HTMLElement
        elem?.classList.toggle('hidden', !on)
    }
}
