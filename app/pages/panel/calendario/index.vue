<script setup lang="ts">
import { hoy as hoyDe } from '#shared/dates/formato'
import { windowPhase } from '#shared/scheduling/relocation'
import { propiedadesGestionadas } from '#shared/properties/asignaciones'
import type { ReassignmentProposal } from '#shared/scheduling/reassignment'
import type { RelocationWindowConfig } from '#shared/scheduling/relocation'
import type { SwapProposal } from '#shared/scheduling/swaps'

/**
 * HU-12 · RF-12.2, RF-12.4…RF-12.7 · D-32 — configuración del calendario.
 * HU-15 · RF-15.1…RF-15.5 · D-33 — bloqueos del Administrador por semanas.
 * HU-17 · RF-17.1, RF-17.3 · D-42 — la reasignación de una semana a otra libre.
 * HU-59 · RF-59.1, RF-59.2, RF-59.6, RF-59.9, RF-59.10 · D-36, D-47, D-48 — la ventana
 * de reubicación, su ajuste, su reapertura, su eliminación y las ventanas individuales.
 *
 * La página orquesta: elige propiedad y año, deja al Administrador clasificar la
 * rejilla, fijar el orden de turnos y abrir la selección; abierta, muestra el
 * avance de cada fracción, permite intercambiar semanas, reasignarlas y resolver
 * solicitudes, y deja al Superadmin configurar, reabrir y abrir ventanas
 * individuales de la reubicación (el Administrador la ve y puede cerrarla).
 * Debajo, los bloqueos de la propiedad.
 *
 * HU-13 · RF-13.3 · HU-14 · RF-14.1, RF-14.6, RF-14.7 — y el tablero de la
 * propiedad: qué fracción tiene cada semana y en qué estado está, con la opción de
 * confirmar, cancelar o liberar en nombre del titular.
 *
 * Cada bloque va en su tarjeta plegable (RT-06): en móvil se abre solo lo que se
 * necesita y en escritorio la página se lee de un vistazo.
 *
 * Llega con `?propiedad=` desde el tablero (HU-21): se abre en esa propiedad si
 * quien mira la gestiona; si no, en la primera de las suyas.
 */
definePageMeta({ layout: 'dashboard', acceso: { capacidad: 'gestionar_calendario' } })

const { t } = useI18n()
const toast = useToast()
const { propiedades: todas } = usePropiedades()
const { roles, idDeCuenta } = useCuenta()
const esSuperadmin = computed(() => roles.value.includes('superadmin'))
const ahora = useAhora()

/**
 * CA-05.2 · RF-05.3 · qué calendarios ofrece el selector.
 *
 * No basta con lo que la consulta devuelve: `property_overview` trae también las
 * propiedades publicadas, que lee cualquiera. Sin este filtro un Administrador
 * vería calendarios ajenos y la base le rechazaría el guardado. El Superadmin
 * los ve todos, incluidos los de propiedades sin administrador asignado.
 */
const propiedades = computed(() => propiedadesGestionadas(todas.value, {
  id: idDeCuenta.value,
  esSuperadmin: esSuperadmin.value,
})
  .filter(propiedad => propiedad.fractionCount === 8)
  .map(propiedad => ({ id: propiedad.id, label: propiedad.name })))

const route = useRoute()
const pedida = typeof route.query.propiedad === 'string' ? route.query.propiedad : null
const propertyId = ref<string | null>(null)
watch(propiedades, (lista) => {
  // Si la lista cambia y la elegida ya no está, se vuelve a la pedida o a la
  // primera: quedarse en una propiedad que dejó de gestionarse pediría datos que
  // la RLS no da.
  if (!lista.some(propiedad => propiedad.id === propertyId.value)) {
    propertyId.value = lista.find(propiedad => propiedad.id === pedida)?.id ?? lista[0]?.id ?? null
  }
}, { immediate: true })

const anio = ref(new Date().getFullYear() + 1)

