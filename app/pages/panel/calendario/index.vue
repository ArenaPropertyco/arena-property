<script setup lang="ts">
import { hoy as hoyDe } from '#shared/dates/formato'
import { propiedadesGestionadas } from '#shared/properties/asignaciones'
import type { RelocationWindowConfig } from '#shared/scheduling/relocation'
import type { SwapProposal } from '#shared/scheduling/swaps'

/**
 * HU-12 · RF-12.2, RF-12.4…RF-12.7 · D-32 — configuración del calendario.
 * HU-15 · RF-15.1…RF-15.5 · D-33 — bloqueos del Administrador por semanas.
 * HU-59 · RF-59.1, RF-59.2, RF-59.6 · D-36 — la ventana de reubicación.
 *
 * La página orquesta: elige propiedad y año, deja al Administrador clasificar la
 * rejilla, fijar el orden de turnos y abrir la selección; abierta, muestra el
 * avance de cada fracción, permite intercambiar semanas y resolver solicitudes,
 * y deja al Superadmin configurar la ventana de reubicación (que el Administrador
 * ve y puede cerrar). Debajo, los bloqueos de la propiedad.
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

const propertyId = ref<string | null>(null)
watch(propiedades, (lista) => {
  // Si la lista cambia y la elegida ya no está, se vuelve a la primera: quedarse
  // en una propiedad que dejó de gestionarse pediría datos que la RLS no da.
  if (!lista.some(propiedad => propiedad.id === propertyId.value)) {
    propertyId.value = lista[0]?.id ?? null
  }
}, { immediate: true })

const anio = ref(new Date().getFullYear() + 1)

const { id: calendarId, rejilla, fechasEspeciales, clasificacion, errorDeRejilla, publicadoEl, pendiente, guardar } = useCalendario(propertyId, anio)
const { turnos, fracciones, asignaciones, lockedWeeks, solicitudes, ordenSugerido, abrir, intercambiar, resolver } = useSelectionOrder(calendarId, propertyId)
const { bloqueos, blockedWeeks, crear: crearBloqueo, levantar: levantarBloqueo } = useWeekBlocks(calendarId)
const { ventana, ordenSugerido: ordenDeVentanaSugerido, configurar: configurarVentana, cerrar: cerrarVentana } = useSelectionWindow(calendarId, propertyId)
const hoy = computed(() => hoyDe())

const ocupado = ref(false)
const abriendo = ref(false)
const intercambiando = ref(false)
const resolviendo = ref<string | null>(null)
const bloqueando = ref(false)
const levantando = ref<string | null>(null)
const configurandoVentana = ref(false)
const cerrandoVentana = ref(false)

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
      class="space-y-8"
    >
      <CalendarPicker
        v-model:property-id="propertyId"
        v-model:anio="anio"
        :propiedades="propiedades"
      />

      <section class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionHeading :titulo="t('calendar.grid', { year: anio })" />
            <p class="text-sm text-muted">
              {{ t('calendar.gridHint', { weeks: rejilla.length, special: fechasEspeciales.length }) }}
            </p>
          </div>
          <CalendarStatus :publicado-el="publicadoEl" />
        </div>

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
      </section>

      <section
        class="space-y-4"
        data-test="seccion-seleccion"
      >
        <SectionHeading :titulo="t('calendar.selection.title')" />
        <p class="text-sm text-muted">
          {{ t('calendar.selection.subtitle') }}
        </p>

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

        <template v-else>
          <SelectionProgress
            :turns="turnos"
            :free-weeks="semanasLibres"
          />

          <SectionHeading :titulo="t('calendar.selection.chosenTitle')" />
          <SelectedWeeksList
            :allocations="asignaciones"
            :rejilla="rejilla"
            :fractions="fracciones"
          />

          <SectionHeading :titulo="t('calendar.swaps.title')" />
          <p class="text-sm text-muted">
            {{ t('calendar.swaps.subtitle') }}
          </p>
          <WeekSwapForm
            :allocations="asignaciones"
            :locked-weeks="lockedWeeks"
            :rejilla="rejilla"
            :enviando="intercambiando"
            @submit="aplicarIntercambio"
          />

          <SectionHeading :titulo="t('calendar.swaps.requestsTitle')" />
          <SwapRequestsList
            :requests="solicitudes"
            can-resolve
            :ocupada-id="resolviendo"
            @resolver="resolverSolicitud"
          />
        </template>
      </section>

      <section
        v-if="publicadoEl"
        class="space-y-4"
        data-test="seccion-ventana"
      >
        <SectionHeading :titulo="t('calendar.relocation.title')" />
        <p class="text-sm text-muted">
          {{ t('calendar.relocation.subtitle') }}
        </p>
        <SelectionWindowForm
          v-if="esSuperadmin"
          :window="ventana"
          :fractions="fracciones"
          :suggested-order="ordenDeVentana"
          :anio="anio"
          :enviando="configurandoVentana"
          @sugerir="sugerirOrdenDeVentana"
          @submit="guardarVentana"
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
          :cerrando="cerrandoVentana"
          @cerrar="cerrarLaVentana"
        />
      </section>

      <section
        class="space-y-4"
        data-test="seccion-bloqueos"
      >
        <SectionHeading :titulo="t('calendar.blocks.title')" />
        <p class="text-sm text-muted">
          {{ t('calendar.blocks.subtitle') }}
        </p>
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
      </section>
    </div>
  </PanelPage>
</template>
