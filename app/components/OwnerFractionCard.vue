<script setup lang="ts">
import { formatearDia, formatearMes } from '#shared/dates/formato'
import type { TarjetaDeFraccion } from '#shared/finance/portafolio'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'
import type { EstadoDePlan } from '#shared/payments/plan'

/**
 * HU-18 · RF-18.1, RF-18.2, RF-18.5 · HU-58 · RF-58.9 · D-16, D-31, D-39 — una
 * fracción del Propietario en su portafolio.
 *
 * La tarjeta llega armada por `shared/finance/portafolio`; aquí se presenta. Los
 * ingresos por renta se muestran solo si existen, y siempre con su naturaleza:
 * lo prorrateado y lo atribuido no se confunden (RF-18.2). El plan de pagos solo
 * aparece mientras no esté completo, con lo que falta para activar el calendario
 * (RF-18.5). Los copropietarios se listan por nombre y fracción, nada más (D-16).
 */
const props = defineProps<{ tarjeta: TarjetaDeFraccion }>()

const { t, locale } = useI18n()
const localePath = useLocalePath()

const COLOR_DE_ESTADO: Record<EstadoDePlan, 'neutral' | 'warning' | 'success' | 'error'> = {
  reserved: 'neutral',
  in_progress: 'warning',
  completed: 'success',
  voided: 'error',
}

const idioma = computed(() => locale.value as Idioma)
const id = computed(() => props.tarjeta.fractionId)

function importe(valor: CopAmount): string {
  return formatearImporte(valor, idioma.value)
}

const avisoDeCalendario = computed(() => props.tarjeta.plan
  ? t('payments.calendar.missing', { amount: importe(props.tarjeta.plan.balance) })
  : t('payments.calendar.ready'))
</script>

