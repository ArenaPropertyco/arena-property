<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { SemanaDeRejilla } from '#shared/scheduling/rejilla'
import { swappableWeeksFor, validateSwapRequest } from '#shared/scheduling/swaps'
import type { AllocationEntry, SwapError, SwapRequestDraft } from '#shared/scheduling/swaps'

/**
 * HU-12 · RF-12.6 · D-32 — el Propietario ofrece una semana suya por una de otra
 * fracción de la misma temporada y deja un mensaje al Administrador (CA-12.11).
 */
const props = defineProps<{
  fraction: number
  allocations: AllocationEntry[]
  rejilla: SemanaDeRejilla[]
  enviando: boolean
}>()

const emit = defineEmits<{ submit: [SwapRequestDraft, string | null] }>()

const { t, locale } = useI18n()

const estado = reactive({ offered: null as number | null, requested: null as number | null, mensaje: '' })
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

const propias = computed(() => props.allocations.filter(a => a.fraction === props.fraction).sort((a, b) => a.week - b.week).map(e => ({ label: label(e), value: e.week })))
const ajenas = computed(() => estado.offered === null
  ? []
  : swappableWeeksFor(estado.offered, props.allocations).map(e => ({ label: label(e), value: e.week })))

watch(() => estado.offered, () => {
  estado.requested = null
})

function enviar() {
  const target = props.allocations.find(a => a.week === estado.requested)
  if (estado.offered === null || !target) {
    errores.value = [{ message: 'calendar.swaps.validation.week_not_owned' }]
    return
  }
  const draft: SwapRequestDraft = { fraction: props.fraction, offeredWeek: estado.offered, targetFraction: target.fraction, requestedWeek: target.week }
  errores.value = validateSwapRequest(draft, { allocations: props.allocations })
  if (errores.value.length > 0) {
    return
  }
  emit('submit', draft, estado.mensaje.trim() || null)
}

function translate(error: SwapError): string {
  return t(error.message, { weeks: (error.weeks ?? []).map(w => w + 1).join(', ') })
}
</script>

<template>
  <UForm
    :state="estado"
    class="grid gap-4 rounded-2xl border border-default bg-default p-4 sm:grid-cols-2"
    data-test="formulario-solicitud"
    @submit.prevent="enviar"
  >
    <p class="text-sm text-muted sm:col-span-2">
      {{ t('calendar.swaps.requestHint') }}
    </p>

    <UFormField
      :label="t('calendar.swaps.offered')"
      required
    >
      <USelect
        v-model="estado.offered"
        :items="propias"
        class="w-full"
        data-test="solicitud-ofrece"
      />
    </UFormField>

    <UFormField
      :label="t('calendar.swaps.requested')"
      required
    >
      <USelect
        v-model="estado.requested"
        :items="ajenas"
        :disabled="estado.offered === null"
        class="w-full"
        data-test="solicitud-pide"
      />
    </UFormField>

    <UFormField
      :label="t('calendar.swaps.message')"
      class="sm:col-span-2"
    >
      <UInput
        v-model="estado.mensaje"
        class="w-full"
        data-test="solicitud-mensaje"
      />
    </UFormField>

    <ul
      v-if="errores.length > 0"
      class="space-y-1 text-sm text-error sm:col-span-2"
      data-test="errores-solicitud"
    >
      <li
        v-for="error in errores"
        :key="error.message"
      >
        {{ translate(error) }}
      </li>
    </ul>

    <div class="flex justify-end sm:col-span-2">
      <UButton
        type="submit"
        variant="outline"
        icon="i-lucide-send"
        :loading="enviando"
        :label="t('calendar.swaps.request')"
        data-test="enviar-solicitud"
      />
    </div>
  </UForm>
</template>
