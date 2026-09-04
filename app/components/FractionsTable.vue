<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import type { EstadoDeFraccion } from '#shared/properties/fracciones'
import { TRANSICIONES_DE_FRACCION, TRANSICIONES_DE_SUPERADMIN } from '#shared/properties/fracciones'
import type { FraccionListada } from '#shared/properties/vistas'
import { puedeInvitarse } from '#shared/purchases/invitaciones'

/**
 * HU-09 · RF-09.1, RF-09.2, RF-09.5 — las 8 fracciones de una propiedad.
 *
 * Qué acción se ofrece sobre cada fracción sale de las mismas tablas de transición
 * que valida el dominio y hace cumplir la base, más el privilegio del Superadmin
 * (D-17, D-31). No hay botón que la base vaya a rechazar.
 *
 * El interruptor de calendario se muestra pero no se edita: lo deriva el plan de
 * pagos (D-31), y ofrecerlo aquí sería mentir sobre quién manda.
 */
const props = defineProps<{
  fracciones: FraccionListada[]
  puedeGestionar: boolean
  esSuperadmin: boolean
}>()

defineEmits<{
  transicion: [{ id: string, estado: EstadoDeFraccion }]
  traspasar: [string]
  /** HU-06 · RF-06.1 · invitar a un comprador a esta fracción. */
  invitar: [string]
  /** HU-58 · abrir el plan de pagos de la fracción vendida. */
  abrirPlan: [string]
}>()

const { t, locale } = useI18n()

const ETIQUETA_DE_ACCION: Record<EstadoDeFraccion, string> = {
  available: 'properties.fractions.release',
  reserved: 'properties.fractions.reserve',
  sold: 'properties.fractions.sell',
}

/** Destinos válidos desde el estado actual, con y sin privilegio de Superadmin. */
function destinosDe(fraccion: FraccionListada): EstadoDeFraccion[] {
  if (!props.puedeGestionar) {
    return []
  }

  const normales = TRANSICIONES_DE_FRACCION[fraccion.status]
  const extra = props.esSuperadmin ? (TRANSICIONES_DE_SUPERADMIN[fraccion.status] ?? []) : []

  return [...normales, ...extra]
}

/** RF-06.1 · RF-06.5 · se invita sobre disponible o reservada; sobre vendida, nunca. */
function puedeInvitar(fraccion: FraccionListada): boolean {
  return props.puedeGestionar && puedeInvitarse(fraccion.status)
}

/** D-17 · el traspaso solo existe sobre una fracción vendida y solo para el Superadmin. */
function puedeTraspasar(fraccion: FraccionListada): boolean {
  return props.puedeGestionar && props.esSuperadmin && fraccion.status === 'sold'
}

function precio(fraccion: FraccionListada): string {
  return formatearImporte(pesos(fraccion.listPrice), locale.value as Idioma)
}

const COLOR_DE_ESTADO = {
  available: 'primary',
  reserved: 'warning',
  sold: 'neutral',
} as const

const columnas = computed<TableColumn<FraccionListada>[]>(() => [
  { id: 'numero', header: t('properties.fractions.number') },
  { id: 'precio', header: t('properties.fractions.price') },
  { id: 'estado', header: t('properties.fractions.status') },
  { id: 'titular', header: t('properties.fractions.owner') },
  { id: 'calendario', header: t('properties.fractions.calendar') },
  { id: 'acciones', header: '' },
])
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default">
    <UTable
      :data="fracciones"
      :columns="columnas"
      :empty="t('properties.fractions.empty')"
      data-test="tabla-fracciones"
    >
      <template #numero-cell="{ row }">
        <span class="font-mono">{{ t('properties.fractions.label', { number: row.original.number }) }}</span>
      </template>

      <template #precio-cell="{ row }">
        <span
          class="font-mono"
          :data-test="`precio-fraccion-${row.original.number}`"
        >
          {{ precio(row.original) }}
        </span>
      </template>

      <template #estado-cell="{ row }">
        <UBadge
          :color="COLOR_DE_ESTADO[row.original.status]"
          variant="subtle"
          size="sm"
          :label="t(`properties.fractions.${row.original.status}`)"
        />
      </template>

      <template #titular-cell="{ row }">
        <span
          v-if="!row.original.ownerLabel"
          class="text-muted"
        >
          {{ t('properties.fractions.noOwner') }}
        </span>
        <span v-else>{{ row.original.ownerLabel }}</span>
      </template>

      <template #calendario-cell="{ row }">
        <span
          class="text-sm"
          :class="row.original.calendarActive ? 'text-success' : 'text-muted'"
          :title="t('properties.fractions.calendarHint')"
          :data-test="`calendario-fraccion-${row.original.number}`"
        >
          {{ row.original.calendarActive
            ? t('properties.fractions.calendarActive')
            : t('properties.fractions.calendarInactive') }}
        </span>
      </template>

      <template #acciones-cell="{ row }">
        <div class="flex flex-wrap justify-end gap-1">
          <UButton
            v-for="destino in destinosDe(row.original)"
            :key="destino"
            variant="ghost"
            size="xs"
            :data-test="`fraccion-${row.original.number}-${destino}`"
            :label="t(destino === 'available' && row.original.status === 'sold'
              ? 'properties.fractions.returnToAvailable'
              : ETIQUETA_DE_ACCION[destino])"
            @click="$emit('transicion', { id: row.original.id, estado: destino })"
          />

          <UButton
            v-if="puedeInvitar(row.original)"
            variant="ghost"
            size="xs"
            icon="i-lucide-mail-plus"
            :data-test="`fraccion-${row.original.number}-invitar`"
            :label="t('properties.fractions.invite')"
            @click="$emit('invitar', row.original.id)"
          />

          <UButton
            v-if="row.original.planId"
            variant="ghost"
            size="xs"
            icon="i-lucide-receipt"
            :data-test="`fraccion-${row.original.number}-plan`"
            :label="t('properties.fractions.plan')"
            @click="$emit('abrirPlan', row.original.planId)"
          />

          <UButton
            v-if="puedeTraspasar(row.original)"
            variant="ghost"
            size="xs"
            icon="i-lucide-repeat"
            :data-test="`fraccion-${row.original.number}-traspaso`"
            :label="t('properties.fractions.transfer')"
            @click="$emit('traspasar', row.original.id)"
          />
        </div>
      </template>
    </UTable>
  </div>
</template>