<template>
  <UCard :data-test="`tarjeta-${id}`">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-muted">
          {{ t('owner.fraction', { number: tarjeta.fraction }) }}
        </p>
        <h3 class="mt-1 font-display text-xl font-medium text-highlighted">
          {{ tarjeta.propertyName }}
        </h3>
      </div>
      <UBadge
        :color="tarjeta.calendarActive ? 'success' : 'neutral'"
        variant="subtle"
        :icon="tarjeta.calendarActive ? 'i-lucide-calendar-check' : 'i-lucide-calendar-off'"
        :label="tarjeta.calendarActive ? t('portfolio.calendarActive') : t('portfolio.calendarInactive')"
      />
    </div>

    <dl class="mt-5 grid gap-4 sm:grid-cols-2">
      <div>
        <dt class="text-xs text-muted">
          {{ t('portfolio.nextStay') }}
        </dt>
        <dd
          v-if="tarjeta.nextStay"
          class="mt-1 text-sm text-highlighted"
          :data-test="`proxima-${id}`"
        >
          {{ t('portfolio.nextStayLine', {
            week: tarjeta.nextStay.week + 1,
            from: formatearDia(tarjeta.nextStay.startsOn, idioma),
            to: formatearDia(tarjeta.nextStay.endsOn, idioma),
          }) }}
        </dd>
        <dd
          v-else
          class="mt-1 text-sm text-muted"
          :data-test="`sin-proxima-${id}`"
        >
          {{ t('portfolio.noNextStay') }}
        </dd>
      </div>
      <div>
        <dt class="text-xs text-muted">
          {{ t('portfolio.balance', { month: formatearMes(tarjeta.periodo, idioma) }) }}
        </dt>
        <dd
          class="mt-1 font-mono text-lg"
          :class="tarjeta.balance < 0 ? 'text-error' : 'text-highlighted'"
          :data-test="`saldo-${id}`"
        >
          {{ importe(tarjeta.balance) }}
        </dd>
      </div>
    </dl>

    <section
      v-if="tarjeta.rentalIncome.total > 0"
      class="mt-4 rounded-xl bg-elevated p-3"
      :data-test="`renta-${id}`"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-muted">
        {{ t('portfolio.rentalIncome') }}
      </p>
      <dl class="mt-2 space-y-1 text-sm">
        <div
          class="flex items-baseline justify-between gap-3"
          :data-test="`renta-prorrateada-${id}`"
        >
          <dt class="text-muted">
            {{ t('portfolio.rentalProrated') }}
          </dt>
          <dd class="font-mono">
            {{ importe(tarjeta.rentalIncome.prorated) }}
          </dd>
        </div>
        <div
          class="flex items-baseline justify-between gap-3"
          :data-test="`renta-atribuida-${id}`"
        >
          <dt class="text-muted">
            {{ t('portfolio.rentalAttributed') }}
          </dt>
          <dd class="font-mono text-success">
            {{ importe(tarjeta.rentalIncome.attributed) }}
          </dd>
        </div>
      </dl>
    </section>

    <section
      v-if="tarjeta.plan"
      class="mt-4 space-y-2"
      :data-test="`plan-${id}`"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-medium uppercase tracking-wide text-muted">
          {{ t('portfolio.plan') }}
        </p>
        <UBadge
          :color="COLOR_DE_ESTADO[tarjeta.plan.status]"
          variant="subtle"
          size="sm"
          :label="t(`payments.status.${tarjeta.plan.status}`)"
        />
      </div>
      <p class="flex items-baseline justify-between gap-3 text-sm">
        <span class="text-muted">{{ t('payments.balance') }}</span>
        <span class="font-mono text-lg">{{ importe(tarjeta.plan.balance) }}</span>
      </p>
      <UButton
        variant="link"
        size="sm"
        trailing-icon="i-lucide-arrow-right"
        :to="localePath(`/panel/planes/${tarjeta.plan.id}`)"
        :label="t('portfolio.openPlan')"
        :data-test="`abrir-plan-${tarjeta.plan.id}`"
      />
    </section>

    <p
      class="mt-4 text-sm"
      :class="tarjeta.plan ? 'text-muted' : 'text-success'"
      :data-test="`calendario-${id}`"
    >
      {{ avisoDeCalendario }}
    </p>

    <section class="mt-4">
      <p class="text-xs font-medium uppercase tracking-wide text-muted">
        {{ t('portfolio.coOwners') }}
      </p>
      <p
        v-if="tarjeta.coOwners.length === 0"
        class="mt-1 text-sm text-muted"
        :data-test="`sin-copropietarios-${id}`"
      >
        {{ t('portfolio.noCoOwners') }}
      </p>
      <ul
        v-else
        class="mt-1 space-y-1 text-sm"
        :data-test="`copropietarios-${id}`"
      >
        <li
          v-for="copropietario in tarjeta.coOwners"
          :key="copropietario.fraction"
          class="flex items-center gap-2"
          :data-test="`copropietario-${id}-${copropietario.fraction}`"
        >
          <UIcon
            name="i-lucide-user"
            class="size-4 shrink-0 text-muted"
          />
          <span>{{ t('portfolio.coOwnerLine', { name: copropietario.name, fraction: copropietario.fraction }) }}</span>
        </li>
      </ul>
    </section>

    <div class="mt-5 flex flex-wrap justify-end gap-2 border-t border-default pt-4">
      <UButton
        variant="ghost"
        size="xs"
        icon="i-lucide-calendar-heart"
        :to="localePath('/panel/mi-calendario')"
        :label="t('portfolio.openCalendar')"
        :data-test="`abrir-calendario-${id}`"
      />
      <UButton
        variant="ghost"
        size="xs"
        icon="i-lucide-package"
        :to="localePath(`/panel/inventario/${tarjeta.propertyId}`)"
        :label="t('portfolio.openInventory')"
        :data-test="`abrir-inventario-${id}`"
      />
      <UButton
        variant="ghost"
        size="xs"
        icon="i-lucide-wallet"
        :to="localePath(`/panel/finanzas?propiedad=${tarjeta.propertyId}`)"
        :label="t('portfolio.openStatement')"
        :data-test="`abrir-estado-${id}`"
      />
    </div>
  </UCard>
</template>
