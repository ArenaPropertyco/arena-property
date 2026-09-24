<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia } from '#shared/dates/formato'
import { colorDeSaldo, figuraDeSaldo } from '#shared/finance/billetera'
import type { ChargeStatus } from '#shared/finance/cobros'
import { esResolubleEnTablero } from '#shared/finance/tablero-de-cobros'
import type { FilaDelTablero, NaturalezaDeFila, PagoDelTablero } from '#shared/finance/tablero-de-cobros'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'

/**
 * HU-63 · RF-63.1, RF-63.2, RF-63.4, RF-63.5, RF-63.6, RF-63.10 · TR-02 — las
 * 8 filas del tablero, ya armadas por `shared/finance/tablero-de-cobros`.
 *
 * Cada fila lleva quién responde, el neto del mes, el saldo con su color, el
 * estado del cobro, los pagos reportados con su comprobante y solo las
 * acciones que proceden: confirmar o rechazar un pago manual reportado, pagar
 * el retiro solicitado. Un pago de pasarela se ve en lectura, con su referencia.
 * La decisión la toma la página; aquí se emite.
 */
withDefaults(defineProps<{
  filas: FilaDelTablero[]
  /** RF-63.4 · la URL firmada del comprobante por pago. */
  comprobantes?: Record<string, string>
  /** El pago o la fila sobre los que hay una acción en curso. */
  ocupada?: string | null
}>(), { comprobantes: () => ({}), ocupada: null })

