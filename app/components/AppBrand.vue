<script setup lang="ts">
/** Nombre de marca enlazado al inicio, con la tipografía de titulares del manual. */
defineProps<{ to: string }>()

const { t } = useI18n()
</script>

<template>
  <NuxtLink
    :to="to"
    class="font-display text-lg sm:text-xl font-semibold text-primary"
  >
    {{ t('app.name') }}
  </NuxtLink>
</template>
