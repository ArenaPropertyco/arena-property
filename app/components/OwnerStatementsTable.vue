<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearMes } from '#shared/dates/formato'
import { colorDeSaldo } from '#shared/finance/billetera'
import type { OwnerStatementListed } from '#shared/finance/vistas'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'

/**
 * HU-62 · RF-62.4 · RF-62.5 · RF-62.14 · TR-02 — los cortes mensuales del
 * Propietario, ya filtrados por `shared/finance/billetera`: el mes, la propiedad
 * y la fracción, ingresos, gastos y neto con su color, y la marca de que trae
 * ajustes de meses anteriores.
 */
defineProps<{ cortes: OwnerStatementListed[] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

function importe(valor: CopAmount): string {
  return formatearImporte(valor, idioma.value)
}

function claseDeNeto(neto: CopAmount): string {
  const color = colorDeSaldo(neto, true)
  return color === 'neutral' ? 'text-muted' : `text-${color}`
}

const columnas = computed<TableColumn<OwnerStatementListed>[]>(() => [
  { id: 'periodo', header: t('ownerWallet.statements.columns.period') },
  { id: 'ingresos', header: t('ownerWallet.statements.columns.income'), meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'gastos', header: t('ownerWallet.statements.columns.expenses'), meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'neto', header: t('ownerWallet.statements.columns.net'), meta: { class: { th: 'text-right', td: 'text-right' } } },
])
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="cortes.length === 0"
      class="text-sm text-muted"
      data-test="sin-cortes"
    >
      {{ t('ownerWallet.statements.empty') }}
    </p>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="cortes"
        :columns="columnas"
        data-test="tabla-cortes"
      >
        <template #periodo-cell="{ row }">
          <div
            class="flex flex-col gap-1"
            :data-test="`corte-${row.original.id}`"
          >
            <span class="text-highlighted">{{ formatearMes(row.original.period, idioma) }}</span>
            <span class="text-xs text-muted">{{ row.original.propertyName }} · {{ t('ownerWallet.statements.fractionLine', { fraction: row.original.fractionNumber }) }}</span>
            <UBadge
              v-if="row.original.hasAdjustments"
              color="warning"
              variant="subtle"
              size="xs"
              :label="t('ownerWallet.statements.adjustment')"
              :data-test="`ajuste-${row.original.id}`"
            />
          </div>
        </template>

        <template #ingresos-cell="{ row }">
          <span class="font-mono text-default">{{ importe(row.original.income) }}</span>
        </template>

        <template #gastos-cell="{ row }">
          <span class="font-mono text-default">{{ importe(row.original.expenses) }}</span>
        </template>

        <template #neto-cell="{ row }">
          <span
            class="font-mono"
            :class="claseDeNeto(row.original.net)"
            :data-test="`neto-${row.original.id}`"
          >{{ importe(row.original.net) }}</span>
        </template>
      </UTable>
    </div>
  </div>
</template>
