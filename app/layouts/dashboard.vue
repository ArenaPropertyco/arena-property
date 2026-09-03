<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { nombreParaMostrar } from '#shared/identity/perfil'
import { puede } from '#shared/permissions/mapa'

/**
 * Layout del panel privado (propietario, administrador, superadmin). Solo estructura:
 * la barra lateral es un componente y cada página aporta su propio panel.
 * Las entradas de gestión aparecen solo si la cuenta tiene la capacidad (HU-07),
 * decidido por el mapa de permisos y nunca por la vista.
 *
 * Es también el único punto del panel que consulta la cuenta: la baja a la barra
 * lateral por props y a la barra superior por el puente de `useCuentaDelPanel`.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const { perfil, roles, cerrarSesion } = useCuenta()

const cuenta = computed(() => {
  const datos = perfil.value
  if (!datos) {
    return null
  }

  return {
    nombre: nombreParaMostrar({ fullName: datos.full_name, email: datos.email }),
    email: datos.email ?? null,
    roles: roles.value,
  }
})

proveerCuentaDelPanel({ cuenta, salir: cerrarSesion })

const inicio = computed(() => localePath('/panel'))

const secciones = computed<NavigationMenuItem[]>(() => [
  { label: t('nav.dashboard'), icon: 'i-lucide-layout-dashboard', to: localePath('/panel') },
  // La pantalla de propiedades exige `gestionar_propiedades` (HU-08…HU-11): ofrecerla
  // a quien no la tiene solo produce un rebote al panel.
  ...(puede(roles.value, 'gestionar_propiedades')
    ? [{ label: t('nav.properties'), icon: 'i-lucide-building-2', to: localePath('/panel/propiedades') }]
    : []),
  { label: t('nav.calendar'), icon: 'i-lucide-calendar-days', to: localePath('/panel/calendario') },
  { label: t('nav.finance'), icon: 'i-lucide-wallet', to: localePath('/panel/finanzas') },
  { label: t('nav.notifications'), icon: 'i-lucide-bell', to: localePath('/panel/novedades') },
  ...(puede(roles.value, 'administrar_usuarios_y_roles')
    ? [
        { label: t('nav.roles'), icon: 'i-lucide-shield-check', to: localePath('/panel/roles') },
        { label: t('nav.admins'), icon: 'i-lucide-users', to: localePath('/panel/administradores') },
      ]
    : []),
])
</script>

<template>
  <UDashboardGroup>
    <DashboardSidebar
      :items="secciones"
      :inicio="inicio"
      :cuenta="cuenta"
      @salir="cerrarSesion"
    />

    <slot />
  </UDashboardGroup>
</template>
