<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia } from '#shared/dates/formato'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CommissionStatus } from '#shared/referrals/ledger'
import { commissionShown } from '#shared/referrals/listing'
import type { ReferralRow, ReferralState } from '#shared/referrals/listing'

/**
 * HU-53 · RF-53.1…RF-53.3 · TR-02 — el listado de referidos, ya filtrado y
 * ordenado por `shared/referrals/listing`. Cada fila lleva nombre o correo,
 * fecha de referencia, propiedad y fracción de interés, estado y, desde «En
 * proceso de pago», la comisión congelada sobre el precio pactado con su estado
 * de saldo. Un referido registrado no muestra monto: no existe (principio 9).
 */
defineProps<{ referidos: ReferralRow[] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const COLOR_DE_ESTADO: Record<ReferralState, 'neutral' | 'warning' | 'success'> = {
  registered: 'neutral',
  payment_in_progress: 'warning',
  paid: 'success',
}

const COLOR_DE_SALDO: Record<CommissionStatus, 'neutral' | 'warning' | 'success' | 'info' | 'error'> = {
  pending: 'neutral',
  in_grace: 'warning',
  available: 'success',
  withdrawn: 'info',
  reversed: 'error',
}

function saldo(referido: ReferralRow): string {
  const comision = commissionShown(referido)
  if (!comision) {
    return ''
  }
  return t(`referrals.list.balance.${comision.status}`, {
    date: comision.graceEndsOn ? formatearDia(comision.graceEndsOn, idioma.value) : '',
  })
}

const columnas = computed<TableColumn<ReferralRow>[]>(() => [
  { id: 'referido', header: t('referrals.list.columns.prospect') },
  { id: 'fecha', header: t('referrals.list.columns.referredOn') },
  { id: 'interes', header: t('referrals.list.columns.interest') },
  { id: 'estado', header: t('referrals.list.columns.state') },
  { id: 'comision', header: t('referrals.list.columns.commission') },
])
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="referidos.length === 0"
      class="text-sm text-muted"
      data-test="sin-referidos"
    >
      {{ t('referrals.list.emptyFiltered') }}
    </p>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="referidos"
        :columns="columnas"
        data-test="tabla-referidos"
      >
        <template #referido-cell="{ row }">
          <div
            class="flex flex-col"
            :data-test="`referido-${row.original.id}`"
          >
            <span class="text-highlighted">{{ row.original.prospectName ?? row.original.prospectEmail }}</span>
            <span
              v-if="row.original.prospectName"
              class="text-xs text-muted"
            >{{ row.original.prospectEmail }}</span>
            <span class="text-xs text-muted sm:hidden">{{ formatearDia(row.original.referredOn, idioma) }}</span>
            <span
              v-if="row.original.propertyName"
              class="text-xs text-muted sm:hidden"
            >{{ t('referrals.list.interestLine', { property: row.original.propertyName, fraction: row.original.fractionNumber }) }}</span>
          </div>
        </template>

        <template #fecha-cell="{ row }">
          <span class="whitespace-nowrap">{{ formatearDia(row.original.referredOn, idioma) }}</span>
        </template>

        <template #interes-cell="{ row }">
          <span v-if="row.original.propertyName">
            {{ t('referrals.list.interestLine', { property: row.original.propertyName, fraction: row.original.fractionNumber }) }}
          </span>
          <span
            v-else
            class="text-muted"
          >{{ t('referrals.list.noInterest') }}</span>
        </template>

        <template #estado-cell="{ row }">
          <UBadge
            :color="COLOR_DE_ESTADO[row.original.stage]"
            variant="subtle"
            size="sm"
            :label="t(`referrals.list.states.${row.original.stage}`)"
            :data-test="`estado-${row.original.id}`"
          />
        </template>

        <template #comision-cell="{ row }">
          <div
            v-if="commissionShown(row.original)"
            class="flex flex-col gap-1"
          >
            <span
              class="font-mono"
              :class="commissionShown(row.original)!.status === 'available' ? 'text-success' : 'text-highlighted'"
              :data-test="`comision-${row.original.id}`"
            >{{ formatearImporte(commissionShown(row.original)!.amount, idioma) }}</span>
            <UBadge
              :color="COLOR_DE_SALDO[commissionShown(row.original)!.status]"
              variant="subtle"
              size="sm"
              :label="saldo(row.original)"
              :data-test="`saldo-${row.original.id}`"
            />
          </div>
          <span
            v-else
            class="text-sm text-muted"
            :data-test="`sin-comision-${row.original.id}`"
          >{{ t('referrals.list.noCommission') }}</span>
        </template>
      </UTable>
    </div>
  </div>
</template>
