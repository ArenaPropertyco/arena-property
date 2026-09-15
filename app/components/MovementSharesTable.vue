<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CuotaListada } from '#shared/finance/vistas'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { sumarTodos } from '#shared/money/importe'

/**
 * HU-23 · RF-23.3, RF-23.6 · TR-02 RF-D.3 — las 8 cuotas de un movimiento.
 *
 * Las cuotas llegan generadas por la base; aquí solo se muestran, con la que
 * absorbió el residuo señalada y quién paga cada una (D-08). La suma que se
 * imprime la calcula `shared/money`, nunca la vista.
 */
const props = defineProps<{ cuotas: CuotaListada[] }>()

defineEmits<{ detalle: [string] }>()

const { t, locale } = useI18n()

const ordenadas = computed(() => [...props.cuotas].sort((a, b) => a.fraction - b.fraction))

const total = computed(() => formatearImporte(sumarTodos(props.cuotas.map(cuota => cuota.amount)), locale.value as Idioma))

function importe(cuota: CuotaListada): string {
  return formatearImporte(cuota.amount, locale.value as Idioma)
}

const columnas = computed<TableColumn<CuotaListada>[]>(() => [
  { id: 'fraccion', header: t('finance.shares.fraction') },
  { id: 'monto', header: t('finance.shares.amount') },
  { id: 'pagador', header: t('finance.shares.payer') },
  { id: 'estado', header: '' },
  { id: 'acciones', header: '' },
])
</script>

<template>
  <div class="space-y-3">
    <div class="overflow-x-auto rounded-lg border border-default">
      <UTable
        :data="ordenadas"
        :columns="columnas"
        data-test="tabla-cuotas"
      >
        <template #fraccion-cell="{ row }">
          <span
            class="font-mono"
            :data-test="`cuota-${row.original.fraction}`"
          >
            {{ t('properties.fractions.label', { number: row.original.fraction }) }}
            <span class="sr-only">{{ importe(row.original) }}</span>
          </span>
        </template>

        <template #monto-cell="{ row }">
          <span
            class="font-mono"
            :class="row.original.reversedAt ? 'text-muted line-through' : ''"
          >
            {{ importe(row.original) }}
          </span>
        </template>

        <template #pagador-cell="{ row }">
          <span :data-test="`pagador-${row.original.fraction}`">
            {{ row.original.payer === 'owner' && row.original.payerLabel
              ? row.original.payerLabel
              : t(`finance.shares.${row.original.payer}`) }}
          </span>
        </template>

        <template #estado-cell="{ row }">
          <div class="flex flex-wrap justify-end gap-1">
            <UBadge
              v-if="row.original.hasRemainder"
              color="primary"
              variant="subtle"
              size="sm"
              :label="t('finance.shares.remainder')"
              :title="t('finance.shares.remainderHint')"
              :data-test="`residuo-${row.original.fraction}`"
            />
            <UBadge
              v-if="row.original.reversedAt"
              color="error"
              variant="subtle"
              size="sm"
              :label="t('finance.shares.reversed')"
              :data-test="`revertida-${row.original.fraction}`"
            />
          </div>
        </template>

        <template #acciones-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              variant="ghost"
              size="xs"
              icon="i-lucide-calculator"
              :label="t('finance.detail.view')"
              :data-test="`detalle-${row.original.fraction}`"
              @click="$emit('detalle', row.original.id)"
            />
          </div>
        </template>
      </UTable>
    </div>

    <p class="flex items-center justify-between text-sm">
      <span class="text-muted">{{ t('finance.shares.total') }}</span>
      <span
        class="font-mono text-default"
        data-test="total-cuotas"
      >{{ total }}</span>
    </p>
  </div>
</template>
