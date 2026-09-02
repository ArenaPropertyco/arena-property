import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import Ingresar from '~/pages/ingresar.vue'
import Registro from '~/pages/registro/index.vue'
import Continuar from '~/pages/auth/continuar.vue'

/**
 * HU-61 · nivel N3: el viaje a Google y el retorno.
 *
 * CA-61.1, CA-61.2 y CA-61.7 (crear cuenta, vincular una existente, cancelar el
 * permiso) solo se verifican de verdad contra credenciales de Google en vivo —
 * ningún mock reproduce el intercambio real con el proveedor. Lo que sí se prueba
 * aquí es el mecanismo del que depende esa verificación: qué se le pide a
 * `signInWithOAuth`, qué código viaja en la cookie, y qué hace el retorno con lo
 * que encuentra.
 */

const consulta = ref<Record<string, string>>({})
const usuario = ref<{ sub: string, email: string } | null>(null)
const sesion = ref<{ access_token: string } | null>(null)
const cookieReferido = ref<string | null>(null)
const perfil = { id: 'u1', email: 'visitante@ejemplo.com', full_name: null, status: 'active', email_verified: true }

const signInWithOAuth = vi.fn()
const rpc = vi.fn()
const navegaciones: string[] = []

mockNuxtImport('useSupabaseUser', () => () => usuario)
mockNuxtImport('useSupabaseSession', () => () => sesion)
mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)
mockNuxtImport('useRoute', () => () => ({ query: consulta.value, path: '/ingresar' }))
mockNuxtImport('useCookie', () => (nombre: string) => (nombre === 'arena_ref' ? cookieReferido : ref(null)))
mockNuxtImport('navigateTo', () => (ruta: string) => {
  navegaciones.push(ruta)
  return undefined
})
mockNuxtImport('useSupabaseClient', () => () => ({
  auth: { signInWithOAuth },
  rpc,
  from: (tabla: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: tabla === 'profiles' ? perfil : null }),
        then: (resolver: (r: unknown) => void) => resolver({ data: [{ role: 'user' }] }),
      }),
    }),
  }),
}))

function reiniciar() {
  consulta.value = {}
  usuario.value = null
  sesion.value = null
  cookieReferido.value = null
  navegaciones.length = 0
  signInWithOAuth.mockReset().mockResolvedValue({ error: null })
  rpc.mockReset().mockResolvedValue({ error: null })
}

describe('RF-61.1 · el botón de Google inicia el viaje al proveedor', () => {
  it('desde /ingresar pide el proveedor Google y una redirección sin prefijo de idioma', async () => {
    reiniciar()
    const pagina = await mountSuspended(Ingresar)

    await pagina.find('[data-test="boton-google"]').trigger('click')
    await flushPromises()

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.stringContaining('/auth/continuar') },
    })
  })

  it('RF-61.5 · desde /registro, el código de referido vigente viaja en la cookie antes de salir', async () => {
    reiniciar()
    consulta.value = { ref: 'arena-7k2q' }
    const pagina = await mountSuspended(Registro)

    await pagina.find('[data-test="boton-google"]').trigger('click')
    await flushPromises()

    expect(cookieReferido.value).toBe('ARENA-7K2Q')
    expect(signInWithOAuth).toHaveBeenCalledTimes(1)
  })

  it('si el proveedor rechaza la solicitud, el error se traduce y no expone el original', async () => {
    reiniciar()
    signInWithOAuth.mockResolvedValueOnce({ error: { code: 'unexpected_failure', message: 'raw provider failure' } })
    const pagina = await mountSuspended(Ingresar)

    await pagina.find('[data-test="boton-google"]').trigger('click')
    await flushPromises()

    const aviso = pagina.find('[data-test="error-auth"]')
    expect(aviso.exists()).toBe(true)
    expect(aviso.text()).not.toContain('raw provider failure')
  })
})

describe('CA-61.7 · el retorno con un error del proveedor', () => {
  it('el Visitante que cancela el permiso ve un mensaje traducido y no navega', async () => {
    reiniciar()
    consulta.value = { error: 'access_denied' }

    const pagina = await mountSuspended(Continuar)
    await flushPromises()

    expect(pagina.find('[data-test="error-auth"]').text()).not.toBe('')
    expect(navegaciones).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('RF-61.4, RF-61.5 · el retorno con sesión ya establecida', () => {
  it('aplica la atribución pendiente una sola vez, la limpia de la cookie y sigue al panel', async () => {
    reiniciar()
    cookieReferido.value = 'ARENA-7K2Q'
    sesion.value = { access_token: 't' }
    usuario.value = { sub: 'u1', email: 'visitante@ejemplo.com' }

    await mountSuspended(Continuar)
    await flushPromises()

    expect(rpc).toHaveBeenCalledWith('aplicar_atribucion_referido', { codigo: 'ARENA-7K2Q' })
    expect(cookieReferido.value).toBeNull()
    expect(navegaciones).toEqual(['/panel'])
  })

  it('sin código pendiente, no llama a la atribución y sigue igual al panel', async () => {
    reiniciar()
    sesion.value = { access_token: 't' }
    usuario.value = { sub: 'u1', email: 'visitante@ejemplo.com' }

    await mountSuspended(Continuar)
    await flushPromises()

    expect(rpc).not.toHaveBeenCalled()
    expect(navegaciones).toEqual(['/panel'])
  })
})
