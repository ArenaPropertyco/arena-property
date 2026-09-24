<script setup lang="ts">
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { WithdrawalListed } from '#shared/referrals/views'
import { MIMES_DE_COMPROBANTE, validarComprobante } from '#shared/referrals/withdrawals'

/**
 * HU-56 · RF-56.4 · CA-56.6 — registrar el pago de un retiro aprobado con su
 * comprobante. Sin archivo no se emite; con uno que no sea PDF o imagen, o que
 * pese de más, tampoco. El pago va a la cuenta bancaria de HU-49, que se repite
 * aquí para que el Superadmin la tenga delante al transferir.
 */
defineProps<{
  solicitud: WithdrawalListed
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [File] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

/** `shallowRef`: un `File` no se envuelve en un proxy reactivo; se emite tal cual llegó. */
const archivo = shallowRef<File | null>(null)
const error = ref<string | null>(null)
const estado = reactive({})

function elegirArchivo(evento: Event) {
  const entrada = evento.target as HTMLInputElement
  archivo.value = entrada.files?.[0] ?? null
  error.value = null
}

function enviar() {
  if (!archivo.value) {
    error.value = t('wallet.withdrawal.errors.receipt_required')
    return
  }
  const problema = validarComprobante({ mime: archivo.value.type, size: archivo.value.size })
  if (problema) {
    error.value = t(problema)
    return
  }
  error.value = null
  emit('submit', archivo.value)
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-pago"
    @submit.prevent="enviar"
  >
    <p class="text-sm text-muted">
      {{ t('withdrawals.pay.hint', { amount: formatearImporte(solicitud.amount, idioma) }) }}
    </p>
    <dl class="rounded-lg border border-default bg-elevated/50 p-3 text-sm">
      <dt class="text-xs uppercase tracking-wide text-muted">
        {{ t('wallet.requests.columns.bank') }}
      </dt>
      <dd class="text-highlighted">
        {{ t('wallet.requests.bankLine', { bank: solicitud.bank, kind: t(`wallet.requests.accountKinds.${solicitud.accountKind}`), number: solicitud.accountNumber }) }}
      </dd>
      <dd class="text-muted">
        {{ t('wallet.requests.holderLine', { holder: solicitud.holder }) }}
      </dd>
    </dl>

    <UFormField
      :label="t('withdrawals.pay.receipt')"
      :hint="t('withdrawals.pay.receiptHint')"
      :error="error ?? undefined"
      required
      data-test="campo-comprobante"
    >
      <input
        type="file"
        :accept="MIMES_DE_COMPROBANTE.join(',')"
        class="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:text-default"
        data-test="pago-comprobante"
        @change="elegirArchivo"
      >
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        color="success"
        icon="i-lucide-receipt"
        :loading="enviando"
        :label="t('withdrawals.pay.submit')"
        data-test="confirmar-pago"
      />
    </div>
  </UForm>
</template>
