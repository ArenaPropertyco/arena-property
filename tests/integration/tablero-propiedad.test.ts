import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import FractionQuotaTable from '~/components/FractionQuotaTable.vue'
import PanelCollapsible from '~/components/PanelCollapsible.vue'
import WeekCalendar from '~/components/WeekCalendar.vue'
import WeekLegend from '~/components/WeekLegend.vue'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { clasificacionBase } from '#shared/scheduling/temporadas'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'
import { projectPropertyWeeks } from '#shared/scheduling/week-projection'
import type { PropertyProjectionInput } from '#shared/scheduling/week-projection'
import type { UsageContext } from '#shared/scheduling/week-usage'

/**
 * HU-13 · RF-13.3 · HU-14 · RF-14.1, RF-14.6, RF-14.7 · RT-06 · principio 10 — el
 * calendario del Administrador se pliega por secciones y reutiliza el tablero
 * por semanas del Propietario en modo gestión: cada semana dice de qué fracción
 * es y en qué estado está, y admite confirmar, cancelar o liberar en su nombre.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const rejilla = rejillaDelAnio(2027)
const classification: SemanaClasificada[] = clasificacionBase(rejilla).map(s => ({
  ...s,
  temporada: s.indice < 8 ? 'alta' : s.indice < 16 ? 'media_alta' : s.indice < 24 ? 'media' : 'baja',
}))

function entrada(changes: Partial<PropertyProjectionInput> = {}): PropertyProjectionInput {
  return {
    today: '2026-10-01',
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
    coOwners: [{ fraction: 3, name: 'Ana Ruiz', calendarActive: true }, { fraction: 5, name: 'Luis Mora', calendarActive: false }],
    ...changes,
  }
}

const context: UsageContext = { calendarActive: true, today: '2026-10-01', activatedOn: null, blockedWeeks: new Set([30]) }

describe('PanelCollapsible', () => {
  it('RT-06 · nace plegada y la flecha del encabezado la despliega', async () => {
    const tarjeta = await mountSuspended(PanelCollapsible, {
      props: { nombre: 'rejilla', titulo: 'Rejilla de 2027', descripcion: 'Semanas de sábado a sábado' },
      slots: { default: () => 'contenido de la rejilla', extra: () => 'anuncio' },
    })

    const boton = tarjeta.find('[data-test="plegar-rejilla"]')
    expect(boton.text()).toContain('Rejilla de 2027')
    expect(boton.text()).toContain('Semanas de sábado a sábado')
    expect(boton.attributes('data-state')).toBe('closed')

    await boton.trigger('click')

    expect(tarjeta.find('[data-test="plegar-rejilla"]').attributes('data-state')).toBe('open')
    expect(tarjeta.find('[data-test="contenido-rejilla"]').text()).toContain('contenido de la rejilla')
  })

  it('puede nacer desplegada', async () => {
    const tarjeta = await mountSuspended(PanelCollapsible, {
      props: { nombre: 'cupo', titulo: 'Cupo', abiertaAlInicio: true },
      slots: { default: () => 'tablero' },
    })

    expect(tarjeta.find('[data-test="plegar-cupo"]').attributes('data-state')).toBe('open')
  })
})

describe('WeekCalendar · gestión', () => {
  it('RF-13.3 · cada semana con dueño dice de qué fracción es y en qué estado está', async () => {
    const { cells } = projectPropertyWeeks(entrada())
    const tablero = await mountSuspended(WeekCalendar, { props: { cells, context, gestion: true } })

    expect(tablero.findAll('[data-test^="semana-"]')).toHaveLength(rejilla.length)
    expect(tablero.find('[data-test="semana-0"]').text()).toContain('Fracción 3/8 · Ana Ruiz')
    expect(tablero.find('[data-test="estado-0"]').text()).toBe('Confirmada')
    expect(tablero.find('[data-test="estado-8"]').text()).toBe('Por confirmar')
    expect(tablero.find('[data-test="semana-24"]').attributes('data-tipo')).toBe('released')
    expect(tablero.find('[data-test="semana-30"]').attributes('data-tipo')).toBe('blocked')
  })

  it('RF-14.1 · RF-14.6 · RF-14.7 · ofrece confirmar y liberar la elegida, cancelar la confirmada, y emite la semana', async () => {
    const { cells } = projectPropertyWeeks(entrada())
    const tablero = await mountSuspended(WeekCalendar, { props: { cells, context, gestion: true } })

    await tablero.find('[data-test="cancelar-0"]').trigger('click')
    expect(tablero.emitted('cancel')).toEqual([[0]])
    await tablero.find('[data-test="confirmar-8"]').trigger('click')
    expect(tablero.emitted('confirm')).toEqual([[8]])
    await tablero.find('[data-test="liberar-8"]').trigger('click')
    expect(tablero.emitted('release')).toEqual([[8]])
  })

  it('D-31 · la fracción con calendario inactivo se ve y no se toca', async () => {
    const { cells } = projectPropertyWeeks(entrada())
    const tablero = await mountSuspended(WeekCalendar, { props: { cells, context, gestion: true } })

    expect(tablero.find('[data-test="semana-1"]').text()).toContain('Luis Mora')
    expect(tablero.find('[data-test="cancelar-1"]').exists()).toBe(false)
  })

  it('fuera de gestión la semana ajena sigue sin acciones', async () => {
    const { cells } = projectPropertyWeeks(entrada())
    const tablero = await mountSuspended(WeekCalendar, { props: { cells, context } })

    expect(tablero.find('[data-test="cancelar-0"]').exists()).toBe(false)
    expect(tablero.find('[data-test="estado-0"]').exists()).toBe(false)
  })
})

describe('WeekLegend · gestión', () => {
  it('no habla de «mis semanas» y llama a la semana con dueño por lo que es', async () => {
    const leyenda = await mountSuspended(WeekLegend, { props: { gestion: true } })

    expect(leyenda.find('[data-test="leyenda-own"]').exists()).toBe(false)
    expect(leyenda.find('[data-test="leyenda-other"]').text()).toContain('De una fracción')
  })
})

describe('FractionQuotaTable', () => {
  it('RF-13.2 · una fila por fracción con su titular y el cupo por temporada; sin titular lo dice', async () => {
    const { quotaByFraction } = projectPropertyWeeks(entrada())
    const tabla = await mountSuspended(FractionQuotaTable, {
      props: {
        cupo: quotaByFraction,
        fracciones: [
          { number: 3, ownerName: 'Ana Ruiz', calendarActive: true },
          { number: 5, ownerName: 'Luis Mora', calendarActive: false },
          { number: 7, ownerName: null, calendarActive: false },
        ],
      },
    })

    const fila = (numero: number) => tabla.findAll('tbody tr').find(tr => tr.find(`[data-test="cupo-fraccion-${numero}"]`).exists())!

    expect(tabla.findAll('[data-test^="cupo-fraccion-"]')).toHaveLength(3)
    expect(fila(3).text()).toContain('Ana Ruiz')
    expect(fila(3).text()).toContain('1 confirmadas · 0 por confirmar · 0 liberadas · de 1')
    expect(fila(3).text()).toContain('0 confirmadas · 0 por confirmar · 1 liberadas · de 3')
    expect(fila(5).text()).toContain('Calendario inactivo')
    expect(fila(7).text()).toContain('Sin titular')
    expect(fila(7).text()).toContain('—')
  })
})
