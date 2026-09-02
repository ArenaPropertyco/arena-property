<script setup lang="ts">
// RT-07 · el tema es del usuario. El componente solo presenta y emite; no decide reglas.
const colorMode = useColorMode()
const { t } = useI18n()

const esOscuro = computed({
  get: () => colorMode.value === 'dark',
  set: (valor: boolean) => {
    colorMode.preference = valor ? 'dark' : 'light'
  },
})
</script>

<template>
  <UButton
    data-test="selector-tema"
    :aria-label="t('theme.toggle')"
    :title="t('theme.toggle')"
    color="neutral"
    variant="ghost"
    :icon="esOscuro ? 'i-lucide-sun' : 'i-lucide-moon'"
    @click="esOscuro = !esOscuro"
  />
</template>
