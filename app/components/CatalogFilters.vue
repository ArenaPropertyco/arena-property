<script setup lang="ts">
import type { CopAmount } from '#shared/money/importe'
import { esImporte, pesos } from '#shared/money/importe'
import type { FiltroDeCatalogo } from '#shared/properties/catalogo-publico'
import { filtroDeCatalogoVacio, hayFiltroDeCatalogoActivo } from '#shared/properties/catalogo-publico'
import { COMERCIALES } from '#shared/properties/estados'

/**
 * HU-01 · RF-01.3 · D-18 — filtros combinables del catálogo público.
 *
 * Componente controlado: recibe el filtro y emite el filtro completo con cada
 * cambio, para que el estado viva en un solo sitio (el composable). Las regiones y
 * el rango de precio llegan de los datos.
 */
const props = defineProps<{
  filtro: FiltroDeCatalogo
  regiones: string[]
  rango: { min: CopAmount, max: CopAmount } | null
  total: number
  mostradas: number
}>()

const emit = defineEmits<{ 'update:filtro': [FiltroDeCatalogo] }>()

const { t } = useI18n()

/** Centinela de «sin filtrar»: el `Select` reserva la cadena vacía. */
const TODOS = '*' as const

function cambiar<C extends keyof FiltroDeCatalogo>(criterio: C, valor: FiltroDeCatalogo[C]) {
  emit('update:filtro', { ...props.filtro, [criterio]: valor })
}

function criterio(valor: unknown): string | null {
  return valor === TODOS || valor === '' || valor === undefined ? null : String(valor)
}

/** Un precio escrito se vuelve importe entero; vacío o inválido no filtra. */
function importe(valor: string | number): CopAmount | null {
  const numero = Number(valor)
  return valor !== '' && esImporte(numero) && numero > 0 ? pesos(numero) : null
}

const regiones = computed(() => [
  { label: t('catalog.filters.allRegions'), value: TODOS },
  ...props.regiones.map(region => ({ label: region, value: region })),
])

const estados = computed(() => [
  { label: t('catalog.filters.allStatuses'), value: TODOS },
  ...COMERCIALES.map(estado => ({ label: t(`properties.commercial.${estado}`), value: estado })),
])

const activo = computed(() => hayFiltroDeCatalogoActivo(props.filtro))
</script>

<template>
  <div
    class="space-y-4 rounded-2xl border border-default bg-default p-4 sm:p-5"
    data-test="filtros-catalogo"
  >
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UFormField
        :label="t('catalog.filters.region')"
        data-test="filtro-region"
      >
        <USelect
          :model-value="filtro.region ?? TODOS"
          :items="regiones"
          class="w-full"
          @update:model-value="cambiar('region', criterio($event))"
        />
      </UFormField>

      <UFormField
        :label="t('catalog.filters.priceMin')"
        :hint="rango ? String(rango.min) : undefined"
        data-test="filtro-precio-min"
      >
        <UInput
          :model-value="filtro.precioMin ?? ''"
          type="number"
          min="0"
          step="1000000"
          class="w-full font-mono"
          @update:model-value="cambiar('precioMin', importe($event))"
        />
      </UFormField>

      <UFormField
        :label="t('catalog.filters.priceMax')"
        :hint="rango ? String(rango.max) : undefined"
        data-test="filtro-precio-max"
      >
        <UInput
          :model-value="filtro.precioMax ?? ''"
          type="number"
          min="0"
          step="1000000"
          class="w-full font-mono"
          @update:model-value="cambiar('precioMax', importe($event))"
        />
      </UFormField>

      <UFormField
        :label="t('catalog.filters.status')"
        data-test="filtro-estado"
      >
        <USelect
          :model-value="filtro.comercial ?? TODOS"
          :items="estados"
          class="w-full"
          @update:model-value="cambiar('comercial', criterio($event) as FiltroDeCatalogo['comercial'])"
        />
      </UFormField>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <UCheckbox
        :model-value="filtro.listaDeEspera"
        :label="t('catalog.filters.waitlist')"
        data-test="filtro-lista-espera"
        @update:model-value="cambiar('listaDeEspera', $event === true)"
      />

      <div class="flex items-center gap-3 text-sm text-muted">
        <span data-test="conteo-catalogo">{{ t('catalog.count', { shown: mostradas, total }) }}</span>
        <UButton
          v-if="activo"
          variant="link"
          size="sm"
          icon="i-lucide-x"
          :label="t('catalog.filters.clear')"
          data-test="limpiar-filtros"
          @click="emit('update:filtro', filtroDeCatalogoVacio())"
        />
      </div>
    </div>
  </div>
</template>
