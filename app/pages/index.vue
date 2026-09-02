<script setup lang="ts">
// Marcador de posición: la home real es HU-00. La spec autoriza rutas placeholder
// dentro del mismo sprint para poder montar los layouts.
const { t } = useI18n()
</script>

<template>
  <section class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
    <h1 class="font-display text-3xl sm:text-4xl lg:text-5xl text-primary">
      {{ t('app.name') }}
    </h1>
    <p class="mt-3 text-muted">
      {{ t('app.tagline') }}
    </p>
  </section>
</template>
