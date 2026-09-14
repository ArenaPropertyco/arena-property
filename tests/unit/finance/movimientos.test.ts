import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import type { MaestraContable } from '#shared/finance/maestra'
import {
  CLAVES_DE_VALIDACION_DE_MOVIMIENTO,
  validarAnulacionDeMovimiento,
  validarMovimiento,
} from '#shared/finance/movimientos'
import type { NuevoMovimiento } from '#shared/finance/movimientos'

/**
 * HU-23 · RF-23.2, RF-23.4, RF-23.5 · D-01 — qué gasto entra y cuál se rechaza.
 *
 * El formulario valida con esto y muestra el mensaje; la base vuelve a comprobar
 * la categoría, el monto y el motivo por su cuenta, porque una ruta nueva podría
 * saltarse el formulario pero no el disparador.
 */

const maestra: MaestraContable = {
  categorias: [
    { id: 'cat-mantenimiento', name: 'Mantenimiento', kind: 'expense', scope: 'property', active: true },
    { id: 'cat-renta', name: 'Renta a terceros', kind: 'income', scope: 'property', active: true },
    { id: 'cat-comisiones', name: 'Comisiones a Embajadores', kind: 'expense', scope: 'platform', active: true },
    { id: 'cat-inactiva', name: 'Categoría retirada', kind: 'expense', scope: 'property', active: false },
  ],
  medios: [
    { id: 'medio-transfer', code: 'transfer', name: 'Transferencia', active: true },
    { id: 'medio-viejo', code: 'old', name: 'Retirado', active: false },
  ],
  cuentas: [
    { id: 'cuenta-banco', code: 'bank', name: 'Cuenta bancaria', active: true },
  ],
}

function gasto(cambios: Partial<NuevoMovimiento> = {}): NuevoMovimiento {
  return {
    propertyId: 'a5000000-0000-4000-8000-000000000001',
    kind: 'expense',
    amount: pesos(100_000),
    categoryId: 'cat-mantenimiento',
    paymentMethodId: 'medio-transfer',
    accountId: 'cuenta-banco',
    incurredOn: '2026-09-14',
    description: 'Reparación de la bomba de la piscina',
    ...cambios,
  }
}

function mensajes(cambios: Partial<NuevoMovimiento> = {}): string[] {
  return validarMovimiento(gasto(cambios), maestra).map(error => error.message)
}

describe('RF-23.2 · un gasto completo entra', () => {
  it('con monto, categoría, medio, cuenta, fecha y descripción no hay errores', () => {
    expect(validarMovimiento(gasto(), maestra)).toEqual([])
  })

  it('toda clave de validación tiene su texto en i18n (la paridad la comprueba el contrato)', () => {
    expect(CLAVES_DE_VALIDACION_DE_MOVIMIENTO.every(clave => clave.startsWith('finance.validation.'))).toBe(true)
  })
})

describe('CA-23.3 · sin categoría de la maestra o con monto ≤ 0 se rechaza', () => {
  it('CA-23.3 · un gasto sin categoría se rechaza', () => {
    expect(mensajes({ categoryId: '' })).toEqual(['finance.validation.category_required'])
  })

  it('CA-23.3 · una categoría que no está en la maestra se rechaza', () => {
    expect(mensajes({ categoryId: 'cat-inventada' })).toEqual(['finance.validation.category_not_in_master'])
  })

  it('CA-23.3 · una categoría retirada de la maestra tampoco sirve', () => {
    expect(mensajes({ categoryId: 'cat-inactiva' })).toEqual(['finance.validation.category_not_in_master'])
  })

  it('CA-23.3 · un monto de cero se rechaza', () => {
    expect(mensajes({ amount: pesos(0) })).toEqual(['finance.validation.amount_not_positive'])
  })

  it('CA-23.3 · un monto negativo se rechaza', () => {
    expect(mensajes({ amount: pesos(-1) })).toEqual(['finance.validation.amount_not_positive'])
  })

  it('CA-23.3 · un monto que no es entero de pesos se rechaza', () => {
    expect(mensajes({ amount: 12.5 as never })).toEqual(['finance.validation.amount_not_positive'])
  })
})

describe('CA-23.6 · las comisiones a Embajadores no pertenecen a la maestra de la propiedad (D-01)', () => {
  it('CA-23.6 · la categoría de comisiones del libro de plataforma se rechaza por categoría no permitida', () => {
    expect(mensajes({ categoryId: 'cat-comisiones' })).toEqual(['finance.validation.category_not_allowed'])
  })

  it('RF-23.5 · una categoría de ingreso no sirve para un gasto', () => {
    expect(mensajes({ categoryId: 'cat-renta' })).toEqual(['finance.validation.category_kind_mismatch'])
  })
})

describe('RF-23.2 · los demás campos obligatorios', () => {
  it('el medio de pago debe ser uno activo de la maestra', () => {
    expect(mensajes({ paymentMethodId: '' })).toEqual(['finance.validation.method_required'])
    expect(mensajes({ paymentMethodId: 'medio-viejo' })).toEqual(['finance.validation.method_required'])
  })

  it('la cuenta contable debe ser una de la maestra', () => {
    expect(mensajes({ accountId: 'cuenta-x' })).toEqual(['finance.validation.account_required'])
  })

  it('RF-23.7 · la fecha de causación es un día de calendario válido', () => {
    expect(mensajes({ incurredOn: '' })).toEqual(['finance.validation.date_invalid'])
    expect(mensajes({ incurredOn: '2026-02-30' })).toEqual(['finance.validation.date_invalid'])
  })

  it('la descripción no puede ir vacía', () => {
    expect(mensajes({ description: '   ' })).toEqual(['finance.validation.description_required'])
  })

  it('cada error señala su campo, para que el formulario lo pinte donde toca', () => {
    const errores = validarMovimiento(gasto({ amount: pesos(0), categoryId: '' }), maestra)

    expect(errores.map(error => error.name)).toEqual(['amount', 'categoryId'])
  })
})

describe('CA-23.4 · un gasto no se elimina: se anula con motivo', () => {
  it('CA-23.4 · sin motivo no hay anulación', () => {
    expect(validarAnulacionDeMovimiento('')).toEqual(['finance.validation.reason_required'])
    expect(validarAnulacionDeMovimiento('   ')).toEqual(['finance.validation.reason_required'])
  })

  it('con motivo, la anulación procede', () => {
    expect(validarAnulacionDeMovimiento('Factura duplicada.')).toEqual([])
  })
})
