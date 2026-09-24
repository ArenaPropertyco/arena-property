import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import OwnerChargesTable from '~/components/OwnerChargesTable.vue'
import OwnerPaymentForm from '~/components/OwnerPaymentForm.vue'
import OwnerStatementsTable from '~/components/OwnerStatementsTable.vue'
import OwnerWalletBalances from '~/components/OwnerWalletBalances.vue'
import OwnerWalletFilters from '~/components/OwnerWalletFilters.vue'
import OwnerWalletMovementsTable from '~/components/OwnerWalletMovementsTable.vue'
import OwnerWithdrawalForm from '~/components/OwnerWithdrawalForm.vue'
import OwnerWithdrawalsTable from '~/components/OwnerWithdrawalsTable.vue'
import { formatearMes } from '#shared/dates/formato'
import { emptyOwnerWalletFilter, saldosPorPropiedad } from '#shared/finance/billetera'
import type { OwnerWalletEntry } from '#shared/finance/billetera'
import type { MedioDePago } from '#shared/finance/maestra'
import type { OwnerChargeListed, OwnerPaymentListed, OwnerStatementListed, OwnerWithdrawalListed } from '#shared/finance/vistas'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'

/**
 * HU-62 · RF-62.1, RF-62.6…RF-62.10, RF-62.14 · RT-06 · principio 10 — los
 * componentes de la billetera del Propietario reciben los saldos, los cobros,
 * los cortes y los movimientos ya derivados por `shared/finance` y emiten lo
 * que Pedro decide. Ninguno suma, filtra ni decide qué cifra es confirmada.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const cop = (monto: number) => formatearImporte(pesos(monto), 'es')

const P1 = { id: 'prop-1', name: 'Casa P1' }
const P2 = { id: 'prop-2', name: 'Casa P2' }

function entrada(cambios: Partial<Omit<OwnerWalletEntry, 'amount'>> & { id: string, kind: OwnerWalletEntry['kind'], amount: number }): OwnerWalletEntry {
  return {
    occurredOn: '2026-10-01', createdAt: '2026-10-01T05:05:00Z', propertyId: P1.id, propertyName: P1.name,
    fractionNumber: 3, period: '2026-09', statementId: null, paymentId: null, withdrawalId: null,
    ...cambios,
    amount: pesos(cambios.amount),
  }
}

/** Pedro: −$50.000 en P1 tras el corte de septiembre; +$630.000 en P2. */
const HISTORICO: OwnerWalletEntry[] = [
  entrada({ id: 'e1', kind: 'statement_closed', amount: -50_000, statementId: 'st-1' }),
  entrada({ id: 'e2', kind: 'statement_closed', amount: 630_000, statementId: 'st-2', propertyId: P2.id, propertyName: P2.name, fractionNumber: 1 }),
]

describe('OwnerWalletBalances', () => {
  const saldos = saldosPorPropiedad(HISTORICO, [P1, P2])

  it('CA-62.11 · RF-62.1 · cada propiedad con su saldo, su color y su naturaleza, y el total consolidado aparte', async () => {
    const tarjetas = await mountSuspended(OwnerWalletBalances, {
      props: { saldos, consolidado: pesos(580_000), estimados: {}, mesEnCurso: '2026-10' },
    })

    const p1 = tarjetas.find('[data-test="saldo-propiedad-prop-1"]')
    expect(p1.text()).toContain(cop(-50_000))
    expect(p1.text()).toContain('Por pagar')
    expect(p1.find('[data-condicion]').attributes('data-condicion')).toBe('confirmado')
    expect(p1.find('[data-condicion]').classes()).toContain('text-error')
    expect(p1.find('[data-condicion]').classes()).toContain('font-mono')

    const p2 = tarjetas.find('[data-test="saldo-propiedad-prop-2"]')
    expect(p2.text()).toContain(cop(630_000))
    expect(p2.text()).toContain('Disponible para retiro')
    expect(p2.find('[data-condicion]').classes()).toContain('text-success')

    expect(tarjetas.find('[data-test="saldo-consolidado"]').text()).toContain(cop(580_000))
  })

  it('CA-62.12 · RF-62.10 · el mes en curso se muestra como estimado y nunca en verde', async () => {
    const tarjetas = await mountSuspended(OwnerWalletBalances, {
      props: { saldos, consolidado: pesos(580_000), estimados: { [P2.id]: pesos(120_000) }, mesEnCurso: '2026-10' },
    })

    const estimado = tarjetas.find('[data-test="estimado-prop-2"]')
    expect(estimado.exists()).toBe(true)
    expect(estimado.text()).toContain(cop(120_000))
    expect(estimado.attributes('data-condicion')).toBe('estimado')
    expect(estimado.classes()).not.toContain('text-success')
    expect(tarjetas.find('[data-test="estimado-prop-1"]').exists()).toBe(false)
  })
})

