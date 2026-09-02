<script setup lang="ts">
/**
 * HU-05 · RF-05.1 y RF-05.4 — administradores de propiedad. La página orquesta:
 * envía la invitación a la ruta de servidor y muestra el listado.
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'administrar_usuarios_y_roles' } })

const { t, locale } = useI18n()
const toast = useToast()
const { administradores, pendiente, invitar } = useAdministradores()

const enviando = ref(false)

async function enviarInvitacion(email: string) {
  enviando.value = true
  const resultado = await invitar(email, locale.value)
  enviando.value = false

  toast.add(resultado.ok
    ? { title: t('admins.invited', { email }), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })
}
</script>

<template>
  <PanelPage
    :titulo="t('admins.title')"
    :subtitulo="t('admins.subtitle')"
  >
    <div class="space-y-10">
      <AdminInviteForm
        :enviando="enviando"
        @submit="enviarInvitacion"
      />

      <AdminsTable
        :administradores="administradores"
        :pendiente="pendiente"
      />
    </div>
  </PanelPage>
</template>
