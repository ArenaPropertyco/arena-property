<script setup lang="ts">
import { defaultWindowOpening, fromBogotaInput, RELOCATION_TURN_HOURS, RELOCATION_WINDOW_DAYS, toBogotaInput } from '#shared/scheduling/relocation'
import type { RelocationWindowConfig } from '#shared/scheduling/relocation'
import { isValidOrder } from '#shared/scheduling/selection'
import type { SelectionWindowListed } from '#shared/scheduling/vistas'

/**
 * HU-59 · RF-59.1, RF-59.2 · D-36 — el Superadmin fija la ventana de reubicación
 * del año: apertura en hora de Bogotá (P-12), duración (P-13), turno por fracción
 * (P-14) y el orden de los turnos, que parte de la sugerencia rotada de la base.
 */
const props = defineProps<{
  window: SelectionWindowListed | null
  fractions: { number: number, ownerName: string | null }[]
  suggestedOrder: number[]
  anio: number
  enviando: boolean
}>()

const emit = defineEmits<{
  submit: [RelocationWindowConfig]
  sugerir: []
}>()

const { t } = useI18n()

const estado = reactive({
  opensAt: toBogotaInput(props.window?.opensAt ?? defaultWindowOpening(props.anio)),
  durationDays: props.window?.durationDays ?? RELOCATION_WINDOW_DAYS,
  turnHours: props.window?.turnHours ?? RELOCATION_TURN_HOURS,
  order: [...(props.window?.order ?? props.suggestedOrder)],
})

watch(() => props.window, (ventana) => {
  if (ventana) {
    Object.assign(estado, { opensAt: toBogotaInput(ventana.opensAt), durationDays: ventana.durationDays, turnHours: ventana.turnHours, order: [...ventana.order] })
  }
})
watch(() => props.suggestedOrder, (sugerido) => {
  if (!props.window) {
    estado.order = [...sugerido]
  }
})

const errores = reactive<{ duration?: string, turn?: string, order?: string }>({})

function enviar() {
  const durationDays = Number(estado.durationDays)
  const turnHours = Number(estado.turnHours)
  errores.duration = durationDays >= 1 ? undefined : t('calendar.relocation.form.duration')
  errores.turn = turnHours >= 1 ? undefined : t('calendar.relocation.form.turn')
  errores.order = isValidOrder(estado.order, props.fractions.map(f => f.number)) ? undefined : t('calendar.relocation.form.order')
  if (errores.duration || errores.turn || errores.order) {
    return
  }
  emit('submit', { opensAt: fromBogotaInput(estado.opensAt), durationDays, turnHours, order: [...estado.order] })
}
</script>

<template>
  <UForm
    :state="estado"
    class="grid gap-4 rounded-2xl border border-default bg-default p-4 sm:grid-cols-3"
    data-test="formulario-ventana"
    @submit.prevent="enviar"
  >
    <UFormField
      :label="t('calendar.relocation.opensAt')"
      required
    >
      <UInput
        v-model="estado.opensAt"
        type="datetime-local"
        class="w-full"
        data-test="ventana-apertura"
      />
    </UFormField>

    <UFormField
      :label="t('calendar.relocation.durationDays')"
      :error="errores.duration"
      required
      data-test="campo-ventana-duracion"
    >
      <UInput
        v-model="estado.durationDays"
        type="number"
        min="1"
        class="w-full"
        data-test="ventana-duracion"
      />
    </UFormField>

    <UFormField
      :label="t('calendar.relocation.turnHours')"
      :error="errores.turn"
      required
      data-test="campo-ventana-turno"
    >
      <UInput
        v-model="estado.turnHours"
        type="number"
        min="1"
        class="w-full"
        data-test="ventana-turno"
      />
    </UFormField>

    <div class="space-y-2 sm:col-span-3">
      <p class="text-sm font-medium text-highlighted">
        {{ t('calendar.relocation.orderTitle') }}
      </p>
      <SelectionOrderEditor
        v-model:order="estado.order"
        :fractions="fractions"
        :editable="!enviando"
        @sugerir="emit('sugerir')"
      />
      <p
        v-if="errores.order"
        class="text-sm text-error"
        data-test="error-orden-ventana"
      >
        {{ errores.order }}
      </p>
    </div>

    <div class="flex justify-end sm:col-span-3">
      <UButton
        type="submit"
        icon="i-lucide-calendar-clock"
        :loading="enviando"
        :label="t('calendar.relocation.configure')"
        data-test="guardar-ventana"
      />
    </div>
  </UForm>
</template>
