<script setup lang="ts">
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { WithdrawalListed } from '#shared/referrals/views'
import { transition } from '#shared/referrals/withdrawals'

/**
 * HU-56 · RF-56.2 · CA-56.4 — rechazar un retiro con motivo obligatorio. La
 * máquina de estados del dominio es la que exige el motivo; el formulario solo
 * lo pide y emite el texto limpio. El saldo no cambia: eso lo garantiza la base.
 */
const props = defineProps<{
  solicitud: WithdrawalListed
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [string] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const estado = reactive({ reason: '' })
const error = ref<string | null>(null)

function enviar() {
  const resultado = transition(props.solicitud, { to: 'rejected', on: '1970-01-01', reason: estado.reason })
  if (!resultado.ok) {
    error.value = t(resultado.error)
    return
  }
  error.value = null
  emit('submit', resultado.request.rejectionReason ?? '')
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-rechazo"
    @submit.prevent="enviar"
  >
    <p class="text-sm text-muted">
      {{ t('withdrawals.reject.hint') }}
      <span class="font-mono text-highlighted">{{ formatearImporte(solicitud.amount, idioma) }}</span>
    </p>

    <UFormField
      :label="t('withdrawals.reject.reason')"
      :error="error ?? undefined"
      required
      data-test="campo-rechazo-motivo"
    >
      <UTextarea
        v-model="estado.reason"
        :rows="3"
        class="w-full"
        data-test="rechazo-motivo"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        color="error"
        icon="i-lucide-x"
        :loading="enviando"
        :label="t('withdrawals.reject.submit')"
        data-test="confirmar-rechazo"
      />
    </div>
  </UForm>
</template>
