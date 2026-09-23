/**
 * HU-25 · RF-25.1, RF-25.3, RF-25.4 · D-01, D-09 — el reporte financiero
 * consolidado del Superadmin.
 *
 * Es una agregación pura sobre entradas tipadas: cada entrada dice de qué libro
 * es —el de la propiedad o el de la plataforma (D-01)—, de qué propiedad y
 * administradores, su clase, su categoría, su medio de pago y su fecha de
 * causación (D-09). El reporte presenta los dos libros por separado y solo
 * consolida al nivel de negocio: una comisión nunca aparece como gasto de una
 * propiedad, aunque la entrada sepa de qué propiedad vino. Los totales cuadran
 * por construcción: cada desglose es una partición del mismo conjunto, y las
 * filas de la vista son las del archivo porque salen del mismo reporte.
 */

import { CERO, pesos, restar, sumar } from '../money/importe'
import type { CopAmount } from '../money/importe'
import type { Dia } from '../scheduling/rejilla'
import { serializarCsv } from './csv'
import type { ClaseDeMovimiento } from './maestra'

export type Libro = 'property' | 'platform'

export interface EntradaDeReporte {
  id: string
  libro: Libro
  /** En el libro de plataforma es informativo: el importe no es de la propiedad (D-01). */
  propertyId: string | null
  propertyName: string | null
  /** Administradores con asignación vigente sobre la propiedad (HU-05). */
  adminIds: readonly string[]
  kind: ClaseDeMovimiento
  amount: CopAmount
  categoryName: string
  paymentMethodName: string | null
  /** Fecha de causación (movimientos) o de devengo (plataforma), D-09. */
  incurredOn: Dia
}

export interface FiltroDeReporte {
  propertyId: string | null
  adminId: string | null
  desde: Dia | null
  hasta: Dia | null
}

export function filtroDeReporteVacio(): FiltroDeReporte {
  return { propertyId: null, adminId: null, desde: null, hasta: null }
}

function activo(valor: string | null | undefined): string | null {
  const limpio = (valor ?? '').trim()
  return limpio === '' ? null : limpio
}

export function hayFiltroDeReporteActivo(filtro: FiltroDeReporte): boolean {
  return [filtro.propertyId, filtro.adminId, filtro.desde, filtro.hasta].some(criterio => activo(criterio) !== null)
}

/** RF-25.1 · los criterios se combinan; el periodo es inclusivo y mira la causación. */
export function filtrarEntradas(entradas: readonly EntradaDeReporte[], filtro: FiltroDeReporte): EntradaDeReporte[] {
  const propiedad = activo(filtro.propertyId)
  const administrador = activo(filtro.adminId)
  const desde = activo(filtro.desde)
  const hasta = activo(filtro.hasta)

  return entradas.filter((entrada) => {
    if (propiedad !== null && entrada.propertyId !== propiedad) {
      return false
    }
    if (administrador !== null && !entrada.adminIds.includes(administrador)) {
      return false
    }
    if (desde !== null && entrada.incurredOn < desde) {
      return false
    }
    if (hasta !== null && entrada.incurredOn > hasta) {
      return false
    }
    return true
  })
}

export interface Desglose {
  name: string
  kind: ClaseDeMovimiento
  total: CopAmount
}

export interface Totales {
  ingresos: CopAmount
  egresos: CopAmount
  /** Ingresos menos egresos; puede ser negativo. */
  neto: CopAmount
}

export interface DesglosePorPropiedad extends Totales {
  propertyId: string | null
  propertyName: string | null
}

export interface FilaDeReporte {
  libro: Libro
  propertyName: string | null
  kind: ClaseDeMovimiento
  categoryName: string
  paymentMethodName: string | null
  total: CopAmount
}

export interface LibroAgregado extends Totales {
  libro: Libro
  porCategoria: Desglose[]
  porMedioDePago: Desglose[]
  porPropiedad: DesglosePorPropiedad[]
  /** CA-25.4 · una fila por (propiedad, clase, categoría, medio), en orden fijo; suman este libro. */
  filas: FilaDeReporte[]
}

export interface ReporteFinanciero {
  propiedad: LibroAgregado
  plataforma: LibroAgregado
  /** RF-25.3 · la suma de los dos libros: solo existe a nivel de negocio global. */
  consolidado: Totales
}

const CLASES: readonly ClaseDeMovimiento[] = ['expense', 'income']

function totalesDe(entradas: readonly EntradaDeReporte[]): Totales {
  const ingresos = entradas.filter(e => e.kind === 'income').reduce((suma, e) => sumar(suma, e.amount), CERO)
  const egresos = entradas.filter(e => e.kind === 'expense').reduce((suma, e) => sumar(suma, e.amount), CERO)
  return { ingresos, egresos, neto: restar(ingresos, egresos) }
}

/** Desglose por una clave, en orden de primera aparición dentro de cada clase; egresos primero. */
function desglosePor(entradas: readonly EntradaDeReporte[], clave: (e: EntradaDeReporte) => string): Desglose[] {
  const resultado: Desglose[] = []
  for (const kind of CLASES) {
    const porNombre = new Map<string, CopAmount>()
    for (const entrada of entradas.filter(e => e.kind === kind)) {
      const nombre = clave(entrada)
      porNombre.set(nombre, sumar(porNombre.get(nombre) ?? CERO, entrada.amount))
    }
    for (const [name, total] of porNombre) {
      resultado.push({ name, kind, total })
    }
  }
  return resultado
}

