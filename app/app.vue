<script setup lang="ts">
import { en, es } from '@nuxt/ui/locale'

// `UApp` es obligatorio en Nuxt UI: provee toasts, tooltips y overlays, y recibe el
// idioma activo para los textos internos de sus componentes.
const { locale } = useI18n()
const idiomas = { es, en }
const idiomaDeUi = computed(() => idiomas[locale.value as 'es' | 'en'] ?? es)
</script>

<template>
  <UApp :locale="idiomaDeUi">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
