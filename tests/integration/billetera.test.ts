import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import WalletBalances from '~/components/WalletBalances.vue'
import WalletFilters from '~/components/WalletFilters.vue'
import WalletMovementsTable from '~/components/WalletMovementsTable.vue'
import WithdrawalRequestForm from '~/components/WithdrawalRequestForm.vue'
import WithdrawalRequestsTable from '~/components/WithdrawalRequestsTable.vue'
import { formatearDia } from '#shared/dates/formato'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import type { WithdrawalListed } from '#shared/referrals/views'
import { emptyWalletFilter, walletBalances } from '#shared/referrals/wallet'
import type { WalletEntry } from '#shared/referrals/wallet'
import { DEFAULT_MINIMUM_WITHDRAWAL } from '#shared/referrals/withdrawals'

/**
 * HU-55 · RF-55.1, RF-55.3, RF-55.5 · HU-56 · RF-56.1 · RT-06 · principio 10 —
 * los componentes de la billetera reciben los saldos y los movimientos ya
 * derivados por `shared/referrals/wallet` y emiten lo que el Embajador decide.
 * Ninguno suma, filtra ni decide qué cifra es confirmada.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

/** El texto que TR-02 produce para un importe, para no reescribir el formato en la prueba. */
const cop = (monto: number) => formatearImporte(pesos(monto), 'es')

function entrada(cambios: Omit<Partial<WalletEntry>, 'amount'> & { id: string, kind: WalletEntry['kind'], amount: number }): WalletEntry {
  return {
    commissionId: null, withdrawalId: null, occurredOn: '2026-09-10', createdAt: '2026-09-10T10:00:00Z',
    referralLabel: null, propertyName: null, fractionNumber: null, graceEndsOn: null, note: null,
    ...cambios,
    amount: pesos(cambios.amount),
  }
}

/** Ana: $3.000.000 acreditados el 10 de septiembre, liberados el 10 de octubre, y un retiro de $1.000.000 aprobado el 12. */
const MOVIMIENTOS: WalletEntry[] = [
  entrada({ id: 'm1', kind: 'commission_credited', amount: 3_000_000, commissionId: 'c1', referralLabel: 'p@correo.co', propertyName: 'Casa Palomino', fractionNumber: 3, graceEndsOn: '2026-10-10' }),
  entrada({ id: 'm2', kind: 'withdrawal_approved', amount: 1_000_000, withdrawalId: 'w1', occurredOn: '2026-10-12', createdAt: '2026-10-12T10:00:00Z' }),
  entrada({ id: 'm3', kind: 'commission_available', amount: 3_000_000, commissionId: 'c1', occurredOn: '2026-10-10', createdAt: '2026-10-10T05:20:00Z' }),
]

describe('WalletBalances', () => {
  it('RF-55.1 · RF-55.5 · pinta las cuatro cifras en IBM Plex Mono, y lo pendiente nunca como disponible', async () => {
    const saldos = walletBalances(MOVIMIENTOS, [{ id: 'c2', amount: pesos(1_500_000) }])
    const tarjetas = await mountSuspended(WalletBalances, { props: { balances: saldos } })

    for (const cifra of ['saldo-pendiente', 'saldo-en-gracia', 'saldo-disponible', 'saldo-ganado']) {
      expect(tarjetas.find(`[data-test="${cifra}"] [data-condicion]`).classes()).toContain('font-mono')
    }
    expect(tarjetas.find('[data-test="saldo-pendiente"]').text()).toContain(cop(1_500_000))
    expect(tarjetas.find('[data-test="saldo-pendiente"] [data-condicion]').attributes('data-condicion')).toBe('estimado')
    expect(tarjetas.find('[data-test="saldo-en-gracia"]').text()).toContain(cop(0))
    expect(tarjetas.find('[data-test="saldo-disponible"]').text()).toContain(cop(2_000_000))
    expect(tarjetas.find('[data-test="saldo-disponible"] [data-condicion]').attributes('data-condicion')).toBe('confirmado')
    expect(tarjetas.find('[data-test="saldo-ganado"]').text()).toContain(cop(3_000_000))
  })

  it('CA-55.2 · D-02 · junto a lo en gracia dice cuándo pasa a disponible', async () => {
    const saldos = walletBalances([MOVIMIENTOS[0]!], [])
    const tarjetas = await mountSuspended(WalletBalances, { props: { balances: saldos } })

    expect(tarjetas.find('[data-test="disponible-el"]').text()).toContain(formatearDia('2026-10-10', 'es'))
  })

  it('sin nada en gracia no anuncia ninguna fecha', async () => {
    const tarjetas = await mountSuspended(WalletBalances, { props: { balances: walletBalances([], []) } })
    expect(tarjetas.find('[data-test="disponible-el"]').exists()).toBe(false)
  })
})

describe('WalletMovementsTable', () => {
  it('CA-55.4 · RF-55.3 · cada movimiento lleva tipo, fecha, referido y monto con su signo', async () => {
    const tabla = await mountSuspended(WalletMovementsTable, { props: { movimientos: MOVIMIENTOS } })

    const acreditada = tabla.find('[data-test="movimiento-m1"]')
    expect(acreditada.text()).toContain('p@correo.co')
    expect(acreditada.text()).toContain('Casa Palomino')
    expect(tabla.find('[data-test="monto-m1"]').text()).toBe(`+${cop(3_000_000)}`)
    expect(tabla.find('[data-test="monto-m1"]').classes()).toContain('font-mono')
    expect(tabla.find('[data-test="monto-m2"]').text()).toBe(`−${cop(1_000_000)}`)
    expect(tabla.text()).toContain(formatearDia('2026-10-12', 'es'))
  })

  it('sin movimientos lo dice', async () => {
    const tabla = await mountSuspended(WalletMovementsTable, { props: { movimientos: [] } })
    expect(tabla.find('[data-test="sin-movimientos"]').exists()).toBe(true)
  })
})

