<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia, formatearMes } from '#shared/dates/formato'
import { pendienteDeCobro, pendienteDeReportar } from '#shared/finance/cobros'
import type { ChargeStatus, OwnerPayment, PaymentStatus } from '#shared/finance/cobros'
import type { OwnerChargeListed, OwnerPaymentListed } from '#shared/finance/vistas'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'

/**
 * HU-62 · RF-62.6 · RF-62.7 · RF-62.8 · TR-02 — los cobros del Propietario con
 * sus pagos. Cada fila lleva el mes del corte, la propiedad, el importe, lo que
 * falta y el estado; debajo, cada pago reportado con su estado, el motivo si se
 * rechazó y el enlace al comprobante. Reportar se ofrece solo mientras quede
 * algo por reportar (RF-62.7). La decisión la toma la página; aquí se emite.
 */
const props = withDefaults(defineProps<{
  cobros: OwnerChargeListed[]
  /** La URL firmada del comprobante por pago. */
  comprobantes?: Record<string, string>
}>(), { comprobantes: () => ({}) })

const emit = defineEmits<{ reportar: [OwnerChargeListed] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const COLOR_DE_ESTADO: Record<ChargeStatus, 'error' | 'warning' | 'success'> = {
  pending: 'error',
  under_review: 'warning',
  paid: 'success',
}

const COLOR_DE_PAGO: Record<PaymentStatus, 'neutral' | 'success' | 'error'> = {
  reported: 'neutral',
  confirmed: 'success',
  rejected: 'error',
}

/** Los pagos tal como `shared/finance/cobros` los entiende para derivar lo pendiente. */
function pagosDe(cobro: OwnerChargeListed): OwnerPayment[] {
  return cobro.payments.map(pago => ({ ...pago, paymentMethodId: '' }))
}

function pendiente(cobro: OwnerChargeListed): string {
  return formatearImporte(pendienteDeCobro(cobro, pagosDe(cobro)), idioma.value)
}

function puedeReportar(cobro: OwnerChargeListed): boolean {
  return cobro.status !== 'paid' && pendienteDeReportar(cobro, pagosDe(cobro)) > 0
}

function lineaDePago(pago: OwnerPaymentListed): string {
  return t('ownerWallet.charges.paymentLine', {
    amount: formatearImporte(pago.amount, idioma.value),
    date: formatearDia(pago.paidOn, idioma.value),
    method: pago.paymentMethodName,
  })
}

const columnas = computed<TableColumn<OwnerChargeListed>[]>(() => [
  { id: 'periodo', header: t('ownerWallet.charges.columns.period') },
  { id: 'monto', header: t('ownerWallet.charges.columns.amount') },
  { id: 'estado', header: t('ownerWallet.charges.columns.status') },
  { id: 'acciones', header: t('ownerWallet.charges.columns.actions') },
])

const vacio = computed(() => props.cobros.length === 0)
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="vacio"
      class="text-sm text-muted"
      data-test="sin-cobros"
    >
      {{ t('ownerWallet.charges.empty') }}
    </p>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="cobros"
        :columns="columnas"
        data-test="tabla-cobros"
      >
        <template #periodo-cell="{ row }">
          <div
            class="flex flex-col"
            :data-test="`cobro-${row.original.id}`"
          >
            <span class="text-highlighted">{{ formatearMes(row.original.period, idioma) }}</span>
            <span class="text-xs text-muted">{{ row.original.propertyName }}</span>
            <span class="font-mono text-xs text-muted sm:hidden">{{ formatearImporte(row.original.amount, idioma) }}</span>
          </div>
        </template>

        <template #monto-cell="{ row }">
          <div class="flex flex-col">
            <span class="font-mono text-highlighted">{{ formatearImporte(row.original.amount, idioma) }}</span>
            <span
              v-if="row.original.status !== 'paid'"
              class="font-mono text-xs text-muted"
            >{{ t('ownerWallet.charges.columns.pending') }}: {{ pendiente(row.original) }}</span>
          </div>
        </template>

        <template #estado-cell="{ row }">
          <div class="flex flex-col gap-1">
            <UBadge
              :color="COLOR_DE_ESTADO[row.original.status]"
              variant="subtle"
              size="sm"
              :label="t(`ownerWallet.charges.status.${row.original.status}`)"
              :data-test="`estado-cobro-${row.original.id}`"
            />
            <ul
              v-if="row.original.payments.length > 0"
              class="space-y-1 text-xs"
            >
              <li
                v-for="pago in row.original.payments"
                :key="pago.id"
                class="flex flex-col"
                :data-test="`pago-${pago.id}`"
              >
                <span class="text-muted">{{ lineaDePago(pago) }}</span>
                <span class="flex flex-wrap items-center gap-2">
                  <UBadge
                    :color="COLOR_DE_PAGO[pago.status]"
                    variant="outline"
                    size="xs"
                    :label="t(`ownerWallet.charges.paymentStatus.${pago.status}`)"
                    :data-test="`estado-pago-${pago.id}`"
                  />
                  <span
                    v-if="pago.channel !== 'manual'"
                    class="text-muted"
                  >{{ t(`ownerWallet.charges.channel.${pago.channel}`) }}</span>
                  <ULink
                    v-if="comprobantes[pago.id]"
                    :to="comprobantes[pago.id]"
                    target="_blank"
                    class="text-primary"
                    :data-test="`comprobante-pago-${pago.id}`"
                  >
                    {{ t('ownerWallet.charges.receipt') }}
                  </ULink>
                </span>
                <span
                  v-if="pago.rejectionReason"
                  class="text-error"
                  :data-test="`motivo-pago-${pago.id}`"
                >{{ t('ownerWallet.charges.reason', { reason: pago.rejectionReason }) }}</span>
              </li>
            </ul>
          </div>
        </template>

        <template #acciones-cell="{ row }">
          <UButton
            v-if="puedeReportar(row.original)"
            size="sm"
            icon="i-lucide-upload"
            :label="t('ownerWallet.charges.report')"
            :data-test="`reportar-${row.original.id}`"
            @click="emit('reportar', row.original)"
          />
        </template>
      </UTable>
    </div>
  </div>
</template>
