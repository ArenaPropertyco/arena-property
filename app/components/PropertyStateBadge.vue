<script setup lang="ts">
import type { EstadoComercial, Visibilidad } from '#shared/properties/estados'

/**
 * HU-08 · D-18 · los dos ejes de estado de una propiedad, uno al lado del otro.
 *
 * Se muestran siempre los dos porque son independientes: una propiedad puede estar
 * publicada y todavía «Próximamente». Cuando aún no está fraccionada no hay estado
 * comercial que derivar, y se dice —principio 9: no se rellena un hueco con una
 * suposición.
 */
defineProps<{
  visibility: Visibilidad
  commercial: EstadoComercial | null
}>()

const { t } = useI18n()

const COLOR_DE_VISIBILIDAD = {
  draft: 'neutral',
  published: 'success',
  inactive: 'warning',
} as const

const COLOR_COMERCIAL = {
  coming_soon: 'info',
  fractions_available: 'primary',
  sold_out: 'neutral',
} as const
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <UBadge
      :color="COLOR_DE_VISIBILIDAD[visibility]"
      variant="subtle"
      size="sm"
      data-test="estado-visibilidad"
      :label="t(`properties.visibility.${visibility}`)"
    />

    <UBadge
      :color="commercial ? COLOR_COMERCIAL[commercial] : 'neutral'"
      :variant="commercial ? 'subtle' : 'outline'"
      size="sm"
      data-test="estado-comercial"
      :label="commercial ? t(`properties.commercial.${commercial}`) : t('properties.commercial.unknown')"
    />
  </div>
</template>
