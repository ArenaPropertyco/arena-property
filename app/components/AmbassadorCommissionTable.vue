<script setup lang="ts">
import type { CommissionType } from '#shared/referrals/commission'
import type { AmbassadorCommissionListed } from '#shared/referrals/views'

/**
 * HU-52 · RF-52.4 · CA-52.1 — a qué Embajador se le aplica cada tipo.
 *
 * Cada fila ofrece los tipos activos más la opción de volver al predeterminado,
 * que es lo que significa no tener asignación propia. La lista llega con el tipo
 * efectivo ya resuelto: aquí no se decide nada.
 */
const props = defineProps<{
  ambassadors: AmbassadorCommissionListed[]
  types: CommissionType[]
  ocupadoId: string | null
}>()

const emit = defineEmits<{ asignar: [string, string | null] }>()

const { t } = useI18n()

/**
 * Representa «sin asignación propia», es decir el predeterminado. No puede ser la
 * cadena vacía: el desplegable la reserva para limpiar la selección y mostrar el
 * marcador de posición, y rechaza una opción con ese valor.
 */
const SIN_ASIGNAR = 'predeterminado'

const opciones = computed(() => [
  { label: t('referrals.commission.useDefault'), value: SIN_ASIGNAR },
  ...props.types.map(type => ({ label: type.name, value: type.id })),
])

function cambiar(ambassadorId: string, valor: string) {
  emit('asignar', ambassadorId, valor === SIN_ASIGNAR ? null : valor)
}
</script>

<template>
  <div
    class="space-y-3"
    data-test="asignacion-comision"
  >
    <p
      v-if="ambassadors.length === 0"
      class="text-sm text-muted"
      data-test="sin-embajadores-comision"
    >
      {{ t('referrals.commission.noAmbassadors') }}
    </p>

    <ul
      v-else
      class="divide-y divide-default rounded-2xl border border-default bg-default"
    >
      <li
        v-for="embajador in ambassadors"
        :key="embajador.ambassadorId"
        class="flex flex-wrap items-center gap-3 px-3 py-2"
        :data-test="`comision-embajador-${embajador.ambassadorId}`"
      >
        <div class="min-w-48 flex-1 text-sm">
          <p class="text-highlighted">
            {{ embajador.fullName ?? embajador.email }}
          </p>
          <p class="text-muted">
            {{ embajador.email }}
          </p>
        </div>

        <span
          class="text-sm text-muted"
          :data-test="`vigente-${embajador.ambassadorId}`"
        >
          {{ embajador.effectiveTypeName
            ? t('referrals.commission.applies', { type: embajador.effectiveTypeName })
            : t('referrals.commission.noType') }}
        </span>

        <USelect
          :model-value="embajador.assignedTypeId ?? SIN_ASIGNAR"
          :items="opciones"
          class="w-56"
          :disabled="ocupadoId === embajador.ambassadorId"
          :data-test="`asignar-${embajador.ambassadorId}`"
          @update:model-value="cambiar(embajador.ambassadorId, String($event))"
        />
      </li>
    </ul>
  </div>
</template>
