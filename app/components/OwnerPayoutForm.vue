<script setup lang="ts">
import type { FilaDelTablero } from '#shared/finance/tablero-de-cobros'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { MIMES_DE_COMPROBANTE, validarComprobante } from '#shared/payments/comprobantes'

/**
 * HU-63 · RF-63.6 · CA-63.8 — pagar el saldo positivo de una fracción con su
 * comprobante. Sin archivo no se emite; con uno que no sea PDF o imagen, o que
 * pese de más, tampoco. La cuenta de destino de la solicitud se repite aquí
 * para tenerla delante al transferir.
 */
const props = defineProps<{
  fila: FilaDelTablero
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [File] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

/** `shallowRef`: un `File` no se envuelve en un proxy reactivo; se emite tal cual llegó. */
const archivo = shallowRef<File | null>(null)
const error = ref<string | null>(null)
const estado = reactive({})

const retiro = computed(() => props.fila.withdrawal)

function elegirArchivo(evento: Event) {
  const entrada = evento.target as HTMLInputElement
  archivo.value = entrada.files?.[0] ?? null
  error.value = null
}

function enviar() {
  if (!archivo.value) {
    error.value = t('collections.errors.receipt_required')
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

defineExpose({ elegirArchivo })
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-pago-de-retiro"
    @submit.prevent="enviar"
  >
    <p
      v-if="retiro"
      class="text-sm text-muted"
    >
      {{ t('collections.pay.hint', { amount: formatearImporte(retiro.amount, idioma) }) }}
    </p>
    <dl
      v-if="retiro"
      class="rounded-lg border border-default bg-elevated/50 p-3 text-sm"
    >
      <dt class="text-xs uppercase tracking-wide text-muted">
        {{ t('ownerWallet.withdrawal.bank') }}
      </dt>
      <dd class="text-highlighted">
        {{ t('ownerWallet.withdrawal.bankLine', { bank: retiro.bank, kind: t(`ownerWallet.withdrawal.accountKinds.${retiro.accountKind}`), number: retiro.accountNumber }) }}
      </dd>
      <dd class="text-muted">
        {{ retiro.holder }}
      </dd>
    </dl>

    <UFormField
      :label="t('collections.pay.receipt')"
      :hint="t('collections.pay.receiptHint')"
      :error="error ?? undefined"
      required
      data-test="campo-comprobante-retiro"
    >
      <input
        type="file"
        :accept="MIMES_DE_COMPROBANTE.join(',')"
        class="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:text-default"
        data-test="retiro-comprobante"
        @change="elegirArchivo"
      >
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        color="success"
        icon="i-lucide-receipt"
        :loading="enviando"
        :label="t('collections.pay.submit')"
        data-test="confirmar-pago-de-retiro"
      />
    </div>
  </UForm>
</template>
