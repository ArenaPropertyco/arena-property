import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import AccountsRolesTable from '~/components/AccountsRolesTable.vue'
import SuspendAccountForm from '~/components/SuspendAccountForm.vue'
import type { CuentaConRoles } from '#shared/identity/cuentas'

/**
 * HU-33 · RF-33.1, RF-33.3, RF-33.5, RF-33.6 · D-07 · RT-06 · principio 10 · la
 * tabla de cuentas ofrece suspender o reactivar solo a quien puede y sobre
 * quien procede, y el formulario exige motivo y tipo antes de emitir. Ninguno
 * escribe: la página lleva la decisión a la base.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const SUPER: CuentaConRoles = { id: 's1', email: 'super@arena.local', fullName: null, status: 'active', roles: ['user', 'superadmin'] }
const ANA: CuentaConRoles = { id: 'u1', email: 'ana@ejemplo.com', fullName: 'Ana Ruiz', status: 'active', roles: ['user', 'ambassador'] }
const LUIS: CuentaConRoles = { id: 'u2', email: 'luis@ejemplo.com', fullName: null, status: 'suspended', roles: ['user', 'owner'] }

function cuentas(): CuentaConRoles[] {
  return [SUPER, ANA, LUIS].map(cuenta => ({ ...cuenta, roles: [...cuenta.roles] }))
}

describe('AccountsRolesTable · HU-33', () => {
  it('RF-33.6 · el Superadmin ve suspender en las activas ajenas, reactivar en las suspendidas, y nada sobre sí mismo', async () => {
    const tabla = await mountSuspended(AccountsRolesTable, {
      props: { cuentas: cuentas(), pendiente: false, idDelActor: 's1', rolesDelActor: ['superadmin'] },
    })

    expect(tabla.find('[data-test="suspender-u1"]').exists()).toBe(true)
    expect(tabla.find('[data-test="reactivar-u2"]').exists()).toBe(true)
    expect(tabla.find('[data-test="suspender-s1"]').exists()).toBe(false)
    expect(tabla.find('[data-test="reactivar-s1"]').exists()).toBe(false)
    expect(tabla.text()).toContain('Suspendida')

    await tabla.find('[data-test="suspender-u1"]').trigger('click')
    expect(tabla.emitted('suspender')?.[0]?.[0]).toMatchObject({ id: 'u1' })

    await tabla.find('[data-test="reactivar-u2"]').trigger('click')
    expect(tabla.emitted('reactivar')?.[0]?.[0]).toMatchObject({ id: 'u2' })
  })

  it('RF-33.6 · sin ser Superadmin no se ofrece ni suspender ni reactivar', async () => {
    const tabla = await mountSuspended(AccountsRolesTable, {
      props: { cuentas: cuentas(), pendiente: false, idDelActor: 'a1', rolesDelActor: ['property_admin'] },
    })
    expect(tabla.find('[data-test^="suspender-"]').exists()).toBe(false)
    expect(tabla.find('[data-test^="reactivar-"]').exists()).toBe(false)
  })
})

describe('SuspendAccountForm', () => {
  it('CA-33.1 · RF-33.3 · sin tipo ni motivo no emite y muestra los dos errores', async () => {
    const formulario = await mountSuspended(SuspendAccountForm, { props: { cuenta: ANA, enviando: false } })
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-suspension-tipo"]').text()).toContain('Elige el tipo')
    expect(formulario.find('[data-test="campo-suspension-motivo"]').text()).toContain('necesita un motivo')
  })

  it('RF-33.3 · D-07 · elegir fraude avisa de lo que se pierde; con motivo, emite tipo y motivo', async () => {
    const formulario = await mountSuspended(SuspendAccountForm, { props: { cuenta: ANA, enviando: false } })

    formulario.findComponent({ name: 'URadioGroup' }).vm.$emit('update:modelValue', 'breach_or_fraud')
    await flushPromises()
    expect(formulario.find('[data-test="aviso-fraude"]').exists()).toBe(true)

    await formulario.find('[data-test="suspension-motivo"]').setValue('  Autorreferencia probada.  ')
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toEqual([['breach_or_fraud', 'Autorreferencia probada.']])
  })

  it('RF-33.3 · administrativa no avisa de pérdida: el saldo se conserva', async () => {
    const formulario = await mountSuspended(SuspendAccountForm, { props: { cuenta: ANA, enviando: false } })
    formulario.findComponent({ name: 'URadioGroup' }).vm.$emit('update:modelValue', 'administrative')
    await flushPromises()
    expect(formulario.find('[data-test="aviso-fraude"]').exists()).toBe(false)
    expect(formulario.text()).toContain('conserva todo su saldo')
  })
})
