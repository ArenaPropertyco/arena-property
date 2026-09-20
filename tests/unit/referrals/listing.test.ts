import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import { commissionFor } from '#shared/referrals/commission'
import type { CommissionType } from '#shared/referrals/commission'
import {
  commissionShown,
  emptyReferralFilter,
  filterReferrals,
  hasActiveReferralFilter,
  REFERRAL_STATES,
  referralTotals,
  sortReferrals,
} from '#shared/referrals/listing'
import type { ReferralFilter, ReferralRow } from '#shared/referrals/listing'

/**
 * HU-53 · RF-53.1…RF-53.5 — el listado de referidos del Embajador.
 *
 * Ana tiene cuatro referidos: uno registrado, dos en proceso de pago y uno con el
 * pago completado. La comisión que se muestra es la de su tipo (V1, 3 %) sobre el
 * precio pactado, y solo desde «En proceso de pago».
 */

const V1: CommissionType = {
  id: 'tipo-v1', name: 'V1', kind: 'percentage', amount: null, basisPoints: 300,
  isDefault: true, active: true, createdBy: 'super', createdAt: '2026-08-01T10:00:00Z',
}

function referido(cambios: Partial<ReferralRow> & { id: string }): ReferralRow {
  return {
    prospectName: null, prospectEmail: `${cambios.id}@correo.co`, referredOn: '2026-09-01',
    propertyName: null, fractionNumber: null, stage: 'registered', commission: null,
    ...cambios,
  }
}

const REFERIDOS: ReferralRow[] = [
  referido({ id: 'r1', referredOn: '2026-08-15' }),
  referido({
    id: 'r2', referredOn: '2026-09-02', stage: 'payment_in_progress', propertyName: 'Casa Arena', fractionNumber: 3,
    commission: { amount: commissionFor(V1, pesos(100_000_000)), status: 'pending', graceEndsOn: null },
  }),
  referido({
    id: 'r3', referredOn: '2026-09-10', stage: 'payment_in_progress', propertyName: 'Villa Arena', fractionNumber: 1,
    commission: { amount: commissionFor(V1, pesos(80_000_000)), status: 'pending', graceEndsOn: null },
  }),
  referido({
    id: 'r4', referredOn: '2026-07-20', stage: 'paid', propertyName: 'Casa Arena', fractionNumber: 7,
    commission: { amount: commissionFor(V1, pesos(120_000_000)), status: 'in_grace', graceEndsOn: '2026-10-05' },
  }),
]

describe('RF-53.2 · los estados del referido', () => {
  it('RF-53.2 · son exactamente Registrado, En proceso de pago y Pago completado', () => {
    expect(REFERRAL_STATES).toEqual(['registered', 'payment_in_progress', 'paid'])
  })
})

describe('CA-53.1 · los totalizadores por estado', () => {
  it('CA-53.1 · dados referidos en los tres estados, los totales por estado suman el total del listado', () => {
    const totales = referralTotals(REFERIDOS)

    expect(totales).toEqual({ registered: 1, payment_in_progress: 2, paid: 1, total: 4 })
    expect(totales.registered + totales.payment_in_progress + totales.paid).toBe(totales.total)
  })

  it('RF-53.4 · sin referidos los totales son cero en cada estado', () => {
    expect(referralTotals([])).toEqual({ registered: 0, payment_in_progress: 0, paid: 0, total: 0 })
  })
})

describe('CA-53.2 · los filtros por estado y periodo', () => {
  it('CA-53.2 · estado y periodo se combinan: solo lo que cumple ambos', () => {
    const filtro: ReferralFilter = { stage: 'payment_in_progress', desde: '2026-09-05', hasta: '2026-09-30' }

    expect(filterReferrals(REFERIDOS, filtro).map(r => r.id)).toEqual(['r3'])
  })

  it('RF-53.4 · solo por estado', () => {
    expect(filterReferrals(REFERIDOS, { ...emptyReferralFilter(), stage: 'payment_in_progress' }).map(r => r.id)).toEqual(['r2', 'r3'])
  })

  it('RF-53.4 · solo por periodo, con los extremos incluidos', () => {
    expect(filterReferrals(REFERIDOS, { stage: null, desde: '2026-08-15', hasta: '2026-09-02' }).map(r => r.id)).toEqual(['r1', 'r2'])
  })

  it('RF-53.4 · el filtro vacío devuelve todo y no cuenta como activo', () => {
    expect(filterReferrals(REFERIDOS, emptyReferralFilter())).toHaveLength(4)
    expect(hasActiveReferralFilter(emptyReferralFilter())).toBe(false)
    expect(hasActiveReferralFilter({ ...emptyReferralFilter(), stage: 'paid' })).toBe(true)
  })

  it('CA-53.1 · los totales del resultado filtrado siguen sumando su total', () => {
    const totales = referralTotals(filterReferrals(REFERIDOS, { ...emptyReferralFilter(), desde: '2026-09-01' }))

    expect(totales).toEqual({ registered: 0, payment_in_progress: 2, paid: 0, total: 2 })
  })
})

describe('CA-53.3 · la comisión que se muestra', () => {
  it('CA-53.3 · un referido en proceso de pago bajo V1 muestra el 3 % del precio pactado y su estado de saldo', () => {
    expect(commissionShown(REFERIDOS[1]!)).toEqual({ amount: pesos(3_000_000), status: 'pending', graceEndsOn: null })
  })

  it('CA-53.3 · uno con el pago completado muestra el monto en gracia con su fecha de habilitación', () => {
    expect(commissionShown(REFERIDOS[3]!)).toEqual({ amount: pesos(3_600_000), status: 'in_grace', graceEndsOn: '2026-10-05' })
  })

  it('CA-53.3 · RF-53.3 · un referido «Registrado» no muestra monto alguno', () => {
    expect(commissionShown(REFERIDOS[0]!)).toBeNull()
  })

  it('RF-53.3 · aunque un dato llegara colgado de un registrado, no se muestra: no hay compra ni precio pactado', () => {
    const raro = referido({ id: 'r9', commission: { amount: pesos(1), status: 'pending', graceEndsOn: null } })

    expect(commissionShown(raro)).toBeNull()
  })
})

describe('RF-53.1 · el orden del listado', () => {
  it('RF-53.1 · del referido más reciente al más antiguo', () => {
    expect(sortReferrals(REFERIDOS).map(r => r.id)).toEqual(['r3', 'r2', 'r1', 'r4'])
  })

  it('RF-53.1 · no muta el arreglo recibido', () => {
    const copia = [...REFERIDOS]
    sortReferrals(REFERIDOS)

    expect(REFERIDOS).toEqual(copia)
  })
})
