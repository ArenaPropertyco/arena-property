<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CuentaConRoles } from '#shared/identity/cuentas'
import type { Rol } from '#shared/permissions/roles'
import { ROLES } from '#shared/permissions/roles'

/**
 * Cuentas con sus roles (HU-07 · RF-07.3). Otorgar y retirar son eventos: la
 * página los lleva a la base, donde RLS y el disparador de acumulación deciden.
 */
defineProps<{
  cuentas: CuentaConRoles[]
  pendiente: boolean
}>()

const emit = defineEmits<{
  otorgar: [cuenta: CuentaConRoles, rol: Rol]
  retirar: [cuenta: CuentaConRoles, rol: Rol]
}>()

const { t } = useI18n()

const columnas = computed<TableColumn<CuentaConRoles>[]>(() => [
  { accessorKey: 'email', header: t('roles.email') },
  { id: 'roles', header: t('roles.currentRoles') },
  { id: 'acciones' },
])

const opcionesDeRol = computed(() => ROLES.map(rol => ({ label: t(`roles.names.${rol}`), value: rol })))

/** Rol elegido en el selector de cada fila, hasta que se otorga. */
const rolSeleccionado = reactive<Record<string, Rol | undefined>>({})

function otorgar(cuenta: CuentaConRoles) {
  const rol = rolSeleccionado[cuenta.id]
  if (!rol) {
    return
  }
  emit('otorgar', cuenta, rol)
  rolSeleccionado[cuenta.id] = undefined
}
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <UTable
      :data="cuentas"
      :columns="columnas"
      :loading="pendiente"
      :empty="t('roles.empty')"
      data-test="tabla-cuentas"
    >
      <template #roles-cell="{ row }">
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-for="rol in row.original.roles"
            :key="rol"
            color="primary"
            variant="subtle"
            size="sm"
          >
            {{ t(`roles.names.${rol}`) }}
            <UButton
              v-if="rol !== 'user'"
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="link"
              :aria-label="t('roles.revoke')"
              :data-test="`retirar-${rol}`"
              @click="emit('retirar', row.original, rol)"
            />
          </UBadge>
        </div>
      </template>

      <template #acciones-cell="{ row }">
        <div class="flex items-center gap-2">
          <USelect
            v-model="rolSeleccionado[row.original.id]"
            :items="opcionesDeRol.filter(opcion => !row.original.roles.includes(opcion.value))"
            :placeholder="t('roles.selectRole')"
            size="sm"
            class="w-48"
          />
          <UButton
            size="sm"
            :label="t('roles.assign')"
            :disabled="!rolSeleccionado[row.original.id]"
            data-test="otorgar"
            @click="otorgar(row.original)"
          />
        </div>
      </template>
    </UTable>
  </div>
</template>
