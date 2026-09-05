<script setup lang="ts">
import { IMAGENES_DE_LA_HOME, PILARES_DEL_MODELO } from '#shared/content/home'
import type { PilarDelModelo, SeccionDeLaHome } from '#shared/content/home'

/**
 * HU-00 · RF-00.3 — el modelo de negocio en corto: los tres pilares del sitio
 * oficial y el botón a la página de detalle (HU-41). El destino lo trae el
 * manifiesto; el evento `cta` lo registra la página en analítica (RF-00.8).
 */
defineProps<{ seccion: SeccionDeLaHome }>()
const emit = defineEmits<{ cta: [SeccionDeLaHome] }>()

const { t } = useI18n()
const localePath = useLocalePath()

const ICONO: Record<PilarDelModelo, string> = {
  owner: 'i-lucide-landmark',
  price: 'i-lucide-coins',
  carefree: 'i-lucide-concierge-bell',
}
</script>

<template>
  <UPageSection
    :headline="t('home.model.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('home.model.description')"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-modelo"
  >
    <div class="grid gap-10 lg:grid-cols-5 lg:items-center">
      <div class="order-2 grid gap-4 sm:grid-cols-3 lg:order-1 lg:col-span-3 lg:grid-cols-1">
        <UPageCard
          v-for="pilar in PILARES_DEL_MODELO"
          :key="pilar"
          :icon="ICONO[pilar]"
          :title="t(`home.model.pillars.${pilar}.title`)"
          :description="t(`home.model.pillars.${pilar}.description`)"
          variant="subtle"
          orientation="horizontal"
          :ui="{ title: 'font-display text-xl font-medium' }"
          data-test="pilar"
        />
      </div>

      <figure class="order-1 overflow-hidden rounded-2xl lg:order-2 lg:col-span-2">
        <NuxtImg
          :src="IMAGENES_DE_LA_HOME.model"
          :alt="t('home.model.pillars.owner.title')"
          class="aspect-[4/5] w-full object-cover"
          sizes="100vw sm:60vw lg:40vw"
          loading="lazy"
        />
      </figure>
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
