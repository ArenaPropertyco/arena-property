<script setup lang="ts">
/**
 * Tarjeta centrada de las pantallas de cuenta (registro, ingreso, verificación,
 * suspensión): título con la tipografía del manual, contenido y pie opcional.
 */
defineProps<{
  titulo: string
  subtitulo?: string
}>()
</script>

<template>
  <section class="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
    <UPageCard>
      <template #header>
        <h1 class="font-display text-2xl sm:text-3xl text-primary">
          {{ titulo }}
        </h1>
        <p
          v-if="subtitulo"
          class="mt-1 text-sm text-muted"
        >
          {{ subtitulo }}
        </p>
      </template>

      <slot />

      <template
        v-if="$slots.footer"
        #footer
      >
        <slot name="footer" />
      </template>
    </UPageCard>
  </section>
</template>
