<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '@nuxt/ui'
import { normalizarEmail, validarRegistro } from '#shared/identity/registro'

/**
 * Invitación de un Administrador por correo (HU-05 · RF-05.1). Emite el correo
 * normalizado; la página lo envía a la ruta de servidor que crea la cuenta.
 */
const props = withDefaults(defineProps<{ enviando?: boolean }>(), { enviando: false })

const emit = defineEmits<{ submit: [email: string] }>()

const { t } = useI18n()

const estado = reactive({ email: '' })

function validar(datos: Partial<typeof estado>): FormError[] {
  return validarRegistro({ email: datos.email ?? '', password: 'solo-valida-el-correo-1' })
    .filter(error => error.name === 'email')
    .map(error => ({ name: error.name, message: t(error.message) }))
}

function enviar(evento: FormSubmitEvent<typeof estado>) {
  if (props.enviando) {
    return
  }
  emit('submit', normalizarEmail(evento.data.email))
  estado.email = ''
}
</script>

<template>
  <UPageCard>
    <template #header>
      <SectionHeading :titulo="t('admins.invite')" />
    </template>

    <UForm
      :state="estado"
      :validate="validar"
      class="flex flex-col sm:flex-row sm:items-end gap-3"
      data-test="formulario-invitacion"
      @submit="enviar"
    >
      <UFormField
        name="email"
        :label="t('admins.inviteEmail')"
        class="flex-1"
        required
      >
        <UInput
          v-model="estado.email"
          type="email"
          class="w-full"
        />
      </UFormField>
      <UButton
        type="submit"
        :loading="enviando"
        :label="t('admins.inviteSubmit')"
      />
    </UForm>

    <template #footer>
      <p class="text-sm text-muted">
        {{ t('admins.propertiesHint') }}
      </p>
    </template>
  </UPageCard>
</template>
