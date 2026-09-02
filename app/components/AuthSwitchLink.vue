<script setup lang="ts">
/** «¿Ya tienes cuenta? Iniciar sesión» y su inverso: pregunta más enlace. */
defineProps<{
  pregunta: string
  etiqueta: string
  to: string
}>()
</script>

<template>
  <p class="text-center text-sm text-muted">
    {{ pregunta }}
    <NuxtLink
      :to="to"
      class="text-primary font-medium"
    >
      {{ etiqueta }}
    </NuxtLink>
  </p>
</template>
