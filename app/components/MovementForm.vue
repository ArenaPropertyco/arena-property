<script setup lang="ts">
import { hoy } from '#shared/dates/formato'
import { REPARTOS } from '#shared/finance/cuotas'
import type { Reparto } from '#shared/finance/cuotas'
import { categoriasPara, cuentasActivas, mediosActivos } from '#shared/finance/maestra'
import type { MaestraContable } from '#shared/finance/maestra'
import { MIMES_DE_ADJUNTO, validarAdjunto } from '#shared/finance/mantenimiento'
import type { ItemParaGasto } from '#shared/finance/mantenimiento'
import { validarMovimiento } from '#shared/finance/movimientos'
import type { NuevoMovimiento } from '#shared/finance/movimientos'
import type { FraccionImputableListada } from '#shared/finance/vistas'
import { esImporte, pesos } from '#shared/money/importe'

/**
 * HU-23 · RF-23.2, RF-23.7 · RT-06 — registrar un gasto común de una propiedad.
 *
 * El formulario valida con el dominio antes de emitir: monto entero mayor que
 * cero, categoría de la maestra permitida para la propiedad (D-01), medio, cuenta,
 * fecha de causación y descripción. La base vuelve a rechazar lo mismo por su
 * cuenta y genera las 8 cuotas; aquí no se prorratea nada.
 *
 * El reparto es una decisión explícita (RF-23.8, D-41): por omisión se prorratea
 * entre las 8 fracciones; un daño o una avería se imputan a una sola, y para eso se
 * ofrecen únicamente las fracciones vendidas, que son las que tienen a quién.
 *
 * En modo mantenimiento (HU-27 · RF-27.1) ofrece además a qué ítem del inventario
 * se asocia el gasto, o a la propiedad en general, y la factura o foto adjunta.
 * Sigue siendo el mismo gasto: lo reparte la base igual (RF-27.2).
 *
 * Pensado para el móvil: una columna, la fecha de hoy propuesta y el medio y la
 * cuenta preseleccionados con la primera entrada activa de la maestra.
 */
const props = withDefaults(defineProps<{
  propertyId: string
  maestra: MaestraContable
  /** Las 8 fracciones de la propiedad, para elegir a cuál imputar (RF-23.9). */
  fracciones: FraccionImputableListada[]
  enviando: boolean
  /** HU-27 · RF-27.1 · los ítems del inventario a los que se puede asociar el gasto. */
  items?: ItemParaGasto[]
  /** HU-27 · el gasto es de mantenimiento: ofrece ítem y factura. */
  mantenimiento?: boolean
}>(), { items: () => [], mantenimiento: false })

const emit = defineEmits<{ submit: [NuevoMovimiento, File | null] }>()

const { t } = useI18n()

/** RF-27.1 · «propiedad en general»: el selector no admite el vacío como valor. */
const GENERAL = '__general__'

const categorias = computed(() => categoriasPara(props.maestra.categorias, 'expense'))
const medios = computed(() => mediosActivos(props.maestra.medios))
const cuentas = computed(() => cuentasActivas(props.maestra.cuentas))

const estado = reactive({
  amount: null as number | null,
  categoryId: '',
  allocation: 'prorated' as Reparto,
  fractionId: '',
  paymentMethodId: medios.value[0]?.id ?? '',
  accountId: cuentas.value[0]?.id ?? '',
  incurredOn: hoy(),
  description: '',
  inventoryItemId: GENERAL,
})

/** `shallowRef`: un `File` no se envuelve en un proxy reactivo; se emite tal cual llegó. */
const archivo = shallowRef<File | null>(null)
const errores = ref<Record<string, string>>({})

/** RF-27.1 · a cualquier ítem, señalando los dados de baja: un mantenimiento tardío es válido. */
const opcionesDeItem = computed(() => [
  { value: GENERAL, label: t('finance.itemGeneral') },
  ...props.items.map(item => ({
    value: item.id,
    label: item.retired ? t('finance.itemRetired', { name: item.name }) : item.name,
  })),
])

