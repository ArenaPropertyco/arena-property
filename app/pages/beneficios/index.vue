<script setup lang="ts">
// Marcador de posición autorizado por HU-00: la página real llega en el Sprint 2.
const { t } = useI18n()
useSeoMeta({ title: t('placeholder.benefits.title'), description: t('placeholder.benefits.description') })
</script>

<template>
  <PublicPlaceholder
    :titulo="t('placeholder.benefits.title')"
    :descripcion="t('placeholder.benefits.description')"
  />
</template>
