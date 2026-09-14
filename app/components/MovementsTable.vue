<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia } from '#shared/dates/formato'
import type { MovimientoListado } from '#shared/finance/vistas'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'

/**
 * HU-23 · RF-23.2, RF-23.4, RF-23.7 — los gastos comunes de una propiedad.
 *
 * Un gasto anulado sigue en la tabla, marcado y con su motivo: el histórico de lo
 * registrado es parte de la honestidad del dato (principio 9). Anular se ofrece
 * solo a quien gestiona la propiedad y sobre gastos vigentes; ver las cuotas, a
 * cualquiera que pueda ver la lista.
 */
const props = defineProps<{
  movimientos: MovimientoListado[]
  puedeGestionar: boolean
}>()

defineEmits<{
  verCuotas: [string]
  anular: [string]
}>()

const { t, locale } = useI18n()

function importe(movimiento: MovimientoListado): string {
  return formatearImporte(movimiento.amount, locale.value as Idioma)
}

function fecha(movimiento: MovimientoListado): string {
  return formatearDia(movimiento.incurredOn, locale.value as Idioma)
}

function puedeAnular(movimiento: MovimientoListado): boolean {
  return props.puedeGestionar && movimiento.voidedAt === null
}

const columnas = computed<TableColumn<MovimientoListado>[]>(() => [
  { id: 'fecha', header: t('finance.columns.date') },
  { id: 'concepto', header: t('finance.columns.concept') },
  { id: 'monto', header: t('finance.columns.amount') },
  { id: 'medio', header: t('finance.columns.method') },
  { id: 'estado', header: '' },
  { id: 'acciones', header: '' },
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <UTable
      :data="movimientos"
      :columns="columnas"
      :empty="t('finance.empty')"
      data-test="tabla-movimientos"
    >
      <template #fecha-cell="{ row }">
        <span
          class="whitespace-nowrap"
          :class="row.original.voidedAt ? 'text-muted line-through' : ''"
        >{{ fecha(row.original) }}</span>
      </template>

      <template #concepto-cell="{ row }">
        <div class="flex flex-col gap-1">
          <span :class="row.original.voidedAt ? 'text-muted line-through' : ''">{{ row.original.description }}</span>
          <span class="flex flex-wrap items-center gap-1 text-xs text-muted">
            {{ row.original.categoryName }}
            <!-- RF-23.8 · D-41 · el reparto se ve: quién carga con el gasto no es un detalle. -->
            <UBadge
              :color="row.original.allocation === 'single_fraction' ? 'warning' : 'neutral'"
              variant="subtle"
              size="xs"
              :label="row.original.allocation === 'single_fraction'
                ? t('finance.allocation.badgeSingle', { number: row.original.fractionNumber ?? '' })
                : t('finance.allocation.badgeProrated')"
              :data-test="`reparto-${row.original.id}`"
            />
          </span>
        </div>
      </template>

      <template #monto-cell="{ row }">
        <span
          class="font-mono"
          :class="row.original.voidedAt ? 'text-muted line-through' : ''"
          :data-test="`monto-movimiento-${row.original.id}`"
        >
          {{ importe(row.original) }}
        </span>
      </template>

      <template #medio-cell="{ row }">
        <div class="flex flex-col text-sm">
          <span>{{ row.original.paymentMethodName }}</span>
          <span class="text-xs text-muted">{{ row.original.accountName }}</span>
        </div>
      </template>

      <template #estado-cell="{ row }">
        <UBadge
          v-if="row.original.voidedAt"
          color="error"
          variant="subtle"
          size="sm"
          :label="t('finance.voided')"
          :title="row.original.voidReason ?? ''"
          :data-test="`anulado-${row.original.id}`"
        />
      </template>

      <template #acciones-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton
            variant="ghost"
            size="xs"
            icon="i-lucide-list-ordered"
            :label="t('finance.shares.view')"
            :data-test="`ver-cuotas-${row.original.id}`"
            @click="$emit('verCuotas', row.original.id)"
          />
          <UButton
            v-if="puedeAnular(row.original)"
            variant="ghost"
            color="error"
            size="xs"
            :label="t('finance.void')"
            :data-test="`anular-movimiento-${row.original.id}`"
            @click="$emit('anular', row.original.id)"
          />
        </div>
      </template>
    </UTable>
  </div>
</template>
