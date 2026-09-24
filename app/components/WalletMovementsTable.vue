<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia } from '#shared/dates/formato'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { walletEntryDirection } from '#shared/referrals/wallet'
import type { WalletEntry, WalletEntryKind } from '#shared/referrals/wallet'

/**
 * HU-55 · RF-55.3 · RF-55.5 · TR-02 — el histórico de la billetera, ya ordenado y
 * filtrado por `shared/referrals/wallet`. Cada fila lleva tipo, fecha, el
 * referido y la propiedad que lo originaron cuando es una comisión, y el monto
 * con el signo que le corresponde: entra lo acreditado, sale lo reversado y lo
 * aprobado en retiros; lo demás solo cambia de estado.
 */
defineProps<{ movimientos: WalletEntry[] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const COLOR_DE_TIPO: Record<WalletEntryKind, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  commission_credited: 'warning',
  commission_available: 'success',
  commission_reversed: 'error',
  withdrawal_requested: 'neutral',
  withdrawal_approved: 'info',
  withdrawal_paid: 'success',
}

const SIGNO = { in: '+', out: '−', neutral: '' } as const

function monto(movimiento: WalletEntry): string {
  return `${SIGNO[walletEntryDirection(movimiento.kind)]}${formatearImporte(movimiento.amount, idioma.value)}`
}

function claseDeMonto(movimiento: WalletEntry): string {
  const direccion = walletEntryDirection(movimiento.kind)
  return direccion === 'in' ? 'text-success' : direccion === 'out' ? 'text-error' : 'text-default'
}

const columnas = computed<TableColumn<WalletEntry>[]>(() => [
  { id: 'tipo', header: t('wallet.movements.columns.kind') },
  { id: 'fecha', header: t('wallet.movements.columns.date') },
  { id: 'referido', header: t('wallet.movements.columns.referral') },
  { id: 'monto', header: t('wallet.movements.columns.amount'), meta: { class: { th: 'text-right', td: 'text-right' } } },
])
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="movimientos.length === 0"
      class="text-sm text-muted"
      data-test="sin-movimientos"
    >
      {{ t('wallet.movements.empty') }}
    </p>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="movimientos"
        :columns="columnas"
        data-test="tabla-billetera"
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
              :label="t(`wallet.movements.kinds.${row.original.kind}`)"
            />
            <span class="text-xs text-muted sm:hidden">{{ formatearDia(row.original.occurredOn, idioma) }}</span>
            <span
              v-if="row.original.referralLabel"
              class="text-xs text-muted sm:hidden"
            >{{ row.original.referralLabel }}</span>
            <span
              v-if="row.original.propertyName"
              class="text-xs text-muted sm:hidden"
            >{{ t('wallet.movements.propertyLine', { property: row.original.propertyName, fraction: row.original.fractionNumber }) }}</span>
          </div>
        </template>

        <template #fecha-cell="{ row }">
          <span class="whitespace-nowrap">{{ formatearDia(row.original.occurredOn, idioma) }}</span>
        </template>

        <template #referido-cell="{ row }">
          <div
            v-if="row.original.referralLabel"
            class="flex flex-col"
          >
            <span class="text-highlighted">{{ row.original.referralLabel }}</span>
            <span
              v-if="row.original.propertyName"
              class="text-xs text-muted"
            >{{ t('wallet.movements.propertyLine', { property: row.original.propertyName, fraction: row.original.fractionNumber }) }}</span>
            <span
              v-if="row.original.kind === 'commission_credited' && row.original.graceEndsOn"
              class="text-xs text-warning"
            >{{ t('wallet.movements.graceLine', { date: formatearDia(row.original.graceEndsOn, idioma) }) }}</span>
          </div>
          <span
            v-else-if="row.original.note"
            class="text-sm text-muted"
          >{{ row.original.note }}</span>
          <span
            v-else
            class="text-muted"
          >—</span>
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
