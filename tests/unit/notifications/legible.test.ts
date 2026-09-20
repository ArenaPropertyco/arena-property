import { describe, expect, it } from 'vitest'
import { cargaLegible } from '#shared/notifications/legible'
import { formatearDia } from '#shared/dates/formato'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'

/**
 * TR-03 · TR-02 · RF-D.5 — la carga cruda de un evento se vuelve legible al
 * mostrarse: el importe entero con el formato de la casa y el día con el del
 * idioma. Lo que no es importe ni fecha se deja tal cual.
 */

describe('cargaLegible', () => {
  it('RF-D.5 · un importe entero en pesos sale con el formato de la casa en cada idioma', () => {
    const carga = { amount: 3_000_000, referral_label: 'pedro@correo.co' }

    expect(cargaLegible(carga, 'es').amount).toBe(formatearImporte(pesos(3_000_000), 'es'))
    expect(cargaLegible(carga, 'en').amount).toBe(formatearImporte(pesos(3_000_000), 'en'))
    expect(cargaLegible(carga, 'es').referral_label).toBe('pedro@correo.co')
  })

  it('RF-54.1 · la fecha de habilitación se lee como día del idioma', () => {
    expect(cargaLegible({ available_on: '2026-10-10' }, 'es').available_on).toBe(formatearDia('2026-10-10', 'es'))
  })

  it('principio 9 · un importe que no es entero no se maquilla: se muestra tal cual llegó', () => {
    expect(cargaLegible({ amount: '3000000' }, 'es').amount).toBe('3000000')
  })

  it('lo nulo queda vacío y los demás valores se vuelven texto', () => {
    expect(cargaLegible({ fraction_number: 3, detail: null }, 'es')).toEqual({ fraction_number: '3', detail: '' })
  })
})