const emit = defineEmits<{
  confirmar: [PagoDelTablero, FilaDelTablero]
  rechazar: [PagoDelTablero, FilaDelTablero]
  pagar: [FilaDelTablero]
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const COLOR_DE_NATURALEZA: Record<NaturalezaDeFila, 'error' | 'success' | 'neutral' | 'info' | 'warning'> = {
  charge: 'error',
  payout: 'success',
  settled: 'neutral',
  inventory_holder: 'info',
  linked: 'warning',
}

const COLOR_DE_ESTADO: Record<ChargeStatus, 'error' | 'warning' | 'success'> = {
  pending: 'error',
  under_review: 'warning',
  paid: 'success',
}

function importe(valor: CopAmount): string {
  return formatearImporte(valor, idioma.value)
}

/** RT-07 · rojo y verde solo sobre cifras cerradas; un estimado va neutro. */
function claseDeCifra(valor: CopAmount, cerrado: boolean): string {
  const color = colorDeSaldo(valor, cerrado)
  return color === 'neutral' ? 'text-highlighted' : `text-${color}`
}

function condicionDe(valor: CopAmount, cerrado: boolean): string {
  return figuraDeSaldo(valor, cerrado, idioma.value).condicion
}

function lineaDePago(pago: PagoDelTablero): string {
  return t('collections.receipt.line', { amount: importe(pago.amount), date: formatearDia(pago.paidOn, idioma.value), method: pago.paymentMethodName })
}

function lineaDeRetiro(fila: FilaDelTablero): string {
  const retiro = fila.withdrawal!
  return t('collections.withdrawal.requested', {
    amount: importe(retiro.amount),
    bank: retiro.bank,
    kind: t(`ownerWallet.withdrawal.accountKinds.${retiro.accountKind}`),
    number: retiro.accountNumber,
    holder: retiro.holder,
  })
}

const columnas = computed<TableColumn<FilaDelTablero>[]>(() => [
  { id: 'fraccion', header: t('collections.columns.fraction') },
  { id: 'neto', header: t('collections.columns.month'), meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'saldo', header: t('collections.columns.balance'), meta: { class: { th: 'text-right', td: 'text-right' } } },
  { id: 'estado', header: t('collections.columns.status') },
  { id: 'comprobante', header: t('collections.columns.receipt') },
  { id: 'acciones', header: t('collections.columns.actions') },
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <UTable
      :data="filas"
      :columns="columnas"
      data-test="tabla-de-cobros"
    >
      <template #fraccion-cell="{ row }">
        <div
          class="flex flex-col gap-1"
          :data-test="`fila-${row.original.fractionNumber}`"
        >
          <span class="text-highlighted">{{ t('collections.fractionLine', { fraction: row.original.fractionNumber }) }}</span>
          <span class="text-xs text-muted">
            <template v-if="row.original.nature === 'linked'">{{ t('collections.responsible.linked', { fraction: row.original.linkedTo }) }}</template>
            <template v-else-if="row.original.responsible === 'owner'">{{ row.original.ownerLabel }}</template>
            <template v-else>{{ t('collections.responsible.inventory_holder') }}</template>
          </span>
          <UBadge
            :color="COLOR_DE_NATURALEZA[row.original.nature]"
            variant="subtle"
            size="xs"
            :label="t(`collections.nature.${row.original.nature}`)"
            :data-test="`naturaleza-${row.original.fractionNumber}`"
          />
        </div>
      </template>

      <template #neto-cell="{ row }">
        <div class="flex flex-col items-end">
          <span
            class="font-mono"
            :class="claseDeCifra(row.original.net, !row.original.netEstimated)"
            :data-condicion="condicionDe(row.original.net, !row.original.netEstimated)"
            :data-test="`neto-${row.original.fractionNumber}`"
          >{{ importe(row.original.net) }}</span>
          <span
            v-if="row.original.netEstimated"
            class="text-xs text-muted"
          >{{ t('collections.estimated') }}</span>
        </div>
      </template>

      <template #saldo-cell="{ row }">
        <span
          v-if="row.original.responsible === 'owner' && row.original.nature !== 'linked'"
          class="font-mono"
          :class="claseDeCifra(row.original.balance, true)"
          :data-condicion="condicionDe(row.original.balance, true)"
          :data-test="`saldo-${row.original.fractionNumber}`"
        >{{ importe(row.original.balance) }}</span>
        <span
          v-else
          class="text-muted"
        >—</span>
      </template>

      <template #estado-cell="{ row }">
        <div class="flex flex-col gap-1">
          <UBadge
            v-if="row.original.charge"
            :color="COLOR_DE_ESTADO[row.original.charge.status]"
            variant="subtle"
            size="sm"
            :label="t(`ownerWallet.charges.status.${row.original.charge.status}`)"
            :data-test="`estado-${row.original.fractionNumber}`"
          />
          <span
            v-if="row.original.openCharges.length > 0"
            class="text-xs text-muted"
          >{{ t('collections.openCharges', { n: row.original.openCharges.length, amount: importe(row.original.receivable) }) }}</span>
          <span
            v-if="row.original.nature === 'payout'"
            class="text-xs text-muted"
            :data-test="`retiro-${row.original.fractionNumber}`"
          >{{ row.original.withdrawal ? lineaDeRetiro(row.original) : t('collections.withdrawal.none') }}</span>
        </div>
      </template>

      <template #comprobante-cell="{ row }">
        <div
          v-if="row.original.nature === 'charge' || row.original.reportedPayments.length > 0"
          class="flex flex-col gap-2 text-xs"
          :data-test="`comprobante-${row.original.fractionNumber}`"
        >
          <span
            v-if="row.original.reportedPayments.length === 0"
            class="text-muted"
          >{{ t('collections.receipt.none') }}</span>
          <div
            v-for="pago in row.original.reportedPayments"
            :key="pago.id"
            class="flex flex-col"
            :data-test="`pago-${pago.id}`"
          >
            <span class="text-highlighted">{{ lineaDePago(pago) }}</span>
            <span class="text-muted">{{ pago.description }}</span>
            <span
              v-if="pago.channel !== 'manual'"
              class="text-muted"
            >{{ t('collections.receipt.gateway', { provider: pago.provider ?? '', reference: pago.externalReference ?? '' }) }}</span>
            <ULink
              v-if="comprobantes[pago.id]"
              :to="comprobantes[pago.id]"
              target="_blank"
              class="text-primary"
              :data-test="`ver-comprobante-${pago.id}`"
            >
              {{ t('collections.receipt.view') }}
            </ULink>
          </div>
        </div>
        <span
          v-else
          class="text-muted"
        >—</span>
      </template>

      <template #acciones-cell="{ row }">
        <div class="flex flex-col gap-2">
          <div
            v-for="pago in row.original.reportedPayments.filter(esResolubleEnTablero)"
            :key="pago.id"
            class="flex flex-wrap gap-2"
          >
            <UButton
              size="sm"
              color="success"
              icon="i-lucide-check"
              :loading="ocupada === pago.id"
              :label="t('collections.actions.confirm')"
              :data-test="`confirmar-${pago.id}`"
              @click="emit('confirmar', pago, row.original)"
            />
            <UButton
              size="sm"
              color="error"
              variant="soft"
              icon="i-lucide-x"
              :disabled="ocupada === pago.id"
              :label="t('collections.actions.reject')"
              :data-test="`rechazar-${pago.id}`"
              @click="emit('rechazar', pago, row.original)"
            />
          </div>
          <UButton
            v-if="row.original.withdrawal"
            size="sm"
            icon="i-lucide-receipt"
            :loading="ocupada === row.original.withdrawal.id"
            :label="t('collections.actions.pay')"
            :data-test="`pagar-${row.original.fractionNumber}`"
            @click="emit('pagar', row.original)"
          />
        </div>
      </template>
    </UTable>
  </div>
</template>
