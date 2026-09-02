import { claveDeErrorDeAuth } from '#shared/identity/errores'
import { RUTAS } from '#shared/permissions/acceso'
import type { Database } from '#shared/types/database.types'

/**
 * HU-61 · RF-61.1, RF-61.5 — inicia el viaje a Google desde `/ingresar` o `/registro`.
 *
 * La redirección siempre apunta a la ruta sin prefijo de idioma (RUTAS.continuarOAuth):
 * así solo hace falta una entrada en la lista de redirecciones permitidas de Supabase
 * Auth por entorno, no una por idioma. El código de referido viaja en la cookie que ya
 * usa HU-51 (`arena_ref`): el navegador la conserva sola durante el viaje, así que
 * basta con dejarla escrita antes de salir.
 */
export function useAutenticacionGoogle() {
  const client = useSupabaseClient<Database>()
  const codigoDeSesion = useCookie<string | null>('arena_ref')

  async function continuarConGoogle(codigoReferido?: string | null): Promise<{ error: string | null }> {
    if (codigoReferido) {
      codigoDeSesion.value = codigoReferido
    }

    const origen = window.location.origin
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origen}${RUTAS.continuarOAuth}` },
    })

    return { error: error ? claveDeErrorDeAuth(error) : null }
  }

  return { continuarConGoogle }
}
