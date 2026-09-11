/**
 * HU-42 · RF-42.1…RF-42.4 · TR-02 RF-D.5, RF-D.6 — manifiesto de la página de
 * beneficios y el comparativo renta tradicional frente a sistema fraccionado.
 *
 * El comparativo es una estructura tipada, no texto suelto: cada fila tiene las
 * dos columnas y cada celda lleva su condición (`confirmado` | `estimado`). La
 * vista solo traduce esa condición a color (principio 9): aquí se decide qué
 * cifra es un hecho y cuál una estimación.
 */

import { formatearImporte } from '../money/formato'
import type { Idioma } from '../money/formato'
import { pesos } from '../money/importe'
import type { CopAmount } from '../money/importe'
import type { Condicion } from '../money/presentacion'
import { clavesDe } from './manifiesto'
import type { SeccionDePagina } from './manifiesto'
import { RUTAS_PUBLICAS } from './rutas'

export const IDS_DE_BENEFICIOS = ['hero', 'comparison', 'benefits', 'cta'] as const
export type IdDeBeneficios = typeof IDS_DE_BENEFICIOS[number]

export type SeccionDeBeneficios = SeccionDePagina<IdDeBeneficios>

/** RF-42.1 · el precio publicado por fracción: un hecho del catálogo. */
export const PRECIO_DE_FRACCION: CopAmount = pesos(173_000_000)

/**
 * El precio del apartamento completo no está a la venta como tal: es lo que
 * costarían las ocho fracciones juntas, y por eso se publica como estimación.
 */
export const PRECIO_DEL_APARTAMENTO: CopAmount = pesos(173_000_000 * 8)

/** RF-42.1 · los criterios del comparativo, en el orden en que se leen. */
export const CRITERIOS_DEL_COMPARATIVO = ['capital', 'payment', 'usage', 'income', 'expenses', 'operation', 'ownership'] as const
export type CriterioDelComparativo = typeof CRITERIOS_DEL_COMPARATIVO[number]

/** RF-42.2 · una celda dice algo con palabras o con una cifra, y siempre con su condición. */
export interface CeldaDelComparativo {
  textoKey?: string
  importe?: CopAmount
  condicion: Condicion
}

export interface FilaDelComparativo {
  id: CriterioDelComparativo
  labelKey: string
  traditional: CeldaDelComparativo
  fractional: CeldaDelComparativo
}

function texto(criterio: CriterioDelComparativo, columna: 'traditional' | 'fractional', condicion: Condicion = 'confirmado'): CeldaDelComparativo {
  return { textoKey: `benefits.comparison.cells.${criterio}.${columna}`, condicion }
}

export const COMPARATIVO: readonly FilaDelComparativo[] = [
  {
    id: 'capital',
    labelKey: 'benefits.comparison.criteria.capital',
    traditional: { importe: PRECIO_DEL_APARTAMENTO, condicion: 'estimado' },
    fractional: { importe: PRECIO_DE_FRACCION, condicion: 'confirmado' },
  },
  { id: 'payment', labelKey: 'benefits.comparison.criteria.payment', traditional: texto('payment', 'traditional'), fractional: texto('payment', 'fractional') },
  { id: 'usage', labelKey: 'benefits.comparison.criteria.usage', traditional: texto('usage', 'traditional'), fractional: texto('usage', 'fractional') },
  // Los ingresos por renta dependen de la ocupación: son una estimación en ambas columnas.
  { id: 'income', labelKey: 'benefits.comparison.criteria.income', traditional: texto('income', 'traditional', 'estimado'), fractional: texto('income', 'fractional', 'estimado') },
  { id: 'expenses', labelKey: 'benefits.comparison.criteria.expenses', traditional: texto('expenses', 'traditional'), fractional: texto('expenses', 'fractional') },
  { id: 'operation', labelKey: 'benefits.comparison.criteria.operation', traditional: texto('operation', 'traditional'), fractional: texto('operation', 'fractional') },
  { id: 'ownership', labelKey: 'benefits.comparison.criteria.ownership', traditional: texto('ownership', 'traditional'), fractional: texto('ownership', 'fractional') },
]

/** RF-42.4 · las ventajas del fraccionado, las mismas seis que resume la home. */
export const VENTAJAS = ['capital', 'weeks', 'income', 'ownership', 'management', 'transparency'] as const
export type Ventaja = typeof VENTAJAS[number]

export interface CeldaPresentada {
  /** Importe ya formateado por TR-02; `null` cuando la celda es de texto. */
  texto: string | null
  /** Clave i18n del texto; `null` cuando la celda es una cifra. */
  textoKey: string | null
  condicion: Condicion
  esConfirmado: boolean
}

/**
 * CA-42.2 · CA-42.3 · RF-D.5 · RF-D.6 · la celda lista para la vista: la cifra
 * formateada en el idioma pedido y la condición tal como viene en el dato.
 */
export function presentarCelda(celda: CeldaDelComparativo, idioma: Idioma): CeldaPresentada {
  return {
    texto: celda.importe === undefined ? null : formatearImporte(celda.importe, idioma),
    textoKey: celda.textoKey ?? null,
    condicion: celda.condicion,
    esConfirmado: celda.condicion === 'confirmado',
  }
}

/** CA-42.1 · filas con una celda sin valor o sin condición reconocida. */
export function problemasDelComparativo(filas: readonly FilaDelComparativo[]): string[] {
  const problemas: string[] = []
  for (const fila of filas) {
    for (const columna of ['traditional', 'fractional'] as const) {
      const celda = fila[columna]
      if (celda.textoKey === undefined && celda.importe === undefined) {
        problemas.push(`${fila.id}:${columna}:sin_valor`)
      }
      if (celda.condicion !== 'confirmado' && celda.condicion !== 'estimado') {
        problemas.push(`${fila.id}:${columna}:sin_condicion`)
      }
    }
  }
  return problemas
}

export const SECCIONES_DE_BENEFICIOS: readonly SeccionDeBeneficios[] = [
  {
    id: 'hero',
    orden: 1,
    tituloKey: 'benefits.hero.title',
    claves: ['benefits.hero.headline', 'benefits.hero.description'],
  },
  {
    id: 'comparison',
    orden: 2,
    tituloKey: 'benefits.comparison.title',
    claves: [
      'benefits.comparison.headline',
      'benefits.comparison.description',
      'benefits.comparison.columns.criterion',
      'benefits.comparison.columns.traditional',
      'benefits.comparison.columns.fractional',
      'benefits.comparison.legend.confirmed',
      'benefits.comparison.legend.estimated',
      ...COMPARATIVO.map(fila => fila.labelKey),
    ],
  },
  {
    id: 'benefits',
    orden: 3,
    tituloKey: 'benefits.list.title',
    claves: [
      'benefits.list.headline',
      'benefits.list.description',
      ...clavesDe('benefits.items', VENTAJAS, ['title', 'description']),
    ],
  },
  {
    id: 'cta',
    orden: 4,
    tituloKey: 'benefits.cta.title',
    claves: ['benefits.cta.description'],
    cta: { labelKey: 'benefits.cta.cta', destino: RUTAS_PUBLICAS.registro },
  },
]

export const IMAGENES_DE_BENEFICIOS = {
  /** La playa que se gana con la fracción. Ambientación generada (P-09). */
  hero: '/media/beneficios-hero.jpg',
  /** El Caribe que se gana con la fracción. Ambientación generada (P-09). */
  benefits: '/media/beneficios-lifestyle.jpg',
} as const
