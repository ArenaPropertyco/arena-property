import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import { walletBalances } from '#shared/referrals/wallet'
import type { WalletEntry } from '#shared/referrals/wallet'
import {
  canTransition,
  DEFAULT_MINIMUM_WITHDRAWAL,
  hasOpenWithdrawal,
  OPEN_WITHDRAWAL_STATUSES,
  settle,
  transition,
  validateMinimum,
  validateWithdrawal,
  WITHDRAWAL_STATUSES,
  WITHDRAWAL_TRANSITIONS,
  withdrawalMinimum,
} from '#shared/referrals/withdrawals'
import type { WithdrawalLedger, WithdrawalRequest } from '#shared/referrals/withdrawals'

/**
 * HU-56 · RF-56.1…RF-56.6 · D-01 · D-06 · D-20 — la solicitud de retiro y su
 * ciclo. Ana tiene $1.000.000 disponibles; el mínimo configurado es el inicial
 * de D-06, $200.000. Todo es puro: la base repite las mismas reglas con una
 * restricción única para la solicitud abierta y con funciones que validan lo
 * mismo antes de escribir.
 */

const HOY = '2026-10-15'

function solicitud(cambios: Partial<WithdrawalRequest> = {}): WithdrawalRequest {
  return {
    id: 'w-1', ambassadorId: 'amb-ana', amount: pesos(300_000), status: 'requested',
    requestedOn: HOY, resolvedOn: null, paidOn: null, rejectionReason: null, receiptPath: null,
    ...cambios,
  }
}

/** La billetera de Ana con $1.000.000 ya disponibles. */
const ACREDITADA: WalletEntry = {
  id: 'm-1', kind: 'commission_credited', amount: pesos(1_000_000), occurredOn: '2026-09-01', createdAt: '2026-09-01T10:00:00Z',
  commissionId: 'c-1', withdrawalId: null, referralLabel: 'p@correo.co', propertyName: null, fractionNumber: null, graceEndsOn: '2026-10-01', note: null,
}
const DISPONIBLE: WalletEntry = { ...ACREDITADA, id: 'm-2', kind: 'commission_available', occurredOn: '2026-10-01', createdAt: '2026-10-01T05:20:00Z', graceEndsOn: null }

function billetera(): WithdrawalLedger {
  return { entries: [ACREDITADA, DISPONIBLE], platform: [{ kind: 'expense', sourceType: 'ambassador_commission', sourceId: 'c-1', amount: pesos(1_000_000), accruedOn: '2026-09-01', reversedOn: null, reverseReason: null }] }
}

const cartera = { available: pesos(1_000_000), minimum: DEFAULT_MINIMUM_WITHDRAWAL }

describe('RF-56.1 · D-06 · el mínimo configurable', () => {
  it('D-06 · el valor inicial es $200.000 y rige cuando el Superadmin no fijó otro', () => {
    expect(DEFAULT_MINIMUM_WITHDRAWAL).toBe(pesos(200_000))
    expect(withdrawalMinimum(null)).toBe(pesos(200_000))
    expect(withdrawalMinimum(pesos(350_000))).toBe(pesos(350_000))
  })

  it('RF-56.1 · el Superadmin solo puede fijar un entero mayor que cero', () => {
    expect(validateMinimum(pesos(250_000))).toBeNull()
    expect(validateMinimum(pesos(0))).toBe('wallet.minimum.validation.not_positive')
    expect(validateMinimum(null)).toBe('wallet.minimum.validation.not_positive')
  })
})

