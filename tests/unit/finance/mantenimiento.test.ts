import { describe, expect, it } from 'vitest'
import { generarCuotas } from '#shared/finance/cuotas'
import type { FraccionParaCuota } from '#shared/finance/cuotas'
import { desglosePorCategoria } from '#shared/finance/estado-de-cuenta'
import type { LineaDelPropietario } from '#shared/finance/estado-de-cuenta'
import {
  BUCKET_DE_ADJUNTOS,
  esMantenimiento,
  mantenimientosDe,
  mantenimientosGenerales,
  rutaDeAdjunto,
  validarAdjunto,
} from '#shared/finance/mantenimiento'
import type { MovimientoListado } from '#shared/finance/vistas'
import { validarMovimiento } from '#shared/finance/movimientos'
import type { NuevoMovimiento } from '#shared/finance/movimientos'
import type { MaestraContable } from '#shared/finance/maestra'
import { pesos } from '#shared/money/importe'

/**
 * HU-27 · RF-27.1…RF-27.3 — el gasto de mantenimiento es un gasto de HU-23, ni
 * más ni menos: se reparte igual, aparece en el estado de cuenta igual y solo
 * añade a qué ítem del inventario pertenece y su factura adjunta.
 */

function movimiento(cambios: Partial<MovimientoListado> & { id: string }): MovimientoListado {
  return {
    propertyId: 'p1', kind: 'expense', amount: pesos(80_000), categoryName: 'Mantenimiento',
    paymentMethodName: 'Transferencia', accountName: 'Banco', incurredOn: '2026-09-14', description: 'Reparación',
    allocation: 'prorated', fractionNumber: null, commissionBasisPoints: null, commissionAmount: null,
    weekIndex: null, weekStartsOn: null, createdAt: '2026-09-14T10:00:00Z', voidedAt: null, voidReason: null,
    maintenance: true, inventoryItemId: null, inventoryItemName: null, attachmentPath: null, attachmentUrl: null,
    ...cambios,
  }
}

describe('CA-27.1 · el gasto de mantenimiento es un gasto de HU-23', () => {
  const fracciones: FraccionParaCuota[] = Array.from({ length: 8 }, (_, i) => ({
    id: `f${i + 1}`, number: i + 1, status: 'sold', ownerId: `u${i + 1}`, calendarActive: true, calendarActivatedAt: '2026-01-01',
  }))

  it('CA-27.1 · $80.000 de mantenimiento generan las 8 cuotas de $10.000 con la misma regla que cualquier gasto', () => {
    const cuotas = generarCuotas(pesos(80_000), fracciones, '2026-09-14')

    expect(cuotas).toHaveLength(8)
    expect(cuotas.every(cuota => cuota.amount === pesos(10_000))).toBe(true)
    expect(cuotas.reduce((suma, cuota) => suma + cuota.amount, 0)).toBe(80_000)
  })

  it('CA-27.1 · y aparece en el desglose del Propietario como un gasto prorrateado de su categoría', () => {
    const linea: LineaDelPropietario = {
      shareId: 's1', movementId: 'm1', propertyId: 'p1', propertyName: 'Casa Arena', fraction: 3, kind: 'expense',
      allocation: 'prorated', amount: pesos(10_000), movementAmount: pesos(80_000), categoryName: 'Mantenimiento',
      incurredOn: '2026-09-14', description: 'Bomba de la piscina', hasRemainder: false, commissionBasisPoints: null,
      commissionAmount: null, weekIndex: null, weekStartsOn: null, reversedAt: null,
    }
    const grupos = desglosePorCategoria([linea])

    expect(grupos).toHaveLength(1)
    expect(grupos[0]).toMatchObject({ categoryName: 'Mantenimiento', naturaleza: 'prorated', total: pesos(10_000) })
  })
})

