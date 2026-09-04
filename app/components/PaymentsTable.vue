<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia } from '#shared/dates/formato'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { METODOS_DE_PAGO } from '#shared/payments/abonos'
import type { AbonoListado } from '#shared/payments/vistas'

/**
 * HU-58 · RF-58.2, RF-58.5 — los abonos de un plan.
 *
 * Un abono anulado sigue en la tabla, marcado y con su motivo: no desaparece,
 * porque el histórico de lo que se registró es parte de la honestidad del dato
 * (principio 9). Anular se ofrece solo sobre abonos vigentes de un plan abierto.
 */
const props = defineProps<{
  abonos: AbonoListado[]
  puedeGestionar: boolean
  /** El plan admite cambios: no está anulado. */
  abierto: boolean
}>()

defineEmits<{ anular: [string] }>()

const { t, locale } = useI18n()

function importe(abono: AbonoListado): string {
  return formatearImporte(abono.amount, locale.value as Idioma)
}

function fecha(abono: AbonoListado): string {
  return formatearDia(abono.paidOn, locale.value as Idioma)
}

function metodo(abono: AbonoListado): string {
  return (METODOS_DE_PAGO as readonly string[]).includes(abono.method)
    ? t(`payments.methods.${abono.method}`)
    : abono.method
}

function puedeAnular(abono: AbonoListado): boolean {
  return props.puedeGestionar && props.abierto && abono.voidedAt === null
}

const columnas = computed<TableColumn<AbonoListado>[]>(() => [
  { id: 'fecha', header: t('payments.paidOn') },
  { id: 'monto', header: t('payments.amount') },
  { id: 'metodo', header: t('payments.method') },
  { id: 'comprobante', header: t('payments.receipt') },
  { id: 'estado', header: '' },
  { id: 'acciones', header: '' },
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <UTable
      :data="abonos"
      :columns="columnas"
      :empty="t('payments.empty')"
      data-test="tabla-abonos"
    >
      <template #fecha-cell="{ row }">
        <span :class="row.original.voidedAt ? 'text-muted line-through' : ''">{{ fecha(row.original) }}</span>
      </template>

      <template #monto-cell="{ row }">
        <span
          class="font-mono"
          :class="row.original.voidedAt ? 'text-muted line-through' : ''"
          :data-test="`monto-abono-${row.original.id}`"
        >
          {{ importe(row.original) }}
        </span>
      </template>

      <template #metodo-cell="{ row }">
        <div class="flex flex-col">
          <span>{{ metodo(row.original) }}</span>
          <span
            v-if="row.original.note"
            class="text-xs text-muted"
          >{{ row.original.note }}</span>
        </div>
      </template>

      <template #comprobante-cell="{ row }">
        <UButton
          v-if="row.original.receiptUrl"
          :to="row.original.receiptUrl"
          target="_blank"
          rel="noopener"
          variant="link"
          size="xs"
          icon="i-lucide-file-text"
          :label="t('payments.openReceipt')"
          :data-test="`comprobante-${row.original.id}`"
        />
      </template>

      <template #estado-cell="{ row }">
        <UBadge
          v-if="row.original.voidedAt"
          color="error"
          variant="subtle"
          size="sm"
          :label="t('payments.voided')"
          :title="row.original.voidReason ?? ''"
          :data-test="`anulado-${row.original.id}`"
        />
      </template>

      <template #acciones-cell="{ row }">
        <div class="flex justify-end">
          <UButton
            v-if="puedeAnular(row.original)"
            variant="ghost"
            color="error"
            size="xs"
            :label="t('payments.void')"
            :data-test="`anular-abono-${row.original.id}`"
            @click="$emit('anular', row.original.id)"
          />
        </div>
      </template>
    </UTable>
  </div>
</template>
