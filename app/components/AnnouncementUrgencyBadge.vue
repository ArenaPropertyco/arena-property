<script setup lang="ts">
import { colorDeUrgencia } from '#shared/notifications/novedades'
import type { Urgencia } from '#shared/notifications/novedades'

/**
 * HU-29 · RF-29.4 · RT-07 — la urgencia de una novedad con su color de marca.
 * El color lo decide el dominio: `error` —el rojo— solo para urgente; la vista
 * no elige.
 */
const props = defineProps<{ urgencia: Urgencia }>()

const { t } = useI18n()

const color = computed(() => colorDeUrgencia(props.urgencia))
</script>

<template>
  <UBadge
    :color="color"
    variant="subtle"
    size="sm"
    :label="t(`announcements.urgencies.${urgencia}`)"
  />
</template>
