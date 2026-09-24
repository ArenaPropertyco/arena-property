<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia } from '#shared/dates/formato'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { WithdrawalListed } from '#shared/referrals/views'
import { canTransition } from '#shared/referrals/withdrawals'
import type { WithdrawalStatus } from '#shared/referrals/withdrawals'

/**
 * HU-56 · RF-56.2…RF-56.4 · D-20 · TR-02 — las solicitudes de retiro.
 *
 * En modo `embajador` es el historial propio: estado, motivo del rechazo y el
 * comprobante del pago. En modo `superadmin` es la bandeja: quién pide, cuánto,
 * sus datos bancarios de HU-49 para pagarle, cuánto tiene disponible, y solo
 * las acciones que la máquina de estados admite para cada fila (CA-56.3).
 * La decisión la toma la página; aquí solo se emite.
 */
const props = withDefaults(defineProps<{
  solicitudes: WithdrawalListed[]
  modo: 'embajador' | 'superadmin'
  /** La solicitud sobre la que hay una acción en curso. */
  ocupada?: string | null
  /** RF-56.4 · URL firmada del comprobante por solicitud pagada. */
  comprobantes?: Record<string, string>
}>(), { ocupada: null, comprobantes: () => ({}) })

const emit = defineEmits<{
  aprobar: [WithdrawalListed]
  rechazar: [WithdrawalListed]
  pagar: [WithdrawalListed]
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const COLOR_DE_ESTADO: Record<WithdrawalStatus, 'neutral' | 'info' | 'success' | 'error'> = {
  requested: 'neutral',
  approved: 'info',
  paid: 'success',
  rejected: 'error',
}

const esBandeja = computed(() => props.modo === 'superadmin')

const columnas = computed<TableColumn<WithdrawalListed>[]>(() => [
  ...(esBandeja.value ? [{ id: 'embajador', header: t('wallet.requests.columns.ambassador') }] : []),
  { id: 'monto', header: t('wallet.requests.columns.amount') },
  { id: 'fecha', header: t('wallet.requests.columns.requestedOn') },
  { id: 'estado', header: t('wallet.requests.columns.status') },
  ...(esBandeja.value ? [{ id: 'acciones', header: t('wallet.requests.columns.actions') }] : []),
])

function cuenta(solicitud: WithdrawalListed): string {
  return t('wallet.requests.bankLine', {
    bank: solicitud.bank,
    kind: t(`wallet.requests.accountKinds.${solicitud.accountKind}`),
    number: solicitud.accountNumber,
  })
}
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="solicitudes.length === 0"
      class="text-sm text-muted"
      data-test="sin-retiros"
    >
      {{ t('wallet.requests.empty') }}
    </p>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="solicitudes"
        :columns="columnas"
        data-test="tabla-retiros"
      >
        <template #embajador-cell="{ row }">
          <div
            class="flex flex-col"
            :data-test="`retiro-${row.original.id}`"
          >
            <span class="text-highlighted">{{ row.original.ambassadorName ?? row.original.ambassadorEmail }}</span>
            <span
              v-if="row.original.ambassadorName"
              class="text-xs text-muted"
            >{{ row.original.ambassadorEmail }}</span>
            <span class="text-xs text-muted">{{ cuenta(row.original) }}</span>
            <span class="text-xs text-muted">{{ t('wallet.requests.holderLine', { holder: row.original.holder }) }}</span>
            <span class="font-mono text-xs text-muted sm:hidden">{{ formatearImporte(row.original.amount, idioma) }}</span>
          </div>
        </template>

        <template #monto-cell="{ row }">
          <div class="flex flex-col">
            <span class="font-mono text-highlighted">{{ formatearImporte(row.original.amount, idioma) }}</span>
            <span
              v-if="esBandeja && row.original.available !== null"
              class="font-mono text-xs text-muted"
              :data-test="`disponible-${row.original.id}`"
            >{{ t('wallet.requests.available', { amount: formatearImporte(row.original.available, idioma) }) }}</span>
          </div>
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
              :label="t(`wallet.requests.status.${row.original.status}`)"
              :data-test="`estado-${row.original.id}`"
            />
            <span
              v-if="row.original.rejectionReason"
              class="text-xs text-muted"
              :data-test="`motivo-${row.original.id}`"
            >{{ t('wallet.requests.reason', { reason: row.original.rejectionReason }) }}</span>
            <ULink
              v-if="row.original.status === 'paid' && comprobantes[row.original.id]"
              :to="comprobantes[row.original.id]"
              target="_blank"
              class="text-xs text-primary"
              :data-test="`comprobante-${row.original.id}`"
            >
              {{ t('wallet.requests.receipt') }}
            </ULink>
          </div>
        </template>

        <template #acciones-cell="{ row }">
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="canTransition(row.original.status, 'approved')"
              size="sm"
              icon="i-lucide-check"
              :loading="ocupada === row.original.id"
              :label="t('withdrawals.actions.approve')"
              :data-test="`aprobar-${row.original.id}`"
              @click="emit('aprobar', row.original)"
            />
            <UButton
              v-if="canTransition(row.original.status, 'rejected')"
              size="sm"
              color="error"
              variant="soft"
              icon="i-lucide-x"
              :disabled="ocupada === row.original.id"
              :label="t('withdrawals.actions.reject')"
              :data-test="`rechazar-${row.original.id}`"
              @click="emit('rechazar', row.original)"
            />
            <UButton
              v-if="canTransition(row.original.status, 'paid')"
              size="sm"
              color="success"
              icon="i-lucide-receipt"
              :disabled="ocupada === row.original.id"
              :label="t('withdrawals.actions.pay')"
              :data-test="`pagar-${row.original.id}`"
              @click="emit('pagar', row.original)"
            />
          </div>
        </template>
      </UTable>
    </div>
  </div>
</template>
