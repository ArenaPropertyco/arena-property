<script setup lang="ts">
import { CUPO_PUBLICADO, TEMPORADAS_PUBLICADAS } from '#shared/content/agendamiento'
import type { SeccionDePagina } from '#shared/content/manifiesto'

/**
 * HU-43 · RF-43.1, RF-43.4 · D-33 — la tabla de temporadas con el cupo por
 * fracción, derivada del criterio de HU-12. La estadía mínima es la semana
 * completa: la página no promete noches sueltas que el motor no reparte.
 */
defineProps<{ seccion: SeccionDePagina }>()

const { t } = useI18n()
</script>

<template>
  <UPageSection
    :headline="t('scheduling.seasons.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('scheduling.seasons.description')"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-temporadas"
  >
    <div class="mx-auto max-w-3xl overflow-x-auto rounded-2xl border border-default bg-default">
      <table
        class="w-full min-w-[20rem] text-left text-sm"
        data-test="tabla-temporadas"
      >
        <thead class="bg-elevated/50 text-xs uppercase tracking-[0.2em] text-muted">
          <tr>
            <th class="px-5 py-3 font-semibold">
              {{ t('scheduling.seasons.columns.season') }}
            </th>
            <th class="px-5 py-3 text-right font-semibold">
              {{ t('scheduling.seasons.columns.weeks') }}
            </th>
            <th class="px-5 py-3 text-right font-semibold">
              {{ t('scheduling.seasons.columns.nights') }}
            </th>
            <th class="px-5 py-3 text-right font-semibold">
              {{ t('scheduling.seasons.columns.minimum') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="temporada in TEMPORADAS_PUBLICADAS"
            :key="temporada.id"
            :data-test="`temporada-${temporada.id}`"
          >
            <td class="px-5 py-3 font-display text-lg text-highlighted">
              {{ t(`scheduling.seasons.names.${temporada.id}`) }}
            </td>
            <td class="px-5 py-3 text-right font-mono">
              {{ temporada.semanas }}
            </td>
            <td
              class="px-5 py-3 text-right font-mono"
              :data-test="`noches-${temporada.id}`"
            >
              {{ temporada.noches }}
            </td>
            <td class="px-5 py-3 text-right text-muted">
              {{ t('scheduling.seasons.wholeWeek') }}
            </td>
          </tr>
        </tbody>
        <tfoot class="border-t border-default bg-elevated/30">
          <tr data-test="temporadas-total">
            <td class="px-5 py-3 font-semibold uppercase tracking-[0.2em] text-xs text-muted">
              {{ t('scheduling.seasons.total') }}
            </td>
            <td class="px-5 py-3 text-right font-mono text-primary">
              {{ CUPO_PUBLICADO.semanas }}
            </td>
            <td
              class="px-5 py-3 text-right font-mono text-primary"
              data-test="noches-total"
            >
              {{ CUPO_PUBLICADO.noches }}
            </td>
            <td class="px-5 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  </UPageSection>
</template>
