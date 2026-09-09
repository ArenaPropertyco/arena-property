import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import InactiveCalendarNotice from '~/components/InactiveCalendarNotice.vue'
import PendingWeeksNotice from '~/components/PendingWeeksNotice.vue'
import WeekBlockForm from '~/components/WeekBlockForm.vue'
import WeekBlocksList from '~/components/WeekBlocksList.vue'
import WeekCalendar from '~/components/WeekCalendar.vue'
import WeekQuota from '~/components/WeekQuota.vue'
import { formatearDia } from '#shared/dates/formato'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { clasificacionBase } from '#shared/scheduling/temporadas'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'
import { projectWeeks } from '#shared/scheduling/week-projection'
import type { WeekProjectionInput } from '#shared/scheduling/week-projection'
import type { UsageContext } from '#shared/scheduling/week-usage'

/**
 * HU-13 · RF-13.1b, RF-13.2, RF-13.3 · HU-14 · RF-14.1, RF-14.6, RF-14.7, RF-14.9 ·
 * HU-15 · RF-15.1, RF-15.4 · D-33 · RT-06 · principio 10 · los componentes del
 * calendario por semanas reciben la proyección y el contexto ya calculados y
 * emiten lo que el Propietario o el Administrador deciden. Ninguno calcula reglas.
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
      { fraction: 3, week: 24, confirmedAt: null, releasedAt: '2026-09-15T10:00:00Z', releaseReason: 'voluntary' },
      { fraction: 5, week: 1, confirmedAt: '2026-09-01T10:00:00Z', releasedAt: null, releaseReason: null },
    ],
    blocks: [{ week: 30, reason: 'Mantenimiento' }],
    selectionComplete: true,
    coOwners: [{ fraction: 3, name: 'Ana Ruiz' }, { fraction: 5, name: 'Luis Mora' }],
    ...changes,
  }
}

function context(changes: Partial<UsageContext> = {}): UsageContext {
  return { calendarActive: true, today: '2026-10-01', activatedOn: null, blockedWeeks: new Set([30]), ...changes }
}

describe('WeekCalendar', () => {
  it('RF-13.2 · RF-13.3 · RT-06 · las semanas propias, ajenas, bloqueadas y en renta se distinguen, con su temporada', async () => {
    const projection = projectWeeks(input())
    const calendario = await mountSuspended(WeekCalendar, { props: { cells: projection.cells, context: context() } })

    expect(calendario.findAll('[data-test^="semana-"]')).toHaveLength(rejilla.length)
    expect(calendario.find('[data-test="semana-0"]').attributes('data-tipo')).toBe('own')
    expect(calendario.find('[data-test="semana-0"]').attributes('data-estado')).toBe('confirmed')
    expect(calendario.find('[data-test="semana-0"]').attributes('data-temporada')).toBe('alta')
    expect(calendario.find('[data-test="semana-1"]').attributes('data-tipo')).toBe('other')
    expect(calendario.find('[data-test="semana-1"]').text()).toContain('Luis Mora')
    expect(calendario.find('[data-test="semana-30"]').attributes('data-tipo')).toBe('blocked')
    expect(calendario.find('[data-test="semana-30"]').text()).toContain('Mantenimiento')
    expect(calendario.find('[data-test="semana-24"]').attributes('data-tipo')).toBe('rented')
    expect(calendario.find('[data-test="semana-40"]').attributes('data-tipo')).toBe('pool')
  })

  it('CA-14.1 · una semana propia elegida ofrece confirmar y liberar, con su fecha límite, y emite la semana', async () => {
    const projection = projectWeeks(input())
    const calendario = await mountSuspended(WeekCalendar, { props: { cells: projection.cells, context: context() } })

    expect(calendario.find('[data-test="limite-8"]').text()).toContain(formatearDia('2026-12-29', 'es'))
    await calendario.find('[data-test="confirmar-8"]').trigger('click')
    expect(calendario.emitted('confirm')).toEqual([[8]])
    await calendario.find('[data-test="liberar-8"]').trigger('click')
    expect(calendario.emitted('release')).toEqual([[8]])
  })

  it('CA-14.5 · una semana confirmada se cancela a más de 30 días; dentro del plazo el botón se apaga y lo explica', async () => {
    const projection = projectWeeks(input())
    const lejos = await mountSuspended(WeekCalendar, { props: { cells: projection.cells, context: context() } })
    await lejos.find('[data-test="cancelar-0"]').trigger('click')
    expect(lejos.emitted('cancel')).toEqual([[0]])

    const cerca = await mountSuspended(WeekCalendar, { props: { cells: projectWeeks(input({ today: '2026-12-20' })).cells, context: context({ today: '2026-12-20' }) } })
    expect(cerca.find('[data-test="cancelar-0"]').attributes('disabled')).toBeDefined()
    expect(cerca.find('[data-test="motivo-0"]').text()).toContain('30 días')
  })

  it('RF-13.1b · en solo lectura ninguna semana ofrece acciones', async () => {
    const projection = projectWeeks(input({ calendarActive: false }))
    const calendario = await mountSuspended(WeekCalendar, {
      props: { cells: projection.cells, context: context({ calendarActive: false }), readOnly: projection.readOnly },
    })
    expect(calendario.find('[data-test="semana-8"]').attributes('data-tipo')).toBe('own')
    expect(calendario.find('[data-test="confirmar-8"]').exists()).toBe(false)
    expect(calendario.find('[data-test="cancelar-0"]').exists()).toBe(false)
  })
})

describe('WeekQuota', () => {
  it('CA-13.1 · muestra confirmadas, por confirmar y liberadas frente al criterio', async () => {
    const projection = projectWeeks(input())
    const cupo = await mountSuspended(WeekQuota, { props: { quota: projection.quota } })
    expect(cupo.find('[data-test="cupo-alta"]').text()).toContain('1 confirmadas')
    expect(cupo.find('[data-test="cupo-baja"]').text()).toContain('1 liberadas')
    expect(cupo.find('[data-test="cupo-baja"]').text()).toContain('de 3')
  })
})

describe('PendingWeeksNotice', () => {
  it('RF-14.9 · avisa cuántas semanas faltan por confirmar y cuándo vence la más próxima', async () => {
    const aviso = await mountSuspended(PendingWeeksNotice, { props: { pending: [{ week: 8, deadline: '2026-12-29' }], nextDeadline: '29 dic 2026' } })
    expect(aviso.find('[data-test="semanas-pendientes"]').text()).toContain('1 semanas')
    expect(aviso.find('[data-test="semanas-pendientes"]').text()).toContain('29 dic 2026')
  })

  it('RF-14.9 · sin pendientes lo dice', async () => {
    const aviso = await mountSuspended(PendingWeeksNotice, { props: { pending: [], nextDeadline: '' } })
    expect(aviso.find('[data-test="todo-confirmado"]').exists()).toBe(true)
  })
})

describe('InactiveCalendarNotice', () => {
  it('RF-13.1b · avisa del calendario inactivo con el saldo pendiente y el enlace al plan', async () => {
    const aviso = await mountSuspended(InactiveCalendarNotice, { props: { saldo: pesos(35_000_000), planId: 'plan-1' } })
    expect(aviso.find('[data-test="calendario-inactivo"]').exists()).toBe(true)
    expect(aviso.find('[data-test="saldo-pendiente"]').text()).toContain(formatearImporte(pesos(35_000_000), 'es'))
    expect(aviso.find('[data-test="ver-plan"]').exists()).toBe(true)
  })
})

describe('WeekBlockForm', () => {
  it('CA-15.1 · sin motivo no emite y lo explica', async () => {
    const formulario = await mountSuspended(WeekBlockForm, { props: { rejilla, classification, blocked: [], today: '2027-01-01', enviando: false } })
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.find('[data-test="campo-bloqueo-motivo"]').text()).toContain('motivo')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('RF-15.1 · con motivo y semanas emite el bloqueo', async () => {
    const formulario = await mountSuspended(WeekBlockForm, { props: { rejilla, classification, blocked: [], today: '2027-01-01', enviando: false } })
    await formulario.find('[data-test="motivo-bloqueo"]').setValue('Mantenimiento de piscina')
    // Las semanas se eligen en el selector múltiple; en la prueba se fijan en el estado del componente.
    ;(formulario.vm as unknown as { estado: { weeks: number[] } }).estado.weeks = [25, 24]
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toEqual([[[24, 25], 'Mantenimiento de piscina']])
  })
})

describe('WeekBlocksList', () => {
  it('CA-15.3 · muestra el conflicto con la semana confirmada y levanta con motivo', async () => {
    const lista = await mountSuspended(WeekBlocksList, {
      props: {
        bloqueos: [{ id: 'b1', week: 25, startsOn: '2027-06-26', endsOn: '2027-07-03', season: 'baja', reason: 'Obra en la cubierta', createdAt: '2027-01-01T12:00:00Z', liftedAt: null, conflicts: [{ fraction: 2, week: 25 }] }],
        ocupadoId: null,
      },
    })

    expect(lista.find('[data-test="conflicto-b1-2"]').text()).toContain('2/8')
    expect(lista.find('[data-test="conflicto-b1-2"]').text()).toContain('26')

    await lista.find('[data-test="formulario-levantar-b1"]').trigger('submit')
    await flushPromises()
    expect(lista.emitted('levantar')).toBeUndefined()
    await lista.find('[data-test="motivo-levantar-b1"]').setValue('Fin de obra')
    await lista.find('[data-test="formulario-levantar-b1"]').trigger('submit')
    await flushPromises()
    expect(lista.emitted('levantar')).toEqual([['b1', 'Fin de obra']])
  })
})
