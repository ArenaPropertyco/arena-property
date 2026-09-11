<script setup lang="ts">
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { IMAGENES_DEL_MODELO, PILARES_DE_LA_ESTRUCTURA } from '#shared/content/modelo'
import type { PilarDeLaEstructura } from '#shared/content/modelo'

/**
 * HU-41 · RF-41.1 — cómo está armado el modelo: ocho fracciones, titularidad en
 * fiducia, derechos de uso por temporada y operación centralizada.
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t } = useI18n()

const ICONO: Record<PilarDeLaEstructura, string> = {
  fractions: 'i-lucide-pie-chart',
  ownership: 'i-lucide-landmark',
  seasons: 'i-lucide-calendar-days',
  operation: 'i-lucide-building-2',
}
</script>

<template>
  <UPageSection
    :headline="t('model.structure.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('model.structure.description')"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-estructura"
  >
    <div class="grid gap-10 lg:grid-cols-5 lg:items-center">
      <figure class="overflow-hidden rounded-2xl lg:col-span-2">
        <NuxtImg
          :src="IMAGENES_DEL_MODELO.structure"
          :alt="t(seccion.tituloKey)"
          class="aspect-[4/5] w-full object-cover"
          sizes="100vw sm:60vw lg:40vw"
          loading="lazy"
        />
      </figure>
      <div class="grid gap-4 sm:grid-cols-2 lg:col-span-3">
        <UPageCard
          v-for="pilar in PILARES_DE_LA_ESTRUCTURA"
          :key="pilar"
          :icon="ICONO[pilar]"
          :title="t(`model.structure.items.${pilar}.title`)"
          :description="t(`model.structure.items.${pilar}.description`)"
          variant="subtle"
          :ui="{ title: 'font-display text-xl font-medium' }"
          data-test="pilar-estructura"
        />
      </div>
    </div>
  </UPageSection>
</template>
