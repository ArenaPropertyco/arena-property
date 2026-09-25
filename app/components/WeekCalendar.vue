<script setup lang="ts">
import { regionDe } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { WeekCell } from '#shared/scheduling/week-projection'
import type { UsageContext } from '#shared/scheduling/week-usage'

/**
 * HU-13 · RF-13.2, RF-13.3 · HU-14 · RF-14.1, RF-14.6, RF-14.7 · RT-06 — el año
 * por semanas en lista vertical, agrupado por mes de entrada.
 *
 * Cada semana llega ya proyectada y se pinta con `WeekCard`, que es quien ofrece
 * confirmar, cancelar o liberar. En solo lectura (D-31) nada responde. En
 * `gestion` es el tablero del Administrador (HU-14): cada semana dice de qué
 * fracción es y las acciones valen sobre cualquiera con dueño.
 */
const props = withDefaults(defineProps<{
  cells: WeekCell[]
  context: UsageContext | null
  readOnly?: boolean
  busyWeek?: number | null
  gestion?: boolean
}>(), { readOnly: false, busyWeek: null, gestion: false })

const emit = defineEmits<{
  confirm: [number]
  cancel: [number]
  release: [number]
}>()

const { locale } = useI18n()

const meses = computed(() => {
  const formato = new Intl.DateTimeFormat(regionDe(locale.value as Idioma), { month: 'long', timeZone: 'UTC' })
  const grupos = new Map<string, WeekCell[]>()
  for (const cell of props.cells) {
    const clave = cell.startsOn.slice(0, 7)
    grupos.set(clave, [...(grupos.get(clave) ?? []), cell])
  }
  return [...grupos.entries()].map(([clave, cells]) => ({ clave, nombre: formato.format(new Date(`${clave}-01T00:00:00Z`)), cells }))
})
</script>

<template>
  <div
    class="space-y-6"
    data-test="calendario-semanas"
  >
    <section
      v-for="mes in meses"
      :key="mes.clave"
      :data-test="`mes-${mes.clave}`"
    >
      <h3 class="mb-2 font-serif text-lg capitalize text-highlighted">
        {{ mes.nombre }}
      </h3>
      <ul class="space-y-2">
        <li
          v-for="cell in mes.cells"
          :key="cell.week"
        >
          <WeekCard
            :cell="cell"
            :context="context"
            :read-only="readOnly"
            :busy-week="busyWeek"
            :gestion="gestion"
            @confirm="emit('confirm', $event)"
            @cancel="emit('cancel', $event)"
            @release="emit('release', $event)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
