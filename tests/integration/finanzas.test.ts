import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MovementForm from '~/components/MovementForm.vue'
import MovementSharesTable from '~/components/MovementSharesTable.vue'
import MovementsTable from '~/components/MovementsTable.vue'
import { generarCuotas } from '#shared/finance/cuotas'
import type { FraccionParaCuota } from '#shared/finance/cuotas'
import type { MaestraContable } from '#shared/finance/maestra'
import type { NuevoMovimiento } from '#shared/finance/movimientos'
import type { CuotaListada, MovimientoListado } from '#shared/finance/vistas'
import { pesos } from '#shared/money/importe'

/**
 * HU-23 · RF-23.2, RF-23.3, RF-23.4, RF-23.5 · RT-06 · principio 10 · los
 * componentes de gastos reciben la maestra, los movimientos y las cuotas ya
 * generadas por la base y emiten lo que el Administrador decide. Ninguno consulta
 * Supabase ni prorratea un peso: las cuotas llegan hechas.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const PROPIEDAD = 'a2300000-0000-4000-8000-000000000001'

const maestra: MaestraContable = {
  categorias: [
    { id: 'cat-mantenimiento', name: 'Mantenimiento', kind: 'expense', scope: 'property', active: true },
    { id: 'cat-servicios', name: 'Servicios públicos', kind: 'expense', scope: 'property', active: true },
    { id: 'cat-renta', name: 'Renta a terceros', kind: 'income', scope: 'property', active: true },
    { id: 'cat-comisiones', name: 'Comisiones a Embajadores', kind: 'expense', scope: 'platform', active: true },
    { id: 'cat-inactiva', name: 'Retirada', kind: 'expense', scope: 'property', active: false },
  ],
  medios: [
    { id: 'medio-transfer', code: 'transfer', name: 'Transferencia', active: true },
    { id: 'medio-cash', code: 'cash', name: 'Efectivo', active: true },
  ],
  cuentas: [
    { id: 'cuenta-banco', code: 'bank', name: 'Cuenta bancaria', active: true },
  ],
}

function fracciones(activas: number[] = []): FraccionParaCuota[] {
  return Array.from({ length: 8 }, (_, indice) => {
    const number = indice + 1
    return activas.includes(number)
      ? { number, status: 'sold', ownerId: `titular-${number}`, calendarActive: true, calendarActivatedAt: '2026-01-01T05:00:00Z' }
      : { number, status: 'available', ownerId: null, calendarActive: false, calendarActivatedAt: null }
  })
}

function cuotas(monto: number, activas: number[] = [], revertidas = false): CuotaListada[] {
  return generarCuotas(pesos(monto), fracciones(activas), '2026-09-14').map(cuota => ({
    id: `cuota-${cuota.fraction}`,
    movementId: 'mov-1',
    fraction: cuota.fraction,
    amount: cuota.amount,
    hasRemainder: cuota.hasRemainder,
    payer: cuota.payer,
    payerLabel: cuota.payerId ? `Titular ${cuota.fraction}` : null,
    reversedAt: revertidas ? '2026-09-15T10:00:00Z' : null,
  }))
}

function movimiento(cambios: Partial<MovimientoListado> = {}): MovimientoListado {
  return {
    id: 'mov-1',
    propertyId: PROPIEDAD,
    kind: 'expense',
    amount: pesos(100_000),
    categoryName: 'Mantenimiento',
    paymentMethodName: 'Transferencia',
    accountName: 'Cuenta bancaria',
    incurredOn: '2026-09-14',
    description: 'Bomba de la piscina',
    createdAt: '2026-09-14T15:00:00Z',
    voidedAt: null,
    voidReason: null,
    ...cambios,
  }
}

describe('MovementForm', () => {
  async function montar() {
    return mountSuspended(MovementForm, { props: { propertyId: PROPIEDAD, maestra, enviando: false } })
  }

  function elegirCategoria(formulario: Awaited<ReturnType<typeof montar>>, id: string) {
    formulario.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', id)
  }

  it('RF-23.2 · emite el gasto completo con monto entero, categoría, medio, cuenta, fecha y descripción', async () => {
    const formulario = await montar()

    await formulario.find('[data-test="campo-monto"] input').setValue('100000')
    elegirCategoria(formulario, 'cat-mantenimiento')
    await formulario.find('[data-test="campo-fecha"] input').setValue('2026-09-14')
    await formulario.find('[data-test="campo-descripcion"] textarea').setValue('Bomba de la piscina')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    const emitido = formulario.emitted('submit')?.[0]?.[0] as NuevoMovimiento
    expect(emitido).toEqual({
      propertyId: PROPIEDAD,
      kind: 'expense',
      amount: 100_000,
      categoryId: 'cat-mantenimiento',
      paymentMethodId: 'medio-transfer',
      accountId: 'cuenta-banco',
      incurredOn: '2026-09-14',
      description: 'Bomba de la piscina',
    })
    expect(typeof emitido.amount).toBe('number')
  })

  it('CA-23.3 · un gasto sin categoría no se emite y lo dice en su campo', async () => {
    const formulario = await montar()

    await formulario.find('[data-test="campo-monto"] input').setValue('100000')
    await formulario.find('[data-test="campo-descripcion"] textarea').setValue('Sin categoría')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-categoria"]').text()).toContain('Elige la categoría')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('CA-23.3 · un monto de cero no se emite', async () => {
    const formulario = await montar()

    await formulario.find('[data-test="campo-monto"] input').setValue('0')
    elegirCategoria(formulario, 'cat-mantenimiento')
    await formulario.find('[data-test="campo-descripcion"] textarea').setValue('Cero')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-monto"]').text()).toContain('mayor que cero')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('CA-23.6 · RF-23.5 · la categoría de comisiones a Embajadores no se ofrece ni se acepta (D-01)', async () => {
    const formulario = await montar()
    const opciones = formulario.findComponent({ name: 'USelect' }).props('items') as { value: string }[]

    expect(opciones.map(opcion => opcion.value)).toEqual(['cat-mantenimiento', 'cat-servicios'])

    await formulario.find('[data-test="campo-monto"] input').setValue('5000000')
    elegirCategoria(formulario, 'cat-comisiones')
    await formulario.find('[data-test="campo-descripcion"] textarea').setValue('Comisión de Ana')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.find('[data-test="campo-categoria"]').text()).toContain('costo de Arena')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('RF-23.7 · la fecha de causación viene propuesta y se explica como periodo, no como día de pago', async () => {
    const formulario = await montar()

    expect((formulario.find('[data-test="campo-fecha"] input').element as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(formulario.find('[data-test="campo-fecha"]').text()).toContain('no el día en que se pagó')
  })
})

describe('MovementSharesTable', () => {
  it('CA-23.1 · muestra las 8 cuotas de $12.500 y su suma exacta', async () => {
    const tabla = await mountSuspended(MovementSharesTable, { props: { cuotas: cuotas(100_000) } })

    expect(tabla.findAll('[data-test^="cuota-"]')).toHaveLength(8)
    expect(tabla.find('[data-test="cuota-1"]').text()).toContain('12.500')
    expect(tabla.find('[data-test="cuota-8"]').text()).toContain('12.500')
    expect(tabla.find('[data-test="total-cuotas"]').text()).toContain('100.000')
    expect(tabla.findAll('[data-test^="residuo-"]')).toHaveLength(0)
  })

  it('CA-23.2 · RF-D.3 · la cuota con residuo queda explícita', async () => {
    const tabla = await mountSuspended(MovementSharesTable, { props: { cuotas: cuotas(100_001) } })

    expect(tabla.find('[data-test="cuota-1"]').text()).toContain('12.501')
    expect(tabla.find('[data-test="residuo-1"]').exists()).toBe(true)
    expect(tabla.find('[data-test="residuo-2"]').exists()).toBe(false)
    expect(tabla.find('[data-test="total-cuotas"]').text()).toContain('100.001')
  })

  it('CA-23.5 · dice quién paga cada cuota: el Propietario o el titular del inventario', async () => {
    const tabla = await mountSuspended(MovementSharesTable, { props: { cuotas: cuotas(80_000, [2, 5, 7]) } })

    expect(tabla.find('[data-test="pagador-2"]').text()).toContain('Titular 2')
    expect(tabla.find('[data-test="pagador-1"]').text()).toContain('Titular del inventario')
    expect(tabla.findAll('[data-test^="pagador-"]').filter(nodo => nodo.text().includes('Titular del inventario'))).toHaveLength(5)
  })

  it('CA-23.4 · las cuotas revertidas se marcan sin desaparecer', async () => {
    const tabla = await mountSuspended(MovementSharesTable, { props: { cuotas: cuotas(100_000, [], true) } })

    expect(tabla.findAll('[data-test^="cuota-"]')).toHaveLength(8)
    expect(tabla.findAll('[data-test^="revertida-"]')).toHaveLength(8)
  })
})

describe('MovementsTable', () => {
  it('RF-23.2 · lista el gasto con su causación y ofrece ver las cuotas y anularlo', async () => {
    const tabla = await mountSuspended(MovementsTable, {
      props: { movimientos: [movimiento()], puedeGestionar: true },
    })

    expect(tabla.find('[data-test="monto-movimiento-mov-1"]').text()).toContain('100.000')
    expect(tabla.text()).toContain('Bomba de la piscina')
    expect(tabla.text()).toContain('Mantenimiento')

    await tabla.find('[data-test="ver-cuotas-mov-1"]').trigger('click')
    expect(tabla.emitted('verCuotas')).toEqual([['mov-1']])

    await tabla.find('[data-test="anular-movimiento-mov-1"]').trigger('click')
    expect(tabla.emitted('anular')).toEqual([['mov-1']])
  })

  it('CA-23.4 · un gasto anulado sigue en la lista, marcado y sin la acción de anular', async () => {
    const tabla = await mountSuspended(MovementsTable, {
      props: { movimientos: [movimiento({ voidedAt: '2026-09-15T10:00:00Z', voidReason: 'Factura duplicada.' })], puedeGestionar: true },
    })

    expect(tabla.find('[data-test="anulado-mov-1"]').text()).toBe('Anulado')
    expect(tabla.find('[data-test="anular-movimiento-mov-1"]').exists()).toBe(false)
    expect(tabla.find('[data-test="ver-cuotas-mov-1"]').exists()).toBe(true)
  })

  it('RF-23.6 · el Propietario ve la lista sin acciones de escritura', async () => {
    const tabla = await mountSuspended(MovementsTable, {
      props: { movimientos: [movimiento()], puedeGestionar: false },
    })

    expect(tabla.find('[data-test="anular-movimiento-mov-1"]').exists()).toBe(false)
    expect(tabla.find('[data-test="ver-cuotas-mov-1"]').exists()).toBe(true)
  })
})
