<script setup lang="ts">
import { TEMPORADAS } from '#shared/scheduling/temporadas'
import { WEEK_CELL_TYPES } from '#shared/scheduling/week-projection'
import type { WeekCellType } from '#shared/scheduling/week-projection'
import { CLASS_BY_CELL_TYPE, COLOR_BY_SEASON, ICON_BY_CELL_TYPE } from '~/utils/weeks'

/**
 * HU-13 · RF-13.2, RF-13.3 · RT-06 — qué significa cada tipo de semana y cada
 * temporada. En `gestion` (el tablero del Administrador) nada es «propio»: esa
 * entrada desaparece y la semana con dueño se llama por lo que es.
 */
const props = withDefaults(defineProps<{ gestion?: boolean }>(), { gestion: false })

const { t } = useI18n()

const tipos = computed(() => props.gestion ? WEEK_CELL_TYPES.filter(tipo => tipo !== 'own') : WEEK_CELL_TYPES)

function etiqueta(tipo: WeekCellType): string {
  return props.gestion && tipo === 'other' ? t('calendar.weeks.types.allocated') : t(`calendar.weeks.types.${tipo}`)
}
</script>

<template>
  <ul
    class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted"
    data-test="leyenda"
  >
    <li
      v-for="tipo in tipos"
      :key="tipo"
      class="inline-flex items-center gap-1.5"
      :data-test="`leyenda-${tipo}`"
    >
      <span
        class="inline-flex size-5 items-center justify-center rounded-md border"
        :class="CLASS_BY_CELL_TYPE[tipo]"
      >
        <UIcon
          :name="ICON_BY_CELL_TYPE[tipo]"
          class="size-3"
        />
      </span>
      {{ etiqueta(tipo) }}
    </li>
    <li
      v-for="temporada in TEMPORADAS"
      :key="temporada"
      class="inline-flex items-center gap-1.5"
      :data-test="`leyenda-temporada-${temporada}`"
    >
      <UBadge
        :color="COLOR_BY_SEASON[temporada]"
        variant="subtle"
        size="sm"
        :label="t(`calendar.seasons.${temporada}`)"
      />
    </li>
  </ul>
</template>
