<script setup lang="ts">
import { REFERRAL_STATES } from '#shared/referrals/listing'
import type { ReferralTotals } from '#shared/referrals/listing'

/**
 * HU-53 · RF-53.4 · CA-53.1 — los totalizadores de referidos por estado, ya
 * sumados por `shared/referrals/listing`. Cuatro cifras: una por estado y el
 * total del listado, que siempre es la suma de las otras tres.
 */
defineProps<{ totales: ReferralTotals }>()

const { t } = useI18n()
</script>

<template>
  <dl
    class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    data-test="totales-referidos"
  >
    <div
      class="rounded-2xl border border-default bg-default p-4"
      data-test="total-todos"
    >
      <dt class="text-xs uppercase tracking-wide text-muted">
        {{ t('referrals.list.totals.total') }}
      </dt>
      <dd class="mt-1 font-mono text-2xl text-highlighted">
        {{ totales.total }}
      </dd>
    </div>
    <div
      v-for="estado in REFERRAL_STATES"
      :key="estado"
      class="rounded-2xl border border-default bg-default p-4"
      :data-test="`total-${estado}`"
    >
      <dt class="text-xs uppercase tracking-wide text-muted">
        {{ t(`referrals.list.totals.${estado}`) }}
      </dt>
      <dd
        class="mt-1 font-mono text-2xl"
        :class="estado === 'paid' && totales.paid > 0 ? 'text-success' : 'text-default'"
      >
        {{ totales[estado] }}
      </dd>
    </div>
  </dl>
</template>
