<script setup lang="ts">
import { IMAGENES_DE_BENEFICIOS, VENTAJAS } from '#shared/content/beneficios'
import type { Ventaja } from '#shared/content/beneficios'
import type { SeccionDePagina } from '#shared/content/manifiesto'

/**
 * HU-42 · RF-42.4 — las seis ventajas del fraccionado, en detalle.
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t } = useI18n()

const ICONO: Record<Ventaja, string> = {
  capital: 'i-lucide-pie-chart',
  weeks: 'i-lucide-calendar-days',
  income: 'i-lucide-banknote',
  ownership: 'i-lucide-key-round',
  management: 'i-lucide-building-2',
  transparency: 'i-lucide-scroll-text',
}
</script>

<template>
  <UPageSection
    :headline="t('benefits.list.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('benefits.list.description')"
    class="bg-elevated/40"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-ventajas"
  >
    <div class="grid gap-10 lg:grid-cols-5 lg:items-start">
      <ul class="grid gap-6 sm:grid-cols-2 lg:col-span-3">
        <li
          v-for="ventaja in VENTAJAS"
          :key="ventaja"
          class="flex gap-4"
          data-test="ventaja"
        >
          <span class="mt-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UIcon
              :name="ICONO[ventaja]"
              class="size-5"
            />
          </span>
          <div>
            <h3 class="font-display text-xl font-medium text-highlighted">
              {{ t(`benefits.items.${ventaja}.title`) }}
            </h3>
            <p class="mt-1 text-sm text-muted">
              {{ t(`benefits.items.${ventaja}.description`) }}
            </p>
          </div>
        </li>
      </ul>
      <figure class="overflow-hidden rounded-2xl lg:col-span-2">
        <NuxtImg
          :src="IMAGENES_DE_BENEFICIOS.benefits"
          :alt="t(seccion.tituloKey)"
          class="aspect-[4/5] w-full object-cover"
          sizes="100vw sm:60vw lg:40vw"
          loading="lazy"
        />
      </figure>
    </div>
  </UPageSection>
</template>
