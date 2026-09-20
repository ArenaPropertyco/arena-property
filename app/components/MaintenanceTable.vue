<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia } from '#shared/dates/formato'
import type { MovimientoListado } from '#shared/finance/vistas'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'

/**
 * HU-27 · RF-27.1, RF-27.2 · HU-28 · RF-28.1 — los mantenimientos de una
 * propiedad, con o sin ítem, tal como los dejó HU-23: un mantenimiento anulado
 * sigue en la lista, marcado. La factura se abre por su URL firmada, si existe.
 */
defineProps<{ movimientos: MovimientoListado[] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const columnas = computed<TableColumn<MovimientoListado>[]>(() => [
  { id: 'fecha', header: t('inventory.maintenance.columns.date') },
  { id: 'concepto', header: t('inventory.maintenance.columns.concept') },
  { id: 'item', header: t('inventory.maintenance.columns.item') },
  { id: 'monto', header: t('inventory.maintenance.columns.amount') },
  { id: 'factura', header: t('inventory.maintenance.columns.attachment') },
])
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="movimientos.length === 0"
      class="text-sm text-muted"
      data-test="sin-mantenimientos"
    >
      {{ t('inventory.maintenance.empty') }}
    </p>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="movimientos"
        :columns="columnas"
        data-test="tabla-mantenimientos"
      >
        <template #fecha-cell="{ row }">
          <span class="whitespace-nowrap">{{ formatearDia(row.original.incurredOn, idioma) }}</span>
        </template>

        <template #concepto-cell="{ row }">
          <div
            class="flex flex-col gap-1"
            :data-test="`mantenimiento-${row.original.id}`"
          >
            <span
              class="text-highlighted"
              :class="row.original.voidedAt ? 'line-through text-muted' : ''"
            >{{ row.original.description }}</span>
            <span class="text-xs text-muted">{{ row.original.categoryName }}</span>
            <UBadge
              v-if="row.original.voidedAt"
              color="error"
              variant="subtle"
              size="sm"
              class="w-fit"
              :label="t('finance.voided')"
              :data-test="`anulado-${row.original.id}`"
            />
          </div>
        </template>

        <template #item-cell="{ row }">
          <span
            :class="row.original.inventoryItemName ? '' : 'text-muted'"
            :data-test="`item-${row.original.id}`"
          >{{ row.original.inventoryItemName ?? t('inventory.maintenance.general') }}</span>
        </template>

        <template #monto-cell="{ row }">
          <span
            class="whitespace-nowrap font-mono"
            :class="row.original.voidedAt ? 'line-through text-muted' : ''"
            :data-test="`monto-${row.original.id}`"
          >{{ formatearImporte(row.original.amount, idioma) }}</span>
        </template>

        <template #factura-cell="{ row }">
          <UButton
            v-if="row.original.attachmentUrl"
            variant="link"
            size="xs"
            icon="i-lucide-file-text"
            :to="row.original.attachmentUrl"
            target="_blank"
            :label="t('inventory.maintenance.viewAttachment')"
            :data-test="`factura-${row.original.id}`"
          />
          <span
            v-else
            class="text-xs text-muted"
          >{{ t('inventory.maintenance.noAttachment') }}</span>
        </template>
      </UTable>
    </div>
  </div>
</template>
