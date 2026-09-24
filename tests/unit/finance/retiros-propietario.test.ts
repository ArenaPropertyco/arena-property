import { describe, expect, it } from 'vitest'
import {
  canTransitionOwnerWithdrawal,
  hasOpenOwnerWithdrawal,
  OWNER_WITHDRAWAL_STATUSES,
  OWNER_WITHDRAWAL_TRANSITIONS,
  settleOwnerWithdrawal,
  transitionOwnerWithdrawal,
  validateOwnerWithdrawal,
} from '#shared/finance/retiros-propietario'
import type { NuevoRetiroDePropietario, OwnerWithdrawal } from '#shared/finance/retiros-propietario'
import { pesos } from '#shared/money/importe'

/**
 * HU-62 · RF-62.9 · D-51 — el retiro del saldo positivo de una propiedad.
 *
 * Pedro tiene +$630.000 en la Casa P2. Pide retirar una parte indicando su
 * cuenta; el ciclo es `solicitado → pagado` o `solicitado → rechazado` con
 * motivo, y solo hay una solicitud abierta por Propietario y propiedad. La base
 * repite lo mismo con una restricción única y funciones que validan antes de
 * escribir.
 */

const HOY = '2026-10-05'

const NUEVO: NuevoRetiroDePropietario = {
  amount: pesos(300_000), bank: 'Bancolombia', accountKind: 'savings', accountNumber: '11111111', holder: 'Pedro Pérez',
}

function retiro(cambios: Partial<OwnerWithdrawal> = {}): OwnerWithdrawal {
  return {
    id: 'w-1', ownerId: 'user-pedro', propertyId: 'prop-2', amount: pesos(300_000), status: 'requested', requestedOn: HOY,
    resolvedOn: null, rejectionReason: null, receiptPath: null,
    bank: 'Bancolombia', accountKind: 'savings', accountNumber: '11111111', holder: 'Pedro Pérez',
    ...cambios,
  }
}

describe('RF-62.9 · la solicitud', () => {
  it('CA-62.10 · con +$630.000 no se retiran $700.000; $300.000 sí', () => {
    expect(validateOwnerWithdrawal({ ...NUEVO, amount: pesos(700_000) }, pesos(630_000), [])).toEqual(['ownerWallet.withdrawal.validation.above_balance'])
    expect(validateOwnerWithdrawal(NUEVO, pesos(630_000), [])).toEqual([])
  })

  it('RF-62.9 · el monto es obligatorio y mayor que cero, y un saldo negativo o cero no se retira', () => {
    expect(validateOwnerWithdrawal({ ...NUEVO, amount: null }, pesos(630_000), [])).toEqual(['ownerWallet.withdrawal.validation.amount_required'])
    expect(validateOwnerWithdrawal({ ...NUEVO, amount: pesos(0) }, pesos(630_000), [])).toEqual(['ownerWallet.withdrawal.validation.amount_required'])
    expect(validateOwnerWithdrawal(NUEVO, pesos(-50_000), [])).toEqual(['ownerWallet.withdrawal.validation.above_balance'])
  })

  it('RF-62.9 · la cuenta de destino es obligatoria y completa', () => {
    expect(validateOwnerWithdrawal({ ...NUEVO, bank: ' ' }, pesos(630_000), [])).toEqual(['ownerWallet.withdrawal.validation.bank_required'])
    expect(validateOwnerWithdrawal({ ...NUEVO, accountNumber: '' }, pesos(630_000), [])).toEqual(['ownerWallet.withdrawal.validation.account_required'])
    expect(validateOwnerWithdrawal({ ...NUEVO, holder: '' }, pesos(630_000), [])).toEqual(['ownerWallet.withdrawal.validation.holder_required'])
    expect(validateOwnerWithdrawal({ ...NUEVO, accountKind: 'bitcoin' as never }, pesos(630_000), [])).toEqual(['ownerWallet.withdrawal.validation.account_kind_required'])
  })

  it('CA-62.10 · con una solicitud abierta sobre la misma propiedad, la segunda se rechaza; sobre otra propiedad, no', () => {
    const abierta = retiro()
    expect(hasOpenOwnerWithdrawal([abierta], 'prop-2')).toBe(true)
    expect(hasOpenOwnerWithdrawal([abierta], 'prop-1')).toBe(false)
    expect(hasOpenOwnerWithdrawal([retiro({ status: 'paid' })], 'prop-2')).toBe(false)
    expect(validateOwnerWithdrawal(NUEVO, pesos(630_000), [abierta], 'prop-2')).toEqual(['ownerWallet.withdrawal.validation.open_request'])
    expect(validateOwnerWithdrawal(NUEVO, pesos(630_000), [abierta], 'prop-1')).toEqual([])
  })
})

