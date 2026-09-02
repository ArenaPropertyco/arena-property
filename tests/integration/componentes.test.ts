import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RegistroForm from '~/components/RegistroForm.vue'
import IngresoForm from '~/components/IngresoForm.vue'
import AuthGoogleButton from '~/components/AuthGoogleButton.vue'
import UserMenu from '~/components/UserMenu.vue'
import AccountsRolesTable from '~/components/AccountsRolesTable.vue'
import AdminInviteForm from '~/components/AdminInviteForm.vue'
import AccountStatusBadge from '~/components/AccountStatusBadge.vue'
import PermissionsMatrix from '~/components/PermissionsMatrix.vue'
import { filasDeMatriz } from '#shared/permissions/mapa'

/**
 * Principio 10 · los componentes reciben datos por props y comunican por eventos.
 * Ninguno toca Supabase ni navega: quien los monta decide qué hacer con lo emitido.
 */

describe('RegistroForm', () => {
  it('CA-04.1 · con datos inválidos muestra los errores traducidos y no emite', async () => {
    const formulario = await mountSuspended(RegistroForm)

    await formulario.find('[data-test="campo-email"] input, input[type="email"]').setValue('ana@')
    await formulario.find('[data-test="campo-password"] input, input[autocomplete="new-password"]').setValue('corta')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.text()).toContain('Escribe un correo válido.')
    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('con datos válidos emite el registro ya normalizado', async () => {
    const formulario = await mountSuspended(RegistroForm, { props: { prellenado: 'arena-7k2q' } })

    await formulario.find('input[type="email"]').setValue('  Ana@Ejemplo.COM ')
    const contrasenas = formulario.findAll('input[autocomplete="new-password"]')
    await contrasenas[0]!.setValue('Arena2026')
    await contrasenas[1]!.setValue('Arena2026')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toEqual([[{
      email: 'ana@ejemplo.com',
      password: 'Arena2026',
      referralCode: 'ARENA-7K2Q',
    }]])
  })

  it('RF-04.4 · prellena el código de referido y avisa que se registrará', async () => {
    const formulario = await mountSuspended(RegistroForm, { props: { prellenado: 'arena-7k2q' } })

    expect((formulario.find('[data-test="campo-referido"] input, input[autocomplete="off"]').element as HTMLInputElement).value).toBe('ARENA-7K2Q')
    expect(formulario.find('[data-test="aviso-referido"]').text()).toContain('ARENA-7K2Q')
  })

  it('RF-04.5 · muestra el error de autenticación que le pasan, sin decidir nada', async () => {
    const formulario = await mountSuspended(RegistroForm, { props: { error: 'Ya existe una cuenta con ese correo.' } })

    expect(formulario.find('[data-test="error-auth"]').text()).toContain('Ya existe una cuenta con ese correo.')
  })

  it('HU-61 · RF-61.1 · el botón de Google emite su propio evento, no un submit', async () => {
    const formulario = await mountSuspended(RegistroForm)

    await formulario.find('[data-test="boton-google"]').trigger('click')

    expect(formulario.emitted('google')).toHaveLength(1)
    expect(formulario.emitted('submit')).toBeUndefined()
  })
})

describe('UserMenu · identidad y salida del panel', () => {
  const cuenta = { nombre: 'Ana María', email: 'ana@ejemplo.com', roles: ['user', 'owner'] as const }

  /**
   * `UDropdownMenu` de Nuxt UI monta su contenido en un portal y solo al abrirse
   * (Reka UI). Se le habla por su contrato —las opciones que recibe— igual que a
   * `USelect` en la matriz de permisos, y no por su marcado interno.
   */
  function opcionesDe(menu: Awaited<ReturnType<typeof mountSuspended>>) {
    return menu.findComponent({ name: 'UDropdownMenu' }).props('items') as { label: string, onSelect: () => void }[][]
  }

  it('muestra el nombre y el correo de la cuenta', async () => {
    const menu = await mountSuspended(UserMenu, { props: { ...cuenta, roles: [...cuenta.roles] } })

    expect(menu.text()).toContain('Ana María')
    expect(menu.text()).toContain('ana@ejemplo.com')
  })

  it('compacto deja solo el avatar: ni nombre ni correo en el disparador', async () => {
    const menu = await mountSuspended(UserMenu, { props: { ...cuenta, roles: [...cuenta.roles], compacto: true } })
    const disparador = menu.find('[data-test="menu-cuenta"]')

    expect(disparador.text()).not.toContain('ana@ejemplo.com')
    expect(disparador.text()).not.toContain('Ana María')
  })

  it('ofrece cerrar sesión y lo emite en vez de decidirlo por su cuenta', async () => {
    const menu = await mountSuspended(UserMenu, { props: { ...cuenta, roles: [...cuenta.roles] } })
    const opciones = opcionesDe(menu)

    expect(opciones[0]![0]!.label).toBe('Cerrar sesión')

    opciones[0]![0]!.onSelect()
    await flushPromises()

    expect(menu.emitted('salir')).toHaveLength(1)
  })

  it('sin correo ni roles sigue mostrando el nombre, sin huecos', async () => {
    const menu = await mountSuspended(UserMenu, { props: { nombre: 'alascarbonycerdo' } })

    expect(menu.text()).toContain('alascarbonycerdo')
    expect(menu.find('[data-test="correo-cuenta"]').exists()).toBe(false)
  })
})

describe('AuthGoogleButton', () => {
  it('HU-61 · RF-61.1 · al hacer clic emite «continuar» y nada más', async () => {
    const boton = await mountSuspended(AuthGoogleButton)

    await boton.find('[data-test="boton-google"]').trigger('click')

    expect(boton.emitted('continuar')).toHaveLength(1)
  })

  it('refleja el estado de carga que le pasan', async () => {
    const boton = await mountSuspended(AuthGoogleButton, { props: { cargando: true } })

    expect(boton.findComponent({ name: 'UButton' }).props('loading')).toBe(true)
  })
})

describe('IngresoForm', () => {
  it('emite las credenciales con el correo normalizado', async () => {
    const formulario = await mountSuspended(IngresoForm)

    await formulario.find('input[type="email"]').setValue('Super@Arena.LOCAL')
    await formulario.find('input[type="password"]').setValue('Arena2026!')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toEqual([[{ email: 'super@arena.local', password: 'Arena2026!' }]])
  })

  it('no emite mientras está enviando', async () => {
    const formulario = await mountSuspended(IngresoForm, { props: { enviando: true } })

    await formulario.find('input[type="email"]').setValue('a@b.co')
    await formulario.find('input[type="password"]').setValue('x')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('HU-61 · RF-61.1 · el botón de Google emite su propio evento, no un submit', async () => {
    const formulario = await mountSuspended(IngresoForm)

    await formulario.find('[data-test="boton-google"]').trigger('click')

    expect(formulario.emitted('google')).toHaveLength(1)
    expect(formulario.emitted('submit')).toBeUndefined()
  })
})

describe('AccountsRolesTable', () => {
  const cuentas = [
    { id: 'u1', email: 'ana@ejemplo.com', fullName: null, status: 'active' as const, roles: ['user', 'owner'] as const },
  ]

  it('RF-07.3 · retirar un rol emite el evento con la cuenta y el rol, sin tocar datos', async () => {
    const tabla = await mountSuspended(AccountsRolesTable, { props: { cuentas: [...cuentas].map(c => ({ ...c, roles: [...c.roles] })), pendiente: false } })

    await tabla.find('[data-test="retirar-owner"]').trigger('click')

    expect(tabla.emitted('retirar')).toEqual([[cuentas[0], 'owner']])
  })

  it('el rol Usuario del registro no se puede retirar desde la tabla', async () => {
    const tabla = await mountSuspended(AccountsRolesTable, { props: { cuentas: [...cuentas].map(c => ({ ...c, roles: [...c.roles] })), pendiente: false } })

    expect(tabla.find('[data-test="retirar-user"]').exists()).toBe(false)
  })
})

describe('AdminInviteForm', () => {
  it('RF-05.1 · emite el correo normalizado del administrador a invitar', async () => {
    const formulario = await mountSuspended(AdminInviteForm)

    await formulario.find('input[type="email"]').setValue(' Nuevo@Arena.CO ')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toEqual([['nuevo@arena.co']])
  })
})

describe('AccountStatusBadge', () => {
  it('RF-05.4 · traduce el estado de cuenta con la semántica de color de marca', async () => {
    const activa = await mountSuspended(AccountStatusBadge, { props: { status: 'active' } })
    const suspendida = await mountSuspended(AccountStatusBadge, { props: { status: 'suspended' } })

    expect(activa.text()).toBe('Activa')
    expect(suspendida.text()).toBe('Suspendida')
  })
})

describe('PermissionsMatrix · edición por celda (HU-07 · RF-07.3)', () => {
  // Solo las filas que estas pruebas afirman: montar las 18 crea 108 listboxes y
  // tarda más que el propio contrato que se quiere probar.
  const CAPACIDADES_PROBADAS = ['gestionar_inventario', 'administrar_usuarios_y_roles', 'ver_sitio_publico']
  const filas = filasDeMatriz().filter(fila => CAPACIDADES_PROBADAS.includes(fila.capacidad))

  /**
   * `USelect` de Nuxt UI no es un `<select>` nativo (usa Reka UI), así que se le
   * habla por su contrato —el modelo que emite— y no por su marcado interno.
   */
  function selectorDe(matriz: Awaited<ReturnType<typeof mountSuspended>>, celda: string) {
    const contenedor = matriz.find(`[data-test="${celda}"]`)
    return matriz.findAllComponents({ name: 'USelect' })
      .find(control => contenedor.element.contains(control.element))
  }

  it('en solo lectura no ofrece controles de edición', async () => {
    const matriz = await mountSuspended(PermissionsMatrix, { props: { filas } })

    expect(matriz.findAllComponents({ name: 'USelect' })).toHaveLength(0)
    expect(matriz.emitted('ajustar')).toBeUndefined()
  })

  it('en modo editable emite la celda ajustada, sin decidir nada por su cuenta', async () => {
    const matriz = await mountSuspended(PermissionsMatrix, { props: { filas, editable: true } })

    const celda = selectorDe(matriz, 'celda-gestionar_inventario-owner')
    expect(celda).toBeDefined()
    celda!.vm.$emit('update:modelValue', 'si')
    await flushPromises()

    expect(matriz.emitted('ajustar')).toEqual([[{
      capacidad: 'gestionar_inventario',
      columna: 'owner',
      alcance: 'si',
    }]])
  })

  it('elegir el mismo alcance que ya tiene la celda no emite nada', async () => {
    const matriz = await mountSuspended(PermissionsMatrix, { props: { filas, editable: true } })

    const celda = selectorDe(matriz, 'celda-gestionar_inventario-owner')
    celda!.vm.$emit('update:modelValue', 'lectura')
    await flushPromises()

    expect(matriz.emitted('ajustar')).toBeUndefined()
  })

  it('un valor fuera del vocabulario se descarta', async () => {
    const matriz = await mountSuspended(PermissionsMatrix, { props: { filas, editable: true } })

    const celda = selectorDe(matriz, 'celda-gestionar_inventario-owner')
    celda!.vm.$emit('update:modelValue', 'alcance_inventado')
    await flushPromises()

    expect(matriz.emitted('ajustar')).toBeUndefined()
  })

  it('avisa que la base de datos también hace cumplir la capacidad', async () => {
    const matriz = await mountSuspended(PermissionsMatrix, { props: { filas, editable: true } })

    expect(matriz.find('[data-test="en-base-de-datos-administrar_usuarios_y_roles"]').exists()).toBe(true)
    expect(matriz.find('[data-test="en-base-de-datos-ver_sitio_publico"]').exists()).toBe(false)
  })
})
