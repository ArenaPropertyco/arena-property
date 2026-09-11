<script setup lang="ts">
import { normalizarInscripcion, validarInscripcion } from '#shared/waitlist/esquema'
import type { InscripcionEnListaDeEspera } from '#shared/waitlist/esquema'

/**
 * HU-47 · RF-47.1, RF-47.5 — anotarse en la lista de espera de una propiedad
 * sin fracciones disponibles: nombre, correo, teléfono y el consentimiento
 * explícito (D-25). Valida con el esquema compartido y emite la inscripción
 * normalizada; la página la envía por la ruta Nitro.
 */
const props = defineProps<{
  propiedad: { id: string, name: string }
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [InscripcionEnListaDeEspera] }>()

const { t } = useI18n()

const estado = reactive<InscripcionEnListaDeEspera>({
  propertyId: props.propiedad.id,
  fullName: '',
  email: '',
  phone: '',
  consent: false,
})

const errores = ref<Record<string, string>>({})

function enviar() {
  const encontrados = validarInscripcion(estado)
  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))
  if (encontrados.length > 0 || props.enviando) {
    return
  }
  emit('submit', normalizarInscripcion({ ...estado, propertyId: props.propiedad.id }))
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-5"
    data-test="formulario-lista-de-espera"
    @submit.prevent="enviar"
  >
    <div class="grid gap-5 sm:grid-cols-3">
      <UFormField
        :label="t('waitlist.fields.fullName')"
        :error="errores.fullName"
        required
        data-test="campo-espera-nombre"
      >
        <UInput
          v-model="estado.fullName"
          autocomplete="name"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="t('waitlist.fields.email')"
        :error="errores.email"
        required
        data-test="campo-espera-email"
      >
        <UInput
          v-model="estado.email"
          type="email"
          autocomplete="email"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="t('waitlist.fields.phone')"
        :error="errores.phone"
        required
        data-test="campo-espera-telefono"
      >
        <UInput
          v-model="estado.phone"
          type="tel"
          autocomplete="tel"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      :error="errores.consent"
      data-test="campo-espera-consentimiento"
    >
      <UCheckbox
        v-model="estado.consent"
        :label="t('waitlist.fields.consent')"
        data-test="espera-consentimiento"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        size="lg"
        icon="i-lucide-bell-ring"
        :loading="enviando"
        :label="t('waitlist.submit')"
        data-test="enviar-lista-de-espera"
      />
    </div>
  </UForm>
</template>
