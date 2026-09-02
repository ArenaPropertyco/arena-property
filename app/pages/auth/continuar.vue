<script setup lang="ts">
import { claveDeErrorDeCallbackOAuth } from '#shared/identity/errores'
import { RUTAS } from '#shared/permissions/acceso'
import type { Database } from '#shared/types/database.types'

/**
 * HU-61 · RF-61.2, RF-61.3, RF-61.4, RF-61.5 — adonde Google devuelve al Visitante.
 *
 * El módulo de Supabase ya intercambió el código y fijó la sesión al llegar aquí
 * (`detectSessionInUrl`); esta página solo aplica la atribución pendiente una sola
 * vez y sigue hacia el panel. Sin prefijo de idioma a propósito: una sola entrada en
 * la lista de redirecciones permitidas por entorno, para cualquier idioma (T-030).
 */
definePageMeta({ layout: 'default' })

const { t } = useI18n()
const localePath = useLocalePath()
const client = useSupabaseClient<Database>()
const route = useRoute()
const { esperarSesion, recargar } = useCuenta()
const codigoDeSesion = useCookie<string | null>('arena_ref')

const error = ref<string | null>(null)

onMounted(async () => {
  const parametroError = typeof route.query.error === 'string' ? route.query.error : null
  if (parametroError) {
    error.value = t(claveDeErrorDeCallbackOAuth(parametroError))
    return
  }

  const lista = await esperarSesion()
  if (!lista) {
    error.value = t('auth.errors.unknown')
    return
  }

  if (codigoDeSesion.value) {
    await client.rpc('aplicar_atribucion_referido', { codigo: codigoDeSesion.value })
    codigoDeSesion.value = null
  }

  await recargar()
  await navigateTo(localePath(RUTAS.panel))
})
</script>

<template>
  <AuthCard :titulo="t('auth.google.completing')">
    <AuthErrorAlert :mensaje="error" />

    <AuthSwitchLink
      v-if="error"
      pregunta=""
      :etiqueta="t('auth.login.title')"
      :to="localePath(RUTAS.ingresar)"
    />
  </AuthCard>
</template>
