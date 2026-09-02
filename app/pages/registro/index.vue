<script setup lang="ts">
import { normalizarCodigoReferido } from '#shared/identity/registro'
import { claveDeErrorDeAuth } from '#shared/identity/errores'
import { RUTAS } from '#shared/permissions/acceso'

/**
 * HU-04 · registro Visitante → Usuario. La página orquesta: toma la atribución de
 * la sesión, habla con Supabase Auth y decide adónde ir. El formulario es un componente.
 */
const { t, locale } = useI18n()
const localePath = useLocalePath()
const client = useSupabaseClient()
const route = useRoute()
const { continuarConGoogle } = useAutenticacionGoogle()

// RF-04.4 · prellenado si la sesión trae atribución (enlace `?ref=` o cookie de HU-51).
const codigoDeSesion = useCookie<string | null>('arena_ref')
const prellenado = normalizarCodigoReferido(
  typeof route.query.ref === 'string' ? route.query.ref : codigoDeSesion.value,
)

const enviando = ref(false)
const enviandoGoogle = ref(false)
const error = ref<string | null>(null)

async function registrarConGoogle() {
  enviandoGoogle.value = true
  error.value = null

  // RF-61.5 · el mismo código que ya trae la sesión (enlace o cookie) viaja con ella.
  const { error: claveDeError } = await continuarConGoogle(prellenado)
  if (claveDeError) {
    enviandoGoogle.value = false
    error.value = t(claveDeError)
  }
}

async function registrar(datos: { email: string, password: string, referralCode: string | null }) {
  enviando.value = true
  error.value = null

  const respuesta = await client.auth.signUp({
    email: datos.email,
    password: datos.password,
    options: {
      // El disparador de la base copia estos datos al perfil (RF-04.3, RF-04.4).
      data: { locale: locale.value, referral_code: datos.referralCode },
    },
  })

  enviando.value = false

  if (respuesta.error) {
    error.value = t(claveDeErrorDeAuth(respuesta.error))
    return
  }

  await navigateTo({ path: localePath(RUTAS.verificar), query: { email: datos.email } })
}
</script>

<template>
  <AuthCard
    :titulo="t('auth.register.title')"
    :subtitulo="t('auth.register.subtitle')"
  >
    <RegistroForm
      :prellenado="prellenado"
      :enviando="enviando"
      :enviando-google="enviandoGoogle"
      :error="error"
      @submit="registrar"
      @google="registrarConGoogle"
    />

    <template #footer>
      <AuthSwitchLink
        :pregunta="t('auth.register.haveAccount')"
        :etiqueta="t('auth.register.login')"
        :to="localePath(RUTAS.ingresar)"
      />
    </template>
  </AuthCard>
</template>
