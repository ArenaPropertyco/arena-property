<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AjusteDeCapacidad, Alcance, Columna, FilaDeMatriz } from '#shared/permissions/mapa'
import { ALCANCES, COLUMNAS } from '#shared/permissions/mapa'

/**
 * Permisos por módulo (HU-07 · RF-07.3): la matriz efectiva, celda a celda.
 *
 * En modo editable cada celda es un selector y el cambio se emite; quien monta el
 * componente decide si se guarda y quién puede hacerlo. El componente no consulta
 * ni escribe nada.
 */
withDefaults(defineProps<{
  filas: FilaDeMatriz[]
  /** Solo el Superadmin recibe `true` (RF-07.3). */
  editable?: boolean
  guardando?: boolean
}>(), {
  editable: false,
  guardando: false,
})

const emit = defineEmits<{ ajustar: [ajuste: AjusteDeCapacidad] }>()

const { t } = useI18n()

const columnas = computed<TableColumn<FilaDeMatriz>[]>(() => [
  { accessorKey: 'capacidad', header: t('roles.capability') },
  ...COLUMNAS.map(columna => ({ id: columna, header: t(`roles.names.${columna}`) })),
])

const opcionesDeAlcance = computed(() =>
  ALCANCES.map(alcance => ({ label: t(`roles.scope.${alcance}`), value: alcance })),
)

/** Verde a lo permitido, rojo a lo denegado, neutro a lo que no aplica (principio 8). */
function colorDeAlcance(alcance: Alcance): 'success' | 'neutral' | 'error' {
  if (alcance === 'no') {
    return 'error'
  }
  if (alcance === 'no_aplica') {
    return 'neutral'
  }
  return 'success'
}

/** El valor llega de un control de interfaz: se valida contra el vocabulario. */
function ajustar(fila: FilaDeMatriz, columna: Columna, valor: unknown) {
  const alcance = ALCANCES.find(posible => posible === valor)
  if (!alcance || alcance === fila.alcances[columna]) {
    return
  }
  emit('ajustar', { capacidad: fila.capacidad, columna, alcance })
}
</script>

<template>
  <div class="space-y-3">
    <UAlert
      v-if="editable"
      color="warning"
      variant="subtle"
      icon="i-lucide-shield-alert"
      :title="t('roles.editHint')"
      :description="t('roles.enforcedByDatabaseHint')"
      data-test="aviso-edicion"
    />

    <div class="overflow-x-auto rounded-lg border border-default">
      <UTable
        :data="filas"
        :columns="columnas"
        :loading="guardando"
        data-test="matriz-permisos"
      >
        <template #capacidad-cell="{ row }">
          <span class="text-default">{{ t(`roles.capabilities.${row.original.capacidad}`) }}</span>
          <UBadge
            v-if="row.original.condicion"
            class="ms-2"
            color="warning"
            variant="subtle"
            size="sm"
            icon="i-lucide-toggle-left"
            :label="row.original.condicion"
          />
          <UBadge
            v-if="row.original.enBaseDeDatos"
            class="ms-2"
            color="neutral"
            variant="subtle"
            size="sm"
            icon="i-lucide-database"
            :label="t('roles.enforcedByDatabase')"
            :data-test="`en-base-de-datos-${row.original.capacidad}`"
          />
        </template>

        <template
          v-for="columna in COLUMNAS"
          :key="columna"
          #[`${columna}-cell`]="{ row }"
        >
          <div :data-test="`celda-${row.original.capacidad}-${columna}`">
            <USelect
              v-if="editable"
              :model-value="row.original.alcances[columna]"
              :items="opcionesDeAlcance"
              size="xs"
              class="w-32"
              :aria-label="t(`roles.capabilities.${row.original.capacidad}`) + ' · ' + t(`roles.names.${columna}`)"
              @update:model-value="valor => ajustar(row.original, columna, valor)"
            />
            <UBadge
              v-else
              :color="colorDeAlcance(row.original.alcances[columna])"
              variant="subtle"
              size="sm"
              :label="t(`roles.scope.${row.original.alcances[columna]}`)"
            />
          </div>
        </template>
      </UTable>
    </div>
  </div>
</template>
