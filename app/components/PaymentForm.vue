<script setup lang="ts">
import { hoy } from '#shared/dates/formato'
import { esImporte, pesos } from '#shared/money/importe'
import { METODOS_DE_PAGO, validarAbono } from '#shared/payments/abonos'
import type { MetodoDePago, NuevoAbono } from '#shared/payments/abonos'
import { MIMES_DE_COMPROBANTE, validarComprobante } from '#shared/payments/comprobantes'
import type { PlanDePagosListado } from '#shared/payments/vistas'

/**
 * HU-58 · RF-58.2, RF-58.4 — registrar un abono contra el precio pactado.
 *
 * El formulario valida con el dominio antes de emitir: el sobrepago y la falta de
 * comprobante se rechazan aquí con su mensaje, y la base los vuelve a rechazar por
 * su cuenta. El comprobante se adjunta como archivo; subirlo es de la página.
 */
const props = defineProps<{
  plan: PlanDePagosListado
  enviando: boolean
}>()

const emit = defineEmits<{
  submit: [{ abono: Omit<NuevoAbono, 'receiptPath'>, archivo: File }]
}>()

const { t } = useI18n()

const estado = reactive({
  amount: '',
  paidOn: hoy(),
  method: 'transfer' as MetodoDePago,
  note: '',
})

const archivo = ref<File | null>(null)
const errores = ref<Record<string, string>>({})

const opcionesDeMetodo = computed(() => METODOS_DE_PAGO.map(metodo => ({
  value: metodo,
  label: t(`payments.methods.${metodo}`),
})))

function elegirArchivo(evento: Event) {
  const entrada = evento.target as HTMLInputElement
  archivo.value = entrada.files?.[0] ?? null
}

function enviar() {
  const numero = Number(estado.amount)
  const abono: Omit<NuevoAbono, 'receiptPath'> = {
    amount: esImporte(numero) ? pesos(numero) : pesos(0),
    paidOn: estado.paidOn,
    method: estado.method,
    note: estado.note.trim() === '' ? null : estado.note.trim(),
  }

  const encontrados = validarAbono(
    { ...abono, receiptPath: archivo.value ? archivo.value.name : null },
    { precioPactado: props.plan.agreedPrice, abonado: props.plan.paidTotal, estado: props.plan.status },
  )
  const problemaDeArchivo = archivo.value
    ? validarComprobante({ mime: archivo.value.type, size: archivo.value.size })
    : null

  errores.value = {
    ...Object.fromEntries(encontrados.map(error => [error.name, t(error.message)])),
    ...(problemaDeArchivo ? { receiptPath: t(problemaDeArchivo) } : {}),
  }
  if (encontrados.length > 0 || problemaDeArchivo || !archivo.value) {
    return
  }

  emit('submit', { abono, archivo: archivo.value })
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-abono"
    @submit.prevent="enviar"
  >
    <p
      v-if="errores.plan"
      class="text-sm text-error"
      data-test="error-plan"
    >
      {{ errores.plan }}
    </p>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        :label="t('payments.amount')"
        :error="errores.amount"
        required
        data-test="campo-monto"
      >
        <UInput
          v-model="estado.amount"
          type="number"
          min="1"
          step="1"
          class="w-full font-mono"
        />
      </UFormField>

      <UFormField
        :label="t('payments.paidOn')"
        :error="errores.paidOn"
        required
        data-test="campo-fecha"
      >
        <UInput
          v-model="estado.paidOn"
          type="date"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      :label="t('payments.method')"
      :error="errores.method"
      required
      data-test="campo-metodo"
    >
      <URadioGroup
        v-model="estado.method"
        :items="opcionesDeMetodo"
        value-key="value"
        orientation="horizontal"
      />
    </UFormField>

    <UFormField
      :label="t('payments.receipt')"
      :hint="t('payments.receiptHint')"
      :error="errores.receiptPath"
      required
      data-test="campo-comprobante"
    >
      <input
        type="file"
        :accept="MIMES_DE_COMPROBANTE.join(',')"
        class="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:text-default"
        data-test="archivo-comprobante"
        @change="elegirArchivo"
      >
    </UFormField>

    <UFormField
      :label="t('payments.note')"
      :hint="t('payments.noteHint')"
      data-test="campo-nota"
    >
      <UTextarea
        v-model="estado.note"
        :rows="2"
        class="w-full"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        :loading="enviando"
        :label="t('payments.submit')"
        data-test="enviar-abono"
      />
    </div>
  </UForm>
</template>
