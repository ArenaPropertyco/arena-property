<script setup lang="ts">
import { CIFRAS_DEL_PROGRAMA, CONDICIONES_DEL_PROGRAMA } from '#shared/content/embajadores'
import type { CondicionDelPrograma } from '#shared/content/embajadores'
import type { SeccionDePagina } from '#shared/content/manifiesto'

/**
 * HU-48 · RF-48.3 — las condiciones del programa resumidas: las decisiones
 * vigentes (D-02, D-03, D-04, D-06) y quién puede inscribirse (HU-49).
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t } = useI18n()

const DIAS: Partial<Record<CondicionDelPrograma, number>> = {
  window: CIFRAS_DEL_PROGRAMA.ventanaDias,
  grace: CIFRAS_DEL_PROGRAMA.graciaDias,
}
</script>

<template>
  <UPageSection
    :headline="t('ambassadors.terms.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('ambassadors.terms.description')"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-condiciones"
  >
    <ul class="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="condicion in CONDICIONES_DEL_PROGRAMA"
        :key="condicion"
        class="flex gap-4 rounded-2xl border border-default bg-default p-5"
        :data-test="`condicion-${condicion}`"
      >
        <UIcon
          name="i-lucide-check-circle-2"
          class="mt-0.5 size-5 shrink-0 text-success"
        />
        <div>
          <h3 class="font-display text-xl font-medium text-highlighted">
            {{ t(`ambassadors.terms.items.${condicion}.title`, { days: DIAS[condicion] ?? 0 }) }}
          </h3>
          <p class="mt-1 text-sm text-muted">
            {{ t(`ambassadors.terms.items.${condicion}.description`, { days: DIAS[condicion] ?? 0 }) }}
          </p>
        </div>
      </li>
    </ul>
  </UPageSection>
</template>
