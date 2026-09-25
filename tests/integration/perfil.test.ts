import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import AccountsRolesTable from '~/components/AccountsRolesTable.vue'
import PasswordForm from '~/components/PasswordForm.vue'
import ProfileForm from '~/components/ProfileForm.vue'
import UserMenu from '~/components/UserMenu.vue'
import type { CuentaConRoles } from '#shared/identity/cuentas'

/**
 * Perfil y edición de cuentas: la propia cuenta cambia todo menos el correo; el
 * Superadmin, desde Roles, cambia todo de cualquier cuenta. La contraseña se
 * cambia dando la actual o, si la cuenta nació con Google, se crea.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const datos = { email: 'ana@arena.co', fullName: 'Ana Ruiz', phone: '3001234567', locale: 'es' }

describe('ProfileForm', () => {
  it('en el perfil propio el correo se ve bloqueado y el resto se emite', async () => {
    const formulario = await mountSuspended(ProfileForm, { props: { datos, enviando: false } })

    expect(formulario.find('input[data-test="perfil-correo"], [data-test="perfil-correo"] input').attributes('disabled')).toBeDefined()
    expect(formulario.text()).toContain('pídeselo al Superadmin')

    await formulario.find('input[data-test="perfil-nombre"], [data-test="perfil-nombre"] input').setValue('Ana María Ruiz')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0]).toMatchObject({ fullName: 'Ana María Ruiz', phone: '3001234567', locale: 'es', email: 'ana@arena.co' })
  })

  it('un teléfono inválido no se emite y se explica', async () => {
    const formulario = await mountSuspended(ProfileForm, { props: { datos, enviando: false } })

    await formulario.find('input[data-test="perfil-telefono"], [data-test="perfil-telefono"] input').setValue('300-ABC')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-telefono"]').text()).toContain('Escribe un teléfono válido')
  })

  it('en Roles el Superadmin también edita el correo, y se valida', async () => {
    const formulario = await mountSuspended(ProfileForm, { props: { datos, enviando: false, correoEditable: true } })

    expect(formulario.find('input[data-test="perfil-correo"], [data-test="perfil-correo"] input').attributes('disabled')).toBeUndefined()

    await formulario.find('input[data-test="perfil-correo"], [data-test="perfil-correo"] input').setValue('ana@')
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toBeUndefined()

    await formulario.find('input[data-test="perfil-correo"], [data-test="perfil-correo"] input').setValue('ana.nueva@arena.co')
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')?.[0]?.[0]).toMatchObject({ email: 'ana.nueva@arena.co' })
  })
})

describe('PasswordForm', () => {
  it('con contraseña pide la actual antes de emitir', async () => {
    const formulario = await mountSuspended(PasswordForm, { props: { tieneContrasena: true, enviando: false } })

    expect(formulario.find('[data-test="contrasena-actual"]').exists()).toBe(true)
    await formulario.find('input[data-test="contrasena-nueva"], [data-test="contrasena-nueva"] input').setValue('nueva1234')
    await formulario.find('input[data-test="contrasena-confirmacion"], [data-test="contrasena-confirmacion"] input').setValue('nueva1234')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-actual"]').text()).toContain('Escribe tu contraseña actual')

    await formulario.find('input[data-test="contrasena-actual"], [data-test="contrasena-actual"] input').setValue('vieja1234')
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')?.[0]?.[0]).toEqual({ actual: 'vieja1234', nueva: 'nueva1234', confirmacion: 'nueva1234' })
  })

  it('sin contraseña (alta con Google) ofrece crearla, sin campo de actual', async () => {
    const formulario = await mountSuspended(PasswordForm, { props: { tieneContrasena: false, enviando: false } })

    expect(formulario.find('[data-test="contrasena-actual"]').exists()).toBe(false)
    expect(formulario.find('[data-test="contrasena-explicacion"]').text()).toContain('Entraste con Google')
    expect(formulario.find('[data-test="guardar-contrasena"]').text()).toBe('Crear contraseña')

    await formulario.find('input[data-test="contrasena-nueva"], [data-test="contrasena-nueva"] input').setValue('nueva1234')
    await formulario.find('input[data-test="contrasena-confirmacion"], [data-test="contrasena-confirmacion"] input').setValue('nueva1234')
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toHaveLength(1)
  })
})

describe('PasswordForm · administrada', () => {
  it('el Superadmin fija la contraseña de otra cuenta sin pedir la actual', async () => {
    const formulario = await mountSuspended(PasswordForm, { props: { tieneContrasena: false, administrada: true, enviando: false } })

    expect(formulario.find('[data-test="contrasena-actual"]').exists()).toBe(false)
    expect(formulario.find('[data-test="contrasena-explicacion"]').text()).toContain('queda auditado')
    expect(formulario.find('[data-test="guardar-contrasena"]').text()).toBe('Cambiar contraseña')

    await formulario.find('input[data-test="contrasena-nueva"], [data-test="contrasena-nueva"] input').setValue('corta')
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toBeUndefined()

    await formulario.find('input[data-test="contrasena-nueva"], [data-test="contrasena-nueva"] input').setValue('Nueva1234')
    await formulario.find('input[data-test="contrasena-confirmacion"], [data-test="contrasena-confirmacion"] input').setValue('Nueva1234')
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')?.[0]?.[0]).toMatchObject({ nueva: 'Nueva1234', confirmacion: 'Nueva1234' })
  })
})

describe('UserMenu', () => {
  it('ofrece «Perfil» junto a cerrar sesión', async () => {
    const menu = await mountSuspended(UserMenu, { props: { nombre: 'Ana Ruiz', email: 'ana@arena.co' } })
    const items = menu.findComponent({ name: 'UDropdownMenu' }).props('items') as { label: string, to?: string }[][]

    expect(items.flat().map(item => item.label)).toEqual(['Perfil', 'Cerrar sesión'])
    expect(items.flat()[0]?.to).toBe('/panel/perfil')
  })
})

describe('AccountsRolesTable · editar', () => {
  const cuentas: CuentaConRoles[] = [
    { id: 'c1', email: 'ana@arena.co', fullName: 'Ana Ruiz', phone: null, locale: 'es', status: 'active', roles: ['user', 'owner'] },
  ]

  it('solo el Superadmin ve «Editar», y emite la cuenta', async () => {
    const comoAdmin = await mountSuspended(AccountsRolesTable, { props: { cuentas, pendiente: false, rolesDelActor: ['property_admin'] } })
    expect(comoAdmin.find('[data-test="editar-c1"]').exists()).toBe(false)

    const comoSuper = await mountSuspended(AccountsRolesTable, { props: { cuentas, pendiente: false, rolesDelActor: ['superadmin'], idDelActor: 's1' } })
    await comoSuper.find('[data-test="editar-c1"]').trigger('click')
    expect(comoSuper.emitted('editar')?.[0]?.[0]).toMatchObject({ id: 'c1' })
  })
})
