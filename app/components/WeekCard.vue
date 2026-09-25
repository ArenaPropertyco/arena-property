<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { WeekCell } from '#shared/scheduling/week-projection'
import { validateCancellation, validateConfirmation, validateRelease } from '#shared/scheduling/week-usage'
import type { OwnedWeek, UsageContext, WeekUsageError } from '#shared/scheduling/week-usage'
import { CLASS_BY_CELL_TYPE, COLOR_BY_SEASON, COLOR_BY_STATE, ICON_BY_CELL_TYPE } from '~/utils/weeks'

/**
 * HU-13 · RF-13.2, RF-13.3 · HU-14 · RF-14.1, RF-14.6, RF-14.7 · RT-06 — una
 * semana del calendario: tipo, fechas, temporada, estado, titular, ingreso y, en
 * las operables, confirmar, cancelar o liberar. El motor puro dice antes si cada
 * acción cabe. Es la misma tarjeta en la lista vertical y en el almanaque.
 *
 * En `gestion` es el tablero del Administrador: ninguna semana es «propia», cada
 * una dice de qué fracción es, y las acciones se ofrecen sobre las semanas con
 * dueño que la proyección marcó accionables.
 */
const props = withDefaults(defineProps<{
  cell: WeekCell
  context: UsageContext | null
  readOnly?: boolean
  busyWeek?: number | null
  gestion?: boolean
}>(), { readOnly: false, busyWeek: null, gestion: false })

const emit = defineEmits<{
  confirm: [number]
  cancel: [number]
  release: [number]
}>()

const { t, locale } = useI18n()
const { translate } = useWeekErrors()

const idioma = computed(() => locale.value as Idioma)

/** Operable: la propia o, en gestión, la de cualquier fracción. */
const operable = computed(() => props.cell.type === 'own' || (props.gestion && props.cell.type === 'other'))

const ownedWeek = computed<OwnedWeek | undefined>(() => {
  const cell = props.cell
  if (!operable.value || !cell.season) {
    return undefined
  }
  return {
    week: cell.week,
    season: cell.season,
    startsOn: cell.startsOn,
    endsOn: cell.endsOn,
    confirmedAt: cell.state === 'confirmed' || cell.state === 'used' ? 'yes' : null,
    releasedAt: cell.state === 'released' ? 'yes' : null,
    releaseReason: cell.state === 'released' ? 'voluntary' : null,
  }
})

type Accion = 'confirm' | 'cancel' | 'release'

function errorsOf(action: Accion): WeekUsageError[] {
  if (!props.context) {
    return []
  }
  return action === 'confirm'
    ? validateConfirmation(ownedWeek.value, props.context)
    : action === 'cancel'
      ? validateCancellation(ownedWeek.value, props.context)
      : validateRelease(ownedWeek.value, props.context)
}

function reasonOf(action: Accion): string | null {
  const error = errorsOf(action)[0]
  return error ? translate(error) : null
}

const rango = computed(() => t('calendar.weekRange', { from: formatearDia(props.cell.startsOn, idioma.value), to: formatearDia(props.cell.endsOn, idioma.value) }))

const descripcion = computed(() => {
  const cell = props.cell
  switch (cell.type) {
    case 'own':
      return cell.state ? t(`calendar.weeks.states.${cell.state}`) : ''
    case 'other':
      return t('calendar.weeks.ownerLine', { n: cell.fraction ?? '', name: cell.ownerName ?? '' })
    case 'blocked':
      return t('calendar.weeks.blockedLine', { reason: cell.reason ?? '' })
    case 'released':
      return t('calendar.weeks.releasedLine')
    case 'rented':
      return t('calendar.weeks.rentedLine', { reason: t('calendar.weeks.reasons.voluntary') })
    default:
      return t(`calendar.weeks.types.${cell.type}`)
  }
})

