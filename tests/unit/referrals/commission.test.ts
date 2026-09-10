import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import {
  activeTypes,
  commissionFor,
  commissionForAmbassador,
  COMMISSION_KINDS,
  defaultType,
  MAX_BASIS_POINTS,
  markDefault,
  typeForAmbassador,
  validateAssignment,
  validateType,
} from '#shared/referrals/commission'
import type { CommissionType, CommissionTypeDraft } from '#shared/referrals/commission'

/**
 * HU-52 · RF-52.1…RF-52.5 · D-05 · D-37 — el catálogo de tipos de comisión y a
 * quién se le aplica cada uno.
 *
 * El Superadmin crea tipos y decide cuál lleva cada Embajador; quien no tenga
 * asignación cobra el predeterminado. El valor de un tipo no se edita: para pagar
 * otra cantidad se crea otro, de modo que lo ya devengado no cambia de importe.
 */

function tipo(cambios: Partial<CommissionType> = {}): CommissionType {
  return {
    id: 'tipo-base',
    name: 'Base',
    kind: 'percentage',
    amount: null,
    basisPoints: 300,
    isDefault: true,
    active: true,
    createdBy: 'super',
    createdAt: '2026-09-10T10:00:00.000Z',
    ...cambios,
  }
}

const BASE = tipo()
const PREMIUM = tipo({ id: 'tipo-premium', name: 'Premium', basisPoints: 500, isDefault: false })
const FIJO = tipo({ id: 'tipo-fijo', name: 'Fijo lanzamiento', kind: 'fixed', amount: pesos(1_500_000), basisPoints: null, isDefault: false })
const RETIRADO = tipo({ id: 'tipo-viejo', name: 'Antiguo', basisPoints: 200, isDefault: false, active: false })

const CATALOGO = [BASE, PREMIUM, FIJO, RETIRADO]

function borrador(cambios: Partial<CommissionTypeDraft> = {}): CommissionTypeDraft {
  return { name: 'Aliados', kind: 'percentage', basisPoints: 400, ...cambios }
}

describe('RF-52.1 · el catálogo de tipos', () => {
  it('los dos tipos de valor son el porcentaje y el importe fijo', () => {
    expect([...COMMISSION_KINDS].sort()).toEqual(['fixed', 'percentage'])
    expect(MAX_BASIS_POINTS).toBe(10_000)
  })

  it('RF-52.2 · solo se ofrecen los activos, en orden alfabético', () => {
    expect(activeTypes(CATALOGO).map(t => t.name)).toEqual(['Base', 'Fijo lanzamiento', 'Premium'])
  })

  it('RF-52.3 · el predeterminado es el único marcado', () => {
    expect(defaultType(CATALOGO)?.id).toBe('tipo-base')
    expect(defaultType([PREMIUM, FIJO])).toBe(null)
  })
})

describe('CA-52.1 · el tipo que le toca a cada Embajador', () => {
  const asignaciones = [{ ambassadorId: 'ana', commissionTypeId: 'tipo-premium' }]

  it('CA-52.1 · con asignación propia manda la suya', () => {
    expect(typeForAmbassador(CATALOGO, asignaciones, 'ana')?.name).toBe('Premium')
  })

  it('CA-52.1 · sin asignación cobra el predeterminado', () => {
    expect(typeForAmbassador(CATALOGO, asignaciones, 'luis')?.name).toBe('Base')
  })

  it('RF-52.2 · una asignación a un tipo desactivado se respeta: desactivar no retira lo asignado', () => {
    const conRetirado = [{ ambassadorId: 'ana', commissionTypeId: 'tipo-viejo' }]
    expect(typeForAmbassador(CATALOGO, conRetirado, 'ana')?.name).toBe('Antiguo')
  })

  it('una asignación a un tipo que ya no existe cae en el predeterminado, no en la nada', () => {
    const rota = [{ ambassadorId: 'ana', commissionTypeId: 'tipo-borrado' }]
    expect(typeForAmbassador(CATALOGO, rota, 'ana')?.name).toBe('Base')
  })

  it('sin predeterminado y sin asignación no hay tipo que aplicar', () => {
    expect(typeForAmbassador([PREMIUM], [], 'luis')).toBe(null)
  })
})

