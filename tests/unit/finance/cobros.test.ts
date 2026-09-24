import { describe, expect, it } from 'vitest'
import {
  aplicarPagos,
  BUCKET_DE_COMPROBANTES_DE_PROPIETARIO,
  canTransitionCharge,
  CHARGE_STATUSES,
  CHARGE_TRANSITIONS,
  cobroDelCorte,
  estadoDelCobro,
  PAYMENT_CHANNELS,
  PAYMENT_STATUSES,
  pendienteDeCobro,
  pendienteDeReportar,
  referenciaExternaOcupada,
  resolveOwnerPayment,
  rutaDeComprobanteDePropietario,
  settleOwnerPayment,
  validateOwnerPayment,
} from '#shared/finance/cobros'
import type { NuevoPagoDePropietario, OwnerCharge, OwnerPayment } from '#shared/finance/cobros'
import { pesos } from '#shared/money/importe'

/**
 * HU-62 · RF-62.6, RF-62.7, RF-62.8, RF-62.11 · D-10, D-51 — el cobro por saldo
 * negativo y el pago que lo salda.
 *
 * Pedro debe $50.000 en la Casa P1 tras el corte de septiembre. El cobro nace
 * con ese importe exacto, recorre `pendiente → en revisión → pagado` (o vuelve a
 * pendiente si el pago se rechaza) y su estado se deriva de los pagos, no se
 * marca. La base repite las mismas reglas en `report_owner_payment`,
 * `confirm_owner_payment` y `reject_owner_payment`.
 */

const HOY = '2026-10-05'

const COBRO: OwnerCharge = {
  id: 'ch-1', ownerId: 'user-pedro', propertyId: 'prop-1', period: '2026-09',
  amount: pesos(50_000), paidAmount: pesos(0), status: 'pending',
}

function pago(cambios: Partial<OwnerPayment> & { id: string }): OwnerPayment {
  return {
    chargeId: COBRO.id, amount: pesos(50_000), paidOn: HOY, paymentMethodId: 'pm-transfer', description: 'Transferencia Bancolombia',
    receiptPath: 'prop-1/user-pedro/pay-1.pdf', channel: 'manual', provider: null, externalReference: null,
    status: 'reported', reportedAt: `${HOY}T10:00:00Z`, resolvedOn: null, rejectionReason: null,
    ...cambios,
  }
}

const REPORTE: NuevoPagoDePropietario = {
  amount: pesos(50_000), paidOn: HOY, paymentMethodId: 'pm-transfer', description: 'Transferencia Bancolombia', receiptPath: 'prop-1/user-pedro/pay-1.pdf',
}

describe('RF-62.6 · el cobro nace del saldo negativo', () => {
  it('CA-62.1 · con saldo −$50.000 y sin cobros abiertos, el cobro es de $50.000 exactos', () => {
    expect(cobroDelCorte(pesos(-50_000), [])).toBe(pesos(50_000))
  })

  it('RF-62.6 · con saldo positivo o cero no hay cobro', () => {
    expect(cobroDelCorte(pesos(630_000), [])).toBeNull()
    expect(cobroDelCorte(pesos(0), [])).toBeNull()
  })

  it('CA-62.3 · lo que ya está cobrado y sin pagar no se vuelve a cobrar', () => {
    // Septiembre dejó −$50.000 ya cobrados; octubre añade −$30.000: el nuevo cobro es solo por lo nuevo.
    expect(cobroDelCorte(pesos(-80_000), [COBRO])).toBe(pesos(30_000))
    // Y si nada nuevo hay que cobrar, no nace otro cobro.
    expect(cobroDelCorte(pesos(-50_000), [COBRO])).toBeNull()
  })

  it('RF-62.6 · el ciclo del cobro tiene tres estados y sus transiciones son explícitas', () => {
    expect(CHARGE_STATUSES).toEqual(['pending', 'under_review', 'paid'])
    expect(CHARGE_TRANSITIONS).toEqual({ pending: ['under_review'], under_review: ['paid', 'pending'], paid: [] })
  })

  it('CA-62.9 · pagado → pendiente y pendiente → pagado sin pago confirmado se rechazan', () => {
    expect(canTransitionCharge('paid', 'pending')).toBe(false)
    expect(canTransitionCharge('pending', 'paid')).toBe(false)
    expect(canTransitionCharge('pending', 'under_review')).toBe(true)
    expect(canTransitionCharge('under_review', 'paid')).toBe(true)
    expect(canTransitionCharge('under_review', 'pending')).toBe(true)
  })
})