function pago(cambios: Partial<OwnerPaymentListed> & { id: string }): OwnerPaymentListed {
  return {
    chargeId: 'ch-1', amount: pesos(50_000), paidOn: '2026-10-05', paymentMethodName: 'Transferencia', description: 'Bancolombia',
    receiptPath: 'prop-1/user-pedro/p.pdf', channel: 'manual', provider: null, externalReference: null,
    status: 'reported', reportedAt: '2026-10-05T10:00:00Z', resolvedOn: null, rejectionReason: null,
    ...cambios,
  }
}

function cobro(cambios: Partial<OwnerChargeListed> & { id: string }): OwnerChargeListed {
  return {
    ownerId: 'user-pedro', propertyId: P1.id, propertyName: P1.name, period: '2026-09',
    amount: pesos(50_000), paidAmount: pesos(0), status: 'pending', payments: [],
    ...cambios,
  }
}

describe('OwnerChargesTable', () => {
  it('RF-62.6 · CA-62.8 · el cobro pendiente ofrece reportar; el pagado no; el rechazado muestra su motivo y el comprobante enlaza', async () => {
    const tabla = await mountSuspended(OwnerChargesTable, {
      props: {
        cobros: [
          cobro({ id: 'ch-1', payments: [pago({ id: 'p1', status: 'rejected', resolvedOn: '2026-10-06', rejectionReason: 'Comprobante ilegible.' })] }),
          cobro({ id: 'ch-2', period: '2026-08', status: 'paid', paidAmount: pesos(50_000), payments: [pago({ id: 'p2', chargeId: 'ch-2', status: 'confirmed', resolvedOn: '2026-09-06' })] }),
          cobro({ id: 'ch-3', period: '2026-07', status: 'under_review', payments: [pago({ id: 'p3', chargeId: 'ch-3' })] }),
        ],
        comprobantes: { p2: 'https://firmada/p2.pdf' },
      },
    })

    expect(tabla.find('[data-test="cobro-ch-1"]').text()).toContain(cop(50_000))
    expect(tabla.find('[data-test="estado-cobro-ch-1"]').text()).toContain('Pendiente')
    expect(tabla.find('[data-test="reportar-ch-1"]').exists()).toBe(true)
    expect(tabla.find('[data-test="motivo-pago-p1"]').text()).toContain('Comprobante ilegible.')

    expect(tabla.find('[data-test="estado-cobro-ch-2"]').text()).toContain('Pagado')
    expect(tabla.find('[data-test="reportar-ch-2"]').exists()).toBe(false)
    expect(tabla.find('[data-test="comprobante-pago-p2"]').attributes('href')).toBe('https://firmada/p2.pdf')

    expect(tabla.find('[data-test="estado-cobro-ch-3"]').text()).toContain('En revisión')
    expect(tabla.find('[data-test="reportar-ch-3"]').exists()).toBe(false)

    await tabla.find('[data-test="reportar-ch-1"]').trigger('click')
    expect(tabla.emitted('reportar')?.[0]?.[0]).toMatchObject({ id: 'ch-1' })
  })

  it('sin cobros lo dice', async () => {
    const tabla = await mountSuspended(OwnerChargesTable, { props: { cobros: [] } })
    expect(tabla.find('[data-test="sin-cobros"]').exists()).toBe(true)
  })
})

describe('OwnerPaymentForm', () => {
  const medios: MedioDePago[] = [{ id: 'pm-transfer', code: 'transfer', name: 'Transferencia', active: true }]
  const props = { cobro: cobro({ id: 'ch-1' }), medios, enviando: false }
  const archivo = new File(['%PDF-1.4'], 'recibo.pdf', { type: 'application/pdf' })

  async function llenar(formulario: Awaited<ReturnType<typeof mountSuspended>>, monto: string) {
    await formulario.find('[data-test="pago-monto"]').setValue(monto)
    await formulario.find('[data-test="pago-fecha"]').setValue('2026-10-05')
    formulario.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', 'pm-transfer')
    await formulario.find('[data-test="pago-descripcion"]').setValue('Transferencia Bancolombia')
  }

  it('RF-62.7 · muestra lo pendiente del cobro con el formato de TR-02', async () => {
    const formulario = await mountSuspended(OwnerPaymentForm, { props })
    expect(formulario.text()).toContain(cop(50_000))
  })

  it('CA-62.6 · por más que el cobro no emite y lo dice', async () => {
    const formulario = await mountSuspended(OwnerPaymentForm, { props })
    await llenar(formulario, '60000')
    formulario.vm.elegirArchivo({ target: { files: [archivo] } } as unknown as Event)
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-pago-monto"]').text()).toContain('supera')
  })

  it('CA-62.6 · sin comprobante no emite y lo dice', async () => {
    const formulario = await mountSuspended(OwnerPaymentForm, { props })
    await llenar(formulario, '50000')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-pago-comprobante"]').text()).toContain('comprobante')
  })

  it('CA-62.7 · un abono válido emite el monto entero, la fecha, el medio, la descripción y el archivo', async () => {
    const formulario = await mountSuspended(OwnerPaymentForm, { props })
    await llenar(formulario, '20000')
    formulario.vm.elegirArchivo({ target: { files: [archivo] } } as unknown as Event)
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0]).toEqual({
      amount: pesos(20_000), paidOn: '2026-10-05', paymentMethodId: 'pm-transfer', description: 'Transferencia Bancolombia', file: archivo,
    })
  })
})

