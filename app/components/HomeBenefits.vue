<script setup lang="ts">
import { BENEFICIOS, IMAGENES_DE_LA_HOME } from '#shared/content/home'
import type { Beneficio, SeccionDeLaHome } from '#shared/content/home'

/**
 * HU-00 · RF-00.4 — «Ocho dueños, cero preocupaciones»: los seis beneficios del
 * texto oficial junto a la imagen del apartamento dividido en ocho, y el botón a
 * la página de detalle (HU-42).
 */
defineProps<{ seccion: SeccionDeLaHome }>()
const emit = defineEmits<{ cta: [SeccionDeLaHome] }>()

const { t } = useI18n()
const localePath = useLocalePath()

const ICONO: Record<Beneficio, string> = {
  capital: 'i-lucide-pie-chart',
  income: 'i-lucide-banknote',
  ownership: 'i-lucide-key-round',
  weeks: 'i-lucide-calendar-days',
  management: 'i-lucide-building-2',
  transparency: 'i-lucide-scroll-text',
}
</script>

<template>
  <UPageSection
    :headline="t('home.benefits.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('home.benefits.description')"
    class="bg-elevated/40"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-beneficios"
  >
    <p class="mx-auto -mt-4 mb-10 max-w-3xl text-center text-base text-muted">
      {{ t('home.benefits.lead') }}
    </p>

    <div class="grid gap-10 lg:grid-cols-5 lg:items-start">
      <figure class="group overflow-hidden rounded-2xl lg:col-span-2 lg:sticky lg:top-24">
        <NuxtImg
          :src="IMAGENES_DE_LA_HOME.benefits"
          :alt="t(seccion.tituloKey)"
          class="aspect-[4/5] w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-105"
          sizes="100vw sm:60vw lg:40vw"
          loading="lazy"
        />
      </figure>

      <ul class="grid gap-6 sm:grid-cols-2 lg:col-span-3">
        <li
          v-for="beneficio in BENEFICIOS"
          :key="beneficio"
          class="group flex gap-4 rounded-2xl p-3 transition-colors duration-300 hover:bg-default"
          data-test="beneficio"
        >
          <span class="mt-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
            <UIcon
              :name="ICONO[beneficio]"
              class="size-5"
            />
          </span>
          <div>
            <h3 class="font-display text-xl font-medium text-highlighted">
              {{ t(`home.benefits.items.${beneficio}.title`) }}
            </h3>
            <p class="mt-1 text-sm text-muted">
              {{ t(`home.benefits.items.${beneficio}.description`) }}
            </p>
          </div>
        </li>
      </ul>
    </div>

    <div
      v-if="seccion.cta"
      class="mt-10 flex justify-center"
    >
      <UButton
        size="lg"
        variant="outline"
        :to="localePath(seccion.cta.destino)"
        :label="t(seccion.cta.labelKey)"
        trailing-icon="i-lucide-arrow-right"
        :data-test="`cta-${seccion.id}`"
        @click="emit('cta', seccion)"
      />
    </div>
  </UPageSection>
</template>
