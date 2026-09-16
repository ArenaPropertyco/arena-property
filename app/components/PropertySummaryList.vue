<script setup lang="ts">
import type { ResumenDePropiedad } from '#shared/properties/tablero'

/**
 * HU-21 · RF-21.1, RF-21.3 · RT-12 — las propiedades administradas, una tarjeta
 * por cada una. La rejilla se anima con auto-animate al cambiar (T-203): una
 * propiedad que entra o sale de la lista no produce saltos de layout.
 */
defineProps<{
  resumenes: ResumenDePropiedad[]
  pendiente: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="space-y-3"
    data-test="tablero-propiedades"
  >
    <p
      v-if="pendiente && resumenes.length === 0"
      class="text-sm text-muted"
      data-test="tablero-cargando"
    >
      {{ t('dashboard.loading') }}
    </p>
    <p
      v-else-if="resumenes.length === 0"
      class="text-sm text-muted"
      data-test="tablero-vacio"
    >
      {{ t('dashboard.empty') }}
    </p>

    <div
      v-auto-animate
      class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      <PropertySummaryCard
        v-for="resumen in resumenes"
        :key="resumen.id"
        :resumen="resumen"
      />
    </div>
  </div>
</template>
