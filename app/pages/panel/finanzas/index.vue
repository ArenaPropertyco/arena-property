<script setup lang="ts">
import { formatearMes, hoy as hoyDe } from '#shared/dates/formato'
import { detalleDeCuota } from '#shared/finance/detalle'
import { cuotaConMovimientoDe, desglosePorCategoria, historicoMensual, mesDe, mesesDelAnio } from '#shared/finance/estado-de-cuenta'
import type { Mes } from '#shared/finance/estado-de-cuenta'
import type { Idioma } from '#shared/money/formato'

/**
 * HU-19 · RF-19.1…RF-19.4 · HU-24 · RF-24.4 · D-09 — el estado de cuenta del
 * Propietario.
 *
 * La página orquesta: elige propiedad y año, muestra el histórico mensual con
 * ceros donde no hubo nada, y del mes elegido el desglose por categoría con cada
 * naturaleza rotulada. Cada línea abre el detalle de su cuota (HU-24), armado por
 * la función pura sobre lo que la base persistió. La RLS ya acotó las cuotas a las
 * fracciones propias (RF-19.4); aquí no se decide quién ve qué.
 *
 * Llega con `?propiedad=` desde la tarjeta del portafolio (HU-18).
 */
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })

const { t, locale } = useI18n()
const route = useRoute()
const { fracciones, pendiente: cargandoFracciones } = useFraccionesPropias()
const { lineas, pendiente: cargandoLineas } = useEstadoDeCuenta()

const idioma = computed(() => locale.value as Idioma)

const propiedades = computed(() => {
  const vistas = new Map<string, string>()
  for (const fraccion of fracciones.value) {
    vistas.set(fraccion.propertyId, fraccion.propertyName)
  }
  return [...vistas.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
})

const pedida = typeof route.query.propiedad === 'string' ? route.query.propiedad : null
const propertyId = ref<string | null>(null)
watch(propiedades, (lista) => {
  if (!lista.some(propiedad => propiedad.id === propertyId.value)) {
    propertyId.value = lista.find(propiedad => propiedad.id === pedida)?.id ?? lista[0]?.id ?? null
  }
}, { immediate: true })

const hoy = hoyDe()
const anio = ref(Number(hoy.slice(0, 4)))
const mesSeleccionado = ref<Mes>(mesDe(hoy))
watch(anio, (nuevo) => {
  if (!mesSeleccionado.value.startsWith(String(nuevo))) {
    mesSeleccionado.value = `${nuevo}-01`
  }
})

const lineasDeLaPropiedad = computed(() => lineas.value.filter(linea => linea.propertyId === propertyId.value))
const meses = computed(() => historicoMensual(lineasDeLaPropiedad.value, ...mesesDelAnio(anio.value)))
const grupos = computed(() => desglosePorCategoria(lineasDeLaPropiedad.value.filter(linea => mesDe(linea.incurredOn) === mesSeleccionado.value)))

/** HU-24 · RF-24.4 · el detalle lo arma la función pura sobre la línea persistida. */
const detallando = ref<string | null>(null)
const detalle = computed(() => {
  const linea = lineas.value.find(candidata => candidata.shareId === detallando.value)
  return linea ? detalleDeCuota(cuotaConMovimientoDe(linea)) : null
})

const pendiente = computed(() => cargandoFracciones.value || cargandoLineas.value)
</script>

<template>
  <PanelPage
    :titulo="t('statement.title')"
    :subtitulo="t('statement.subtitle')"
  >
    <p
      v-if="!pendiente && propiedades.length === 0"
      class="text-sm text-muted"
      data-test="sin-estado-de-cuenta"
    >
      {{ t('statement.empty') }}
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
        <SectionHeading :titulo="t('statement.historyTitle', { year: anio })" />
        <p class="text-sm text-muted">
          {{ t('statement.historyHint') }}
        </p>
        <MonthlyHistoryTable
          :meses="meses"
          :seleccionado="mesSeleccionado"
          @seleccionar="mesSeleccionado = $event"
        />
      </section>

      <section class="space-y-4">
        <SectionHeading :titulo="t('statement.breakdownTitle', { month: formatearMes(mesSeleccionado, idioma) })" />
        <p class="text-sm text-muted">
          {{ t('statement.breakdownHint') }}
        </p>
        <OwnerStatementBreakdown
          :grupos="grupos"
          @detalle="detallando = $event"
        />
      </section>
    </div>

    <UModal
      :open="detalle !== null"
      :title="t('finance.detail.title')"
      @update:open="detallando = null"
    >
      <template #body>
        <MovementShareDetail
          v-if="detalle"
          :detalle="detalle"
        />
      </template>
    </UModal>
  </PanelPage>
</template>
