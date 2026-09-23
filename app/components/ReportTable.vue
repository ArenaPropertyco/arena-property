<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { FilaDeReporte } from '#shared/finance/reportes'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'

/**
 * HU-25 · RF-25.1, RF-25.2 — las filas del reporte, en el mismo orden y con las
 * mismas columnas que el archivo CSV (CA-25.4): salen del mismo reporte.
 */
defineProps<{ filas: FilaDeReporte[] }>()

const { t, locale } = useI18n()

function importe(fila: FilaDeReporte): string {
  return formatearImporte(fila.total, locale.value as Idioma)
}

const columnas = computed<TableColumn<FilaDeReporte>[]>(() => [
  { id: 'libro', header: t('reports.columns.book') },
  { accessorKey: 'propertyName', header: t('reports.columns.property') },
  { id: 'clase', header: t('reports.columns.kind') },
  { accessorKey: 'categoryName', header: t('reports.columns.category') },
  { accessorKey: 'paymentMethodName', header: t('reports.columns.method') },
  { id: 'total', header: t('reports.columns.total') },
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <UTable
      :data="filas"
      :columns="columnas"
      :empty="t('reports.empty')"
      data-test="tabla-reporte"
    >
      <template #libro-cell="{ row }">
        <UBadge
          :color="row.original.libro === 'platform' ? 'primary' : 'neutral'"
          variant="subtle"
          size="sm"
          :label="t(`reports.books.${row.original.libro}`)"
        />
      </template>
      <template #clase-cell="{ row }">
        <span :class="row.original.kind === 'income' ? 'text-success' : 'text-default'">
          {{ t(`reports.kinds.${row.original.kind}`) }}
        </span>
      </template>
      <template #total-cell="{ row }">
        <span class="font-mono whitespace-nowrap">{{ importe(row.original) }}</span>
      </template>
    </UTable>
  </div>
</template>
