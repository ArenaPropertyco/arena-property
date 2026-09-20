import { describe, expect, it } from 'vitest'
import {
  CATEGORIAS_DE_INVENTARIO,
  cambiosDeItem,
  darDeBaja,
  ESTADOS_DE_ITEM,
  itemsActivos,
  validarBaja,
  validarItem,
} from '#shared/properties/inventario'
import type { ItemDeInventario, NuevoItem } from '#shared/properties/inventario'

/**
 * HU-26 · RF-26.1, RF-26.2, RF-26.4 — el inventario de una propiedad: qué ítem
 * entra, cómo se da de baja sin perder el histórico y qué cambios quedan
 * historizados. Todo puro; la base repite las mismas reglas.
 */

const VALIDO: NuevoItem = {
  propertyId: 'p1',
  name: 'Sofá de tres puestos',
  category: 'furniture',
  condition: 'good',
  quantity: 1,
  location: 'Sala',
  notes: null,
}

function item(cambios: Partial<ItemDeInventario> = {}): ItemDeInventario {
  return {
    id: 'i1', propertyId: 'p1', name: 'Sofá de tres puestos', category: 'furniture', condition: 'good', quantity: 1,
    location: 'Sala', notes: null, createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z',
    retiredAt: null, retireReason: null,
    ...cambios,
  }
}

describe('RF-26.1 · el catálogo cerrado del ítem', () => {
  it('RF-26.1 · las categorías cubren mobiliario, equipamiento e insumos', () => {
    expect(CATEGORIAS_DE_INVENTARIO).toContain('furniture')
    expect(CATEGORIAS_DE_INVENTARIO).toContain('equipment')
    expect(CATEGORIAS_DE_INVENTARIO).toContain('supplies')
  })

  it('RF-26.1 · los estados son nuevo, bueno, regular y dañado', () => {
    expect(ESTADOS_DE_ITEM).toEqual(['new', 'good', 'fair', 'damaged'])
  })
})

describe('CA-26.1 · validación del ítem', () => {
  it('RF-26.1 · un ítem completo no produce errores', () => {
    expect(validarItem(VALIDO)).toEqual([])
  })

  it('CA-26.1 · una cantidad negativa se rechaza', () => {
    expect(validarItem({ ...VALIDO, quantity: -1 })).toEqual([{ name: 'quantity', message: 'inventory.validation.quantity_negative' }])
  })

  it('CA-26.1 · la cantidad tiene que ser un entero: no hay medio sofá', () => {
    expect(validarItem({ ...VALIDO, quantity: 1.5 })).toEqual([{ name: 'quantity', message: 'inventory.validation.quantity_not_integer' }])
  })

  it('RF-26.1 · cero es una cantidad válida: el ítem se agotó pero existe', () => {
    expect(validarItem({ ...VALIDO, quantity: 0 })).toEqual([])
  })

  it('CA-26.1 · sin categoría se rechaza', () => {
    expect(validarItem({ ...VALIDO, category: '' as never })).toEqual([{ name: 'category', message: 'inventory.validation.category_required' }])
  })

  it('CA-26.1 · una categoría fuera del catálogo se rechaza', () => {
    expect(validarItem({ ...VALIDO, category: 'mascotas' as never })).toEqual([{ name: 'category', message: 'inventory.validation.category_required' }])
  })

  it('RF-26.1 · sin nombre no hay ítem', () => {
    expect(validarItem({ ...VALIDO, name: '   ' })).toEqual([{ name: 'name', message: 'inventory.validation.name_required' }])
  })

  it('RF-26.1 · un estado fuera del catálogo se rechaza', () => {
    expect(validarItem({ ...VALIDO, condition: 'roto' as never })).toEqual([{ name: 'condition', message: 'inventory.validation.condition_required' }])
  })

  it('cada error señala su campo, para que el formulario lo pinte donde toca', () => {
    const errores = validarItem({ ...VALIDO, name: '', quantity: -2 })

    expect(errores.map(error => error.name)).toEqual(['name', 'quantity'])
  })
})

describe('CA-26.2 · la baja lógica conserva el histórico', () => {
  it('CA-26.2 · un ítem dado de baja deja de listarse como activo', () => {
    const activos = itemsActivos([item(), item({ id: 'i2', retiredAt: '2026-09-10T10:00:00Z', retireReason: 'Se rompió.' })])

    expect(activos.map(i => i.id)).toEqual(['i1'])
  })

  it('CA-26.2 · dar de baja no borra el ítem: lo marca con fecha y motivo y conserva lo demás', () => {
    const baja = darDeBaja(item(), 'Se rompió una pata.', '2026-09-10T10:00:00Z')

    expect(baja).toEqual({ ...item(), retiredAt: '2026-09-10T10:00:00Z', retireReason: 'Se rompió una pata.', updatedAt: '2026-09-10T10:00:00Z' })
    expect(baja.name).toBe('Sofá de tres puestos')
  })

  it('RF-26.2 · RF-A.4 · la baja exige motivo', () => {
    expect(validarBaja('   ')).toEqual(['inventory.validation.reason_required'])
    expect(validarBaja('Se rompió.')).toEqual([])
  })

  it('RF-26.2 · dar de baja un ítem ya retirado no lo cambia', () => {
    const ya = item({ retiredAt: '2026-09-10T10:00:00Z', retireReason: 'Se rompió.' })

    expect(darDeBaja(ya, 'Otra vez.', '2026-09-11T10:00:00Z')).toEqual(ya)
  })
})

describe('RF-26.4 · los cambios de estado y cantidad quedan historizados', () => {
  it('RF-26.4 · un cambio de estado produce una entrada con antes y después', () => {
    expect(cambiosDeItem(item(), item({ condition: 'damaged' }))).toEqual([
      { field: 'condition', previous: 'good', next: 'damaged' },
    ])
  })

  it('RF-26.4 · un cambio de cantidad produce su entrada, con los valores como texto', () => {
    expect(cambiosDeItem(item({ quantity: 6 }), item({ quantity: 4 }))).toEqual([
      { field: 'quantity', previous: '6', next: '4' },
    ])
  })

  it('RF-26.4 · estado y cantidad a la vez producen dos entradas', () => {
    expect(cambiosDeItem(item({ quantity: 6 }), item({ quantity: 5, condition: 'fair' }))).toEqual([
      { field: 'condition', previous: 'good', next: 'fair' },
      { field: 'quantity', previous: '6', next: '5' },
    ])
  })

  it('RF-26.4 · cambiar solo el nombre o la ubicación no historiza: no es estado ni cantidad', () => {
    expect(cambiosDeItem(item(), item({ name: 'Sofá', location: 'Terraza' }))).toEqual([])
  })

  it('CA-26.2 · la baja queda historizada como cambio de estado del ítem', () => {
    const baja = darDeBaja(item(), 'Se rompió.', '2026-09-10T10:00:00Z')

    expect(cambiosDeItem(item(), baja)).toEqual([{ field: 'retired', previous: 'active', next: 'retired' }])
  })
})
