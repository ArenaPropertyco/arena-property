import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import type { Attribution } from '#shared/referrals/attribution'
import type { CommissionType } from '#shared/referrals/commission'
import {
  balances,
  COMMISSION_STATUSES,
  credit,
  emptyLedger,
  GRACE_PERIOD_DAYS,
  graceEndsOn,
  isWithdrawable,
  provision,
  recoveryFor,
  releaseGrace,
  reverse,
  suspend,
} from '#shared/referrals/ledger'
import type { Commission, CommissionLedger, PurchaseOfProspect } from '#shared/referrals/ledger'

/**
 * HU-54 · RF-54.1…RF-54.7 · D-01, D-02, D-04, D-07 — la liberación de la comisión
 * y su periodo de gracia.
 *
 * Ana es Embajadora con el tipo V1 (3 % del precio pactado). Su referido cierra
 * una compra de $100.000.000 el 1 de septiembre de 2026 y completa el pago el 10.
 * La comisión de $3.000.000 queda en gracia hasta el 10 de octubre y luego pasa a
 * disponible. Todo lo que sigue es puro: la base repite las mismas reglas.
 */

const V1: CommissionType = {
  id: 'tipo-v1', name: 'V1', kind: 'percentage', amount: null, basisPoints: 300,
  isDefault: true, active: true, createdBy: 'super', createdAt: '2026-08-01T10:00:00Z',
}

const COMPLETADO = '2026-09-10'

function atribucion(cambios: Partial<Attribution> = {}): Attribution {
  return {
    id: 'atr-1', ambassadorId: 'amb-ana', code: 'ARENA234', prospectId: 'user-p', prospectEmail: 'p@correo.co',
    clickedAt: '2026-08-01', registeredAt: '2026-08-05', stage: 'payment_in_progress', commissionedPurchaseId: null,
    ...cambios,
  }
}

const PLAN = { id: 'plan-1', agreedPrice: pesos(100_000_000), propertyId: 'p1', fractionNumber: 3 }

/** El libro con la comisión ya provisionada como pendiente. */
function conPendiente(): CommissionLedger {
  return provision(emptyLedger(), atribucion(), PLAN, V1, '2026-09-01')
}

/** El libro con la comisión ya acreditada y en gracia. */
function enGracia(): CommissionLedger {
  return credit(conPendiente(), 'plan-1', COMPLETADO)
}

function comision(libro: CommissionLedger): Commission {
  return libro.commissions[0]!
}

describe('RF-54.1 · el ciclo del saldo', () => {
  it('RF-54.1 · los estados son exactamente pendiente, en gracia, disponible, retirada y reversada', () => {
    expect(COMMISSION_STATUSES).toEqual(['pending', 'in_grace', 'available', 'withdrawn', 'reversed'])
  })

  it('D-02 · la gracia dura 30 días desde el pago completo', () => {
    expect(GRACE_PERIOD_DAYS).toBe(30)
    expect(graceEndsOn(COMPLETADO)).toBe('2026-10-10')
    expect(graceEndsOn('2026-12-15')).toBe('2027-01-14')
  })
})

describe('CA-54.1 · la acreditación al completarse el pago', () => {
  it('RF-53.3 · al cerrarse la compra queda pendiente el monto de V1 sobre el precio pactado', () => {
    const libro = conPendiente()

    expect(comision(libro)).toMatchObject({
      attributionId: 'atr-1', ambassadorId: 'amb-ana', planId: 'plan-1',
      commissionTypeId: 'tipo-v1', agreedPrice: pesos(100_000_000), amount: pesos(3_000_000), status: 'pending',
    })
    expect(balances(libro.commissions)).toEqual({ pending: pesos(3_000_000), inGrace: 0, available: 0, withdrawn: 0 })
  })

  it('CA-54.1 · al completarse el pago se acreditan exactamente los $3.000.000 en gracia y lo pendiente baja en ese monto', () => {
    const libro = enGracia()

    expect(comision(libro)).toMatchObject({ status: 'in_grace', completedOn: COMPLETADO, graceEndsOn: '2026-10-10' })
    expect(balances(libro.commissions)).toEqual({ pending: 0, inGrace: pesos(3_000_000), available: 0, withdrawn: 0 })
    expect(libro.movements).toEqual([
      expect.objectContaining({ kind: 'commission_credited', amount: pesos(3_000_000), commissionId: comision(libro).id, occurredOn: COMPLETADO }),
    ])
  })

  it('RF-54.2 · D-05 · el monto sale del precio pactado, no de un precio de lista posterior', () => {
    const libro = provision(emptyLedger(), atribucion(), { ...PLAN, agreedPrice: pesos(80_000_000) }, V1, '2026-09-01')

    expect(comision(libro).amount).toBe(pesos(2_400_000))
  })

  it('RF-54.2 · un tipo de importe fijo acredita ese importe sea cual sea el precio', () => {
    const fijo: CommissionType = { ...V1, id: 'tipo-fijo', kind: 'fixed', amount: pesos(1_500_000), basisPoints: null }
    const libro = provision(emptyLedger(), atribucion(), PLAN, fijo, '2026-09-01')

    expect(comision(libro).amount).toBe(pesos(1_500_000))
  })

  it('principio 9 · sin tipo aplicable no se inventa una comisión', () => {
    expect(provision(emptyLedger(), atribucion(), PLAN, null, '2026-09-01').commissions).toEqual([])
  })
})

