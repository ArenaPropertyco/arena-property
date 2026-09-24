import { describe, expect, it } from 'vitest'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import {
  emptyWalletFilter,
  filterWalletEntries,
  hasActiveWalletFilter,
  sortWalletEntries,
  WALLET_ENTRY_KINDS,
  walletBalances,
  walletEntryDirection,
  walletFigures,
} from '#shared/referrals/wallet'
import type { WalletEntry, WalletEntryKind } from '#shared/referrals/wallet'

/**
 * HU-55 · RF-55.1…RF-55.5 · D-02 · D-20 — la billetera del Embajador.
 *
 * Los cuatro saldos no se guardan: se derivan del histórico de movimientos con
 * una función pura (RF-55.2). Ana tiene una comisión de $3.000.000 acreditada el
 * 10 de septiembre de 2026, en gracia hasta el 10 de octubre, y otra de
 * $2.400.000 que se acreditó y se reversó dentro de la gracia. La base repite la
 * misma agregación en `private.saldos_de_billetera`.
 */

let secuencia = 0

function entrada(cambios: Omit<Partial<WalletEntry>, 'amount'> & { kind: WalletEntryKind, amount: number }): WalletEntry {
  secuencia += 1
  return {
    id: `mov-${secuencia}`,
    commissionId: null,
    withdrawalId: null,
    occurredOn: '2026-09-10',
    createdAt: `2026-09-10T10:00:${String(secuencia).padStart(2, '0')}Z`,
    referralLabel: null,
    propertyName: null,
    fractionNumber: null,
    graceEndsOn: null,
    note: null,
    ...cambios,
    amount: pesos(cambios.amount),
  }
}

/** La comisión A: acreditada el 10 de septiembre, disponible el 10 de octubre. */
const ACREDITADA_A = entrada({ kind: 'commission_credited', amount: 3_000_000, commissionId: 'c-a', referralLabel: 'p@correo.co', graceEndsOn: '2026-10-10' })
const DISPONIBLE_A = entrada({ kind: 'commission_available', amount: 3_000_000, commissionId: 'c-a', occurredOn: '2026-10-10' })

/** La comisión B: acreditada el 12 y reversada el 20, dentro de la gracia. */
const ACREDITADA_B = entrada({ kind: 'commission_credited', amount: 2_400_000, commissionId: 'c-b', occurredOn: '2026-09-12', graceEndsOn: '2026-10-12' })
const REVERSADA_B = entrada({ kind: 'commission_reversed', amount: 2_400_000, commissionId: 'c-b', occurredOn: '2026-09-20', note: 'Compra anulada' })

const RETIRO_SOLICITADO = entrada({ kind: 'withdrawal_requested', amount: 1_000_000, withdrawalId: 'w-1', occurredOn: '2026-10-11' })
const RETIRO_APROBADO = entrada({ kind: 'withdrawal_approved', amount: 1_000_000, withdrawalId: 'w-1', occurredOn: '2026-10-12' })
const RETIRO_PAGADO = entrada({ kind: 'withdrawal_paid', amount: 1_000_000, withdrawalId: 'w-1', occurredOn: '2026-10-13' })

describe('RF-55.2 · el histórico de la billetera', () => {
  it('RF-55.2 · registra acreditación, paso a disponible, reversa, solicitud, aprobación y pago', () => {
    expect(WALLET_ENTRY_KINDS).toEqual([
      'commission_credited', 'commission_available', 'commission_reversed',
      'withdrawal_requested', 'withdrawal_approved', 'withdrawal_paid',
    ])
  })

  it('sin movimientos ni provisiones, todo está en cero', () => {
    expect(walletBalances([], [])).toEqual({
      pending: pesos(0), inGrace: pesos(0), available: pesos(0), withdrawn: pesos(0),
      reversed: pesos(0), totalEarned: pesos(0), nextAvailableOn: null,
    })
  })
})

