<script setup lang="ts">
import type { CopAmount } from '#shared/money/importe'
import { puede } from '#shared/permissions/mapa'
import type { ReservaListada } from '#shared/scheduling/vistas-renta'
import type { SolicitudDeReserva } from '~/composables/useRentas'

/**
 * HU-39 · RF-39.1…RF-39.5 · HU-40 · RF-40.1, RF-40.4 · D-39 — la renta a terceros
 * de una propiedad.
 *
 * La página orquesta: carga la bolsa de renta del año con el origen de cada semana
 * ya resuelto, monta los componentes y traduce cada resultado en un aviso. Rentar,
 * cancelar y registrar el ingreso son del Administrador de la propiedad; fijar la
 * comisión de gestión, solo del Superadmin (RF-40.4).
 *
 * RF-17.5 · D-43 · la bolsa se lista antes que las reservas: es lo que hay por
 * hacer, frente a lo que ya se hizo.
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'gestionar_calendario' } })

const { t } = useI18n()
const toast = useToast()
const ruta = useRoute()
const localePath = useLocalePath()
const { roles } = useCuenta()
const ahora = useAhora()

const propiedadId = computed(() => String(ruta.params.propiedad ?? ''))
const anio = ref(Number(ruta.query.anio ?? 0) || new Date(ahora.value).getFullYear() + 1)

const { propiedad, semanas, reservas, huespedes, pendiente, rentar, cancelar, registrarIngreso, fijarComision }
  = useRentas(propiedadId, anio)

const esSuperadmin = computed(() => roles.value.includes('superadmin'))
const puedeGestionar = computed(() => puede(roles.value, 'gestionar_calendario', { escritura: true }))

const rentando = ref(false)
const ingresando = ref<string | null>(null)
const cancelando = ref<string | null>(null)
const ocupado = ref(false)

const reservaDelIngreso = computed<ReservaListada | null>(() =>
  reservas.value.find(reserva => reserva.id === ingresando.value) ?? null)

async function ejecutar(
  operacion: () => Promise<{ ok: true } | { ok: false, clave: string }>,
  exito: string,
) {
  ocupado.value = true
  const resultado = await operacion()
  ocupado.value = false

  toast.add(resultado.ok
    ? { title: t(exito), color: 'success' }
    : { title: t(resultado.clave), color: 'error' })

  return resultado.ok
}

async function crearReserva(solicitud: SolicitudDeReserva) {
  if (await ejecutar(() => rentar(solicitud), 'rentals.messages.booked')) {
    rentando.value = false
  }
}

async function guardarIngreso(bruto: CopAmount) {
  const reserva = ingresando.value
  if (!reserva) {
    return
  }
  if (await ejecutar(() => registrarIngreso(reserva, bruto), 'rentals.messages.income')) {
    ingresando.value = null
  }
}

async function confirmarCancelacion(motivo: string) {
  const reserva = cancelando.value
  if (!reserva) {
    return
  }
  if (await ejecutar(() => cancelar(reserva, motivo), 'rentals.messages.cancelled')) {
    cancelando.value = null
  }
}

async function guardarComision(puntos: number) {
  await ejecutar(() => fijarComision(puntos), 'rentals.messages.commission')
}
</script>

<template>
  <PanelPage
    :titulo="t('rentals.title')"
    :subtitulo="propiedad?.name ?? undefined"
  >
    <p
      v-if="!pendiente && !propiedad"
      class="text-sm text-muted"
      data-test="propiedad-no-encontrada"
    >
      {{ t('rentals.notFound') }}
    </p>

    <div
      v-else-if="propiedad"
      class="space-y-8"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UButton
          variant="link"
          size="sm"
          icon="i-lucide-arrow-left"
          :to="localePath(`/panel/propiedades/${propiedad.id}`)"
          :label="propiedad.name"
          data-test="volver-a-propiedad"
        />

        <div class="flex flex-wrap items-center gap-2">
          <RentalYearPicker v-model:anio="anio" />
          <UButton
            v-if="puedeGestionar"
            size="sm"
            icon="i-lucide-plus"
            :label="t('rentals.rent')"
            data-test="rentar-semana"
            @click="rentando = true"
          />
        </div>
      </div>

      <section
        v-if="esSuperadmin"
        class="space-y-4"
      >
        <SectionHeading :titulo="t('rentals.commission.title')" />
        <RentalCommissionForm
          :puntos-basicos="propiedad.comisionPuntosBasicos"
          :enviando="ocupado"
          @submit="guardarComision"
        />
      </section>

      <section class="space-y-4">
        <SectionHeading :titulo="t('rentals.pool.title')" />
        <RentalPoolTable
          :semanas="semanas"
          :puede-gestionar="puedeGestionar"
          @rentar="rentando = true"
        />
      </section>

      <section class="space-y-4">
        <SectionHeading :titulo="t('rentals.subtitle')" />
        <ThirdPartyBookingsTable
          :reservas="reservas"
          :puede-gestionar="puedeGestionar"
          @ingreso="ingresando = $event"
          @cancelar="cancelando = $event"
        />
      </section>
    </div>

    <USlideover
      v-model:open="rentando"
      :title="t('rentals.rentTitle')"
    >
      <template #body>
        <ThirdPartyBookingForm
          v-if="rentando"
          :semanas="semanas"
          :huespedes="huespedes"
          :enviando="ocupado"
          @submit="crearReserva"
        />
      </template>
    </USlideover>

    <UModal
      :open="reservaDelIngreso !== null"
      :title="t('rentals.income.registerTitle')"
      @update:open="ingresando = null"
    >
      <template #body>
        <RentalIncomeForm
          v-if="reservaDelIngreso"
          :reserva="reservaDelIngreso"
          :comision-puntos-basicos="propiedad?.comisionPuntosBasicos ?? null"
          :enviando="ocupado"
          @submit="guardarIngreso"
        />
      </template>
    </UModal>

    <UModal
      :open="cancelando !== null"
      :title="t('rentals.cancelTitle')"
      @update:open="cancelando = null"
    >
      <template #body>
        <ReasonForm
          :descripcion="t('rentals.cancelHint')"
          :etiqueta="t('rentals.confirmCancel')"
          :enviando="ocupado"
          @submit="confirmarCancelacion"
        />
      </template>
    </UModal>
  </PanelPage>
</template>
