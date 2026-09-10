<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import { movableWeeks } from '#shared/scheduling/relocation'
import type { RelocationContext } from '#shared/scheduling/relocation'
import type { SwapRequestDraft } from '#shared/scheduling/swaps'

/**
 * HU-13 · RF-13.1…RF-13.4 · HU-14 · RF-14.1…RF-14.9 · HU-12 · RF-12.3, RF-12.4,
 * RF-12.6 · HU-59 · RF-59.3, RF-59.6 (D-32, D-33, D-36) — el calendario del
 * Propietario, por semanas.
 *
 * La página orquesta: elige fracción y año; si la selección está abierta y le
 * toca, monta la elección de semanas; con semanas elegidas, el calendario por
 * semanas donde confirma, cancela o libera, el aviso de las que faltan por
 * confirmar, la ventana de reubicación con el estado de su turno, la solicitud
 * de intercambios y sus solicitudes. Con el calendario inactivo (D-31) todo se ve
 * y nada se puede hacer (RF-13.1b).
 */
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })

const { t, locale } = useI18n()
const toast = useToast()
const { fracciones, pendiente: cargandoFracciones } = useFraccionesPropias()
const { planes } = usePlanesPropios()

const fraccionId = ref<string | null>(null)
watch(fracciones, (lista) => {
  if (!fraccionId.value && lista[0]) {
    fraccionId.value = lista[0].id
  }
}, { immediate: true })

const fraccion = computed(() => fracciones.value.find(f => f.id === fraccionId.value) ?? null)
const opciones = computed(() => fracciones.value.map(f => ({
  id: f.id,
  label: `${f.propertyName} · ${t('owner.fraction', { number: f.number })}`,
})))

const anio = ref(new Date().getFullYear())

const semanas = useOwnerWeeks(fraccion, anio)
const seleccion = useWeekSelection(fraccion, anio)
const reubicacion = useRelocation(fraccion, anio)

const plan = computed(() => planes.value.find(p => p.fractionId === fraccion.value?.id) ?? null)
const takenList = computed(() => [...seleccion.taken.value])
const proximaLimite = computed(() => {
  const primera = semanas.projection.value?.pending[0]
  return primera ? formatearDia(primera.deadline, locale.value as Idioma) : ''
})

/** HU-59 · lo que el motor de reubicación necesita: calendario ocupado, turno y hoy. */
const contextoDeReubicacion = computed<RelocationContext | null>(() => {
  const propia = fraccion.value
  if (!propia || !semanas.projection.value) {
    return null
  }
  return {
    rejilla: semanas.rejilla.value,
    classification: semanas.classification.value,
    allocations: semanas.allocations.value,
    blockedWeeks: new Set(semanas.blockedWeeks.value),
    today: semanas.today.value,
    calendarActive: propia.calendarActive,
    turn: reubicacion.turno.value,
  }
})
const semanasMovibles = computed(() => (contextoDeReubicacion.value && fraccion.value)
  ? movableWeeks(contextoDeReubicacion.value.allocations, fraccion.value.number, { rejilla: contextoDeReubicacion.value.rejilla, today: contextoDeReubicacion.value.today })
  : [])

const busyWeek = ref<number | null>(null)
const eligiendo = ref(false)
const solicitando = ref(false)
const reubicando = ref(false)

async function operar(accion: 'confirm' | 'cancel' | 'release', week: number, exito: string) {
  busyWeek.value = week
  const resultado = await semanas[accion](week)
  busyWeek.value = null
  if (!resultado.ok) {
    toast.add({ title: t(resultado.clave), color: 'error' })
    return
  }
  await seleccion.recargar()
  toast.add({ title: t(exito), color: 'success' })
}

async function elegirSemanas(elegidas: number[]) {
  eligiendo.value = true
  const resultado = await seleccion.elegir(elegidas)
  eligiendo.value = false
  if (!resultado.ok) {
    toast.add({ title: t(resultado.clave), color: 'error' })
    return
  }
  await semanas.recargar()
  toast.add({ title: t('calendar.selection.selected'), color: 'success' })
}

async function reubicarSemana(desde: number, hasta: number) {
  reubicando.value = true
  const resultado = await reubicacion.reubicar(desde, hasta)
  reubicando.value = false
  if (!resultado.ok) {
    toast.add({ title: t(resultado.clave), color: 'error' })
    return
  }
  await Promise.all([semanas.recargar(), seleccion.recargar()])
  toast.add({ title: t('calendar.relocation.done'), color: 'success' })
}

