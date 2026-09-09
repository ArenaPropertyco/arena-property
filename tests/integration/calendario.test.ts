import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import CalendarPicker from '~/components/CalendarPicker.vue'
import SeasonClassifier from '~/components/SeasonClassifier.vue'
import SelectionOrderEditor from '~/components/SelectionOrderEditor.vue'
import SelectedWeeksList from '~/components/SelectedWeeksList.vue'
import SelectionProgress from '~/components/SelectionProgress.vue'
import SwapRequestsList from '~/components/SwapRequestsList.vue'
import WeekSelectionForm from '~/components/WeekSelectionForm.vue'
import WeekSwapForm from '~/components/WeekSwapForm.vue'
import { formatearDia } from '#shared/dates/formato'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { turnOf } from '#shared/scheduling/selection'
import type { SelectionTurn } from '#shared/scheduling/selection'
import type { AllocationEntry } from '#shared/scheduling/swaps'
import { BLOQUES_PICO, clasificacionBase, sugerirBloquesPico } from '#shared/scheduling/temporadas'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'
import type { SelectionTurnListed } from '#shared/scheduling/vistas'

/**
 * HU-12 · RF-12.2…RF-12.6 · D-32 · principio 10 · la pantalla del calendario se
 * compone de componentes que reciben la rejilla, la clasificación, los turnos y
 * las semanas elegidas, y emiten lo que el Administrador o el Propietario
 * deciden. Ninguno calcula reglas: las trae `shared/scheduling`.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const ANIO = 2027
const rejilla = rejillaDelAnio(ANIO)

/** 8 altas (con los 3 picos), 8 media-altas, 8 medias y el resto bajas. */
function clasificacionValida(): SemanaClasificada[] {
  const picos = sugerirBloquesPico(ANIO, rejilla)
  const altas = new Set<number>([picos.christmas, picos.new_year, picos.holy_week])
  for (let i = 0; altas.size < 8; i++) altas.add(i)
  let ma = 0
  let me = 0
  return clasificacionBase(rejilla).map((s) => {
    if (altas.has(s.indice)) return { ...s, temporada: 'alta', bloquePico: BLOQUES_PICO.find(b => picos[b] === s.indice) ?? null }
    if (ma++ < 8) return { ...s, temporada: 'media_alta', bloquePico: null }
    if (me++ < 8) return { ...s, temporada: 'media', bloquePico: null }
    return { ...s, temporada: 'baja', bloquePico: null }
  })
}

function turnos(selected: Record<number, number> = {}): SelectionTurn[] {
  return [3, 1, 2].map((fraction, position) => ({ fraction, position, hasOwner: true, selectedWeeks: selected[fraction] ?? 0 }))
}

describe('SeasonClassifier', () => {
  it('RF-12.2 · clasificar una semana emite la clasificación completa con el cambio', async () => {
    const clasificador = await mountSuspended(SeasonClassifier, {
      props: { rejilla, clasificacion: clasificacionBase(rejilla), editable: true },
    })

    await clasificador.find('[data-test="semana-3-alta"]').trigger('click')
    const emitida = clasificador.emitted('update:clasificacion')?.[0]?.[0] as SemanaClasificada[]
    expect(emitida.find(s => s.indice === 3)).toEqual({ indice: 3, temporada: 'alta', bloquePico: null })
    expect(emitida.filter(s => s.temporada === 'alta')).toHaveLength(1)
  })

  it('P-06 · el bloque pico solo se ofrece en semanas altas y se emite al marcarlo', async () => {
    const base = clasificacionBase(rejilla)
    base[5] = { indice: 5, temporada: 'alta', bloquePico: null }
    const clasificador = await mountSuspended(SeasonClassifier, { props: { rejilla, clasificacion: base, editable: true } })

    expect(clasificador.find('[data-test="pico-4-christmas"]').exists()).toBe(false)
    await clasificador.find('[data-test="pico-5-christmas"]').trigger('click')
    const emitida = clasificador.emitted('update:clasificacion')?.[0]?.[0] as SemanaClasificada[]
    expect(emitida.find(s => s.indice === 5)?.bloquePico).toBe('christmas')
  })

  it('el resumen cuenta las semanas por temporada frente a las que exige el criterio', async () => {
    const clasificador = await mountSuspended(SeasonClassifier, {
      props: { rejilla, clasificacion: clasificacionValida(), editable: true },
    })

    expect(clasificador.find('[data-test="resumen-alta"]').text()).toContain('8')
    expect(clasificador.find('[data-test="resumen-baja"]').text()).toContain('28')
  })
})