describe('CA-55.1 · los cuatro saldos coinciden con el cálculo manual', () => {
  const saldos = walletBalances(
    [ACREDITADA_A, DISPONIBLE_A, ACREDITADA_B, REVERSADA_B, RETIRO_SOLICITADO, RETIRO_APROBADO, RETIRO_PAGADO],
    [{ id: 'c-c', amount: pesos(1_500_000) }],
  )

  it('CA-55.1 · RF-55.1 · pendiente, en gracia, disponible y total ganado salen del histórico', () => {
    expect(saldos.pending).toBe(pesos(1_500_000))
    expect(saldos.inGrace).toBe(pesos(0))
    expect(saldos.available).toBe(pesos(2_000_000))
    expect(saldos.totalEarned).toBe(pesos(3_000_000))
  })

  it('CA-55.1 · disponible = acreditado − en gracia − retirado − reversado', () => {
    const acreditado = pesos(3_000_000 + 2_400_000)
    expect(saldos.available).toBe(acreditado - saldos.inGrace - saldos.withdrawn - saldos.reversed)
    expect(saldos.withdrawn).toBe(pesos(1_000_000))
    expect(saldos.reversed).toBe(pesos(2_400_000))
  })

  it('RF-55.2 · una solicitud o un pago no mueven el saldo; solo la aprobación descuenta (RF-56.3)', () => {
    const sinRetiro = walletBalances([ACREDITADA_A, DISPONIBLE_A], [])
    const solicitado = walletBalances([ACREDITADA_A, DISPONIBLE_A, RETIRO_SOLICITADO], [])
    const pagado = walletBalances([ACREDITADA_A, DISPONIBLE_A, RETIRO_SOLICITADO, RETIRO_APROBADO, RETIRO_PAGADO], [])

    expect(solicitado.available).toBe(sinRetiro.available)
    expect(pagado.available).toBe(pesos(2_000_000))
    expect(pagado.withdrawn).toBe(pesos(1_000_000))
  })
})

describe('CA-55.2 · una comisión acreditada hoy va a gracia, no a disponible', () => {
  const saldos = walletBalances([ACREDITADA_A], [])

  it('CA-55.2 · suma al saldo en gracia y deja el disponible en cero', () => {
    expect(saldos.inGrace).toBe(pesos(3_000_000))
    expect(saldos.available).toBe(pesos(0))
    expect(saldos.totalEarned).toBe(pesos(3_000_000))
  })

  it('CA-55.2 · D-02 · anuncia la fecha en que pasará a disponible: la más próxima de lo que está en gracia', () => {
    expect(saldos.nextAvailableOn).toBe('2026-10-10')
    expect(walletBalances([ACREDITADA_A, ACREDITADA_B], []).nextAvailableOn).toBe('2026-10-10')
    expect(walletBalances([ACREDITADA_A, DISPONIBLE_A], []).nextAvailableOn).toBeNull()
  })
})

describe('CA-55.3 · la reversa dentro de la gracia', () => {
  it('CA-55.3 · el saldo en gracia baja y el total ganado histórico se ajusta', () => {
    const antes = walletBalances([ACREDITADA_A, ACREDITADA_B], [])
    const despues = walletBalances([ACREDITADA_A, ACREDITADA_B, REVERSADA_B], [])

    expect(antes.inGrace).toBe(pesos(5_400_000))
    expect(despues.inGrace).toBe(pesos(3_000_000))
    expect(antes.totalEarned).toBe(pesos(5_400_000))
    expect(despues.totalEarned).toBe(pesos(3_000_000))
    expect(despues.reversed).toBe(pesos(2_400_000))
  })

  it('RF-54.7 · una reversa de lo disponible baja el disponible y también lo ganado', () => {
    const reversadaDisponible = entrada({ kind: 'commission_reversed', amount: 3_000_000, commissionId: 'c-a', occurredOn: '2026-10-20' })
    const saldos = walletBalances([ACREDITADA_A, DISPONIBLE_A, reversadaDisponible], [])

    expect(saldos.available).toBe(pesos(0))
    expect(saldos.inGrace).toBe(pesos(0))
    expect(saldos.totalEarned).toBe(pesos(0))
  })
})

