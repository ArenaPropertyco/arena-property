<script setup lang="ts">
// Marcador de posición autorizado por HU-00: la página real llega en el Sprint 2.
const { t } = useI18n()
useSeoMeta({ title: t('placeholder.model.title'), description: t('placeholder.model.description') })
</script>

<template>
  <PublicPlaceholder
    :titulo="t('placeholder.model.title')"
    :descripcion="t('placeholder.model.description')"
  />
</template>
