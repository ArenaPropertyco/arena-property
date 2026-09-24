import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import WithdrawalMinimumForm from '~/components/WithdrawalMinimumForm.vue'
import WithdrawalPayForm from '~/components/WithdrawalPayForm.vue'
import WithdrawalRejectForm from '~/components/WithdrawalRejectForm.vue'
import WithdrawalRequestsTable from '~/components/WithdrawalRequestsTable.vue'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import type { WithdrawalListed } from '#shared/referrals/views'

/**
 * HU-56 · RF-56.2…RF-56.4 · D-06 · D-20 · RT-06 · principio 10 — la bandeja
 * del Superadmin ofrece a cada solicitud solo las transiciones que proceden, y
 * los formularios de rechazo y de pago exigen motivo y comprobante antes de
 * emitir. Ninguno escribe: la página lleva la decisión a la base.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const cop = (monto: number) => formatearImporte(pesos(monto), 'es')

function solicitud(cambios: Partial<WithdrawalListed> & { id: string }): WithdrawalListed {
  return {
    ambassadorId: 'amb-1', amount: pesos(300_000), status: 'requested', requestedOn: '2026-10-15',
    resolvedOn: null, paidOn: null, rejectionReason: null, receiptPath: null,
    ambassadorEmail: 'ana@ejemplo.com', ambassadorName: 'Ana Ruiz', bank: 'Bancolombia', accountKind: 'savings',
    accountNumber: '11111111', holder: 'Ana Ruiz', available: pesos(1_000_000),
    ...cambios,
  }
}

describe('WithdrawalRequestsTable · bandeja del Superadmin', () => {
  const solicitudes = [
    solicitud({ id: 'w1' }),
    solicitud({ id: 'w2', status: 'approved', resolvedOn: '2026-10-16' }),
    solicitud({ id: 'w3', status: 'paid', resolvedOn: '2026-10-16', paidOn: '2026-10-18', receiptPath: 'amb-1/w3.pdf' }),
  ]

  it('CA-56.3 · RF-56.2 · ofrece aprobar o rechazar a la solicitada, pagar a la aprobada y nada a la pagada', async () => {
    const tabla = await mountSuspended(WithdrawalRequestsTable, { props: { solicitudes, modo: 'superadmin' } })

    expect(tabla.find('[data-test="aprobar-w1"]').exists()).toBe(true)
    expect(tabla.find('[data-test="rechazar-w1"]').exists()).toBe(true)
    expect(tabla.find('[data-test="pagar-w1"]').exists()).toBe(false)

    expect(tabla.find('[data-test="aprobar-w2"]').exists()).toBe(false)
    expect(tabla.find('[data-test="pagar-w2"]').exists()).toBe(true)

    expect(tabla.find('[data-test="aprobar-w3"]').exists()).toBe(false)
    expect(tabla.find('[data-test="rechazar-w3"]').exists()).toBe(false)
    expect(tabla.find('[data-test="pagar-w3"]').exists()).toBe(false)
  })

  it('RF-56.4 · D-20 · muestra los datos bancarios de HU-49 y el disponible del Embajador', async () => {
    const tabla = await mountSuspended(WithdrawalRequestsTable, { props: { solicitudes, modo: 'superadmin' } })
    const fila = tabla.find('[data-test="retiro-w1"]')

    expect(fila.text()).toContain('Ana Ruiz')
    expect(fila.text()).toContain('Bancolombia')
    expect(fila.text()).toContain('11111111')
    expect(fila.text()).toContain(cop(300_000))
    expect(tabla.find('[data-test="disponible-w1"]').text()).toContain(cop(1_000_000))
  })

  it('emite la solicitud sobre la que el Superadmin actúa', async () => {
    const tabla = await mountSuspended(WithdrawalRequestsTable, { props: { solicitudes, modo: 'superadmin' } })

    await tabla.find('[data-test="aprobar-w1"]').trigger('click')
    expect(tabla.emitted('aprobar')?.[0]?.[0]).toMatchObject({ id: 'w1' })
    await tabla.find('[data-test="rechazar-w1"]').trigger('click')
    expect(tabla.emitted('rechazar')?.[0]?.[0]).toMatchObject({ id: 'w1' })
    await tabla.find('[data-test="pagar-w2"]').trigger('click')
    expect(tabla.emitted('pagar')?.[0]?.[0]).toMatchObject({ id: 'w2' })
  })
})

describe('WithdrawalRejectForm', () => {
  it('CA-56.4 · sin motivo no emite y lo dice; con motivo emite el texto limpio', async () => {
    const formulario = await mountSuspended(WithdrawalRejectForm, { props: { solicitud: solicitud({ id: 'w1' }), enviando: false } })

    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-rechazo-motivo"]').text()).toContain('motivo')

    await formulario.find('[data-test="rechazo-motivo"]').setValue('  Cuenta bancaria inválida.  ')
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toEqual([['Cuenta bancaria inválida.']])
  })
})

describe('WithdrawalPayForm', () => {
  const aprobada = solicitud({ id: 'w2', status: 'approved', resolvedOn: '2026-10-16' })

  it('CA-56.6 · RF-56.4 · sin comprobante no emite y lo dice', async () => {
    const formulario = await mountSuspended(WithdrawalPayForm, { props: { solicitud: aprobada, enviando: false } })

    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-comprobante"]').text()).toContain('comprobante')
  })

  it('RF-56.4 · con un archivo admitido emite el archivo tal cual', async () => {
    const formulario = await mountSuspended(WithdrawalPayForm, { props: { solicitud: aprobada, enviando: false } })
    const archivo = new File(['%PDF-1.4'], 'comprobante.pdf', { type: 'application/pdf' })

    formulario.vm.elegirArchivo({ target: { files: [archivo] } } as unknown as Event)
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0]).toBe(archivo)
  })

  it('RF-56.4 · un formato no admitido se rechaza antes de emitir', async () => {
    const formulario = await mountSuspended(WithdrawalPayForm, { props: { solicitud: aprobada, enviando: false } })
    const archivo = new File(['x'], 'comprobante.txt', { type: 'text/plain' })

    formulario.vm.elegirArchivo({ target: { files: [archivo] } } as unknown as Event)
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-comprobante"]').text()).toContain('PDF')
  })
})

describe('WithdrawalMinimumForm', () => {
  it('RF-56.1 · D-06 · muestra el mínimo vigente y emite el nuevo como entero en pesos', async () => {
    const formulario = await mountSuspended(WithdrawalMinimumForm, { props: { minimo: pesos(200_000), enviando: false } })
    expect(formulario.text()).toContain(cop(200_000))

    await formulario.find('[data-test="minimo-monto"]').setValue('250000')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toEqual([[pesos(250_000)]])
  })

  it('RF-56.1 · un mínimo en cero no emite', async () => {
    const formulario = await mountSuspended(WithdrawalMinimumForm, { props: { minimo: pesos(200_000), enviando: false } })

    await formulario.find('[data-test="minimo-monto"]').setValue('0')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
  })
})
