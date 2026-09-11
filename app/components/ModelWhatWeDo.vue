<script setup lang="ts">
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { LO_QUE_HACEMOS } from '#shared/content/modelo'
import type { LoQueHacemos } from '#shared/content/modelo'

/**
 * HU-41 · RF-41.1 — lo que Arena hace por cada inmueble: estructura,
 * comercializa y administra; y con qué gana.
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t } = useI18n()

const ICONO: Record<LoQueHacemos, string> = {
  structure: 'i-lucide-drafting-compass',
  commercialize: 'i-lucide-handshake',
  manage: 'i-lucide-concierge-bell',
}
</script>

<template>
  <UPageSection
    :headline="t('model.whatWeDo.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('model.whatWeDo.description')"
    class="bg-elevated/40"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-que-hacemos"
  >
    <ol class="grid gap-6 md:grid-cols-3">
      <li
        v-for="(frente, indice) in LO_QUE_HACEMOS"
        :key="frente"
        class="relative rounded-2xl border border-default bg-default p-6"
        data-test="frente"
      >
        <span class="font-mono text-xs text-muted">0{{ indice + 1 }}</span>
        <UIcon
          :name="ICONO[frente]"
          class="mt-3 size-7 text-primary"
        />
        <h3 class="mt-4 font-display text-2xl font-medium text-highlighted">
          {{ t(`model.whatWeDo.items.${frente}.title`) }}
        </h3>
        <p class="mt-2 text-sm leading-relaxed text-muted">
          {{ t(`model.whatWeDo.items.${frente}.description`) }}
        </p>
      </li>
    </ol>
    <p class="mx-auto mt-10 max-w-3xl text-center text-base text-default">
      {{ t('model.whatWeDo.partner') }}
    </p>
  </UPageSection>
</template>
