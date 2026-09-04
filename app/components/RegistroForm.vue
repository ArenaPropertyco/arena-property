<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import type { DatosDeRegistro } from '#shared/identity/registro'
import {
  atribucionDeRegistro,
  normalizarCodigoReferido,
  normalizarEmail,
  validarRegistro,
} from '#shared/identity/registro'

/**
 * Formulario de registro (HU-04 · RF-04.1, RF-04.4, RF-04.5).
 * Valida con el esquema de `shared/identity` y emite los datos ya normalizados.
 * No sabe de Supabase ni de rutas: la página decide qué hacer con lo emitido.
 */
const props = withDefaults(defineProps<{
  /** Código de referido que trae la sesión (enlace o cookie), si lo hay. */
  prellenado?: string | null
  enviando?: boolean
  /** HU-61 · RF-61.1 — el botón de Google se deshabilita aparte del envío del formulario. */
  enviandoGoogle?: boolean
  /** Error de autenticación ya traducido. */
  error?: string | null
}>(), {
  prellenado: null,
  enviando: false,
  enviandoGoogle: false,
  error: null,
})

const emit = defineEmits<{
  submit: [datos: { email: string, password: string, referralCode: string | null }]
  google: []
}>()

const { t } = useI18n()

const estado = reactive<DatosDeRegistro>({
  email: '',
  password: '',
  passwordConfirm: '',
  referralCode: normalizarCodigoReferido(props.prellenado) ?? '',
})

/**
 * CA-04.3 · un código de referido con formato inválido no bloquea el registro: se
 * descarta, el aviso lo dice y la cuenta se crea sin atribución. Por eso ese error
 * del esquema no se pinta como error de campo.
 */
function validar(datos: Partial<DatosDeRegistro>): FormError[] {
  return validarRegistro({
    email: datos.email ?? '',
    password: datos.password ?? '',
    passwordConfirm: datos.passwordConfirm ?? '',
    referralCode: datos.referralCode ?? '',
  })
    .filter(error => error.name !== 'referralCode')
    .map(error => ({ name: error.name, message: t(error.message) }))
}

const codigo = computed(() => normalizarCodigoReferido(estado.referralCode))
const atribucion = computed(() => atribucionDeRegistro(estado.referralCode))

function enviar(evento: FormSubmitEvent<DatosDeRegistro>) {
  if (props.enviando) {
    return
  }
  emit('submit', {
    email: normalizarEmail(evento.data.email),
    password: evento.data.password,
    referralCode: atribucion.value.referralCode,
  })
}
</script>

<template>
  <UForm
    :state="estado"
    :validate="validar"
    class="space-y-4"
    data-test="formulario-registro"
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
        data-test="campo-email"
      />
    </UFormField>

    <UFormField
      name="password"
      :label="t('auth.register.password')"
      :description="t('auth.register.passwordHint')"
      required
    >
      <UInput
        v-model="estado.password"
        type="password"
        autocomplete="new-password"
        class="w-full"
        data-test="campo-password"
      />
    </UFormField>

    <UFormField
      name="passwordConfirm"
      :label="t('auth.register.passwordConfirm')"
      required
    >
      <UInput
        v-model="estado.passwordConfirm"
        type="password"
        autocomplete="new-password"
        class="w-full"
        data-test="campo-password-confirm"
      />
    </UFormField>

    <UFormField
      name="referralCode"
      :label="t('auth.register.referralCode')"
      :hint="t('auth.register.referralCodeHint')"
    >
      <UInput
        v-model="estado.referralCode"
        autocomplete="off"
        class="w-full font-mono uppercase"
        data-test="campo-referido"
      />
    </UFormField>

    <ReferralCodeNotice
      :codigo="codigo"
      :valido="atribucion.referralCode !== null"
    />

    <AuthErrorAlert :mensaje="error" />

    <UButton
      type="submit"
      block
      :loading="enviando"
      :label="t('auth.register.submit')"
    />

    <AuthGoogleButton
      :cargando="enviandoGoogle"
      @continuar="emit('google')"
    />
  </UForm>
</template>
