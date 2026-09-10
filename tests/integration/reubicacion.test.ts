import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import RelocationTurnStatus from '~/components/RelocationTurnStatus.vue'
import SelectionWindowForm from '~/components/SelectionWindowForm.vue'
import SelectionWindowTurns from '~/components/SelectionWindowTurns.vue'
import WeekRelocationForm from '~/components/WeekRelocationForm.vue'
import { formatearInstante } from '#shared/dates/formato'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { defaultWindowOpening, relocationTurnOf, RELOCATION_TURN_HOURS, RELOCATION_WINDOW_DAYS, windowClosesAt } from '#shared/scheduling/relocation'
import type { RelocationContext, RelocationWindowConfig } from '#shared/scheduling/relocation'
import { clasificacionBase } from '#shared/scheduling/temporadas'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'
import type { SelectionWindowListed } from '#shared/scheduling/vistas'
import type { AllocationState } from '#shared/scheduling/week-projection'

/**
 * HU-59 · RF-59.1, RF-59.3, RF-59.6 · D-36 · RT-06 · principio 10 · los
 * componentes de la ventana de reubicación reciben la ventana, el instante y el
 * calendario ocupado ya resueltos, y emiten lo que el Superadmin o el Propietario
 * deciden. Ninguno calcula reglas: las trae `shared/scheduling/relocation`.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const ANIO = 2027
const rejilla = rejillaDelAnio(ANIO)
const classification: SemanaClasificada[] = clasificacionBase(rejilla).map(s => ({
  ...s,
  temporada: s.indice < 8 ? 'alta' : s.indice < 16 ? 'media_alta' : s.indice < 24 ? 'media' : 'baja',
}))

const fractions = [
  { number: 3, ownerName: 'Ana Ruiz' },
  { number: 1, ownerName: 'Luis Mora' },
  { number: 2, ownerName: null },
]

const opensAt = defaultWindowOpening(ANIO)
const base = { opensAt, durationDays: RELOCATION_WINDOW_DAYS, turnHours: RELOCATION_TURN_HOURS, order: [3, 1, 2], closedAt: null }
const window: SelectionWindowListed = {
  id: 'w1',
  ...base,
  closesAt: windowClosesAt(base),
  turns: [
    { fraction: 3, position: 0, opensAt: '2026-10-01T05:00:00.000Z', closesAt: '2026-10-03T05:00:00.000Z', ownerName: 'Ana Ruiz' },
    { fraction: 1, position: 1, opensAt: '2026-10-03T05:00:00.000Z', closesAt: '2026-10-05T05:00:00.000Z', ownerName: 'Luis Mora' },
    { fraction: 2, position: 2, opensAt: '2026-10-05T05:00:00.000Z', closesAt: '2026-10-07T05:00:00.000Z', ownerName: null },
  ],
}

function allocation(fraction: number, week: number, extra: Partial<AllocationState> = {}): AllocationState {
  return { fraction, week, confirmedAt: null, releasedAt: null, releaseReason: null, ...extra }
}

function context(changes: Partial<RelocationContext> = {}): RelocationContext {
  return {
    rejilla,
    classification,
    allocations: [
      allocation(1, 0, { confirmedAt: '2026-09-01T10:00:00Z' }),
      allocation(1, 8),
      allocation(1, 24),
      allocation(2, 25),
    ],
    blockedWeeks: new Set([26]),
    today: '2026-10-04',
    calendarActive: true,
    turn: relocationTurnOf(window, 1, '2026-10-04T05:00:00.000Z'),
    ...changes,
  }
}

describe('SelectionWindowForm', () => {
  it('RF-59.1 · P-12 · sin ventana propone el 1 de octubre del año anterior, 16 días y 48 horas, y emite la configuración', async () => {
    const formulario = await mountSuspended(SelectionWindowForm, {
      props: { window: null, fractions, suggestedOrder: [3, 1, 2], anio: ANIO, enviando: false },
    })

    expect((formulario.find('[data-test="ventana-apertura"]').element as HTMLInputElement).value).toBe('2026-10-01T00:00')
    expect((formulario.find('[data-test="ventana-duracion"]').element as HTMLInputElement).value).toBe('16')
    expect((formulario.find('[data-test="ventana-turno"]').element as HTMLInputElement).value).toBe('48')

    await formulario.find('form').trigger('submit')
    await flushPromises()
    const emitida = formulario.emitted('submit')?.[0]?.[0] as RelocationWindowConfig
    expect(emitida).toEqual({ opensAt, durationDays: 16, turnHours: 48, order: [3, 1, 2] })
  })

  it('RF-59.1 · P-13 · una duración de cero días no se emite y se explica; «sugerir» pide el orden', async () => {
    const formulario = await mountSuspended(SelectionWindowForm, {
      props: { window: null, fractions, suggestedOrder: [3, 1, 2], anio: ANIO, enviando: false },
    })

    await formulario.find('[data-test="ventana-duracion"]').setValue('0')
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-ventana-duracion"]').text()).toContain('al menos un día')

    await formulario.find('[data-test="sugerir-orden"]').trigger('click')
    expect(formulario.emitted('sugerir')).toHaveLength(1)
  })

  it('RF-59.2 · con la ventana ya guardada muestra su orden y sus valores', async () => {
    const formulario = await mountSuspended(SelectionWindowForm, {
      props: { window: { ...window, durationDays: 10, turnHours: 24 }, fractions, suggestedOrder: [], anio: ANIO, enviando: false },
    })
    expect((formulario.find('[data-test="ventana-duracion"]').element as HTMLInputElement).value).toBe('10')
    expect(formulario.findAll('[data-test^="turno-"]').map(li => li.attributes('data-test'))).toEqual(['turno-3', 'turno-1', 'turno-2'])
  })
})

describe('SelectionWindowTurns', () => {
  it('RF-59.6 · muestra la fase y el estado de cada turno ahora mismo, y el cierre emite', async () => {
    const turnos = await mountSuspended(SelectionWindowTurns, {
      props: { window, now: '2026-10-04T05:00:00.000Z', canClose: true, cerrando: false },
    })

    expect(turnos.find('[data-test="ventana-fase"]').attributes('data-fase')).toBe('turns')
    expect(turnos.find('[data-test="turno-ventana-3"]').attributes('data-estado')).toBe('after')
    expect(turnos.find('[data-test="turno-ventana-1"]').attributes('data-estado')).toBe('own')
    expect(turnos.find('[data-test="turno-ventana-2"]').attributes('data-estado')).toBe('before')
    expect(turnos.find('[data-test="turno-ventana-1"]').text()).toContain('Luis Mora')

    await turnos.find('[data-test="cerrar-ventana"]').trigger('click')
    expect(turnos.emitted('cerrar')).toHaveLength(1)
  })

  it('CA-59.7 · cerrada, lo dice con la fecha y no ofrece cerrar', async () => {
    const cerrada = { ...window, closedAt: '2026-10-06T12:00:00.000Z' }
    const turnos = await mountSuspended(SelectionWindowTurns, {
      props: { window: cerrada, now: '2026-10-06T13:00:00.000Z', canClose: true, cerrando: false },
    })
    expect(turnos.find('[data-test="ventana-fase"]').attributes('data-fase')).toBe('closed')
    expect(turnos.find('[data-test="ventana-fase"]').text()).toContain(formatearInstante('2026-10-06T12:00:00.000Z', 'es'))
    expect(turnos.find('[data-test="cerrar-ventana"]').exists()).toBe(false)
  })
})

describe('RelocationTurnStatus', () => {
  it('RF-59.3 · en turno dice hasta cuándo, cuánto falta y qué semanas se pueden mover', async () => {
    const estado = await mountSuspended(RelocationTurnStatus, {
      props: { turn: relocationTurnOf(window, 1, '2026-10-04T05:00:00.000Z'), anio: ANIO, movable: [8, 24] },
    })
    expect(estado.find('[data-test="estado-turno"]').attributes('data-estado')).toBe('own')
    expect(estado.find('[data-test="estado-turno"]').text()).toContain(formatearInstante('2026-10-05T05:00:00.000Z', 'es'))
    expect(estado.find('[data-test="tiempo-restante"]').text()).toContain('1 d 0 h 0 min')
    expect(estado.find('[data-test="semanas-movibles"]').text()).toContain('9, 25')
  })

  it('CA-59.5 · antes de su turno dice cuándo abre y a quién espera, sin ofrecer mover', async () => {
    const estado = await mountSuspended(RelocationTurnStatus, {
      props: { turn: relocationTurnOf(window, 1, '2026-10-02T05:00:00.000Z'), anio: ANIO, movable: [8, 24] },
    })
    expect(estado.find('[data-test="estado-turno"]').attributes('data-estado')).toBe('before')
    expect(estado.find('[data-test="estado-turno"]').text()).toContain('fracción 3')
    expect(estado.find('[data-test="semanas-movibles"]').exists()).toBe(false)
  })

  it('CA-59.7 · cerrada la ventana, lo dice y no cuenta nada', async () => {
    const estado = await mountSuspended(RelocationTurnStatus, {
      props: { turn: relocationTurnOf(window, 1, '2026-10-20T05:00:00.000Z'), anio: ANIO, movable: [] },
    })
    expect(estado.find('[data-test="estado-turno"]').attributes('data-estado')).toBe('closed')
    expect(estado.find('[data-test="tiempo-restante"]').exists()).toBe(false)
  })
})

describe('WeekRelocationForm', () => {
  it('RF-59.3 · solo ofrece mover las semanas propias elegidas; sin destino no emite y lo explica', async () => {
    const formulario = await mountSuspended(WeekRelocationForm, { props: { fraction: 1, context: context(), enviando: false } })

    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="errores-reubicacion"]').exists()).toBe(true)
  })

  it('CA-59.2 · con origen y destino de la misma temporada emite el movimiento', async () => {
    const formulario = await mountSuspended(WeekRelocationForm, { props: { fraction: 1, context: context(), enviando: false } })
    // Los selectores se resuelven con el motor; en la prueba se fija el estado del componente.
    const vm = formulario.vm as unknown as { estado: { from: number | null, to: number | null } }
    vm.estado.from = 24
    await flushPromises()
    vm.estado.to = 40
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toEqual([[24, 40]])
  })

  it('CA-59.3 · CA-59.4 · un destino ocupado o una semana confirmada se rechazan con su motivo', async () => {
    const formulario = await mountSuspended(WeekRelocationForm, { props: { fraction: 1, context: context(), enviando: false } })
    const vm = formulario.vm as unknown as { estado: { from: number | null, to: number | null } }
    vm.estado.from = 24
    await flushPromises()
    vm.estado.to = 25
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.find('[data-test="error-week_taken"]').text()).toContain('fracción 2')

    vm.estado.from = 0
    await flushPromises()
    vm.estado.to = 3
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.find('[data-test="error-week_locked"]').exists()).toBe(true)
    expect(formulario.emitted('submit')).toBeUndefined()
  })
})
