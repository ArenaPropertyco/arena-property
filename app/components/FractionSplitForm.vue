<script setup lang="ts">
import type { CopAmount } from '#shared/money/importe'
import { esImporte, pesos } from '#shared/money/importe'
import { FRACCIONES_POR_PROPIEDAD, validarPrecioDeFraccion } from '#shared/properties/fracciones'

/**
 * HU-09 · RF-09.1, RF-09.2, RF-09.3 — dividir una propiedad en sus 8 fracciones.
 *
 * El precio es dinero: entero de pesos (TR-02 · RF-D.1). Un decimal ni siquiera
 * llega a construirse como importe, así que se rechaza antes de emitir en vez de
 * redondearse en silencio, que es lo que prohíbe el principio 9.
 */
defineProps<{ enviando: boolean }>()

const emit = defineEmits<{ submit: [CopAmount] }>()

const { t } = useI18n()

const precio = ref('')
const error = ref<string | null>(null)

function enviar() {
  const numero = Number(precio.value)
  error.value = null

  if (!esImporte(numero)) {
    error.value = t('properties.validation.price_not_positive')
    return
  }

  const importe = pesos(numero)
  const problema = validarPrecioDeFraccion(importe)
  if (problema) {
    error.value = t(problema)
    return
  }

  emit('submit', importe)
}
</script>

<template>
  <UForm
    :state="{ precio }"
    class="space-y-4"
    data-test="formulario-fraccionar"
    @submit.prevent="enviar"
  >
    <p class="text-sm text-muted">
      {{ t('properties.fractions.subtitle') }}
    </p>

    <UFormField
      :label="t('properties.fractions.splitPrice')"
      :error="error ?? undefined"
      required
      data-test="campo-precio-fraccion"
    >
      <UInput
        v-model="precio"
        type="number"
        min="1"
        step="1"
        class="w-full font-mono"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        :loading="enviando"
        :label="t('properties.fractions.splitSubmit', { count: FRACCIONES_POR_PROPIEDAD })"
        data-test="enviar-fraccionamiento"
      />
    </div>
  </UForm>
</template>
