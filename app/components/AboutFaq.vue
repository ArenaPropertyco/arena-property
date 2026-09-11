<script setup lang="ts">
import type { AccordionItem } from '@nuxt/ui'
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { PREGUNTAS_FRECUENTES } from '#shared/content/nosotros'

/**
 * HU-44 · RF-44.1, RF-44.2 — preguntas frecuentes en acordeón, iteradas desde
 * la estructura tipada. `UAccordion` trae teclado y móvil resueltos.
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t } = useI18n()

const items = computed<AccordionItem[]>(() => PREGUNTAS_FRECUENTES.map(pregunta => ({
  value: pregunta.id,
  label: t(pregunta.preguntaKey),
  content: t(pregunta.respuestaKey),
})))
</script>

<template>
  <UPageSection
    :headline="t('about.faq.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('about.faq.description')"
    class="bg-elevated/40"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-faq"
  >
    <UAccordion
      :items="items"
      type="multiple"
      class="mx-auto max-w-3xl rounded-2xl border border-default bg-default px-5"
      :ui="{ trigger: 'font-display text-lg text-highlighted py-4', body: 'text-sm text-muted leading-relaxed pb-4' }"
      data-test="acordeon-faq"
    />
  </UPageSection>
</template>
