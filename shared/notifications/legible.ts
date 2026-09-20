/**
 * TR-03 · TR-02 · RF-D.5 — la carga de una notificación, lista para leerse.
 *
 * Los eventos viajan con datos crudos: el importe como entero en pesos y las
 * fechas como `AAAA-MM-DD` (principio 9). Quien los muestre —la bandeja o el
 * correo— los pasa por aquí para que un importe salga con el formato de la casa
 * y una fecha con la del idioma, sin que ninguna vista formatee por su cuenta.
 */

import { formatearDia } from '../dates/formato'
import { formatearImporte } from '../money/formato'
import type { Idioma } from '../money/formato'
import { esImporte } from '../money/importe'
import type { CargaDeNotificacion } from './tipos'

/** Campos que llevan un importe entero en pesos. */
const CAMPOS_DE_IMPORTE: ReadonlySet<string> = new Set(['amount'])

/** Campos que llevan un día de calendario. */
const CAMPOS_DE_DIA: ReadonlySet<string> = new Set(['available_on', 'check_in', 'check_out'])

/** Cada valor de la carga como texto legible; lo nulo queda vacío, nunca «null». */
export function cargaLegible(carga: CargaDeNotificacion, idioma: Idioma): Record<string, string> {
  return Object.fromEntries(Object.entries(carga).map(([campo, valor]) => {
    if (valor === null || valor === undefined) {
      return [campo, '']
    }
    if (CAMPOS_DE_IMPORTE.has(campo) && esImporte(valor)) {
      return [campo, formatearImporte(valor, idioma)]
    }
    if (CAMPOS_DE_DIA.has(campo) && typeof valor === 'string') {
      return [campo, formatearDia(valor, idioma)]
    }
    return [campo, String(valor)]
  }))
}
