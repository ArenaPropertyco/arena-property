<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import { CRITERIO_POR_DEFECTO } from '#shared/scheduling/criterio'
import type { Criterio } from '#shared/scheduling/criterio'
import type { SemanaDeRejilla } from '#shared/scheduling/rejilla'
import { selectionSummary, validateWeekSelection, weeksPerFraction } from '#shared/scheduling/selection'
import type { SelectionError, TurnStatus } from '#shared/scheduling/selection'
import { TEMPORADAS } from '#shared/scheduling/temporadas'
import type { SemanaClasificada, Temporada } from '#shared/scheduling/temporadas'

/**
 * HU-12 · RF-12.3, RF-12.4 · D-32 — el Propietario elige sus semanas cuando le
 * llega el turno: 1 alta, 1 media-alta, 1 media y 3 bajas entre las que siguen
 * libres. El motor puro dice qué falta o sobra antes de enviar; la base lo
 * vuelve a comprobar (CA-12.2, CA-12.3, CA-12.5).
 */
const props = withDefaults(defineProps<{
  rejilla: SemanaDeRejilla[]
  classification: SemanaClasificada[]
  taken: number[]
  turn: TurnStatus
  anio: number
  enviando: boolean
  criteria?: Criterio
}>(), { criteria: () => CRITERIO_POR_DEFECTO })

const emit = defineEmits<{ submit: [number[]] }>()

const { t, locale } = useI18n()

const chosen = ref<number[]>([])
const takenSet = computed(() => new Set(props.taken))
const needed = computed(() => weeksPerFraction(props.criteria))
const summary = computed(() => selectionSummary(chosen.value, props.classification))
const errors = computed<SelectionError[]>(() => chosen.value.length === 0
  ? []
  : validateWeekSelection(chosen.value, { classification: props.classification, taken: takenSet.value, criteria: props.criteria, turn: props.turn }))
const canSubmit = computed(() => chosen.value.length === needed.value && errors.value.length === 0)

const COLOR: Record<Temporada, 'error' | 'warning' | 'primary' | 'neutral'> = {
  alta: 'error',
  media_alta: 'warning',
  media: 'primary',
  baja: 'neutral',
}

const porTemporada = computed(() => TEMPORADAS.map(season => ({
  season,
  required: props.criteria[season],
  weeks: props.classification.filter(s => s.temporada === season).sort((a, b) => a.indice - b.indice),
})))

const composition = computed(() => TEMPORADAS
  .filter(season => props.criteria[season] > 0)
  .map(season => t('calendar.selection.composition', { n: props.criteria[season], season: t(`calendar.seasons.${season}`).toLowerCase() }))
  .join(', '))

function rangeOf(index: number): string {
  const week = props.rejilla.find(s => s.indice === index)
  if (!week) {
    return String(index + 1)
  }
  const idioma = locale.value as Idioma
  return t('calendar.weekRange', { from: formatearDia(week.inicio, idioma), to: formatearDia(week.noches[6]!, idioma) })
}

function toggle(index: number) {
  if (takenSet.value.has(index) || !props.turn.canSelect) {
    return
  }
  chosen.value = chosen.value.includes(index)
    ? chosen.value.filter(i => i !== index)
    : [...chosen.value, index].sort((a, b) => a - b)
}

function translate(error: SelectionError): string {
  return t(error.message, {
    required: error.required ?? '',
    chosen: error.chosen ?? '',
    season: error.season ? t(`calendar.seasons.${error.season}`).toLowerCase() : '',
    weeks: (error.weeks ?? []).map(w => w + 1).join(', '),
    fraction: error.waitingFor ?? '',
  })
}
</script>

<template>
  <div
    class="space-y-4 rounded-2xl border border-default bg-default p-4"
    data-test="formulario-seleccion"
  >
    <UAlert
      v-if="turn.done"
      color="success"
      variant="subtle"
      icon="i-lucide-check-circle"
      :description="t('calendar.selection.turnDone', { year: anio })"
      data-test="turno-hecho"
    />
    <UAlert
      v-else-if="turn.position === null"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :description="t('calendar.selection.noTurn')"
      data-test="sin-turno"
    />
    <UAlert
      v-else-if="!turn.canSelect"
      color="warning"
      variant="subtle"
      icon="i-lucide-hourglass"
      :description="t('calendar.selection.turnWaiting', { fraction: t('calendar.fractionLabel', { n: turn.waitingFor ?? '' }) })"
      data-test="turno-espera"
    />
    <UAlert
      v-else
      color="primary"
      variant="subtle"
      icon="i-lucide-hand"
      :title="t('calendar.selection.chooseTitle')"
      :description="t('calendar.selection.chooseHint', { needed, composition })"
      data-test="turno-listo"
    />

    <template v-if="turn.canSelect">
      <dl class="flex flex-wrap gap-4">
        <div
          v-for="grupo in porTemporada"
          :key="grupo.season"
          :data-test="`resumen-eleccion-${grupo.season}`"
        >
          <dt class="text-xs uppercase tracking-wide text-muted">
            {{ t(`calendar.seasons.${grupo.season}`) }}
          </dt>
          <dd
            class="font-mono text-sm"
            :class="summary[grupo.season] === grupo.required ? 'text-success' : ''"
          >
            {{ t('calendar.selection.summary', { chosen: summary[grupo.season], required: grupo.required }) }}
          </dd>
        </div>
      </dl>

      <section
        v-for="grupo in porTemporada"
        :key="grupo.season"
        class="space-y-2"
      >
        <h4 class="text-sm font-medium text-highlighted">
          {{ t(`calendar.seasons.${grupo.season}`) }}
        </h4>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="semana in grupo.weeks"
            :key="semana.indice"
            size="sm"
            :color="COLOR[grupo.season]"
            :variant="chosen.includes(semana.indice) ? 'solid' : takenSet.has(semana.indice) ? 'ghost' : 'outline'"
            :disabled="takenSet.has(semana.indice)"
            :icon="takenSet.has(semana.indice) ? 'i-lucide-lock' : semana.bloquePico ? 'i-lucide-star' : undefined"
            :label="rangeOf(semana.indice)"
            :title="takenSet.has(semana.indice) ? t('calendar.selection.takenBy', { fraction: '' }) : t('calendar.selection.free')"
            :data-test="`semana-elegir-${semana.indice}`"
            :aria-pressed="chosen.includes(semana.indice)"
            @click="toggle(semana.indice)"
          />
        </div>
      </section>

      <ul
        v-if="errors.length > 0"
        class="space-y-1 text-sm text-error"
        data-test="errores-seleccion"
      >
        <li
          v-for="error in errors"
          :key="`${error.message}-${error.season ?? ''}`"
          :data-test="`error-${error.message.split('.').pop()}`"
        >
          {{ translate(error) }}
        </li>
      </ul>

      <div class="flex justify-end">
        <UButton
          icon="i-lucide-calendar-check"
          :disabled="!canSubmit"
          :loading="enviando"
          :label="t('calendar.selection.submit')"
          data-test="confirmar-semanas"
          @click="emit('submit', chosen)"
        />
      </div>
    </template>
  </div>
</template>
