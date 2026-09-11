<script setup lang="ts">
import { BLOQUES_PICO_PUBLICADOS, IMAGENES_DE_AGENDAMIENTO, REGLAS_PUBLICADAS } from '#shared/content/agendamiento'
import type { ReglaPublicada } from '#shared/content/agendamiento'
import type { SeccionDePagina } from '#shared/content/manifiesto'

/**
 * HU-43 · RF-43.2 — las reglas visibles al comprador, las que el motor aplica:
 * semanas completas, turnos, rotación, bloques pico, reubicación y confirmación.
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t } = useI18n()

const ICONO: Record<ReglaPublicada, string> = {
  whole_weeks: 'i-lucide-calendar-range',
  turns: 'i-lucide-list-ordered',
  rotation: 'i-lucide-refresh-cw',
  peaks: 'i-lucide-sparkles',
  relocation: 'i-lucide-move-horizontal',
  confirmation: 'i-lucide-badge-check',
}
</script>

<template>
  <UPageSection
    :headline="t('scheduling.rules.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('scheduling.rules.description')"
    class="bg-elevated/40"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-reglas"
  >
    <div class="grid gap-10 lg:grid-cols-5 lg:items-start">
      <figure class="overflow-hidden rounded-2xl lg:col-span-2 lg:sticky lg:top-24">
        <NuxtImg
          :src="IMAGENES_DE_AGENDAMIENTO.hero"
          :alt="t(seccion.tituloKey)"
          class="aspect-[4/5] w-full object-cover"
          sizes="100vw sm:60vw lg:40vw"
          loading="lazy"
        />
      </figure>
      <ul class="grid gap-4 sm:grid-cols-2 lg:col-span-3">
        <li
          v-for="regla in REGLAS_PUBLICADAS"
          :key="regla"
          class="rounded-2xl border border-default bg-default p-5"
          :data-test="`regla-${regla}`"
        >
          <UIcon
            :name="ICONO[regla]"
            class="size-6 text-primary"
          />
          <h3 class="mt-3 font-display text-xl font-medium text-highlighted">
            {{ t(`scheduling.rules.${regla}.title`) }}
          </h3>
          <p class="mt-1 text-sm leading-relaxed text-muted">
            {{ t(`scheduling.rules.${regla}.description`) }}
          </p>
          <div
            v-if="regla === 'peaks'"
            class="mt-3 flex flex-wrap gap-1.5"
          >
            <UBadge
              v-for="bloque in BLOQUES_PICO_PUBLICADOS"
              :key="bloque"
              variant="subtle"
              size="sm"
              :label="t(`scheduling.rules.peakBlocks.${bloque}`)"
            />
          </div>
        </li>
      </ul>
    </div>
  </UPageSection>
</template>
