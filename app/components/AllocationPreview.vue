<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { SemanaDeRejilla } from '#shared/scheduling/rejilla'
import type { Reparto } from '#shared/scheduling/reparto'
import { TEMPORADAS } from '#shared/scheduling/temporadas'

/**
 * HU-12 · RF-12.3 — lo que el motor va a publicar: semanas y cupo por fracción,
 * bloques pico y bolsa del Administrador. Si la rejilla es imposible, el error
 * explicativo ocupa el lugar del reparto (CA-12.7).
 */
const props = defineProps<{
  reparto: Reparto | null
  error: string | null
  rejilla: SemanaDeRejilla[]
}>()

const { t, locale } = useI18n()

const porIndice = computed(() => new Map(props.rejilla.map(s => [s.indice, s])))

function inicioDe(indice: number): string {
  const semana = porIndice.value.get(indice)
  return semana ? formatearDia(semana.inicio, locale.value as Idioma) : String(indice + 1)
}

function cupoDe(cupo: Record<string, number>): string {
  return TEMPORADAS.map(temporada => cupo[temporada]).join(' · ')
}
</script>

<template>
  <div
    class="space-y-4"
    data-test="vista-reparto"
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('calendar.impossible')"
      :description="error"
      data-test="reparto-imposible"
    />

    <template v-else-if="reparto">
      <div class="overflow-x-auto rounded-2xl border border-default">
        <table class="w-full text-sm">
          <thead class="bg-elevated/50 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-3 py-2">
                {{ t('calendar.fraction') }}
              </th>
              <th class="px-3 py-2">
                {{ t('calendar.position') }}
              </th>
              <th class="px-3 py-2">
                {{ t('calendar.weeks') }}
              </th>
              <th class="px-3 py-2">
                {{ t('calendar.quota') }}
              </th>
              <th class="px-3 py-2">
                {{ t('calendar.peak') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="asignacion in reparto.asignaciones"
              :key="asignacion.fraccion"
              class="border-t border-default"
              :data-test="`reparto-fraccion-${asignacion.fraccion}`"
            >
              <td class="px-3 py-2 font-mono">
                {{ t('calendar.fractionLabel', { n: asignacion.fraccion }) }}
              </td>
              <td class="px-3 py-2 font-mono">
                {{ asignacion.posicion + 1 }}
              </td>
              <td class="px-3 py-2">
                <div class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="indice in asignacion.semanas"
                    :key="indice"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    :label="inicioDe(indice)"
                  />
                </div>
              </td>
              <td class="px-3 py-2 font-mono">
                {{ cupoDe(asignacion.cupo) }}
              </td>
              <td class="px-3 py-2">
                <UBadge
                  v-for="bloque in asignacion.bloquesPico"
                  :key="bloque"
                  color="error"
                  variant="subtle"
                  size="sm"
                  icon="i-lucide-star"
                  :label="t(`calendar.peaks.${bloque}`)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p
        class="text-sm text-muted"
        data-test="bolsa-administrador"
      >
        <span class="font-medium text-default">{{ t('calendar.pool') }}:</span>
        {{ t('calendar.poolHint', { count: reparto.bolsaDelAdministrador.length }) }}
        <span class="ml-1 font-mono">{{ reparto.bolsaDelAdministrador.map(i => inicioDe(i)).join(', ') }}</span>
      </p>
    </template>
  </div>
</template>
