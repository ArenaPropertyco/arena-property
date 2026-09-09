import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import AllocationPreview from '~/components/AllocationPreview.vue'
import CalendarPicker from '~/components/CalendarPicker.vue'
import ReconfigurationConfirm from '~/components/ReconfigurationConfirm.vue'
import SeasonClassifier from '~/components/SeasonClassifier.vue'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { repartir } from '#shared/scheduling/reparto'
import { BLOQUES_PICO, clasificacionBase, sugerirBloquesPico } from '#shared/scheduling/temporadas'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'

/**
 * HU-12 · RF-12.2, RF-12.3, RF-12.9 · principio 10 · la pantalla del calendario
 * se compone de componentes que reciben la rejilla, la clasificación y el reparto
 * ya calculados, y emiten lo que el Administrador decide. Ninguno calcula reglas.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const ANIO = 2027
const rejilla = rejillaDelAnio(ANIO)

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

  it('la sugerencia de bloques pico emite las tres fechas del año', async () => {
    const clasificador = await mountSuspended(SeasonClassifier, {
      props: { rejilla, clasificacion: clasificacionBase(rejilla), editable: true, anio: ANIO },
    })

    await clasificador.find('[data-test="sugerir-picos"]').trigger('click')
    const emitida = clasificador.emitted('update:clasificacion')?.[0]?.[0] as SemanaClasificada[]
    expect(emitida.filter(s => s.bloquePico).map(s => s.bloquePico).sort()).toEqual(['christmas', 'holy_week', 'new_year'])
    expect(emitida.filter(s => s.bloquePico).every(s => s.temporada === 'alta')).toBe(true)
  })
})

describe('AllocationPreview', () => {
  it('CA-12.2 · muestra el cupo de cada fracción y la bolsa del Administrador', async () => {
    const reparto = repartir({ anio: ANIO, anioBase: 2026, rejilla, semanas: clasificacionValida() })
    const vista = await mountSuspended(AllocationPreview, { props: { reparto, error: null, rejilla } })

    expect(vista.findAll('[data-test^="reparto-fraccion-"]')).toHaveLength(8)
    expect(vista.find('[data-test="reparto-fraccion-1"]').text()).toContain('7 · 7 · 7 · 21')
    expect(vista.find('[data-test="bolsa-administrador"]').text()).toContain(String(reparto.bolsaDelAdministrador.length))
  })

  it('CA-12.7 · con rejilla imposible muestra el error explicativo y ningún reparto', async () => {
    const vista = await mountSuspended(AllocationPreview, {
      props: { reparto: null, error: 'La rejilla no permite cumplir el criterio: faltan semanas de alta (7 de 8).', rejilla },
    })

    expect(vista.find('[data-test="reparto-imposible"]').text()).toContain('faltan semanas de alta')
    expect(vista.findAll('[data-test^="reparto-fraccion-"]')).toHaveLength(0)
  })
})

describe('ReconfigurationConfirm', () => {
  it('RF-12.9 · lista los conflictos y solo emite al confirmar', async () => {
    const confirmacion = await mountSuspended(ReconfigurationConfirm, {
      props: {
        estadias: 2,
        conflictos: [{ estadia: 'e1', fraccion: 1, noches: ['2027-01-02', '2027-01-03'], ahoraDe: 8 }],
        enviando: false,
      },
    })

    expect(confirmacion.text()).toContain('2')
    expect(confirmacion.findAll('[data-test="conflicto"]')).toHaveLength(1)
    expect(confirmacion.emitted('confirmar')).toBeUndefined()
    await confirmacion.find('[data-test="confirmar-reconfiguracion"]').trigger('click')
    expect(confirmacion.emitted('confirmar')).toHaveLength(1)
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
