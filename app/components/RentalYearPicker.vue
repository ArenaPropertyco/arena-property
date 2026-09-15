<script setup lang="ts">
/**
 * HU-39 · el año de la bolsa de renta que se está mirando. Controlado: recibe el
 * año y emite el cambio. Vive como componente porque el principio 10 no deja
 * controles sueltos en una página, ni siquiera dos flechas.
 */
defineProps<{ anio: number }>()

const emit = defineEmits<{ 'update:anio': [number] }>()

const { t } = useI18n()
</script>

<template>
  <div
    class="flex items-center gap-2"
    data-test="selector-anio-rentas"
  >
    <UButton
      variant="outline"
      color="neutral"
      size="sm"
      icon="i-lucide-chevron-left"
      :aria-label="t('calendar.previousYear')"
      data-test="anio-anterior"
      @click="emit('update:anio', anio - 1)"
    />
    <span class="font-mono text-sm text-default">{{ anio }}</span>
    <UButton
      variant="outline"
      color="neutral"
      size="sm"
      icon="i-lucide-chevron-right"
      :aria-label="t('calendar.nextYear')"
      data-test="anio-siguiente"
      @click="emit('update:anio', anio + 1)"
    />
  </div>
</template>
