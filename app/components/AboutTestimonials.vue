<script setup lang="ts">
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { TESTIMONIOS } from '#shared/content/nosotros'

/**
 * HU-44 · RF-44.1, RF-44.2 — testimonios iterados desde la estructura tipada.
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t } = useI18n()
</script>

<template>
  <UPageSection
    :headline="t('about.testimonials.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('about.testimonials.description')"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-testimonios"
  >
    <div class="grid gap-6 md:grid-cols-3">
      <blockquote
        v-for="testimonio in TESTIMONIOS"
        :key="testimonio.id"
        class="flex flex-col rounded-2xl border border-default bg-default p-6"
        :data-test="`testimonio-${testimonio.id}`"
      >
        <UIcon
          name="i-lucide-quote"
          class="size-6 text-primary"
        />
        <p class="mt-4 flex-1 font-display text-xl leading-relaxed text-highlighted">
          {{ t(testimonio.citaKey) }}
        </p>
        <footer class="mt-6 text-sm">
          <p class="font-medium text-default">
            {{ t(testimonio.autorKey) }}
          </p>
          <p class="text-muted">
            {{ t(testimonio.rolKey) }}
          </p>
        </footer>
      </blockquote>
    </div>
  </UPageSection>
</template>
