import type { Database } from '#shared/types/database.types'

/**
 * HU-51 · RF-51.1, RF-51.2 · D-03 — la atribución del referido al registrarse.
 *
 * El clic ya quedó guardado en el servidor contra el identificador anónimo del
 * navegador (`useCodigoDeReferido`), así que la ventana de 90 días no depende de
 * una fecha que el cliente pueda inventar. Aquí solo se le pide a la base que
 * resuelva a quién corresponde el prospecto que acaba de entrar.
 *
 * Nunca lanza ni bloquea: un código inválido, inhabilitado o caducado devuelve
 * `null`, y un fallo de red también, porque el flujo del prospecto sigue igual
 * (RF-51.6). Sin código ni visitante no hay nada que resolver y no se consulta.
 */
export function useAtribucion() {
  const client = useSupabaseClient<Database>()
  const { visitante, codigo } = useCodigoDeReferido()

  async function aplicar(): Promise<string | null> {
    if (!visitante.value && !codigo.value) {
      return null
    }
    try {
      const { data } = await client.rpc('attribute_referral', {
        visitor: visitante.value ?? undefined,
        referral_code: codigo.value ?? undefined,
      })
      return data ?? null
    }
    catch {
      return null
    }
  }

  return { aplicar }
}
