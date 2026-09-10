<script setup lang="ts">
import { formatearDia, formatearInstante } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import { movableWeeks, relocationTargetsFor, validateRelocation } from '#shared/scheduling/relocation'
import type { RelocationContext, RelocationError } from '#shared/scheduling/relocation'

/**
 * HU-59 · RF-59.3…RF-59.5 · D-36 — el Propietario mueve una semana elegida a otra
 * libre de la misma temporada. El motor puro ofrece solo lo que se puede mover y
 * adónde, y rechaza lo que no cabe (CA-59.1…CA-59.5); la base lo repite.
 */
const props = defineProps<{
  fraction: number
  context: RelocationContext
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [number, number] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)
const estado = reactive({ from: null as number | null, to: null as number | null })
const errores = ref<RelocationError[]>([])

const seasonOf = computed(() => new Map(props.context.classification.map(s => [s.indice, s.temporada])))

function label(week: number): string {
  const grid = props.context.rejilla.find(s => s.indice === week)
  return t('calendar.relocation.weekOption', {
    n: week + 1,
    date: grid ? formatearDia(grid.inicio, idioma.value) : '',
    season: t(`calendar.seasons.${seasonOf.value.get(week) ?? 'baja'}`),
  })
}

const opcionesDesde = computed(() => movableWeeks(props.context.allocations, props.fraction, { rejilla: props.context.rejilla, today: props.context.today })
  .map(week => ({ label: label(week), value: week })))
const opcionesHasta = computed(() => estado.from === null
  ? []
  : relocationTargetsFor(estado.from, props.context).map(s => ({ label: label(s.indice), value: s.indice })))

watch(() => estado.from, () => {
  estado.to = null
})

function enviar() {
  if (estado.from === null) {
    errores.value = [{ message: 'calendar.relocation.validation.not_own' }]
    return
  }
  if (estado.to === null) {
    errores.value = [{ message: 'calendar.relocation.validation.week_unknown' }]
    return
  }
  errores.value = validateRelocation({ fraction: props.fraction, fromWeek: estado.from, toWeek: estado.to }, props.context)
  if (errores.value.length > 0) {
    return
  }
  emit('submit', estado.from, estado.to)
}

function translate(error: RelocationError): string {
  return t(error.message, {
    from: error.from ? t(`calendar.seasons.${error.from}`) : '',
    to: error.to ? t(`calendar.seasons.${error.to}`) : '',
    fraction: error.fraction ?? '',
    date: error.opensAt ? formatearInstante(error.opensAt, idioma.value) : '',
  })
}

defineExpose({ limpiar: () => Object.assign(estado, { from: null, to: null }) })
</script>

<template>
  <UForm
    :state="estado"
    class="grid gap-4 rounded-2xl border border-default bg-default p-4 sm:grid-cols-2"
    data-test="formulario-reubicacion"
    @submit.prevent="enviar"
  >
    <UFormField
      :label="t('calendar.relocation.from')"
      required
    >
      <USelect
        v-model="estado.from"
        :items="opcionesDesde"
        class="w-full"
        data-test="reubicar-desde"
      />
    </UFormField>

    <UFormField
      :label="t('calendar.relocation.to')"
      required
    >
      <USelect
        v-model="estado.to"
        :items="opcionesHasta"
        :disabled="estado.from === null"
        class="w-full"
        data-test="reubicar-hasta"
      />
    </UFormField>

    <ul
      v-if="errores.length > 0"
      class="space-y-1 text-sm text-error sm:col-span-2"
      data-test="errores-reubicacion"
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
        icon="i-lucide-move-horizontal"
        :loading="enviando"
        :label="t('calendar.relocation.submit')"
        data-test="mover-semana"
      />
    </div>
  </UForm>
</template>
