/**
 * HU-32 · RF-32.2 · RT-02 — las series por periodo del dashboard.
 *
 * Lógica pura sobre eventos tipados: cada evento tiene un día y un valor (1 para
 * contar ventas, el importe para sumar comisiones). Se agrupan por mes,
 * trimestre o año leyendo la fecha como texto, sin pasar por `Date` ni por la
 * zona horaria; los periodos vacíos del rango se rellenan con cero para que el
 * gráfico no salte. El componente recibe la serie ya calculada y solo la pinta.
 */

import type { Idioma } from '../money/formato'
import type { Dia } from '../scheduling/rejilla'

export const PERIODOS = ['monthly', 'quarterly', 'yearly'] as const
export type Periodo = typeof PERIODOS[number]

export interface EventoDeSerie {
  on: Dia
  value: number
}

export interface Bucket {
  key: string
  label: string
  value: number
  /** Cuántos eventos cayeron en el bucket. */
  count: number
}

/** RF-32.2 · `2026-09` · `2026-Q3` · `2026`, a partir del día como texto. */
export function claveDePeriodo(dia: Dia, periodo: Periodo): string {
  const anio = dia.slice(0, 4)
  const mes = Number(dia.slice(5, 7))
  switch (periodo) {
    case 'monthly': return `${anio}-${String(mes).padStart(2, '0')}`
    case 'quarterly': return `${anio}-Q${Math.ceil(mes / 3)}`
    case 'yearly': return anio
  }
}

const MESES: Record<Idioma, readonly string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

/** La etiqueta del eje, legible en cada idioma. */
export function etiquetaDePeriodo(clave: string, periodo: Periodo, idioma: Idioma): string {
  const anio = clave.slice(0, 4)
  switch (periodo) {
    case 'monthly': return `${MESES[idioma][Number(clave.slice(5, 7)) - 1] ?? clave} ${anio}`
    case 'quarterly': return `${idioma === 'es' ? 'T' : 'Q'}${clave.slice(6)} ${anio}`
    case 'yearly': return anio
  }
}

/** El periodo siguiente a una clave, para rellenar los huecos. */
function siguiente(clave: string, periodo: Periodo): string {
  const anio = Number(clave.slice(0, 4))
  switch (periodo) {
    case 'monthly': {
      const mes = Number(clave.slice(5, 7))
      return mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, '0')}`
    }
    case 'quarterly': {
      const trimestre = Number(clave.slice(6))
      return trimestre === 4 ? `${anio + 1}-Q1` : `${anio}-Q${trimestre + 1}`
    }
    case 'yearly': return String(anio + 1)
  }
}

/**
 * CA-32.2 · la serie del periodo: un bucket por periodo entre el primero y el
 * último con eventos (o el rango pedido), todos presentes aunque valgan cero.
 */
export function agregarSerie(eventos: readonly EventoDeSerie[], periodo: Periodo, rango?: { desde: Dia, hasta: Dia }, idioma: Idioma = 'es'): Bucket[] {
  const claves = eventos.map(evento => claveDePeriodo(evento.on, periodo))
  const inicio = rango ? claveDePeriodo(rango.desde, periodo) : [...claves].sort()[0]
  const fin = rango ? claveDePeriodo(rango.hasta, periodo) : [...claves].sort().at(-1)
  if (inicio === undefined || fin === undefined) {
    return []
  }

  const acumulado = new Map<string, { value: number, count: number }>()
  eventos.forEach((evento, indice) => {
    const clave = claves[indice]!
    const actual = acumulado.get(clave) ?? { value: 0, count: 0 }
    acumulado.set(clave, { value: actual.value + evento.value, count: actual.count + 1 })
  })

  const buckets: Bucket[] = []
  for (let clave = inicio; clave <= fin; clave = siguiente(clave, periodo)) {
    const suma = acumulado.get(clave) ?? { value: 0, count: 0 }
    buckets.push({ key: clave, label: etiquetaDePeriodo(clave, periodo, idioma), ...suma })
  }
  return buckets
}

/** CA-32.2 · la suma de los buckets es el total de la serie. */
export function totalDeSerie(buckets: readonly Bucket[]): number {
  return buckets.reduce((suma, bucket) => suma + bucket.value, 0)
}
