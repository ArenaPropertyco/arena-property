<script setup lang="ts">
import { CRITERIO_POR_DEFECTO } from '#shared/scheduling/criterio'
import { turnOf, weeksPerFraction } from '#shared/scheduling/selection'
import type { SelectionTurnListed } from '#shared/scheduling/vistas'

/**
 * HU-12 · RF-12.4 · D-32 — cuánto lleva la selección: quién ya eligió, a quién le
 * toca, quién espera y qué fracciones no tienen turno por no tener titular.
 */
const props = defineProps<{
  turns: SelectionTurnListed[]
  freeWeeks: number
}>()

const { t } = useI18n()

const needed = weeksPerFraction(CRITERIO_POR_DEFECTO)

type Estado = 'done' | 'current' | 'waiting' | 'skipped'

function estadoDe(turn: SelectionTurnListed): Estado {
  if (!turn.hasOwner) {
    return 'skipped'
  }
  const status = turnOf(props.turns, turn.fraction)
  return status.done ? 'done' : status.canSelect ? 'current' : 'waiting'
}

const COLOR: Record<Estado, 'success' | 'primary' | 'neutral' | 'warning'> = {
  done: 'success',
  current: 'primary',
  waiting: 'neutral',
  skipped: 'warning',
}

const ordered = computed(() => [...props.turns].sort((a, b) => a.position - b.position))
</script>

<template>
  <div
    class="space-y-3"
    data-test="avance-seleccion"
  >
    <ol class="divide-y divide-default rounded-2xl border border-default bg-default">
      <li
        v-for="turn in ordered"
        :key="turn.fraction"
        class="flex flex-wrap items-center gap-3 px-3 py-2"
        :data-test="`avance-${turn.fraction}`"
        :data-estado="estadoDe(turn)"
      >
        <span class="w-6 font-mono text-sm text-muted">{{ turn.position + 1 }}</span>
        <span class="font-mono text-sm text-highlighted">{{ t('calendar.fractionLabel', { n: turn.fraction }) }}</span>
        <span class="flex-1 truncate text-sm text-muted">{{ turn.ownerName ?? '' }}</span>
        <span class="font-mono text-xs text-muted">{{ t('calendar.selection.selectedOf', { selected: turn.selectedWeeks, needed }) }}</span>
        <UBadge
          :color="COLOR[estadoDe(turn)]"
          variant="subtle"
          size="sm"
          :label="t(`calendar.selection.status.${estadoDe(turn)}`)"
        />
      </li>
    </ol>
    <p
      class="text-sm text-muted"
      data-test="semanas-libres"
    >
      {{ t('calendar.selection.poolNote', { count: freeWeeks }) }}
    </p>
  </div>
</template>
