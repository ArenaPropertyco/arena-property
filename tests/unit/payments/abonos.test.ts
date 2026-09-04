import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import {
  CLAVES_DE_VALIDACION_DE_ABONO,
  validarAbono,
  validarAnulacion,
} from '#shared/payments/abonos'
import type { ContextoDelPlan, NuevoAbono } from '#shared/payments/abonos'

/**
 * HU-58 · RF-58.2, RF-58.4, RF-58.5 — qué abono entra y cuál se rechaza.
 *
 * El formulario valida con esto antes de emitir; la base vuelve a comprobar el
 * sobrepago y el comprobante en sus propias restricciones. Aquí se da el mensaje.
 */

function abono(cambios: Partial<NuevoAbono> = {}): NuevoAbono {
  return {
    amount: pesos(30_000_000),
    paidOn: '2026-09-03',
    method: 'transfer',
    receiptPath: 'a1/p1/comprobante.pdf',
    note: null,
    ...cambios,
  }
}

const contexto: ContextoDelPlan = {
  precioPactado: pesos(100_000_000),
  abonado: pesos(60_000_000),
  estado: 'in_progress',
}

describe('RF-58.2 · un abono completo entra', () => {
  it('con monto, fecha, medio y comprobante no hay errores', () => {
    expect(validarAbono(abono(), contexto)).toEqual([])
  })

  it('el abono que deja el saldo exactamente en cero es válido', () => {
    expect(validarAbono(abono({ amount: pesos(40_000_000) }), contexto)).toEqual([])
  })
})

describe('CA-58.2 · sobrepago', () => {
  it('CA-58.2 · un abono que superaría el precio pactado se rechaza', () => {
    const errores = validarAbono(abono({ amount: pesos(40_000_001) }), contexto)

    expect(errores.map(error => error.message)).toEqual(['payments.validation.overpayment'])
  })

  it('un monto de cero o negativo no es un abono', () => {
    expect(validarAbono(abono({ amount: pesos(0) }), contexto).map(e => e.name)).toEqual(['amount'])
    expect(validarAbono(abono({ amount: pesos(-5) }), contexto).map(e => e.name)).toEqual(['amount'])
  })
})

describe('CA-58.6 · comprobante obligatorio', () => {
  it('CA-58.6 · un abono sin comprobante se rechaza', () => {
    expect(validarAbono(abono({ receiptPath: null }), contexto).map(e => e.message))
      .toEqual(['payments.validation.receipt_required'])
    expect(validarAbono(abono({ receiptPath: '   ' }), contexto).map(e => e.name)).toEqual(['receiptPath'])
  })
})

describe('RF-58.2 · fecha y medio de pago', () => {
  it('la fecha debe ser un día de calendario válido', () => {
    expect(validarAbono(abono({ paidOn: '' }), contexto).map(e => e.name)).toEqual(['paidOn'])
    expect(validarAbono(abono({ paidOn: '2026-13-40' }), contexto).map(e => e.name)).toEqual(['paidOn'])
  })

  it('el medio de pago no puede quedar vacío', () => {
    expect(validarAbono(abono({ method: ' ' }), contexto).map(e => e.name)).toEqual(['method'])
  })
})

describe('RF-58.8 · sobre un plan cerrado no se abona', () => {
  it('un plan completado o anulado no admite abonos nuevos', () => {
    expect(validarAbono(abono(), { ...contexto, abonado: pesos(100_000_000), estado: 'completed' }).map(e => e.message))
      .toContain('payments.validation.plan_not_open')
    expect(validarAbono(abono(), { ...contexto, estado: 'voided' }).map(e => e.message))
      .toContain('payments.validation.plan_not_open')
  })
})

describe('RF-58.5 · anulación con motivo', () => {
  it('sin motivo no hay anulación', () => {
    expect(validarAnulacion('')).toEqual(['payments.validation.reason_required'])
    expect(validarAnulacion('   ')).toEqual(['payments.validation.reason_required'])
  })

  it('con motivo, la anulación procede', () => {
    expect(validarAnulacion('Transferencia devuelta por el banco.')).toEqual([])
  })

  it('toda clave de validación pertenece al catálogo cerrado', () => {
    const errores = validarAbono(
      abono({ amount: pesos(0), paidOn: '', method: '', receiptPath: null }),
      { ...contexto, estado: 'voided' },
    )

    expect(errores.every(error => CLAVES_DE_VALIDACION_DE_ABONO.includes(error.message))).toBe(true)
  })
})
