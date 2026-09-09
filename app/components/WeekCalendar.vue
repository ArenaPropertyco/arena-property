<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import { regionDe } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { WeekCell } from '#shared/scheduling/week-projection'
import { validateCancellation, validateConfirmation, validateRelease } from '#shared/scheduling/week-usage'
import type { OwnedWeek, UsageContext, WeekUsageError } from '#shared/scheduling/week-usage'
import { CLASS_BY_CELL_TYPE, COLOR_BY_SEASON, COLOR_BY_STATE, ICON_BY_CELL_TYPE } from '~/utils/weeks'

/**
 * HU-13 · RF-13.2, RF-13.3 · HU-14 · RF-14.1, RF-14.6, RF-14.7 · RT-06 — el año
 * por semanas, agrupado por mes de entrada.
 *
 * Cada semana llega ya proyectada (tipo, estado, quién, por qué, fecha límite) y
 * el componente solo la pinta y ofrece, en las propias, confirmar, cancelar o
 * liberar; el motor puro dice antes si cada acción cabe. En solo lectura (D-31)
 * nada responde.
 */
const props = withDefaults(defineProps<{
  cells: WeekCell[]
  context: UsageContext | null
  readOnly?: boolean
  busyWeek?: number | null
}>(), { readOnly: false, busyWeek: null })

const emit = defineEmits<{
  confirm: [number]
  cancel: [number]
  release: [number]
}>()

const { t, locale } = useI18n()
const { translate } = useWeekErrors()

const idioma = computed(() => locale.value as Idioma)

const meses = computed(() => {
  const formato = new Intl.DateTimeFormat(regionDe(idioma.value), { month: 'long', timeZone: 'UTC' })
  const grupos = new Map<string, WeekCell[]>()
  for (const cell of props.cells) {
    const clave = cell.startsOn.slice(0, 7)
    grupos.set(clave, [...(grupos.get(clave) ?? []), cell])
  }
  return [...grupos.entries()].map(([clave, cells]) => ({ clave, nombre: formato.format(new Date(`${clave}-01T00:00:00Z`)), cells }))
})

function ownedWeek(cell: WeekCell): OwnedWeek | undefined {
  if (cell.type !== 'own' || !cell.season) {
    return undefined
  }
  const state = cell.state
  return {
    week: cell.week,
    season: cell.season,
    startsOn: cell.startsOn,
    endsOn: cell.endsOn,
    confirmedAt: state === 'confirmed' || state === 'used' ? 'yes' : null,
    releasedAt: state === 'released' ? 'yes' : null,
    releaseReason: state === 'released' ? 'voluntary' : null,
  }
}

type Accion = 'confirm' | 'cancel' | 'release'

function errorsOf(cell: WeekCell, action: Accion): WeekUsageError[] {
  if (!props.context) {
    return []
  }
  const week = ownedWeek(cell)
  return action === 'confirm'
    ? validateConfirmation(week, props.context)
    : action === 'cancel'
      ? validateCancellation(week, props.context)
      : validateRelease(week, props.context)
}

function reasonOf(cell: WeekCell, action: Accion): string | null {
  const error = errorsOf(cell, action)[0]
  return error ? translate(error) : null
}

function rango(cell: WeekCell): string {
  return t('calendar.weekRange', { from: formatearDia(cell.startsOn, idioma.value), to: formatearDia(cell.endsOn, idioma.value) })
}

function descripcion(cell: WeekCell): string {
  switch (cell.type) {
    case 'own':
      return cell.state ? t(`calendar.weeks.states.${cell.state}`) : ''
    case 'other':
      return t('calendar.weeks.ownerLine', { n: cell.fraction ?? '', name: cell.ownerName ?? '' })
    case 'blocked':
      return t('calendar.weeks.blockedLine', { reason: cell.reason ?? '' })
    case 'rented':
      return t('calendar.weeks.rentedLine', { reason: t('calendar.weeks.reasons.voluntary') })
    default:
      return t(`calendar.weeks.types.${cell.type}`)
  }
}

