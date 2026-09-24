<script setup lang="ts">
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'
import { esImporte, pesos } from '#shared/money/importe'
import { validateMinimum } from '#shared/referrals/withdrawals'

/**
 * HU-56 · RF-56.1 · D-06 — el Superadmin fija el mínimo por retiro. Muestra el
 * vigente y emite el nuevo como entero en pesos; la base lo audita.
 */
defineProps<{
  minimo: CopAmount
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [CopAmount] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const estado = reactive({ amount: null as number | string | null })
const error = ref<string | null>(null)

function enviar() {
  const numero = estado.amount === null || estado.amount === '' ? null : Number(estado.amount)
  const monto = numero !== null && esImporte(numero) ? pesos(numero) : null
  const problema = validateMinimum(monto)
  if (problema || monto === null) {
    error.value = t(problema ?? 'wallet.minimum.validation.not_positive')
    return
  }
  error.value = null
  emit('submit', monto)
}
</script>

<template>
  <UForm
    :state="estado"
    class="flex flex-wrap items-end gap-4 rounded-2xl border border-default bg-default p-4"
    data-test="formulario-minimo"
    @submit.prevent="enviar"
  >
    <div class="min-w-56 flex-1">
      <h3 class="font-display text-lg text-highlighted">
        {{ t('withdrawals.minimum.title') }}
      </h3>
      <p class="text-sm text-muted">
        {{ t('withdrawals.minimum.hint', { amount: formatearImporte(minimo, idioma) }) }}
      </p>
    </div>

    <UFormField
      :label="t('withdrawals.minimum.amount')"
      :error="error ?? undefined"
      data-test="campo-minimo"
    >
      <UInput
        v-model="estado.amount"
        type="number"
        inputmode="numeric"
        min="1"
        step="1"
        class="font-mono"
        data-test="minimo-monto"
      />
    </UFormField>

    <UButton
      type="submit"
      variant="soft"
      icon="i-lucide-save"
      :loading="enviando"
      :label="t('withdrawals.minimum.save')"
      data-test="guardar-minimo"
    />
  </UForm>
</template>
