/**
 * HU-05 · RF-05.1 y RF-05.2 — qué administradores gestionan una propiedad.
 *
 * El Superadmin edita la lista completa desde la ficha de la propiedad, y de ahí
 * sale el **cambio mínimo** que hay que aplicar: a quién otorgar y a quién retirar.
 *
 * Que sea mínimo no es una optimización, es una cuestión de honestidad. La
 * asignación se retira marcándola, nunca borrándola (RF-05.2), así que retirar y
 * volver a otorgar una que no cambió dejaría en el histórico un retiro que jamás
 * ocurrió. Guardar la ficha sin tocar los administradores no puede mover nada.
 *
 * La frontera de seguridad sigue siendo la RLS: `property_admins` solo acepta
 * escrituras del Superadmin y no concede DELETE a nadie. Esto valida antes de viajar
 * y da el mensaje; no sustituye a la política.
 */

import type { EstadoCuenta } from '../permissions/acceso'
import type { Rol } from '../permissions/roles'
import { esCombinacionValida } from '../permissions/roles'

export const CLAVES_DE_VALIDACION_DE_ASIGNACION = [
  'properties.validation.assign_requires_superadmin',
  'properties.validation.assign_not_an_admin',
] as const

export type ClaveDeValidacionDeAsignacion = typeof CLAVES_DE_VALIDACION_DE_ASIGNACION[number]

export type CampoDeAsignacion = 'actor' | 'administradores'

export interface ErrorDeAsignacion {
  name: CampoDeAsignacion
  message: ClaveDeValidacionDeAsignacion
}

/** Lo que hay que escribir para pasar de las asignaciones vigentes a las deseadas. */
export interface CambioDeAsignaciones {
  /** Cuentas a las que se les otorga la propiedad (fila nueva). */
  otorgar: string[]
  /** Cuentas a las que se les retira (se marca la fila vigente, no se borra). */
  retirar: string[]
}

/** Identificadores limpios, sin repeticiones ni huecos, en el orden en que llegan. */
function normalizar(cuentas: readonly string[]): string[] {
  return [...new Set(cuentas.map(cuenta => (cuenta ?? '').trim()).filter(Boolean))]
}

export function cambiosDeAsignacion(
  actuales: readonly string[],
  deseados: readonly string[],
): CambioDeAsignaciones {
  const vigentes = new Set(normalizar(actuales))
  const objetivo = normalizar(deseados)
  const objetivoSet = new Set(objetivo)

  return {
    otorgar: objetivo.filter(cuenta => !vigentes.has(cuenta)),
    retirar: [...vigentes].filter(cuenta => !objetivoSet.has(cuenta)),
  }
}

/** ¿El cambio tiene algo que escribir? Sirve para no viajar a la base por nada. */
export function hayCambios(cambio: CambioDeAsignaciones): boolean {
  return cambio.otorgar.length > 0 || cambio.retirar.length > 0
}

/**
 * CA-05.1 · solo el Superadmin asigna, y solo a cuentas con rol Administrador.
 * `candidatos` son las cuentas que hoy tienen ese rol; la base lo vuelve a comprobar
 * en el disparador `property_admins_validar`.
 */
export function validarAsignacion(
  deseados: readonly string[],
  candidatos: readonly string[],
  actor: { esSuperadmin: boolean },
): ErrorDeAsignacion[] {
  const errores: ErrorDeAsignacion[] = []

  if (!actor.esSuperadmin) {
    errores.push({ name: 'actor', message: 'properties.validation.assign_requires_superadmin' })
  }

  const conocidos = new Set(candidatos)
  if (normalizar(deseados).some(cuenta => !conocidos.has(cuenta))) {
    errores.push({ name: 'administradores', message: 'properties.validation.assign_not_an_admin' })
  }

  return errores
}

// ── RF-05.1 · alta de Administrador desde una cuenta existente ──────────────

/** Lo mínimo de una cuenta para decidir si puede recibir el rol Administrador. */
export interface CuentaPromovible {
  id: string
  email: string | null
  fullName: string | null
  status: EstadoCuenta
  roles: readonly Rol[]
}

/**
 * Cuentas a las que el Superadmin puede dar el rol Administrador: activas, que no
 * lo tengan ya y cuya combinación de roles lo admita (RF-07.1: Embajador no se
 * acumula con Administrador). La misma regla que el disparador de la base.
 */
export function cuentasPromovibles<T extends CuentaPromovible>(cuentas: readonly T[]): T[] {
  return cuentas.filter(cuenta =>
    cuenta.status === 'active'
    && !cuenta.roles.includes('property_admin')
    && esCombinacionValida([...cuenta.roles, 'property_admin']))
}

function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase().trim()
}

/** Filtra cuentas por nombre o correo, sin distinguir mayúsculas ni acentos. */
export function filtrarCuentas<T extends Pick<CuentaPromovible, 'email' | 'fullName'>>(
  cuentas: readonly T[],
  texto: string,
): T[] {
  const criterio = normalizarTexto(texto)
  if (criterio === '') {
    return [...cuentas]
  }

  return cuentas.filter(cuenta =>
    normalizarTexto(cuenta.fullName ?? '').includes(criterio)
    || normalizarTexto(cuenta.email ?? '').includes(criterio))
}

// ── RF-05.3 · sobre qué propiedades manda quien está mirando ────────────────

/** Quien consulta: su identificador de cuenta y si manda sobre todo. */
export interface ActorDeGestion {
  id: string | null
  esSuperadmin: boolean
}

/**
 * CA-05.2 · las propiedades que el actor gestiona de verdad.
 *
 * El Superadmin las obtiene todas sin excepción, incluidas las que no tienen
 * administrador asignado; el Administrador, exactamente las suyas.
 *
 * Hace falta porque «poder leer» y «poder gestionar» no son lo mismo: una
 * propiedad publicada la lee cualquiera —está en el catálogo público—, así que
 * una pantalla que se guíe por lo que la consulta devuelve le ofrecería a un
 * Administrador calendarios ajenos que la base le va a rechazar al guardar.
 */
export function propiedadesGestionadas<T extends { adminIds: readonly string[] }>(
  propiedades: readonly T[],
  actor: ActorDeGestion,
): T[] {
  if (actor.esSuperadmin) {
    return [...propiedades]
  }

  const cuenta = actor.id
  if (!cuenta) {
    return []
  }

  return propiedades.filter(propiedad => propiedad.adminIds.includes(cuenta))
}
