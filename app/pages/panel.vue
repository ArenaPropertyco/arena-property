<script setup lang="ts">
// Marcador de posición: el panel real es HU-18. Existe para montar el layout de panel.
definePageMeta({ layout: 'dashboard' })
const { t } = useI18n()
</script>

<template>
  <section>
    <h1 class="font-display text-2xl sm:text-3xl text-primary">
      {{ t('nav.dashboard') }}
    </h1>
  </section>
</template>