describe('WeekSelectionForm', () => {
  const clasificacion = clasificacionValida()
  const altas = clasificacion.filter(s => s.temporada === 'alta').map(s => s.indice)
  const mediaAltas = clasificacion.filter(s => s.temporada === 'media_alta').map(s => s.indice)
  const medias = clasificacion.filter(s => s.temporada === 'media').map(s => s.indice)
  const bajas = clasificacion.filter(s => s.temporada === 'baja').map(s => s.indice)

  it('CA-12.5 · fuera de turno no se ofrece elegir y se dice a quién se espera', async () => {
    const formulario = await mountSuspended(WeekSelectionForm, {
      props: { rejilla, classification: clasificacion, taken: [], turn: turnOf(turnos(), 1), anio: ANIO, enviando: false },
    })

    expect(formulario.find('[data-test="turno-espera"]').text()).toContain('3/8')
    expect(formulario.find('[data-test="confirmar-semanas"]').exists()).toBe(false)
  })

  it('CA-12.2 · CA-12.3 · en su turno elige 1/1/1/3 entre las libres; una ajena está bloqueada', async () => {
    const formulario = await mountSuspended(WeekSelectionForm, {
      props: { rejilla, classification: clasificacion, taken: [altas[0]!], turn: turnOf(turnos({ 3: 6 }), 1), anio: ANIO, enviando: false },
    })

    expect(formulario.find('[data-test="turno-listo"]').exists()).toBe(true)
    expect(formulario.find(`[data-test="semana-elegir-${altas[0]}"]`).attributes('disabled')).toBeDefined()

    await formulario.find(`[data-test="semana-elegir-${altas[1]}"]`).trigger('click')
    await formulario.find(`[data-test="semana-elegir-${altas[2]}"]`).trigger('click')
    expect(formulario.find('[data-test="error-wrong_count"]').exists()).toBe(true)
    expect(formulario.find('[data-test="confirmar-semanas"]').attributes('disabled')).toBeDefined()

    await formulario.find(`[data-test="semana-elegir-${altas[2]}"]`).trigger('click')
    for (const semana of [mediaAltas[0]!, medias[0]!, bajas[0]!, bajas[1]!, bajas[2]!]) {
      await formulario.find(`[data-test="semana-elegir-${semana}"]`).trigger('click')
    }
    expect(formulario.find('[data-test="resumen-eleccion-baja"]').text()).toContain('3 de 3')
    expect(formulario.find('[data-test="errores-seleccion"]').exists()).toBe(false)

    await formulario.find('[data-test="confirmar-semanas"]').trigger('click')
    expect(formulario.emitted('submit')).toEqual([[[altas[1], mediaAltas[0], medias[0], bajas[0], bajas[1], bajas[2]].sort((a, b) => a! - b!)]])
  })

  it('RF-12.3 · con la elección hecha solo queda el aviso', async () => {
    const formulario = await mountSuspended(WeekSelectionForm, {
      props: { rejilla, classification: clasificacion, taken: [], turn: turnOf(turnos({ 3: 6 }), 3), anio: ANIO, enviando: false },
    })

    expect(formulario.find('[data-test="turno-hecho"]').text()).toContain('2027')
    expect(formulario.find('[data-test="confirmar-semanas"]').exists()).toBe(false)
  })
})

describe('SelectionOrderEditor', () => {
  const fractions = [{ number: 1, ownerName: 'Ana Ruiz' }, { number: 2, ownerName: 'Luis Mora' }, { number: 3, ownerName: null }]

  it('CA-12.6 · mover una fracción emite el nuevo orden y «sugerir» pide la sugerencia', async () => {
    const editor = await mountSuspended(SelectionOrderEditor, { props: { order: [3, 1, 2], fractions, editable: true } })

    expect(editor.find('[data-test="turno-1"]').text()).toContain('Ana Ruiz')
    await editor.find('[data-test="subir-1"]').trigger('click')
    expect(editor.emitted('update:order')).toEqual([[[1, 3, 2]]])
    await editor.find('[data-test="sugerir-orden"]').trigger('click')
    expect(editor.emitted('sugerir')).toHaveLength(1)
  })

  it('RF-12.4 · sin fracciones con titular lo dice y no ofrece mover nada', async () => {
    const editor = await mountSuspended(SelectionOrderEditor, { props: { order: [], fractions: [], editable: true } })
    expect(editor.find('[data-test="sin-titulares"]').exists()).toBe(true)
  })
})

describe('SelectionProgress', () => {
  it('CA-12.5 · muestra quién eligió, a quién le toca, quién espera y quién no tiene titular', async () => {
    const turns: SelectionTurnListed[] = [
      { fraction: 3, position: 0, ownerName: 'Ana Ruiz', hasOwner: true, selectedWeeks: 6 },
      { fraction: 1, position: 1, ownerName: 'Luis Mora', hasOwner: true, selectedWeeks: 0 },
      { fraction: 4, position: 2, ownerName: null, hasOwner: false, selectedWeeks: 0 },
      { fraction: 2, position: 3, ownerName: 'Eva Gil', hasOwner: true, selectedWeeks: 0 },
    ]
    const avance = await mountSuspended(SelectionProgress, { props: { turns, freeWeeks: 46 } })

    expect(avance.find('[data-test="avance-3"]').attributes('data-estado')).toBe('done')
    expect(avance.find('[data-test="avance-1"]').attributes('data-estado')).toBe('current')
    expect(avance.find('[data-test="avance-4"]').attributes('data-estado')).toBe('skipped')
    expect(avance.find('[data-test="avance-2"]').attributes('data-estado')).toBe('waiting')
    expect(avance.find('[data-test="semanas-libres"]').text()).toContain('46')
  })
})

