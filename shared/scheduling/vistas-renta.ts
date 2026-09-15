/**
 * HU-39 · HU-40 — las formas de la renta a terceros que comparten composables,
 * componentes y páginas. Solo tipos: llegan con el origen ya resuelto por la base y
 * con el ingreso, si lo tienen, ya repartido.
 */

import type { OrigenDeSemana } from '../finance/ingresos'
import type { CopAmount } from '../money/importe'
import type { TipoDeDocumento } from './terceros'

/** Una semana de la bolsa de renta, lista para ofrecerse en el formulario. */
export interface SemanaDeBolsa {
  week: number
  startsOn: string
  endsOn: string
  /** RF-39.2b · con qué motivo entró a la bolsa. */
  originReason: OrigenDeSemana
  /** Fracción de la que salía; `null` si era sobrante de la rejilla. */
  originFraction: number | null
}

/** Un tercero ya registrado en la propiedad, para reutilizarlo (CA-39.3). */
export interface HuespedRegistrado {
  id: string
  fullName: string
  documentKind: TipoDeDocumento
  documentNumber: string
}

/** Una reserva a tercero con su origen y, si lo tiene, su ingreso. */
export interface ReservaListada {
  id: string
  week: number
  startsOn: string
  guestName: string
  originReason: OrigenDeSemana
  originFraction: number | null
  status: 'confirmed' | 'cancelled'
  cancelReason: string | null
  /** HU-40 · el ingreso vigente de la reserva; `null` mientras no se registre. */
  incomeId: string | null
  incomeAmount: CopAmount | null
  commissionAmount: CopAmount | null
  commissionBasisPoints: number | null
}
