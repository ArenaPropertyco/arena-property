/**
 * HU-52 · RF-52.1…RF-52.5 · D-05 · D-37 · TR-02 RF-D.4 — el catálogo de tipos de
 * comisión y a quién se le aplica cada uno.
 *
 * El Superadmin crea **tipos** (nombre y valor) y decide cuál lleva cada
 * Embajador; quien no tenga asignación propia cobra el **predeterminado**, que es
 * también el que publica la página del programa (HU-48).
 *
 * El valor de un tipo no se edita (RF-52.2): para pagar otra cantidad se crea
 * otro tipo. Así una comisión ya devengada no cambia de importe porque alguien
 * tocara la cifra después, que es lo que las vigencias por fecha resolvían a
 * costa de imponerle el mismo monto a todo el mundo (D-37).
 *
 * El porcentaje viaja en puntos básicos enteros y el cálculo va siempre sobre el
 * **precio pactado** del plan de pagos, nunca sobre el precio de lista de hoy
 * (D-05). Todo es puro: la base repite las mismas reglas al persistir.
 */

import type { CopAmount } from '../money/importe'
import { comision } from '../money/comision'

/** Un día de calendario, `AAAA-MM-DD`. */
export type Day = string

/** RF-52.1 · un tipo paga un importe fijo en pesos o un porcentaje del precio pactado. */
export type CommissionKind = 'fixed' | 'percentage'

export const COMMISSION_KINDS: readonly CommissionKind[] = ['percentage', 'fixed']

/** RF-D.4 · el 100 % en puntos básicos: el tope de un porcentaje de comisión. */
export const MAX_BASIS_POINTS = 10_000

/** RF-52.1 · el nombre es lo que el Superadmin lee en la lista; no puede ser un vacío. */
export const MAX_TYPE_NAME_LENGTH = 60

export interface CommissionType {
  id: string
  name: string
  kind: CommissionKind
  /** Importe fijo en pesos; `null` cuando el tipo es porcentual. */
  amount: CopAmount | null
  /** Puntos básicos; `null` cuando el tipo es de importe fijo. */
  basisPoints: number | null
  /** RF-52.3 · rige para quien no tenga asignación propia. Solo uno lo está. */
  isDefault: boolean
  /** RF-52.2 · un tipo inactivo no se ofrece para asignaciones nuevas. */
  active: boolean
  createdBy: string | null
  createdAt: string
}

/** Lo que el Superadmin propone al crear un tipo. */
export interface CommissionTypeDraft {
  name: string
  kind: CommissionKind
  amount?: CopAmount | null
  basisPoints?: number | null
  /** RF-52.3 · si nace como predeterminado, desplazando al anterior. */
  makeDefault?: boolean
}

/** RF-52.4 · qué tipo lleva un Embajador. Sin fila, lleva el predeterminado. */
export interface CommissionAssignment {
  ambassadorId: string
  commissionTypeId: string
}

export const COMMISSION_VALIDATION_KEYS = [
  'referrals.commission.validation.name_required',
  'referrals.commission.validation.name_duplicated',
  'referrals.commission.validation.kind_mismatch',
  'referrals.commission.validation.amount_not_positive',
  'referrals.commission.validation.basis_points_out_of_range',
  'referrals.commission.validation.type_unknown',
  'referrals.commission.validation.type_inactive',
] as const

export type CommissionValidationKey = typeof COMMISSION_VALIDATION_KEYS[number]

export type CommissionTypeField = 'name' | 'amount' | 'basisPoints' | 'commissionTypeId'

export interface CommissionTypeError {
  name: CommissionTypeField
  message: CommissionValidationKey
}

export interface CommissionCatalog {
  types: readonly CommissionType[]
}

/** Nombres comparables: sin espacios de sobra ni diferencias de caja. */
function clave(nombre: string): string {
  return nombre.trim().toLocaleLowerCase('es')
}

