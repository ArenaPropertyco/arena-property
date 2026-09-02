<script setup lang="ts">
/** Título de sección dentro de una página del panel. */
defineProps<{ titulo: string }>()
</script>

<template>
  <h2 class="font-display text-xl text-default">
    {{ titulo }}
  </h2>
</template>
