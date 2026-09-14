<script setup lang="ts">
import { hoy } from '#shared/dates/formato'
import { categoriasPara, cuentasActivas, mediosActivos } from '#shared/finance/maestra'
import type { MaestraContable } from '#shared/finance/maestra'
import { validarMovimiento } from '#shared/finance/movimientos'
import type { NuevoMovimiento } from '#shared/finance/movimientos'
import { esImporte, pesos } from '#shared/money/importe'

/**
 * HU-23 · RF-23.2, RF-23.7 · RT-06 — registrar un gasto común de una propiedad.
 *
 * El formulario valida con el dominio antes de emitir: monto entero mayor que
 * cero, categoría de la maestra permitida para la propiedad (D-01), medio, cuenta,
 * fecha de causación y descripción. La base vuelve a rechazar lo mismo por su
 * cuenta y genera las 8 cuotas; aquí no se prorratea nada.
 *
 * Pensado para el móvil: una columna, la fecha de hoy propuesta y el medio y la
 * cuenta preseleccionados con la primera entrada activa de la maestra.
 */
const props = defineProps<{
  propertyId: string
  maestra: MaestraContable
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [NuevoMovimiento] }>()

const { t } = useI18n()

const categorias = computed(() => categoriasPara(props.maestra.categorias, 'expense'))
const medios = computed(() => mediosActivos(props.maestra.medios))
const cuentas = computed(() => cuentasActivas(props.maestra.cuentas))

const estado = reactive({
  amount: null as number | null,
  categoryId: '',
  paymentMethodId: medios.value[0]?.id ?? '',
  accountId: cuentas.value[0]?.id ?? '',
  incurredOn: hoy(),
  description: '',
})

const errores = ref<Record<string, string>>({})

const opcionesDeCategoria = computed(() => categorias.value.map(categoria => ({ value: categoria.id, label: categoria.name })))
const opcionesDeMedio = computed(() => medios.value.map(medio => ({ value: medio.id, label: medio.name })))
const opcionesDeCuenta = computed(() => cuentas.value.map(cuenta => ({ value: cuenta.id, label: cuenta.name })))

/** El campo numérico puede entregar texto o número según el navegador; solo cuenta un entero. */
function importeDelCampo(valor: number | string | null): number {
  if (valor === null || valor === '') {
    return 0
  }
  const numero = Number(valor)
  return esImporte(numero) ? numero : 0
}

function enviar() {
  const movimiento: NuevoMovimiento = {
    propertyId: props.propertyId,
    kind: 'expense',
    amount: pesos(importeDelCampo(estado.amount)),
    categoryId: estado.categoryId,
    paymentMethodId: estado.paymentMethodId,
    accountId: estado.accountId,
    incurredOn: estado.incurredOn,
    description: estado.description.trim(),
  }

  const encontrados = validarMovimiento(movimiento, props.maestra)
  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))
  if (encontrados.length > 0) {
    return
  }

  emit('submit', movimiento)
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-gasto"
    @submit.prevent="enviar"
  >
    <UFormField
      :label="t('finance.amount')"
      :hint="t('finance.amountHint')"
      :error="errores.amount"
      required
      data-test="campo-monto"
    >
      <UInput
        v-model="estado.amount"
        type="number"
        inputmode="numeric"
        min="1"
        step="1"
        class="w-full font-mono"
      />
    </UFormField>

    <UFormField
      :label="t('finance.category')"
      :error="errores.categoryId"
      required
      data-test="campo-categoria"
    >
      <USelect
        v-model="estado.categoryId"
        :items="opcionesDeCategoria"
        :placeholder="t('finance.categoryPlaceholder')"
        class="w-full"
        data-test="gasto-categoria"
      />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        :label="t('finance.method')"
        :error="errores.paymentMethodId"
        required
        data-test="campo-medio"
      >
        <USelect
          v-model="estado.paymentMethodId"
          :items="opcionesDeMedio"
          class="w-full"
          data-test="gasto-medio"
        />
      </UFormField>

      <UFormField
        :label="t('finance.account')"
        :error="errores.accountId"
        required
        data-test="campo-cuenta"
      >
        <USelect
          v-model="estado.accountId"
          :items="opcionesDeCuenta"
          class="w-full"
          data-test="gasto-cuenta"
        />
      </UFormField>
    </div>

    <UFormField
      :label="t('finance.incurredOn')"
      :hint="t('finance.incurredOnHint')"
      :error="errores.incurredOn"
      required
      data-test="campo-fecha"
    >
      <UInput
        v-model="estado.incurredOn"
        type="date"
        class="w-full"
      />
    </UFormField>

    <UFormField
      :label="t('finance.description')"
      :hint="t('finance.descriptionHint')"
      :error="errores.description"
      required
      data-test="campo-descripcion"
    >
      <UTextarea
        v-model="estado.description"
        :rows="2"
        class="w-full"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        :loading="enviando"
        :label="t('finance.submit')"
        data-test="enviar-gasto"
      />
    </div>
  </UForm>
</template>
