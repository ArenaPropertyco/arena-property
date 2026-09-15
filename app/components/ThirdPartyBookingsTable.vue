<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia } from '#shared/dates/formato'
import { esAtribuible } from '#shared/finance/ingresos'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { ReservaListada } from '#shared/scheduling/vistas-renta'

/**
 * HU-39 · RF-39.2b, RF-39.3, RF-39.4 · HU-40 · RF-40.6 · D-39 — las reservas a
 * terceros de una propiedad.
 *
 * Cada fila dice de dónde salió la semana **y a quién irá su ingreso**, porque esas
 * dos cosas no son evidentes y el Administrador decide con ellas. Una reserva
 * cancelada sigue en la lista, marcada: el histórico de lo que se rentó es parte de
 * la honestidad del dato (principio 9).
 */
const props = defineProps<{
  reservas: ReservaListada[]
  puedeGestionar: boolean
}>()

defineEmits<{
  ingreso: [string]
  cancelar: [string]
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

function origen(reserva: ReservaListada): string {
  return t(`rentals.origin.${reserva.originReason}`, { fraction: reserva.originFraction ?? '' })
}

/** RF-40.6 · la naturaleza del ingreso, explícita antes de registrarlo. */
function destino(reserva: ReservaListada): string {
  return esAtribuible(reserva.originReason)
    ? t('rentals.origin.attributed', { fraction: reserva.originFraction ?? '' })
    : t('rentals.origin.prorated')
}

function vigente(reserva: ReservaListada): boolean {
  return props.puedeGestionar && reserva.status === 'confirmed'
}

const columnas = computed<TableColumn<ReservaListada>[]>(() => [
  { id: 'semana', header: t('rentals.columns.week') },
  { id: 'huesped', header: t('rentals.columns.guest') },
  { id: 'origen', header: t('rentals.columns.origin') },
  { id: 'ingreso', header: t('rentals.columns.income') },
  { id: 'acciones', header: '' },
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <UTable
      :data="reservas"
      :columns="columnas"
      :empty="t('rentals.empty')"
      data-test="tabla-reservas"
    >
      <template #semana-cell="{ row }">
        <div class="flex flex-col whitespace-nowrap">
          <span
            class="font-mono"
            :class="row.original.status === 'cancelled' ? 'text-muted line-through' : ''"
          >{{ row.original.week }}</span>
          <span class="text-xs text-muted">{{ formatearDia(row.original.startsOn, idioma) }}</span>
        </div>
      </template>

      <template #huesped-cell="{ row }">
        <span :class="row.original.status === 'cancelled' ? 'text-muted line-through' : ''">
          {{ row.original.guestName }}
        </span>
      </template>

      <template #origen-cell="{ row }">
        <div class="flex flex-col">
          <span :data-test="`origen-${row.original.id}`">{{ origen(row.original) }}</span>
          <span
            class="text-xs text-muted"
            :data-test="`destino-${row.original.id}`"
          >{{ destino(row.original) }}</span>
        </div>
      </template>

      <template #ingreso-cell="{ row }">
        <span
          v-if="row.original.incomeAmount !== null"
          class="font-mono"
          :data-test="`ingreso-${row.original.id}`"
        >{{ formatearImporte(row.original.incomeAmount, idioma) }}</span>
        <span
          v-else
          class="text-xs text-muted"
        >{{ t('rentals.income.none') }}</span>
      </template>

      <template #acciones-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UBadge
            v-if="row.original.status === 'cancelled'"
            color="error"
            variant="subtle"
            size="sm"
            :label="t('rentals.cancelled')"
            :title="row.original.cancelReason ?? ''"
            :data-test="`cancelada-${row.original.id}`"
          />
          <UButton
            v-if="vigente(row.original) && row.original.incomeId === null"
            variant="ghost"
            size="xs"
            icon="i-lucide-banknote"
            :label="t('rentals.income.register')"
            :data-test="`registrar-ingreso-${row.original.id}`"
            @click="$emit('ingreso', row.original.id)"
          />
          <UButton
            v-if="vigente(row.original)"
            variant="ghost"
            color="error"
            size="xs"
            :label="t('rentals.cancel')"
            :data-test="`cancelar-${row.original.id}`"
            @click="$emit('cancelar', row.original.id)"
          />
        </div>
      </template>
    </UTable>
  </div>
</template>