describe('CA-52.2 · D-05 · lo que cobra una comisión', () => {
  it('CA-52.2 · un 10 % sobre un precio pactado de $100.000.000 son $10.000.000', () => {
    const diez = tipo({ basisPoints: 1000 })
    expect(commissionFor(diez, pesos(100_000_000))).toBe(pesos(10_000_000))
  })

  it('CA-52.2 · el importe fijo no depende del precio pactado', () => {
    expect(commissionFor(FIJO, pesos(100_000_000))).toBe(pesos(1_500_000))
    expect(commissionFor(FIJO, pesos(80_000_000))).toBe(pesos(1_500_000))
  })

  it('CA-52.1 · CA-52.2 · dos Embajadores con distinto tipo cobran distinto por el mismo precio', () => {
    const asignaciones = [{ ambassadorId: 'ana', commissionTypeId: 'tipo-premium' }]
    const precio = pesos(100_000_000)
    expect(commissionForAmbassador(CATALOGO, asignaciones, 'ana', precio)).toBe(pesos(5_000_000))
    expect(commissionForAmbassador(CATALOGO, asignaciones, 'luis', precio)).toBe(pesos(3_000_000))
  })

  it('sin tipo aplicable no se inventa una comisión', () => {
    expect(commissionForAmbassador([], [], 'ana', pesos(100_000_000))).toBe(null)
  })
})

describe('CA-52.3 · lo que impide crear un tipo', () => {
  const contexto = { types: CATALOGO }

  it('CA-52.3 · un nombre vacío se rechaza', () => {
    expect(validateType(borrador({ name: '   ' }), contexto))
      .toEqual([{ name: 'name', message: 'referrals.commission.validation.name_required' }])
  })

  it('CA-52.3 · un nombre ya usado se rechaza, sin distinguir mayúsculas ni espacios', () => {
    expect(validateType(borrador({ name: '  premium ' }), contexto))
      .toEqual([{ name: 'name', message: 'referrals.commission.validation.name_duplicated' }])
  })

  it('CA-52.3 · un importe fijo que no es positivo se rechaza', () => {
    expect(validateType({ name: 'Cero', kind: 'fixed', amount: pesos(0) }, contexto))
      .toEqual([{ name: 'amount', message: 'referrals.commission.validation.amount_not_positive' }])
  })

  it('CA-52.3 · un porcentaje fuera de rango se rechaza por ambos extremos', () => {
    expect(validateType(borrador({ basisPoints: 0 }), contexto)[0]?.message)
      .toBe('referrals.commission.validation.basis_points_out_of_range')
    expect(validateType(borrador({ basisPoints: MAX_BASIS_POINTS + 1 }), contexto)[0]?.message)
      .toBe('referrals.commission.validation.basis_points_out_of_range')
  })

  it('CA-52.3 · el valor tiene que corresponder al tipo elegido', () => {
    expect(validateType({ name: 'Mixto', kind: 'percentage', amount: pesos(1000), basisPoints: 300 }, contexto)[0]?.message)
      .toBe('referrals.commission.validation.kind_mismatch')
    expect(validateType({ name: 'Vacío', kind: 'fixed' }, contexto)[0]?.message)
      .toBe('referrals.commission.validation.kind_mismatch')
  })

  it('un borrador correcto no tiene reparos', () => {
    expect(validateType(borrador(), contexto)).toEqual([])
    expect(validateType({ name: 'Bono', kind: 'fixed', amount: pesos(500_000) }, contexto)).toEqual([])
  })
})

describe('CA-52.6 · RF-52.4 · asignar un tipo a un Embajador', () => {
  it('retirar la asignación siempre procede: devuelve al predeterminado', () => {
    expect(validateAssignment(null, { types: CATALOGO })).toEqual([])
  })

  it('CA-52.3 · un tipo desconocido se rechaza', () => {
    expect(validateAssignment('tipo-inexistente', { types: CATALOGO }))
      .toEqual([{ name: 'commissionTypeId', message: 'referrals.commission.validation.type_unknown' }])
  })

  it('RF-52.2 · un tipo desactivado no se asigna a nadie nuevo', () => {
    expect(validateAssignment('tipo-viejo', { types: CATALOGO }))
      .toEqual([{ name: 'commissionTypeId', message: 'referrals.commission.validation.type_inactive' }])
  })

  it('un tipo activo se asigna sin reparos', () => {
    expect(validateAssignment('tipo-premium', { types: CATALOGO })).toEqual([])
  })
})

describe('CA-52.5 · el predeterminado es uno solo', () => {
  it('CA-52.5 · marcar otro retira la marca al anterior', () => {
    const despues = markDefault(CATALOGO, 'tipo-premium')
    expect(despues.filter(t => t.isDefault).map(t => t.id)).toEqual(['tipo-premium'])
    expect(defaultType(despues)?.name).toBe('Premium')
  })

  it('RF-52.2 · CA-52.4 · marcar el predeterminado no toca el valor de ningún tipo', () => {
    const despues = markDefault(CATALOGO, 'tipo-premium')
    expect(despues.map(t => t.basisPoints)).toEqual(CATALOGO.map(t => t.basisPoints))
    expect(despues.map(t => t.amount)).toEqual(CATALOGO.map(t => t.amount))
  })

  it('marcar un tipo que no existe deja el catálogo como estaba', () => {
    expect(markDefault(CATALOGO, 'tipo-borrado')).toEqual(CATALOGO)
  })
})
