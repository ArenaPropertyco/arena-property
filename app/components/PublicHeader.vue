<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { CuentaDelPanel } from '~/composables/useCuentaDelPanel'

/**
 * Cabecera del sitio institucional (HU-00 · RF-00.6): marca, navegación, selector de
 * idioma y de tema, y la cuenta. `UHeader` aporta el menú móvil por su cuenta: el
 * slot `#body` es lo que se muestra al tocar el botón de menú.
 *
 * Sin sesión ofrece ingresar y registrarse; con sesión, el botón al panel y el
 * avatar con las iniciales, desde el que se cierra sesión. Presenta y emite: la
 * cuenta y las rutas las decide el layout.
 */
withDefaults(defineProps<{
  items: NavigationMenuItem[]
  inicio: string
  panel: string
  ingresar: string
  registro: string
  /** `null` sin sesión o mientras el perfil no ha cargado. */
  cuenta?: CuentaDelPanel | null
}>(), {
  cuenta: null,
})

defineEmits<{ salir: [] }>()

const { t } = useI18n()
</script>

<template>
  <!--
    En móvil el hueco izquierdo de UHeader se ajusta a su contenido, y la marca
    (ancho al 100 % de su contenedor) quedaba en cero: `flex-1` le da el sitio libre.
  -->
  <UHeader :ui="{ left: 'min-w-0 flex-1' }">
    <!--
      Va en `#left` y no en `#title`: el título de UHeader ya es un enlace, y la
      marca trae el suyo. Un `<a>` dentro de otro es HTML inválido: el navegador
      lo parte al parsear y la hidratación deja de coincidir con el servidor.
    -->
    <template #left>
      <AppBrand :to="inicio" />
    </template>

    <UNavigationMenu
      :items="items"
      :ui="{ childLink: 'py-2' }"
    />

    <template #right>
      <LocaleSwitcher />
      <ThemeSwitcher />

      <template v-if="cuenta">
        <UButton
          :to="panel"
          :label="t('nav.dashboard')"
          icon="i-lucide-layout-dashboard"
          class="hidden sm:inline-flex"
          data-test="ir-al-panel"
        />
        <UserMenu
          :nombre="cuenta.nombre"
          :email="cuenta.email"
          :roles="cuenta.roles"
          compacto
          @salir="$emit('salir')"
        />
      </template>

      <template v-else>
        <UButton
          :to="ingresar"
          :label="t('actions.login')"
          color="neutral"
          variant="ghost"
          class="hidden sm:inline-flex"
          data-test="ingresar"
        />
        <UButton
          :to="registro"
          :label="t('nav.signUp')"
          class="hidden sm:inline-flex"
          data-test="registrarse"
        />
      </template>
    </template>

    <template #body>
      <UNavigationMenu
        :items="items"
        orientation="vertical"
        class="-mx-2.5"
      />

      <!-- En móvil la cuenta baja al menú: la barra no tiene sitio para los botones. -->
      <div class="mt-6 flex flex-col gap-2 border-t border-default pt-6">
        <UButton
          v-if="cuenta"
          :to="panel"
          :label="t('nav.dashboard')"
          icon="i-lucide-layout-dashboard"
          block
        />
        <template v-else>
          <UButton
            :to="ingresar"
            :label="t('actions.login')"
            color="neutral"
            variant="outline"
            block
          />
          <UButton
            :to="registro"
            :label="t('nav.signUp')"
            block
          />
        </template>
      </div>
    </template>
  </UHeader>
</template>
