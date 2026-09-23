<script setup lang="ts">
import type { FiltroDeReporte } from '#shared/finance/reportes'
import { hayFiltroDeReporteActivo } from '#shared/finance/reportes'

/**
 * HU-25 · RF-25.1 — los filtros del reporte financiero: propiedad,
 * administrador y periodo. Guarda el criterio y lo emite; quién suma es el
 * dominio. Las opciones salen de los datos, nunca de una lista escrita a mano.
 */
const props = defineProps<{
  filtro: FiltroDeReporte
  propiedades: { id: string, name: string }[]
  administradores: { id: string, label: string }[]
}>()

const emit = defineEmits<{ 'update:filtro': [FiltroDeReporte] }>()

const { t } = useI18n()

/** `USelect` no admite el vacío como valor: «todas» viaja como asterisco. */
const TODAS = '*'

const opcionesDePropiedad = computed(() => [
  { value: TODAS, label: t('reports.allProperties') },
  ...props.propiedades.map(propiedad => ({ value: propiedad.id, label: propiedad.name })),
])
const opcionesDeAdministrador = computed(() => [
  { value: TODAS, label: t('reports.allAdmins') },
  ...props.administradores.map(cuenta => ({ value: cuenta.id, label: cuenta.label })),
])

function cambiar(cambios: Partial<FiltroDeReporte>) {
  emit('update:filtro', { ...props.filtro, ...cambios })
}

function desdeSelector(valor: string): string | null {
  return valor === TODAS ? null : valor
}

const activo = computed(() => hayFiltroDeReporteActivo(props.filtro))
</script>

<template>
  <div
    class="grid gap-3 rounded-2xl border border-default bg-default p-4 sm:grid-cols-2 lg:grid-cols-5"
    data-test="filtros-reporte"
  >
    <UFormField :label="t('reports.property')">
      <USelect
        :model-value="filtro.propertyId ?? TODAS"
        :items="opcionesDePropiedad"
        class="w-full"
        data-test="reporte-propiedad"
        @update:model-value="cambiar({ propertyId: desdeSelector($event as string) })"
      />
    </UFormField>

    <UFormField :label="t('reports.admin')">
      <USelect
        :model-value="filtro.adminId ?? TODAS"
        :items="opcionesDeAdministrador"
        class="w-full"
        data-test="reporte-administrador"
        @update:model-value="cambiar({ adminId: desdeSelector($event as string) })"
      />
    </UFormField>

    <UFormField :label="t('reports.from')">
      <UInput
        :model-value="filtro.desde ?? ''"
        type="date"
        class="w-full"
        data-test="reporte-desde"
        @update:model-value="cambiar({ desde: ($event as string) || null })"
      />
    </UFormField>

    <UFormField :label="t('reports.to')">
      <UInput
        :model-value="filtro.hasta ?? ''"
        type="date"
        class="w-full"
        data-test="reporte-hasta"
        @update:model-value="cambiar({ hasta: ($event as string) || null })"
      />
    </UFormField>

    <div class="flex items-end">
      <UButton
        v-if="activo"
        variant="ghost"
        color="neutral"
        icon="i-lucide-x"
        :label="t('reports.clear')"
        data-test="limpiar-filtros-reporte"
        @click="emit('update:filtro', { propertyId: null, adminId: null, desde: null, hasta: null })"
      />
    </div>
  </div>
</template>
