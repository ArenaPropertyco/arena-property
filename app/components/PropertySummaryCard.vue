<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import { formatearPorcentaje } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { PUNTOS_BASICOS_TOTALES } from '#shared/money/comision'
import type { ResumenDePropiedad } from '#shared/properties/tablero'

/**
 * HU-21 · RF-21.1, RF-21.2 · TR-02 RF-D.5 — una propiedad administrada en el
 * tablero: qué parte está vendida, qué reservas vienen y qué espera decisión.
 *
 * Recibe el resumen ya armado por `shared/properties/tablero`; aquí solo se
 * presenta. El porcentaje llega en puntos básicos y se formatea con la función de
 * TR-02 (CA-21.1): la vista no divide nada.
 */
const props = defineProps<{
  resumen: ResumenDePropiedad
}>()

const { t, locale } = useI18n()
const localePath = useLocalePath()

const idioma = computed(() => locale.value as Idioma)
const porcentaje = computed(() => formatearPorcentaje(props.resumen.soldShare, idioma.value))
</script>

<template>
  <article
    class="flex h-full flex-col gap-4 rounded-2xl border border-default bg-default p-5"
    :data-test="`resumen-${resumen.id}`"
  >
    <header class="space-y-2">
      <h3 class="font-serif text-xl text-highlighted">
        {{ resumen.name }}
      </h3>
      <div
        class="space-y-1"
        :data-test="`vendidas-${resumen.id}`"
      >
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-sm text-muted">{{ t('dashboard.sold', { sold: resumen.soldFractions, total: resumen.fractionCount }) }}</span>
          <span class="font-mono text-lg text-highlighted">{{ porcentaje }}</span>
        </div>
        <UProgress
          :model-value="resumen.soldShare"
          :max="PUNTOS_BASICOS_TOTALES"
          size="sm"
        />
      </div>
    </header>

    <section class="space-y-2">
      <p class="text-xs font-medium uppercase tracking-wide text-muted">
        {{ t('dashboard.upcoming') }}
      </p>
      <p
        v-if="resumen.upcoming.length === 0"
        class="text-sm text-muted"
        :data-test="`sin-proximas-${resumen.id}`"
      >
        {{ t('dashboard.noUpcoming') }}
      </p>
      <ul
        v-else
        class="space-y-1 text-sm"
      >
        <li
          v-for="reserva in resumen.upcoming"
          :key="`${reserva.fraction}-${reserva.week}`"
          class="flex items-center gap-2"
          :data-test="`proxima-${resumen.id}-${reserva.week}`"
        >
          <UIcon
            name="i-lucide-calendar-check"
            class="size-4 shrink-0 text-success"
          />
          <span>{{ t('dashboard.upcomingLine', { fraction: reserva.fraction, week: reserva.week + 1, from: formatearDia(reserva.startsOn, idioma) }) }}</span>
        </li>
      </ul>
    </section>

    <section class="space-y-2">
      <p class="text-xs font-medium uppercase tracking-wide text-muted">
        {{ t('dashboard.alerts') }}
      </p>
      <p
        v-if="resumen.alertCount === 0"
        class="text-sm text-muted"
        :data-test="`sin-alertas-${resumen.id}`"
      >
        {{ t('dashboard.noAlerts') }}
      </p>
      <div
        v-else
        class="flex flex-wrap gap-2"
      >
        <UBadge
          v-if="resumen.alerts.conflicts > 0"
          color="error"
          variant="subtle"
          icon="i-lucide-lock"
          :label="t('dashboard.conflicts', { n: resumen.alerts.conflicts })"
          :data-test="`alerta-conflictos-${resumen.id}`"
        />
        <UBadge
          v-if="resumen.alerts.swapRequests > 0"
          color="warning"
          variant="subtle"
          icon="i-lucide-arrow-left-right"
          :label="t('dashboard.swapRequests', { n: resumen.alerts.swapRequests })"
          :data-test="`alerta-solicitudes-${resumen.id}`"
        />
        <UBadge
          v-if="resumen.alerts.weeksToPlace > 0"
          color="warning"
          variant="subtle"
          icon="i-lucide-hand-coins"
          :label="t('dashboard.weeksToPlace', { n: resumen.alerts.weeksToPlace })"
          :data-test="`alerta-por-colocar-${resumen.id}`"
        />
      </div>
    </section>

    <footer class="mt-auto flex flex-wrap justify-end gap-2 border-t border-default pt-4">
      <UButton
        variant="ghost"
        size="xs"
        icon="i-lucide-calendar-days"
        :label="t('dashboard.openCalendar')"
        :to="localePath(`/panel/calendario?propiedad=${resumen.id}`)"
        :data-test="`abrir-calendario-${resumen.id}`"
      />
      <UButton
        variant="ghost"
        size="xs"
        icon="i-lucide-key-round"
        :label="t('dashboard.openRentals')"
        :to="localePath(`/panel/rentas/${resumen.id}`)"
        :data-test="`abrir-rentas-${resumen.id}`"
      />
    </footer>
  </article>
</template>
