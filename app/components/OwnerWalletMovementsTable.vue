<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia, formatearMes } from '#shared/dates/formato'
import type { OwnerWalletEntry, OwnerWalletEntryKind } from '#shared/finance/billetera'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { CERO, restar } from '#shared/money/importe'

/**
 * HU-62 · RF-62.2 · RF-62.14 · TR-02 — el histórico de la billetera del
 * Propietario, ya ordenado y filtrado por `shared/finance/billetera`. Cada fila
 * lleva el tipo, la fecha, la propiedad (con la fracción y el mes si es un
 * corte) y el monto con el signo de su efecto en el saldo.
 */
defineProps<{ movimientos: OwnerWalletEntry[] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const COLOR_DE_TIPO: Record<OwnerWalletEntryKind, 'info' | 'success' | 'neutral'> = {
  statement_closed: 'info',
  payment_confirmed: 'success',
  withdrawal_paid: 'neutral',
}

function monto(movimiento: OwnerWalletEntry): string {
  if (movimiento.amount < 0) {
    return `−${formatearImporte(restar(CERO, movimiento.amount), idioma.value)}`
  }
  return `${movimiento.amount > 0 ? '+' : ''}${formatearImporte(movimiento.amount, idioma.value)}`
}

function claseDeMonto(movimiento: OwnerWalletEntry): string {
  return movimiento.amount > 0 ? 'text-success' : movimiento.amount < 0 ? 'text-error' : 'text-default'
}

function detalle(movimiento: OwnerWalletEntry): string {
  return movimiento.period && movimiento.fractionNumber !== null
    ? t('ownerWallet.movements.periodLine', { fraction: movimiento.fractionNumber, period: formatearMes(movimiento.period, idioma.value) })
    : ''
}

const columnas = computed<TableColumn<OwnerWalletEntry>[]>(() => [
  { id: 'tipo', header: t('ownerWallet.movements.columns.kind') },
  { id: 'fecha', header: t('ownerWallet.movements.columns.date') },
  { id: 'propiedad', header: t('ownerWallet.movements.columns.property') },
  { id: 'monto', header: t('ownerWallet.movements.columns.amount'), meta: { class: { th: 'text-right', td: 'text-right' } } },
])
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="movimientos.length === 0"
      class="text-sm text-muted"
      data-test="sin-movimientos-propietario"
    >
      {{ t('ownerWallet.movements.empty') }}
    </p>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="movimientos"
        :columns="columnas"
        data-test="tabla-billetera-propietario"
      >
        <template #tipo-cell="{ row }">
          <div
            class="flex flex-col gap-1"
            :data-test="`movimiento-${row.original.id}`"
          >
            <UBadge
              :color="COLOR_DE_TIPO[row.original.kind]"
              variant="subtle"
              size="sm"
              :label="t(`ownerWallet.movements.kinds.${row.original.kind}`)"
            />
            <span class="text-xs text-muted sm:hidden">{{ formatearDia(row.original.occurredOn, idioma) }}</span>
            <span class="text-xs text-muted sm:hidden">{{ row.original.propertyName }}</span>
          </div>
        </template>

        <template #fecha-cell="{ row }">
          <span class="whitespace-nowrap">{{ formatearDia(row.original.occurredOn, idioma) }}</span>
        </template>

        <template #propiedad-cell="{ row }">
          <div class="flex flex-col">
            <span class="text-highlighted">{{ row.original.propertyName }}</span>
            <span
              v-if="detalle(row.original)"
              class="text-xs text-muted"
            >{{ detalle(row.original) }}</span>
          </div>
        </template>

        <template #monto-cell="{ row }">
          <span
            class="font-mono"
            :class="claseDeMonto(row.original)"
            :data-test="`monto-${row.original.id}`"
          >{{ monto(row.original) }}</span>
        </template>
      </UTable>
    </div>
  </div>
</template>
