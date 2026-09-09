<script setup lang="ts">
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'

/**
 * HU-13 · RF-13.1b · D-31 — con el calendario inactivo la vista es de solo
 * lectura y lleva un aviso permanente del saldo pendiente (HU-58), con el enlace
 * al plan de pagos. El saldo llega derivado; aquí solo se formatea.
 */
defineProps<{
  saldo: CopAmount | null
  planId: string | null
}>()

const { t, locale } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <UAlert
    color="warning"
    variant="subtle"
    icon="i-lucide-lock"
    :title="t('payments.calendar.inactive')"
    data-test="calendario-inactivo"
  >
    <template #description>
      <p>{{ t('calendar.weeks.inactive') }}</p>
      <p
        v-if="saldo !== null"
        class="mt-1 font-mono"
        data-test="saldo-pendiente"
      >
        {{ t('calendar.weeks.inactiveBalance', { amount: formatearImporte(saldo, locale as Idioma) }) }}
      </p>
    </template>
    <template
      v-if="planId"
      #actions
    >
      <UButton
        variant="outline"
        color="warning"
        size="sm"
        icon="i-lucide-wallet"
        :label="t('calendar.weeks.viewPlan')"
        :to="localePath(`/panel/planes/${planId}`)"
        data-test="ver-plan"
      />
    </template>
  </UAlert>
</template>
