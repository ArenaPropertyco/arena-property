<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia } from '#shared/dates/formato'
import type { OwnerWithdrawalStatus } from '#shared/finance/retiros-propietario'
import type { OwnerWithdrawalListed } from '#shared/finance/vistas'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'

/**
 * HU-62 · RF-62.9 · TR-02 — las solicitudes de retiro del Propietario: la
 * propiedad, el monto, la cuenta de destino, el estado, el motivo del rechazo y
 * el comprobante del pago.
 */
withDefaults(defineProps<{
  solicitudes: OwnerWithdrawalListed[]
  /** La URL firmada del comprobante por solicitud pagada. */
  comprobantes?: Record<string, string>
}>(), { comprobantes: () => ({}) })

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const COLOR_DE_ESTADO: Record<OwnerWithdrawalStatus, 'neutral' | 'success' | 'error'> = {
  requested: 'neutral',
  paid: 'success',
  rejected: 'error',
}

const columnas = computed<TableColumn<OwnerWithdrawalListed>[]>(() => [
  { id: 'propiedad', header: t('ownerWallet.withdrawal.columns.property') },
  { id: 'monto', header: t('ownerWallet.withdrawal.columns.amount') },
  { id: 'fecha', header: t('ownerWallet.withdrawal.columns.requestedOn') },
  { id: 'estado', header: t('ownerWallet.withdrawal.columns.status') },
])

function cuenta(solicitud: OwnerWithdrawalListed): string {
  return t('ownerWallet.withdrawal.bankLine', {
    bank: solicitud.bank,
    kind: t(`ownerWallet.withdrawal.accountKinds.${solicitud.accountKind}`),
    number: solicitud.accountNumber,
  })
}
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="solicitudes.length === 0"
      class="text-sm text-muted"
      data-test="sin-retiros-propietario"
    >
      {{ t('ownerWallet.withdrawal.empty') }}
    </p>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="solicitudes"
        :columns="columnas"
        data-test="tabla-retiros-propietario"
      >
        <template #propiedad-cell="{ row }">
          <div
            class="flex flex-col"
            :data-test="`retiro-${row.original.id}`"
          >
            <span class="text-highlighted">{{ row.original.propertyName }}</span>
            <span class="text-xs text-muted">{{ cuenta(row.original) }} · {{ row.original.holder }}</span>
            <span class="font-mono text-xs text-muted sm:hidden">{{ formatearImporte(row.original.amount, idioma) }}</span>
          </div>
        </template>

        <template #monto-cell="{ row }">
          <span class="font-mono text-highlighted">{{ formatearImporte(row.original.amount, idioma) }}</span>
        </template>

        <template #fecha-cell="{ row }">
          <span class="whitespace-nowrap">{{ formatearDia(row.original.requestedOn, idioma) }}</span>
        </template>

        <template #estado-cell="{ row }">
          <div class="flex flex-col gap-1">
            <UBadge
              :color="COLOR_DE_ESTADO[row.original.status]"
              variant="subtle"
              size="sm"
              :label="t(`ownerWallet.withdrawal.status.${row.original.status}`)"
              :data-test="`estado-retiro-${row.original.id}`"
            />
            <span
              v-if="row.original.rejectionReason"
              class="text-xs text-muted"
              :data-test="`motivo-retiro-${row.original.id}`"
            >{{ t('ownerWallet.withdrawal.reason', { reason: row.original.rejectionReason }) }}</span>
            <ULink
              v-if="row.original.status === 'paid' && comprobantes[row.original.id]"
              :to="comprobantes[row.original.id]"
              target="_blank"
              class="text-xs text-primary"
              :data-test="`comprobante-retiro-${row.original.id}`"
            >
              {{ t('ownerWallet.withdrawal.receipt') }}
            </ULink>
          </div>
        </template>
      </UTable>
    </div>
  </div>
</template>
