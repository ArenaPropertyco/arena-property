<script setup lang="ts">
import { formatearPorcentaje } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { PUNTOS_BASICOS_TOTALES, puntosBasicos as aPuntosBasicos } from '#shared/money/comision'

/**
 * HU-40 · RF-40.4, RF-40.5 · D-39 — la comisión de gestión de la renta, que el
 * Superadmin fija por propiedad.
 *
 * Se guarda en puntos básicos enteros (TR-02 RF-D.4) para que no exista un
 * porcentaje en coma flotante. Mientras no esté configurada se dice «sin
 * configurar», nunca «0 %»: un cero declarado y un dato ausente no son lo mismo, y
 * confundirlos haría creer que la fracción se queda con todo (P-09).
 */
const props = defineProps<{
  puntosBasicos: number | null
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [number] }>()

const { t, locale } = useI18n()

const porcentaje = ref<number | null>(
  props.puntosBasicos === null ? null : props.puntosBasicos / PUNTOS_BASICOS_TOTALES * 100,
)
const error = ref<string | null>(null)

const actual = computed(() => props.puntosBasicos === null
  ? t('rentals.commission.unset')
  : t('rentals.commission.current', { percent: formatearPorcentaje(props.puntosBasicos, locale.value as Idioma) }))

function enviar() {
  const valor = porcentaje.value === null ? Number.NaN : Number(porcentaje.value)

  if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
    error.value = t('rentals.validation.percentage_range')
    return
  }

  try {
    // La conversión a puntos básicos vive en `shared/money`: la vista no hace
    // aritmética monetaria, ni siquiera para un porcentaje (RF-D.7).
    const puntos = aPuntosBasicos(valor)
    error.value = null
    emit('submit', puntos)
  }
  catch {
    error.value = t('rentals.validation.percentage_range')
  }
}
</script>

<template>
  <UForm
    :state="{ porcentaje }"
    class="space-y-4"
    data-test="formulario-comision-renta"
    @submit.prevent="enviar"
  >
    <p
      class="text-sm text-muted"
      data-test="comision-actual"
    >
      {{ actual }}
    </p>

    <UFormField
      :label="t('rentals.commission.percentage')"
      :hint="t('rentals.commission.hint')"
      :error="error ?? undefined"
      required
      data-test="campo-comision"
    >
      <UInput
        v-model="porcentaje"
        type="number"
        step="0.01"
        min="0"
        max="100"
        class="w-full font-mono"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        :loading="enviando"
        :label="t('rentals.commission.submit')"
        data-test="enviar-comision"
      />
    </div>
  </UForm>
</template>
