import { describe, expect, it } from 'vitest'
import type { CopAmount } from '#shared/money/importe'
import { pesos, sumar } from '#shared/money/importe'

/**
 * TR-02 · RF-D.1 — el tipo nominal rechaza en compilación un `number` sin marcar.
 * Las líneas con `@ts-expect-error` fallan la compuerta `pnpm typecheck` si el tipo
 * dejara de ser nominal: si el error desaparece, TypeScript marca la directiva como
 * innecesaria y el proyecto no compila.
 */

describe('RF-D.1 · el tipo de importe es nominal', () => {
  it('un `number` suelto no vale como importe', () => {
    // @ts-expect-error un number sin marcar no es un CopAmount
    const invalido: CopAmount = 12_500
    expect(invalido).toBe(12_500)
  })

  it('las operaciones no aceptan un `number` suelto', () => {
    // @ts-expect-error sumar solo opera sobre importes construidos con pesos()
    expect(() => sumar(12_500, pesos(1))).not.toThrow()
  })

  it('el valor construido con pesos() sí es un importe', () => {
    const valido: CopAmount = pesos(12_500)
    expect(valido).toBe(12_500)
  })
})
