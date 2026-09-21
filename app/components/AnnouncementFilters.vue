<script setup lang="ts">
import { ESTADOS_DE_NOVEDAD, filtroDeNovedadesVacio, hayFiltroDeNovedadesActivo } from '#shared/notifications/novedades'
import type { EstadoDeNovedad, FiltroDeNovedades } from '#shared/notifications/novedades'

/**
 * HU-30 · RF-30.3 — filtro del historial de novedades por propiedad y por estado.
 * Componente controlado: emite el filtro completo con cada cambio.
 */
const props = defineProps<{
  filtro: FiltroDeNovedades
  propiedades: { id: string, name: string }[]
}>()

const emit = defineEmits<{ 'update:filtro': [FiltroDeNovedades] }>()

const { t } = useI18n()

/** El selector no admite el vacío como valor: «todas» es un centinela. */
const TODOS = '*' as const

function criterio(valor: unknown): string | null {
  return valor === TODOS || valor === '' || valor === undefined ? null : String(valor)
}

const propiedades = computed(() => [
  { label: t('announcements.filters.allProperties'), value: TODOS },
  ...props.propiedades.map(propiedad => ({ label: propiedad.name, value: propiedad.id })),
])

const estados = computed(() => [
  { label: t('announcements.filters.allStatuses'), value: TODOS },
  ...ESTADOS_DE_NOVEDAD.map(estado => ({ label: t(`announcements.status.${estado}`), value: estado })),
])

const activo = computed(() => hayFiltroDeNovedadesActivo(props.filtro))
</script>

<template>
  <div
    class="space-y-3 rounded-2xl border border-default bg-default p-4"
    data-test="filtros-novedades"
  >
    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField
        :label="t('announcements.filters.property')"
        data-test="filtro-propiedad"
      >
        <USelect
          :model-value="filtro.propertyId ?? TODOS"
          :items="propiedades"
          class="w-full"
          @update:model-value="emit('update:filtro', { ...filtro, propertyId: criterio($event) })"
        />
      </UFormField>

      <UFormField
        :label="t('announcements.filters.status')"
        data-test="filtro-estado"
      >
        <USelect
          :model-value="filtro.status ?? TODOS"
          :items="estados"
          class="w-full"
          @update:model-value="emit('update:filtro', { ...filtro, status: criterio($event) as EstadoDeNovedad | null })"
        />
      </UFormField>
    </div>

    <div
      v-if="activo"
      class="flex justify-end"
    >
      <UButton
        variant="link"
        size="sm"
        icon="i-lucide-x"
        :label="t('announcements.filters.clear')"
        data-test="limpiar-filtros"
        @click="emit('update:filtro', filtroDeNovedadesVacio())"
      />
    </div>
  </div>
</template>
