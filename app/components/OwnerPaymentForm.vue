<script setup lang="ts">
import { formatearMes } from '#shared/dates/formato'
import { pendienteDeReportar, validateOwnerPayment } from '#shared/finance/cobros'
import type { OwnerPayment } from '#shared/finance/cobros'
import type { MedioDePago } from '#shared/finance/maestra'
import type { OwnerChargeListed } from '#shared/finance/vistas'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'
import { esImporte, pesos } from '#shared/money/importe'
import { MIMES_DE_COMPROBANTE, validarComprobante } from '#shared/payments/comprobantes'

/**
 * HU-62 · RF-62.7 · CA-62.6 · CA-62.7 — reportar el pago de un cobro.
 *
 * Valida con el dominio antes de emitir: monto entero mayor que cero y no por
 * encima de lo pendiente, fecha válida, medio de la maestra, descripción y
 * comprobante en PDF o imagen de hasta 10 MB. La base vuelve a rechazar lo
 * mismo por su cuenta.
 */
const props = defineProps<{
  cobro: OwnerChargeListed
  medios: MedioDePago[]
  enviando: boolean
}>()

const emit = defineEmits<{
  submit: [{ amount: CopAmount, paidOn: string, paymentMethodId: string, description: string, file: File }]
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const estado = reactive({
  amount: null as number | string | null,
  paidOn: '',
  paymentMethodId: '',
  description: '',
})
/** `shallowRef`: un `File` no se envuelve en un proxy reactivo; se emite tal cual llegó. */
const archivo = shallowRef<File | null>(null)
const errores = ref<Record<string, string>>({})

const opciones = computed(() => props.medios.filter(medio => medio.active).map(medio => ({ label: medio.name, value: medio.id })))

const pagos = computed<OwnerPayment[]>(() => props.cobro.payments.map(pago => ({ ...pago, paymentMethodId: '' })))
const pendiente = computed(() => formatearImporte(pendienteDeReportar(props.cobro, pagos.value), idioma.value))

/** El campo numérico puede entregar texto o número según el navegador; solo cuenta un entero. */
function importeDelCampo(valor: number | string | null): CopAmount | null {
  if (valor === null || valor === '') {
    return null
  }
  const numero = Number(valor)
  return esImporte(numero) ? pesos(numero) : null
}

function elegirArchivo(evento: Event) {
  const entrada = evento.target as HTMLInputElement
  archivo.value = entrada.files?.[0] ?? null
  delete errores.value.receipt
}

const CAMPO_DE_CLAVE: Record<string, string> = {
  'ownerWallet.payment.validation.amount_required': 'amount',
  'ownerWallet.payment.validation.above_charge': 'amount',
  'ownerWallet.payment.validation.charge_closed': 'amount',
  'ownerWallet.payment.validation.method_required': 'method',
  'ownerWallet.payment.validation.description_required': 'description',
  'ownerWallet.payment.validation.date_invalid': 'paidOn',
  'ownerWallet.payment.validation.receipt_required': 'receipt',
}

function enviar() {
  const monto = importeDelCampo(estado.amount)
  const problemas = validateOwnerPayment(
    { amount: monto, paidOn: estado.paidOn, paymentMethodId: estado.paymentMethodId, description: estado.description, receiptPath: archivo.value ? archivo.value.name : null },
    { ...props.cobro, status: props.cobro.status },
    pagos.value,
  )
  const nuevos: Record<string, string> = {}
  for (const problema of problemas) {
    const campo = CAMPO_DE_CLAVE[problema] ?? 'amount'
    nuevos[campo] ??= t(problema)
  }
  if (archivo.value) {
    const formato = validarComprobante({ mime: archivo.value.type, size: archivo.value.size })
    if (formato) {
      nuevos.receipt = t(formato)
    }
  }
  errores.value = nuevos
  if (Object.keys(nuevos).length > 0 || monto === null || !archivo.value) {
    return
  }
  emit('submit', { amount: monto, paidOn: estado.paidOn, paymentMethodId: estado.paymentMethodId, description: estado.description.trim(), file: archivo.value })
}

defineExpose({ elegirArchivo })
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-pago-propietario"
    @submit.prevent="enviar"
  >
    <p class="text-sm text-muted">
      {{ t('ownerWallet.payment.hint', { pending: pendiente }) }}
    </p>
    <p class="text-xs text-muted">
      {{ cobro.propertyName }} · {{ formatearMes(cobro.period, idioma) }}
    </p>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        :label="t('ownerWallet.payment.amount')"
        :hint="t('ownerWallet.payment.amountHint')"
        :error="errores.amount"
        required
        data-test="campo-pago-monto"
      >
        <UInput
          v-model="estado.amount"
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          class="w-full font-mono"
          data-test="pago-monto"
        />
      </UFormField>

      <UFormField
        :label="t('ownerWallet.payment.paidOn')"
        :error="errores.paidOn"
        required
        data-test="campo-pago-fecha"
      >
        <UInput
          v-model="estado.paidOn"
          type="date"
          class="w-full"
          data-test="pago-fecha"
        />
      </UFormField>
    </div>

    <UFormField
      :label="t('ownerWallet.payment.method')"
      :error="errores.method"
      required
      data-test="campo-pago-medio"
    >
      <USelect
        v-model="estado.paymentMethodId"
        :items="opciones"
        :placeholder="t('ownerWallet.payment.methodPlaceholder')"
        class="w-full"
        data-test="pago-medio"
      />
    </UFormField>

    <UFormField
      :label="t('ownerWallet.payment.description')"
      :hint="t('ownerWallet.payment.descriptionHint')"
      :error="errores.description"
      required
      data-test="campo-pago-descripcion"
    >
      <UInput
        v-model="estado.description"
        class="w-full"
        data-test="pago-descripcion"
      />
    </UFormField>

    <UFormField
      :label="t('ownerWallet.payment.receipt')"
      :hint="t('ownerWallet.payment.receiptHint')"
      :error="errores.receipt"
      required
      data-test="campo-pago-comprobante"
    >
      <input
        type="file"
        :accept="MIMES_DE_COMPROBANTE.join(',')"
        class="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:text-default"
        data-test="pago-archivo"
        @change="elegirArchivo"
      >
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        icon="i-lucide-send"
        :loading="enviando"
        :label="t('ownerWallet.payment.submit')"
        data-test="enviar-pago"
      />
    </div>
  </UForm>
</template>
