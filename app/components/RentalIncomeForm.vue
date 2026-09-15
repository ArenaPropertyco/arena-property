<script setup lang="ts">
import { comisionDeGestion, esAtribuible } from '#shared/finance/ingresos'
import { formatearImporte, formatearPorcentaje } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { esImporte, pesos, restar } from '#shared/money/importe'
import type { ReservaListada } from '#shared/scheduling/vistas-renta'

/**
 * HU-40 · RF-40.1, RF-40.2, RF-40.4, RF-40.5 · D-39 — el ingreso de una reserva.
 *
 * La previsualización usa la **misma función** que la base aplicará al guardar, así
 * que lo que el Administrador ve antes de confirmar es exactamente lo que se va a
 * registrar. Sobre una semana liberada sin comisión configurada no se ofrece el
 * botón: la base lo rechazaría (RF-40.5) y ofrecerlo sería prometer algo que no se
 * puede cumplir.
 */
const props = defineProps<{
  reserva: ReservaListada
  /** RF-40.4 · comisión de gestión de la propiedad; `null` si no está configurada. */
  comisionPuntosBasicos: number | null
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [number] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)
const monto = ref<number | null>(null)
const error = ref<string | null>(null)

const atribuible = computed(() => esAtribuible(props.reserva.originReason))
/** RF-40.5 · CA-40.5 · falta el dato sin el que el ingreso no puede repartirse. */
const faltaComision = computed(() => atribuible.value && props.comisionPuntosBasicos === null)

const bruto = computed(() => {
  const valor = monto.value === null ? Number.NaN : Number(monto.value)
  return esImporte(valor) && valor > 0 ? pesos(valor) : null
})

const previsualizacion = computed(() => {
  if (bruto.value === null) {
    return null
  }
  if (!atribuible.value) {
    return t('rentals.income.proratedPreview')
  }
  if (props.comisionPuntosBasicos === null) {
    return null
  }

  const comision = comisionDeGestion(bruto.value, props.comisionPuntosBasicos)

  return t('rentals.income.commissionPreview', {
    percent: formatearPorcentaje(props.comisionPuntosBasicos, idioma.value),
    amount: formatearImporte(comision, idioma.value),
    fraction: props.reserva.originFraction ?? '',
    net: formatearImporte(restar(bruto.value, comision), idioma.value),
  })
})

function enviar() {
  if (bruto.value === null) {
    error.value = t('rentals.validation.amount_not_positive')
    return
  }

  error.value = null
  emit('submit', bruto.value)
}
</script>

<template>
  <UForm
    :state="{ monto }"
    class="space-y-4"
    data-test="formulario-ingreso-renta"
    @submit.prevent="enviar"
  >
    <UAlert
      v-if="faltaComision"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :description="t('rentals.income.missingCommission')"
      data-test="sin-comision"
    />

    <UFormField
      :label="t('rentals.income.amount')"
      :hint="t('rentals.income.amountHint')"
      :error="error ?? undefined"
      required
      data-test="campo-ingreso"
    >
      <UInput
        v-model="monto"
        type="number"
        inputmode="numeric"
        min="1"
        step="1"
        class="w-full font-mono"
      />
    </UFormField>

    <p
      v-if="previsualizacion"
      class="text-sm text-muted"
      data-test="previsualizacion"
    >
      {{ previsualizacion }}
    </p>

    <div
      v-if="!faltaComision"
      class="flex justify-end"
    >
      <UButton
        type="submit"
        :loading="enviando"
        :label="t('rentals.income.submit')"
        data-test="enviar-ingreso"
      />
    </div>
  </UForm>
</template>