describe('CA-55.4 · el listado de movimientos', () => {
  const todos = [ACREDITADA_A, RETIRO_PAGADO, REVERSADA_B, DISPONIBLE_A, ACREDITADA_B, RETIRO_SOLICITADO, RETIRO_APROBADO]

  it('CA-55.4 · un retiro pagado aparece como movimiento y el disponible bajó en ese monto', () => {
    const ordenados = sortWalletEntries(todos)
    expect(ordenados[0]).toBe(RETIRO_PAGADO)
    expect(walletBalances(todos, []).available).toBe(pesos(2_000_000))
  })

  it('CA-55.4 · RF-55.3 · se ordena del más reciente al más antiguo, sin tocar el original', () => {
    const ordenados = sortWalletEntries(todos)

    expect(ordenados.map(m => m.occurredOn)).toEqual([
      '2026-10-13', '2026-10-12', '2026-10-11', '2026-10-10', '2026-09-20', '2026-09-12', '2026-09-10',
    ])
    expect(todos[0]).toBe(ACREDITADA_A)
  })

  it('RF-55.3 · dos movimientos del mismo día se ordenan por su instante de creación, el último primero', () => {
    const temprano = entrada({ kind: 'commission_credited', amount: 10, commissionId: 'x', createdAt: '2026-09-10T08:00:00Z' })
    const tarde = entrada({ kind: 'commission_credited', amount: 20, commissionId: 'y', createdAt: '2026-09-10T18:00:00Z' })

    expect(sortWalletEntries([temprano, tarde])).toEqual([tarde, temprano])
  })

  it('CA-55.4 · RF-55.3 · filtra por tipo y por periodo, combinados y con los extremos incluidos', () => {
    expect(filterWalletEntries(todos, { ...emptyWalletFilter(), kind: 'commission_credited' })).toEqual([ACREDITADA_A, ACREDITADA_B])
    expect(filterWalletEntries(todos, { ...emptyWalletFilter(), desde: '2026-10-10', hasta: '2026-10-12' })).toEqual([DISPONIBLE_A, RETIRO_SOLICITADO, RETIRO_APROBADO])
    expect(filterWalletEntries(todos, { kind: 'withdrawal_paid', desde: '2026-10-13', hasta: '2026-10-13' })).toEqual([RETIRO_PAGADO])
    expect(filterWalletEntries(todos, { kind: 'withdrawal_paid', desde: null, hasta: '2026-10-12' })).toEqual([])
  })

  it('el filtro vacío no filtra y se sabe cuándo hay uno activo', () => {
    expect(filterWalletEntries(todos, emptyWalletFilter())).toHaveLength(todos.length)
    expect(hasActiveWalletFilter(emptyWalletFilter())).toBe(false)
    expect(hasActiveWalletFilter({ ...emptyWalletFilter(), kind: 'withdrawal_paid' })).toBe(true)
    expect(hasActiveWalletFilter({ ...emptyWalletFilter(), hasta: '2026-10-01' })).toBe(true)
  })

  it('RF-55.3 · cada tipo declara si entra, sale o solo cambia de estado, para que la vista no lo decida', () => {
    expect(walletEntryDirection('commission_credited')).toBe('in')
    expect(walletEntryDirection('commission_reversed')).toBe('out')
    expect(walletEntryDirection('withdrawal_approved')).toBe('out')
    expect(walletEntryDirection('commission_available')).toBe('neutral')
    expect(walletEntryDirection('withdrawal_requested')).toBe('neutral')
    expect(walletEntryDirection('withdrawal_paid')).toBe('neutral')
  })
})

describe('RF-55.5 · RF-55.1 · las cuatro cifras con su condición (TR-02)', () => {
  const saldos = walletBalances([ACREDITADA_A], [{ id: 'c-c', amount: pesos(1_500_000) }])
  const cifras = walletFigures(saldos, 'es')

  it('RF-55.1 · RT-08 · lo pendiente es estimado; lo demás, confirmado', () => {
    expect(cifras.pending).toMatchObject({ condicion: 'estimado', esConfirmado: false })
    expect(cifras.inGrace).toMatchObject({ condicion: 'confirmado' })
    expect(cifras.available).toMatchObject({ condicion: 'confirmado' })
    expect(cifras.totalEarned).toMatchObject({ condicion: 'confirmado' })
  })

  it('RF-55.5 · RF-D.5 · el texto lleva el formato de la casa, sin decimales', () => {
    expect(cifras.pending.texto).toBe('$ 1.500.000')
    expect(cifras.inGrace.texto).toBe('$ 3.000.000')
    expect(cifras.available.texto).toBe('$ 0')
    expect(walletFigures(saldos, 'en').totalEarned.texto).toBe(formatearImporte(pesos(3_000_000), 'en'))
  })
})
