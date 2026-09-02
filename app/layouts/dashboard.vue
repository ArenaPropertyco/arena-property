<script setup lang="ts">
/**
 * Layout del panel privado (propietario, administrador, superadmin).
 * RT-06 · en móvil la navegación colapsa; en escritorio queda fija a la izquierda.
 * Qué entradas ve cada rol es de HU-07; aquí vive solo el armazón.
 */
const { t } = useI18n()
const localePath = useLocalePath()

const menuAbierto = ref(false)

const secciones = computed(() => [
  { clave: 'nav.dashboard', icono: 'i-lucide-layout-dashboard', ruta: localePath('/panel') },
  { clave: 'nav.properties', icono: 'i-lucide-building-2', ruta: localePath('/panel/propiedades') },
  { clave: 'nav.calendar', icono: 'i-lucide-calendar-days', ruta: localePath('/panel/calendario') },
  { clave: 'nav.finance', icono: 'i-lucide-wallet', ruta: localePath('/panel/finanzas') },
  { clave: 'nav.notifications', icono: 'i-lucide-bell', ruta: localePath('/panel/novedades') },
])
</script>

<template>
  <div class="min-h-screen bg-elevated text-default lg:flex">
    <header class="lg:hidden border-b border-default bg-default">
      <div class="flex h-16 items-center justify-between gap-3 px-4">
        <NuxtLink
          :to="localePath('/panel')"
          class="font-display text-lg font-semibold text-primary"
        >
          {{ t('app.name') }}
        </NuxtLink>
        <div class="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeSwitcher />
          <UButton
            color="neutral"
            variant="ghost"
            :icon="menuAbierto ? 'i-lucide-x' : 'i-lucide-menu'"
            :aria-label="menuAbierto ? t('actions.closeMenu') : t('actions.openMenu')"
            :aria-expanded="menuAbierto"
            @click="menuAbierto = !menuAbierto"
          />
        </div>
      </div>
    </header>

    <nav
      class="border-default bg-default lg:w-64 lg:shrink-0 lg:border-r lg:min-h-screen"
      :class="menuAbierto ? 'block border-b' : 'hidden lg:block'"
      :aria-label="t('nav.dashboard')"
    >
      <div class="hidden lg:flex h-16 items-center justify-between gap-2 px-4 border-b border-default">
        <NuxtLink
          :to="localePath('/panel')"
          class="font-display text-lg font-semibold text-primary"
        >
          {{ t('app.name') }}
        </NuxtLink>
      </div>

      <ul class="p-3 flex flex-col gap-1">
        <li
          v-for="seccion in secciones"
          :key="seccion.clave"
        >
          <UButton
            :to="seccion.ruta"
            :icon="seccion.icono"
            block
            class="justify-start"
            color="neutral"
            variant="ghost"
            @click="menuAbierto = false"
          >
            {{ t(seccion.clave) }}
          </UButton>
        </li>
      </ul>

      <div class="hidden lg:flex items-center gap-1 p-3 border-t border-default">
        <LocaleSwitcher />
        <ThemeSwitcher />
      </div>
    </nav>

    <main class="flex-1 p-4 sm:p-6 lg:p-8">
      <slot />
    </main>
  </div>
</template>
