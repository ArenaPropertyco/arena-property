<script setup lang="ts">
import type { TarjetaDeFraccion } from '#shared/finance/portafolio'

/**
 * HU-18 · RF-18.1, RF-18.4 · RT-12 — las fracciones del Propietario, una tarjeta
 * por cada una. La rejilla se anima con auto-animate al cambiar: una fracción
 * que entra al portafolio no produce saltos de layout.
 */
defineProps<{
  tarjetas: TarjetaDeFraccion[]
  pendiente: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div data-test="portafolio">
    <p
      v-if="pendiente && tarjetas.length === 0"
      class="text-sm text-muted"
      data-test="portafolio-cargando"
    >
      {{ t('portfolio.loading') }}
    </p>
    <p
      v-else-if="tarjetas.length === 0"
      class="rounded-2xl border border-dashed border-default px-6 py-12 text-center text-sm text-muted"
      data-test="sin-fracciones"
    >
      {{ t('portfolio.empty') }}
    </p>

    <div
      v-auto-animate
      class="grid gap-4 md:grid-cols-2"
    >
      <OwnerFractionCard
        v-for="tarjeta in tarjetas"
        :key="tarjeta.fractionId"
        :tarjeta="tarjeta"
      />
    </div>
  </div>
</template>