describe('RF-62.7 · el reporte del pago', () => {
  it('CA-62.6 · sin comprobante, sin medio de pago o por más que el cobro, se rechaza con su clave', () => {
    expect(validateOwnerPayment({ ...REPORTE, receiptPath: null }, COBRO, [])).toEqual(['ownerWallet.payment.validation.receipt_required'])
    expect(validateOwnerPayment({ ...REPORTE, paymentMethodId: '' }, COBRO, [])).toEqual(['ownerWallet.payment.validation.method_required'])
    expect(validateOwnerPayment({ ...REPORTE, amount: pesos(60_000) }, COBRO, [])).toEqual(['ownerWallet.payment.validation.above_charge'])
  })

  it('RF-62.7 · el monto es obligatorio y mayor que cero, la fecha válida y la descripción no vacía', () => {
    expect(validateOwnerPayment({ ...REPORTE, amount: null }, COBRO, [])).toEqual(['ownerWallet.payment.validation.amount_required'])
    expect(validateOwnerPayment({ ...REPORTE, amount: pesos(0) }, COBRO, [])).toEqual(['ownerWallet.payment.validation.amount_required'])
    expect(validateOwnerPayment({ ...REPORTE, paidOn: '2026-13-40' }, COBRO, [])).toEqual(['ownerWallet.payment.validation.date_invalid'])
    expect(validateOwnerPayment({ ...REPORTE, description: '   ' }, COBRO, [])).toEqual(['ownerWallet.payment.validation.description_required'])
  })

  it('RF-62.7 · un abono parcial procede; lo que ya está reportado o confirmado descuenta de lo que se puede reportar', () => {
    expect(validateOwnerPayment({ ...REPORTE, amount: pesos(20_000) }, COBRO, [])).toEqual([])

    const conReportado = [pago({ id: 'p1', amount: pesos(20_000) })]
    expect(pendienteDeReportar(COBRO, conReportado)).toBe(pesos(30_000))
    expect(validateOwnerPayment({ ...REPORTE, amount: pesos(30_000) }, COBRO, conReportado)).toEqual([])
    expect(validateOwnerPayment({ ...REPORTE, amount: pesos(30_001) }, COBRO, conReportado)).toEqual(['ownerWallet.payment.validation.above_charge'])
  })

  it('RF-62.7 · sobre un cobro pagado no se reporta nada', () => {
    expect(validateOwnerPayment(REPORTE, { ...COBRO, status: 'paid', paidAmount: pesos(50_000) }, [])).toEqual(['ownerWallet.payment.validation.charge_closed'])
  })

  it('RF-62.7 · el comprobante va al bucket privado, bajo la propiedad y el Propietario', () => {
    expect(BUCKET_DE_COMPROBANTES_DE_PROPIETARIO).toBe('owner-receipts')
    expect(rutaDeComprobanteDePropietario('prop-1', 'user-pedro', 'pay-1', 'Recibo Banco.PDF')).toBe('prop-1/user-pedro/pay-1.pdf')
    expect(rutaDeComprobanteDePropietario('prop-1', 'user-pedro', 'pay-1', 'sin-extension')).toBe('prop-1/user-pedro/pay-1')
  })
})

