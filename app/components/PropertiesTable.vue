<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { PropiedadDelPanel } from '#shared/properties/vistas'

/**
 * HU-10 · RF-10.1 — listado de propiedades con su administrador y sus dos estados.
 *
 * Solo presenta lo que recibe: quién la ve y con qué recorte lo decidieron la RLS y
 * el composable de filtros. Abrir una propiedad se emite, no se navega desde aquí.
 */
defineProps<{
  propiedades: PropiedadDelPanel[]
  pendiente: boolean
}>()

defineEmits<{ abrir: [string] }>()

const { t } = useI18n()

const columnas = computed<TableColumn<PropiedadDelPanel>[]>(() => [
  { accessorKey: 'name', header: t('properties.fields.name') },
  { accessorKey: 'region', header: t('properties.fields.region') },
  { id: 'admin', header: t('properties.createdBy') },
  { id: 'estado', header: t('properties.visibility.label') },
  { id: 'fracciones', header: t('properties.fractions.title') },
  { id: 'acciones', header: '' },
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <UTable
      :data="propiedades"
      :columns="columnas"
      :loading="pendiente"
      :empty="t('properties.empty')"
      data-test="tabla-propiedades"
    >
      <template #admin-cell="{ row }">
        <span
          v-if="!row.original.adminLabel"
          class="text-muted"
        >
          {{ t('properties.unassigned') }}
        </span>
        <span v-else>{{ row.original.adminLabel }}</span>
      </template>

      <template #estado-cell="{ row }">
        <PropertyStateBadge
          :visibility="row.original.visibility"
          :commercial="row.original.fractionCount === 8 ? row.original.commercial : null"
        />
      </template>

      <template #fracciones-cell="{ row }">
        <span
          v-if="row.original.fractionCount === 0"
          class="text-muted"
        >
          {{ t('properties.fractions.empty') }}
        </span>
        <span
          v-else
          class="font-mono text-sm"
        >
          {{ row.original.availableFractions }}/{{ row.original.fractionCount }}
        </span>
      </template>

      <template #acciones-cell="{ row }">
        <UButton
          variant="ghost"
          size="sm"
          icon="i-lucide-arrow-right"
          :aria-label="t('properties.open')"
          data-test="abrir-propiedad"
          @click="$emit('abrir', row.original.id)"
        />
      </template>
    </UTable>
  </div>
</template>
