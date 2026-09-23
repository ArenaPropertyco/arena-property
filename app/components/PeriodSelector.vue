<script setup lang="ts">
import { PERIODOS } from '#shared/metrics/series'
import type { Periodo } from '#shared/metrics/series'

/**
 * HU-32 · RF-32.2 — mensual, trimestral o anual. Emite el periodo elegido; la
 * serie la recalcula el dominio.
 *
 * Va como control segmentado y no como desplegable: son tres opciones fijas que
 * se comparan entre sí, y cambiar de periodo es un clic en vez de dos.
 */
defineProps<{ periodo: Periodo }>()

const emit = defineEmits<{ 'update:periodo': [Periodo] }>()

const { t } = useI18n()

const opciones = computed(() => PERIODOS.map(periodo => ({ value: periodo, label: t(`metrics.periods.${periodo}`) })))
</script>

<template>
  <div class="flex items-center gap-3">
    <span class="text-sm text-muted">{{ t('metrics.period') }}</span>
    <UTabs
      :model-value="periodo"
      :items="opciones"
      :content="false"
      size="sm"
      color="primary"
      data-test="selector-periodo"
      @update:model-value="emit('update:periodo', $event as Periodo)"
    />
  </div>
</template>
