import type { CambioDeContrasena, DatosDePerfil } from '#shared/identity/edicion-de-perfil'
import { errorDePerfilDesdeBase, normalizarPerfil } from '#shared/identity/edicion-de-perfil'
import type { Database } from '#shared/types/database.types'

/**
 * Perfil de la propia cuenta: sus datos, si tiene contraseña y cómo cambiarlos.
 *
 * Nombre, teléfono e idioma se escriben directo bajo RLS (la cuenta solo alcanza
 * su fila, y la base rechaza tocar el correo, la identidad o la suspensión). La
 * contraseña va por el servidor, que verifica la actual antes de fijar la nueva;
 * una cuenta creada con Google no tiene y la crea.
 */

export interface PerfilPropio {
  email: string | null
  fullName: string | null
  phone: string | null
  locale: string
  avatarUrl: string | null
}

type Resultado = { ok: true } | { ok: false, clave: string }

export function usePerfil() {
  const client = useSupabaseClient<Database>()
  const { idDeCuenta, recargar: recargarCuenta } = useCuenta()

  const consulta = useAsyncData<{ perfil: PerfilPropio | null, tieneContrasena: boolean }>(
    () => `perfil-propio-${idDeCuenta.value}`,
    async () => {
      const id = idDeCuenta.value
      if (!id) {
        return { perfil: null, tieneContrasena: false }
      }
      const [perfil, contrasena] = await Promise.all([
        client.from('profiles').select('email, full_name, phone, locale, avatar_url').eq('id', id).maybeSingle(),
        client.rpc('tengo_contrasena'),
      ])
      return {
        perfil: perfil.data
          ? { email: perfil.data.email, fullName: perfil.data.full_name, phone: perfil.data.phone, locale: perfil.data.locale, avatarUrl: perfil.data.avatar_url }
          : null,
        tieneContrasena: contrasena.data === true,
      }
    },
    { watch: [idDeCuenta] },
  )

  async function guardar(datos: DatosDePerfil): Promise<Resultado> {
    const id = idDeCuenta.value
    if (!id) {
      return { ok: false, clave: 'profile.errors.save_failed' }
    }
    const perfil = normalizarPerfil(datos)
    const { error } = await client
      .from('profiles')
      .update({ full_name: perfil.fullName, phone: perfil.phone, locale: perfil.locale })
      .eq('id', id)
    if (error) {
      return { ok: false, clave: errorDePerfilDesdeBase(error.message) }
    }
    // El nombre también se ve en el menú de cuenta: se recarga la sesión del panel.
    await Promise.all([consulta.refresh(), recargarCuenta()])
    return { ok: true }
  }

  async function cambiarContrasena(datos: CambioDeContrasena): Promise<Resultado> {
    try {
      await $fetch('/api/perfil/contrasena', { method: 'POST', body: datos })
    }
    catch (error) {
      const clave = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
        ?? (error as { statusMessage?: string })?.statusMessage
      return { ok: false, clave: clave && clave.includes('.') ? clave : 'profile.password.errors.failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    perfil: computed(() => consulta.data.value?.perfil ?? null),
    tieneContrasena: computed(() => consulta.data.value?.tieneContrasena ?? false),
    pendiente: consulta.pending,
    guardar,
    cambiarContrasena,
  }
}
