/**
 * TR-02 · RF-D.1 — el importe monetario.
 *
 * El peso colombiano no opera con centavos: todo importe es un entero de pesos.
 * En la base vive como `bigint`; aquí se modela como tipo nominal sobre `number`
 * para que un `number` cualquiera no pueda pasar por importe. La frontera es
 * `pesos()`: valida que sea entero y que esté dentro del rango exacto, de modo que
 * nunca entre un decimal ni un valor que la aritmética de enteros ya no represente.
 */

declare const marcaCop: unique symbol

/** Entero de pesos colombianos. Solo se construye con `pesos()`. */
export type CopAmount = number & { readonly [marcaCop]: 'COP' }

/** Cero pesos. */
export const CERO = 0 as CopAmount

/** ¿Es un entero de pesos representable de forma exacta? */
export function esImporte(valor: unknown): valor is CopAmount {
  return typeof valor === 'number' && Number.isSafeInteger(valor)
}

/**
 * Convierte un número en importe. Lanza si no es un entero exacto: prefiere fallar
 * a redondear en silencio, que es justo lo que prohíbe el principio 9.
 */
export function pesos(valor: number): CopAmount {
  if (!Number.isInteger(valor)) {
    throw new TypeError(`Un importe en COP debe ser un número entero de pesos: ${valor}`)
  }
  if (!Number.isSafeInteger(valor)) {
    throw new RangeError(`El importe excede el rango entero seguro: ${valor}`)
  }
  return valor as CopAmount
}

/** Suma dos importes. */
export function sumar(a: CopAmount, b: CopAmount): CopAmount {
  return pesos(a + b)
}

/** Resta el segundo importe del primero. */
export function restar(a: CopAmount, b: CopAmount): CopAmount {
  return pesos(a - b)
}

/** Multiplica un importe por un factor entero (número de cuotas, de fracciones…). */
export function multiplicarPorEntero(importe: CopAmount, factor: number): CopAmount {
  if (!Number.isInteger(factor)) {
    throw new TypeError(`El factor debe ser entero para no introducir decimales: ${factor}`)
  }
  return pesos(importe * factor)
}

/** Suma una lista de importes. */
export function sumarTodos(importes: readonly CopAmount[]): CopAmount {
  return importes.reduce<CopAmount>((total, importe) => sumar(total, importe), CERO)
}
