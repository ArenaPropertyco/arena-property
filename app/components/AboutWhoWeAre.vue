<script setup lang="ts">
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { FRENTES, IMAGENES_DE_NOSOTROS } from '#shared/content/nosotros'

/**
 * HU-44 · RF-44.1 — quiénes somos: qué hace Arena y desde dónde lo hace.
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t } = useI18n()
</script>

<template>
  <UPageSection
    :headline="t('about.whoWeAre.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('about.whoWeAre.description')"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-quienes-somos"
  >
    <div class="grid gap-10 lg:grid-cols-5 lg:items-center">
      <figure class="overflow-hidden rounded-2xl lg:col-span-2">
        <NuxtImg
          :src="IMAGENES_DE_NOSOTROS.whoWeAre"
          :alt="t(seccion.tituloKey)"
          class="aspect-[4/5] w-full object-cover"
          sizes="100vw sm:60vw lg:40vw"
          loading="lazy"
        />
      </figure>
      <div class="space-y-6 lg:col-span-3">
        <ul class="grid gap-4 sm:grid-cols-3">
          <li
            v-for="frente in FRENTES"
            :key="frente"
            class="rounded-2xl border border-default bg-default p-5"
            data-test="frente"
          >
            <h3 class="font-display text-xl font-medium text-highlighted">
              {{ t(`about.whoWeAre.fronts.${frente}.title`) }}
            </h3>
            <p class="mt-1 text-sm text-muted">
              {{ t(`about.whoWeAre.fronts.${frente}.description`) }}
            </p>
          </li>
        </ul>
        <p class="border-l-2 border-primary pl-4 font-display text-xl text-highlighted">
          {{ t('about.whoWeAre.founder') }}
        </p>
      </div>
    </div>
  </UPageSection>
</template>
