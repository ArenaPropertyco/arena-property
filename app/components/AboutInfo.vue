<script setup lang="ts">
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { INFORMACION_DE_INTERES } from '#shared/content/nosotros'
import type { InformacionDeInteres } from '#shared/content/nosotros'

/**
 * HU-44 · RF-44.1, RF-44.3 — información de interés y el CTA al registro que
 * cierra la página. El destino lo trae el manifiesto; el evento lo registra la
 * página en analítica.
 */
defineProps<{ seccion: SeccionDePagina }>()
const emit = defineEmits<{ cta: [SeccionDePagina, string] }>()

const { t } = useI18n()
const localePath = useLocalePath()

const ICONO: Record<InformacionDeInteres, string> = {
  trust: 'i-lucide-shield-check',
  company: 'i-lucide-briefcase',
  operator: 'i-lucide-concierge-bell',
  expenses: 'i-lucide-receipt',
  transfer: 'i-lucide-arrow-left-right',
}
</script>

<template>
  <UPageSection
    :headline="t('about.info.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('about.info.description')"
    class="bg-elevated/40"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-informacion"
  >
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <UPageCard
        v-for="item in INFORMACION_DE_INTERES"
        :key="item"
        :icon="ICONO[item]"
        :title="t(`about.info.items.${item}.title`)"
        :description="t(`about.info.items.${item}.description`)"
        variant="subtle"
        :ui="{ title: 'font-display text-lg font-medium' }"
        data-test="dato-de-interes"
      />
    </div>

    <div
      v-if="seccion.cta"
      class="mt-12 flex flex-col items-center gap-4 text-center"
    >
      <p class="max-w-xl text-base text-default">
        {{ t('about.info.ctaDescription') }}
      </p>
      <UButton
        size="xl"
        :to="localePath(seccion.cta.destino)"
        :label="t(seccion.cta.labelKey)"
        trailing-icon="i-lucide-arrow-right"
        :data-test="`cta-${seccion.id}`"
        @click="emit('cta', seccion, seccion.cta.destino)"
      />
    </div>
  </UPageSection>
</template>