function retiro(cambios: Partial<OwnerWithdrawalListed> & { id: string }): OwnerWithdrawalListed {
  return {
    ownerId: 'user-pedro', propertyId: P2.id, propertyName: P2.name, amount: pesos(300_000), status: 'requested', requestedOn: '2026-10-05',
    resolvedOn: null, rejectionReason: null, receiptPath: null, bank: 'Bancolombia', accountKind: 'savings', accountNumber: '11111111', holder: 'Pedro Pérez',
    ...cambios,
  }
}

describe('OwnerWithdrawalForm', () => {
  const saldos = saldosPorPropiedad(HISTORICO, [P1, P2])
  const props = { saldos, solicitudes: [] as OwnerWithdrawalListed[], enviando: false }

  async function llenar(formulario: Awaited<ReturnType<typeof mountSuspended>>, monto: string) {
    formulario.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', P2.id)
    await flushPromises()
    await formulario.find('[data-test="retiro-monto"]').setValue(monto)
    await formulario.find('[data-test="retiro-banco"]').setValue('Bancolombia')
    await formulario.find('[data-test="retiro-numero"]').setValue('11111111')
    await formulario.find('[data-test="retiro-titular"]').setValue('Pedro Pérez')
  }

  it('RF-62.9 · solo ofrece las propiedades con saldo positivo y muestra su disponible', async () => {
    const formulario = await mountSuspended(OwnerWithdrawalForm, { props })
    const opciones = formulario.findComponent({ name: 'USelect' }).props('items') as { value: string }[]

    expect(opciones.map(opcion => opcion.value)).toEqual([P2.id])
    formulario.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', P2.id)
    await flushPromises()
    expect(formulario.text()).toContain(cop(630_000))
  })

  it('CA-62.10 · por encima del saldo no emite y lo dice', async () => {
    const formulario = await mountSuspended(OwnerWithdrawalForm, { props })
    await llenar(formulario, '700000')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-monto-retiro"]').text()).toContain('supera')
  })

  it('CA-62.10 · un retiro válido emite el monto entero y la cuenta de destino', async () => {
    const formulario = await mountSuspended(OwnerWithdrawalForm, { props })
    await llenar(formulario, '300000')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toEqual([[{
      propertyId: P2.id, amount: pesos(300_000), bank: 'Bancolombia', accountKind: 'savings', accountNumber: '11111111', holder: 'Pedro Pérez',
    }]])
  })

  it('CA-62.10 · con una solicitud abierta sobre la propiedad no ofrece el formulario para ella', async () => {
    const formulario = await mountSuspended(OwnerWithdrawalForm, { props: { ...props, solicitudes: [retiro({ id: 'w1' })] } })
    formulario.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', P2.id)
    await flushPromises()

    expect(formulario.find('[data-test="retiro-abierto"]').exists()).toBe(true)
    expect(formulario.find('[data-test="retiro-monto"]').exists()).toBe(false)
  })

  it('RF-62.9 · sin saldo positivo en ninguna propiedad lo dice', async () => {
    const formulario = await mountSuspended(OwnerWithdrawalForm, { props: { ...props, saldos: saldosPorPropiedad([HISTORICO[0]!], [P1]) } })
    expect(formulario.find('[data-test="sin-saldo-para-retirar"]').exists()).toBe(true)
  })
})

describe('OwnerWithdrawalsTable', () => {
  it('RF-62.9 · lista cada solicitud con estado, motivo y comprobante', async () => {
    const tabla = await mountSuspended(OwnerWithdrawalsTable, {
      props: {
        solicitudes: [
          retiro({ id: 'w1', status: 'rejected', resolvedOn: '2026-10-06', rejectionReason: 'Cuenta inválida.' }),
          retiro({ id: 'w2', status: 'paid', resolvedOn: '2026-10-08', receiptPath: 'prop-2/user-pedro/w2.pdf' }),
        ],
        comprobantes: { w2: 'https://firmada/w2.pdf' },
      },
    })

    expect(tabla.find('[data-test="retiro-w1"]').text()).toContain('Casa P2')
    expect(tabla.find('[data-test="estado-retiro-w1"]').text()).toContain('Rechazado')
    expect(tabla.find('[data-test="motivo-retiro-w1"]').text()).toContain('Cuenta inválida.')
    expect(tabla.find('[data-test="estado-retiro-w2"]').text()).toContain('Pagado')
    expect(tabla.find('[data-test="comprobante-retiro-w2"]').attributes('href')).toBe('https://firmada/w2.pdf')
  })
})