describe('CA-56.1 · lo que impide solicitar', () => {
  it('CA-56.1 · por debajo del mínimo se rechaza con su clave traducible', () => {
    expect(validateWithdrawal(pesos(150_000), cartera, [])).toEqual(['wallet.withdrawal.validation.below_minimum'])
  })

  it('CA-56.1 · por encima del disponible se rechaza; lo en gracia nunca cuenta (RT-08)', () => {
    expect(validateWithdrawal(pesos(1_000_001), cartera, [])).toEqual(['wallet.withdrawal.validation.above_available'])
  })

  it('CA-56.1 · sin monto, o con uno que no es entero positivo, se rechaza', () => {
    expect(validateWithdrawal(null, cartera, [])).toEqual(['wallet.withdrawal.validation.amount_required'])
    expect(validateWithdrawal(pesos(0), cartera, [])).toEqual(['wallet.withdrawal.validation.amount_required'])
  })

  it('RF-56.1 · el mínimo vigente es el que manda, no el inicial', () => {
    expect(validateWithdrawal(pesos(240_000), { ...cartera, minimum: pesos(250_000) }, [])).toEqual(['wallet.withdrawal.validation.below_minimum'])
    expect(validateWithdrawal(pesos(250_000), { ...cartera, minimum: pesos(250_000) }, [])).toEqual([])
  })
})

describe('CA-56.2 · el retiro parcial y el descuento al aprobarse', () => {
  it('CA-56.2 · RF-56.1 · con $1.000.000 disponibles, $300.000 se aceptan', () => {
    expect(validateWithdrawal(pesos(300_000), cartera, [])).toEqual([])
    expect(validateWithdrawal(pesos(1_000_000), cartera, [])).toEqual([])
  })

  it('CA-56.2 · RF-56.3 · solicitar no descuenta; al aprobarse el disponible queda en $700.000', () => {
    const solicitada = settle(billetera(), solicitud(), 'requested', HOY)
    expect(walletBalances(solicitada.entries, []).available).toBe(pesos(1_000_000))

    const aprobada = settle(solicitada, solicitud({ status: 'approved' }), 'approved', '2026-10-16')
    expect(walletBalances(aprobada.entries, []).available).toBe(pesos(700_000))
    expect(walletBalances(aprobada.entries, []).withdrawn).toBe(pesos(300_000))
  })
})

describe('CA-56.3 · la máquina de estados', () => {
  it('RF-56.2 · los estados son solicitada, aprobada, pagada y rechazada, y las transiciones son explícitas', () => {
    expect(WITHDRAWAL_STATUSES).toEqual(['requested', 'approved', 'paid', 'rejected'])
    expect(WITHDRAWAL_TRANSITIONS).toEqual({ requested: ['approved', 'rejected'], approved: ['paid'], paid: [], rejected: [] })
    expect(OPEN_WITHDRAWAL_STATUSES).toEqual(['requested', 'approved'])
  })

  it('CA-56.3 · pagada no vuelve a solicitada, y no se paga sin aprobar', () => {
    expect(canTransition('paid', 'requested')).toBe(false)
    expect(canTransition('requested', 'paid')).toBe(false)
    expect(canTransition('rejected', 'approved')).toBe(false)
    expect(canTransition('approved', 'rejected')).toBe(false)
    expect(canTransition('requested', 'approved')).toBe(true)
    expect(canTransition('requested', 'rejected')).toBe(true)
    expect(canTransition('approved', 'paid')).toBe(true)
  })

  it('CA-56.3 · una transición inválida devuelve su error y deja la solicitud como estaba', () => {
    const pagada = solicitud({ status: 'paid', paidOn: HOY, receiptPath: 'amb-ana/w-1.pdf' })

    expect(transition(pagada, { to: 'requested', on: HOY })).toEqual({ ok: false, error: 'wallet.withdrawal.errors.invalid_transition' })
    expect(transition(solicitud(), { to: 'paid', on: HOY, receiptPath: 'amb-ana/w-1.pdf' })).toEqual({ ok: false, error: 'wallet.withdrawal.errors.invalid_transition' })
  })

  it('RF-56.2 · aprobar deja la fecha de resolución', () => {
    const resultado = transition(solicitud(), { to: 'approved', on: '2026-10-16' })
    expect(resultado).toEqual({ ok: true, request: solicitud({ status: 'approved', resolvedOn: '2026-10-16' }) })
  })
})

