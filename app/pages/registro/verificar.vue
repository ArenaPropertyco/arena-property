<script setup lang="ts">
import { claveDeErrorDeAuth } from '#shared/identity/errores'
import { RUTAS } from '#shared/permissions/acceso'

/**
 * HU-04 · RF-04.2 — la cuenta no entra a rutas privadas hasta verificar el correo.
 * Aquí llega tanto quien acaba de registrarse como quien intentó entrar sin verificar.
 */
const { t } = useI18n()
const client = useSupabaseClient()
const route = useRoute()
const toast = useToast()
const localePath = useLocalePath()
const { sesion, esperar } = useCuenta()

// Una cuenta ya verificada (Google llega verificada) no tiene nada que hacer aquí.
onMounted(async () => {
  await esperar()
  if (sesion.value.autenticado && sesion.value.verificado) {
    await navigateTo(localePath(RUTAS.panel))
  }
})

const email = computed(() => (typeof route.query.email === 'string' ? route.query.email : null))
const reenviando = ref(false)

async function reenviar() {
  if (!email.value) {
    return
  }
  reenviando.value = true
  const { error } = await client.auth.resend({ type: 'signup', email: email.value })
  reenviando.value = false

  toast.add(error
    ? { title: t(claveDeErrorDeAuth(error)), color: 'error' }
    : { title: t('auth.verify.resent'), color: 'success' })
}
</script>

<template>
  <AuthCard :titulo="t('auth.verify.title')">
    <VerifyEmailNotice
      :email="email"
      :reenviando="reenviando"
      @reenviar="reenviar"
    />
  </AuthCard>
</template>
