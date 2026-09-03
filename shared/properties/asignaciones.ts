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
