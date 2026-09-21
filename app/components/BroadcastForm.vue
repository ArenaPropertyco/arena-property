<script setup lang="ts">
import { ROLES_SEGMENTABLES, TIPOS_DE_SEGMENTO, validarComunicado } from '#shared/notifications/comunicados'
import type { NuevoComunicado, RolSegmentable, SegmentoDeComunicado, TipoDeSegmento } from '#shared/notifications/comunicados'

/**
 * HU-31 · RF-31.1 · RT-06 — redactar un comunicado global y decir a quién va.
 *
 * El segmento se declara con el vocabulario cerrado del dominio: todos, por
 * roles o por propiedad. Valida antes de emitir; a quién llega de verdad lo
 * resuelve la base al enviarlo (RF-31.2), y solo si quien envía es el
 * Superadmin (RF-31.4).
 */
const props = defineProps<{
  /** Las propiedades entre las que se puede segmentar. */
  propiedades: { id: string, name: string }[]
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [NuevoComunicado] }>()

const { t } = useI18n()

const estado = reactive({
  title: '',
  body: '',
  kind: 'all' as TipoDeSegmento,
  roles: [] as RolSegmentable[],
  propertyId: '',
})

const errores = ref<Record<string, string>>({})

const opcionesDeSegmento = computed(() => TIPOS_DE_SEGMENTO.map(tipo => ({
  value: tipo,
  label: t(`broadcasts.segments.${tipo}`),
  description: t(`broadcasts.segmentHints.${tipo}`),
})))

const opcionesDeRol = computed(() => ROLES_SEGMENTABLES.map(rol => ({ value: rol, label: t(`broadcasts.roles.${rol}`) })))

const opcionesDePropiedad = computed(() => props.propiedades.map(propiedad => ({ value: propiedad.id, label: propiedad.name })))

function segmento(): SegmentoDeComunicado {
  switch (estado.kind) {
    case 'roles':
      return { kind: 'roles', roles: [...estado.roles] }
    case 'property':
      return { kind: 'property', propertyId: estado.propertyId }
    default:
      return { kind: 'all' }
  }
}

function enviar() {
  const comunicado: NuevoComunicado = {
    title: estado.title.trim(),
    body: estado.body.trim(),
    segment: segmento(),
  }

  const encontrados = validarComunicado(comunicado)
  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))
  if (encontrados.length > 0) {
    return
  }

  emit('submit', comunicado)
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-comunicado"
    @submit.prevent="enviar"
  >
    <UFormField
      :label="t('broadcasts.titleField')"
      :error="errores.title"
      required
      data-test="campo-titulo"
    >
      <UInput
        v-model="estado.title"
        maxlength="120"
        class="w-full"
      />
    </UFormField>

    <UFormField
      :label="t('broadcasts.body')"
      :hint="t('broadcasts.bodyHint')"
      :error="errores.body"
      required
      data-test="campo-cuerpo"
    >
      <UTextarea
        v-model="estado.body"
        :rows="6"
        maxlength="4000"
        class="w-full"
      />
    </UFormField>

    <UFormField
      :label="t('broadcasts.segment')"
      :error="errores.segment"
      required
      data-test="campo-segmento"
    >
      <div class="space-y-3">
        <URadioGroup
          v-model="estado.kind"
          :items="opcionesDeSegmento"
          value-key="value"
          data-test="comunicado-segmento"
        />

        <UCheckboxGroup
          v-if="estado.kind === 'roles'"
          v-model="estado.roles"
          :items="opcionesDeRol"
          value-key="value"
          orientation="horizontal"
          data-test="comunicado-roles"
        />

        <USelect
          v-if="estado.kind === 'property'"
          v-model="estado.propertyId"
          :items="opcionesDePropiedad"
          :placeholder="t('broadcasts.propertyPlaceholder')"
          class="w-full"
          data-test="comunicado-propiedad"
        />
      </div>
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        icon="i-lucide-send"
        :loading="enviando"
        :label="t('broadcasts.submit')"
        data-test="enviar-comunicado"
      />
    </div>
  </UForm>
</template>
