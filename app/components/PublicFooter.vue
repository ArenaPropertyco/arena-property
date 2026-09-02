<script setup lang="ts">
/** Pie del sitio institucional (HU-00 · RF-00.6). */
defineProps<{ inicio: string }>()

const { t } = useI18n()
const anio = new Date().getFullYear()
</script>

<template>
  <UFooter>
    <template #left>
      <AppBrand :to="inicio" />
    </template>

    <p class="text-sm text-muted text-center">
      © {{ anio }} {{ t('app.name') }}. {{ t('footer.rights') }}
    </p>
  </UFooter>
</template>
