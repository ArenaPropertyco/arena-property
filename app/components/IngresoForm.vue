<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import { normalizarEmail, validarRegistro } from '#shared/identity/registro'

/**
 * Formulario de inicio de sesión (HU-04 · RF-04.5). Valida solo el correo: la
 * fortaleza de la contraseña se exige al crearla, no al entrar. Emite las
 * credenciales normalizadas; la página habla con Supabase y decide adónde ir.
 */
const props = withDefaults(defineProps<{
  enviando?: boolean
  /** HU-61 · RF-61.1 — el botón de Google se deshabilita aparte del envío por correo. */
  enviandoGoogle?: boolean
  /** Error de autenticación ya traducido. */
  error?: string | null
}>(), {
  enviando: false,
  enviandoGoogle: false,
  error: null,
})

const emit = defineEmits<{
  submit: [credenciales: { email: string, password: string }]
  google: []
}>()

const { t } = useI18n()

interface Credenciales {
  email: string
  password: string
}

const estado = reactive<Credenciales>({ email: '', password: '' })

function validar(datos: Partial<Credenciales>): FormError[] {
  return validarRegistro({ email: datos.email ?? '', password: 'solo-valida-el-correo-1' })
    .filter(error => error.name === 'email')
    .map(error => ({ name: error.name, message: t(error.message) }))
}

function enviar(evento: FormSubmitEvent<Credenciales>) {
  if (props.enviando) {
    return
  }
  emit('submit', {
    email: normalizarEmail(evento.data.email),
    password: evento.data.password,
  })
}
</script>

<template>
  <UForm
    :state="estado"
    :validate="validar"
    class="space-y-4"
    data-test="formulario-ingreso"
    @submit="enviar"
  >
    <UFormField
      name="email"
      :label="t('auth.register.email')"
      required
    >
      <UInput
        v-model="estado.email"
        type="email"
        autocomplete="email"
        class="w-full"
      />
    </UFormField>

    <UFormField
      name="password"
      :label="t('auth.register.password')"
      required
    >
      <UInput
        v-model="estado.password"
        type="password"
        autocomplete="current-password"
        class="w-full"
      />
    </UFormField>

    <AuthErrorAlert :mensaje="error" />

    <UButton
      type="submit"
      block
      :loading="enviando"
      :label="t('auth.login.submit')"
    />

    <AuthGoogleButton
      :cargando="enviandoGoogle"
      @continuar="emit('google')"
    />
  </UForm>
</template>