describe('CA-54.2 · el paso de gracia a disponible a los 30 días', () => {
  it('CA-54.2 · a los 29 días sigue en gracia y no es retirable', () => {
    const libro = releaseGrace(enGracia(), '2026-10-09')

    expect(comision(libro).status).toBe('in_grace')
    expect(isWithdrawable(comision(libro))).toBe(false)
    expect(libro.movements).toHaveLength(1)
  })

  it('CA-54.2 · a los 30 días pasa a disponible con su movimiento de billetera', () => {
    const libro = releaseGrace(enGracia(), '2026-10-10')

    expect(comision(libro)).toMatchObject({ status: 'available', availableOn: '2026-10-10' })
    expect(isWithdrawable(comision(libro))).toBe(true)
    expect(balances(libro.commissions)).toEqual({ pending: 0, inGrace: 0, available: pesos(3_000_000), withdrawn: 0 })
    expect(libro.movements.at(-1)).toMatchObject({ kind: 'commission_available', amount: pesos(3_000_000), occurredOn: '2026-10-10' })
  })

  it('DT-09 · correr la tarea otra vez no vuelve a mover nada', () => {
    const una = releaseGrace(enGracia(), '2026-10-10')
    const dos = releaseGrace(una, '2026-10-11')

    expect(dos).toEqual(una)
  })

  it('RF-54.1 · una comisión pendiente no sale a disponible aunque pasen los días', () => {
    const libro = releaseGrace(conPendiente(), '2027-01-01')

    expect(comision(libro).status).toBe('pending')
  })
})

describe('CA-54.3 · idempotencia de la acreditación', () => {
  it('CA-54.3 · el mismo evento de pago procesado dos veces acredita una sola vez', () => {
    const una = credit(conPendiente(), 'plan-1', COMPLETADO)
    const dos = credit(una, 'plan-1', COMPLETADO)

    expect(dos).toEqual(una)
    expect(dos.movements.filter(m => m.kind === 'commission_credited')).toHaveLength(1)
    expect(dos.platform).toHaveLength(1)
  })

  it('RF-54.4 · un evento de un plan sin comisión no hace nada', () => {
    const libro = credit(conPendiente(), 'plan-ajeno', COMPLETADO)

    expect(libro).toEqual(conPendiente())
  })
})

describe('CA-54.4 · la reversa dentro de la gracia', () => {
  it('CA-54.4 · una anulación al día 10 reversa la comisión y el saldo vuelve al estado previo', () => {
    const libro = reverse(enGracia(), 'plan-1', '2026-09-20', 'Desistimiento firmado.')

    expect(comision(libro)).toMatchObject({ status: 'reversed', reversedOn: '2026-09-20', reversalReason: 'Desistimiento firmado.' })
    expect(balances(libro.commissions)).toEqual({ pending: 0, inGrace: 0, available: 0, withdrawn: 0 })
    expect(libro.movements.at(-1)).toMatchObject({ kind: 'commission_reversed', amount: pesos(3_000_000), occurredOn: '2026-09-20' })
  })

  it('RF-54.5 · D-01 · la reversa deja el contra-asiento en el libro de plataforma', () => {
    const libro = reverse(enGracia(), 'plan-1', '2026-09-20', 'Desistimiento firmado.')

    expect(libro.platform).toEqual([
      expect.objectContaining({ sourceId: comision(libro).id, reversedOn: '2026-09-20', reverseReason: 'Desistimiento firmado.' }),
    ])
  })

  it('CA-54.4 · una anulación al día 45 no toca el saldo disponible y Arena asume la pérdida', () => {
    const disponible = releaseGrace(enGracia(), '2026-10-10')
    const libro = reverse(disponible, 'plan-1', '2026-10-25', 'Desistimiento tardío.')

    expect(comision(libro)).toMatchObject({ status: 'available', lossAssumedOn: '2026-10-25' })
    expect(balances(libro.commissions).available).toBe(pesos(3_000_000))
    expect(libro.movements).toEqual(disponible.movements)
    expect(libro.platform[0]!.reversedOn).toBeNull()
  })

  it('RF-54.5 · anular mientras está pendiente la reversa sin haber tocado la billetera ni el libro', () => {
    const libro = reverse(conPendiente(), 'plan-1', '2026-09-05', 'Se arrepintió.')

    expect(comision(libro).status).toBe('reversed')
    expect(libro.movements).toEqual([])
    expect(libro.platform).toEqual([])
  })
})

