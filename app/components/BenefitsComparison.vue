<script setup lang="ts">
import { COMPARATIVO, presentarCelda } from '#shared/content/beneficios'
import type { CeldaDelComparativo } from '#shared/content/beneficios'
import type { SeccionDePagina } from '#shared/content/manifiesto'
import type { Idioma } from '#shared/money/formato'
import { colorDeCondicion } from '#shared/money/presentacion'

/**
 * HU-42 · RF-42.1…RF-42.3 · TR-02 RF-D.6 — el comparativo renta tradicional
 * frente a fracción. Recibe la estructura tipada y solo traduce la condición de
 * cada celda al color de marca: verde confirmado, rojo estimado. En móvil cada
 * fila se apila con su encabezado, para leerse desde 320 px (RT-06).
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

function celda(valor: CeldaDelComparativo) {
  return presentarCelda(valor, idioma.value)
}
</script>

<template>
  <UPageSection
    :headline="t('benefits.comparison.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('benefits.comparison.description')"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-comparativo"
  >
    <div
      class="overflow-hidden rounded-2xl border border-default bg-default"
      role="table"
      data-test="comparativo"
    >
      <div
        class="hidden grid-cols-3 gap-4 border-b border-default bg-elevated/50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted sm:grid"
        role="row"
      >
        <span role="columnheader">{{ t('benefits.comparison.columns.criterion') }}</span>
        <span role="columnheader">{{ t('benefits.comparison.columns.traditional') }}</span>
        <span
          role="columnheader"
          class="text-primary"
        >{{ t('benefits.comparison.columns.fractional') }}</span>
      </div>

      <div
        v-for="fila in COMPARATIVO"
        :key="fila.id"
        class="grid gap-3 border-b border-default px-5 py-5 last:border-b-0 sm:grid-cols-3 sm:gap-4 sm:py-4"
        role="row"
        :data-test="`fila-${fila.id}`"
      >
        <p
          class="font-display text-xl font-medium text-highlighted sm:text-lg"
          role="rowheader"
        >
          {{ t(fila.labelKey) }}
        </p>

        <div
          v-for="columna in (['traditional', 'fractional'] as const)"
          :key="columna"
          class="space-y-1"
          role="cell"
          :data-test="`celda-${fila.id}-${columna}`"
        >
          <p class="text-[11px] uppercase tracking-[0.2em] text-muted sm:hidden">
            {{ t(`benefits.comparison.columns.${columna}`) }}
          </p>
          <p
            v-if="celda(fila[columna]).texto"
            class="font-mono text-lg"
            :class="celda(fila[columna]).esConfirmado ? 'text-success' : 'text-error'"
          >
            {{ celda(fila[columna]).texto }}
          </p>
          <p
            v-else
            class="text-sm text-default"
          >
            {{ t(celda(fila[columna]).textoKey ?? '') }}
          </p>
          <UBadge
            :color="colorDeCondicion(celda(fila[columna]).condicion)"
            variant="subtle"
            size="xs"
            :label="celda(fila[columna]).esConfirmado ? t('benefits.comparison.legend.confirmed') : t('benefits.comparison.legend.estimated')"
            :data-test="`condicion-${fila.id}-${columna}`"
          />
        </div>
      </div>
    </div>
  </UPageSection>
</template>
