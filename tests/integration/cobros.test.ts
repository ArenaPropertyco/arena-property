import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import CollectionsBoardFilters from '~/components/CollectionsBoardFilters.vue'
import CollectionsBoardTable from '~/components/CollectionsBoardTable.vue'
import CollectionsOverviewTable from '~/components/CollectionsOverviewTable.vue'
import CollectionsSummary from '~/components/CollectionsSummary.vue'
import OwnerPaymentConfirmForm from '~/components/OwnerPaymentConfirmForm.vue'
import OwnerPayoutForm from '~/components/OwnerPayoutForm.vue'
import PropertySummaryCard from '~/components/PropertySummaryCard.vue'
import { filasDelTablero, filtroDeTableroVacio, resumenDelTablero, resumenesGlobales } from '#shared/finance/tablero-de-cobros'
import type { CobroDelTablero, EntradaDelTablero, FraccionDelTablero, PagoDelTablero, RetiroDelTablero } from '#shared/finance/tablero-de-cobros'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import type { ResumenDePropiedad } from '#shared/properties/tablero'

/**
 * HU-63 · RF-63.1…RF-63.6, RF-63.8…RF-63.10 · RT-06 · principio 10 — los
 * componentes del tablero de cobros reciben las filas y el resumen ya armados
 * por `shared/finance/tablero-de-cobros` y emiten lo que la administración
 * decide. Ninguno suma, clasifica ni escribe.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const cop = (monto: number) => formatearImporte(pesos(monto), 'es')

const ANA = 'user-ana'
const BETO = 'user-beto'

function fraccion(number: number, cambios: Partial<FraccionDelTablero> = {}): FraccionDelTablero {
  return { id: `f${number}`, number, ownerId: null, ownerLabel: null, status: 'available', calendarActive: false, ...cambios }
}

function pago(cambios: Partial<PagoDelTablero> & { id: string }): PagoDelTablero {
  return {
    chargeId: 'ch-ana', amount: pesos(50_000), paidOn: '2026-10-05', paymentMethodName: 'Transferencia', description: 'Bancolombia',
    receiptPath: 'prop-1/user-ana/p.pdf', channel: 'manual', provider: null, externalReference: null, status: 'reported', rejectionReason: null,
    ...cambios,
  }
}

const RETIRO: RetiroDelTablero = { id: 'w1', ownerId: BETO, amount: pesos(300_000), status: 'requested', requestedOn: '2026-10-05', bank: 'Bancolombia', accountKind: 'savings', accountNumber: '33333333', holder: 'Beto Ríos', receiptPath: null }

function entrada(cambios: Partial<EntradaDelTablero> = {}): EntradaDelTablero {
  return {
    period: '2026-09',
    estimated: false,
    fractions: [
      fraccion(1, { ownerId: ANA, ownerLabel: 'Ana Ruiz', status: 'sold', calendarActive: true }),
      fraccion(2),
      fraccion(3, { ownerId: BETO, ownerLabel: 'Beto Ríos', status: 'sold', calendarActive: true }),
      fraccion(4),
      fraccion(5, { ownerId: 'user-carla', ownerLabel: 'Carla', status: 'sold', calendarActive: true }),
      fraccion(6),
      fraccion(7),
      fraccion(8),
    ],
    statements: [
      { fractionNumber: 1, responsible: 'owner', income: pesos(50_000), expenses: pesos(100_000), net: pesos(-50_000) },
      { fractionNumber: 3, responsible: 'owner', income: pesos(640_000), expenses: pesos(10_000), net: pesos(630_000) },
    ],
    balances: [{ ownerId: ANA, balance: pesos(-50_000) }, { ownerId: BETO, balance: pesos(630_000) }, { ownerId: 'user-carla', balance: pesos(0) }],
    charges: [{ id: 'ch-ana', ownerId: ANA, period: '2026-09', amount: pesos(50_000), paidAmount: pesos(0), status: 'pending', payments: [] } satisfies CobroDelTablero],
    withdrawals: [],
    ...cambios,
  }
}

describe('CollectionsBoardTable', () => {
  it('CA-63.1 · ocho filas: la 1/8 cobro en rojo, la 3/8 pago en verde, la 5/8 al día y las demás del titular del inventario', async () => {
    const tabla = await mountSuspended(CollectionsBoardTable, { props: { filas: filasDelTablero(entrada()) } })

    expect(tabla.findAll('[data-test^="fila-"]')).toHaveLength(8)
    const f1 = tabla.find('[data-test="fila-1"]')
    expect(f1.text()).toContain('Ana Ruiz')
    expect(f1.text()).toContain('Cobro')
    expect(tabla.find('[data-test="saldo-1"]').text()).toBe(cop(-50_000))
    expect(tabla.find('[data-test="saldo-1"]').classes()).toContain('text-error')
    expect(tabla.find('[data-test="saldo-1"]').classes()).toContain('font-mono')

    expect(tabla.find('[data-test="fila-3"]').text()).toContain('Pago')
    expect(tabla.find('[data-test="saldo-3"]').classes()).toContain('text-success')
    expect(tabla.find('[data-test="fila-5"]').text()).toContain('Al día')
    expect(tabla.find('[data-test="saldo-5"]').text()).toBe(cop(0))
    expect(tabla.find('[data-test="fila-2"]').text()).toContain('Titular del inventario')
    expect(tabla.find('[data-test="reportar-1"]').exists()).toBe(false)
  })

  it('CA-63.3 · sin pago reportado dice «sin comprobante» y no ofrece confirmar; con uno, muestra monto, medio, descripción y enlace, y ofrece confirmar y rechazar', async () => {
    const sin = await mountSuspended(CollectionsBoardTable, { props: { filas: filasDelTablero(entrada()) } })
    expect(sin.find('[data-test="comprobante-1"]').text()).toContain('Sin comprobante')
    expect(sin.find('[data-test^="confirmar-"]').exists()).toBe(false)

    const con = await mountSuspended(CollectionsBoardTable, {
      props: {
        filas: filasDelTablero(entrada({ charges: [{ id: 'ch-ana', ownerId: ANA, period: '2026-09', amount: pesos(50_000), paidAmount: pesos(0), status: 'under_review', payments: [pago({ id: 'p1' })] }] })),
        comprobantes: { p1: 'https://firmada/p1.pdf' },
      },
    })
    const pagoP1 = con.find('[data-test="pago-p1"]')
    expect(pagoP1.text()).toContain(cop(50_000))
    expect(pagoP1.text()).toContain('Transferencia')
    expect(pagoP1.text()).toContain('Bancolombia')
    expect(con.find('[data-test="ver-comprobante-p1"]').attributes('href')).toBe('https://firmada/p1.pdf')
    expect(con.find('[data-test="confirmar-p1"]').exists()).toBe(true)
    expect(con.find('[data-test="rechazar-p1"]').exists()).toBe(true)

    await con.find('[data-test="confirmar-p1"]').trigger('click')
    expect(con.emitted('confirmar')?.[0]?.[0]).toMatchObject({ id: 'p1' })
    await con.find('[data-test="rechazar-p1"]').trigger('click')
    expect(con.emitted('rechazar')?.[0]?.[0]).toMatchObject({ id: 'p1' })
  })

  it('CA-63.12 · un pago de pasarela se muestra con su referencia y sin botón de confirmación', async () => {
    const tabla = await mountSuspended(CollectionsBoardTable, {
      props: {
        filas: filasDelTablero(entrada({ charges: [{ id: 'ch-ana', ownerId: ANA, period: '2026-09', amount: pesos(50_000), paidAmount: pesos(0), status: 'under_review', payments: [pago({ id: 'p2', channel: 'gateway', provider: 'wompi', externalReference: 'TX-001', receiptPath: null })] }] })),
      },
    })

    expect(tabla.find('[data-test="pago-p2"]').text()).toContain('TX-001')
    expect(tabla.find('[data-test="confirmar-p2"]').exists()).toBe(false)
    expect(tabla.find('[data-test="rechazar-p2"]').exists()).toBe(false)
  })

  it('RF-63.6 · la fila de pago muestra la solicitud de retiro y ofrece pagarla; sin solicitud, lo dice', async () => {
    const tabla = await mountSuspended(CollectionsBoardTable, { props: { filas: filasDelTablero(entrada({ withdrawals: [RETIRO] })) } })

    expect(tabla.find('[data-test="retiro-3"]').text()).toContain(cop(300_000))
    expect(tabla.find('[data-test="retiro-3"]').text()).toContain('33333333')
    await tabla.find('[data-test="pagar-3"]').trigger('click')
    expect(tabla.emitted('pagar')?.[0]?.[0]).toMatchObject({ fractionNumber: 3 })

    const sin = await mountSuspended(CollectionsBoardTable, { props: { filas: filasDelTablero(entrada()) } })
    expect(sin.find('[data-test="retiro-3"]').text()).toContain('Sin solicitud')
    expect(sin.find('[data-test="pagar-3"]').exists()).toBe(false)
  })

  it('RF-63.2 · en el mes en curso el neto es estimado y sin rojo ni verde; el saldo conserva su color', async () => {
    const tabla = await mountSuspended(CollectionsBoardTable, { props: { filas: filasDelTablero(entrada({ estimated: true })) } })

    const neto = tabla.find('[data-test="neto-1"]')
    expect(neto.attributes('data-condicion')).toBe('estimado')
    expect(neto.classes()).not.toContain('text-error')
    expect(neto.classes()).not.toContain('text-success')
    expect(tabla.find('[data-test="saldo-1"]').classes()).toContain('text-error')
  })

  it('RT-06 · la tabla se desplaza en horizontal en pantallas estrechas', async () => {
    const tabla = await mountSuspended(CollectionsBoardTable, { props: { filas: filasDelTablero(entrada()) } })
    expect(tabla.find('.overflow-x-auto').exists()).toBe(true)
  })
})

describe('CollectionsSummary', () => {
  it('CA-63.2 · CA-63.11 · muestra las siete cifras en IBM Plex Mono y lo en revisión aparte de lo cobrado', async () => {
    const resumen = resumenDelTablero(filasDelTablero(entrada({ charges: [{ id: 'ch-ana', ownerId: ANA, period: '2026-09', amount: pesos(50_000), paidAmount: pesos(0), status: 'under_review', payments: [pago({ id: 'p1', amount: pesos(20_000) })] }] })))
    const tarjetas = await mountSuspended(CollectionsSummary, { props: { resumen, estimado: false } })

    for (const [clave, valor] of [['por-cobrar', 50_000], ['cobrado', 0], ['en-revision', 20_000], ['por-pagar', 630_000], ['ingresos', 690_000], ['gastos', 110_000], ['neto-de-caja', -580_000]] as const) {
      expect(tarjetas.find(`[data-test="resumen-${clave}"]`).text(), clave).toContain(cop(valor))
      expect(tarjetas.find(`[data-test="resumen-${clave}"] .font-mono`).exists(), clave).toBe(true)
    }
  })
})

describe('CollectionsBoardFilters', () => {
  it('RF-63.9 · cambia de mes y emite el filtro combinado; limpiar emite el vacío', async () => {
    const filtros = await mountSuspended(CollectionsBoardFilters, { props: { filtro: filtroDeTableroVacio(), mes: '2026-09', mesEnCurso: '2026-10' } })

    await filtros.find('[data-test="mes-anterior"]').trigger('click')
    expect(filtros.emitted('update:mes')?.[0]).toEqual(['2026-08'])
    await filtros.find('[data-test="mes-siguiente"]').trigger('click')
    expect(filtros.emitted('update:mes')?.[1]).toEqual(['2026-10'])

    filtros.findAllComponents({ name: 'USelect' })[0]!.vm.$emit('update:modelValue', 'charge')
    expect(filtros.emitted('update:filtro')?.[0]).toEqual([{ nature: 'charge', status: null }])
    filtros.findAllComponents({ name: 'USelect' })[1]!.vm.$emit('update:modelValue', 'pending')
    expect(filtros.emitted('update:filtro')?.[1]).toEqual([{ nature: null, status: 'pending' }])

    await filtros.find('[data-test="filtro-limpiar"]').trigger('click')
    expect(filtros.emitted('update:filtro')?.[2]).toEqual([filtroDeTableroVacio()])
  })

  it('RF-63.9 · el mes en curso se anuncia como estimado y no se pasa de él', async () => {
    const filtros = await mountSuspended(CollectionsBoardFilters, { props: { filtro: filtroDeTableroVacio(), mes: '2026-10', mesEnCurso: '2026-10' } })
    expect(filtros.find('[data-test="mes-actual"]').text()).toContain('estimado')
    expect(filtros.find('[data-test="mes-siguiente"]').attributes('disabled')).toBeDefined()
  })
})

describe('OwnerPaymentConfirmForm', () => {
  const fila = filasDelTablero(entrada({ charges: [{ id: 'ch-ana', ownerId: ANA, period: '2026-09', amount: pesos(50_000), paidAmount: pesos(0), status: 'under_review', payments: [pago({ id: 'p1' })] }] }))[0]!

  it('CA-63.4 · repite monto, medio y fracción y emite una sola vez al confirmar', async () => {
    const formulario = await mountSuspended(OwnerPaymentConfirmForm, { props: { pago: pago({ id: 'p1' }), fila, enviando: false } })

    expect(formulario.text()).toContain(cop(50_000))
    expect(formulario.text()).toContain('Transferencia')
    expect(formulario.text()).toContain('1/8')
    await formulario.find('[data-test="confirmar-pago"]').trigger('click')
    expect(formulario.emitted('submit')).toHaveLength(1)
  })

  it('CA-63.5 · mientras se envía, el botón queda inutilizado: un segundo clic no emite', async () => {
    const formulario = await mountSuspended(OwnerPaymentConfirmForm, { props: { pago: pago({ id: 'p1' }), fila, enviando: true } })
    await formulario.find('[data-test="confirmar-pago"]').trigger('click')
    expect(formulario.emitted('submit')).toBeUndefined()
  })
})

describe('OwnerPayoutForm', () => {
  const fila = filasDelTablero(entrada({ withdrawals: [RETIRO] }))[2]!

  it('CA-63.8 · sin comprobante no emite y lo dice; con un archivo admitido emite el archivo tal cual', async () => {
    const formulario = await mountSuspended(OwnerPayoutForm, { props: { fila, enviando: false } })
    expect(formulario.text()).toContain(cop(300_000))

    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-comprobante-retiro"]').text()).toContain('comprobante')

    const archivo = new File(['%PDF-1.4'], 'comprobante.pdf', { type: 'application/pdf' })
    formulario.vm.elegirArchivo({ target: { files: [archivo] } } as unknown as Event)
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')?.[0]?.[0]).toBe(archivo)
  })
})

describe('CollectionsOverviewTable', () => {
  it('CA-63.13 · una fila por propiedad con sus cifras y el enlace a su tablero', async () => {
    const filas = resumenesGlobales([
      { propertyId: 'prop-1', propertyName: 'Casa P1', entrada: entrada() },
      { propertyId: 'prop-2', propertyName: 'Casa P2', entrada: entrada({ charges: [], balances: [] }) },
    ])
    const tabla = await mountSuspended(CollectionsOverviewTable, { props: { filas } })

    expect(tabla.find('[data-test="propiedad-prop-1"]').text()).toContain('Casa P1')
    expect(tabla.find('[data-test="por-cobrar-prop-1"]').text()).toBe(cop(50_000))
    expect(tabla.find('[data-test="por-pagar-prop-1"]').text()).toBe(cop(630_000))
    expect(tabla.find('[data-test="por-cobrar-prop-2"]').text()).toBe(cop(0))
    expect(tabla.find('[data-test="abrir-tablero-prop-1"]').attributes('href')).toBe('/panel/cobros/prop-1')
  })
})

describe('PropertySummaryCard', () => {
  it('T-304 · RF-63.8 · el dashboard del Administrador lleva al tablero de cobros de la propiedad', async () => {
    const resumen: ResumenDePropiedad = {
      id: 'p1', name: 'Invictvs 1201', fractionCount: 8, soldFractions: 3, soldShare: 3750, upcoming: [],
      alerts: { conflicts: 0, swapRequests: 0, weeksToPlace: 0, openAnnouncements: 0 }, alertCount: 0,
    }
    const tarjeta = await mountSuspended(PropertySummaryCard, { props: { resumen } })
    expect(tarjeta.find('[data-test="abrir-cobros-p1"]').attributes('href')).toBe('/panel/cobros/p1')
  })
})
