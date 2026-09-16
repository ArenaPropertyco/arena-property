<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearMes } from '#shared/dates/formato'
import type { Mes, MesAgregado } from '#shared/finance/estado-de-cuenta'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'

/**
 * HU-19 · RF-19.2, RF-19.4 · TR-02 — el histórico mensual: ingresos, gastos y
 * neto de cada mes, con ceros donde no hubo nada (CA-19.3). Los meses llegan
 * agregados por `shared/finance/estado-de-cuenta`; elegir uno se emite para que
 * la página muestre su desglose.
 */
defineProps<{
  meses: MesAgregado[]
  seleccionado: Mes | null
}>()

defineEmits<{ seleccionar: [Mes] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

function importe(valor: CopAmount): string {
  return formatearImporte(valor, idioma.value)
}

const columnas = computed<TableColumn<MesAgregado>[]>(() => [
  { id: 'mes', header: t('statement.columns.month') },
  { id: 'ingresos', header: t('statement.columns.income') },
  { id: 'gastos', header: t('statement.columns.expenses') },
  { id: 'neto', header: t('statement.columns.net') },
  { id: 'acciones', header: '' },
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <UTable
      :data="meses"
      :columns="columnas"
      data-test="tabla-meses"
    >
      <template #mes-cell="{ row }">
        <span
          class="whitespace-nowrap"
          :class="row.original.mes === seleccionado ? 'font-medium text-highlighted' : ''"
          :data-test="`mes-${row.original.mes}`"
        >{{ formatearMes(row.original.mes, idioma) }}</span>
      </template>

      <template #ingresos-cell="{ row }">
        <span
          class="font-mono"
          :class="row.original.ingresos > 0 ? 'text-success' : 'text-muted'"
          :data-test="`ingresos-${row.original.mes}`"
        >{{ importe(row.original.ingresos) }}</span>
      </template>

      <template #gastos-cell="{ row }">
        <span
          class="font-mono"
          :class="row.original.gastos > 0 ? 'text-highlighted' : 'text-muted'"
          :data-test="`gastos-${row.original.mes}`"
        >{{ importe(row.original.gastos) }}</span>
      </template>

      <template #neto-cell="{ row }">
        <span
          class="font-mono"
          :class="row.original.neto < 0 ? 'text-error' : row.original.neto > 0 ? 'text-success' : 'text-muted'"
          :data-test="`neto-${row.original.mes}`"
        >{{ importe(row.original.neto) }}</span>
      </template>

      <template #acciones-cell="{ row }">
        <div class="flex justify-end">
          <UButton
            :variant="row.original.mes === seleccionado ? 'soft' : 'ghost'"
            size="xs"
            icon="i-lucide-list"
            :label="row.original.mes === seleccionado ? t('statement.selected') : t('statement.viewMonth')"
            :data-test="`ver-mes-${row.original.mes}`"
            @click="$emit('seleccionar', row.original.mes)"
          />
        </div>
      </template>
    </UTable>
  </div>
</template>
