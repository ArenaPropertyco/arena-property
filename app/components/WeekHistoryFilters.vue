<script setup lang="ts">
import { filtroDeHistorialVacio } from '#shared/scheduling/historial'
import type { FiltroDeHistorial } from '#shared/scheduling/historial'

/**
 * HU-20 · RF-20.2 — filtros del historial de semanas: propiedad y rango de
 * entrada, combinables. Controlado: recibe el filtro y emite el completo con
 * cada cambio; filtrar lo hace `shared/scheduling/historial` (RF-20.3).
 */
const props = defineProps<{
  filtro: FiltroDeHistorial
  propiedades: { id: string, name: string }[]
}>()

const emit = defineEmits<{ 'update:filtro': [FiltroDeHistorial] }>()

const { t } = useI18n()

const TODAS = '__todas__'

const opciones = computed(() => [
  { label: t('history.filters.allProperties'), value: TODAS },
  ...props.propiedades.map(propiedad => ({ label: propiedad.name, value: propiedad.id })),
])

function cambiar(cambios: Partial<FiltroDeHistorial>) {
  emit('update:filtro', { ...props.filtro, ...cambios })
}

function limpiar() {
  emit('update:filtro', filtroDeHistorialVacio())
}
</script>

<template>
  <div
    class="flex flex-wrap items-end gap-4 rounded-2xl border border-default bg-default p-4"
    data-test="filtros-historial"
  >
    <UFormField
      :label="t('history.filters.property')"
      class="min-w-56 flex-1"
    >
      <USelect
        :model-value="filtro.propertyId ?? TODAS"
        :items="opciones"
        class="w-full"
        data-test="filtro-propiedad"
        @update:model-value="cambiar({ propertyId: $event === TODAS ? null : String($event) })"
      />
    </UFormField>

    <UFormField :label="t('history.filters.from')">
      <UInput
        type="date"
        :model-value="filtro.desde ?? ''"
        data-test="filtro-desde"
        @update:model-value="cambiar({ desde: $event ? String($event) : null })"
      />
    </UFormField>

    <UFormField :label="t('history.filters.to')">
      <UInput
        type="date"
        :model-value="filtro.hasta ?? ''"
        data-test="filtro-hasta"
        @update:model-value="cambiar({ hasta: $event ? String($event) : null })"
      />
    </UFormField>

    <UButton
      variant="ghost"
      color="neutral"
      icon="i-lucide-x"
      :label="t('history.filters.clear')"
      data-test="filtro-limpiar"
      @click="limpiar"
    />
  </div>
</template>
