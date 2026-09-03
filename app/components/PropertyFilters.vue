<script setup lang="ts">
import type { FiltroDePropiedades } from '#shared/properties/catalogo'
import { filtroVacio, hayFiltroActivo } from '#shared/properties/catalogo'
import { COMERCIALES, VISIBILIDADES } from '#shared/properties/estados'
import type { OpcionDeCuenta } from '#shared/properties/vistas'

/**
 * HU-10 · RF-10.2 — filtros combinables de la vista global.
 *
 * Componente controlado: recibe el filtro y emite el filtro **completo** cada vez
 * que cambia un criterio. Así el estado vive en un solo sitio (el composable) y no
 * hay dos versiones del filtro discrepando entre la pantalla y la consulta.
 *
 * Las opciones de región y administrador se reciben; no se inventan.
 */
const props = defineProps<{
  filtro: FiltroDePropiedades
  regiones: string[]
  administradores: OpcionDeCuenta[]
  total: number
  mostradas: number
}>()

const emit = defineEmits<{ 'update:filtro': [FiltroDePropiedades] }>()

const { t } = useI18n()

function cambiar<C extends keyof FiltroDePropiedades>(criterio: C, valor: FiltroDePropiedades[C]) {
  emit('update:filtro', { ...props.filtro, [criterio]: valor })
}

/**
 * Centinela de «sin filtrar». No puede ser cadena vacía: el `Select` la reserva
 * para «sin selección», y tampoco puede coincidir con una región o un estado real.
 */
const TODOS = '*' as const

function criterio(valor: unknown): string | null {
  return valor === TODOS || valor === '' ? null : String(valor)
}

const opcionesDeRegion = computed(() => [
  { value: TODOS, label: t('properties.filters.all') },
  ...props.regiones.map(region => ({ value: region, label: region })),
])

const opcionesDeAdmin = computed(() => [
  { value: TODOS, label: t('properties.filters.all') },
  ...props.administradores.map(cuenta => ({ value: cuenta.id, label: cuenta.label })),
])

const opcionesDeVisibilidad = computed(() => [
  { value: TODOS, label: t('properties.filters.all') },
  ...VISIBILIDADES.map(estado => ({ value: estado, label: t(`properties.visibility.${estado}`) })),
])

const opcionesComerciales = computed(() => [
  { value: TODOS, label: t('properties.filters.all') },
  ...COMERCIALES.map(estado => ({ value: estado, label: t(`properties.commercial.${estado}`) })),
])

const activo = computed(() => hayFiltroActivo(props.filtro))
</script>

<template>
  <div class="space-y-3 rounded-lg border border-default p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm font-medium">
        {{ t('properties.filters.title') }}
      </p>
      <p class="font-mono text-xs text-muted">
        {{ t('properties.filters.results', { count: mostradas, total }) }}
      </p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <UFormField
        :label="t('properties.filters.search')"
        data-test="filtro-texto"
      >
        <UInput
          :model-value="filtro.texto ?? ''"
          icon="i-lucide-search"
          class="w-full"
          @update:model-value="cambiar('texto', String($event))"
        />
      </UFormField>

      <UFormField
        :label="t('properties.filters.admin')"
        data-test="filtro-admin"
      >
        <USelect
          :model-value="filtro.administrador ?? TODOS"
          :items="opcionesDeAdmin"
          class="w-full"
          @update:model-value="cambiar('administrador', criterio($event))"
        />
      </UFormField>

      <UFormField
        :label="t('properties.filters.visibility')"
        data-test="filtro-visibilidad"
      >
        <USelect
          :model-value="filtro.visibilidad ?? TODOS"
          :items="opcionesDeVisibilidad"
          class="w-full"
          @update:model-value="cambiar('visibilidad', criterio($event) as FiltroDePropiedades['visibilidad'])"
        />
      </UFormField>

      <UFormField
        :label="t('properties.filters.commercial')"
        data-test="filtro-comercial"
      >
        <USelect
          :model-value="filtro.comercial ?? TODOS"
          :items="opcionesComerciales"
          class="w-full"
          @update:model-value="cambiar('comercial', criterio($event) as FiltroDePropiedades['comercial'])"
        />
      </UFormField>

      <UFormField
        :label="t('properties.filters.region')"
        data-test="filtro-region"
      >
        <USelect
          :model-value="filtro.region ?? TODOS"
          :items="opcionesDeRegion"
          class="w-full"
          @update:model-value="cambiar('region', criterio($event))"
        />
      </UFormField>
    </div>

    <div
      v-if="activo"
      class="flex justify-end"
    >
      <UButton
        variant="ghost"
        size="sm"
        icon="i-lucide-x"
        data-test="limpiar-filtros"
        :label="t('properties.filters.clear')"
        @click="emit('update:filtro', filtroVacio())"
      />
    </div>
  </div>
</template>
