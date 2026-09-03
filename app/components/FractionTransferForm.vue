<script setup lang="ts">
import { DESTINOS_DE_CUOTAS, DESTINOS_DE_RESERVAS, validarTraspaso } from '#shared/properties/traspaso'
import type { DestinoDeCuotas, DestinoDeReservas, SolicitudDeTraspaso } from '#shared/properties/traspaso'
import type { FraccionListada, OpcionDeCuenta } from '#shared/properties/vistas'

/**
 * HU-09 · RF-09.5 · D-17 — traspaso de titular de una fracción vendida.
 *
 * Los dos destinos —semanas confirmadas y cuotas pendientes— se presentan con un
 * valor por omisión visible («las hereda el nuevo titular») pero se muestran
 * siempre: la spec exige que el traspaso los resuelva explícitamente, y esconderlos
 * detrás de un valor implícito es no resolverlos.
 *
 * El nuevo titular se elige de una lista abierta, no de un desplegable: esto
 * traspasa un activo y no tiene vuelta atrás sin otro traspaso, así que quien lo
 * hace debe ver a quién se lo está entregando. La pantalla que monta el formulario
 * es la que acota los candidatos.
 */
const props = defineProps<{
  fraccion: FraccionListada
  candidatos: OpcionDeCuenta[]
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [SolicitudDeTraspaso] }>()

const { t } = useI18n()

const estado = reactive({
  newOwnerId: '',
  bookings: 'transfer' as DestinoDeReservas,
  installments: 'transfer' as DestinoDeCuotas,
  reason: '',
})

const errores = ref<Record<string, string>>({})

const opcionesDeReservas = computed(() => DESTINOS_DE_RESERVAS.map(destino => ({
  value: destino,
  label: destino === 'transfer' ? t('properties.transfer.bookingsTransfer') : t('properties.transfer.bookingsCancel'),
})))

const opcionesDeCuotas = computed(() => DESTINOS_DE_CUOTAS.map(destino => ({
  value: destino,
  label: destino === 'transfer'
    ? t('properties.transfer.installmentsTransfer')
    : t('properties.transfer.installmentsSettle'),
})))

function enviar() {
  const solicitud: SolicitudDeTraspaso = {
    fractionId: props.fraccion.id,
    propertyId: props.fraccion.propertyId,
    fractionStatus: props.fraccion.status,
    previousOwnerId: props.fraccion.ownerId ?? '',
    newOwnerId: estado.newOwnerId.trim(),
    bookings: estado.bookings,
    installments: estado.installments,
    reason: estado.reason,
  }

  // El componente no sabe quién es quien mira: la pantalla solo lo monta para el
  // Superadmin, y la base vuelve a comprobarlo. Aquí se validan los campos.
  const encontrados = validarTraspaso(solicitud, { esSuperadmin: true })

  errores.value = Object.fromEntries(encontrados.map(error => [error.name, t(error.message)]))
  if (encontrados.length > 0) {
    return
  }

  emit('submit', solicitud)
}
</script>

<template>
  <UForm
    :state="estado"
    class="space-y-4"
    data-test="formulario-traspaso"
    @submit.prevent="enviar"
  >
    <p class="text-sm text-muted">
      {{ t('properties.transfer.subtitle') }}
    </p>

    <UFormField
      :label="t('properties.transfer.newOwner')"
      :error="errores.newOwnerId"
      required
      data-test="campo-nuevo-titular"
    >
      <URadioGroup
        v-model="estado.newOwnerId"
        :items="candidatos.map(cuenta => ({ label: cuenta.label, value: cuenta.id }))"
        value-key="value"
        data-test="selector-titular"
      />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        :label="t('properties.transfer.bookings')"
        :error="errores.bookings"
        required
        data-test="campo-reservas"
      >
        <USelect
          v-model="estado.bookings"
          :items="opcionesDeReservas"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="t('properties.transfer.installments')"
        :error="errores.installments"
        required
        data-test="campo-cuotas"
      >
        <USelect
          v-model="estado.installments"
          :items="opcionesDeCuotas"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      :label="t('properties.transfer.reason')"
      :hint="t('properties.transfer.reasonHint')"
      :error="errores.reason"
      required
      data-test="campo-motivo"
    >
      <UTextarea
        v-model="estado.reason"
        :rows="3"
        class="w-full"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        :loading="enviando"
        :label="t('properties.transfer.submit')"
        data-test="enviar-traspaso"
      />
    </div>
  </UForm>
</template>
