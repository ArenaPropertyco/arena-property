<script setup lang="ts">
import type { CuentaConRoles } from '#shared/identity/cuentas'
import type { AjusteDeCapacidad } from '#shared/permissions/mapa'
import { filasDeMatriz, puede } from '#shared/permissions/mapa'
import type { Rol } from '#shared/permissions/roles'

/**
 * HU-07 · RF-07.3 — gestión de roles del Superadmin: ver y ajustar los permisos por
 * módulo, y asignar o retirar roles a cuentas. La página orquesta; la base decide
 * quién puede (RLS) y deja constancia de cada cambio (RF-07.4).
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'administrar_usuarios_y_roles' } })

const { t } = useI18n()
const toast = useToast()
const { cuentas, pendiente, otorgar, retirar } = useRoles()
const { matriz, ajustar, pendiente: guardando } = usePermisos()
const { roles: rolesPropios } = useCuenta()

const filas = computed(() => filasDeMatriz(matriz.value))
// La matriz se edita solo con la capacidad; RLS lo vuelve a comprobar al escribir.
const puedeEditar = computed(() => puede(rolesPropios.value, 'administrar_usuarios_y_roles', {}, matriz.value))

async function ajustarPermiso(ajuste: AjusteDeCapacidad) {
  const resultado = await ajustar(ajuste)
  toast.add(resultado === 'ok'
    ? { title: t('roles.adjusted'), color: 'success' }
    : { title: t('roles.adjustFailed'), color: 'error' })
}

async function otorgarRol(cuenta: CuentaConRoles, rol: Rol) {
  const resultado = await otorgar(cuenta, rol)
  if (resultado === 'ok') {
    toast.add({ title: t('roles.assigned'), color: 'success' })
    return
  }
  toast.add({
    title: resultado === 'combinacion_invalida' ? t('roles.invalidCombination') : t('auth.errors.unknown'),
    color: 'error',
  })
}

async function retirarRol(cuenta: CuentaConRoles, rol: Rol) {
  const resultado = await retirar(cuenta, rol)
  toast.add(resultado === 'ok'
    ? { title: t('roles.revoked'), color: 'success' }
    : { title: t('auth.errors.unknown'), color: 'error' })
}
</script>

<template>
  <PanelPage
    :titulo="t('roles.title')"
    :subtitulo="t('roles.subtitle')"
  >
    <div class="space-y-10">
      <div class="space-y-3">
        <SectionHeading :titulo="t('roles.matrix')" />
        <PermissionsMatrix
          :filas="filas"
          :editable="puedeEditar"
          :guardando="guardando"
          @ajustar="ajustarPermiso"
        />
      </div>

      <div class="space-y-3">
        <SectionHeading :titulo="t('roles.accounts')" />
        <AccountsRolesTable
          :cuentas="cuentas"
          :pendiente="pendiente"
          @otorgar="otorgarRol"
          @retirar="retirarRol"
        />
      </div>
    </div>
  </PanelPage>
</template>
