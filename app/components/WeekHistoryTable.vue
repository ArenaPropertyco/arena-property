<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia } from '#shared/dates/formato'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'
import { estadoHistorico } from '#shared/scheduling/historial'
import type { EstadoDeSemanaHistorica, SemanaHistorica } from '#shared/scheduling/historial'
import type { Dia } from '#shared/scheduling/rejilla'
import { COLOR_BY_SEASON } from '~/utils/weeks'

/**
 * HU-20 · RF-20.1, RF-20.4 · D-42, D-43 — el listado de semanas del Propietario,
 * ya filtrado y ordenado por `shared/scheduling/historial`. Cada semana lleva su
 * estado real; la liberada y rentada muestra el ingreso de la fracción, y la que
 * sigue en bolsa no muestra importe porque no existe.
 */
const props = defineProps<{
  semanas: SemanaHistorica[]
  today: Dia
}>()

const { t, locale } = useI18n()

const COLOR_DE_ESTADO: Record<EstadoDeSemanaHistorica, 'neutral' | 'success' | 'warning' | 'error' | 'info'> = {
  elected: 'warning',
  confirmed: 'success',
  used: 'neutral',
  cancelled: 'error',
  released: 'warning',
  expired: 'error',
  rented: 'info',
}

const idioma = computed(() => locale.value as Idioma)

function estado(semana: SemanaHistorica): EstadoDeSemanaHistorica {
  return estadoHistorico(semana, props.today)
}

function importe(valor: CopAmount): string {
  return formatearImporte(valor, idioma.value)
}

const columnas = computed<TableColumn<SemanaHistorica>[]>(() => [
  { id: 'semana', header: t('history.columns.week') },
  { id: 'temporada', header: t('history.columns.season') },
  { id: 'estado', header: t('history.columns.state') },
  { id: 'ingreso', header: t('history.columns.income') },
])
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="semanas.length === 0"
      class="text-sm text-muted"
      data-test="sin-semanas"
    >
      {{ t('history.empty') }}
    </p>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="semanas"
        :columns="columnas"
        data-test="tabla-historial"
      >
        <template #semana-cell="{ row }">
          <div
            class="flex flex-col"
            :data-test="`semana-${row.original.propertyId}-${row.original.week}`"
          >
            <span class="text-highlighted">
              {{ t('history.weekLine', {
                week: row.original.week + 1,
                from: formatearDia(row.original.startsOn, idioma),
                to: formatearDia(row.original.endsOn, idioma),
              }) }}
            </span>
            <span class="text-xs text-muted">
              {{ t('history.fractionLine', { property: row.original.propertyName, fraction: row.original.fraction }) }}
            </span>
          </div>
        </template>

        <template #temporada-cell="{ row }">
          <UBadge
            :color="COLOR_BY_SEASON[row.original.season]"
            variant="subtle"
            size="sm"
            :label="t(`calendar.seasons.${row.original.season}`)"
          />
        </template>

        <template #estado-cell="{ row }">
          <UBadge
            :color="COLOR_DE_ESTADO[estado(row.original)]"
            variant="subtle"
            size="sm"
            :label="t(`history.states.${estado(row.original)}`)"
            :data-test="`estado-${row.original.propertyId}-${row.original.week}`"
          />
        </template>

        <template #ingreso-cell="{ row }">
          <span
            v-if="row.original.rented && row.original.income !== null"
            class="font-mono text-success"
            :data-test="`ingreso-${row.original.propertyId}-${row.original.week}`"
          >{{ importe(row.original.income) }}</span>
          <span
            v-else
            class="text-muted"
          >{{ t('history.noIncome') }}</span>
        </template>
      </UTable>
    </div>
  </div>
</template>
