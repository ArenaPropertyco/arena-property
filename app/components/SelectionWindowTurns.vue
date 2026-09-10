<script setup lang="ts">
import { formatearInstante } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import { relocationTurnOf, windowPhase } from '#shared/scheduling/relocation'
import type { RelocationTurnState, WindowPhase } from '#shared/scheduling/relocation'
import type { SelectionWindowListed } from '#shared/scheduling/vistas'

/**
 * HU-59 · RF-59.1, RF-59.6 · D-36 — la ventana tal como la ve quien gestiona: en
 * qué fase está, la franja de cada fracción con su estado ahora mismo y el cierre
 * anticipado (CA-59.7).
 */
const props = defineProps<{
  window: SelectionWindowListed
  now: string
  canClose: boolean
  cerrando: boolean
}>()

const emit = defineEmits<{ cerrar: [] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)
const phase = computed<WindowPhase>(() => windowPhase(props.window, props.now))
const phaseDate = computed(() => {
  switch (phase.value) {
    case 'scheduled': return props.window.opensAt
    case 'closed': return props.window.closedAt ?? props.window.closesAt
    default: return props.window.closesAt
  }
})

const PHASE_COLOR: Record<WindowPhase, 'neutral' | 'primary' | 'success' | 'warning'> = {
  scheduled: 'neutral',
  turns: 'primary',
  open: 'success',
  closed: 'warning',
}

const TURN_COLOR: Record<RelocationTurnState, 'neutral' | 'primary' | 'success' | 'warning' | 'error'> = {
  scheduled: 'neutral',
  before: 'neutral',
  own: 'primary',
  after: 'success',
  open: 'success',
  closed: 'warning',
  none: 'error',
}

function stateOf(fraction: number): RelocationTurnState {
  return relocationTurnOf(props.window, fraction, props.now).state
}
</script>

<template>
  <div
    class="space-y-3"
    data-test="turnos-ventana"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <UBadge
        :color="PHASE_COLOR[phase]"
        variant="subtle"
        :label="t(`calendar.relocation.phase.${phase}`, { date: formatearInstante(phaseDate, idioma) })"
        data-test="ventana-fase"
        :data-fase="phase"
      />
      <UButton
        v-if="canClose && phase !== 'closed'"
        variant="outline"
        color="warning"
        size="sm"
        icon="i-lucide-door-closed"
        :loading="cerrando"
        :label="t('calendar.relocation.close')"
        data-test="cerrar-ventana"
        @click="emit('cerrar')"
      />
    </div>

    <ol class="divide-y divide-default rounded-2xl border border-default bg-default">
      <li
        v-for="turn in window.turns"
        :key="turn.fraction"
        class="flex flex-wrap items-center gap-3 px-3 py-2"
        :data-test="`turno-ventana-${turn.fraction}`"
        :data-estado="stateOf(turn.fraction)"
      >
        <span class="w-6 font-mono text-sm text-muted">{{ turn.position + 1 }}</span>
        <span class="font-mono text-sm text-highlighted">{{ t('calendar.fractionLabel', { n: turn.fraction }) }}</span>
        <span class="flex-1 truncate text-sm text-muted">{{ turn.ownerName ?? '' }}</span>
        <span class="font-mono text-xs text-muted">
          {{ t('calendar.relocation.turnSlot', { from: formatearInstante(turn.opensAt, idioma), to: formatearInstante(turn.closesAt, idioma) }) }}
        </span>
        <UBadge
          :color="TURN_COLOR[stateOf(turn.fraction)]"
          variant="subtle"
          size="sm"
          :label="t(`calendar.relocation.turnStatus.${stateOf(turn.fraction)}`)"
        />
      </li>
    </ol>
  </div>
</template>
