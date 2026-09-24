<script setup lang="ts">
import type { Bucket } from '#shared/metrics/series'
import { totalDeSerie } from '#shared/metrics/series'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'

/**
 * HU-32 · RF-32.2 · RT-12 · DT-01 — un gráfico de barras por periodo con
 * `nuxt-charts`, el módulo de Nuxt que envuelve Unovis y le pone encima la
 * interacción que antes faltaba: al pasar el cursor por una barra sale su
 * periodo y su cifra ya formateada, y las barras entran animadas.
 *
 * Recibe la serie ya agregada: ni suma, ni corta periodos, ni decide colores por
 * su cuenta. Debajo del gráfico va la misma serie en texto, para quien no ve el
 * dibujo y para que el total sea legible sin pasar el cursor por las barras.
 */
const props = defineProps<{
  titulo: string
  serie: Bucket[]
  /** `count` para ventas; `money` para importes en COP (TR-02). */
  formato: 'count' | 'money'
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

function cifra(valor: number): string {
  return props.formato === 'money' ? formatearImporte(pesos(valor), idioma.value) : String(valor)
}

/** Una sola categoría —el título de la tarjeta— pintada con el oro de la marca. */
const categorias = computed(() => ({
  value: { name: props.titulo, color: 'var(--color-arena-500)' },
}))

const etiquetaX = (tick: number) => props.serie[tick]?.label ?? ''
const etiquetaY = (tick: number) => cifra(tick)

const total = computed(() => cifra(totalDeSerie(props.serie)))

/**
 * Cambiar de periodo no cambia los valores de unos cubos: cambia cuántos cubos
 * hay. Unovis guarda estado imperativo (escalas, ejes y transiciones de D3) y
 * parchearlo en caliente con otro número de barras es lo que rompía la vista al
 * pasar de mensual a trimestral o anual. Con esta huella el gráfico se vuelve a
 * montar en vez de actualizarse, que para dos series cortas no cuesta nada.
 */
const huella = computed(() => props.serie.map(bucket => bucket.key).join('|'))
</script>

<template>
  <div
    class="grafico-metricas space-y-3 rounded-2xl border border-default bg-default p-5"
    data-test="grafico-serie"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="font-display text-xl text-highlighted">
        {{ titulo }}
      </h3>
      <p class="text-sm text-muted">
        {{ t('metrics.charts.total') }}
        <span
          class="font-mono text-highlighted"
          data-test="serie-total"
        >{{ total }}</span>
      </p>
    </div>

    <p
      v-if="serie.length === 0"
      class="text-sm text-muted"
      data-test="serie-vacia"
    >
      {{ t('metrics.charts.empty') }}
    </p>

    <BarChart
      v-else
      :key="huella"
      :data="serie"
      :height="240"
      :categories="categorias"
      :y-axis="['value']"
      :x-formatter="etiquetaX"
      :y-formatter="etiquetaY"
      :x-num-ticks="serie.length"
      :y-num-ticks="4"
      :radius="4"
      :bar-padding="0.25"
      :padding="{ top: 8, right: 8, bottom: 0, left: 0 }"
      hide-legend
    >
      <template #tooltip="{ values }">
        <div
          v-if="values"
          class="rounded-lg border border-default bg-default px-3 py-2 shadow-lg"
          data-test="tooltip-bucket"
        >
          <p class="text-xs text-muted">
            {{ values.label }}
          </p>
          <p class="font-mono text-sm text-highlighted">
            {{ cifra(values.value) }}
          </p>
        </div>
      </template>
    </BarChart>

    <ol
      v-if="serie.length > 0"
      class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-3 lg:grid-cols-4"
      data-test="serie-etiquetas"
    >
      <li
        v-for="bucket in serie"
        :key="bucket.key"
        class="flex justify-between gap-2"
        :data-test="`bucket-${bucket.key}`"
      >
        <span>{{ bucket.label }}</span>
        <span class="font-mono text-default">{{ cifra(bucket.value) }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
/*
 * DT-01 · RT-07 · Unovis lee sus colores de variables CSS heredadas, así que
 * basta declararlas en la tarjeta para que las herede todo lo que dibuja,
 * incluido el tooltip. Cada variable se declara también en su forma `dark`
 * porque Unovis conmuta a esa familia por su cuenta: como ambas apuntan al
 * mismo token de `@nuxt/ui`, el gráfico sigue al tema de la aplicación y no al
 * del sistema operativo.
 */
.grafico-metricas {
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-domain-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-muted);
  --vis-dark-axis-tick-color: var(--ui-border);
  --vis-dark-axis-grid-color: var(--ui-border);
  --vis-dark-axis-domain-color: var(--ui-border);
  --vis-dark-axis-tick-label-color: var(--ui-text-muted);
  --vis-axis-tick-label-font-size: 11px;
  --vis-font-family: var(--font-mono);

  /* El tooltip lo pinta el slot con los componentes de marca: Unovis solo lo coloca. */
  --vis-tooltip-padding: 0;
  --vis-tooltip-background-color: transparent;
  --vis-tooltip-border-color: transparent;
  --vis-tooltip-box-shadow: none;
  --vis-dark-tooltip-background-color: transparent;
  --vis-dark-tooltip-border-color: transparent;
}
</style>
