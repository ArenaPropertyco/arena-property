<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { EstadoDeItem, ItemDeInventario } from '#shared/properties/inventario'

/**
 * HU-26 · RF-26.1, RF-26.2 · HU-28 · RF-28.2 — el inventario de una propiedad.
 *
 * Un ítem dado de baja sigue en la lista del Administrador, marcado y con su
 * motivo: el histórico es parte de la honestidad del dato (principio 9); al
 * Propietario la RLS ya no se lo entrega. Editar y dar de baja se ofrecen solo a
 * quien gestiona y sobre ítems activos; el historial, a cualquiera que vea la lista.
 */
const props = defineProps<{
  items: ItemDeInventario[]
  puedeGestionar: boolean
}>()

defineEmits<{
  editar: [string]
  darDeBaja: [string]
  verHistorial: [string]
}>()

const { t } = useI18n()

const COLOR_DE_ESTADO: Record<EstadoDeItem, 'success' | 'neutral' | 'warning' | 'error'> = {
  new: 'success',
  good: 'neutral',
  fair: 'warning',
  damaged: 'error',
}

function activo(item: ItemDeInventario): boolean {
  return props.puedeGestionar && item.retiredAt === null
}

const columnas = computed<TableColumn<ItemDeInventario>[]>(() => [
  { id: 'item', header: t('inventory.columns.item') },
  { id: 'categoria', header: t('inventory.columns.category') },
  { id: 'estado', header: t('inventory.columns.condition') },
  { id: 'cantidad', header: t('inventory.columns.quantity') },
  { id: 'acciones', header: '' },
])
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="items.length === 0"
      class="text-sm text-muted"
      data-test="sin-items"
    >
      {{ t('inventory.empty') }}
    </p>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="items"
        :columns="columnas"
        data-test="tabla-inventario"
      >
        <template #item-cell="{ row }">
          <div
            class="flex flex-col gap-1"
            :class="row.original.retiredAt ? 'text-muted' : ''"
            :data-test="`item-${row.original.id}`"
          >
            <span
              class="text-highlighted"
              :class="row.original.retiredAt ? 'line-through' : ''"
            >{{ row.original.name }}</span>
            <span
              v-if="row.original.location"
              class="text-xs text-muted"
            >{{ row.original.location }}</span>
            <span class="text-xs text-muted sm:hidden">{{ t(`inventory.categories.${row.original.category}`) }}</span>
            <UBadge
              v-if="row.original.retiredAt"
              color="neutral"
              variant="subtle"
              size="sm"
              :label="t('inventory.retired')"
              class="w-fit"
              :data-test="`baja-${row.original.id}`"
            />
            <span
              v-if="row.original.retireReason"
              class="text-xs text-muted"
            >{{ t('inventory.retiredLine', { reason: row.original.retireReason }) }}</span>
          </div>
        </template>

        <template #categoria-cell="{ row }">
          <span class="whitespace-nowrap">{{ t(`inventory.categories.${row.original.category}`) }}</span>
        </template>

        <template #estado-cell="{ row }">
          <UBadge
            :color="COLOR_DE_ESTADO[row.original.condition]"
            variant="subtle"
            size="sm"
            :label="t(`inventory.conditions.${row.original.condition}`)"
            :data-test="`estado-${row.original.id}`"
          />
        </template>

        <template #cantidad-cell="{ row }">
          <span
            class="font-mono"
            :data-test="`cantidad-${row.original.id}`"
          >{{ row.original.quantity }}</span>
        </template>

        <template #acciones-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton
              variant="ghost"
              size="xs"
              icon="i-lucide-history"
              :label="t('inventory.history')"
              :data-test="`historial-${row.original.id}`"
              @click="$emit('verHistorial', row.original.id)"
            />
            <UButton
              v-if="activo(row.original)"
              variant="ghost"
              size="xs"
              icon="i-lucide-pencil"
              :label="t('inventory.edit')"
              :data-test="`editar-${row.original.id}`"
              @click="$emit('editar', row.original.id)"
            />
            <UButton
              v-if="activo(row.original)"
              variant="ghost"
              color="error"
              size="xs"
              icon="i-lucide-archive"
              :label="t('inventory.retire')"
              :data-test="`retirar-${row.original.id}`"
              @click="$emit('darDeBaja', row.original.id)"
            />
          </div>
        </template>
      </UTable>
    </div>
  </div>
</template>
