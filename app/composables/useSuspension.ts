import type { TipoDeSuspension } from '#shared/identity/suspension'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-33 · RF-33.1…RF-33.6 · D-07 — suspender y reactivar cuentas.
 *
 * Orquesta, no decide: las dos acciones son funciones de la base que exigen ser
 * Superadmin, motivo y tipo, y que aplican el efecto sobre el saldo (HU-54) y el
 * código de referido (HU-51). El rechazo se traduce por la regla que cita.
 */
export function useSuspension() {
  const client = useSupabaseClient<Database>()

  async function suspender(cuentaId: string, kind: TipoDeSuspension, reason: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('suspend_account', { account: cuentaId, kind, reason })
    if (error) {
      return { ok: false, clave: claveDeError(error.message) }
    }
    await refreshNuxtData('cuentas-con-roles')
    return { ok: true }
  }

  async function reactivar(cuentaId: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('reactivate_account', { account: cuentaId })
    if (error) {
      return { ok: false, clave: error.message.includes('RF-33.6') ? 'account.suspension.errors.not_allowed' : 'account.suspension.errors.reactivate_failed' }
    }
    await refreshNuxtData('cuentas-con-roles')
    return { ok: true }
  }

  return { suspender, reactivar }
}

/** El rechazo de la base, reconocido por la regla que cita. */
function claveDeError(mensaje: string): string {
  if (mensaje.includes('CA-33.1')) {
    return 'account.suspension.validation.reason_required'
  }
  if (mensaje.includes('RF-33.3')) {
    return 'account.suspension.validation.kind_required'
  }
  if (mensaje.includes('ya está suspendida')) {
    return 'account.suspension.errors.already_suspended'
  }
  if (mensaje.includes('RF-33.6')) {
    return 'account.suspension.errors.not_allowed'
  }
  return 'account.suspension.errors.failed'
}