describe('CA-54.5 · el devengo en el libro de plataforma', () => {
  it('CA-54.5 · la acreditación deja exactamente un egreso en el libro de plataforma y nada en la propiedad', () => {
    const libro = enGracia()

    expect(libro.platform).toEqual([{
      sourceType: 'ambassador_commission', sourceId: comision(libro).id, kind: 'expense',
      amount: pesos(3_000_000), accruedOn: COMPLETADO, reversedOn: null, reverseReason: null,
    }])
    expect(libro.propertyShares).toEqual([])
  })

  it('RF-54.6 · pasar a disponible no genera un segundo egreso', () => {
    const libro = releaseGrace(enGracia(), '2026-10-10')

    expect(libro.platform).toHaveLength(1)
  })
})

describe('CA-54.6 · CA-54.7 · una sola comisión por prospecto', () => {
  it('CA-54.6 · un referido que compra una segunda fracción no genera una segunda comisión', () => {
    const pagado = releaseGrace(enGracia(), '2026-10-10')
    const ya = atribucion({ stage: 'paid', commissionedPurchaseId: 'plan-1' })
    const libro = provision(pagado, ya, { ...PLAN, id: 'plan-2', fractionNumber: 5 }, V1, '2026-11-01')

    expect(libro.commissions).toHaveLength(1)
    expect(libro).toEqual(pagado)
  })

  it('D-04 · mientras una comisión de la atribución sigue viva no se provisiona otra', () => {
    const libro = provision(conPendiente(), atribucion(), { ...PLAN, id: 'plan-2' }, V1, '2026-09-02')

    expect(libro.commissions).toHaveLength(1)
  })

  it('D-04 · una compra anulada antes de completarse deja la vía libre a la siguiente', () => {
    const anulada = reverse(conPendiente(), 'plan-1', '2026-09-05', 'Se arrepintió.')
    const libro = provision(anulada, atribucion({ stage: 'payment_in_progress' }), { ...PLAN, id: 'plan-2' }, V1, '2026-09-06')

    expect(libro.commissions.map(c => c.status)).toEqual(['reversed', 'pending'])
  })

  it('CA-54.7 · un referido en «Registrado» no tiene saldo pendiente, en gracia ni disponible', () => {
    const libro = provision(emptyLedger(), atribucion({ stage: 'registered' }), PLAN, V1, '2026-09-01')

    expect(libro.commissions).toEqual([])
    expect(balances(libro.commissions)).toEqual({ pending: 0, inGrace: 0, available: 0, withdrawn: 0 })
  })
})

describe('CA-54.8 · el efecto de la suspensión según su tipo', () => {
  /** Ana tiene una pendiente, una en gracia y una disponible de tres referidos. */
  function tresSaldos(): CommissionLedger {
    let libro = emptyLedger()
    libro = provision(libro, atribucion({ id: 'atr-1', prospectId: 'u1' }), { ...PLAN, id: 'plan-1' }, V1, '2026-07-01')
    libro = provision(libro, atribucion({ id: 'atr-2', prospectId: 'u2' }), { ...PLAN, id: 'plan-2' }, V1, '2026-08-01')
    libro = provision(libro, atribucion({ id: 'atr-3', prospectId: 'u3' }), { ...PLAN, id: 'plan-3' }, V1, '2026-09-01')
    libro = credit(libro, 'plan-1', '2026-07-10')
    libro = credit(libro, 'plan-2', '2026-09-01')
    return releaseGrace(libro, '2026-09-15')
  }

  it('CA-54.8 · una suspensión administrativa conserva el saldo íntegro', () => {
    const antes = tresSaldos()
    const libro = suspend(antes, 'amb-ana', 'administrative', '2026-09-16', 'Documentos vencidos.')

    expect(libro).toEqual(antes)
    expect(balances(libro.commissions)).toEqual({ pending: pesos(3_000_000), inGrace: pesos(3_000_000), available: pesos(3_000_000), withdrawn: 0 })
  })

  it('CA-54.8 · una suspensión por fraude cancela lo pendiente y lo en gracia con motivo y no toca lo disponible', () => {
    const libro = suspend(tresSaldos(), 'amb-ana', 'breach_or_fraud', '2026-09-16', 'Autorreferencia probada.')

    expect(libro.commissions.map(c => [c.planId, c.status])).toEqual([['plan-1', 'available'], ['plan-2', 'reversed'], ['plan-3', 'reversed']])
    expect(libro.commissions.filter(c => c.status === 'reversed').every(c => c.reversalReason === 'Autorreferencia probada.')).toBe(true)
    expect(balances(libro.commissions)).toEqual({ pending: 0, inGrace: 0, available: pesos(3_000_000), withdrawn: 0 })
  })

  it('RF-54.7 · D-01 · lo que estaba en gracia se reversa también en el libro de plataforma', () => {
    const libro = suspend(tresSaldos(), 'amb-ana', 'breach_or_fraud', '2026-09-16', 'Autorreferencia probada.')
    const enGracia = libro.commissions.find(c => c.planId === 'plan-2')!

    expect(libro.platform.find(e => e.sourceId === enGracia.id)).toMatchObject({ reversedOn: '2026-09-16' })
    expect(libro.movements.at(-1)).toMatchObject({ kind: 'commission_reversed', commissionId: enGracia.id })
  })

  it('RF-54.7 · la suspensión de otro Embajador no toca las comisiones de Ana', () => {
    const antes = tresSaldos()

    expect(suspend(antes, 'amb-luis', 'breach_or_fraud', '2026-09-16', 'Fraude.')).toEqual(antes)
  })
})

