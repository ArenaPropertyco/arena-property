<script setup lang="ts">
/**
 * Error de autenticación ya traducido (HU-04 · RF-04.5). El texto llega decidido:
 * este componente no sabe de códigos de error ni de proveedores.
 */
defineProps<{ mensaje?: string | null }>()
</script>

<template>
  <UAlert
    v-if="mensaje"
    color="error"
    variant="subtle"
    icon="i-lucide-triangle-alert"
    :title="mensaje"
    data-test="error-auth"
  />
</template>
