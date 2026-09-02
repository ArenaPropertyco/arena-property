<script setup lang="ts">
// Marcador de posición: el panel real es HU-18. Ya exige sesión verificada (RF-04.2).
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })
const { t } = useI18n()
</script>

<template>
  <PanelPage :titulo="t('nav.dashboard')" />
</template>
