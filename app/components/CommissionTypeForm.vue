<script setup lang="ts">
import { puntosBasicos } from '#shared/money/comision'
import { pesos } from '#shared/money/importe'
import { COMMISSION_KINDS, MAX_BASIS_POINTS, validateType } from '#shared/referrals/commission'
import type { CommissionKind, CommissionType, CommissionTypeDraft, CommissionTypeError, CommissionTypeField } from '#shared/referrals/commission'

/**
 * HU-52 · RF-52.1, RF-52.3 · CA-52.3 — el Superadmin crea un tipo de comisión:
 * un nombre y un valor, fijo en pesos o porcentual sobre el precio pactado.
 *
 * El porcentaje se escribe como se lee (5 %) y viaja en puntos básicos: la
 * conversión y la validación son del motor puro, aquí solo se recogen y se
 * traducen los rechazos.
 */
const props = defineProps<{
  types: CommissionType[]
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [CommissionTypeDraft] }>()

const { t } = useI18n()

const estado = reactive({
  name: '',
  kind: 'percentage' as CommissionKind,
  porcentaje: '',
  monto: '',
  makeDefault: false,
})

const errores = ref<CommissionTypeError[]>([])

const opcionesDeClase = computed(() => COMMISSION_KINDS.map(kind => ({
  label: t(`referrals.commission.kinds.${kind}`),
  value: kind,
})))

/** El borrador tal como lo entiende el motor; un número ilegible se convierte en `null`. */
function borrador(): CommissionTypeDraft {
  if (estado.kind === 'fixed') {
    const valor = Number(estado.monto)
    return {
      name: estado.name,
      kind: 'fixed',
      amount: estado.monto.trim() !== '' && Number.isInteger(valor) ? pesos(valor) : null,
      basisPoints: null,
      makeDefault: estado.makeDefault,
    }
  }

  let puntos: number | null = null
  try {
    const valor = Number(estado.porcentaje)
    puntos = estado.porcentaje.trim() !== '' && Number.isFinite(valor) ? puntosBasicos(valor) : null
  }
  catch {
    // Más de dos decimales: el motor lo rechaza igual por rango.
    puntos = MAX_BASIS_POINTS + 1
  }

  return { name: estado.name, kind: 'percentage', amount: null, basisPoints: puntos, makeDefault: estado.makeDefault }
}

function enviar() {
  const draft = borrador()
  errores.value = validateType(draft, { types: props.types })
  if (errores.value.length > 0) {
    return
  }
  emit('submit', draft)
}

function errorDe(campo: CommissionTypeField): string | undefined {
  const error = errores.value.find(e => e.name === campo)
  return error ? t(error.message) : undefined
}

defineExpose({
  limpiar: () => Object.assign(estado, { name: '', porcentaje: '', monto: '', makeDefault: false }),
})
</script>

<template>
  <UForm
    :state="estado"
    class="grid gap-4 rounded-2xl border border-default bg-default p-4 sm:grid-cols-3"
    data-test="formulario-tipo-comision"
    @submit.prevent="enviar"
  >
    <UFormField
      :label="t('referrals.commission.name')"
      :hint="t('referrals.commission.nameHint')"
      :error="errorDe('name')"
      required
      data-test="campo-comision-nombre"
    >
      <UInput
        v-model="estado.name"
        class="w-full"
        data-test="comision-nombre"
      />
    </UFormField>

    <UFormField
      :label="t('referrals.commission.kind')"
      required
    >
      <USelect
        v-model="estado.kind"
        :items="opcionesDeClase"
        class="w-full"
        data-test="comision-clase"
      />
    </UFormField>

    <UFormField
      v-if="estado.kind === 'percentage'"
      :label="t('referrals.commission.percentage')"
      :hint="t('referrals.commission.percentageHint')"
      :error="errorDe('basisPoints')"
      required
      data-test="campo-comision-porcentaje"
    >
      <UInput
        v-model="estado.porcentaje"
        type="number"
        step="0.01"
        min="0.01"
        max="100"
        class="w-full"
        data-test="comision-porcentaje"
      />
    </UFormField>

    <UFormField
      v-else
      :label="t('referrals.commission.amount')"
      :hint="t('referrals.commission.amountHint')"
      :error="errorDe('amount')"
      required
      data-test="campo-comision-monto"
    >
      <UInput
        v-model="estado.monto"
        type="number"
        min="1"
        step="1"
        class="w-full"
        data-test="comision-monto"
      />
    </UFormField>

    <div class="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
      <UCheckbox
        v-model="estado.makeDefault"
        :label="t('referrals.commission.makeDefault')"
        data-test="comision-predeterminado"
      />
      <UButton
        type="submit"
        icon="i-lucide-plus"
        :loading="enviando"
        :label="t('referrals.commission.create')"
        data-test="guardar-comision"
      />
    </div>
  </UForm>
</template>