function showActions(cell: WeekCell): boolean {
  return cell.type === 'own' && cell.actionable && !props.readOnly
}
</script>

<template>
  <div
    class="space-y-6"
    data-test="calendario-semanas"
  >
    <section
      v-for="mes in meses"
      :key="mes.clave"
      :data-test="`mes-${mes.clave}`"
    >
      <h3 class="mb-2 font-serif text-lg capitalize text-highlighted">
        {{ mes.nombre }}
      </h3>
      <ul class="space-y-2">
        <li
          v-for="cell in mes.cells"
          :key="cell.week"
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
              <span class="text-sm text-highlighted">{{ rango(cell) }}</span>
              <UBadge
                v-if="cell.season"
                :color="COLOR_BY_SEASON[cell.season]"
                variant="subtle"
                size="sm"
                :label="t(`calendar.seasons.${cell.season}`)"
              />
              <UBadge
                v-if="cell.type === 'own' && cell.state"
                :color="COLOR_BY_STATE[cell.state]"
                variant="soft"
                size="sm"
                :label="t(`calendar.weeks.states.${cell.state}`)"
                :data-test="`estado-${cell.week}`"
              />
            </p>
            <p
              class="text-xs text-muted"
              data-test="descripcion"
            >
              <template v-if="cell.type === 'own'">
                {{ t('calendar.weeks.types.own') }}
                <span
                  v-if="cell.deadline"
                  class="ml-1 font-mono"
                  :data-test="`limite-${cell.week}`"
                >· {{ t('calendar.weeks.deadline', { date: formatearDia(cell.deadline, idioma) }) }}</span>
              </template>
              <template v-else>
                {{ descripcion(cell) }}
              </template>
            </p>
          </div>

          <div
            v-if="showActions(cell)"
            class="flex flex-wrap gap-2"
          >
            <UButton
              v-if="cell.state === 'elected'"
              size="xs"
              icon="i-lucide-check"
              :disabled="errorsOf(cell, 'confirm').length > 0"
              :loading="busyWeek === cell.week"
              :label="t('calendar.weeks.confirm')"
              :title="reasonOf(cell, 'confirm') ?? undefined"
              :data-test="`confirmar-${cell.week}`"
              @click="emit('confirm', cell.week)"
            />
            <UButton
              v-if="cell.state === 'confirmed'"
              size="xs"
              variant="soft"
              color="error"
              icon="i-lucide-calendar-x"
              :disabled="errorsOf(cell, 'cancel').length > 0"
              :loading="busyWeek === cell.week"
              :label="t('calendar.weeks.cancel')"
              :title="reasonOf(cell, 'cancel') ?? undefined"
              :data-test="`cancelar-${cell.week}`"
              @click="emit('cancel', cell.week)"
            />
            <UButton
              v-if="cell.state === 'elected'"
              size="xs"
              variant="outline"
              color="neutral"
              icon="i-lucide-key-round"
              :disabled="errorsOf(cell, 'release').length > 0"
              :loading="busyWeek === cell.week"
              :label="t('calendar.weeks.release')"
              :title="reasonOf(cell, 'release') ?? undefined"
              :data-test="`liberar-${cell.week}`"
              @click="emit('release', cell.week)"
            />
            <p
              v-if="cell.state === 'confirmed' && reasonOf(cell, 'cancel')"
              class="w-full text-xs text-muted"
              :data-test="`motivo-${cell.week}`"
            >
              {{ reasonOf(cell, 'cancel') }}
            </p>
            <p
              v-else-if="cell.state === 'elected' && reasonOf(cell, 'confirm')"
              class="w-full text-xs text-muted"
              :data-test="`motivo-${cell.week}`"
            >
              {{ reasonOf(cell, 'confirm') }}
            </p>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
