<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

/**
 * Cabecera del sitio institucional (HU-00 · RF-00.6): marca, navegación, selector de
 * idioma y de tema. `UHeader` aporta el menú móvil por su cuenta: el slot `#body` es
 * lo que se muestra al tocar el botón de menú.
 */
defineProps<{
  items: NavigationMenuItem[]
  inicio: string
}>()
</script>

<template>
  <UHeader>
    <!--
      Va en `#left` y no en `#title`: el título de UHeader ya es un enlace, y la
      marca trae el suyo. Un `<a>` dentro de otro es HTML inválido: el navegador
      lo parte al parsear y la hidratación deja de coincidir con el servidor.
    -->
    <template #left>
      <AppBrand :to="inicio" />
    </template>

    <UNavigationMenu :items="items" />

    <template #right>
      <LocaleSwitcher />
      <ThemeSwitcher />
    </template>

    <template #body>
      <UNavigationMenu
        :items="items"
        orientation="vertical"
        class="-mx-2.5"
      />
    </template>
  </UHeader>
</template>
