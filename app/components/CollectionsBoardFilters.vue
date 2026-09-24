<script setup lang="ts">
import { formatearMes } from '#shared/dates/formato'
import { CHARGE_STATUSES } from '#shared/finance/cobros'
import type { ChargeStatus } from '#shared/finance/cobros'
import { mesAnterior, mesSiguiente } from '#shared/finance/estado-de-cuenta'
import type { Mes } from '#shared/finance/estado-de-cuenta'
import { filtroDeTableroVacio, NATURALEZAS_DE_FILA } from '#shared/finance/tablero-de-cobros'
import type { FiltroDeTablero, NaturalezaDeFila } from '#shared/finance/tablero-de-cobros'
import type { Idioma } from '#shared/money/formato'

/**
 * HU-63 · RF-63.9 — el mes del tablero y sus filtros: naturaleza y estado del
 * cobro, combinables. Controlado: recibe el filtro y el mes y emite cada
 * cambio; filtrar lo hace `shared/finance/tablero-de-cobros`. El mes en curso
 * se anuncia como estimado y no se pasa de él: lo que sigue no existe.
 */
const props = defineProps<{
  filtro: FiltroDeTablero
  mes: Mes
  mesEnCurso: Mes
}>()

const emit = defineEmits<{
  'update:filtro': [FiltroDeTablero]
  'update:mes': [Mes]
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

/** El selector no admite el vacío como valor: «todos» viaja como centinela. */
const TODOS = '__todos__'

const naturalezas = computed(() => [
  { label: t('collections.filters.allNatures'), value: TODOS },
  ...NATURALEZAS_DE_FILA.map(nature => ({ label: t(`collections.nature.${nature}`), value: nature })),
])
const estados = computed(() => [
  { label: t('collections.filters.allStatuses'), value: TODOS },
  ...CHARGE_STATUSES.map(status => ({ label: t(`ownerWallet.charges.status.${status}`), value: status })),
])

const esMesEnCurso = computed(() => props.mes >= props.mesEnCurso)
const etiqueta = computed(() => esMesEnCurso.value
  ? t('collections.currentMonth', { month: formatearMes(props.mes, idioma.value) })
  : formatearMes(props.mes, idioma.value))

function cambiar(cambios: Partial<FiltroDeTablero>) {
  emit('update:filtro', { ...props.filtro, ...cambios })
}
</script>

<template>
  <div
    class="flex flex-wrap items-end gap-4 rounded-2xl border border-default bg-default p-4"
    data-test="filtros-del-tablero"
  >
    <UFormField :label="t('collections.month')">
      <div class="flex items-center gap-2">
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-chevron-left"
          :aria-label="t('collections.previousMonth')"
          data-test="mes-anterior"
          @click="emit('update:mes', mesAnterior(mes))"
        />
        <span
          class="min-w-32 text-center text-sm"
          :class="esMesEnCurso ? 'text-muted' : 'font-medium text-highlighted'"
          data-test="mes-actual"
        >{{ etiqueta }}</span>
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-chevron-right"
          :aria-label="t('collections.nextMonth')"
          :disabled="esMesEnCurso"
          data-test="mes-siguiente"
          @click="emit('update:mes', mesSiguiente(mes))"
        />
      </div>
    </UFormField>

    <UFormField
      :label="t('collections.filters.nature')"
      class="min-w-48"
    >
      <USelect
        :model-value="filtro.nature ?? TODOS"
        :items="naturalezas"
        class="w-full"
        data-test="filtro-naturaleza"
        @update:model-value="cambiar({ nature: $event === TODOS ? null : $event as NaturalezaDeFila })"
      />
    </UFormField>

    <UFormField
      :label="t('collections.filters.status')"
      class="min-w-48"
    >
      <USelect
        :model-value="filtro.status ?? TODOS"
        :items="estados"
        class="w-full"
        data-test="filtro-estado"
        @update:model-value="cambiar({ status: $event === TODOS ? null : $event as ChargeStatus })"
      />
    </UFormField>

    <UButton
      variant="ghost"
      color="neutral"
      icon="i-lucide-x"
      :label="t('collections.filters.clear')"
      data-test="filtro-limpiar"
      @click="emit('update:filtro', filtroDeTableroVacio())"
    />
  </div>
</template>
