<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import { TIPOS_DE_DOCUMENTO, validarTercero } from '#shared/scheduling/terceros'
import type { NuevoTercero, TipoDeDocumento } from '#shared/scheduling/terceros'
import type { HuespedRegistrado, SemanaDeBolsa } from '#shared/scheduling/vistas-renta'

/**
 * HU-39 · RF-39.1, RF-39.2, RF-39.5 · D-25 — rentar una semana de la bolsa.
 *
 * Solo se ofrecen semanas que ya están en la bolsa de renta: la lista llega
 * filtrada y la base vuelve a comprobarlo (CA-39.1). El huésped se reutiliza si ya
 * estaba registrado (CA-39.3) y, si es nuevo, no se guarda sin su consentimiento
 * explícito (RF-39.5, D-25).
 */
const props = defineProps<{
  semanas: SemanaDeBolsa[]
  huespedes: HuespedRegistrado[]
  enviando: boolean
}>()

const emit = defineEmits<{
  submit: [{ week: number, guestId: string | null, guest: NuevoTercero | null }]
}>()

const { t, locale } = useI18n()

const estado = reactive({
  week: null as number | null,
  guestId: '',
  fullName: '',
  documentKind: 'cc' as TipoDeDocumento,
  documentNumber: '',
  email: '',
  phone: '',
  consentAccepted: false,
})

const errores = ref<Record<string, string>>({})

const opcionesDeSemana = computed(() => props.semanas.map(semana => ({
  value: semana.week,
  label: t('rentals.weekLabel', {
    number: semana.week,
    from: formatearDia(semana.startsOn, locale.value as Idioma),
  }),
})))

const opcionesDeHuesped = computed(() => props.huespedes.map(huesped => ({
  value: huesped.id,
  label: `${huesped.fullName} · ${huesped.documentNumber}`,
})))

const opcionesDeDocumento = computed(() => TIPOS_DE_DOCUMENTO.map(tipo => ({
  value: tipo,
  label: t(`rentals.documents.${tipo}`),
})))

/** Sin huésped elegido del registro, el formulario pide uno nuevo. */
const registraNuevo = computed(() => estado.guestId === '')

function borrador(): NuevoTercero {
  return {
    fullName: estado.fullName.trim(),
    documentKind: estado.documentKind,
    documentNumber: estado.documentNumber.trim(),
    email: estado.email.trim() === '' ? null : estado.email.trim(),
    phone: estado.phone.trim() === '' ? null : estado.phone.trim(),
    consentAccepted: estado.consentAccepted,
  }
}

function enviar() {
  const encontrados: Record<string, string> = {}

  if (estado.week === null) {
    encontrados.week = t('rentals.validation.week_required')
  }

  const nuevo = registraNuevo.value ? borrador() : null
  if (nuevo) {
    for (const problema of validarTercero(nuevo)) {
      encontrados[problema.name] = t(problema.message)
    }
  }

  errores.value = encontrados
  if (Object.keys(encontrados).length > 0 || estado.week === null) {
    return
  }

  emit('submit', { week: estado.week, guestId: registraNuevo.value ? null : estado.guestId, guest: nuevo })
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-reserva-tercero"
    @submit.prevent="enviar"
  >
    <p
      v-if="semanas.length === 0"
      class="text-sm text-muted"
      data-test="sin-semanas"
    >
      {{ t('rentals.noWeeks') }}
    </p>

    <template v-else>
      <UFormField
        :label="t('rentals.week')"
        :error="errores.week"
        required
        data-test="campo-semana"
      >
        <USelect
          v-model="estado.week"
          :items="opcionesDeSemana"
          :placeholder="t('rentals.weekPlaceholder')"
          class="w-full"
          data-test="reserva-semana"
        />
      </UFormField>

      <UFormField
        v-if="huespedes.length > 0"
        :label="t('rentals.guestExisting')"
        data-test="campo-huesped-existente"
      >
        <USelect
          v-model="estado.guestId"
          :items="opcionesDeHuesped"
          :placeholder="t('rentals.guestNew')"
          class="w-full"
          data-test="reserva-huesped"
        />
      </UFormField>

      <div
        v-if="registraNuevo"
        class="space-y-4 rounded-lg border border-default p-4"
      >
        <p class="text-sm text-muted">
          {{ t('rentals.guestNew') }}
        </p>

        <UFormField
          :label="t('rentals.name')"
          :error="errores.fullName"
          required
          data-test="huesped-nombre"
        >
          <UInput
            v-model="estado.fullName"
            class="w-full"
          />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            :label="t('rentals.documentKind')"
            required
            data-test="campo-tipo-documento"
          >
            <USelect
              v-model="estado.documentKind"
              :items="opcionesDeDocumento"
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="t('rentals.documentNumber')"
            :error="errores.documentNumber"
            required
            data-test="huesped-documento"
          >
            <UInput
              v-model="estado.documentNumber"
              class="w-full font-mono"
            />
          </UFormField>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            :label="t('rentals.email')"
            :hint="t('rentals.contactHint')"
            :error="errores.email"
            data-test="huesped-correo"
          >
            <UInput
              v-model="estado.email"
              type="email"
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="t('rentals.phone')"
            data-test="huesped-telefono"
          >
            <UInput
              v-model="estado.phone"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField
          :error="errores.consent"
          :hint="t('rentals.consentHint')"
          data-test="campo-consentimiento"
        >
          <UCheckbox
            v-model="estado.consentAccepted"
            :label="t('rentals.consent')"
            data-test="huesped-consentimiento"
          />
        </UFormField>
      </div>

      <div class="flex justify-end">
        <UButton
          type="submit"
          :loading="enviando"
          :label="t('rentals.submit')"
          data-test="enviar-reserva"
        />
      </div>
    </template>
  </UForm>
</template>
