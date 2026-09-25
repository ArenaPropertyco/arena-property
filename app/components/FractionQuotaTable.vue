<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { TEMPORADAS } from '#shared/scheduling/temporadas'
import type { Temporada } from '#shared/scheduling/temporadas'
import type { SeasonQuota } from '#shared/scheduling/week-usage'
import { COLOR_BY_SEASON } from '~/utils/weeks'

/**
 * HU-13 · RF-13.2 · D-33 — el cupo por temporada de cada fracción de la propiedad,
 * lado a lado, tal como lo calcula la proyección: confirmadas, por confirmar y
 * liberadas frente al criterio. Sin titular no hay cupo que contar, y con el
 * calendario inactivo (D-31) se dice, porque esa fracción no podrá confirmar.
 */
const props = defineProps<{
  cupo: Map<number, Record<Temporada, SeasonQuota>>
  fracciones: { number: number, ownerName: string | null, calendarActive: boolean }[]
}>()

const { t } = useI18n()

interface Fila {
  number: number
  ownerName: string | null
  calendarActive: boolean
  cupo: Record<Temporada, SeasonQuota> | null
}

const filas = computed<Fila[]>(() => props.fracciones.map(fraccion => ({
  ...fraccion,
  cupo: props.cupo.get(fraccion.number) ?? null,
})))

const columnas = computed<TableColumn<Fila>[]>(() => [
  { id: 'fraccion', header: t('calendar.propertyBoard.fraction') },
  ...TEMPORADAS.map(temporada => ({ id: temporada, header: t(`calendar.seasons.${temporada}`) })),
])

function linea(cupo: SeasonQuota): string {
  return t('calendar.weeks.quotaLine', {
    confirmed: cupo.confirmed + cupo.used,
    elected: cupo.elected,
    released: cupo.released,
    required: cupo.required,
  })
}
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <UTable
      :data="filas"
      :columns="columnas"
      data-test="cupo-por-fraccion"
    >
      <template #fraccion-cell="{ row }">
        <div
          class="flex min-w-40 flex-col gap-1"
          :data-test="`cupo-fraccion-${row.original.number}`"
        >
          <span class="font-mono text-xs text-muted">{{ t('calendar.fractionLabel', { n: row.original.number }) }}</span>
          <span class="text-highlighted">{{ row.original.ownerName ?? t('calendar.propertyBoard.noOwner') }}</span>
          <UBadge
            v-if="row.original.ownerName && !row.original.calendarActive"
            color="neutral"
            variant="subtle"
            size="sm"
            :label="t('calendar.propertyBoard.inactive')"
          />
        </div>
      </template>

      <template
        v-for="temporada in TEMPORADAS"
        :key="temporada"
        #[`${temporada}-cell`]="{ row }"
      >
        <div class="flex flex-col gap-1">
          <UBadge
            :color="COLOR_BY_SEASON[temporada]"
            variant="subtle"
            size="sm"
            :label="t(`calendar.seasons.${temporada}`)"
            class="w-fit lg:hidden"
          />
          <span
            v-if="row.original.cupo"
            class="whitespace-nowrap font-mono text-xs text-highlighted"
          >{{ linea(row.original.cupo[temporada]) }}</span>
          <span
            v-else
            class="font-mono text-xs text-muted"
          >—</span>
        </div>
      </template>
    </UTable>
  </div>
</template>
