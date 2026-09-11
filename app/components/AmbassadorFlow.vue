<script setup lang="ts">
import { CIFRAS_DEL_PROGRAMA, PASOS_DEL_PROGRAMA } from '#shared/content/embajadores'
import type { PasoDelPrograma } from '#shared/content/embajadores'
import type { SeccionDePagina } from '#shared/content/manifiesto'

/**
 * HU-48 · RF-48.1 — el flujo del programa en cuatro pasos: refiero, mi referido
 * compra, paga la totalidad, se libera mi comisión. Las cifras de ventana y
 * gracia salen del dominio, no del texto.
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t } = useI18n()

const ICONO: Record<PasoDelPrograma, string> = {
  refer: 'i-lucide-share-2',
  purchase: 'i-lucide-file-signature',
  pay: 'i-lucide-badge-check',
  release: 'i-lucide-wallet',
}

const DIAS: Record<PasoDelPrograma, number> = {
  refer: CIFRAS_DEL_PROGRAMA.ventanaDias,
  purchase: 0,
  pay: 0,
  release: CIFRAS_DEL_PROGRAMA.graciaDias,
}
</script>

<template>
  <UPageSection
    :headline="t('ambassadors.flow.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('ambassadors.flow.description')"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-flujo"
  >
    <ol class="grid gap-4 md:grid-cols-4">
      <li
        v-for="(paso, indice) in PASOS_DEL_PROGRAMA"
        :key="paso"
        class="relative rounded-2xl border border-default bg-default p-6"
        :data-test="`paso-${paso}`"
      >
        <span class="font-mono text-xs text-muted">0{{ indice + 1 }}</span>
        <UIcon
          :name="ICONO[paso]"
          class="mt-3 size-7 text-primary"
        />
        <h3 class="mt-4 font-display text-2xl font-medium text-highlighted">
          {{ t(`ambassadors.flow.steps.${paso}.title`) }}
        </h3>
        <p class="mt-2 text-sm leading-relaxed text-muted">
          {{ t(`ambassadors.flow.steps.${paso}.description`, { days: DIAS[paso] }) }}
        </p>
      </li>
    </ol>
  </UPageSection>
</template>