describe('CA-56.4 · el rechazo', () => {
  it('CA-56.4 · exige motivo; sin él no cambia nada', () => {
    expect(transition(solicitud(), { to: 'rejected', on: HOY })).toEqual({ ok: false, error: 'wallet.withdrawal.errors.reason_required' })
    expect(transition(solicitud(), { to: 'rejected', on: HOY, reason: '   ' })).toEqual({ ok: false, error: 'wallet.withdrawal.errors.reason_required' })
  })

  it('CA-56.4 · RF-56.3 · con motivo, queda registrado y el disponible no cambia', () => {
    const resultado = transition(solicitud(), { to: 'rejected', on: HOY, reason: ' Cuenta bancaria inválida. ' })
    expect(resultado).toEqual({ ok: true, request: solicitud({ status: 'rejected', resolvedOn: HOY, rejectionReason: 'Cuenta bancaria inválida.' }) })

    const libro = settle(settle(billetera(), solicitud(), 'requested', HOY), solicitud({ status: 'rejected' }), 'rejected', HOY)
    expect(walletBalances(libro.entries, []).available).toBe(pesos(1_000_000))
    expect(libro.entries.filter(e => e.withdrawalId === 'w-1').map(e => e.kind)).toEqual(['withdrawal_requested'])
  })
})

describe('CA-56.5 · una sola solicitud abierta', () => {
  it('CA-56.5 · RF-56.3 · con una abierta, otra se rechaza; una pagada o rechazada no cuenta', () => {
    expect(hasOpenWithdrawal([solicitud()])).toBe(true)
    expect(hasOpenWithdrawal([solicitud({ status: 'approved' })])).toBe(true)
    expect(hasOpenWithdrawal([solicitud({ status: 'paid' }), solicitud({ id: 'w-2', status: 'rejected' })])).toBe(false)

    expect(validateWithdrawal(pesos(300_000), cartera, [solicitud()])).toEqual(['wallet.withdrawal.validation.open_request'])
    expect(validateWithdrawal(pesos(300_000), cartera, [solicitud({ status: 'paid' })])).toEqual([])
  })
})

describe('CA-56.6 · el pago exige comprobante', () => {
  const aprobada = solicitud({ status: 'approved', resolvedOn: '2026-10-16' })

  it('CA-56.6 · RF-56.4 · sin comprobante, el paso a pagada se rechaza', () => {
    expect(transition(aprobada, { to: 'paid', on: '2026-10-20' })).toEqual({ ok: false, error: 'wallet.withdrawal.errors.receipt_required' })
    expect(transition(aprobada, { to: 'paid', on: '2026-10-20', receiptPath: '' })).toEqual({ ok: false, error: 'wallet.withdrawal.errors.receipt_required' })
  })

  it('RF-56.4 · con comprobante, queda pagada con su fecha y su ruta', () => {
    expect(transition(aprobada, { to: 'paid', on: '2026-10-20', receiptPath: 'amb-ana/w-1-x.pdf' }))
      .toEqual({ ok: true, request: { ...aprobada, status: 'paid', paidOn: '2026-10-20', receiptPath: 'amb-ana/w-1-x.pdf' } })
  })
})

describe('CA-56.7 · el pago no genera un segundo egreso (D-01)', () => {
  it('CA-56.7 · RF-56.5 · pagar deja el movimiento de billetera y el libro de plataforma intacto', () => {
    const antes = billetera()
    const aprobada = settle(settle(antes, solicitud(), 'requested', HOY), solicitud({ status: 'approved' }), 'approved', '2026-10-16')
    const pagada = settle(aprobada, solicitud({ status: 'paid', receiptPath: 'amb-ana/w-1.pdf' }), 'paid', '2026-10-20')

    expect(pagada.platform).toEqual(antes.platform)
    expect(pagada.platform).toHaveLength(1)
    expect(pagada.entries.at(-1)).toMatchObject({ kind: 'withdrawal_paid', withdrawalId: 'w-1', amount: pesos(300_000), occurredOn: '2026-10-20' })
    expect(walletBalances(pagada.entries, []).available).toBe(pesos(700_000))
  })

  it('RF-56.5 · el mismo asiento no se duplica aunque se liquide dos veces', () => {
    const aprobada = settle(settle(billetera(), solicitud(), 'requested', HOY), solicitud({ status: 'approved' }), 'approved', '2026-10-16')
    const dosVeces = settle(aprobada, solicitud({ status: 'approved' }), 'approved', '2026-10-16')

    expect(dosVeces.entries).toEqual(aprobada.entries)
  })
})