const conAcciones = computed(() => operable.value && props.cell.actionable && !props.readOnly)
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-3 rounded-2xl border p-3"
    :class="CLASS_BY_CELL_TYPE[cell.type]"
    :data-test="`semana-${cell.week}`"
    :data-tipo="cell.type"
    :data-estado="cell.state ?? undefined"
    :data-temporada="cell.season ?? undefined"
  >
    <UIcon
      :name="ICON_BY_CELL_TYPE[cell.type]"
      class="size-5 shrink-0 text-muted"
    />
    <div class="min-w-0 flex-1">
      <p class="flex flex-wrap items-center gap-2">
        <span class="font-mono text-xs text-muted">{{ t('calendar.weeks.week', { n: cell.week + 1 }) }}</span>
        <span class="text-sm text-highlighted">{{ rango }}</span>
        <UBadge
          v-if="cell.season"
          :color="COLOR_BY_SEASON[cell.season]"
          variant="subtle"
          size="sm"
          :label="t(`calendar.seasons.${cell.season}`)"
        />
        <UBadge
          v-if="operable && cell.state"
          :color="COLOR_BY_STATE[cell.state]"
          variant="soft"
          size="sm"
          :label="t(`calendar.weeks.states.${cell.state}`)"
          :data-test="`estado-${cell.week}`"
        />
        <!-- RF-13.2b · D-43 · solo la semana ya rentada cuyo ingreso es de esta fracción. -->
        <UBadge
          v-if="cell.income !== null"
          color="success"
          variant="subtle"
          size="sm"
          :label="t('calendar.weeks.incomeLine', { amount: formatearImporte(cell.income, idioma) })"
          :data-test="`ingreso-${cell.week}`"
        />
      </p>
      <p
        class="text-xs text-muted"
        data-test="descripcion"
      >
        <template v-if="operable">
          {{ cell.type === 'own' ? t('calendar.weeks.types.own') : t('calendar.weeks.ownerLine', { n: cell.fraction ?? '', name: cell.ownerName ?? '' }) }}
          <span
            v-if="cell.deadline"
            class="ml-1 font-mono"
            :data-test="`limite-${cell.week}`"
          >· {{ t('calendar.weeks.deadline', { date: formatearDia(cell.deadline, idioma) }) }}</span>
        </template>
        <template v-else>
          {{ descripcion }}
        </template>
      </p>
    </div>

    <div
      v-if="conAcciones"
      class="flex flex-wrap gap-2"
    >
      <UButton
        v-if="cell.state === 'elected'"
        size="xs"
        icon="i-lucide-check"
        :disabled="errorsOf('confirm').length > 0"
        :loading="busyWeek === cell.week"
        :label="t('calendar.weeks.confirm')"
        :title="reasonOf('confirm') ?? undefined"
        :data-test="`confirmar-${cell.week}`"
        @click="emit('confirm', cell.week)"
      />
      <UButton
        v-if="cell.state === 'confirmed'"
        size="xs"
        variant="soft"
        color="error"
        icon="i-lucide-calendar-x"
        :disabled="errorsOf('cancel').length > 0"
        :loading="busyWeek === cell.week"
        :label="t('calendar.weeks.cancel')"
        :title="reasonOf('cancel') ?? undefined"
        :data-test="`cancelar-${cell.week}`"
        @click="emit('cancel', cell.week)"
      />
      <UButton
        v-if="cell.state === 'elected'"
        size="xs"
        variant="outline"
        color="neutral"
        icon="i-lucide-key-round"
        :disabled="errorsOf('release').length > 0"
        :loading="busyWeek === cell.week"
        :label="t('calendar.weeks.release')"
        :title="reasonOf('release') ?? undefined"
        :data-test="`liberar-${cell.week}`"
        @click="emit('release', cell.week)"
      />
      <p
        v-if="cell.state === 'confirmed' && reasonOf('cancel')"
        class="w-full text-xs text-muted"
        :data-test="`motivo-${cell.week}`"
      >
        {{ reasonOf('cancel') }}
      </p>
      <p
        v-else-if="cell.state === 'elected' && reasonOf('confirm')"
        class="w-full text-xs text-muted"
        :data-test="`motivo-${cell.week}`"
      >
        {{ reasonOf('confirm') }}
      </p>
    </div>
  </div>
</template>
