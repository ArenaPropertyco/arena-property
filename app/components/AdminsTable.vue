<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Administrador } from '#shared/identity/cuentas'

/**
 * Administradores con sus propiedades asignadas y el estado de su cuenta
 * (HU-05 · RF-05.4). Solo presenta lo que recibe.
 */
defineProps<{
  administradores: Administrador[]
  pendiente: boolean
}>()

const { t } = useI18n()

const columnas = computed<TableColumn<Administrador>[]>(() => [
  { accessorKey: 'email', header: t('roles.email') },
  { id: 'propiedades', header: t('admins.properties') },
  { id: 'status', header: t('admins.status') },
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
        >
          <UBadge
            v-for="propiedad in row.original.propiedades"
            :key="propiedad"
            color="neutral"
            variant="subtle"
            size="sm"
            class="font-mono"
            :label="propiedad.slice(0, 8)"
          />
        </div>
      </template>

      <template #status-cell="{ row }">
        <AccountStatusBadge :status="row.original.status" />
      </template>
    </UTable>
  </div>
</template>