describe('OwnerStatementsTable', () => {
  const corte = (cambios: Partial<OwnerStatementListed> & { id: string }): OwnerStatementListed => ({
    propertyId: P1.id, propertyName: P1.name, fractionNumber: 3, period: '2026-09',
    income: pesos(50_000), expenses: pesos(100_000), net: pesos(-50_000), hasAdjustments: false, closedAt: '2026-10-01T05:05:00Z',
    ...cambios,
  })

  it('CA-62.5 · RF-62.14 · cada corte lleva mes, propiedad, ingresos, gastos y neto con su color; el ajuste se rotula', async () => {
    const tabla = await mountSuspended(OwnerStatementsTable, {
      props: { cortes: [corte({ id: 'st-1' }), corte({ id: 'st-2', period: '2026-10', income: pesos(0), expenses: pesos(30_000), net: pesos(-30_000), hasAdjustments: true })] },
    })

    expect(tabla.find('[data-test="corte-st-1"]').text()).toContain(formatearMes('2026-09', 'es'))
    expect(tabla.find('[data-test="corte-st-1"]').text()).toContain('Casa P1')
    expect(tabla.find('[data-test="neto-st-1"]').text()).toBe(cop(-50_000))
    expect(tabla.find('[data-test="neto-st-1"]').classes()).toContain('text-error')
    expect(tabla.find('[data-test="neto-st-1"]').classes()).toContain('font-mono')
    expect(tabla.find('[data-test="ajuste-st-1"]').exists()).toBe(false)
    expect(tabla.find('[data-test="ajuste-st-2"]').exists()).toBe(true)
  })

  it('sin cortes lo dice', async () => {
    const tabla = await mountSuspended(OwnerStatementsTable, { props: { cortes: [] } })
    expect(tabla.find('[data-test="sin-cortes"]').exists()).toBe(true)
  })
})

describe('OwnerWalletMovementsTable', () => {
  it('RF-62.2 · RF-62.14 · cada movimiento lleva tipo, fecha, propiedad y monto con su signo', async () => {
    const tabla = await mountSuspended(OwnerWalletMovementsTable, {
      props: { movimientos: [...HISTORICO, entrada({ id: 'e3', kind: 'withdrawal_paid', amount: -300_000, withdrawalId: 'w-1', propertyId: P2.id, propertyName: P2.name, fractionNumber: null, period: null })] },
    })

    expect(tabla.find('[data-test="movimiento-e1"]').text()).toContain('Corte mensual')
    expect(tabla.find('[data-test="monto-e1"]').text()).toBe(`−${cop(50_000)}`)
    expect(tabla.find('[data-test="monto-e1"]').classes()).toContain('font-mono')
    expect(tabla.find('[data-test="monto-e2"]').text()).toBe(`+${cop(630_000)}`)
    expect(tabla.find('[data-test="monto-e3"]').text()).toBe(`−${cop(300_000)}`)
    expect(tabla.text()).toContain('Casa P2')
  })

  it('sin movimientos lo dice', async () => {
    const tabla = await mountSuspended(OwnerWalletMovementsTable, { props: { movimientos: [] } })
    expect(tabla.find('[data-test="sin-movimientos-propietario"]').exists()).toBe(true)
  })
})

describe('OwnerWalletFilters', () => {
  it('RF-62.14 · ofrece propiedad y periodo y emite el filtro combinado; limpiar emite el vacío', async () => {
    const filtros = await mountSuspended(OwnerWalletFilters, { props: { filtro: emptyOwnerWalletFilter(), propiedades: [P1, P2] } })

    filtros.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', P2.id)
    expect(filtros.emitted('update:filtro')?.[0]).toEqual([{ propertyId: P2.id, desde: null, hasta: null }])

    await filtros.find('[data-test="filtro-desde"]').setValue('2026-10-01')
    expect(filtros.emitted('update:filtro')?.[1]).toEqual([{ propertyId: null, desde: '2026-10-01', hasta: null }])

    await filtros.find('[data-test="filtro-limpiar"]').trigger('click')
    expect(filtros.emitted('update:filtro')?.[2]).toEqual([emptyOwnerWalletFilter()])
  })
})