describe('CA-27.2 · el historial de mantenimientos por ítem', () => {
  const lista = [
    movimiento({ id: 'm1', inventoryItemId: 'i1', incurredOn: '2026-08-01' }),
    movimiento({ id: 'm2', inventoryItemId: 'i2' }),
    movimiento({ id: 'm3', inventoryItemId: null, description: 'Fumigación general' }),
    movimiento({ id: 'm4', inventoryItemId: 'i1', incurredOn: '2026-09-20' }),
    movimiento({ id: 'm5', maintenance: false, inventoryItemId: null, categoryName: 'Servicios' }),
  ]

  it('CA-27.2 · el historial del ítem I incluye los gastos asociados a I, del más reciente al más antiguo', () => {
    expect(mantenimientosDe(lista, 'i1').map(m => m.id)).toEqual(['m4', 'm1'])
  })

  it('CA-27.2 · un gasto general no aparece en ningún ítem', () => {
    expect(mantenimientosDe(lista, 'i1').some(m => m.id === 'm3')).toBe(false)
    expect(mantenimientosDe(lista, 'i2').some(m => m.id === 'm3')).toBe(false)
    expect(mantenimientosGenerales(lista).map(m => m.id)).toEqual(['m3'])
  })

  it('RF-27.2 · un gasto que no es de mantenimiento no entra en el historial aunque sea de la propiedad', () => {
    expect(esMantenimiento(lista[4]!)).toBe(false)
    expect(mantenimientosGenerales(lista).some(m => m.id === 'm5')).toBe(false)
  })

  it('RF-27.1 · un gasto asociado a un ítem es de mantenimiento aunque no se marque', () => {
    expect(esMantenimiento(movimiento({ id: 'x', maintenance: false, inventoryItemId: 'i9' }))).toBe(true)
  })
})

describe('RF-27.1 · la asociación a un ítem se valida con los del inventario de la propiedad', () => {
  const maestra: MaestraContable = {
    categorias: [{ id: 'cat-mant', name: 'Mantenimiento', kind: 'expense', scope: 'property', active: true }],
    medios: [{ id: 'medio', code: 'transfer', name: 'Transferencia', active: true }],
    cuentas: [{ id: 'cuenta', code: 'bank', name: 'Banco', active: true }],
  }
  const base: NuevoMovimiento = {
    propertyId: 'p1', kind: 'expense', amount: pesos(80_000), categoryId: 'cat-mant', paymentMethodId: 'medio',
    accountId: 'cuenta', incurredOn: '2026-09-14', description: 'Reparación', allocation: 'prorated', fractionId: null,
    maintenance: true, inventoryItemId: 'i1',
  }
  const items = [{ id: 'i1', name: 'Nevera', retired: false }, { id: 'i2', name: 'Sofá viejo', retired: true }]

  it('RF-27.1 · asociado a un ítem activo de la propiedad entra', () => {
    expect(validarMovimiento(base, maestra, [], items)).toEqual([])
  })

  it('RF-27.1 · asociado a un ítem que no es de la propiedad se rechaza', () => {
    expect(validarMovimiento({ ...base, inventoryItemId: 'i-ajeno' }, maestra, [], items))
      .toEqual([{ name: 'inventoryItemId', message: 'finance.validation.item_not_in_property' }])
  })

  it('RF-27.1 · un mantenimiento tardío sobre un ítem ya dado de baja también entra: el gasto ocurrió', () => {
    expect(validarMovimiento({ ...base, inventoryItemId: 'i2' }, maestra, [], items)).toEqual([])
  })

  it('RF-27.1 · un gasto general de mantenimiento no lleva ítem y entra igual', () => {
    expect(validarMovimiento({ ...base, inventoryItemId: null }, maestra, [], items)).toEqual([])
  })
})

describe('CA-27.3 · la factura adjunta', () => {
  it('CA-27.3 · vive en un bucket privado propio, con la propiedad como primera carpeta', () => {
    expect(BUCKET_DE_ADJUNTOS).toBe('movement-attachments')
    expect(rutaDeAdjunto('p1', 'factura ñ 01.pdf', 'abc')).toMatch(/^p1\/abc-factura/)
    expect(rutaDeAdjunto('p1', '', 'abc')).toBe('p1/abc')
  })

  it('RF-27.1 · acepta fotos y PDF de hasta 10 MiB', () => {
    expect(validarAdjunto({ mime: 'image/jpeg', size: 1024 })).toBeNull()
    expect(validarAdjunto({ mime: 'application/pdf', size: 10 * 1024 * 1024 })).toBeNull()
  })

  it('RF-27.1 · rechaza otros formatos, el vacío y lo que se pasa de tamaño', () => {
    expect(validarAdjunto({ mime: 'application/zip', size: 10 })).toBe('finance.validation.attachment_format')
    expect(validarAdjunto({ mime: 'image/png', size: 0 })).toBe('finance.validation.attachment_empty')
    expect(validarAdjunto({ mime: 'image/png', size: 10 * 1024 * 1024 + 1 })).toBe('finance.validation.attachment_too_large')
  })
})
