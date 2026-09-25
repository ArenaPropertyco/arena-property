<script setup lang="ts">
import { validarCambioDeContrasena } from '#shared/identity/edicion-de-perfil'
import type { CambioDeContrasena, CampoDeContrasena } from '#shared/identity/edicion-de-perfil'

/**
 * Cambiar la contraseña pide la actual. Una cuenta creada con Google no tiene
 * ninguna: el formulario lo dice y ofrece **crearla**, sin campo de actual. La nueva
 * cumple las reglas del registro. Valida con el dominio y emite; el servidor
 * verifica la actual contra Supabase Auth.
 *
 * En `administrada` es el Superadmin quien fija la contraseña de otra cuenta desde
 * Roles: no hay actual que pedir y los textos lo dicen.
 */
const props = withDefaults(defineProps<{
  tieneContrasena: boolean
  enviando: boolean
  administrada?: boolean
}>(), { administrada: false })

/** Solo se pide la actual cuando la cuenta es propia y tiene contraseña. */
const pideActual = computed(() => props.tieneContrasena && !props.administrada)

const emit = defineEmits<{ submit: [CambioDeContrasena] }>()

const { t } = useI18n()

const estado = reactive<CambioDeContrasena>({ actual: '', nueva: '', confirmacion: '' })
const errores = ref<Partial<Record<CampoDeContrasena, string>>>({})
const visible = ref(false)

function enviar() {
  const encontrados = validarCambioDeContrasena(estado, pideActual.value)
  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))
  if (encontrados.length > 0) {
    return
  }
  emit('submit', { ...estado })
}

/** Tras un cambio correcto la página lo limpia: nada de contraseñas en memoria. */
function limpiar() {
  estado.actual = ''
  estado.nueva = ''
  estado.confirmacion = ''
  errores.value = {}
}

defineExpose({ limpiar })
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-5"
    data-test="formulario-contrasena"
    @submit.prevent="enviar"
  >
    <p
      class="text-sm text-muted"
      data-test="contrasena-explicacion"
    >
      {{ administrada ? t('profile.password.adminHint') : tieneContrasena ? t('profile.password.changeHint') : t('profile.password.createHint') }}
    </p>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        v-if="pideActual"
        :label="t('profile.password.current')"
        :error="errores.actual"
        class="sm:col-span-2"
        data-test="campo-actual"
      >
        <UInput
          v-model="estado.actual"
          :type="visible ? 'text' : 'password'"
          autocomplete="current-password"
          class="w-full sm:max-w-sm"
          data-test="contrasena-actual"
        />
      </UFormField>

      <UFormField
        :label="t('profile.password.new')"
        :hint="t('auth.register.passwordHint')"
        :error="errores.nueva"
        data-test="campo-nueva"
      >
        <UInput
          v-model="estado.nueva"
          :type="visible ? 'text' : 'password'"
          autocomplete="new-password"
          class="w-full"
          data-test="contrasena-nueva"
        />
      </UFormField>

      <UFormField
        :label="t('profile.password.confirm')"
        :error="errores.confirmacion"
        data-test="campo-confirmacion"
      >
        <UInput
          v-model="estado.confirmacion"
          :type="visible ? 'text' : 'password'"
          autocomplete="new-password"
          class="w-full"
          data-test="contrasena-confirmacion"
        />
      </UFormField>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <UCheckbox
        v-model="visible"
        :label="t('profile.password.show')"
      />
      <UButton
        type="submit"
        :loading="enviando"
        :label="pideActual || administrada ? t('profile.password.change') : t('profile.password.create')"
        data-test="guardar-contrasena"
      />
    </div>
  </UForm>
</template>