/** RF-52.2 · los tipos que hoy se pueden asignar, en el orden en que se leen. */
export function activeTypes(types: readonly CommissionType[]): CommissionType[] {
  return types.filter(type => type.active).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** RF-52.3 · el predeterminado, que rige para quien no tenga asignación propia. */
export function defaultType(types: readonly CommissionType[]): CommissionType | null {
  return types.find(type => type.isDefault) ?? null
}

/**
 * CA-52.1 · RF-52.5 · el tipo que le toca a un Embajador: el suyo si lo tiene, y
 * si no el predeterminado.
 *
 * Una asignación a un tipo que ya no está en el catálogo cae también en el
 * predeterminado: el Embajador sigue cobrando algo conocido en vez de quedarse
 * sin comisión por una fila huérfana. Un tipo **inactivo** sí se respeta: dejar
 * de ofrecerlo no es retirárselo a quien ya lo tenía (RF-52.2).
 */
export function typeForAmbassador(
  types: readonly CommissionType[],
  assignments: readonly CommissionAssignment[],
  ambassadorId: string,
): CommissionType | null {
  const asignado = assignments.find(assignment => assignment.ambassadorId === ambassadorId)
  const propio = asignado ? types.find(type => type.id === asignado.commissionTypeId) : undefined

  return propio ?? defaultType(types)
}

/**
 * RF-52.1 · CA-52.2 · D-05 · lo que paga este tipo por una compra. El porcentaje
 * se aplica al **precio pactado** que recibe, y por eso un cambio posterior del
 * precio de lista no puede moverlo.
 */
export function commissionFor(type: CommissionType, agreedPrice: CopAmount): CopAmount {
  return type.kind === 'fixed'
    ? (type.amount ?? (0 as CopAmount))
    : comision(agreedPrice, type.basisPoints ?? 0)
}

/**
 * CA-52.1 · CA-52.2 · lo que cobra un Embajador por una compra, con el tipo que
 * le corresponde. `null` cuando no hay tipo aplicable: sin catálogo no se inventa
 * una comisión (principio 9).
 */
export function commissionForAmbassador(
  types: readonly CommissionType[],
  assignments: readonly CommissionAssignment[],
  ambassadorId: string,
  agreedPrice: CopAmount,
): CopAmount | null {
  const type = typeForAmbassador(types, assignments, ambassadorId)
  return type ? commissionFor(type, agreedPrice) : null
}

/** CA-52.3 · lo que impide crear el tipo; vacío si procede. */
export function validateType(draft: CommissionTypeDraft, catalog: CommissionCatalog): CommissionTypeError[] {
  const errors: CommissionTypeError[] = []
  const nombre = draft.name.trim()
  const amount = draft.amount ?? null
  const basisPoints = draft.basisPoints ?? null

  if (nombre === '' || nombre.length > MAX_TYPE_NAME_LENGTH) {
    errors.push({ name: 'name', message: 'referrals.commission.validation.name_required' })
  }
  else if (catalog.types.some(type => clave(type.name) === clave(nombre))) {
    errors.push({ name: 'name', message: 'referrals.commission.validation.name_duplicated' })
  }

  if (draft.kind === 'fixed') {
    if (amount === null || basisPoints !== null) {
      errors.push({ name: 'amount', message: 'referrals.commission.validation.kind_mismatch' })
    }
    else if (amount <= 0) {
      errors.push({ name: 'amount', message: 'referrals.commission.validation.amount_not_positive' })
    }
  }
  else {
    if (basisPoints === null || amount !== null) {
      errors.push({ name: 'basisPoints', message: 'referrals.commission.validation.kind_mismatch' })
    }
    else if (!Number.isInteger(basisPoints) || basisPoints < 1 || basisPoints > MAX_BASIS_POINTS) {
      errors.push({ name: 'basisPoints', message: 'referrals.commission.validation.basis_points_out_of_range' })
    }
  }

  return errors
}

/**
 * RF-52.4 · lo que impide asignarle un tipo a un Embajador. `null` es retirar la
 * asignación y devolverlo al predeterminado: eso siempre procede.
 */
export function validateAssignment(
  commissionTypeId: string | null,
  catalog: CommissionCatalog,
): CommissionTypeError[] {
  if (commissionTypeId === null) {
    return []
  }

  const type = catalog.types.find(candidato => candidato.id === commissionTypeId)
  if (!type) {
    return [{ name: 'commissionTypeId', message: 'referrals.commission.validation.type_unknown' }]
  }
  if (!type.active) {
    return [{ name: 'commissionTypeId', message: 'referrals.commission.validation.type_inactive' }]
  }

  return []
}

/**
 * CA-52.5 · el catálogo tras marcar otro predeterminado: la marca se mueve y
 * nada más cambia. Devuelve un arreglo nuevo; si el tipo no está, no toca nada.
 */
export function markDefault(types: readonly CommissionType[], typeId: string): CommissionType[] {
  if (!types.some(type => type.id === typeId)) {
    return [...types]
  }

  return types.map(type => (type.isDefault === (type.id === typeId)
    ? type
    : { ...type, isDefault: type.id === typeId }))
}
