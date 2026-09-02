import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import {
  colorDeCondicion,
  confirmado,
  estimado,
  presentarImporte,
  presentarPorcentaje,
} from '#shared/money/presentacion'

/**
 * TR-02 · RF-D.6 — la condición del valor es un campo del dato, no una decisión
 * de la vista. La función de presentación devuelve el importe formateado junto con
 * su condición, y la interfaz solo la traduce a la semántica de color de marca.
 */

describe('presentación de importes con su condición', () => {
  it('CA-D.7 · un valor marcado como estimado se devuelve como estimado y nunca como confirmado', () => {
    const presentado = presentarImporte(estimado(pesos(115_500_000)), 'es')

    expect(presentado.condicion).toBe('estimado')
    expect(presentado.esConfirmado).toBe(false)
    expect(presentado.texto).toBe('$\u00A0115.500.000')
  })

  it('un valor confirmado conserva su condición', () => {
    const presentado = presentarImporte(confirmado(pesos(12_500)), 'es')

    expect(presentado.condicion).toBe('confirmado')
    expect(presentado.esConfirmado).toBe(true)
  })

  it('la condición viaja con el dato y no depende del idioma', () => {
    expect(presentarImporte(estimado(pesos(1000)), 'en').condicion).toBe('estimado')
    expect(presentarImporte(estimado(pesos(1000)), 'es').condicion).toBe('estimado')
  })

  it('presenta también porcentajes con su condición', () => {
    const presentado = presentarPorcentaje({ puntosBasicos: 3750, condicion: 'estimado' }, 'es')

    expect(presentado.texto).toBe('37,5 %')
    expect(presentado.condicion).toBe('estimado')
    expect(presentado.esConfirmado).toBe(false)
  })
})

describe('semántica de color de marca', () => {
  it('el verde queda reservado a lo confirmado y lo sin confirmar va en rojo', () => {
    expect(colorDeCondicion('confirmado')).toBe('success')
    expect(colorDeCondicion('estimado')).toBe('error')
  })
})
