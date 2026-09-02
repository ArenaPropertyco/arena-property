<script setup lang="ts">
import { claveDeErrorDeAuth } from '#shared/identity/errores'
import { RUTAS } from '#shared/permissions/acceso'

/**
 * HU-04 · inicio de sesión. La página orquesta: autentica, espera a que la sesión
 * se propague y navega. Los errores llegan traducidos al formulario, sin detalle técnico.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const client = useSupabaseClient()
const { esperarSesion, recargar } = useCuenta()
const { continuarConGoogle } = useAutenticacionGoogle()

const enviando = ref(false)
const enviandoGoogle = ref(false)
const error = ref<string | null>(null)

async function ingresarConGoogle() {
  enviandoGoogle.value = true
  error.value = null

  const { error: claveDeError } = await continuarConGoogle()
  if (claveDeError) {
    enviandoGoogle.value = false
    error.value = t(claveDeError)
  }
  // Sin error, el navegador ya está saliendo hacia Google: no hay más que hacer aquí.
}

async function ingresar(credenciales: { email: string, password: string }) {
  enviando.value = true
  error.value = null

  const respuesta = await client.auth.signInWithPassword(credenciales)

  if (respuesta.error) {
    enviando.value = false
    error.value = t(claveDeErrorDeAuth(respuesta.error))
    return
  }

  // El módulo fija el usuario un tic después de resolver: navegar antes hace que el
  // middleware vea una sesión vacía y devuelva a esta misma página.
  const lista = await esperarSesion()
  if (lista) {
    await recargar()
  }

  enviando.value = false

  if (!lista) {
    error.value = t('auth.errors.unknown')
    return
  }

  await navigateTo(localePath(RUTAS.panel))
}
</script>

<template>
  <AuthCard
    :titulo="t('auth.login.title')"
    :subtitulo="t('auth.login.subtitle')"
  >
    <IngresoForm
      :enviando="enviando"
      :enviando-google="enviandoGoogle"
      :error="error"
      @submit="ingresar"
      @google="ingresarConGoogle"
    />

    <template #footer>
      <AuthSwitchLink
        :pregunta="t('auth.login.noAccount')"
        :etiqueta="t('auth.login.register')"
        :to="localePath(RUTAS.registro)"
      />
    </template>
  </AuthCard>
</template>
