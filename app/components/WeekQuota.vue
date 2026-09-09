<script setup lang="ts">
import { TEMPORADAS } from '#shared/scheduling/temporadas'
import type { Temporada } from '#shared/scheduling/temporadas'
import type { SeasonQuota } from '#shared/scheduling/week-usage'
import { COLOR_BY_SEASON } from '~/utils/weeks'

/**
 * HU-13 · RF-13.2 · CA-13.1 · D-33 — el cupo de semanas por temporada tal como lo
 * calcula la proyección: confirmadas, por confirmar y liberadas frente al criterio.
 */
defineProps<{ quota: Record<Temporada, SeasonQuota> }>()

const { t } = useI18n()
</script>

<template>
  <dl
    class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    data-test="cupo-semanas"
  >
    <div
      v-for="temporada in TEMPORADAS"
      :key="temporada"
      class="rounded-2xl border border-default bg-default p-3"
      :data-test="`cupo-${temporada}`"
    >
      <dt class="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
        <UBadge
          :color="COLOR_BY_SEASON[temporada]"
          variant="subtle"
          size="sm"
          :label="t(`calendar.seasons.${temporada}`)"
        />
      </dt>
      <dd class="mt-2 font-mono text-sm text-highlighted">
        {{ t('calendar.weeks.quotaLine', {
          confirmed: quota[temporada].confirmed + quota[temporada].used,
          elected: quota[temporada].elected,
          released: quota[temporada].released,
          required: quota[temporada].required,
        }) }}
      </dd>
    </div>
  </dl>
</template>