const { id: calendarId, rejilla, nochesEnBolsa, clasificacion, errorDeRejilla, publicadoEl, pendiente, guardar } = useCalendario(propertyId, anio)
const { turnos, fracciones, asignaciones, lockedWeeks, releasedWeeks, rentedWeeks, solicitudes, ordenSugerido, abrir, intercambiar, reasignar, resolver, recargar: recargarSeleccion } = useSelectionOrder(calendarId, propertyId)
const { bloqueos, blockedWeeks, crear: crearBloqueo, levantar: levantarBloqueo } = useWeekBlocks(calendarId)
const tablero = useSemanasDePropiedad(propertyId, calendarId, anio, clasificacion)
const {
  ventana, individuales, ordenSugerido: ordenDeVentanaSugerido, configurar: configurarVentana, reabrir: reabrirVentana,
  eliminar: eliminarVentana, cerrar: cerrarVentana, abrirIndividual, cerrarIndividual,
} = useSelectionWindow(calendarId, propertyId)
const hoy = computed(() => hoyDe())

const ocupado = ref(false)
const abriendo = ref(false)
const intercambiando = ref(false)
const reasignando = ref(false)
const resolviendo = ref<string | null>(null)
const bloqueando = ref(false)
const levantando = ref<string | null>(null)
const configurandoVentana = ref(false)
const cerrandoVentana = ref(false)
const abriendoIndividual = ref(false)
const eliminandoVentana = ref(false)
const confirmandoEliminar = ref(false)

// RF-59.10 · D-48 · lo que el aviso de borrado necesita saber de la ventana.
const faseDeLaVentana = computed(() => ventana.value ? windowPhase(ventana.value, ahora.value) : null)

/** El orden que se va a abrir: parte de la sugerencia de la base y el Administrador lo ajusta. */
const orden = ref<number[]>([])
async function sugerirOrden() {
  orden.value = await ordenSugerido()
}
watch(calendarId, (id) => {
  if (id && !publicadoEl.value) {
    sugerirOrden()
  }
  else {
    orden.value = []
  }
}, { immediate: true })

const semanasLibres = computed(() => rejilla.value.length - asignaciones.value.length)
const solicitudesPendientes = computed(() => solicitudes.value.filter(solicitud => solicitud.status === 'pending').length)

/** HU-14 · confirmar, cancelar o liberar en nombre del titular; la base repite las reglas. */
const semanaOcupada = ref<number | null>(null)
// RF-14.7b · D-39 · liberar tiene consecuencia económica: se explica y luego se confirma.
const liberando = ref<number | null>(null)

async function operarSemana(accion: 'confirm' | 'cancel' | 'release', week: number, exito: string) {
  semanaOcupada.value = week
  const resultado = await tablero[accion](week)
  semanaOcupada.value = null
  if (!resultado.ok) {
    toast.add({ title: t(resultado.clave), color: 'error' })
    return
  }
  // Las semanas confirmadas o liberadas dejan de intercambiarse y reasignarse (D-33).
  await recargarSeleccion()
  toast.add({ title: t(exito), color: 'success' })
}

async function confirmarLiberacion(week: number) {
  await operarSemana('release', week, 'calendar.weeks.released')
  liberando.value = null
}

/** RF-59.2 · el orden que la ventana propone; el Superadmin lo ajusta antes de guardar. */
const ordenDeVentana = ref<number[]>([])
async function sugerirOrdenDeVentana() {
  ordenDeVentana.value = await ordenDeVentanaSugerido()
}
watch([calendarId, publicadoEl, esSuperadmin], ([id, abierto, superadmin]) => {
  if (id && abierto && superadmin) {
    sugerirOrdenDeVentana()
  }
  else {
    ordenDeVentana.value = []
  }
}, { immediate: true })

