<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { GrupoDeCategoria, NaturalezaDeLinea } from '#shared/finance/estado-de-cuenta'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'

/**
 * HU-19 · RF-19.1, RF-19.3, RF-19.4 · D-39, D-41 · TR-02 — el desglose del mes por
 * categoría, con cada naturaleza rotulada como lo que es.
 *
 * Los grupos llegan armados por `shared/finance/estado-de-cuenta`; aquí se
 * presentan con la tipografía de cifras y cada línea ofrece su detalle (HU-24),
 * que la página abre. No se suma ni se divide nada.
 */
defineProps<{ grupos: GrupoDeCategoria[] }>()

defineEmits<{ detalle: [string] }>()

const { t, locale } = useI18n()

const COLOR_DE_NATURALEZA: Record<NaturalezaDeLinea, 'neutral' | 'success' | 'warning'> = {
  prorated: 'neutral',
  attributed: 'success',
  imputed: 'warning',
}

const idioma = computed(() => locale.value as Idioma)

function importe(valor: CopAmount): string {
  return formatearImporte(valor, idioma.value)
}
</script>

<template>
  <div class="space-y-4">
    <p
      v-if="grupos.length === 0"
      class="text-sm text-muted"
      data-test="sin-lineas"
    >
      {{ t('statement.noLines') }}
    </p>

    <section
      v-for="grupo in grupos"
      :key="`${grupo.kind}-${grupo.naturaleza}-${grupo.categoryName}`"
      class="rounded-2xl border border-default bg-default"
      :data-test="`grupo-${grupo.kind}-${grupo.naturaleza}`"
    >
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
        <div class="flex flex-wrap items-center gap-2">
          <h4 class="text-sm font-medium text-highlighted">
            {{ grupo.categoryName }}
          </h4>
          <UBadge
            :color="COLOR_DE_NATURALEZA[grupo.naturaleza]"
            variant="subtle"
            size="sm"
            :label="t(`statement.nature.${grupo.naturaleza}`)"
          />
        </div>
        <p class="text-sm">
          <span class="text-muted">{{ t('statement.groupTotal') }}</span>
          <span
            class="ml-2 font-mono"
            :class="grupo.kind === 'income' ? 'text-success' : 'text-highlighted'"
          >{{ importe(grupo.total) }}</span>
        </p>
      </header>

      <ul class="divide-y divide-default">
        <li
          v-for="linea in grupo.lineas"
          :key="linea.shareId"
          class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
          :data-test="`linea-${linea.shareId}`"
        >
          <div class="min-w-0 flex-1">
            <p class="text-default">
              {{ linea.description }}
            </p>
            <p class="text-xs text-muted">
              {{ linea.propertyName }} · {{ formatearDia(linea.incurredOn, idioma) }} ·
              <span :data-test="`naturaleza-${linea.shareId}`">{{ t(`statement.nature.${grupo.naturaleza}`) }}</span>
            </p>
          </div>
          <span
            class="font-mono"
            :class="linea.kind === 'income' ? 'text-success' : 'text-highlighted'"
            :data-test="`importe-${linea.shareId}`"
          >{{ importe(linea.amount) }}</span>
          <UButton
            variant="ghost"
            size="xs"
            icon="i-lucide-calculator"
            :label="t('finance.detail.view')"
            :data-test="`detalle-${linea.shareId}`"
            @click="$emit('detalle', linea.shareId)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
