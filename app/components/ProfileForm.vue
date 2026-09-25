<script setup lang="ts">
import { IDIOMAS_DE_PERFIL, validarCuenta, validarPerfil } from '#shared/identity/edicion-de-perfil'
import type { CampoDePerfil, DatosDeCuenta } from '#shared/identity/edicion-de-perfil'
import { inicialesDe, nombreParaMostrar } from '#shared/identity/perfil'

/**
 * Datos de una cuenta: nombre, teléfono, idioma y correo.
 *
 * Lo usan dos pantallas. En «Perfil» la cuenta edita lo suyo y el correo se ve
 * bloqueado: es la llave de acceso. En «Roles» el Superadmin edita cualquier cuenta,
 * correo incluido (`correoEditable`). Valida con el dominio antes de emitir; la base
 * y el servidor repiten las reglas.
 */
const props = withDefaults(defineProps<{
  datos: { email: string | null, fullName: string | null, phone: string | null, locale: string | null }
  enviando: boolean
  correoEditable?: boolean
  avatarUrl?: string | null
}>(), { correoEditable: false, avatarUrl: null })

const emit = defineEmits<{ submit: [DatosDeCuenta] }>()

const { t } = useI18n()

const estado = reactive({
  fullName: props.datos.fullName ?? '',
  phone: props.datos.phone ?? '',
  locale: props.datos.locale ?? 'es',
  email: props.datos.email ?? '',
})
const errores = ref<Partial<Record<CampoDePerfil, string>>>({})

const idiomas = computed(() => IDIOMAS_DE_PERFIL.map(idioma => ({ value: idioma, label: t(`profile.locales.${idioma}`) })))
const nombre = computed(() => nombreParaMostrar({ fullName: estado.fullName, email: estado.email }))

function enviar() {
  const encontrados = props.correoEditable ? validarCuenta(estado) : validarPerfil(estado)
  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))
  if (encontrados.length > 0) {
    return
  }
  emit('submit', { ...estado })
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-5"
    data-test="formulario-perfil"
    @submit.prevent="enviar"
  >
    <div class="flex items-center gap-4">
      <UAvatar
        :src="avatarUrl ?? undefined"
        :text="inicialesDe(nombre)"
        :alt="nombre"
        size="xl"
      />
      <div class="min-w-0">
        <p class="truncate font-display text-lg text-highlighted">
          {{ nombre }}
        </p>
        <p class="truncate text-sm text-muted">
          {{ estado.email }}
        </p>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        :label="t('profile.fields.fullName')"
        :error="errores.fullName"
        data-test="campo-nombre"
      >
        <UInput
          v-model="estado.fullName"
          autocomplete="name"
          class="w-full"
          data-test="perfil-nombre"
        />
      </UFormField>

      <UFormField
        :label="t('profile.fields.phone')"
        :hint="t('profile.fields.optional')"
        :error="errores.phone"
        data-test="campo-telefono"
      >
        <UInput
          v-model="estado.phone"
          type="tel"
          autocomplete="tel"
          class="w-full"
          data-test="perfil-telefono"
        />
      </UFormField>

      <UFormField
        :label="t('profile.fields.locale')"
        :error="errores.locale"
      >
        <USelect
          v-model="estado.locale"
          :items="idiomas"
          class="w-full"
          data-test="perfil-idioma"
        />
      </UFormField>

      <UFormField
        :label="t('profile.fields.email')"
        :help="correoEditable ? undefined : t('profile.fields.emailLocked')"
        :error="errores.email"
        data-test="campo-correo"
      >
        <UInput
          v-model="estado.email"
          type="email"
          autocomplete="email"
          :disabled="!correoEditable"
          :trailing-icon="correoEditable ? undefined : 'i-lucide-lock'"
          class="w-full"
          data-test="perfil-correo"
        />
      </UFormField>
    </div>

    <div class="flex justify-end">
      <UButton
        type="submit"
        :loading="enviando"
        :label="t('profile.save')"
        data-test="guardar-perfil"
      />
    </div>
  </UForm>
</template>