async function guardarClasificacion() {
  ocupado.value = true
  const resultado = await guardar()
  ocupado.value = false
  toast.add(resultado.ok ? { title: t('calendar.saved'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
  if (resultado.ok && !publicadoEl.value) {
    await sugerirOrden()
  }
}

async function abrirSeleccion() {
  abriendo.value = true
  const guardado = await guardar()
  const resultado = guardado.ok ? await abrir(orden.value) : guardado
  abriendo.value = false
  toast.add(resultado.ok ? { title: t('calendar.selection.opened'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}

async function aplicarIntercambio(propuesta: SwapProposal, motivo: string) {
  intercambiando.value = true
  const resultado = await intercambiar(propuesta, motivo)
  intercambiando.value = false
  toast.add(resultado.ok ? { title: t('calendar.swaps.done'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}

async function aplicarReasignacion(propuesta: ReassignmentProposal) {
  reasignando.value = true
  const resultado = await reasignar(propuesta)
  reasignando.value = false
  toast.add(resultado.ok ? { title: t('calendar.reassignment.done'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}

async function resolverSolicitud(id: string, aprobar: boolean, motivo: string | null) {
  resolviendo.value = id
  const resultado = await resolver(id, aprobar, motivo)
  resolviendo.value = null
  toast.add(resultado.ok ? { title: t('calendar.swaps.resolved'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}

async function bloquear(semanas: number[], motivo: string) {
  bloqueando.value = true
  const resultado = await crearBloqueo(semanas, motivo)
  bloqueando.value = false
  if (!resultado.ok) {
    toast.add({ title: t(resultado.clave), color: 'error' })
    return
  }
  toast.add({
    title: resultado.conflictos > 0
      ? t('calendar.blocks.createdWithConflicts', { count: resultado.conflictos })
      : t('calendar.blocks.created'),
    color: resultado.conflictos > 0 ? 'warning' : 'success',
  })
}

async function guardarVentana(config: RelocationWindowConfig) {
  configurandoVentana.value = true
  const resultado = await configurarVentana(config)
  configurandoVentana.value = false
  toast.add(resultado.ok ? { title: t('calendar.relocation.configured'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}

async function cerrarLaVentana() {
  cerrandoVentana.value = true
  const resultado = await cerrarVentana()
  cerrandoVentana.value = false
  toast.add(resultado.ok ? { title: t('calendar.relocation.closed'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}

async function reabrirLaVentana() {
  cerrandoVentana.value = true
  const resultado = await reabrirVentana()
  cerrandoVentana.value = false
  toast.add(resultado.ok ? { title: t('calendar.relocation.reopened'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}

async function borrarLaVentana() {
  eliminandoVentana.value = true
  const resultado = await eliminarVentana()
  eliminandoVentana.value = false
  if (resultado.ok) {
    confirmandoEliminar.value = false
  }
  toast.add(resultado.ok ? { title: t('calendar.relocation.deleted'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}

async function abrirVentanaIndividual(fraction: number, hours: number) {
  abriendoIndividual.value = true
  const resultado = await abrirIndividual(fraction, hours)
  abriendoIndividual.value = false
  toast.add(resultado.ok ? { title: t('calendar.relocation.individual.opened'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}

async function cerrarVentanaIndividual(id: string) {
  const resultado = await cerrarIndividual(id)
  toast.add(resultado.ok ? { title: t('calendar.relocation.individual.closed'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}

async function levantar(id: string, motivo: string) {
  levantando.value = id
  const resultado = await levantarBloqueo(id, motivo)
  levantando.value = null
  toast.add(resultado.ok ? { title: t('calendar.blocks.lifted'), color: 'success' } : { title: t(resultado.clave), color: 'error' })
}
</script>

<template>
  <PanelPage
    :titulo="t('calendar.title')"
    :subtitulo="t('calendar.subtitle')"
  >
    <p
      v-if="propiedades.length === 0"
      class="text-sm text-muted"
      data-test="sin-propiedades"
    >
      {{ t('calendar.noProperties') }}
    </p>

    <div
      v-else
      class="space-y-4 sm:space-y-6"
    >
      <CalendarPicker
        v-model:property-id="propertyId"
        v-model:anio="anio"
        :propiedades="propiedades"
      />

      <PanelCollapsible
        nombre="rejilla"
        :titulo="t('calendar.grid', { year: anio })"
        :descripcion="t('calendar.gridHint', { weeks: rejilla.length, pool: nochesEnBolsa.length })"
        icono="i-lucide-grid-3x3"
      >
        <template #extra>
          <CalendarStatus :publicado-el="publicadoEl" />
        </template>

        <SeasonClassifier
          v-model:clasificacion="clasificacion"
          :rejilla="rejilla"
          :anio="anio"
          :editable="!pendiente && !publicadoEl"
        />

        <p
          v-if="errorDeRejilla"
          class="text-sm text-error"
          data-test="rejilla-imposible"
        >
          {{ errorDeRejilla }}
        </p>

        <div
          v-if="!publicadoEl"
          class="flex flex-wrap justify-end gap-2"
        >
          <UButton
            variant="outline"
            :loading="ocupado"
            :label="t('calendar.save')"
            data-test="guardar-calendario"
            @click="guardarClasificacion"
          />
        </div>
      </PanelCollapsible>

      <PanelCollapsible
        nombre="seleccion"
        :titulo="t('calendar.selection.title')"
        :descripcion="t('calendar.selection.subtitle')"
        icono="i-lucide-list-ordered"
      >
        <template v-if="!publicadoEl">
          <SelectionOrderEditor
            v-model:order="orden"
            :fractions="fracciones"
            :editable="!abriendo"
            @sugerir="sugerirOrden"
          />
          <div class="flex justify-end">
            <UButton
              icon="i-lucide-play"
              :disabled="orden.length === 0 || errorDeRejilla !== null"
              :loading="abriendo"
              :label="t('calendar.selection.open')"
              data-test="abrir-seleccion"
              @click="abrirSeleccion"
            />
          </div>
        </template>

        <SelectionProgress
          v-else
          :turns="turnos"
          :free-weeks="semanasLibres"
        />
      </PanelCollapsible>

      <template v-if="publicadoEl">
        <PanelCollapsible
          nombre="elegidas"
          :titulo="t('calendar.selection.chosenTitle')"
          icono="i-lucide-calendar-check"
        >
          <SelectedWeeksList
            :allocations="asignaciones"
            :rejilla="rejilla"
            :fractions="fracciones"
          />
        </PanelCollapsible>

        <PanelCollapsible
          nombre="cupo"
          :titulo="t('calendar.propertyBoard.title')"
          :descripcion="t('calendar.propertyBoard.subtitle')"
          icono="i-lucide-calendar-range"
        >
          <SectionHeading :titulo="t('calendar.propertyBoard.quotaTitle')" />
          <FractionQuotaTable
            :cupo="tablero.cupoPorFraccion.value"
            :fracciones="tablero.fracciones.value"
          />

          <SectionHeading :titulo="t('calendar.propertyBoard.boardTitle')" />
          <WeekLegend gestion />
          <WeekCalendar
            :cells="tablero.cells.value"
            :context="tablero.context.value"
            :busy-week="semanaOcupada"
            gestion
            @confirm="operarSemana('confirm', $event, 'calendar.weeks.confirmed')"
            @cancel="operarSemana('cancel', $event, 'calendar.weeks.cancelled')"
            @release="liberando = $event"
          />
        </PanelCollapsible>

        <PanelCollapsible
          nombre="intercambios"
          :titulo="t('calendar.swaps.title')"
          :descripcion="t('calendar.swaps.subtitle')"
          icono="i-lucide-arrow-left-right"
        >
          <WeekSwapForm
            :allocations="asignaciones"
            :locked-weeks="lockedWeeks"
            :rejilla="rejilla"
            :enviando="intercambiando"
            @submit="aplicarIntercambio"
          />
        </PanelCollapsible>

        <PanelCollapsible
          nombre="solicitudes"
          :titulo="t('calendar.swaps.requestsTitle')"
          icono="i-lucide-inbox"
          :aviso="solicitudesPendientes > 0 ? t('calendar.propertyBoard.pendingRequests', { count: solicitudesPendientes }) : null"
        >
          <SwapRequestsList
            :requests="solicitudes"
            can-resolve
            :locked-weeks="new Set(lockedWeeks)"
            :ocupada-id="resolviendo"
            @resolver="resolverSolicitud"
          />
        </PanelCollapsible>

        <PanelCollapsible
          nombre="reasignacion"
          :titulo="t('calendar.reassignment.title')"
          :descripcion="t('calendar.reassignment.subtitle')"
          icono="i-lucide-move-right"
        >
          <WeekReassignmentForm
            :allocations="asignaciones"
            :released-weeks="releasedWeeks"
            :blocked-weeks="blockedWeeks"
            :rented-weeks="rentedWeeks"
            :rejilla="rejilla"
            :classification="clasificacion"
            :today="hoy"
            :enviando="reasignando"
            @submit="aplicarReasignacion"
          />
        </PanelCollapsible>

        <PanelCollapsible
          nombre="ventana"
          :titulo="t('calendar.relocation.title')"
          :descripcion="t('calendar.relocation.subtitle')"
          icono="i-lucide-timer"
        >
          <SelectionWindowForm
            v-if="esSuperadmin"
            :window="ventana"
            :fractions="fracciones"
            :suggested-order="ordenDeVentana"
            :anio="anio"
            :enviando="configurandoVentana"
            @sugerir="sugerirOrdenDeVentana"
            @submit="guardarVentana"
            @eliminar="confirmandoEliminar = true"
          />
          <p
            v-else-if="!ventana"
            class="text-sm text-muted"
            data-test="ventana-sin-configurar"
          >
            {{ t('calendar.relocation.notConfigured', { year: anio }) }}
          </p>
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ t('calendar.relocation.onlySuperadmin') }}
          </p>
          <SelectionWindowTurns
            v-if="ventana"
            :window="ventana"
            :now="ahora"
            can-close
            :can-reopen="esSuperadmin"
            :cerrando="cerrandoVentana"
            @cerrar="cerrarLaVentana"
            @reabrir="reabrirLaVentana"
          />
          <FractionWindowPanel
            v-if="esSuperadmin"
            :fractions="fracciones"
            :windows="individuales"
            :now="ahora"
            :enviando="abriendoIndividual"
            @abrir="abrirVentanaIndividual"
            @cerrar="cerrarVentanaIndividual"
          />
        </PanelCollapsible>
      </template>

      <UModal
        v-model:open="confirmandoEliminar"
        :title="t('calendar.relocation.delete')"
      >
        <template #body>
          <SelectionWindowDeleteNotice
            v-if="ventana && faseDeLaVentana"
            :anio="anio"
            :phase="faseDeLaVentana"
            :turnos="ventana.turns.length"
            :enviando="eliminandoVentana"
            @confirmar="borrarLaVentana"
          />
        </template>
      </UModal>

      <UModal
        :open="liberando !== null"
        :title="t('calendar.weeks.releaseTitle')"
        @update:open="liberando = null"
      >
        <template #body>
          <ReleaseWeekNotice
            v-if="liberando !== null"
            :week="liberando"
            :enviando="semanaOcupada === liberando"
            @confirmar="confirmarLiberacion"
          />
        </template>
      </UModal>

      <PanelCollapsible
        nombre="bloqueos"
        :titulo="t('calendar.blocks.title')"
        :descripcion="t('calendar.blocks.subtitle')"
        icono="i-lucide-lock"
      >
        <template v-if="publicadoEl">
          <WeekBlockForm
            :rejilla="rejilla"
            :classification="clasificacion"
            :blocked="blockedWeeks"
            :today="hoy"
            :enviando="bloqueando"
            @submit="bloquear"
          />
          <WeekBlocksList
            :bloqueos="bloqueos"
            :ocupado-id="levantando"
            @levantar="levantar"
          />
        </template>
        <p
          v-else
          class="text-sm text-muted"
          data-test="bloqueos-sin-calendario"
        >
          {{ t('calendar.blocks.empty') }}
        </p>
      </PanelCollapsible>
    </div>
  </PanelPage>
</template>
