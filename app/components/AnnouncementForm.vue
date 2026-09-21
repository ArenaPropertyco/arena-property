<script setup lang="ts">
import { URGENCIAS, validarNovedad } from '#shared/notifications/novedades'
import type { FraccionDestinataria, NuevaNovedad, Urgencia } from '#shared/notifications/novedades'

/**
 * HU-29 · RF-29.1, RF-29.5, RF-29.6 · RT-06 — publicar una novedad sobre una
 * propiedad administrada.
 *
 * Valida con el dominio antes de emitir (CA-29.2): propiedad, título,
 * descripción y urgencia del catálogo, y la fracción si la novedad va dirigida a
 * una sola (D-46). La base vuelve a rechazar lo mismo y, al aceptar, notifica ella
 * a quien toque (RF-29.2): aquí no se resuelve ningún destinatario. Con una sola
 * propiedad gestionada, queda elegida. El interruptor de visibilidad se ofrece
 * solo a quien puede fijarlo, que es el Superadmin (RF-29.6).
 */
const props = withDefaults(defineProps<{
  /** Las propiedades sobre las que quien publica puede hacerlo. */
  propiedades: { id: string, name: string }[]
  /** RF-29.5 · las fracciones vendidas de esas propiedades, para dirigir la novedad a una. */
  fracciones?: FraccionDestinataria[]
  /** RF-29.6 · puede publicarla inactiva: solo el Superadmin. */
  puedeCambiarVisibilidad?: boolean
  enviando: boolean
}>(), { fracciones: () => [], puedeCambiarVisibilidad: false })

const emit = defineEmits<{ submit: [NuevaNovedad] }>()

const { t } = useI18n()

type Destinatario = 'property' | 'fraction'

const estado = reactive({
  propertyId: props.propiedades.length === 1 ? props.propiedades[0]!.id : '',
  title: '',
  body: '',
  urgency: 'informative' as Urgencia,
  audience: 'property' as Destinatario,
  fractionId: '',
  active: true,
})

const errores = ref<Record<string, string>>({})

const opcionesDePropiedad = computed(() => props.propiedades.map(propiedad => ({ value: propiedad.id, label: propiedad.name })))

const opcionesDeUrgencia = computed(() => URGENCIAS.map(urgencia => ({
  value: urgencia,
  label: t(`announcements.urgencies.${urgencia}`),
  description: t(`announcements.urgencyHints.${urgencia}`),
})))

const opcionesDeDestinatario = computed(() => (['property', 'fraction'] as const).map(destinatario => ({
  value: destinatario,
  label: t(`announcements.audiences.${destinatario}`),
  description: t(`announcements.audienceHints.${destinatario}`),
})))

/** RF-29.5 · solo las fracciones de la propiedad elegida que tienen titular: a las demás no hay a quién. */
const fraccionesDeLaPropiedad = computed(() => props.fracciones
  .filter(fraccion => fraccion.propertyId === estado.propertyId && fraccion.ownerId !== null)
  .sort((a, b) => a.number - b.number))

const opcionesDeFraccion = computed(() => fraccionesDeLaPropiedad.value.map(fraccion => ({
  value: fraccion.id,
  label: t('announcements.fractionOption', { number: fraccion.number, owner: fraccion.ownerLabel ?? '' }),
})))

// Cambiar de propiedad deja sin sentido la fracción elegida.
watch(() => estado.propertyId, () => {
  estado.fractionId = ''
})

function enviar() {
  const novedad: NuevaNovedad = {
    propertyId: estado.propertyId,
    fractionId: estado.audience === 'fraction' && estado.fractionId !== '' ? estado.fractionId : null,
    title: estado.title.trim(),
    body: estado.body.trim(),
    urgency: estado.urgency,
    active: props.puedeCambiarVisibilidad ? estado.active : true,
  }

  const encontrados = validarNovedad(novedad, props.fracciones)
  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))
  // RF-29.5 · dirigida a una fracción, hay que decir cuál.
  if (estado.audience === 'fraction' && novedad.fractionId === null) {
    errores.value.fractionId = t('announcements.validation.fraction_required')
  }
  if (Object.keys(errores.value).length > 0) {
    return
  }

  emit('submit', novedad)
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-novedad"
    @submit.prevent="enviar"
  >
    <UFormField
      :label="t('announcements.property')"
      :error="errores.propertyId"
      required
      data-test="campo-propiedad"
    >
      <USelect
        v-model="estado.propertyId"
        :items="opcionesDePropiedad"
        :placeholder="t('announcements.propertyPlaceholder')"
        class="w-full"
        data-test="novedad-propiedad"
      />
    </UFormField>

    <UFormField
      :label="t('announcements.titleField')"
      :error="errores.title"
      required
      data-test="campo-titulo"
    >
      <UInput
        v-model="estado.title"
        :placeholder="t('announcements.titlePlaceholder')"
        maxlength="120"
        class="w-full"
      />
    </UFormField>

    <UFormField
      :label="t('announcements.body')"
      :hint="t('announcements.bodyHint')"
      :error="errores.body"
      required
      data-test="campo-cuerpo"
    >
      <UTextarea
        v-model="estado.body"
        :rows="4"
        maxlength="2000"
        class="w-full"
      />
    </UFormField>

    <UFormField
      :label="t('announcements.urgency')"
      :error="errores.urgency"
      required
      data-test="campo-urgencia"
    >
      <URadioGroup
        v-model="estado.urgency"
        :items="opcionesDeUrgencia"
        value-key="value"
        data-test="novedad-urgencia"
      />
    </UFormField>

    <UFormField
      :label="t('announcements.audience')"
      :error="errores.fractionId"
      required
      data-test="campo-destinatario"
    >
      <div class="space-y-3">
        <URadioGroup
          v-model="estado.audience"
          :items="opcionesDeDestinatario"
          value-key="value"
          data-test="novedad-destinatario"
        />

        <USelect
          v-if="estado.audience === 'fraction' && opcionesDeFraccion.length > 0"
          v-model="estado.fractionId"
          :items="opcionesDeFraccion"
          :placeholder="t('announcements.fractionPlaceholder')"
          class="w-full"
          data-test="novedad-fraccion"
        />
        <p
          v-else-if="estado.audience === 'fraction'"
          class="text-sm text-error"
          data-test="sin-fracciones-vendidas"
        >
          {{ t('announcements.noSoldFractions') }}
        </p>
      </div>
    </UFormField>

    <UFormField
      v-if="puedeCambiarVisibilidad"
      :hint="t('announcements.visibleHint')"
      data-test="campo-visible"
    >
      <UCheckbox
        v-model="estado.active"
        :label="t('announcements.visible')"
        data-test="novedad-visible"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        icon="i-lucide-megaphone"
        :loading="enviando"
        :label="t('announcements.submit')"
        data-test="publicar"
      />
    </div>
  </UForm>
</template>
