<script setup lang="ts">
import { formatearInstante } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import { remainingParts } from '#shared/scheduling/relocation'
import type { RelocationTurn, RelocationTurnState } from '#shared/scheduling/relocation'

/**
 * HU-59 · RF-59.3, RF-59.6 · RT-06 — el estado del turno para el Propietario: si
 * está abierto, cuánto falta y qué semanas puede mover. Todo llega calculado por
 * el motor; aquí solo se cuenta.
 */
const props = defineProps<{
  turn: RelocationTurn
  anio: number
  movable: number[]
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const COLOR: Record<RelocationTurnState, 'success' | 'warning' | 'neutral'> = {
  own: 'success',
  open: 'success',
  scheduled: 'warning',
  before: 'warning',
  after: 'warning',
  closed: 'neutral',
  none: 'neutral',
}

const ICON: Record<RelocationTurnState, string> = {
  own: 'i-lucide-timer',
  open: 'i-lucide-door-open',
  scheduled: 'i-lucide-calendar-clock',
  before: 'i-lucide-hourglass',
  after: 'i-lucide-check',
  closed: 'i-lucide-door-closed',
  none: 'i-lucide-circle-off',
}

const mensaje = computed(() => {
  const fecha = (iso: string | null) => iso ? formatearInstante(iso, idioma.value) : ''
  const date = props.turn.state === 'scheduled' || props.turn.state === 'before' ? fecha(props.turn.opensAt) : fecha(props.turn.closesAt)
  return t(`calendar.relocation.status.${props.turn.state}`, { year: props.anio, date, fraction: props.turn.waitingFor ?? '' })
})

const conCuentaAtras = computed(() => props.turn.remainingMs > 0 && props.turn.state !== 'closed' && props.turn.state !== 'none')
const restante = computed(() => remainingParts(props.turn.remainingMs))
</script>

<template>
  <UAlert
    :color="COLOR[turn.state]"
    variant="subtle"
    :icon="ICON[turn.state]"
    :title="mensaje"
    data-test="estado-turno"
    :data-estado="turn.state"
  >
    <template #description>
      <p
        v-if="conCuentaAtras"
        class="font-mono"
        data-test="tiempo-restante"
      >
        {{ t('calendar.relocation.remaining', restante) }}
      </p>
      <p
        v-if="turn.canRelocate"
        class="mt-1"
        data-test="semanas-movibles"
      >
        {{ movable.length > 0
          ? t('calendar.relocation.movable', { count: movable.length, weeks: movable.map(w => w + 1).join(', ') })
          : t('calendar.relocation.nothingMovable') }}
      </p>
    </template>
  </UAlert>
</template>
