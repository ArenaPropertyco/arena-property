<script setup lang="ts">
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'
import { esImporte, pesos } from '#shared/money/importe'
import type { WithdrawalRequest } from '#shared/referrals/withdrawals'
import { hasOpenWithdrawal, validateWithdrawal } from '#shared/referrals/withdrawals'

/**
 * HU-56 · RF-56.1 · D-06 · RT-06 — solicitar un retiro parcial o total del saldo
 * disponible.
 *
 * Valida con el dominio antes de emitir: entero mayor que cero, no por debajo
 * del mínimo vigente, no por encima del disponible y sin otra solicitud abierta.
 * La base vuelve a rechazar lo mismo por su cuenta. Con una solicitud en curso
 * no ofrece el formulario: primero se resuelve esa (CA-56.5).
 */
const props = defineProps<{
  disponible: CopAmount
  minimo: CopAmount
  solicitudes: Pick<WithdrawalRequest, 'status'>[]
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [CopAmount] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const estado = reactive({ amount: null as number | string | null })
const error = ref<string | null>(null)

const abierta = computed(() => hasOpenWithdrawal(props.solicitudes))

/** El campo numérico puede entregar texto o número según el navegador; solo cuenta un entero. */
function importeDelCampo(valor: number | string | null): CopAmount | null {
  if (valor === null || valor === '') {
    return null
  }
  const numero = Number(valor)
  return esImporte(numero) ? pesos(numero) : null
}

function enviar() {
  const monto = importeDelCampo(estado.amount)
  const problemas = validateWithdrawal(monto, { available: props.disponible, minimum: props.minimo }, props.solicitudes)
  error.value = problemas[0] ? t(problemas[0]) : null
  if (problemas.length > 0 || monto === null) {
    return
  }
  emit('submit', monto)
}

function limpiar() {
  estado.amount = null
  error.value = null
}

defineExpose({ limpiar })
</script>

<template>
  <div
    class="space-y-4 rounded-2xl border border-default bg-default p-5"
    data-test="solicitud-de-retiro"
  >
    <div>
      <h3 class="font-display text-xl text-highlighted">
        {{ t('wallet.withdrawal.title') }}
      </h3>
      <p class="mt-1 text-sm text-muted">
        {{ t('wallet.withdrawal.hint', { minimum: formatearImporte(minimo, idioma), available: formatearImporte(disponible, idioma) }) }}
      </p>
    </div>

    <UAlert
      v-if="abierta"
      color="warning"
      variant="subtle"
      icon="i-lucide-hourglass"
      :title="t('wallet.withdrawal.open')"
      data-test="retiro-abierto"
    />

    <UForm
      v-else
      :state="estado"
      class="flex flex-wrap items-end gap-4"
      data-test="formulario-retiro"
      @submit.prevent="enviar"
    >
      <UFormField
        :label="t('wallet.withdrawal.amount')"
        :hint="t('wallet.withdrawal.amountHint')"
        :error="error ?? undefined"
        required
        class="min-w-56 flex-1"
        data-test="campo-monto-retiro"
      >
        <UInput
          v-model="estado.amount"
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          class="w-full font-mono"
          data-test="retiro-monto"
        />
      </UFormField>

      <UButton
        type="submit"
        icon="i-lucide-send"
        :loading="enviando"
        :label="t('wallet.withdrawal.submit')"
        data-test="enviar-retiro"
      />
    </UForm>
  </div>
</template>
