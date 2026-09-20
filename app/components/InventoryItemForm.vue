<script setup lang="ts">
import { CATEGORIAS_DE_INVENTARIO, ESTADOS_DE_ITEM, validarItem } from '#shared/properties/inventario'
import type { CategoriaDeInventario, EstadoDeItem, ItemDeInventario, NuevoItem } from '#shared/properties/inventario'

/**
 * HU-26 · RF-26.1 · RT-06 — alta y edición de un ítem del inventario.
 *
 * Valida con el dominio antes de emitir: nombre, categoría y estado del
 * catálogo, cantidad entera no negativa. La base vuelve a rechazar lo mismo por
 * su cuenta. Al editar viene prellenado con el ítem; emite siempre el ítem
 * completo y la página decide si es alta o cambio.
 */
const props = withDefaults(defineProps<{
  propertyId: string
  item?: ItemDeInventario | null
  enviando: boolean
}>(), { item: null })

const emit = defineEmits<{ submit: [NuevoItem] }>()

const { t } = useI18n()

const estado = reactive({
  name: props.item?.name ?? '',
  category: (props.item?.category ?? '') as CategoriaDeInventario | '',
  condition: (props.item?.condition ?? 'good') as EstadoDeItem,
  quantity: (props.item?.quantity ?? 1) as number | string | null,
  location: props.item?.location ?? '',
  notes: props.item?.notes ?? '',
})

const errores = ref<Record<string, string>>({})

const opcionesDeCategoria = computed(() => CATEGORIAS_DE_INVENTARIO.map(categoria => ({
  value: categoria,
  label: t(`inventory.categories.${categoria}`),
})))

const opcionesDeEstado = computed(() => ESTADOS_DE_ITEM.map(condicion => ({
  value: condicion,
  label: t(`inventory.conditions.${condicion}`),
})))

/** El campo numérico puede entregar texto o número según el navegador. */
function cantidadDelCampo(valor: number | string | null): number {
  if (valor === null || valor === '') {
    return Number.NaN
  }
  return Number(valor)
}

function enviar() {
  const item: NuevoItem = {
    propertyId: props.propertyId,
    name: estado.name.trim(),
    category: estado.category as CategoriaDeInventario,
    condition: estado.condition,
    quantity: cantidadDelCampo(estado.quantity),
    location: estado.location.trim() === '' ? null : estado.location.trim(),
    notes: estado.notes.trim() === '' ? null : estado.notes.trim(),
  }

  const encontrados = validarItem(item)
  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))
  if (encontrados.length > 0) {
    return
  }

  emit('submit', item)
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-item"
    @submit.prevent="enviar"
  >
    <UFormField
      :label="t('inventory.name')"
      :error="errores.name"
      required
      data-test="campo-nombre"
    >
      <UInput
        v-model="estado.name"
        :placeholder="t('inventory.namePlaceholder')"
        class="w-full"
      />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        :label="t('inventory.category')"
        :error="errores.category"
        required
        data-test="campo-categoria"
      >
        <USelect
          v-model="estado.category"
          :items="opcionesDeCategoria"
          class="w-full"
          data-test="item-categoria"
        />
      </UFormField>

      <UFormField
        :label="t('inventory.condition')"
        :error="errores.condition"
        required
        data-test="campo-estado"
      >
        <USelect
          v-model="estado.condition"
          :items="opcionesDeEstado"
          class="w-full"
          data-test="item-estado"
        />
      </UFormField>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        :label="t('inventory.quantity')"
        :hint="t('inventory.quantityHint')"
        :error="errores.quantity"
        required
        data-test="campo-cantidad"
      >
        <UInput
          v-model="estado.quantity"
          type="number"
          inputmode="numeric"
          min="0"
          step="1"
          class="w-full font-mono"
        />
      </UFormField>

      <UFormField
        :label="t('inventory.location')"
        :hint="t('inventory.locationHint')"
        data-test="campo-ubicacion"
      >
        <UInput
          v-model="estado.location"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      :label="t('inventory.notes')"
      data-test="campo-notas"
    >
      <UTextarea
        v-model="estado.notes"
        :rows="2"
        class="w-full"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        :loading="enviando"
        :label="t('inventory.submit')"
        data-test="enviar-item"
      />
    </div>
  </UForm>
</template>