describe('SelectedWeeksList', () => {
  it('RF-12.3 · lista por fracción las semanas elegidas con su fecha y temporada', async () => {
    const allocations: AllocationEntry[] = [
      { fraction: 3, week: 0, season: 'alta' },
      { fraction: 3, week: 24, season: 'baja' },
      { fraction: 1, week: 8, season: 'media_alta' },
    ]
    const lista = await mountSuspended(SelectedWeeksList, {
      props: { allocations, rejilla, fractions: [{ number: 1, ownerName: 'Ana Ruiz' }, { number: 3, ownerName: 'Luis Mora' }] },
    })

    expect(lista.findAll('[data-test^="elegidas-"]')).toHaveLength(2)
    expect(lista.find('[data-test="elegidas-3"]').text()).toContain('Luis Mora')
    expect(lista.find('[data-test="elegidas-3"]').text()).toContain('2 semanas')

    // El acordeón nace plegado: al abrir el panel de la fracción aparecen sus semanas.
    expect(lista.find('[data-test="panel-elegidas-3"]').exists()).toBe(false)
    await lista.find('[data-test="elegidas-3"]').trigger('click')
    await flushPromises()
    expect(lista.find('[data-test="panel-elegidas-3"]').findAll('[data-test^="semana-elegida-"]')).toHaveLength(2)
    expect(lista.find('[data-test="semana-elegida-3-0"]').text()).toContain(formatearDia(rejilla[0]!.inicio, 'es'))
    expect(lista.find('[data-test="semana-elegida-3-0"]').text()).toContain('Alta')

    await lista.find('[data-test="elegidas-1"]').trigger('click')
    await flushPromises()
    expect(lista.find('[data-test="panel-elegidas-1"]').text()).toContain('Media-alta')
  })

  it('sin semanas elegidas lo dice', async () => {
    const lista = await mountSuspended(SelectedWeeksList, { props: { allocations: [], rejilla, fractions: [] } })
    expect(lista.find('[data-test="sin-elegidas"]').exists()).toBe(true)
  })
})

describe('WeekSwapForm', () => {
  const allocations: AllocationEntry[] = [
    { fraction: 1, week: 0, season: 'alta' },
    { fraction: 2, week: 1, season: 'alta' },
    { fraction: 2, week: 25, season: 'baja' },
  ]

  it('CA-12.10 · sin motivo no intercambia y lo explica', async () => {
    const formulario = await mountSuspended(WeekSwapForm, { props: { allocations, lockedWeeks: [], rejilla, enviando: false } })

    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.find('[data-test="errores-intercambio"]').exists()).toBe(true)
    expect(formulario.emitted('submit')).toBeUndefined()
  })
})

describe('SwapRequestsList', () => {
  const requests = [{
    id: 'r1',
    requesterFraction: 1,
    offeredWeek: 24,
    targetFraction: 3,
    requestedWeek: 27,
    season: 'baja' as const,
    message: 'Cumpleaños en junio',
    status: 'open' as const,
    createdAt: '2026-10-01T12:00:00Z',
    resolutionReason: null,
  }]

  it('CA-12.11 · el Administrador aprueba, y rechazar exige motivo', async () => {
    const lista = await mountSuspended(SwapRequestsList, { props: { requests, canResolve: true, ocupadaId: null } })

    expect(lista.find('[data-test="solicitud-r1"]').text()).toContain('1/8')
    expect(lista.find('[data-test="mensaje"]').text()).toContain('Cumpleaños en junio')

    await lista.find('form').trigger('submit')
    await flushPromises()
    expect(lista.emitted('resolver')).toBeUndefined()

    await lista.find('[data-test="motivo-rechazo-r1"]').setValue('Ya tiene planes')
    await lista.find('form').trigger('submit')
    await flushPromises()
    expect(lista.emitted('resolver')?.[0]).toEqual(['r1', false, 'Ya tiene planes'])

    await lista.find('[data-test="aprobar-r1"]').trigger('click')
    expect(lista.emitted('resolver')?.[1]).toEqual(['r1', true, null])
  })

  it('RF-12.6 · el Propietario ve el estado y no puede resolver', async () => {
    const lista = await mountSuspended(SwapRequestsList, { props: { requests, canResolve: false, ocupadaId: null } })
    expect(lista.find('[data-test="estado-r1"]').text()).toContain('Pendiente')
    expect(lista.find('[data-test="aprobar-r1"]').exists()).toBe(false)
  })
})

describe('CalendarPicker', () => {
  it('cambiar de año emite el año elegido', async () => {
    const selector = await mountSuspended(CalendarPicker, {
      props: { propiedades: [{ id: 'p1', label: 'Casa Arena' }], propertyId: 'p1', anio: 2027 },
    })

    await selector.find('[data-test="anio-siguiente"]').trigger('click')
    expect(selector.emitted('update:anio')).toEqual([[2028]])
  })
})
