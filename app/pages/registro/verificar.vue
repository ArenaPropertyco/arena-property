<script setup lang="ts">
import { claveDeErrorDeAuth } from '#shared/identity/errores'

/**
 * HU-04 · RF-04.2 — la cuenta no entra a rutas privadas hasta verificar el correo.
 * Aquí llega tanto quien acaba de registrarse como quien intentó entrar sin verificar.
 */
const { t } = useI18n()
const client = useSupabaseClient()
const route = useRoute()
const toast = useToast()

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
