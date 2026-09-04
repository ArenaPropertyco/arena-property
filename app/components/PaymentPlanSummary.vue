<script setup lang="ts">
import { formatearInstante } from '#shared/dates/formato'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { EstadoDePlan } from '#shared/payments/plan'
import type { PlanDePagosListado } from '#shared/payments/vistas'

/**
 * HU-58 · RF-58.3, RF-58.7, RF-58.9 — el plan de un vistazo.
 *
 * Todo lo que muestra llega derivado por la base: estado, abonado, saldo y el
 * interruptor de calendario (DT-04). El componente traduce y colorea; no suma.
 * El verde queda para lo confirmado —el pago completo— y el resto va en neutro o
 * aviso, según la semántica de marca (principio 8).
 */
const props = defineProps<{ plan: PlanDePagosListado }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const COLOR_DE_ESTADO: Record<EstadoDePlan, 'neutral' | 'warning' | 'success' | 'error'> = {
  reserved: 'neutral',
  in_progress: 'warning',
  completed: 'success',
  voided: 'error',
}

const importes = computed(() => ({
  agreedPrice: formatearImporte(props.plan.agreedPrice, idioma.value),
  paidTotal: formatearImporte(props.plan.paidTotal, idioma.value),
  balance: formatearImporte(props.plan.balance, idioma.value),
}))

const avisoDeCalendario = computed(() => props.plan.status === 'completed'
  ? t('payments.calendar.ready')
  : t('payments.calendar.missing', { amount: importes.value.balance }))
</script>

<template>
  <div
    class="space-y-4"
    data-test="resumen-plan"
  >
    <div class="flex flex-wrap items-center gap-2">
      <UBadge
        :color="COLOR_DE_ESTADO[plan.status]"
        variant="subtle"
        :label="t(`payments.status.${plan.status}`)"
        data-test="estado-plan"
      />
      <UBadge
        :color="plan.calendarActive ? 'success' : 'neutral'"
        variant="outline"
        :label="`${t('payments.calendar.label')}: ${plan.calendarActive ? t('payments.calendar.active') : t('payments.calendar.inactive')}`"
        data-test="calendario-plan"
      />
      <span class="text-sm text-muted">
        {{ t('payments.owner') }}: {{ plan.ownerLabel }}
      </span>
    </div>

    <UAlert
      v-if="plan.voidedAt"
      color="error"
      variant="subtle"
      icon="i-lucide-ban"
      :title="t('payments.voidedPurchase', { date: formatearInstante(plan.voidedAt, idioma), reason: plan.voidReason ?? '' })"
      data-test="compra-anulada"
    />

    <div class="grid gap-4 sm:grid-cols-3">
      <UCard>
        <p class="text-xs uppercase tracking-wide text-muted">
          {{ t('payments.agreedPrice') }}
        </p>
        <p
          class="mt-1 font-mono text-xl"
          data-test="precio-pactado"
        >
          {{ importes.agreedPrice }}
        </p>
      </UCard>

      <UCard>
        <p class="text-xs uppercase tracking-wide text-muted">
          {{ t('payments.paidTotal') }}
        </p>
        <p
          class="mt-1 font-mono text-xl"
          data-test="abonado"
        >
          {{ importes.paidTotal }}
        </p>
      </UCard>

      <UCard>
        <p class="text-xs uppercase tracking-wide text-muted">
          {{ t('payments.balance') }}
        </p>
        <p
          class="mt-1 font-mono text-xl"
          :class="plan.status === 'completed' ? 'text-success' : ''"
          data-test="saldo"
        >
          {{ importes.balance }}
        </p>
      </UCard>
    </div>

    <p
      v-if="plan.status !== 'voided'"
      class="text-sm"
      :class="plan.status === 'completed' ? 'text-success' : 'text-muted'"
      data-test="aviso-calendario"
    >
      {{ avisoDeCalendario }}
    </p>
  </div>
</template>
