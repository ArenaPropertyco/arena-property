/**
 * HU-07 · RF-07.1 — los roles del sistema.
 *
 * Cinco roles con cuenta; el Visitante es la ausencia de sesión y no se guarda.
 * Los identificadores son los mismos del tipo `app_role` de la base (principio 6:
 * el código en inglés); los nombres visibles salen de i18n.
 */

export const ROLES = ['superadmin', 'property_admin', 'owner', 'ambassador', 'user'] as const

export type Rol = typeof ROLES[number]

/** Roles con los que Embajador puede convivir en la misma cuenta. */
export const ACUMULABLES_CON_EMBAJADOR: readonly Rol[] = ['user', 'owner']

/** Roles operativos: no se combinan con Embajador (matriz VSM §2). */
const INCOMPATIBLES_CON_EMBAJADOR: readonly Rol[] = ['superadmin', 'property_admin']

/**
 * ¿Puede una cuenta tener este conjunto de roles a la vez?
 * Embajador se acumula con Usuario o Propietario, nunca con Superadmin ni Administrador.
 * La misma regla vive como disparador en la base (`private.validar_roles`).
 */
export function esCombinacionValida(roles: readonly Rol[]): boolean {
  const conjunto = new Set(roles)

  if (!conjunto.has('ambassador')) {
    return true
  }

  return !INCOMPATIBLES_CON_EMBAJADOR.some(rol => conjunto.has(rol))
}
