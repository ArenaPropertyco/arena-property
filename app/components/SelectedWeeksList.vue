<script setup lang="ts">
import type { AccordionItem } from '@nuxt/ui'
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { SemanaDeRejilla } from '#shared/scheduling/rejilla'
import type { AllocationEntry } from '#shared/scheduling/swaps'
import type { Temporada } from '#shared/scheduling/temporadas'

/**
 * HU-12 · RF-12.3 · D-32 — qué semanas eligió cada fracción, con su fecha y su
 * temporada, agrupadas en un acordeón: un panel por fracción, para que el
 * Administrador y el Superadmin revisen el año sin perder la vista general.
 */
const props = defineProps<{
  allocations: AllocationEntry[]
  rejilla: SemanaDeRejilla[]
  fractions: { number: number, ownerName: string | null }[]
}>()

const { t, locale } = useI18n()

const COLOR: Record<Temporada, 'error' | 'warning' | 'primary' | 'neutral'> = {
  alta: 'error',
  media_alta: 'warning',
  media: 'primary',
  baja: 'neutral',
}

interface GrupoDeFraccion {
  fraction: number
  ownerName: string | null
  weeks: AllocationEntry[]
}

const porFraccion = computed<GrupoDeFraccion[]>(() => {
  const grupos = new Map<number, AllocationEntry[]>()
  for (const entry of props.allocations) {
    grupos.set(entry.fraction, [...(grupos.get(entry.fraction) ?? []), entry])
  }
  return [...grupos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([fraction, weeks]) => ({
      fraction,
      ownerName: props.fractions.find(f => f.number === fraction)?.ownerName ?? null,
      weeks: [...weeks].sort((a, b) => a.week - b.week),
    }))
})

/** Un panel por fracción; el valor es el número, con el que el cuerpo recupera sus semanas. */
const items = computed<AccordionItem[]>(() => porFraccion.value.map(grupo => ({
  value: String(grupo.fraction),
  label: grupo.ownerName
    ? `${t('calendar.fractionLabel', { n: grupo.fraction })} · ${grupo.ownerName}`
    : t('calendar.fractionLabel', { n: grupo.fraction }),
  icon: 'i-lucide-calendar-check',
  trailingIcon: 'i-lucide-chevron-down',
})))

function grupoDe(valor: string | undefined): GrupoDeFraccion | undefined {
  return porFraccion.value.find(g => String(g.fraction) === valor)
}

function rangeOf(index: number): string {
  const week = props.rejilla.find(s => s.indice === index)
  if (!week) {
    return String(index + 1)
  }
  const idioma = locale.value as Idioma
  return t('calendar.weekRange', { from: formatearDia(week.inicio, idioma), to: formatearDia(week.noches[6]!, idioma) })
}
</script>

<template>
  <div data-test="semanas-elegidas">
    <p
      v-if="items.length === 0"
      class="text-sm text-muted"
      data-test="sin-elegidas"
    >
      {{ t('calendar.selection.chosenEmpty') }}
    </p>

    <UAccordion
      v-else
      type="multiple"
      :items="items"
      class="rounded-2xl border border-default bg-default px-4"
    >
      <template #default="{ item }">
        <span
          class="flex flex-wrap items-baseline gap-2 text-sm"
          :data-test="`elegidas-${item.value}`"
        >
          <span class="font-mono text-highlighted">{{ t('calendar.fractionLabel', { n: grupoDe(item.value)?.fraction ?? '' }) }}</span>
          <span class="text-muted">{{ grupoDe(item.value)?.ownerName ?? '' }}</span>
          <span class="font-mono text-xs text-muted">{{ t('calendar.weeks.weeksCount', { n: grupoDe(item.value)?.weeks.length ?? 0 }) }}</span>
        </span>
      </template>

      <template #body="{ item }">
        <ul
          class="flex flex-wrap gap-2 pb-2"
          :data-test="`panel-elegidas-${item.value}`"
        >
          <li
            v-for="entry in grupoDe(item.value)?.weeks ?? []"
            :key="entry.week"
            :data-test="`semana-elegida-${entry.fraction}-${entry.week}`"
          >
            <UBadge
              :color="COLOR[entry.season]"
              variant="subtle"
              size="sm"
              :label="`${t('calendar.week', { n: entry.week + 1 })} · ${rangeOf(entry.week)} · ${t(`calendar.seasons.${entry.season}`)}`"
            />
          </li>
        </ul>
      </template>
    </UAccordion>
  </div>
</template>
