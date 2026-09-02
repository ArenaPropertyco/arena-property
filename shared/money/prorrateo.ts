/**
 * TR-02 · RF-D.2 y RF-D.3 — regla canónica de prorrateo.
 *
 * Dado un monto `M` entre `n` fracciones: `q = M div n` y `r = M mod n`. Las
 * primeras `r` fracciones, por número ascendente, reciben `q + 1` y el resto `q`.
 * La suma de las cuotas es siempre exactamente `M`: el residuo se reparte, nunca
 * se redondea ni se pierde.
 *
 * El reparto es determinista: el mismo monto produce siempre el mismo resultado,
 * lo que permite recalcularlo sin guardarlo y compararlo entre periodos.
 */

import type { CopAmount } from './importe'
import { pesos } from './importe'

/** Número de fracciones en que se divide una propiedad. */
export const FRACCIONES_POR_PROPIEDAD = 8

export interface Cuota {
  /** Número de fracción, de 1 en adelante. */
  fraccion: number
  monto: CopAmount
  /** RF-D.3 · esta cuota absorbió un peso del residuo. HU-24 lo hace explícito. */
  conResiduo: boolean
}

/**
 * Reparte `monto` entre `partes` fracciones según RF-D.2.
 *
 * Con montos negativos (notas crédito, ajustes) el peso extra se resta en lugar de
 * sumarse, de modo que la suma sigue siendo exactamente el monto original.
 */
export function prorratear(monto: CopAmount, partes: number = FRACCIONES_POR_PROPIEDAD): Cuota[] {
  if (!Number.isInteger(partes) || partes < 1) {
    throw new RangeError(`El número de partes debe ser un entero positivo: ${partes}`)
  }

  const cociente = Math.trunc(monto / partes)
  const residuo = monto - cociente * partes
  const conResiduo = Math.abs(residuo)
  const paso = Math.sign(residuo)

  return Array.from({ length: partes }, (_, indice) => {
    const llevaResiduo = indice < conResiduo

    return {
      fraccion: indice + 1,
      monto: pesos(llevaResiduo ? cociente + paso : cociente),
      conResiduo: llevaResiduo,
    }
  })
}
