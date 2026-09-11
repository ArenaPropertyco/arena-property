<script setup lang="ts">
import { CUPO_DE_LA_HOME, IMAGENES_DE_LA_HOME, TEMPORADAS_DE_LA_HOME } from '#shared/content/home'
import type { SeccionDeLaHome } from '#shared/content/home'

/**
 * HU-00 · RF-00.9 · CA-00.6 · D-33 · D-38 — «¿Cómo es el modelo de
 * agendamiento?»: seis semanas al año por fracción, 42 noches, con la misma
 * tabla que publica HU-43 (derivada del criterio de HU-12) y el botón al detalle.
 * La estadía mínima es la semana completa: la home no promete noches sueltas
 * que el motor no reparte.
 */
defineProps<{ seccion: SeccionDeLaHome }>()
const emit = defineEmits<{ cta: [SeccionDeLaHome] }>()

const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <UPageSection
    :headline="t('home.scheduling.headline')"
    :title="t(seccion.tituloKey)"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-agendamiento"
  >
    <div class="grid gap-10 lg:grid-cols-5 lg:items-center">
      <div class="space-y-6 lg:col-span-3">
        <p class="max-w-2xl text-base leading-relaxed text-default">
          {{ t('home.scheduling.description') }}
        </p>

        <div class="overflow-x-auto rounded-2xl border border-default bg-default">
          <table
            class="w-full min-w-[20rem] text-left text-sm"
            data-test="tabla-temporadas-home"
          >
            <thead class="bg-elevated/50 text-xs uppercase tracking-[0.2em] text-muted">
              <tr>
                <th class="px-5 py-3 font-semibold">
                  {{ t('home.scheduling.columns.season') }}
                </th>
                <th class="px-5 py-3 text-right font-semibold">
                  {{ t('home.scheduling.columns.weeks') }}
                </th>
                <th class="px-5 py-3 text-right font-semibold">
                  {{ t('home.scheduling.columns.nights') }}
                </th>
                <th class="px-5 py-3 text-right font-semibold">
                  {{ t('home.scheduling.columns.minimum') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="temporada in TEMPORADAS_DE_LA_HOME"
                :key="temporada.id"
                class="transition-colors duration-200 hover:bg-elevated/40"
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
                  {{ t('home.scheduling.wholeWeek') }}
                </td>
              </tr>
            </tbody>
            <tfoot class="border-t border-default bg-elevated/30">
              <tr data-test="temporadas-total">
                <td class="px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  {{ t('home.scheduling.total') }}
                </td>
                <td class="px-5 py-3 text-right font-mono text-primary">
                  {{ CUPO_DE_LA_HOME.semanas }}
                </td>
                <td
                  class="px-5 py-3 text-right font-mono text-primary"
                  data-test="noches-total"
                >
                  {{ CUPO_DE_LA_HOME.noches }}
                </td>
                <td class="px-5 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>

        <div v-if="seccion.cta">
          <UButton
            size="lg"
            variant="outline"
            :to="localePath(seccion.cta.destino)"
            :label="t(seccion.cta.labelKey)"
            trailing-icon="i-lucide-arrow-right"
            :data-test="`cta-${seccion.id}`"
            @click="emit('cta', seccion)"
          />
        </div>
      </div>

      <figure class="group overflow-hidden rounded-2xl lg:col-span-2">
        <NuxtImg
          :src="IMAGENES_DE_LA_HOME.scheduling"
          :alt="t(seccion.tituloKey)"
          class="aspect-[4/5] w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-105"
          sizes="100vw sm:60vw lg:40vw"
          loading="lazy"
        />
      </figure>
    </div>
  </UPageSection>
</template>
