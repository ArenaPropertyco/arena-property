<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { Dia, SemanaDeRejilla } from '#shared/scheduling/rejilla'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'
import { validateWeekBlock } from '#shared/scheduling/week-blocks'
import type { WeekBlockError } from '#shared/scheduling/week-blocks'

/**
 * HU-15 · RF-15.1 · CA-15.1 · D-33 — bloquear una o más semanas completas de la
 * rejilla con motivo obligatorio. El motivo queda en la auditoría y lo ven los
 * propietarios (RF-15.3, RF-15.5).
 */
const props = defineProps<{
  rejilla: SemanaDeRejilla[]
  classification: SemanaClasificada[]
  blocked: number[]
  today: Dia
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [number[], string] }>()

const { t, locale } = useI18n()

const estado = reactive({ weeks: [] as number[], motivo: '' })
const errores = ref<WeekBlockError[]>([])

const seasonOf = computed(() => new Map(props.classification.map(s => [s.indice, s.temporada])))

const opciones = computed(() => props.rejilla
  .filter(s => s.inicio >= props.today && !props.blocked.includes(s.indice))
  .map(s => ({
    label: t('calendar.blocks.weekOption', {
      n: s.indice + 1,
      date: formatearDia(s.inicio, locale.value as Idioma),
      season: t(`calendar.seasons.${seasonOf.value.get(s.indice) ?? 'baja'}`),
    }),
    value: s.indice,
  })))

function enviar() {
  errores.value = validateWeekBlock({ weeks: estado.weeks, reason: estado.motivo }, {
    classification: props.classification,
    rejilla: props.rejilla,
    today: props.today,
    blocked: new Set(props.blocked),
  })
  if (errores.value.length > 0) {
    return
  }
  emit('submit', [...estado.weeks].sort((a, b) => a - b), estado.motivo.trim())
}

function errorDe(name: WeekBlockError['name']): string | undefined {
  const error = errores.value.find(e => e.name === name)
  return error ? t(error.message, { weeks: (error.weeks ?? []).map(w => w + 1).join(', ') }) : undefined
}

defineExpose({ limpiar: () => Object.assign(estado, { weeks: [], motivo: '' }) })
</script>

<template>
  <UForm
    :state="estado"
    class="grid gap-4 rounded-2xl border border-default bg-default p-4"
    data-test="formulario-bloqueo"
    @submit.prevent="enviar"
  >
    <UFormField
      :label="t('calendar.blocks.weeks')"
      :error="errorDe('semanas')"
      required
      data-test="campo-bloqueo-semanas"
    >
      <USelect
        v-model="estado.weeks"
        :items="opciones"
        multiple
        class="w-full"
        data-test="bloqueo-semanas"
      />
    </UFormField>

    <UFormField
      :label="t('calendar.blocks.reason')"
      :hint="t('calendar.blocks.reasonHint')"
      :error="errorDe('motivo')"
      required
      data-test="campo-bloqueo-motivo"
    >
      <UInput
        v-model="estado.motivo"
        class="w-full"
        data-test="motivo-bloqueo"
      />
    </UFormField>

    <div class="flex justify-end">
      <UButton
        type="submit"
        color="error"
        variant="soft"
        icon="i-lucide-lock"
        :loading="enviando"
        :label="t('calendar.blocks.create')"
        data-test="crear-bloqueo"
      />
    </div>
  </UForm>
</template>
