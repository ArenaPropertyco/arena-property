<script setup lang="ts">
/** HU-02 · RF-02.1 — distintivo de vista previa para quien administra un borrador. */
const { t } = useI18n()
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-lucide-eye"
    :title="t('property.preview')"
    :description="t('property.previewHint')"
    data-test="vista-previa"
  />
</template>