async function solicitarIntercambio(borrador: SwapRequestDraft, mensaje: string | null) {
  solicitando.value = true
  const resultado = await seleccion.solicitar(borrador, mensaje)
  solicitando.value = false
  toast.add(resultado.ok ? { title: t('calendar.swaps.requested_ok'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}
</script>

<template>
  <PanelPage
    :titulo="t('calendar.weeks.title')"
    :subtitulo="t('calendar.weeks.subtitle')"
  >
    <p
      v-if="!cargandoFracciones && fracciones.length === 0"
      class="text-sm text-muted"
      data-test="sin-fracciones"
    >
      {{ t('calendar.weeks.noFractions') }}
    </p>

    <div
      v-else
      class="space-y-8"
    >
      <CalendarPicker
        v-model:property-id="fraccionId"
        v-model:anio="anio"
        :propiedades="opciones"
      />

      <InactiveCalendarNotice
        v-if="fraccion && !fraccion.calendarActive"
        :saldo="plan?.balance ?? null"
        :plan-id="plan?.id ?? null"
      />

      <p
        v-if="!seleccion.pendiente.value && !seleccion.abierta.value"
        class="text-sm text-muted"
        data-test="calendario-sin-publicar"
      >
        {{ t('calendar.selection.notOpen', { year: anio }) }}
      </p>

      <template v-else-if="seleccion.abierta.value && fraccion">
        <section
          v-if="!seleccion.turno.value.done && fraccion.calendarActive"
          class="space-y-4"
          data-test="seccion-eleccion"
        >
          <SectionHeading :titulo="t('calendar.selection.title')" />
          <WeekSelectionForm
            :rejilla="seleccion.rejilla.value"
            :classification="seleccion.clasificacion.value"
            :taken="takenList"
            :turn="seleccion.turno.value"
            :anio="anio"
            :enviando="eligiendo"
            @submit="elegirSemanas"
          />
        </section>

        <template v-if="semanas.projection.value">
          <section class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <SectionHeading :titulo="t('calendar.weeks.quota')" />
              <CalendarStatus :publicado-el="semanas.abiertoEl.value" />
            </div>
            <WeekQuota :quota="semanas.projection.value.quota" />
          </section>

          <PendingWeeksNotice
            v-if="!semanas.projection.value.readOnly"
            :pending="semanas.projection.value.pending"
            :next-deadline="proximaLimite"
          />

          <section class="space-y-4">
            <WeekLegend />
            <WeekCalendar
              :cells="semanas.projection.value.cells"
              :context="semanas.context.value"
              :read-only="semanas.projection.value.readOnly"
              :busy-week="busyWeek"
              @confirm="operar('confirm', $event, 'calendar.weeks.confirmed')"
              @cancel="operar('cancel', $event, 'calendar.weeks.cancelled')"
              @release="operar('release', $event, 'calendar.weeks.released')"
            />
          </section>

          <section
            v-if="reubicacion.ventana.value && reubicacion.turno.value && contextoDeReubicacion"
            class="space-y-4"
            data-test="seccion-reubicacion"
          >
            <SectionHeading :titulo="t('calendar.relocation.title')" />
            <p class="text-sm text-muted">
              {{ t('calendar.relocation.ownerSubtitle') }}
            </p>
            <RelocationTurnStatus
              :turn="reubicacion.turno.value"
              :anio="anio"
              :movable="semanasMovibles"
            />
            <WeekRelocationForm
              v-if="reubicacion.turno.value.canRelocate && fraccion.calendarActive && !semanas.projection.value.readOnly"
              :fraction="fraccion.number"
              :context="contextoDeReubicacion"
              :enviando="reubicando"
              @submit="reubicarSemana"
            />
          </section>

          <section
            v-if="seleccion.turno.value.done && fraccion.calendarActive"
            class="space-y-4"
            data-test="seccion-intercambios"
          >
            <SectionHeading :titulo="t('calendar.swaps.requestTitle')" />
            <SwapRequestForm
              :fraction="fraccion.number"
              :allocations="seleccion.asignaciones.value"
              :rejilla="seleccion.rejilla.value"
              :enviando="solicitando"
              @submit="solicitarIntercambio"
            />
            <SectionHeading :titulo="t('calendar.swaps.requestsTitle')" />
            <SwapRequestsList
              :requests="seleccion.solicitudes.value"
              :can-resolve="false"
              :ocupada-id="null"
            />
          </section>
        </template>
      </template>
    </div>
  </PanelPage>
</template>
