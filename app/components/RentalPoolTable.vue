<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { SemanaDeLaBolsa } from '#shared/scheduling/bolsa'

/**
 * HU-17 · RF-17.5 · HU-39 · RF-39.6 · D-39, D-43 — la bolsa de renta del
 * Administrador: qué semanas puede colocar y por qué están ahí.
 *
 * Las dos columnas que importan no son la fecha sino el **origen** y el **destino
 * del ingreso**: una semana liberada voluntariamente paga a la fracción que la
 * soltó, y una caducada se reparte entre las ocho. En pantalla son idénticas, así
 * que la diferencia se dice con todas las letras antes de rentar, no después en el
 * estado de cuenta.
 */
const props = defineProps<{
  semanas: SemanaDeLaBolsa[]
  puedeGestionar: boolean
}>()

defineEmits<{ rentar: [number] }>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

function origen(semana: SemanaDeLaBolsa): string {
  return t(`rentals.origin.${semana.originReason}`, { fraction: semana.originFraction ?? '' })
}

/** RF-17.5 · adónde irá el dinero si esta semana se coloca. */
function destino(semana: SemanaDeLaBolsa): string {
  return semana.attributable
    ? t('rentals.origin.attributed', { fraction: semana.originFraction ?? '' })
    : t('rentals.origin.prorated')
}

const columnas = computed<TableColumn<SemanaDeLaBolsa>[]>(() => [
  { id: 'semana', header: t('rentals.columns.week') },
  { id: 'temporada', header: t('rentals.columns.season') },
  { id: 'origen', header: t('rentals.columns.origin') },
  { id: 'acciones', header: '' },
])

const hay = computed(() => props.semanas.length > 0)
</script>

<template>
  <div class="space-y-3">
    <p
      class="text-sm text-muted"
      data-test="bolsa-resumen"
    >
      {{ hay ? t('rentals.pool.summary', { n: semanas.length }) : t('rentals.pool.empty') }}
    </p>

    <div
      v-if="hay"
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="semanas"
        :columns="columnas"
        data-test="tabla-bolsa"
      >
        <template #semana-cell="{ row }">
          <div class="flex flex-col whitespace-nowrap">
            <span class="font-mono">{{ row.original.week }}</span>
            <span class="text-xs text-muted">
              {{ t('calendar.weekRange', {
                from: formatearDia(row.original.startsOn, idioma),
                to: formatearDia(row.original.endsOn, idioma),
              }) }}
            </span>
          </div>
        </template>

        <template #temporada-cell="{ row }">
          <UBadge
            v-if="row.original.season"
            variant="subtle"
            size="sm"
            :label="t(`calendar.seasons.${row.original.season}`)"
          />
        </template>

        <template #origen-cell="{ row }">
          <div class="flex flex-col">
            <span :data-test="`bolsa-origen-${row.original.week}`">{{ origen(row.original) }}</span>
            <span
              class="text-xs"
              :class="row.original.attributable ? 'text-warning' : 'text-muted'"
              :data-test="`bolsa-destino-${row.original.week}`"
            >{{ destino(row.original) }}</span>
          </div>
        </template>

        <template #acciones-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              v-if="puedeGestionar"
              variant="ghost"
              size="xs"
              icon="i-lucide-key-round"
              :label="t('rentals.rent')"
              :data-test="`rentar-${row.original.week}`"
              @click="$emit('rentar', row.original.week)"
            />
          </div>
        </template>
      </UTable>
    </div>
  </div>
</template>
