<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import { regionDe } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { mesesDelAlmanaque } from '#shared/scheduling/almanaque'
import type { WeekCell } from '#shared/scheduling/week-projection'
import type { UsageContext } from '#shared/scheduling/week-usage'
import { CLASS_BY_CELL_TYPE } from '~/utils/weeks'

/**
 * HU-13 · RF-13.2, RF-13.3 · HU-14 · RF-14.1 · RT-06 — el año como almanaque:
 * doce meses de lunes a domingo, cada día teñido con el tipo de la semana en que
 * cae. Tocar un día elige su semana: sus siete días quedan resaltados y la misma
 * tarjeta de la lista vertical, con su información y sus acciones, se abre en
 * una ventana emergente, que en móvil y en escritorio se lee sin buscarla.
 *
 * Las noches fuera de la rejilla (D-42) no se tiñen ni se eligen: son de la
 * bolsa del Administrador y no forman semana.
 */
const props = withDefaults(defineProps<{
  anio: number
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

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const meses = computed(() => {
  const formato = new Intl.DateTimeFormat(regionDe(idioma.value), { month: 'long', timeZone: 'UTC' })
  return mesesDelAlmanaque(props.anio, props.cells).map(mes => ({
    ...mes,
    nombre: formato.format(new Date(`${mes.clave}-01T00:00:00Z`)),
  }))
})

/** Iniciales de lunes a domingo en el idioma de quien mira (5 al 11 de enero de 2026 empieza en lunes). */
const diasDeLaSemana = computed(() => {
  const formato = new Intl.DateTimeFormat(regionDe(idioma.value), { weekday: 'narrow', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, i) => formato.format(new Date(Date.UTC(2026, 0, 5 + i))))
})

const porSemana = computed(() => new Map(props.cells.map(cell => [cell.week, cell])))

/** La semana elegida; se olvida al cambiar de año o de calendario. */
const seleccionada = ref<number | null>(null)
watch(() => [props.anio, props.cells], () => {
  seleccionada.value = null
})

const celdaSeleccionada = computed(() => seleccionada.value === null ? null : porSemana.value.get(seleccionada.value) ?? null)

/** La ventana vive mientras haya semana elegida; cerrarla la suelta. */
const abierta = computed({
  get: () => celdaSeleccionada.value !== null,
  set: (valor: boolean) => {
    if (!valor) {
      seleccionada.value = null
    }
  },
})

const tituloDeLaVentana = computed(() => celdaSeleccionada.value
  ? `${t('calendar.weeks.week', { n: celdaSeleccionada.value.week + 1 })} · ${t('calendar.weekRange', { from: formatearDia(celdaSeleccionada.value.startsOn, idioma.value), to: formatearDia(celdaSeleccionada.value.endsOn, idioma.value) })}`
  : '')

/** RF-14.7b · liberar abre su propio aviso en la página: esta ventana se cierra antes. */
function liberar(week: number) {
  seleccionada.value = null
  emit('release', week)
}

function elegir(semana: number | null) {
  if (semana !== null) {
    seleccionada.value = seleccionada.value === semana ? null : semana
  }
}

function claseDelDia(semana: number | null): string {
  const cell = semana === null ? null : porSemana.value.get(semana)
  if (!cell) {
    return 'text-dimmed'
  }
  const resaltada = semana === seleccionada.value ? 'ring-2 ring-primary ring-inset font-semibold' : ''
  return `${CLASS_BY_CELL_TYPE[cell.type]} text-default cursor-pointer hover:brightness-95 ${resaltada}`
}
</script>

<template>
  <div
    class="space-y-6"
    data-test="almanaque"
  >
    <p class="text-xs text-muted">
      {{ t('calendar.view.almanacHint') }}
    </p>

    <div class="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <section
        v-for="mes in meses"
        :key="mes.clave"
        :data-test="`almanaque-${mes.clave}`"
      >
        <h3 class="mb-2 text-center font-serif text-lg capitalize text-highlighted">
          {{ mes.nombre }}
        </h3>
        <div
          class="almanaque-mes gap-1 text-center text-xs"
          role="grid"
        >
          <span
            v-for="(inicial, i) in diasDeLaSemana"
            :key="i"
            class="rounded-md bg-elevated py-1 font-mono uppercase text-muted"
            role="columnheader"
          >{{ inicial }}</span>
          <span
            v-for="hueco in mes.huecos"
            :key="`hueco-${hueco}`"
            aria-hidden="true"
          />
          <button
            v-for="dia in mes.dias"
            :key="dia.dia"
            type="button"
            class="aspect-square rounded-md border border-transparent font-mono tabular-nums transition"
            :class="claseDelDia(dia.semana)"
            :disabled="dia.semana === null"
            :aria-pressed="dia.semana !== null && dia.semana === seleccionada"
            :aria-label="dia.semana === null ? undefined : t('calendar.weeks.week', { n: dia.semana + 1 })"
            :data-test="`dia-${dia.dia}`"
            :data-semana="dia.semana ?? undefined"
            :data-tipo="dia.semana === null ? undefined : porSemana.get(dia.semana)?.type"
            @click="elegir(dia.semana)"
          >
            {{ dia.numero }}
          </button>
        </div>
      </section>
    </div>

    <UModal
      v-model:open="abierta"
      :title="tituloDeLaVentana"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div
          v-if="celdaSeleccionada"
          data-test="semana-elegida"
        >
          <WeekCard
            :cell="celdaSeleccionada"
            :context="context"
            :read-only="readOnly"
            :busy-week="busyWeek"
            :gestion="gestion"
            @confirm="emit('confirm', $event)"
            @cancel="emit('cancel', $event)"
            @release="liberar"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
/* Siete columnas siempre: a 320 px cada día mide unos 36 px y el mes cabe entero. */
.almanaque-mes {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}
</style>
