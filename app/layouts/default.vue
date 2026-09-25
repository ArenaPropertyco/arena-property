<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { nombreParaMostrar } from '#shared/identity/perfil'

/**
 * Layout público del sitio institucional (E1). Solo estructura: cabecera, contenido
 * y pie son componentes; aquí se decide qué entradas lleva la navegación.
 * RT-06 · responsive de 320px en adelante y bitema desde el primer commit.
 *
 * Es también el único punto del sitio público que consulta la cuenta: con sesión,
 * la cabecera cambia ingresar y registrarse por el botón al panel y el avatar.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { perfil, roles, sesion, cerrarSesion } = useCuenta()

const inicio = computed(() => localePath('/'))

/** Lo que agrupa «Modelo fraccionado»: cómo funciona la copropiedad y cómo se entra. */
const modelo = computed<NavigationMenuItem[]>(() => [
  { label: t('nav.model'), icon: 'i-lucide-layers', to: localePath('/modelo') },
  { label: t('nav.benefits'), icon: 'i-lucide-sparkles', to: localePath('/beneficios') },
  { label: t('nav.scheduling'), icon: 'i-lucide-calendar-range', to: localePath('/agendamiento') },
  { label: t('nav.referralProgram'), icon: 'i-lucide-handshake', to: localePath('/embajadores') },
])

const enCabecera = computed<NavigationMenuItem[]>(() => [
  { label: t('nav.home'), to: localePath('/') },
  {
    label: t('nav.fractionalModel'),
    // El padre no navega: se marca activo cuando la página es una de sus secciones.
    active: modelo.value.some(item => route.path === item.to),
    children: modelo.value,
  },
  { label: t('nav.aboutShort'), to: localePath('/nosotros') },
  { label: t('nav.contactUs'), to: localePath('/contacto') },
])

/** El pie conserva el mapa completo del sitio, catálogo incluido. */
const enPie = computed<NavigationMenuItem[]>(() => [
  { label: t('nav.home'), to: localePath('/') },
  { label: t('nav.catalog'), to: localePath('/propiedades') },
  ...modelo.value.map(({ label, to }) => ({ label, to })),
  { label: t('nav.about'), to: localePath('/nosotros') },
  { label: t('nav.contact'), to: localePath('/contacto') },
])

const cuenta = computed(() => {
  const datos = perfil.value
  if (!sesion.value.autenticado || !datos) {
    return null
  }

  return {
    nombre: nombreParaMostrar({ fullName: datos.full_name, email: datos.email }),
    email: datos.email ?? null,
    roles: roles.value,
  }
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-default text-default">
    <PublicHeader
      :items="enCabecera"
      :inicio="inicio"
      :cuenta="cuenta"
      :panel="localePath('/panel')"
      :ingresar="localePath('/ingresar')"
      :registro="localePath('/registro')"
      @salir="cerrarSesion"
    />

    <UMain class="flex-1">
      <slot />
    </UMain>

    <PublicFooter
      :inicio="inicio"
      :items="enPie"
    />
  </div>
</template>