function porPropiedad(entradas: readonly EntradaDeReporte[]): DesglosePorPropiedad[] {
  const grupos = new Map<string, { propertyId: string | null, propertyName: string | null, entradas: EntradaDeReporte[] }>()
  for (const entrada of entradas) {
    const clave = entrada.propertyId ?? ''
    const grupo = grupos.get(clave) ?? { propertyId: entrada.propertyId, propertyName: entrada.propertyName, entradas: [] }
    grupo.entradas.push(entrada)
    grupos.set(clave, grupo)
  }
  return [...grupos.values()]
    .map(grupo => ({ propertyId: grupo.propertyId, propertyName: grupo.propertyName, ...totalesDe(grupo.entradas) }))
    .sort((a, b) => (a.propertyName ?? '').localeCompare(b.propertyName ?? '', 'es'))
}

function filasDe(libro: Libro, entradas: readonly EntradaDeReporte[]): FilaDeReporte[] {
  const ordenadas = [...entradas].sort((a, b) =>
    (a.propertyName ?? '').localeCompare(b.propertyName ?? '', 'es')
    || CLASES.indexOf(a.kind) - CLASES.indexOf(b.kind)
    || a.categoryName.localeCompare(b.categoryName, 'es')
    || (a.paymentMethodName ?? '').localeCompare(b.paymentMethodName ?? '', 'es'))
  const grupos = new Map<string, FilaDeReporte>()
  for (const entrada of ordenadas) {
    const clave = [entrada.propertyId ?? '', entrada.kind, entrada.categoryName, entrada.paymentMethodName ?? ''].join('\u0000')
    const fila = grupos.get(clave) ?? {
      libro,
      propertyName: entrada.propertyName,
      kind: entrada.kind,
      categoryName: entrada.categoryName,
      paymentMethodName: entrada.paymentMethodName,
      total: CERO,
    }
    fila.total = sumar(fila.total, entrada.amount)
    grupos.set(clave, fila)
  }
  return [...grupos.values()]
}

function agregarLibro(libro: Libro, entradas: readonly EntradaDeReporte[]): LibroAgregado {
  const propias = entradas.filter(e => e.libro === libro)
  return {
    libro,
    ...totalesDe(propias),
    porCategoria: desglosePor(propias, e => e.categoryName),
    porMedioDePago: desglosePor(propias, e => e.paymentMethodName ?? ''),
    porPropiedad: porPropiedad(propias),
    filas: filasDe(libro, propias),
  }
}

/** RF-25.4 · CA-25.1 · CA-25.2 · el reporte del filtro: dos libros y su consolidado. */
export function agregarReporte(entradas: readonly EntradaDeReporte[], filtro: FiltroDeReporte): ReporteFinanciero {
  const filtradas = filtrarEntradas(entradas, filtro)
  const propiedad = agregarLibro('property', filtradas)
  const plataforma = agregarLibro('platform', filtradas)
  const ingresos = sumar(propiedad.ingresos, plataforma.ingresos)
  const egresos = sumar(propiedad.egresos, plataforma.egresos)
  return { propiedad, plataforma, consolidado: { ingresos, egresos, neto: restar(ingresos, egresos) } }
}

export const CABECERA_DE_REPORTE = ['libro', 'propiedad', 'clase', 'categoria', 'medio_de_pago', 'total'] as const

/** CA-25.4 · las filas de la vista, que son también las del archivo: propiedad primero, plataforma después. */
export function filasDelReporte(reporte: ReporteFinanciero): FilaDeReporte[] {
  return [...reporte.propiedad.filas, ...reporte.plataforma.filas]
}

/** RF-25.2 · CA-25.4 · el archivo: misma cabecera y mismas filas que la vista. */
export function csvDelReporte(reporte: ReporteFinanciero): string {
  return serializarCsv(
    CABECERA_DE_REPORTE,
    filasDelReporte(reporte).map(fila => [fila.libro, fila.propertyName, fila.kind, fila.categoryName, fila.paymentMethodName, fila.total]),
  )
}

export const RUTA_DE_EXPORTACION = '/api/reportes/finanzas.csv'

/** RF-25.2 · la ruta Nitro de exportación, con los mismos filtros que la vista. */
export function rutaDeExportacion(filtro: FiltroDeReporte): string {
  const parametros = new URLSearchParams()
  const pares: [string, string | null][] = [
    ['propiedad', activo(filtro.propertyId)],
    ['administrador', activo(filtro.adminId)],
    ['desde', activo(filtro.desde)],
    ['hasta', activo(filtro.hasta)],
  ]
  for (const [clave, valor] of pares) {
    if (valor !== null) {
      parametros.set(clave, valor)
    }
  }
  const cadena = parametros.toString()
  return cadena === '' ? RUTA_DE_EXPORTACION : `${RUTA_DE_EXPORTACION}?${cadena}`
}

/** El filtro tal como llega en la query de la ruta de exportación; lo que no es una fecha se ignora. */
export function filtroDesdeQuery(query: Record<string, unknown>): FiltroDeReporte {
  const texto = (valor: unknown): string | null => (typeof valor === 'string' ? activo(valor) : null)
  const dia = (valor: unknown): Dia | null => {
    const limpio = texto(valor)
    return limpio !== null && /^\d{4}-\d{2}-\d{2}$/.test(limpio) ? limpio : null
  }
  return { propertyId: texto(query.propiedad), adminId: texto(query.administrador), desde: dia(query.desde), hasta: dia(query.hasta) }
}

/** Un importe en COP a partir de lo que devuelve la base (bigint como número o texto). */
export function importeDeBase(valor: number | string | null | undefined): CopAmount {
  return pesos(Number(valor ?? 0))
}
