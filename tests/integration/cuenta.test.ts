import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent } from 'vue'
import Ingresar from '~/pages/ingresar.vue'

/**
 * Regresión de HU-04 · RF-04.2: al iniciar sesión, la aplicación rebotaba de vuelta
 * a `/ingresar`.
 *
 * Dos causas, ambas cubiertas aquí:
 *
 * 1. `@nuxtjs/supabase` fija el usuario dentro de un `getClaims().then(...)`, es decir
 *    un tic después de que `signInWithPassword` resuelve. La página navegaba antes y
 *    el middleware veía una sesión vacía.
 * 2. La verificación del correo se leía de los claims del JWT, donde no existe
 *    `email_confirmed_at`. Lo único parecido es `user_metadata.email_verified`, que el
 *    propio usuario puede editar y por eso no sirve para autorizar: la verdad está en
 *    `profiles.email_verified`.
 */

const usuario = ref<{ sub: string, email: string } | null>(null)
const sesion = ref<{ access_token: string } | null>(null)
const perfil = { id: 'u1', email: 'super@arena.local', full_name: null, status: 'active', email_verified: true }

const signInWithPassword = vi.fn()
const navegaciones: string[] = []

mockNuxtImport('useSupabaseUser', () => () => usuario)
mockNuxtImport('useSupabaseSession', () => () => sesion)
mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)
mockNuxtImport('useRoute', () => () => ({ query: {}, path: '/ingresar' }))
mockNuxtImport('useCookie', () => () => ref(null))
mockNuxtImport('navigateTo', () => (ruta: string) => {
  navegaciones.push(ruta)
  return undefined
})
mockNuxtImport('useSupabaseClient', () => () => ({
  auth: { signInWithPassword },
  from: (tabla: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: tabla === 'profiles' ? perfil : null }),
        then: (resolver: (r: unknown) => void) => resolver({ data: [{ role: 'superadmin' }] }),
      }),
    }),
  }),
}))

function reiniciar() {
  usuario.value = null
  sesion.value = null
  navegaciones.length = 0
  signInWithPassword.mockReset()
}

describe('RF-04.2 · el ingreso espera a que la sesión se propague', () => {
  it('no navega al panel mientras el usuario todavía no está disponible', async () => {
    reiniciar()
    // El proveedor acepta las credenciales pero el usuario aún no llegó al estado.
    signInWithPassword.mockResolvedValueOnce({ data: { session: { access_token: 't' } }, error: null })

    const pagina = await mountSuspended(Ingresar)
    await pagina.find('input[type="email"]').setValue('super@arena.local')
    await pagina.find('input[type="password"]').setValue('Arena2026!')
    await pagina.find('form').trigger('submit')
    await flushPromises()

    expect(navegaciones, 'navegó antes de tener sesión y el middleware la habría rebotado').toEqual([])

    // La espera sigue viva a propósito. Se resuelve aquí para que su observador no
    // quede pendiente y se dispare durante la siguiente prueba.
    sesion.value = { access_token: 't' }
    usuario.value = { sub: 'u1', email: 'super@arena.local' }
    await flushPromises()
    pagina.unmount()
  })

  it('navega al panel en cuanto el usuario aparece', async () => {
    reiniciar()
    signInWithPassword.mockImplementationOnce(async () => {
      // Igual que el módulo real: el usuario se fija un tic después.
      setTimeout(() => {
        sesion.value = { access_token: 't' }
        usuario.value = { sub: 'u1', email: 'super@arena.local' }
      }, 0)
      return { data: { session: { access_token: 't' } }, error: null }
    })

    const pagina = await mountSuspended(Ingresar)
    await pagina.find('input[type="email"]').setValue('super@arena.local')
    await pagina.find('input[type="password"]').setValue('Arena2026!')
    await pagina.find('form').trigger('submit')
    await new Promise(listo => setTimeout(listo, 20))
    await flushPromises()

    expect(navegaciones).toEqual(['/panel'])
  })
})

describe('RF-04.2 · la verificación no se lee del JWT', () => {
  it('`verificado` sale del perfil, no de los claims del token', async () => {
    reiniciar()
    sesion.value = { access_token: 't' }
    // Los claims reales no traen `email_confirmed_at`: si se leyera de ahí, sería falso.
    usuario.value = { sub: 'u1', email: 'super@arena.local' }

    let capturada: { autenticado: boolean, verificado: boolean, roles: readonly string[] } | null = null
    const Sonda = defineComponent({
      setup() {
        const { sesion: estado, esperar } = useCuenta()
        return { estado, esperar }
      },
      async created() {
        await this.esperar()
        capturada = { ...this.estado }
      },
      template: '<div />',
    })

    await mountSuspended(Sonda)
    await flushPromises()

    expect(capturada).toMatchObject({ autenticado: true, verificado: true })
    expect(capturada?.roles).toContain('superadmin')
  })
})
