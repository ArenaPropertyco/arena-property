import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import CalendarViewSwitch from '~/components/CalendarViewSwitch.vue'
import WeekAlmanac from '~/components/WeekAlmanac.vue'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { clasificacionBase } from '#shared/scheduling/temporadas'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'
import { projectPropertyWeeks, projectWeeks } from '#shared/scheduling/week-projection'
import type { WeekProjectionInput } from '#shared/scheduling/week-projection'
import type { UsageContext } from '#shared/scheduling/week-usage'

/**
 * HU-13 · RF-13.2, RF-13.3 · HU-14 · RF-14.1 · RT-06 · principio 10 — el almanaque
 * pinta los doce meses con cada día teñido por su semana; tocar un día muestra la
 * misma tarjeta que la lista vertical, con sus acciones, en una ventana emergente
 * (que Reka UI monta en `document.body`). El interruptor deja a quien mira elegir
 * entre las dos vistas.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const rejilla = rejillaDelAnio(2027)
const classification: SemanaClasificada[] = clasificacionBase(rejilla).map(s => ({
  ...s,
  temporada: s.indice < 8 ? 'alta' : s.indice < 16 ? 'media_alta' : s.indice < 24 ? 'media' : 'baja',
}))

function input(changes: Partial<WeekProjectionInput> = {}): WeekProjectionInput {
  return {
    today: '2026-10-01',
    ownFraction: 3,
    calendarActive: true,
    activatedOn: null,
    rejilla,
    classification,
    allocations: [
      { fraction: 3, week: 0, confirmedAt: '2026-09-01T10:00:00Z', releasedAt: null, releaseReason: null },
      { fraction: 3, week: 8, confirmedAt: null, releasedAt: null, releaseReason: null },
      { fraction: 5, week: 1, confirmedAt: '2026-09-01T10:00:00Z', releasedAt: null, releaseReason: null },
    ],
    blocks: [{ week: 30, reason: 'Mantenimiento' }],
    selectionComplete: true,
    coOwners: [{ fraction: 3, name: 'Ana Ruiz' }, { fraction: 5, name: 'Luis Mora' }],
    ...changes,
  }
}

const context: UsageContext = { calendarActive: true, today: '2026-10-01', activatedOn: null, blockedWeeks: new Set([30]) }

/** La ventana emergente se monta fuera del componente: se busca en el documento. */
const ventana = () => document.body.querySelector('[data-test="semana-elegida"]')
const enVentana = (selector: string) => ventana()?.querySelector(selector) ?? null

describe('WeekAlmanac', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('RF-13.2 · RT-06 · doce meses, y cada día lleva el tipo de la semana en que cae', async () => {
    const almanaque = await mountSuspended(WeekAlmanac, { props: { anio: 2027, cells: projectWeeks(input()).cells, context } })

    expect(almanaque.findAll('[data-test^="almanaque-2027-"]')).toHaveLength(12)
    expect(almanaque.find('[data-test="almanaque-2027-01"]').text()).toContain('enero')
    // El 1 de enero de 2027 queda fuera de la rejilla (D-42); el 2 abre la semana 1, propia y confirmada.
    expect(almanaque.find('[data-test="dia-2027-01-01"]').attributes('disabled')).toBeDefined()
    expect(almanaque.find('[data-test="dia-2027-01-02"]').attributes('data-tipo')).toBe('own')
    expect(almanaque.find('[data-test="dia-2027-01-09"]').attributes('data-tipo')).toBe('other')
    expect(ventana()).toBeNull()
  })

  it('CA-14.1 · tocar un día muestra su semana con la misma tarjeta y sus acciones, y emite la semana', async () => {
    const cells = projectWeeks(input()).cells
    const almanaque = await mountSuspended(WeekAlmanac, { props: { anio: 2027, cells, context } })
    const semana8 = cells.find(cell => cell.week === 8)!

    await almanaque.find(`[data-test="dia-${semana8.startsOn}"]`).trigger('click')
    await flushPromises()
    expect(enVentana('[data-test="semana-8"]')?.getAttribute('data-tipo')).toBe('own')
    expect(enVentana('[data-test="estado-8"]')?.textContent).toBe('Por confirmar')
    expect(almanaque.find(`[data-test="dia-${semana8.startsOn}"]`).attributes('aria-pressed')).toBe('true')

    ;(enVentana('[data-test="confirmar-8"]') as HTMLButtonElement).click()
    expect(almanaque.emitted('confirm')).toEqual([[8]])

    // Liberar abre el aviso de la página: la ventana se cierra antes.
    ;(enVentana('[data-test="liberar-8"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(almanaque.emitted('release')).toEqual([[8]])
    expect(ventana()).toBeNull()
  })

  it('RF-13.1b · D-31 · en solo lectura la tarjeta elegida no ofrece acciones', async () => {
    const cells = projectWeeks(input({ calendarActive: false })).cells
    const almanaque = await mountSuspended(WeekAlmanac, { props: { anio: 2027, cells, context: { ...context, calendarActive: false }, readOnly: true } })

    await almanaque.find(`[data-test="dia-${cells[8]!.startsOn}"]`).trigger('click')
    await flushPromises()
    expect(enVentana('[data-test="semana-8"]')).not.toBeNull()
    expect(enVentana('[data-test="confirmar-8"]')).toBeNull()
  })

  it('RF-14.1 · en gestión la semana elegida dice de qué fracción es y admite operar en nombre del titular', async () => {
    const cells = projectPropertyWeeks({
      today: '2026-10-01',
      rejilla,
      classification,
      allocations: input().allocations,
      blocks: input().blocks,
      selectionComplete: true,
      coOwners: [{ fraction: 3, name: 'Ana Ruiz', calendarActive: true }, { fraction: 5, name: 'Luis Mora', calendarActive: true }],
    }).cells
    const almanaque = await mountSuspended(WeekAlmanac, { props: { anio: 2027, cells, context, gestion: true } })

    await almanaque.find(`[data-test="dia-${cells[0]!.startsOn}"]`).trigger('click')
    await flushPromises()
    expect(enVentana('[data-test="semana-0"]')?.textContent).toContain('Fracción 3/8 · Ana Ruiz')
    ;(enVentana('[data-test="cancelar-0"]') as HTMLButtonElement).click()
    expect(almanaque.emitted('cancel')).toEqual([[0]])
  })
})

describe('CalendarViewSwitch', () => {
  it('RT-06 · alterna entre lista y almanaque y lo anuncia', async () => {
    const interruptor = await mountSuspended(CalendarViewSwitch, { props: { 'modelValue': false, 'onUpdate:modelValue': (valor: boolean) => interruptor.setProps({ modelValue: valor }) } })

    expect(interruptor.find('[data-test="vista-calendario"]').text()).toContain('Lista por semanas')
    await interruptor.find('button[role="switch"]').trigger('click')
    expect(interruptor.emitted('update:modelValue')).toEqual([[true]])
    expect(interruptor.find('[data-test="vista-calendario"]').text()).toContain('Almanaque')
  })
})
