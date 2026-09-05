<script setup lang="ts">
// Marcador de posición autorizado por HU-00: la página real llega en el Sprint 2.
const { t } = useI18n()
useSeoMeta({ title: t('placeholder.about.title'), description: t('placeholder.about.description') })
</script>

<template>
  <PublicPlaceholder
    :titulo="t('placeholder.about.title')"
    :descripcion="t('placeholder.about.description')"
  />
</template>
