<script setup lang="ts">
import type { Kpis } from '#shared/metrics/kpis'
import { formatearImporte, formatearPorcentaje } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { colorDeCondicion, presentarImporte } from '#shared/money/presentacion'

/**
 * HU-32 · RF-32.1, RF-32.4 · TR-02 — los KPI globales, ya calculados.
 *
 * Cada tarjeta pinta un valor que llegó hecho: conteos, el porcentaje de
 * fracciones vendidas en el formato de RF-D.5 y las comisiones con su condición
 * (RF-D.6), que aquí se traduce a color y nunca se decide.
 */
const props = defineProps<{ kpis: Kpis }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)
const generadas = computed(() => presentarImporte(props.kpis.commissions.generated, idioma.value))

const conteos = computed(() => [
  { marca: 'kpi-propiedades', titulo: 'metrics.kpis.properties', valor: String(props.kpis.properties), icono: 'i-lucide-building-2' },
  { marca: 'kpi-fracciones', titulo: 'metrics.kpis.fractionsSold', valor: `${props.kpis.fractionsSold} / ${props.kpis.fractionsTotal}`, icono: 'i-lucide-pie-chart', nota: formatearPorcentaje(props.kpis.soldShare, idioma.value) },
  { marca: 'kpi-administradores', titulo: 'metrics.kpis.activeAdmins', valor: String(props.kpis.activeAdmins), icono: 'i-lucide-users' },
  { marca: 'kpi-propietarios', titulo: 'metrics.kpis.owners', valor: String(props.kpis.owners), icono: 'i-lucide-key-round' },
  { marca: 'kpi-embajadores', titulo: 'metrics.kpis.activeAmbassadors', valor: String(props.kpis.activeAmbassadors), icono: 'i-lucide-megaphone' },
])

function importe(monto: Kpis['commissions']['pending']): string {
  return formatearImporte(monto, idioma.value)
}
</script>

<template>
  <div
    class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    data-test="tarjetas-kpi"
  >
    <div
      v-for="tarjeta in conteos"
      :key="tarjeta.marca"
      class="rounded-2xl border border-default bg-default p-5"
      :data-test="tarjeta.marca"
    >
      <div class="flex items-center gap-2 text-sm text-muted">
        <UIcon
          :name="tarjeta.icono"
          class="size-4"
        />
        {{ t(tarjeta.titulo) }}
      </div>
      <p class="mt-2 font-mono text-3xl text-highlighted">
        {{ tarjeta.valor }}
      </p>
      <p
        v-if="tarjeta.nota"
        class="mt-1 font-mono text-sm text-muted"
        data-test="kpi-porcentaje"
      >
        {{ t('metrics.kpis.soldShare', { share: tarjeta.nota }) }}
      </p>
    </div>

    <div
      class="rounded-2xl border border-default bg-default p-5"
      data-test="kpi-comisiones"
    >
      <div class="flex items-center gap-2 text-sm text-muted">
        <UIcon
          name="i-lucide-percent"
          class="size-4"
        />
        {{ t('metrics.kpis.commissionsGenerated') }}
      </div>
      <p
        class="mt-2 font-mono text-3xl"
        :class="`text-${colorDeCondicion(generadas.condicion)}`"
        :data-condicion="generadas.condicion"
      >
        {{ generadas.texto }}
      </p>
      <!-- RT-06 · la tarjeta mide ~280 px en cualquier ancho: los importes van en filas. -->
      <dl class="mt-3 space-y-1 text-xs">
        <div class="flex items-baseline justify-between gap-3">
          <dt class="text-muted">
            {{ t('metrics.kpis.pending') }}
          </dt>
          <dd class="text-end font-mono text-default">
            {{ importe(kpis.commissions.pending) }}
          </dd>
        </div>
        <div class="flex items-baseline justify-between gap-3">
          <dt class="text-muted">
            {{ t('metrics.kpis.released') }}
          </dt>
          <dd class="text-end font-mono text-default">
            {{ importe(kpis.commissions.released) }}
          </dd>
        </div>
        <div class="flex items-baseline justify-between gap-3">
          <dt class="text-muted">
            {{ t('metrics.kpis.paid') }}
          </dt>
          <dd class="text-end font-mono text-default">
            {{ importe(kpis.commissions.paid) }}
          </dd>
        </div>
      </dl>
    </div>
  </div>
</template>
