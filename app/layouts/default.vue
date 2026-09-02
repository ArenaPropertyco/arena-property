<script setup lang="ts">
/**
 * Layout público del sitio institucional (E1).
 * RT-06 · responsive de 320px en adelante y bitema desde el primer commit.
 * La navegación completa del Navbar es de HU-00; aquí vive solo el armazón.
 */
const { t } = useI18n()
const localePath = useLocalePath()

const menuAbierto = ref(false)

const enlaces = computed(() => [
  { clave: 'nav.home', ruta: localePath('/') },
  { clave: 'nav.model', ruta: localePath('/modelo') },
  { clave: 'nav.benefits', ruta: localePath('/beneficios') },
  { clave: 'nav.scheduling', ruta: localePath('/agendamiento') },
  { clave: 'nav.about', ruta: localePath('/nosotros') },
  { clave: 'nav.contact', ruta: localePath('/contacto') },
])
</script>

<template>
  <div class="min-h-screen flex flex-col bg-default text-default">
    <header class="border-b border-default sticky top-0 z-50 bg-default/95 backdrop-blur">
      <div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between gap-3">
          <NuxtLink
            :to="localePath('/')"
            class="font-display text-lg sm:text-xl font-semibold text-primary"
          >
            {{ t('app.name') }}
          </NuxtLink>

          <nav
            class="hidden lg:flex items-center gap-1"
            :aria-label="t('nav.home')"
          >
            <UButton
              v-for="enlace in enlaces"
              :key="enlace.clave"
              :to="enlace.ruta"
              size="sm"
              color="neutral"
              variant="ghost"
            >
              {{ t(enlace.clave) }}
            </UButton>
          </nav>

          <div class="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeSwitcher />
            <UButton
              class="lg:hidden"
              color="neutral"
              variant="ghost"
              :icon="menuAbierto ? 'i-lucide-x' : 'i-lucide-menu'"
              :aria-label="menuAbierto ? t('actions.closeMenu') : t('actions.openMenu')"
              :aria-expanded="menuAbierto"
              @click="menuAbierto = !menuAbierto"
            />
          </div>
        </div>

        <nav
          v-if="menuAbierto"
          class="lg:hidden pb-4 flex flex-col gap-1"
          :aria-label="t('nav.home')"
        >
          <UButton
            v-for="enlace in enlaces"
            :key="enlace.clave"
            :to="enlace.ruta"
            block
            class="justify-start"
            color="neutral"
            variant="ghost"
            @click="menuAbierto = false"
          >
            {{ t(enlace.clave) }}
          </UButton>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-default mt-16">
      <div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p class="font-display text-base text-primary">
          {{ t('app.name') }}
        </p>
        <p class="text-sm text-muted text-center sm:text-right">
          © {{ new Date().getFullYear() }} {{ t('app.name') }}. {{ t('footer.rights') }}
        </p>
      </div>
    </footer>
  </div>
</template>