describe('RF-62.8 · la confirmación y el rechazo', () => {
  it('CA-62.7 · reportado deja el cobro en revisión sin tocar lo pagado; confirmado lo deja pagado y sin saldo', () => {
    const reportado = pago({ id: 'p1' })
    expect(estadoDelCobro(COBRO, [reportado])).toBe('under_review')
    expect(aplicarPagos(COBRO, [reportado])).toMatchObject({ status: 'under_review', paidAmount: pesos(0) })

    const confirmado = resolveOwnerPayment(reportado, { to: 'confirmed', on: '2026-10-06' })
    expect(confirmado.ok).toBe(true)
    if (!confirmado.ok) {
      return
    }
    expect(confirmado.payment).toMatchObject({ status: 'confirmed', resolvedOn: '2026-10-06' })
    expect(aplicarPagos(COBRO, [confirmado.payment])).toMatchObject({ status: 'paid', paidAmount: pesos(50_000) })
    expect(pendienteDeCobro(COBRO, [confirmado.payment])).toBe(pesos(0))
  })

  it('CA-62.7 · RF-62.2 · solo el pago confirmado entra a la billetera, una sola vez', () => {
    const reportado = pago({ id: 'p1' })
    expect(settleOwnerPayment([], reportado, COBRO, '2026-10-06')).toEqual([])

    const confirmado = { ...reportado, status: 'confirmed' as const, resolvedOn: '2026-10-06' }
    const historico = settleOwnerPayment([], confirmado, COBRO, '2026-10-06')
    expect(historico).toEqual([expect.objectContaining({ kind: 'payment_confirmed', amount: pesos(50_000), paymentId: 'p1', propertyId: 'prop-1' })])
    expect(settleOwnerPayment(historico, confirmado, COBRO, '2026-10-06')).toHaveLength(1)
  })

  it('CA-62.8 · el rechazo exige motivo, no toca el saldo y devuelve el cobro a pendiente', () => {
    const reportado = pago({ id: 'p1' })
    expect(resolveOwnerPayment(reportado, { to: 'rejected', on: '2026-10-06', reason: '  ' })).toEqual({ ok: false, error: 'ownerWallet.payment.errors.reason_required' })

    const rechazado = resolveOwnerPayment(reportado, { to: 'rejected', on: '2026-10-06', reason: 'El comprobante no corresponde.' })
    expect(rechazado.ok).toBe(true)
    if (!rechazado.ok) {
      return
    }
    expect(rechazado.payment).toMatchObject({ status: 'rejected', rejectionReason: 'El comprobante no corresponde.' })
    expect(aplicarPagos(COBRO, [rechazado.payment])).toMatchObject({ status: 'pending', paidAmount: pesos(0) })
  })

  it('CA-62.8 · con otro pago todavía en revisión, el rechazo de uno deja el cobro en revisión', () => {
    const rechazado = pago({ id: 'p1', amount: pesos(20_000), status: 'rejected', rejectionReason: 'Ilegible.', resolvedOn: '2026-10-06' })
    const enRevision = pago({ id: 'p2', amount: pesos(30_000) })

    expect(estadoDelCobro(COBRO, [rechazado, enRevision])).toBe('under_review')
  })

  it('CA-62.9 · un pago ya resuelto no se vuelve a resolver', () => {
    const confirmado = pago({ id: 'p1', status: 'confirmed', resolvedOn: '2026-10-06' })
    expect(resolveOwnerPayment(confirmado, { to: 'confirmed', on: '2026-10-07' })).toEqual({ ok: false, error: 'ownerWallet.payment.errors.invalid_transition' })
    expect(resolveOwnerPayment(confirmado, { to: 'rejected', on: '2026-10-07', reason: 'Tarde.' })).toEqual({ ok: false, error: 'ownerWallet.payment.errors.invalid_transition' })
  })

  it('RF-62.8 · un abono parcial confirmado deja el cobro pendiente por la diferencia', () => {
    const parcial = pago({ id: 'p1', amount: pesos(20_000), status: 'confirmed', resolvedOn: '2026-10-06' })

    expect(aplicarPagos(COBRO, [parcial])).toMatchObject({ status: 'pending', paidAmount: pesos(20_000) })
    expect(pendienteDeCobro(COBRO, [parcial])).toBe(pesos(30_000))
  })
})

describe('RF-62.11 · D-10 · preparado para una pasarela', () => {
  it('CA-62.13 · el pago manual se guarda con canal manual y sin proveedor', () => {
    expect(PAYMENT_CHANNELS).toEqual(['manual', 'gateway'])
    expect(PAYMENT_STATUSES).toEqual(['reported', 'confirmed', 'rejected'])
    expect(pago({ id: 'p1' })).toMatchObject({ channel: 'manual', provider: null, externalReference: null })
  })

  it('CA-62.13 · dos pagos con el mismo proveedor y la misma referencia externa no coexisten', () => {
    const porPasarela = pago({ id: 'p1', channel: 'gateway', provider: 'wompi', externalReference: 'TX-001', receiptPath: null })

    expect(referenciaExternaOcupada([porPasarela], 'wompi', 'TX-001')).toBe(true)
    expect(referenciaExternaOcupada([porPasarela], 'wompi', 'TX-002')).toBe(false)
    expect(referenciaExternaOcupada([porPasarela], 'otra', 'TX-001')).toBe(false)
    // Los pagos manuales no tienen referencia y nunca chocan entre sí.
    expect(referenciaExternaOcupada([pago({ id: 'p2' }), pago({ id: 'p3' })], null, null)).toBe(false)
  })
})
