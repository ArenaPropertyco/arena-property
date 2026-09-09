<script setup lang="ts">
import { TEMPORADAS } from '#shared/scheduling/temporadas'
import { WEEK_CELL_TYPES } from '#shared/scheduling/week-projection'
import { CLASS_BY_CELL_TYPE, COLOR_BY_SEASON, ICON_BY_CELL_TYPE } from '~/utils/weeks'

/** HU-13 · RF-13.2, RF-13.3 · RT-06 — qué significa cada tipo de semana y cada temporada. */
const { t } = useI18n()
</script>

<template>
  <ul
    class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted"
    data-test="leyenda"
  >
    <li
      v-for="tipo in WEEK_CELL_TYPES"
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
      {{ t(`calendar.weeks.types.${tipo}`) }}
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
