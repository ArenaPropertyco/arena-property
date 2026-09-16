<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import { reassignmentTargets, validateReassignment } from '#shared/scheduling/reassignment'
import type { ReassignmentContext, ReassignmentError, ReassignmentProposal, ReassignmentTarget } from '#shared/scheduling/reassignment'
import type { Dia, SemanaDeRejilla } from '#shared/scheduling/rejilla'
import type { AllocationEntry } from '#shared/scheduling/swaps'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'

/**
 * HU-17 · RF-17.1, RF-17.3, RF-17.4 · D-42 — el Administrador mueve una semana de
 * una fracción a otra semana libre, con motivo. El motor puro ofrece solo los
 * destinos posibles (libres, futuros, sin bloqueo ni renta) y rechaza el resto
 * (CA-17.2); cruzar de temporada exige marcar la excepción además del motivo
 * (CA-17.3). La base repite las mismas reglas en `reassign_week`.
 */
const props = defineProps<{
  allocations: AllocationEntry[]
  /** Semanas ya en la bolsa de renta: no se mueven (D-43). */
  releasedWeeks: number[]
  blockedWeeks: number[]
  rentedWeeks: number[]
  rejilla: SemanaDeRejilla[]
  classification: SemanaClasificada[]
  today: Dia
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [ReassignmentProposal] }>()

const { t, locale } = useI18n()

const estado = reactive({ from: null as number | null, to: null as number | null, motivo: '', excepcion: false })
const errores = ref<ReassignmentError[]>([])

const contexto = computed<ReassignmentContext>(() => ({
  allocations: props.allocations,
  releasedWeeks: new Set(props.releasedWeeks),
  blockedWeeks: new Set(props.blockedWeeks),
  rentedWeeks: new Set(props.rentedWeeks),
  classification: props.classification,
  rejilla: props.rejilla,
  today: props.today,
}))

function fecha(week: number): string {
  const semana = props.rejilla.find(s => s.indice === week)
  return semana ? formatearDia(semana.inicio, locale.value as Idioma) : ''
}

function etiquetaDeOrigen(entry: AllocationEntry): string {
  return t('calendar.reassignment.week', {
    n: entry.week + 1,
    date: fecha(entry.week),
    season: t(`calendar.seasons.${entry.season}`),
    fraction: t('calendar.fractionLabel', { n: entry.fraction }),
  })
}

function etiquetaDeDestino(target: ReassignmentTarget): string {
  return t(target.sameSeason ? 'calendar.reassignment.target' : 'calendar.reassignment.targetOtherSeason', {
    n: target.week + 1,
    date: formatearDia(target.startsOn, locale.value as Idioma),
    season: t(`calendar.seasons.${target.season}`),
  })
}

/** Solo lo que todavía es de una fracción: lo liberado ya no se mueve. */
const origenes = computed(() => {
  const liberadas = new Set(props.releasedWeeks)
  return [...props.allocations]
    .filter(entry => !liberadas.has(entry.week))
    .sort((a, b) => a.week - b.week)
    .map(entry => ({ label: etiquetaDeOrigen(entry), value: entry.week }))
})

const destinos = computed(() => estado.from === null
  ? []
  : reassignmentTargets(estado.from, contexto.value).map(target => ({ label: etiquetaDeDestino(target), value: target.week })))

watch(() => estado.from, () => {
  estado.to = null
})

function propuesta(): ReassignmentProposal | null {
  const origen = props.allocations.find(a => a.week === estado.from)
  return origen && estado.to !== null
    ? { fraction: origen.fraction, fromWeek: origen.week, toWeek: estado.to, reason: estado.motivo.trim(), overrideSeason: estado.excepcion }
    : null
}

function enviar() {
  const candidata = propuesta()
  if (!candidata) {
    errores.value = [{ message: estado.from === null ? 'calendar.reassignment.validation.week_not_owned' : 'calendar.reassignment.validation.target_unknown' }]
    return
  }
  errores.value = validateReassignment(candidata, contexto.value)
  if (errores.value.length > 0) {
    return
  }
  emit('submit', candidata)
}

function traducir(error: ReassignmentError): string {
  return t(error.message, {
    weeks: (error.weeks ?? []).map(w => w + 1).join(', '),
    from: error.seasons ? t(`calendar.seasons.${error.seasons[0]}`) : '',
    to: error.seasons ? t(`calendar.seasons.${error.seasons[1]}`) : '',
  })
}
</script>

<template>
  <UForm
    :state="estado"
    class="grid gap-4 rounded-2xl border border-default bg-default p-4 sm:grid-cols-2"
    data-test="formulario-reasignacion"
    @submit.prevent="enviar"
  >
    <UFormField
      :label="t('calendar.reassignment.from')"
      required
    >
      <USelect
        v-model="estado.from"
        :items="origenes"
        class="w-full"
        data-test="reasignacion-desde"
      />
    </UFormField>

    <UFormField
      :label="t('calendar.reassignment.to')"
      required
    >
      <USelect
        v-model="estado.to"
        :items="destinos"
        :disabled="estado.from === null"
        class="w-full"
        data-test="reasignacion-hasta"
      />
    </UFormField>

    <UFormField
      :label="t('calendar.reassignment.reason')"
      :hint="t('calendar.reassignment.reasonHint')"
      required
      class="sm:col-span-2"
    >
      <UInput
        v-model="estado.motivo"
        class="w-full"
        data-test="motivo-reasignacion"
      />
    </UFormField>

    <UFormField
      :help="t('calendar.reassignment.overrideHint')"
      class="sm:col-span-2"
    >
      <UCheckbox
        v-model="estado.excepcion"
        :label="t('calendar.reassignment.overrideSeason')"
        data-test="excepcion-temporada"
      />
    </UFormField>

    <ul
      v-if="errores.length > 0"
      class="space-y-1 text-sm text-error sm:col-span-2"
      data-test="errores-reasignacion"
    >
      <li
        v-for="error in errores"
        :key="error.message"
        :data-test="`error-${error.message.split('.').pop()}`"
      >
        {{ traducir(error) }}
      </li>
    </ul>

    <div class="flex justify-end sm:col-span-2">
      <UButton
        type="submit"
        icon="i-lucide-move-right"
        :loading="enviando"
        :label="t('calendar.reassignment.submit')"
        data-test="aplicar-reasignacion"
      />
    </div>
  </UForm>
</template>
