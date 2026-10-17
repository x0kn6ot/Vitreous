import type { DayCounter } from '../../types/sync.ts'

const dayMilliseconds = 24 * 60 * 60 * 1000
const today = new Date()
const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const defaultCounters: DayCounter[] = [{ label: 'D-Day', date: defaultDate }]

function validCounters(counters: unknown): DayCounter[] {
    if (!Array.isArray(counters)) return defaultCounters
    if (counters.length === 0) return []
    const valid = counters.filter((counter): counter is DayCounter => {
        if (!counter || typeof counter.label !== 'string' || !counter.label.trim()) return false
        if (typeof counter.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(counter.date)) return false
        const [year, month, day] = counter.date.split('-').map(Number)
        const date = new Date(Date.UTC(year, month - 1, day))
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    })
    return valid.length ? valid.slice(0, 2) : defaultCounters
}

let currentCounters: DayCounter[] = []
let counterContainer: HTMLElement | null = null

export function dayCounters(counters: DayCounter[] = []): void {
    const time = document.getElementById('time')

    if (!time) {
        return
    }

    currentCounters = validCounters(counters)
    counterContainer = document.getElementById('day-counters')

    if (!counterContainer) {
        counterContainer = document.createElement('div')
        counterContainer.id = 'day-counters'
        counterContainer.setAttribute('aria-label', 'Day counters')
        document.body.append(counterContainer)
    }

    const positionCounters = (): void => {
        if (!counterContainer) return
        const clockBounds = time.getBoundingClientRect()
        const isClockHidden = clockBounds.height === 0
        const top = isClockHidden ? getComputedStyle(time).top : `${clockBounds.bottom + 16}px`
        if (counterContainer.style.top === top) return
        counterContainer.style.setProperty('top', top)
        document.dispatchEvent(new Event('day-counters-resized'))
    }

    const render = (previousCounters: DayCounter[] = currentCounters): void => {
        if (!counterContainer) return
        counterContainer.replaceChildren()
        counterContainer.classList.toggle('empty', currentCounters.length === 0)
        const previousKeys = new Set(previousCounters.map(({ label, date }) => `${label}\u0000${date}`))

        for (const counter of currentCounters) {
            const card = document.createElement('div')
            const label = document.createElement('span')
            const value = document.createElement('span')

            card.className = 'day-counter'
            if (!previousKeys.has(`${counter.label}\u0000${counter.date}`)) {
                card.classList.add('day-counter-enter')
            }
            label.className = 'day-counter-label'
            value.className = 'day-counter-value'
            label.textContent = counter.label
            value.dataset.startDate = counter.date
            card.append(label, value)
            counterContainer.append(card)
        }
        positionCounters()
    }

    render()
    window.addEventListener('resize', positionCounters)
    new ResizeObserver(positionCounters).observe(time)

    document.addEventListener(
        'day-counters-update',
        ((event: CustomEvent<DayCounter[]>) => {
            const previousCounters = currentCounters
            currentCounters = validCounters(event.detail)
            render(previousCounters)
            update()
            document.dispatchEvent(new Event('day-counters-resized'))
        }) as EventListener,
    )

    let timer: number | undefined

    const update = (): void => {
        const now = new Date()
        const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())

        for (const value of counterContainer?.querySelectorAll<HTMLElement>('.day-counter-value') ?? []) {
            const date = value.dataset.startDate

            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                continue
            }

            const [year, month, day] = date.split('-').map(Number)
            const start = Date.UTC(year, month - 1, day)
            if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== date) {
                value.textContent = ''
                continue
            }
            const elapsed = Math.floor((today - start) / dayMilliseconds)
            value.textContent = `+${elapsed.toLocaleString()}`
        }

        window.clearTimeout(timer)
        const nextMidnight = new Date()
        nextMidnight.setHours(24, 0, 0, 0)
        timer = window.setTimeout(update, nextMidnight.getTime() - now.getTime() + 1000)
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            update()
        }
    })

    update()
}
