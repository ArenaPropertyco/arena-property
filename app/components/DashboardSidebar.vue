<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { CuentaDelPanel } from '~/composables/useCuentaDelPanel'

/**
 * Barra lateral del panel privado. `UDashboardSidebar` resuelve el colapso en
 * escritorio y el cajón deslizante en móvil; aquí solo se decide qué va dentro.
 * Qué entradas recibe cada rol lo decide el layout con el mapa de permisos.
 */
withDefaults(defineProps<{
  items: NavigationMenuItem[]
  inicio: string
  /** Identidad de quien usa el panel; la carga el layout, no este componente. */
  cuenta?: CuentaDelPanel | null
}>(), {
  cuenta: null,
})

defineEmits<{ salir: [] }>()

const { t } = useI18n()
</script>

<template>
  <UDashboardSidebar
    collapsible
    :ui="{ footer: 'border-t border-default' }"
  >
    <template #header="{ collapsed }">
      <!-- Plegada cabe el isotipo, así que la marca no desaparece del panel. -->
      <AppBrand
        :to="inicio"
        :solo-icono="collapsed"
      />
    </template>

    <template #default="{ collapsed }">
      <UNavigationMenu
        :collapsed="collapsed"
        :items="items"
        orientation="vertical"
        :aria-label="t('nav.dashboard')"
      />
    </template>

    <template #footer="{ collapsed }">
      <div class="w-full space-y-2">
        <UserMenu
          v-if="cuenta"
          :nombre="cuenta.nombre"
          :email="cuenta.email"
          :roles="cuenta.roles"
          :compacto="collapsed"
          @salir="$emit('salir')"
        />

        <div
          v-if="!collapsed"
          class="flex items-center gap-1"
        >
          <LocaleSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </template>
  </UDashboardSidebar>
</template>
