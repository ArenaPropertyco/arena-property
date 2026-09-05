<script setup lang="ts">
import { claveDeIntencion, INTENCIONES_DE_COMPRA, normalizarContacto, validarContacto } from '#shared/contact/esquema'
import type { SolicitudDeContacto } from '#shared/contact/esquema'

/**
 * HU-03 · RF-03.2, RF-03.3, RF-03.5 — contacto desde la ficha de una propiedad.
 *
 * Mismo esquema que el general (contexto `property`): datos de contacto, mensaje y
 * la intención de compra con sus 4 opciones exactas (CA-03.3). Emite la solicitud
 * vinculada a la propiedad (CA-03.2). Expone `enfocar()` para que el botón
 * «Contáctanos» de la ficha traiga el foco hasta aquí (RF-03.1).
 */
const props = withDefaults(defineProps<{
  propiedad: { id: string, name: string }
  enviando: boolean
  codigoReferido?: string | null
}>(), { codigoReferido: null })

const emit = defineEmits<{ submit: [SolicitudDeContacto] }>()

const { t } = useI18n()

const estado = reactive<SolicitudDeContacto>({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  message: '',
  intent: null,
  referralCode: props.codigoReferido,
  propertyId: props.propiedad.id,
})

const errores = ref<Record<string, string>>({})
const primerCampo = ref<{ inputRef?: HTMLInputElement } | null>(null)

const intenciones = computed(() => INTENCIONES_DE_COMPRA.map(intencion => ({ value: intencion, label: t(claveDeIntencion(intencion)) })))

function enviar() {
  const encontrados = validarContacto(estado, 'property')
  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))
  if (encontrados.length > 0 || props.enviando) {
    return
  }
  emit('submit', normalizarContacto({ ...estado, propertyId: props.propiedad.id }))
}

/** RF-03.1 · el ancla de la ficha enfoca el primer campo, no solo desplaza. */
function enfocar() {
  primerCampo.value?.inputRef?.focus()
}

defineExpose({ enfocar })
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-5"
    data-test="formulario-contacto-propiedad"
    @submit.prevent="enviar"
  >
    <div class="grid gap-5 sm:grid-cols-2">
      <UFormField
        :label="t('contact.fields.firstName')"
        :error="errores.firstName"
        required
        data-test="campo-nombre"
      >
        <UInput
          ref="primerCampo"
          v-model="estado.firstName"
          autocomplete="given-name"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="t('contact.fields.lastName')"
        :error="errores.lastName"
        required
        data-test="campo-apellidos"
      >
        <UInput
          v-model="estado.lastName"
          autocomplete="family-name"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="t('contact.fields.email')"
        :error="errores.email"
        required
        data-test="campo-email"
      >
        <UInput
          v-model="estado.email"
          type="email"
          autocomplete="email"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="t('contact.fields.phone')"
        :error="errores.phone"
        required
        data-test="campo-telefono"
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
      :label="t('contact.fields.intent')"
      :error="errores.intent"
      required
      data-test="campo-intencion"
    >
      <URadioGroup
        v-model="estado.intent"
        :items="intenciones"
        value-key="value"
      />
    </UFormField>

    <UFormField
      :label="t('contact.fields.message')"
      :error="errores.message"
      required
      data-test="campo-mensaje"
    >
      <UTextarea
        v-model="estado.message"
        :rows="4"
        autoresize
        class="w-full"
      />
    </UFormField>

    <UFormField
      :label="t('contact.fields.referralCode')"
      :hint="t('contact.fields.referralHint')"
      :error="errores.referralCode"
      data-test="campo-referido"
    >
      <UInput
        :model-value="estado.referralCode ?? ''"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        class="w-full font-mono uppercase sm:max-w-xs"
        @update:model-value="estado.referralCode = String($event)"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        size="lg"
        :loading="enviando"
        :label="t('contact.submitProperty')"
        trailing-icon="i-lucide-send"
        data-test="enviar-contacto"
      />
    </div>
  </UForm>
</template>
