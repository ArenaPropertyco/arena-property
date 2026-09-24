<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { FilaDelTablero, PagoDelTablero } from '#shared/finance/tablero-de-cobros'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'

/**
 * HU-63 · RF-63.5 · CA-63.4 · CA-63.5 — el diálogo de confirmación de un pago.
 *
 * Repite el monto, el medio y la fracción para que quien confirma vea lo que
 * confirma, y emite una sola vez: mientras la página lleva la decisión a la
 * base el botón queda inutilizado, y la base rechaza igualmente un segundo
 * intento (CA-63.5).
 */
const props = defineProps<{
  pago: PagoDelTablero
  fila: FilaDelTablero
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [PagoDelTablero] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

function confirmar() {
  if (props.enviando) {
    return
  }
  emit('submit', props.pago)
}
</script>

<template>
  <div
    class="space-y-4"
    data-test="confirmacion-de-pago"
  >
    <p class="text-sm text-muted">
      {{ t('collections.confirm.hint', { amount: formatearImporte(pago.amount, idioma), date: formatearDia(pago.paidOn, idioma), method: pago.paymentMethodName, fraction: fila.fractionNumber }) }}
    </p>
    <dl class="rounded-lg border border-default bg-elevated/50 p-3 text-sm">
      <dt class="text-xs uppercase tracking-wide text-muted">
        {{ t('collections.columns.receipt') }}
      </dt>
      <dd class="font-mono text-highlighted">
        {{ formatearImporte(pago.amount, idioma) }}
      </dd>
      <dd class="text-muted">
        {{ pago.paymentMethodName }} · {{ pago.description }}
      </dd>
    </dl>

    <div class="flex justify-end">
      <UButton
        color="success"
        icon="i-lucide-check"
        :loading="enviando"
        :disabled="enviando"
        :label="t('collections.confirm.submit')"
        data-test="confirmar-pago"
        @click="confirmar"
      />
    </div>
  </div>
</template>