describe('WalletFilters', () => {
  it('RF-55.3 · ofrece tipo y periodo y emite el filtro combinado; limpiar emite el vacío', async () => {
    const filtros = await mountSuspended(WalletFilters, { props: { filtro: emptyWalletFilter() } })

    filtros.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', 'withdrawal_paid')
    expect(filtros.emitted('update:filtro')?.[0]).toEqual([{ kind: 'withdrawal_paid', desde: null, hasta: null }])

    await filtros.find('[data-test="filtro-desde"]').setValue('2026-10-01')
    expect(filtros.emitted('update:filtro')?.[1]).toEqual([{ kind: null, desde: '2026-10-01', hasta: null }])

    await filtros.find('[data-test="filtro-limpiar"]').trigger('click')
    expect(filtros.emitted('update:filtro')?.[2]).toEqual([emptyWalletFilter()])
  })
})

describe('WithdrawalRequestForm', () => {
  const props = { disponible: pesos(1_000_000), minimo: DEFAULT_MINIMUM_WITHDRAWAL, solicitudes: [], enviando: false }

  it('RF-56.1 · D-06 · muestra el mínimo y el disponible con el formato de TR-02', async () => {
    const formulario = await mountSuspended(WithdrawalRequestForm, { props })
    expect(formulario.text()).toContain(cop(200_000))
    expect(formulario.text()).toContain(cop(1_000_000))
  })

  it('CA-56.1 · por debajo del mínimo no emite y muestra el mensaje traducido', async () => {
    const formulario = await mountSuspended(WithdrawalRequestForm, { props })

    await formulario.find('[data-test="retiro-monto"]').setValue('150000')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-monto-retiro"]').text()).toContain('mínimo')
  })

  it('CA-56.1 · por encima del disponible tampoco emite', async () => {
    const formulario = await mountSuspended(WithdrawalRequestForm, { props })

    await formulario.find('[data-test="retiro-monto"]').setValue('1000001')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-monto-retiro"]').text()).toContain('disponible')
  })

  it('CA-56.2 · un retiro parcial válido emite el monto entero en pesos', async () => {
    const formulario = await mountSuspended(WithdrawalRequestForm, { props })

    await formulario.find('[data-test="retiro-monto"]').setValue('300000')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toEqual([[pesos(300_000)]])
  })

  it('CA-56.5 · con una solicitud abierta no ofrece el formulario', async () => {
    const abierta: WithdrawalListed = solicitud({ id: 'w1', status: 'requested' })
    const formulario = await mountSuspended(WithdrawalRequestForm, { props: { ...props, solicitudes: [abierta] } })

    expect(formulario.find('[data-test="retiro-monto"]').exists()).toBe(false)
    expect(formulario.find('[data-test="retiro-abierto"]').exists()).toBe(true)
  })
})

function solicitud(cambios: Partial<WithdrawalListed> & { id: string }): WithdrawalListed {
  return {
    ambassadorId: 'amb-1', amount: pesos(300_000), status: 'requested', requestedOn: '2026-10-15',
    resolvedOn: null, paidOn: null, rejectionReason: null, receiptPath: null,
    ambassadorEmail: 'ana@ejemplo.com', ambassadorName: 'Ana Ruiz', bank: 'Bancolombia', accountKind: 'savings',
    accountNumber: '11111111', holder: 'Ana Ruiz', available: pesos(1_000_000),
    ...cambios,
  }
}

describe('WithdrawalRequestsTable · vista del Embajador', () => {
  it('RF-56.2 · CA-57.3 · lista sus solicitudes con estado y muestra el motivo del rechazo', async () => {
    const tabla = await mountSuspended(WithdrawalRequestsTable, {
      props: {
        solicitudes: [
          solicitud({ id: 'w1', status: 'rejected', resolvedOn: '2026-10-16', rejectionReason: 'Cuenta bancaria inválida.' }),
          solicitud({ id: 'w2', status: 'paid', resolvedOn: '2026-10-17', paidOn: '2026-10-20', receiptPath: 'amb-1/w2.pdf' }),
        ],
        modo: 'embajador',
        comprobantes: { w2: 'https://firmada/w2.pdf' },
      },
    })

    expect(tabla.find('[data-test="estado-w1"]').text()).toContain('Rechazada')
    expect(tabla.find('[data-test="motivo-w1"]').text()).toContain('Cuenta bancaria inválida.')
    expect(tabla.find('[data-test="estado-w2"]').text()).toContain('Pagada')
    expect(tabla.find('[data-test="comprobante-w2"]').attributes('href')).toBe('https://firmada/w2.pdf')
    expect(tabla.find('[data-test^="aprobar-"]').exists()).toBe(false)
    expect(tabla.find('[data-test^="pagar-"]').exists()).toBe(false)
  })

  it('sin solicitudes lo dice', async () => {
    const tabla = await mountSuspended(WithdrawalRequestsTable, { props: { solicitudes: [], modo: 'embajador' } })
    expect(tabla.find('[data-test="sin-retiros"]').exists()).toBe(true)
  })
})
