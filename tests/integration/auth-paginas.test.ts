import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import Registro from '~/pages/registro/index.vue'
import Ingresar from '~/pages/ingresar.vue'

/**
 * HU-04 · nivel N3: las páginas de registro e ingreso muestran los errores del
 * esquema traducidos (CA-04.1 en pantalla) y prellenan el código de referido
 * (RF-04.4). Supabase y el enrutado por idioma se sustituyen; las traducciones son
 * las reales.
 */

const signUp = vi.fn()
const signInWithPassword = vi.fn()
const consulta = ref<Record<string, string>>({})

mockNuxtImport('useSupabaseClient', () => () => ({ auth: { signUp, signInWithPassword } }))
mockNuxtImport('useSupabaseUser', () => () => ref(null))
mockNuxtImport('useSupabaseSession', () => () => ref(null))
mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)
mockNuxtImport('useRoute', () => () => ({ query: consulta.value, path: '/registro' }))
mockNuxtImport('useCookie', () => () => ref(null))
mockNuxtImport('navigateTo', () => vi.fn())

describe('CA-04.1 · registro con datos inválidos', () => {
  it('muestra los errores por campo, traducidos, y no llama al proveedor', async () => {
    const pagina = await mountSuspended(Registro)

    await pagina.find('[data-test="campo-email"] input, input[type="email"]').setValue('ana@')
    await pagina.find('[data-test="campo-password"] input, input[autocomplete="new-password"]').setValue('corta')
    await pagina.find('form').trigger('submit')
    await flushPromises()

    const texto = pagina.text()
    expect(texto).toContain('Escribe un correo válido.')
    expect(texto).toContain('La contraseña debe tener al menos 8 caracteres.')
    expect(signUp).not.toHaveBeenCalled()
  })
})

describe('RF-04.4 · código de referido', () => {
  it('se prellena desde el enlace de atribución y avisa que se registrará', async () => {
    consulta.value = { ref: 'arena-7k2q' }
    const pagina = await mountSuspended(Registro)

    const campo = pagina.find('[data-test="campo-referido"] input, input[autocomplete="off"]')
    expect((campo.element as HTMLInputElement).value).toBe('ARENA-7K2Q')
    expect(pagina.find('[data-test="aviso-referido"]').text()).toContain('ARENA-7K2Q')
    consulta.value = {}
  })
})

describe('CA-04.3 · la atribución viaja al proveedor según el código', () => {
  async function registrar(pagina: Awaited<ReturnType<typeof mountSuspended>>, codigo: string) {
    await pagina.find('[data-test="campo-email"] input, input[type="email"]').setValue('ana@ejemplo.com')
    const contrasenas = pagina.findAll('input[autocomplete="new-password"]')
    await contrasenas[0]!.setValue('Arena2026')
    await contrasenas[1]!.setValue('Arena2026')
    await pagina.find('[data-test="campo-referido"] input, input[autocomplete="off"]').setValue(codigo)
    await pagina.find('form').trigger('submit')
    await flushPromises()
  }

  it('CA-04.3 · con código válido, el registro lleva el código normalizado para que la base lo persista', async () => {
    signUp.mockResolvedValueOnce({ data: {}, error: null })
    const pagina = await mountSuspended(Registro)

    await registrar(pagina, 'arena-7k2q')

    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'ana@ejemplo.com',
      options: expect.objectContaining({ data: expect.objectContaining({ referral_code: 'ARENA-7K2Q' }) }),
    }))
  })

  it('CA-04.3 · con código inválido, el registro procede sin atribución', async () => {
    signUp.mockClear()
    signUp.mockResolvedValueOnce({ data: {}, error: null })
    const pagina = await mountSuspended(Registro)

    await registrar(pagina, '!!')

    expect(signUp).toHaveBeenCalledTimes(1)
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({ data: expect.objectContaining({ referral_code: null }) }),
    }))
  })
})

describe('RF-04.5 · errores de autenticación traducidos', () => {
  it('al ingresar con credenciales inválidas muestra el mensaje traducido, no el del proveedor', async () => {
    signInWithPassword.mockResolvedValueOnce({
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })
    const pagina = await mountSuspended(Ingresar)

    await pagina.find('input[type="email"]').setValue('ana@ejemplo.com')
    await pagina.find('input[type="password"]').setValue('cualquiera1')
    await pagina.find('form').trigger('submit')
    await flushPromises()

    const aviso = pagina.find('[data-test="error-auth"]')
    expect(aviso.exists()).toBe(true)
    expect(aviso.text()).toContain('El correo o la contraseña no son correctos.')
    expect(aviso.text()).not.toContain('Invalid login credentials')
  })
})
