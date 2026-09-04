<script setup lang="ts">
import { validarAnulacion } from '#shared/payments/abonos'

/**
 * TR-01 · RF-A.4 — un motivo obligatorio antes de una operación que lo exige:
 * anular un abono, anular una compra. Reutilizable: recibe los textos y emite el
 * motivo ya recortado y no vacío.
 */
defineProps<{
  descripcion: string
  etiqueta: string
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [string] }>()

const { t } = useI18n()

const motivo = ref('')
const error = ref<string | null>(null)

function enviar() {
  const problemas = validarAnulacion(motivo.value)
  error.value = problemas[0] ? t(problemas[0]) : null
  if (problemas.length > 0) {
    return
  }

  emit('submit', motivo.value.trim())
}
</script>

<template>
  <UForm
    :state="{ motivo }"
    class="space-y-4"
    data-test="formulario-motivo"
    @submit.prevent="enviar"
  >
    <p class="text-sm text-muted">
      {{ descripcion }}
    </p>

    <UFormField
      :label="t('payments.reason')"
      :hint="t('payments.reasonHint')"
      :error="error ?? undefined"
      required
      data-test="campo-motivo"
    >
      <UTextarea
        v-model="motivo"
        :rows="3"
        class="w-full"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        color="error"
        :loading="enviando"
        :label="etiqueta"
        data-test="enviar-motivo"
      />
    </div>
  </UForm>
</template>
