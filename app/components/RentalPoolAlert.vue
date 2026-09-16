<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { SemanaPorColocar } from '~/composables/useSemanasPorColocar'

/**
 * HU-21 · RF-21.1b · D-43 — las semanas que siguen esperando tercero, como alerta
 * del día a día del Administrador.
 *
 * Van por cercanía de su entrada, porque lo que urge colocar es lo que primero se
 * va a perder. Las liberadas voluntariamente se marcan: su renta no es de la
 * propiedad sino de la fracción que las soltó (D-39), y eso cambia a quién se le
 * responde si nadie las coloca.
 */
const props = withDefaults(defineProps<{
  semanas: SemanaPorColocar[]
  /** Cuántas se listan antes de resumir el resto. */
  tope?: number
}>(), { tope: 5 })

const { t, locale } = useI18n()
const localePath = useLocalePath()

const idioma = computed(() => locale.value as Idioma)
const visibles = computed(() => props.semanas.slice(0, props.tope))
const resto = computed(() => Math.max(0, props.semanas.length - props.tope))

function destino(semana: SemanaPorColocar): string {
  return semana.attributable
    ? t('rentals.origin.attributed', { fraction: semana.originFraction ?? '' })
    : t('rentals.origin.prorated')
}
</script>

<template>
  <div
    class="rounded-2xl border border-default p-4"
    data-test="alerta-por-colocar"
  >
    <p
      v-if="semanas.length === 0"
      class="text-sm text-muted"
      data-test="por-colocar-vacia"
    >
      {{ t('rentals.pool.alertEmpty') }}
    </p>

    <ul
      v-else
      class="space-y-3"
    >
      <li
        v-for="semana in visibles"
        :key="`${semana.propertyId}-${semana.year}-${semana.week}`"
        class="flex flex-wrap items-center gap-3"
        :data-test="`por-colocar-${semana.week}`"
      >
        <UIcon
          name="i-lucide-hand-coins"
          class="size-5 shrink-0 text-warning"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm text-highlighted">
            {{ t('rentals.pool.alertLine', {
              property: semana.propertyName,
              week: semana.week,
              from: formatearDia(semana.startsOn, idioma),
            }) }}
          </p>
          <p
            class="text-xs"
            :class="semana.attributable ? 'text-warning' : 'text-muted'"
          >
            {{ destino(semana) }}
          </p>
        </div>
        <UButton
          variant="ghost"
          size="xs"
          icon="i-lucide-key-round"
          :label="t('rentals.rent')"
          :to="localePath(`/panel/rentas/${semana.propertyId}?anio=${semana.year}`)"
          :data-test="`colocar-${semana.week}`"
        />
      </li>

      <li
        v-if="resto > 0"
        class="text-xs text-muted"
        data-test="por-colocar-resto"
      >
        {{ t('rentals.pool.summary', { n: resto }) }}
      </li>
    </ul>
  </div>
</template>
