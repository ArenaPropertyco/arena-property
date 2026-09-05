<script setup lang="ts">
import {
  claveDeIntencion,
  claveDeRango,
  claveDeTipo,
  INTENCIONES_DE_COMPRA,
  normalizarContacto,
  RANGOS_DE_RENTA,
  TIPOS_DE_PROPIEDAD,
  validarContacto,
} from '#shared/contact/esquema'
import type { RangoDeRenta, SolicitudDeContacto, TipoDePropiedad } from '#shared/contact/esquema'

/**
 * HU-46 · RF-46.1…RF-46.4, RF-46.6 — el formulario general de contacto.
 *
 * Valida con el esquema compartido y muestra todos los errores por campo, ya
 * traducidos (CA-46.1). Las tres selecciones recorren los catálogos cerrados
 * (CA-46.3); la intención va en botones de opción porque sus textos son frases
 * completas y merecen leerse enteras. Emite la solicitud normalizada.
 */
const props = withDefaults(defineProps<{
  enviando: boolean
  /** RF-46.6 · código de referido de la sesión, prellenado. */
  codigoReferido?: string | null
  /** Valores con los que la página quiere arrancar el formulario. */
  inicial?: Partial<SolicitudDeContacto>
}>(), { codigoReferido: null, inicial: () => ({}) })

const emit = defineEmits<{ submit: [SolicitudDeContacto] }>()

const { t } = useI18n()

const estado = reactive<SolicitudDeContacto>({
  firstName: props.inicial.firstName ?? '',
  lastName: props.inicial.lastName ?? '',
  email: props.inicial.email ?? '',
  phone: props.inicial.phone ?? '',
  message: props.inicial.message ?? '',
  intent: props.inicial.intent ?? null,
  propertyType: props.inicial.propertyType ?? null,
  incomeRange: props.inicial.incomeRange ?? null,
  referralCode: props.inicial.referralCode ?? props.codigoReferido,
  propertyId: null,
})

const errores = ref<Record<string, string>>({})

const intenciones = computed(() => INTENCIONES_DE_COMPRA.map(intencion => ({ value: intencion, label: t(claveDeIntencion(intencion)) })))
const tipos = computed(() => TIPOS_DE_PROPIEDAD.map(tipo => ({ value: tipo, label: t(claveDeTipo(tipo)) })))
const rangos = computed(() => RANGOS_DE_RENTA.map(rango => ({ value: rango, label: t(claveDeRango(rango)) })))

function enviar() {
  const encontrados = validarContacto(estado, 'general')
  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))
  if (encontrados.length > 0 || props.enviando) {
    return
  }
  emit('submit', normalizarContacto(estado))
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-5"
    data-test="formulario-contacto"
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

      <UFormField
        :label="t('contact.fields.propertyType')"
        :error="errores.propertyType"
        required
        data-test="campo-tipo"
      >
        <USelect
          :model-value="estado.propertyType ?? undefined"
          :items="tipos"
          class="w-full"
          @update:model-value="estado.propertyType = ($event as TipoDePropiedad)"
        />
      </UFormField>

      <UFormField
        :label="t('contact.fields.incomeRange')"
        :error="errores.incomeRange"
        required
        data-test="campo-renta"
      >
        <USelect
          :model-value="estado.incomeRange ?? undefined"
          :items="rangos"
          class="w-full"
          @update:model-value="estado.incomeRange = ($event as RangoDeRenta)"
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
        :label="t('contact.submit')"
        trailing-icon="i-lucide-send"
        data-test="enviar-contacto"
      />
    </div>
  </UForm>
</template>
