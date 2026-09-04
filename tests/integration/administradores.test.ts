import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AdminPromoteForm from '~/components/AdminPromoteForm.vue'
import AdminPropertiesForm from '~/components/AdminPropertiesForm.vue'
import AdminsTable from '~/components/AdminsTable.vue'
import type { Administrador } from '#shared/identity/cuentas'
import type { CuentaPromovible } from '#shared/properties/asignaciones'

/**
 * HU-05 · RF-05.1 y RF-05.2 · principio 10 · el Superadmin da el rol Administrador
 * a una cuenta existente y asigna o retira propiedades desde el administrador. Los
 * componentes presentan y emiten; el composable escribe el cambio mínimo.
 */

const candidatos: CuentaPromovible[] = [
  { id: 'u1', email: 'ana@ejemplo.com', fullName: 'Ana Pérez', status: 'active', roles: ['user'] },
  { id: 'u2', email: 'luis@ejemplo.com', fullName: null, status: 'active', roles: ['user'] },
]

const propiedades = [
  { id: 'p1', name: 'Casa Arena Palomino' },
  { id: 'p2', name: 'Invictus' },
]

const admin: Administrador = {
  id: 'a1',
  email: 'admin@arena.local',
  fullName: null,
  status: 'active',
  propiedades: ['p1'],
}

describe('AdminPromoteForm', () => {
  it('RF-05.1 · lista las cuentas promovibles y emite la elegida', async () => {
    const formulario = await mountSuspended(AdminPromoteForm, { props: { candidatos, enviando: false } })

    await formulario.find('[role="radio"][value="u2"]').trigger('click')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toEqual([['u2']])
  })

  it('busca por nombre o correo sin distinguir acentos', async () => {
    const formulario = await mountSuspended(AdminPromoteForm, { props: { candidatos, enviando: false } })

    await formulario.find('[data-test="campo-busqueda"] input').setValue('perez')
    await flushPromises()

    expect(formulario.find('[role="radio"][value="u1"]').exists()).toBe(true)
    expect(formulario.find('[role="radio"][value="u2"]').exists()).toBe(false)

    await formulario.find('[data-test="campo-busqueda"] input').setValue('nadie')
    await flushPromises()
    expect(formulario.find('[data-test="sin-coincidencias"]').exists()).toBe(true)
  })

  it('sin elegir cuenta no emite', async () => {
    const formulario = await mountSuspended(AdminPromoteForm, { props: { candidatos, enviando: false } })

    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
  })

  it('sin candidatos lo dice en vez de mostrar una lista vacía', async () => {
    const formulario = await mountSuspended(AdminPromoteForm, { props: { candidatos: [], enviando: false } })

    expect(formulario.find('[data-test="sin-candidatos"]').text()).toBe('No hay cuentas que puedan recibir el rol.')
  })
})

describe('AdminPropertiesForm', () => {
  it('RF-05.1 · trae marcadas las propiedades vigentes y emite la lista completa al agregar', async () => {
    const formulario = await mountSuspended(AdminPropertiesForm, {
      props: { administrador: admin, propiedades, guardando: false },
    })

    expect(formulario.find('[data-test="propiedad-p1"]').attributes('aria-checked')).toBe('true')
    expect(formulario.find('[data-test="propiedad-p2"]').attributes('aria-checked')).toBe('false')

    await formulario.find('[data-test="propiedad-p2"]').trigger('click')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toEqual([[['p1', 'p2']]])
  })

  it('RF-05.2 · desmarcar una propiedad la retira de la lista emitida, y la lista vacía es válida', async () => {
    const formulario = await mountSuspended(AdminPropertiesForm, {
      props: { administrador: admin, propiedades, guardando: false },
    })

    await formulario.find('[data-test="propiedad-p1"]').trigger('click')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toEqual([[[]]])
  })

  it('sin propiedades registradas lo dice', async () => {
    const formulario = await mountSuspended(AdminPropertiesForm, {
      props: { administrador: admin, propiedades: [], guardando: false },
    })

    expect(formulario.find('[data-test="sin-propiedades"]').exists()).toBe(true)
  })
})

describe('AdminsTable · asignación', () => {
  it('RF-05.4 · nombra las propiedades asignadas en vez de mostrar su identificador', async () => {
    const tabla = await mountSuspended(AdminsTable, {
      props: { administradores: [admin], propiedades, pendiente: false, puedeAsignar: true },
    })

    expect(tabla.find('[data-test="propiedades-de-a1"]').text()).toContain('Casa Arena Palomino')
    expect(tabla.text()).not.toContain('p1')
  })

  it('RF-05.1 · ofrece asignar propiedades y emite el administrador', async () => {
    const tabla = await mountSuspended(AdminsTable, {
      props: { administradores: [admin], propiedades, pendiente: false, puedeAsignar: true },
    })

    await tabla.find('[data-test="gestionar-a1"]').trigger('click')

    expect(tabla.emitted('gestionar')).toEqual([[admin]])
  })

  it('sin permiso de asignación no muestra la acción', async () => {
    const tabla = await mountSuspended(AdminsTable, {
      props: { administradores: [admin], pendiente: false },
    })

    expect(tabla.find('[data-test="gestionar-a1"]').exists()).toBe(false)
  })
})
