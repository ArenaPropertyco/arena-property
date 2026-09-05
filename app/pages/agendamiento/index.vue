<script setup lang="ts">
// Marcador de posición autorizado por HU-00: la página real llega en el Sprint 2.
const { t } = useI18n()
useSeoMeta({ title: t('placeholder.scheduling.title'), description: t('placeholder.scheduling.description') })
</script>

<template>
  <PublicPlaceholder
    :titulo="t('placeholder.scheduling.title')"
    :descripcion="t('placeholder.scheduling.description')"
  />
</template>
