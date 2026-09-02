import type { Sesion } from '#shared/permissions/acceso'
import { RUTAS } from '#shared/permissions/acceso'
import type { Rol } from '#shared/permissions/roles'
import type { Database } from '#shared/types/database.types'

/**
 * Sesión de la cuenta actual para decidir acceso y pintar la interfaz.
 *
 * Orquesta, no decide: junta la sesión de Supabase Auth con el perfil (estado de
 * cuenta y verificación) y los roles, y arma el objeto `Sesion` que consume
 * `decidirAcceso`. Toda regla vive en `shared/permissions`.
 *
 * Dos detalles del módulo que condicionan este código:
 *
 * - La sesión se fija de inmediato al autenticarse, pero el usuario llega un tic
 *   después (`getClaims().then(...)`). Por eso «autenticado» mira la sesión: usar solo
 *   el usuario hacía que el middleware rebotara a quien acababa de entrar.
 * - Los claims del JWT no dicen si el correo está verificado. Lo único parecido vive
 *   en `user_metadata`, que el propio usuario puede editar, así que no sirve para
 *   autorizar: la verdad es `profiles.email_verified`, que escribe un disparador.
 */
export function useCuenta() {
  const user = useSupabaseUser()
  const session = useSupabaseSession()
  const client = useSupabaseClient<Database>()

  const idDeCuenta = computed(() => user.value?.sub ?? user.value?.id ?? null)

  const datos = useAsyncData(
    'cuenta',
    async () => {
      const id = idDeCuenta.value
      if (!id) {
        return null
      }

      const [perfil, roles] = await Promise.all([
        client
          .from('profiles')
          .select('id, email, full_name, locale, status, email_verified')
          .eq('id', id)
          .maybeSingle(),
        client
          .from('user_roles')
          .select('role')
          .eq('user_id', id),
      ])

      return {
        perfil: perfil.data,
        roles: (roles.data ?? []).map(fila => fila.role as Rol),
      }
    },
    { watch: [idDeCuenta] },
  )

  const roles = computed<readonly Rol[]>(() => datos.data.value?.roles ?? [])
  const perfil = computed(() => datos.data.value?.perfil ?? null)

  const sesion = computed<Sesion>(() => ({
    autenticado: session.value !== null || user.value !== null,
    verificado: perfil.value?.email_verified ?? false,
    estadoCuenta: perfil.value?.status ?? null,
    roles: roles.value,
  }))

  /**
   * Espera a que el estado de sesión termine de propagarse tras autenticarse.
   * Devuelve `false` si no llega a tiempo, para que quien llama decida qué hacer
   * en vez de navegar a ciegas.
   */
  function esperarSesion(limiteMs = 5000): Promise<boolean> {
    if (idDeCuenta.value) {
      return Promise.resolve(true)
    }

    return new Promise((resolver) => {
      const reloj = setTimeout(() => {
        detener()
        resolver(false)
      }, limiteMs)

      const detener = watch(idDeCuenta, (id) => {
        if (id) {
          clearTimeout(reloj)
          detener()
          resolver(true)
        }
      })
    })
  }

  /**
   * Cierra la sesión y devuelve al inicio. Se recarga el estado antes de navegar
   * para que el middleware no vea todavía la cuenta que se acaba de cerrar.
   */
  async function cerrarSesion(): Promise<void> {
    await client.auth.signOut()
    await datos.refresh()
    await navigateTo(useLocalePath()(RUTAS.inicio))
  }

  return {
    user,
    perfil,
    roles,
    sesion,
    pendiente: datos.pending,
    recargar: datos.refresh,
    esperarSesion,
    cerrarSesion,
    /** Espera a que perfil y roles estén cargados (el middleware lo necesita). */
    esperar: () => datos,
  }
}
