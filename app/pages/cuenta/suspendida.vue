<script setup lang="ts">
import { RUTAS } from '#shared/permissions/acceso'

/** HU-33 · RF-33.1 — destino de una cuenta suspendida que intenta entrar al panel. */
const { t } = useI18n()
const localePath = useLocalePath()
const client = useSupabaseClient()

async function salir() {
  await client.auth.signOut()
  await navigateTo(localePath(RUTAS.inicio))
}
</script>

<template>
  <AuthCard :titulo="t('auth.suspended.title')">
    <SuspendedNotice @salir="salir" />
  </AuthCard>
</template>
