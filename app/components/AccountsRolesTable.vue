<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CuentaConRoles } from '#shared/identity/cuentas'
import { puedeReactivar, puedeSuspender } from '#shared/identity/suspension'
import type { Rol } from '#shared/permissions/roles'
import { ROLES } from '#shared/permissions/roles'

/**
 * Cuentas con sus roles (HU-07 · RF-07.3) y su estado (HU-33 · RF-33.1, RF-33.5).
 * Otorgar, retirar, suspender y reactivar son eventos: la página los lleva a la
 * base, donde RLS y las funciones deciden. Quién puede suspender a quién lo dice
 * el dominio, para no ofrecer un botón que la base va a rechazar.
 */
const props = withDefaults(defineProps<{
  cuentas: CuentaConRoles[]
  pendiente: boolean
  /** HU-33 · quien mira: para no ofrecerle suspenderse a sí mismo ni a otro Superadmin. */
  idDelActor?: string | null
  rolesDelActor?: readonly Rol[]
}>(), { idDelActor: null, rolesDelActor: () => [] })

const emit = defineEmits<{
  otorgar: [cuenta: CuentaConRoles, rol: Rol]
  retirar: [cuenta: CuentaConRoles, rol: Rol]
  suspender: [cuenta: CuentaConRoles]
  reactivar: [cuenta: CuentaConRoles]
}>()

const { t } = useI18n()

const columnas = computed<TableColumn<CuentaConRoles>[]>(() => [
  { accessorKey: 'email', header: t('roles.email') },
  { id: 'estado', header: t('roles.status') },
  { id: 'roles', header: t('roles.currentRoles') },
  { id: 'acciones' },
])

function suspendible(cuenta: CuentaConRoles): boolean {
  return puedeSuspender(props.rolesDelActor, cuenta, props.idDelActor)
}

function reactivable(cuenta: CuentaConRoles): boolean {
  return puedeReactivar(props.rolesDelActor, cuenta)
}

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
      <template #estado-cell="{ row }">
        <AccountStatusBadge :status="row.original.status" />
      </template>

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
          <UButton
            v-if="suspendible(row.original)"
            size="sm"
            color="error"
            variant="outline"
            icon="i-lucide-user-round-x"
            :label="t('roles.suspend')"
            :data-test="`suspender-${row.original.id}`"
            @click="emit('suspender', row.original)"
          />
          <UButton
            v-else-if="reactivable(row.original)"
            size="sm"
            color="success"
            variant="outline"
            icon="i-lucide-user-round-check"
            :label="t('roles.reactivate')"
            :data-test="`reactivar-${row.original.id}`"
            @click="emit('reactivar', row.original)"
          />
        </div>
      </template>
    </UTable>
  </div>
</template>