function elegirArchivo(evento: Event) {
  const entrada = evento.target as HTMLInputElement
  archivo.value = entrada.files?.[0] ?? null
}

const opcionesDeCategoria = computed(() => categorias.value.map(categoria => ({ value: categoria.id, label: categoria.name })))
const opcionesDeMedio = computed(() => medios.value.map(medio => ({ value: medio.id, label: medio.name })))
const opcionesDeCuenta = computed(() => cuentas.value.map(cuenta => ({ value: cuenta.id, label: cuenta.name })))

const opcionesDeReparto = computed(() => REPARTOS.map(reparto => ({
  value: reparto,
  label: t(`finance.allocation.${reparto}`),
})))

/** RF-23.9 · solo las vendidas: a una fracción sin titular no hay a quién imputarle. */
const fraccionesImputables = computed(() => props.fracciones.filter(fraccion => fraccion.status === 'sold' && fraccion.ownerId !== null))

const opcionesDeFraccion = computed(() => fraccionesImputables.value.map(fraccion => ({
  value: fraccion.id,
  label: `${t('properties.fractions.label', { number: fraccion.number })} · ${fraccion.ownerLabel ?? fraccion.ownerId}`,
})))

const imputaAUnaFraccion = computed(() => estado.allocation === 'single_fraction')

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
    allocation: estado.allocation,
    fractionId: imputaAUnaFraccion.value && estado.fractionId !== '' ? estado.fractionId : null,
    ...(props.mantenimiento
      ? { maintenance: true, inventoryItemId: estado.inventoryItemId === GENERAL ? null : estado.inventoryItemId }
      : {}),
  }

  const encontrados = validarMovimiento(movimiento, props.maestra, props.fracciones, props.items)
  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))

  // CA-27.3 · la factura es opcional; si viene, tiene que ser válida.
  const problemaDeArchivo = archivo.value
    ? validarAdjunto({ mime: archivo.value.type, size: archivo.value.size })
    : null
  if (problemaDeArchivo) {
    errores.value.attachment = t(problemaDeArchivo)
  }
  if (encontrados.length > 0 || problemaDeArchivo) {
    return
  }

  emit('submit', movimiento, props.mantenimiento ? archivo.value : null)
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

    <UFormField
      v-if="mantenimiento"
      :label="t('finance.item')"
      :hint="t('finance.itemHint')"
      :error="errores.inventoryItemId"
      data-test="campo-item"
    >
      <USelect
        v-model="estado.inventoryItemId"
        :items="opcionesDeItem"
        class="w-full"
        data-test="gasto-item"
      />
    </UFormField>

    <UFormField
      :label="t('finance.allocation.label')"
      :hint="t('finance.allocation.hint')"
      required
      data-test="campo-reparto"
    >
      <URadioGroup
        v-model="estado.allocation"
        :items="opcionesDeReparto"
        value-key="value"
        orientation="horizontal"
        data-test="gasto-reparto"
      />
    </UFormField>

    <UFormField
      v-if="imputaAUnaFraccion"
      :label="t('finance.allocation.fraction')"
      :error="errores.fractionId"
      required
      data-test="campo-fraccion"
    >
      <USelect
        v-if="opcionesDeFraccion.length > 0"
        v-model="estado.fractionId"
        :items="opcionesDeFraccion"
        :placeholder="t('finance.allocation.fractionPlaceholder')"
        class="w-full"
        data-test="gasto-fraccion"
      />
      <p
        v-else
        class="text-sm text-error"
        data-test="sin-fracciones-vendidas"
      >
        {{ t('finance.allocation.noneSold') }}
      </p>
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

    <UFormField
      v-if="mantenimiento"
      :label="t('finance.attachment')"
      :hint="t('finance.attachmentHint')"
      :error="errores.attachment"
      data-test="campo-adjunto"
    >
      <input
        type="file"
        :accept="MIMES_DE_ADJUNTO.join(',')"
        class="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:text-default"
        data-test="gasto-adjunto"
        @change="elegirArchivo"
      >
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
