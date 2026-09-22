<script setup lang="ts">
import { defaultWindowOpening, fromBogotaInput, RELOCATION_TURN_HOURS, RELOCATION_WINDOW_DAYS, toBogotaInput, windowAdjustment } from '#shared/scheduling/relocation'
import type { RelocationWindowConfig } from '#shared/scheduling/relocation'
import { isValidOrder } from '#shared/scheduling/selection'
import type { SelectionWindowListed } from '#shared/scheduling/vistas'

/**
 * HU-59 · RF-59.1, RF-59.2, RF-59.10 · D-36, D-48 — el Superadmin fija la ventana
 * de reubicación del año: apertura en hora de Bogotá (P-12), duración (P-13),
 * turno por fracción (P-14) y el orden de los turnos, que parte de la sugerencia
 * rotada de la base.
 *
 * Sobre una ventana ya creada el mismo formulario ajusta, en cualquier fase. Antes
 * de guardar dice qué implica el ajuste —a cuántos titulares les mueve el turno,
 * si reabre una ventana cerrada—, porque mover una franja ajena no debería ser un
 * efecto que se descubra después. Eliminarla se pide desde aquí y la confirma la
 * página: lo ya reubicado no se deshace.
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
  eliminar: []
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

/** RF-59.1 · D-48 · qué cambiaría guardar esto sobre la ventana que ya existe. */
const ajuste = computed(() => windowAdjustment(props.window, {
  opensAt: fromBogotaInput(estado.opensAt),
  durationDays: Number(estado.durationDays),
  turnHours: Number(estado.turnHours),
  order: estado.order,
}))

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

    <p
      v-if="window && ajuste.changed"
      class="text-sm text-muted sm:col-span-3"
      data-test="resumen-ajuste"
    >
      {{ ajuste.movedFractions.length > 0
        ? t('calendar.relocation.adjustMoves', { count: ajuste.movedFractions.length, fractions: ajuste.movedFractions.join(', ') })
        : t('calendar.relocation.adjustNoMove') }}
      <span v-if="ajuste.reopens">{{ t('calendar.relocation.adjustReopens') }}</span>
    </p>

    <div class="flex flex-wrap justify-end gap-2 sm:col-span-3">
      <UButton
        v-if="window"
        variant="outline"
        color="error"
        icon="i-lucide-trash-2"
        :label="t('calendar.relocation.delete')"
        data-test="eliminar-ventana"
        @click="emit('eliminar')"
      />
      <UButton
        type="submit"
        icon="i-lucide-calendar-clock"
        :loading="enviando"
        :label="window ? t('calendar.relocation.adjust') : t('calendar.relocation.configure')"
        data-test="guardar-ventana"
      />
    </div>
  </UForm>
</template>
