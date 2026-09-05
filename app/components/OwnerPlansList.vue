<script setup lang="ts">
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { EstadoDePlan } from '#shared/payments/plan'
import type { PlanDePagosListado } from '#shared/payments/vistas'

/**
 * HU-58 · RF-58.9 — los planes de pago del Propietario, en lectura: saldo
 * pendiente y qué falta para activar el calendario de cada fracción. Todo llega
 * derivado por la base (DT-04); el componente traduce y enlaza.
 */
defineProps<{
  planes: PlanDePagosListado[]
  pendiente: boolean
}>()

const { t, locale } = useI18n()
const localePath = useLocalePath()

const COLOR_DE_ESTADO: Record<EstadoDePlan, 'neutral' | 'warning' | 'success' | 'error'> = {
  reserved: 'neutral',
  in_progress: 'warning',
  completed: 'success',
  voided: 'error',
}

function importe(valor: PlanDePagosListado['balance']): string {
  return formatearImporte(valor, locale.value as Idioma)
}

function avisoDeCalendario(plan: PlanDePagosListado): string {
  return plan.status === 'completed'
    ? t('payments.calendar.ready')
    : t('payments.calendar.missing', { amount: importe(plan.balance) })
}
</script>

<template>
  <div data-test="planes-propios">
    <p
      v-if="!pendiente && planes.length === 0"
      class="rounded-2xl border border-dashed border-default px-6 py-12 text-center text-sm text-muted"
      data-test="sin-planes"
    >
      {{ t('owner.empty') }}
    </p>

    <div
      v-else
      v-auto-animate
      class="grid gap-4 md:grid-cols-2"
    >
      <UCard
        v-for="plan in planes"
        :key="plan.id"
        :data-test="`plan-${plan.id}`"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-muted">
              {{ t('owner.fraction', { number: plan.fractionNumber }) }}
            </p>
            <h3 class="mt-1 font-display text-xl font-medium text-highlighted">
              {{ plan.propertyName }}
            </h3>
          </div>
          <UBadge
            :color="COLOR_DE_ESTADO[plan.status]"
            variant="subtle"
            :label="t(`payments.status.${plan.status}`)"
          />
        </div>

        <dl class="mt-5 grid grid-cols-2 gap-4">
          <div>
            <dt class="text-xs text-muted">
              {{ t('payments.paidTotal') }}
            </dt>
            <dd class="mt-1 font-mono text-lg">
              {{ importe(plan.paidTotal) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted">
              {{ t('payments.balance') }}
            </dt>
            <dd
              class="mt-1 font-mono text-lg"
              :class="plan.status === 'completed' ? 'text-success' : ''"
              :data-test="`saldo-${plan.id}`"
            >
              {{ importe(plan.balance) }}
            </dd>
          </div>
        </dl>

        <p
          class="mt-4 text-sm"
          :class="plan.status === 'completed' ? 'text-success' : 'text-muted'"
          :data-test="`calendario-${plan.id}`"
        >
          {{ avisoDeCalendario(plan) }}
        </p>

        <div class="mt-4 flex justify-end">
          <UButton
            variant="link"
            size="sm"
            trailing-icon="i-lucide-arrow-right"
            :to="localePath(`/panel/planes/${plan.id}`)"
            :label="t('owner.open')"
            :data-test="`abrir-${plan.id}`"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
