import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import InventoryHistoryList from '~/components/InventoryHistoryList.vue'
import InventoryItemForm from '~/components/InventoryItemForm.vue'
import InventoryTable from '~/components/InventoryTable.vue'
import MaintenanceTable from '~/components/MaintenanceTable.vue'
import MovementForm from '~/components/MovementForm.vue'
import type { MaestraContable } from '#shared/finance/maestra'
import type { NuevoMovimiento } from '#shared/finance/movimientos'
import type { MovimientoListado } from '#shared/finance/vistas'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import type { EntradaDeHistorial, ItemDeInventario, NuevoItem } from '#shared/properties/inventario'

/**
 * HU-26 · RF-26.1…RF-26.4 · HU-27 · RF-27.1…RF-27.3 · HU-28 · RF-28.1, RF-28.2 ·
 * RT-06 · principio 10 — los componentes del inventario y del mantenimiento
 * reciben ítems, historial y movimientos ya resueltos y emiten lo que el
 * Administrador decide. Ninguno consulta ni reparte un peso.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const PROPIEDAD = 'p1'

function item(cambios: Partial<ItemDeInventario> & { id: string }): ItemDeInventario {
  return {
    propertyId: PROPIEDAD, name: 'Sofá de tres puestos', category: 'furniture', condition: 'good', quantity: 1,
    location: 'Sala', notes: null, createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z',
    retiredAt: null, retireReason: null,
    ...cambios,
  }
}

function movimiento(cambios: Partial<MovimientoListado> & { id: string }): MovimientoListado {
  return {
    propertyId: PROPIEDAD, kind: 'expense', amount: pesos(80_000), categoryName: 'Mantenimiento',
    paymentMethodName: 'Transferencia', accountName: 'Banco', incurredOn: '2026-09-14', description: 'Cambio del rodamiento',
    allocation: 'prorated', fractionNumber: null, commissionBasisPoints: null, commissionAmount: null,
    weekIndex: null, weekStartsOn: null, createdAt: '2026-09-14T10:00:00Z', voidedAt: null, voidReason: null,
    maintenance: true, inventoryItemId: 'i1', inventoryItemName: 'Bomba de la piscina',
    attachmentPath: 'p1/abc-factura.pdf', attachmentUrl: 'https://firmada/factura.pdf',
    ...cambios,
  }
}

const ITEMS: ItemDeInventario[] = [
  item({ id: 'i1', name: 'Bomba de la piscina', category: 'equipment', condition: 'damaged', quantity: 1 }),
  item({ id: 'i2', name: 'Toallas', category: 'linens', condition: 'new', quantity: 12, location: null }),
  item({ id: 'i3', name: 'Sofá viejo', retiredAt: '2026-09-10T10:00:00Z', retireReason: 'Se rompió el armazón.' }),
]

describe('InventoryItemForm', () => {
  it('RF-26.1 · emite el ítem completo con nombre, categoría, estado, cantidad entera y ubicación', async () => {
    const formulario = await mountSuspended(InventoryItemForm, { props: { propertyId: PROPIEDAD, enviando: false } })

    await formulario.find('[data-test="campo-nombre"] input').setValue('  Nevera  ')
    formulario.findAllComponents({ name: 'USelect' })[0]!.vm.$emit('update:modelValue', 'appliances')
    formulario.findAllComponents({ name: 'USelect' })[1]!.vm.$emit('update:modelValue', 'new')
    await formulario.find('[data-test="campo-cantidad"] input').setValue('2')
    await formulario.find('[data-test="campo-ubicacion"] input').setValue('Cocina')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0] as NuevoItem).toEqual({
      propertyId: PROPIEDAD, name: 'Nevera', category: 'appliances', condition: 'new', quantity: 2, location: 'Cocina', notes: null,
    })
  })

  it('CA-26.1 · una cantidad negativa no se emite y lo dice en su campo', async () => {
    const formulario = await mountSuspended(InventoryItemForm, { props: { propertyId: PROPIEDAD, enviando: false } })

    await formulario.find('[data-test="campo-nombre"] input').setValue('Nevera')
    formulario.findAllComponents({ name: 'USelect' })[0]!.vm.$emit('update:modelValue', 'appliances')
    await formulario.find('[data-test="campo-cantidad"] input').setValue('-1')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-cantidad"]').text()).toContain('La cantidad no puede ser negativa.')
  })

  it('CA-26.1 · sin categoría no se emite y lo dice en su campo', async () => {
    const formulario = await mountSuspended(InventoryItemForm, { props: { propertyId: PROPIEDAD, enviando: false } })

    await formulario.find('[data-test="campo-nombre"] input').setValue('Nevera')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-categoria"]').text()).toContain('Elige la categoría del ítem.')
  })

  it('RF-26.1 · al editar viene prellenado con el ítem y emite los cambios', async () => {
    const formulario = await mountSuspended(InventoryItemForm, { props: { propertyId: PROPIEDAD, item: ITEMS[0]!, enviando: false } })

    expect((formulario.find('[data-test="campo-nombre"] input').element as HTMLInputElement).value).toBe('Bomba de la piscina')
    await formulario.find('[data-test="campo-cantidad"] input').setValue('0')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0] as NuevoItem).toMatchObject({ name: 'Bomba de la piscina', category: 'equipment', quantity: 0 })
  })
})

describe('InventoryTable', () => {
  it('RF-26.1 · lista cada ítem con su categoría, su estado y su cantidad, y ofrece editar, dar de baja e historial', async () => {
    const tabla = await mountSuspended(InventoryTable, { props: { items: ITEMS, puedeGestionar: true } })

    expect(tabla.find('[data-test="item-i1"]').text()).toContain('Bomba de la piscina')
    expect(tabla.find('[data-test="estado-i1"]').text()).toContain('Dañado')
    expect(tabla.find('[data-test="cantidad-i2"]').text()).toContain('12')
    expect(tabla.find('[data-test="item-i2"]').text()).toContain('Lencería')

    await tabla.find('[data-test="editar-i1"]').trigger('click')
    await tabla.find('[data-test="retirar-i1"]').trigger('click')
    await tabla.find('[data-test="historial-i1"]').trigger('click')
    expect(tabla.emitted('editar')?.[0]).toEqual(['i1'])
    expect(tabla.emitted('darDeBaja')?.[0]).toEqual(['i1'])
    expect(tabla.emitted('verHistorial')?.[0]).toEqual(['i1'])
  })

  it('CA-26.2 · un ítem dado de baja sigue en la lista del Administrador, marcado y sin acciones de escritura', async () => {
    const tabla = await mountSuspended(InventoryTable, { props: { items: ITEMS, puedeGestionar: true } })

    expect(tabla.find('[data-test="baja-i3"]').text()).toContain('Dado de baja')
    expect(tabla.find('[data-test="item-i3"]').text()).toContain('Se rompió el armazón.')
    expect(tabla.find('[data-test="editar-i3"]').exists()).toBe(false)
    expect(tabla.find('[data-test="retirar-i3"]').exists()).toBe(false)
    expect(tabla.find('[data-test="historial-i3"]').exists()).toBe(true)
  })

  it('RF-28.2 · el Propietario ve la lista sin acciones de escritura', async () => {
    const tabla = await mountSuspended(InventoryTable, { props: { items: ITEMS.slice(0, 2), puedeGestionar: false } })

    expect(tabla.find('[data-test="item-i1"]').exists()).toBe(true)
    expect(tabla.find('[data-test="editar-i1"]').exists()).toBe(false)
    expect(tabla.find('[data-test="retirar-i1"]').exists()).toBe(false)
    expect(tabla.find('[data-test="historial-i1"]').exists()).toBe(true)
  })

  it('RF-26.1 · sin ítems lo dice', async () => {
    const tabla = await mountSuspended(InventoryTable, { props: { items: [], puedeGestionar: true } })

    expect(tabla.find('[data-test="sin-items"]').exists()).toBe(true)
  })
})

describe('InventoryHistoryList', () => {
  const entradas: EntradaDeHistorial[] = [
    { id: 'h1', itemId: 'i1', field: 'condition', previous: 'good', next: 'damaged', changedAt: '2026-09-12T10:00:00Z', changedByLabel: 'Ana Ruiz', note: null },
    { id: 'h2', itemId: 'i1', field: 'quantity', previous: '2', next: '1', changedAt: '2026-09-13T10:00:00Z', changedByLabel: null, note: null },
  ]

  it('RF-26.4 · muestra cada cambio con su antes, su después y quién lo hizo', async () => {
    const lista = await mountSuspended(InventoryHistoryList, { props: { entradas, mantenimientos: [] } })

    expect(lista.find('[data-test="cambio-h1"]').text()).toContain('Bueno')
    expect(lista.find('[data-test="cambio-h1"]').text()).toContain('Dañado')
    expect(lista.find('[data-test="cambio-h1"]').text()).toContain('Ana Ruiz')
    expect(lista.find('[data-test="cambio-h2"]').text()).toContain('2 → 1')
    expect(lista.find('[data-test="sin-mantenimientos-item"]').exists()).toBe(true)
  })

  it('CA-27.2 · RF-27.3 · desde el ítem se consulta su historial de mantenimientos con el monto en IBM Plex Mono', async () => {
    const lista = await mountSuspended(InventoryHistoryList, { props: { entradas: [], mantenimientos: [movimiento({ id: 'm1' })] } })

    expect(lista.find('[data-test="sin-historial"]').exists()).toBe(true)
    const fila = lista.find('[data-test="mantenimiento-m1"]')
    expect(fila.text()).toContain('Cambio del rodamiento')
    expect(lista.find('[data-test="monto-m1"]').text()).toContain(formatearImporte(pesos(80_000), 'es'))
    expect(lista.find('[data-test="monto-m1"]').classes()).toContain('font-mono')
  })
})

describe('MaintenanceTable', () => {
  it('RF-28.1 · lista los mantenimientos de la propiedad con su ítem o «en general», el monto y la factura', async () => {
    const tabla = await mountSuspended(MaintenanceTable, { props: { movimientos: [
      movimiento({ id: 'm1' }),
      movimiento({ id: 'm2', inventoryItemId: null, inventoryItemName: null, attachmentPath: null, attachmentUrl: null, description: 'Fumigación general', amount: pesos(40_000) }),
    ] } })

    expect(tabla.find('[data-test="item-m1"]').text()).toContain('Bomba de la piscina')
    expect(tabla.find('[data-test="item-m2"]').text()).toContain('Propiedad en general')
    expect(tabla.find('[data-test="monto-m1"]').text()).toContain(formatearImporte(pesos(80_000), 'es'))
    expect(tabla.find('[data-test="monto-m1"]').classes()).toContain('font-mono')
    expect(tabla.find('[data-test="factura-m1"]').attributes('href')).toBe('https://firmada/factura.pdf')
    expect(tabla.find('[data-test="factura-m2"]').exists()).toBe(false)
  })

  it('CA-27.1 · RF-27.2 · un mantenimiento anulado sigue en la lista, marcado', async () => {
    const tabla = await mountSuspended(MaintenanceTable, { props: { movimientos: [movimiento({ id: 'm1', voidedAt: '2026-09-15T10:00:00Z', voidReason: 'Duplicado' })] } })

    expect(tabla.find('[data-test="anulado-m1"]').exists()).toBe(true)
  })

  it('RF-28.1 · sin mantenimientos lo dice', async () => {
    const tabla = await mountSuspended(MaintenanceTable, { props: { movimientos: [] } })

    expect(tabla.find('[data-test="sin-mantenimientos"]').exists()).toBe(true)
  })
})

describe('MovementForm en modo mantenimiento', () => {
  const maestra: MaestraContable = {
    categorias: [{ id: 'cat-mantenimiento', name: 'Mantenimiento', kind: 'expense', scope: 'property', active: true }],
    medios: [{ id: 'medio-transfer', code: 'transfer', name: 'Transferencia', active: true }],
    cuentas: [{ id: 'cuenta-banco', code: 'bank', name: 'Banco', active: true }],
  }
  const items = [{ id: 'i1', name: 'Bomba de la piscina', retired: false }, { id: 'i3', name: 'Sofá viejo', retired: true }]

  function archivo(nombre: string, tipo: string, tamano: number): File {
    return new File([new Uint8Array(tamano)], nombre, { type: tipo })
  }

  async function adjuntar(formulario: Awaited<ReturnType<typeof mountSuspended>>, file: File) {
    const entrada = formulario.find('[data-test="gasto-adjunto"] input, input[type="file"]')
    Object.defineProperty(entrada.element, 'files', { value: [file], configurable: true })
    await entrada.trigger('change')
  }

  async function completar(formulario: Awaited<ReturnType<typeof mountSuspended>>) {
    await formulario.find('[data-test="campo-monto"] input').setValue('80000')
    formulario.findAllComponents({ name: 'USelect' })[0]!.vm.$emit('update:modelValue', 'cat-mantenimiento')
    await formulario.find('[data-test="campo-fecha"] input').setValue('2026-09-14')
    await formulario.find('[data-test="campo-descripcion"] textarea').setValue('Cambio del rodamiento')
  }

  it('RF-27.1 · asociado a un ítem emite el gasto marcado como mantenimiento con el ítem y el archivo', async () => {
    const formulario = await mountSuspended(MovementForm, { props: { propertyId: PROPIEDAD, maestra, fracciones: [], items, mantenimiento: true, enviando: false } })

    await completar(formulario)
    formulario.findAllComponents({ name: 'USelect' })[1]!.vm.$emit('update:modelValue', 'i1')
    const factura = archivo('factura.pdf', 'application/pdf', 1024)
    await adjuntar(formulario, factura)
    await formulario.find('form').trigger('submit')
    await flushPromises()

    const [emitido, adjunto] = formulario.emitted('submit')?.[0] as [NuevoMovimiento, File | null]
    expect(emitido).toMatchObject({ amount: 80_000, categoryId: 'cat-mantenimiento', maintenance: true, inventoryItemId: 'i1', allocation: 'prorated' })
    expect(adjunto).toBe(factura)
  })

  it('RF-27.1 · sin elegir ítem es un mantenimiento de la propiedad en general, sin archivo', async () => {
    const formulario = await mountSuspended(MovementForm, { props: { propertyId: PROPIEDAD, maestra, fracciones: [], items, mantenimiento: true, enviando: false } })

    await completar(formulario)
    await formulario.find('form').trigger('submit')
    await flushPromises()

    const [emitido, adjunto] = formulario.emitted('submit')?.[0] as [NuevoMovimiento, File | null]
    expect(emitido).toMatchObject({ maintenance: true, inventoryItemId: null })
    expect(adjunto).toBeNull()
  })

  it('CA-27.3 · una factura en un formato no admitido no se emite y lo dice en su campo', async () => {
    const formulario = await mountSuspended(MovementForm, { props: { propertyId: PROPIEDAD, maestra, fracciones: [], items, mantenimiento: true, enviando: false } })

    await completar(formulario)
    await adjuntar(formulario, archivo('factura.zip', 'application/zip', 1024))
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-adjunto"]').text()).toContain('JPG, PNG, WebP o PDF')
  })

  it('RF-27.1 · el selector ofrece los ítems de la propiedad, con los dados de baja señalados', async () => {
    const formulario = await mountSuspended(MovementForm, { props: { propertyId: PROPIEDAD, maestra, fracciones: [], items, mantenimiento: true, enviando: false } })

    const opciones = (formulario.findAllComponents({ name: 'USelect' })[1]!.props('items') as { label: string }[]).map(o => o.label)
    expect(opciones[0]).toBe('Propiedad en general')
    expect(opciones).toContain('Bomba de la piscina')
    expect(opciones).toContain('Sofá viejo (dado de baja)')
  })

  it('RF-23.2 · fuera del modo mantenimiento no ofrece ítem ni factura', async () => {
    const formulario = await mountSuspended(MovementForm, { props: { propertyId: PROPIEDAD, maestra, fracciones: [], enviando: false } })

    expect(formulario.find('[data-test="gasto-item"]').exists()).toBe(false)
    expect(formulario.find('[data-test="gasto-adjunto"]').exists()).toBe(false)
  })
})
