<script setup lang="ts">
import type { CuentaConRoles } from '#shared/identity/cuentas'
import type { AjusteDeCapacidad } from '#shared/permissions/mapa'
import { filasDeMatriz, puede } from '#shared/permissions/mapa'
import type { Rol } from '#shared/permissions/roles'

import type { CambioDeContrasena, DatosDeCuenta } from '#shared/identity/edicion-de-perfil'
import type { TipoDeSuspension } from '#shared/identity/suspension'

/**
 * HU-07 · RF-07.3 — gestión de roles del Superadmin: ver y ajustar los permisos por
 * módulo, y asignar o retirar roles a cuentas. La página orquesta; la base decide
 * quién puede (RLS) y deja constancia de cada cambio (RF-07.4).
 *
 * HU-33 · RF-33.1…RF-33.6 · D-07 — desde la misma lista se suspende una cuenta,
 * con motivo y tipo, y se reactiva. La base aplica el efecto sobre el saldo y el
 * código de referido y audita los dos eventos.
 *
 * El Superadmin, además, edita los datos de cualquier cuenta: nombre, teléfono,
 * idioma y correo. El servidor vuelve a exigir el rol y audita cada cambio.
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'administrar_usuarios_y_roles' } })

const { t } = useI18n()
const toast = useToast()
const { cuentas, pendiente, otorgar, retirar, editar, fijarContrasena } = useRoles()
const { matriz, ajustar, pendiente: guardando } = usePermisos()
const { roles: rolesPropios, idDeCuenta } = useCuenta()
const { suspender, reactivar } = useSuspension()

const suspendiendo = ref<CuentaConRoles | null>(null)
const editando = ref<CuentaConRoles | null>(null)
const guardandoCuenta = ref(false)
const fijandoContrasena = ref(false)
const formularioDeContrasena = ref<{ limpiar: () => void } | null>(null)

async function guardarContrasena(datos: CambioDeContrasena) {
  if (!editando.value) {
    return
  }
  fijandoContrasena.value = true
  const resultado = await fijarContrasena(editando.value, datos)
  fijandoContrasena.value = false
  if (resultado.ok) {
    formularioDeContrasena.value?.limpiar()
  }
  toast.add(resultado.ok
    ? { title: t('roles.edit.passwordSet'), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
}

async function guardarCuenta(datos: DatosDeCuenta) {
  if (!editando.value) {
    return
  }
  guardandoCuenta.value = true
  const resultado = await editar(editando.value, datos)
  guardandoCuenta.value = false
  if (resultado.ok) {
    editando.value = null
  }
  toast.add(resultado.ok
    ? { title: t('roles.edit.saved'), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
}
const ocupadoConSuspension = ref(false)

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

async function confirmarSuspension(kind: TipoDeSuspension, reason: string) {
  if (!suspendiendo.value) {
    return
  }
  ocupadoConSuspension.value = true
  const resultado = await suspender(suspendiendo.value.id, kind, reason)
  ocupadoConSuspension.value = false
  if (resultado.ok) {
    suspendiendo.value = null
  }
  toast.add(resultado.ok
    ? { title: t('account.suspension.suspended'), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
}

async function reactivarCuenta(cuenta: CuentaConRoles) {
  const resultado = await reactivar(cuenta.id)
  toast.add(resultado.ok
    ? { title: t('account.suspension.reactivated'), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
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
          :id-del-actor="idDeCuenta"
          :roles-del-actor="rolesPropios"
          @otorgar="otorgarRol"
          @retirar="retirarRol"
          @suspender="suspendiendo = $event"
          @reactivar="reactivarCuenta"
          @editar="editando = $event"
        />
      </div>
    </div>

    <UModal
      :open="editando !== null"
      :title="t('roles.edit.title')"
      :description="t('roles.edit.subtitle')"
      @update:open="editando = $event ? editando : null"
    >
      <template #body>
        <div
          v-if="editando"
          class="space-y-6"
        >
          <ProfileForm
            :key="editando.id"
            :datos="editando"
            correo-editable
            :enviando="guardandoCuenta"
            @submit="guardarCuenta"
          />

          <div class="space-y-3 border-t border-default pt-6">
            <SectionHeading :titulo="t('roles.edit.passwordTitle')" />
            <PasswordForm
              :key="`contrasena-${editando.id}`"
              ref="formularioDeContrasena"
              :tiene-contrasena="false"
              administrada
              :enviando="fijandoContrasena"
              @submit="guardarContrasena"
            />
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      :open="suspendiendo !== null"
      :title="t('account.suspension.title')"
      @update:open="suspendiendo = $event ? suspendiendo : null"
    >
      <template #body>
        <SuspendAccountForm
          v-if="suspendiendo"
          :cuenta="suspendiendo"
          :enviando="ocupadoConSuspension"
          @submit="confirmarSuspension"
        />
      </template>
    </UModal>
  </PanelPage>
</template>
