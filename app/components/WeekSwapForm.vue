<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { SemanaDeRejilla } from '#shared/scheduling/rejilla'
import { swappableWeeksFor, validateSwap } from '#shared/scheduling/swaps'
import type { AllocationEntry, SwapError, SwapProposal } from '#shared/scheduling/swaps'

/**
 * HU-12 · RF-12.6 · D-32 — el Administrador intercambia una semana de una fracción
 * por otra de la misma temporada, con motivo. El motor puro filtra las semanas
 * compatibles y rechaza lo que no cabe (CA-12.10); la base lo repite.
 */
const props = defineProps<{
  allocations: AllocationEntry[]
  /** Semanas confirmadas o liberadas: no se intercambian (D-33). */
  lockedWeeks: number[]
  rejilla: SemanaDeRejilla[]
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [SwapProposal, string] }>()

const { t, locale } = useI18n()

const estado = reactive({ from: null as number | null, to: null as number | null, motivo: '' })
const errores = ref<SwapError[]>([])

function label(entry: AllocationEntry): string {
  const week = props.rejilla.find(s => s.indice === entry.week)
  return t('calendar.swaps.week', {
    n: entry.week + 1,
    date: week ? formatearDia(week.inicio, locale.value as Idioma) : '',
    season: t(`calendar.seasons.${entry.season}`),
    fraction: t('calendar.fractionLabel', { n: entry.fraction }),
  })
}

const opcionesA = computed(() => [...props.allocations].sort((a, b) => a.week - b.week).map(e => ({ label: label(e), value: e.week })))
const opcionesB = computed(() => estado.from === null
  ? []
  : swappableWeeksFor(estado.from, props.allocations).map(e => ({ label: label(e), value: e.week })))

watch(() => estado.from, () => {
  estado.to = null
})

function proposal(): SwapProposal | null {
  const from = props.allocations.find(a => a.week === estado.from)
  const to = props.allocations.find(a => a.week === estado.to)
  return from && to ? { from: { fraction: from.fraction, week: from.week }, to: { fraction: to.fraction, week: to.week } } : null
}

function enviar() {
  const propuesta = proposal()
  if (!propuesta) {
    errores.value = [{ message: 'calendar.swaps.validation.week_not_owned' }]
    return
  }
  errores.value = validateSwap(propuesta, {
    allocations: props.allocations,
    lockedWeeks: new Set(props.lockedWeeks),
    reason: estado.motivo,
    requireReason: true,
  })
  if (errores.value.length > 0) {
    return
  }
  emit('submit', propuesta, estado.motivo.trim())
}

function translate(error: SwapError): string {
  return t(error.message, { weeks: (error.weeks ?? []).map(w => w + 1).join(', ') })
}
</script>

<template>
  <UForm
    :state="estado"
    class="grid gap-4 rounded-2xl border border-default bg-default p-4 sm:grid-cols-2"
    data-test="formulario-intercambio"
    @submit.prevent="enviar"
  >
    <UFormField
      :label="t('calendar.swaps.from')"
      required
    >
      <USelect
        v-model="estado.from"
        :items="opcionesA"
        class="w-full"
        data-test="intercambio-desde"
      />
    </UFormField>

    <UFormField
      :label="t('calendar.swaps.to')"
      required
    >
      <USelect
        v-model="estado.to"
        :items="opcionesB"
        :disabled="estado.from === null"
        class="w-full"
        data-test="intercambio-hasta"
      />
    </UFormField>

    <UFormField
      :label="t('calendar.swaps.reason')"
      required
      class="sm:col-span-2"
      data-test="campo-motivo-intercambio"
    >
      <UInput
        v-model="estado.motivo"
        class="w-full"
        data-test="motivo-intercambio"
      />
    </UFormField>

    <ul
      v-if="errores.length > 0"
      class="space-y-1 text-sm text-error sm:col-span-2"
      data-test="errores-intercambio"
    >
      <li
        v-for="error in errores"
        :key="error.message"
        :data-test="`error-${error.message.split('.').pop()}`"
      >
        {{ translate(error) }}
      </li>
    </ul>

    <div class="flex justify-end sm:col-span-2">
      <UButton
        type="submit"
        icon="i-lucide-arrow-left-right"
        :loading="enviando"
        :label="t('calendar.swaps.submit')"
        data-test="aplicar-intercambio"
      />
    </div>
  </UForm>
</template>
