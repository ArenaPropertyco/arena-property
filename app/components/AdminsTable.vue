<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Administrador } from '#shared/identity/cuentas'
import type { PropiedadAsignable } from '~/composables/useAdministradores'

/**
 * Administradores con sus propiedades asignadas y el estado de su cuenta
 * (HU-05 · RF-05.4). Presenta lo que recibe y emite a quién se le van a editar
 * las propiedades; la página monta el formulario.
 */
const props = withDefaults(defineProps<{
  administradores: Administrador[]
  pendiente: boolean
  /** Para nombrar las propiedades asignadas en vez de mostrar su identificador. */
  propiedades?: PropiedadAsignable[]
  puedeAsignar?: boolean
}>(), {
  propiedades: () => [],
  puedeAsignar: false,
})

defineEmits<{ gestionar: [Administrador] }>()

const { t } = useI18n()

const nombrePorPropiedad = computed(() => new Map(props.propiedades.map(p => [p.id, p.name])))

function nombreDe(id: string): string {
  return nombrePorPropiedad.value.get(id) ?? id.slice(0, 8)
}

const columnas = computed<TableColumn<Administrador>[]>(() => [
  { accessorKey: 'email', header: t('roles.email') },
  { id: 'propiedades', header: t('admins.properties') },
  { id: 'status', header: t('admins.status') },
  ...(props.puedeAsignar ? [{ id: 'acciones', header: '' }] : []),
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <UTable
      :data="administradores"
      :columns="columnas"
      :loading="pendiente"
      :empty="t('admins.empty')"
      data-test="tabla-administradores"
    >
      <template #email-cell="{ row }">
        <div class="flex flex-col">
          <span>{{ row.original.fullName ?? row.original.email }}</span>
          <span
            v-if="row.original.fullName"
            class="text-xs text-muted"
          >{{ row.original.email }}</span>
        </div>
      </template>

      <template #propiedades-cell="{ row }">
        <span
          v-if="row.original.propiedades.length === 0"
          class="text-muted"
        >
          {{ t('admins.noProperties') }}
        </span>
        <div
          v-else
          class="flex flex-wrap gap-1"
          :data-test="`propiedades-de-${row.original.id}`"
        >
          <UBadge
            v-for="propiedad in row.original.propiedades"
            :key="propiedad"
            color="neutral"
            variant="subtle"
            size="sm"
            :label="nombreDe(propiedad)"
          />
        </div>
      </template>

      <template #status-cell="{ row }">
        <AccountStatusBadge :status="row.original.status" />
      </template>

      <template #acciones-cell="{ row }">
        <div class="flex justify-end">
          <UButton
            variant="ghost"
            size="xs"
            icon="i-lucide-building-2"
            :label="t('admins.manageProperties')"
            :data-test="`gestionar-${row.original.id}`"
            @click="$emit('gestionar', row.original)"
          />
        </div>
      </template>
    </UTable>
  </div>
</template>