describe('RF-51.3 · D-04 · la atribución que llega después de la compra', () => {
  /** Quien hizo clic, no escribió el código al registrarse y compró antes de entrar al panel. */
  const tarde = atribucion({ stage: 'registered' })

  function compra(cambios: Partial<PurchaseOfProspect> = {}): PurchaseOfProspect {
    return { ...PLAN, closedOn: '2026-09-01', voided: false, completedOn: null, ...cambios }
  }

  it('RF-51.3 · con una compra en proceso, el referido se pone al día en «en proceso de pago»', () => {
    expect(recoveryFor(tarde, [compra()])).toEqual({ purchase: compra(), stage: 'payment_in_progress' })
  })

  it('RF-54.2 · con el pago ya completado, se pone al día hasta «pago completado»', () => {
    const pagada = compra({ completedOn: '2026-09-10' })

    expect(recoveryFor(tarde, [pagada])).toEqual({ purchase: pagada, stage: 'paid' })
  })

  it('D-04 · entre varias compras recupera la primera, que es la única que paga comisión', () => {
    const primera = compra({ id: 'plan-1', closedOn: '2026-09-01' })
    const segunda = compra({ id: 'plan-2', closedOn: '2026-10-01' })

    expect(recoveryFor(tarde, [segunda, primera])?.purchase.id).toBe('plan-1')
  })

  it('RF-58.8 · una compra anulada no recupera nada, y se pasa a la siguiente que siga viva', () => {
    const anulada = compra({ id: 'plan-1', closedOn: '2026-09-01', voided: true })
    const viva = compra({ id: 'plan-2', closedOn: '2026-10-01' })

    expect(recoveryFor(tarde, [anulada])).toBeNull()
    expect(recoveryFor(tarde, [anulada, viva])?.purchase.id).toBe('plan-2')
  })

  it('sin compras no hay nada que recuperar', () => {
    expect(recoveryFor(tarde, [])).toBeNull()
  })

  it('RF-51.3 · un referido que ya va por su cauce normal no se toca', () => {
    expect(recoveryFor(atribucion({ stage: 'payment_in_progress' }), [compra()])).toBeNull()
    expect(recoveryFor(atribucion({ stage: 'paid' }), [compra({ completedOn: '2026-09-10' })])).toBeNull()
  })

  it('CA-54.6 · D-04 · quien ya cobró su única comisión no recupera una segunda', () => {
    const ya = atribucion({ stage: 'registered', commissionedPurchaseId: 'plan-0' })

    expect(recoveryFor(ya, [compra()])).toBeNull()
  })
})

describe('D-02 · la gracia de una comisión recuperada', () => {
  it('D-02 · cuenta desde el día en que el pago se completó, no desde la atribución tardía', () => {
    const libro = credit(conPendiente(), 'plan-1', '2026-07-01')

    expect(comision(libro).graceEndsOn).toBe('2026-07-31')
  })

  it('CA-54.2 · si esos 30 días ya pasaron, la comisión sale a disponible en la siguiente pasada', () => {
    const libro = releaseGrace(credit(conPendiente(), 'plan-1', '2026-07-01'), '2026-09-20')

    expect(comision(libro)).toMatchObject({ status: 'available', availableOn: '2026-09-20' })
    expect(balances(libro.commissions).available).toBe(pesos(3_000_000))
  })
})