describe('RF-62.9 · el ciclo', () => {
  it('RF-62.9 · solicitado va a pagado o a rechazado, y los finales no se mueven', () => {
    expect(OWNER_WITHDRAWAL_STATUSES).toEqual(['requested', 'paid', 'rejected'])
    expect(OWNER_WITHDRAWAL_TRANSITIONS).toEqual({ requested: ['paid', 'rejected'], paid: [], rejected: [] })
  })

  it('CA-62.9 · pagado → rechazado y rechazado → pagado se rechazan', () => {
    expect(canTransitionOwnerWithdrawal('paid', 'rejected')).toBe(false)
    expect(canTransitionOwnerWithdrawal('rejected', 'paid')).toBe(false)
    expect(transitionOwnerWithdrawal(retiro({ status: 'paid' }), { to: 'rejected', on: HOY, reason: 'Tarde.' })).toEqual({ ok: false, error: 'ownerWallet.withdrawal.errors.invalid_transition' })
  })

  it('CA-62.10 · pagar exige comprobante y deja el retiro pagado con su fecha', () => {
    expect(transitionOwnerWithdrawal(retiro(), { to: 'paid', on: '2026-10-08' })).toEqual({ ok: false, error: 'ownerWallet.withdrawal.errors.receipt_required' })

    const pagado = transitionOwnerWithdrawal(retiro(), { to: 'paid', on: '2026-10-08', receiptPath: 'prop-2/user-pedro/w-1.pdf' })
    expect(pagado.ok).toBe(true)
    if (pagado.ok) {
      expect(pagado.request).toMatchObject({ status: 'paid', resolvedOn: '2026-10-08', receiptPath: 'prop-2/user-pedro/w-1.pdf' })
    }
  })

  it('RF-62.9 · rechazar exige motivo y lo guarda limpio', () => {
    expect(transitionOwnerWithdrawal(retiro(), { to: 'rejected', on: HOY, reason: '' })).toEqual({ ok: false, error: 'ownerWallet.withdrawal.errors.reason_required' })

    const rechazado = transitionOwnerWithdrawal(retiro(), { to: 'rejected', on: HOY, reason: '  Cuenta inválida.  ' })
    expect(rechazado.ok).toBe(true)
    if (rechazado.ok) {
      expect(rechazado.request).toMatchObject({ status: 'rejected', rejectionReason: 'Cuenta inválida.' })
    }
  })

  it('CA-62.10 · RF-62.2 · el retiro pagado resta del saldo de esa propiedad, una sola vez; el solicitado no', () => {
    expect(settleOwnerWithdrawal([], retiro(), '2026-10-08')).toEqual([])

    const pagado = retiro({ status: 'paid', resolvedOn: '2026-10-08', receiptPath: 'prop-2/user-pedro/w-1.pdf' })
    const historico = settleOwnerWithdrawal([], pagado, '2026-10-08')
    expect(historico).toEqual([expect.objectContaining({ kind: 'withdrawal_paid', amount: pesos(-300_000), withdrawalId: 'w-1', propertyId: 'prop-2' })])
    expect(settleOwnerWithdrawal(historico, pagado, '2026-10-08')).toHaveLength(1)
  })
})
