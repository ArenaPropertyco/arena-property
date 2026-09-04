<script setup lang="ts">
import type { Administrador } from '#shared/identity/cuentas'

/**
 * HU-05 · RF-05.1, RF-05.2 y RF-05.4 — administradores de propiedad. La página
 * orquesta las tres operaciones del Superadmin: invitar por correo, dar el rol a
 * una cuenta existente y asignar o retirar propiedades a un administrador.
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'administrar_usuarios_y_roles' } })

const { t, locale } = useI18n()
const toast = useToast()
const {
  administradores, candidatos, propiedades, pendiente,
  invitar, promover, sincronizarPropiedades,
} = useAdministradores()

const enviando = ref(false)
const gestionando = ref<Administrador | null>(null)

async function ejecutar(
  operacion: () => Promise<{ ok: true } | { ok: false, clave: string }>,
  exito: string,
) {
  enviando.value = true
  const resultado = await operacion()
  enviando.value = false

  toast.add(resultado.ok
    ? { title: exito, color: 'success' }
    : { title: t(resultado.clave), color: 'error' })

  return resultado.ok
}

function enviarInvitacion(email: string) {
  return ejecutar(() => invitar(email, locale.value), t('admins.invited', { email }))
}

function promoverCuenta(cuentaId: string) {
  const cuenta = candidatos.value.find(candidato => candidato.id === cuentaId)
  return ejecutar(() => promover(cuentaId), t('admins.promoted', { email: cuenta?.email ?? '' }))
}

async function guardarPropiedades(propertyIds: string[]) {
  const admin = gestionando.value
  if (!admin) {
    return
  }
  if (await ejecutar(() => sincronizarPropiedades(admin.id, propertyIds), t('admins.propertiesUpdated'))) {
    gestionando.value = null
  }
}
</script>

<template>
  <PanelPage
    :titulo="t('admins.title')"
    :subtitulo="t('admins.subtitle')"
  >
    <div class="space-y-10">
      <div class="grid gap-6 lg:grid-cols-2">
        <AdminInviteForm
          :enviando="enviando"
          @submit="enviarInvitacion"
        />

        <AdminPromoteForm
          :candidatos="candidatos"
          :enviando="enviando"
          @submit="promoverCuenta"
        />
      </div>

      <AdminsTable
        :administradores="administradores"
        :propiedades="propiedades"
        :pendiente="pendiente"
        puede-asignar
        @gestionar="gestionando = $event"
      />
    </div>

    <UModal
      :open="gestionando !== null"
      :title="gestionando ? t('admins.propertiesFor', { email: gestionando.fullName ?? gestionando.email ?? '' }) : ''"
      @update:open="gestionando = null"
    >
      <template #body>
        <AdminPropertiesForm
          v-if="gestionando"
          :key="gestionando.id"
          :administrador="gestionando"
          :propiedades="propiedades"
          :guardando="enviando"
          @submit="guardarPropiedades"
        />
      </template>
    </UModal>
  </PanelPage>
</template>
