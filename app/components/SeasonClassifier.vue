<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import { CRITERIO_POR_DEFECTO, semanasNecesarias } from '#shared/scheduling/criterio'
import type { SemanaDeRejilla } from '#shared/scheduling/rejilla'
import { BLOQUES_PICO, sugerirBloquesPico, TEMPORADAS } from '#shared/scheduling/temporadas'
import type { BloquePico, SemanaClasificada, Temporada } from '#shared/scheduling/temporadas'

/**
 * HU-12 · RF-12.2 · schedule.md P-05, P-06 — el Administrador clasifica cada
 * semana de la rejilla y marca los bloques pico dentro de la alta.
 *
 * Controlado: recibe la clasificación y emite la clasificación completa con cada
 * cambio; el resumen por temporada compara con lo que exige el criterio. Los
 * botones por semana, y no un desplegable, dejan ver el año entero de un vistazo.
 */
const props = withDefaults(defineProps<{
  rejilla: SemanaDeRejilla[]
  clasificacion: SemanaClasificada[]
  editable: boolean
  anio?: number
}>(), { anio: undefined })

const emit = defineEmits<{ 'update:clasificacion': [SemanaClasificada[]] }>()

const { t, locale } = useI18n()

const porIndice = computed(() => new Map(props.clasificacion.map(s => [s.indice, s])))
const necesarias = semanasNecesarias(CRITERIO_POR_DEFECTO)

const resumen = computed(() => TEMPORADAS.map(temporada => ({
  temporada,
  disponibles: props.clasificacion.filter(s => s.temporada === temporada).length,
  necesarias: necesarias[temporada],
})))

const COLOR: Record<Temporada, 'error' | 'warning' | 'primary' | 'neutral'> = {
  alta: 'error',
  media_alta: 'warning',
  media: 'primary',
  baja: 'neutral',
}

function semanaDe(indice: number): SemanaClasificada {
  return porIndice.value.get(indice) ?? { indice, temporada: 'baja', bloquePico: null }
}

function emitirCon(indice: number, cambios: Partial<SemanaClasificada>) {
  const actual = semanaDe(indice)
  const nueva = { ...actual, ...cambios }
  const resto = props.clasificacion.filter(s => s.indice !== indice)
  emit('update:clasificacion', [...resto, nueva].sort((a, b) => a.indice - b.indice))
}

function clasificar(indice: number, temporada: Temporada) {
  // Bajar de alta retira el bloque pico: solo cabe en alta (P-06).
  emitirCon(indice, { temporada, bloquePico: temporada === 'alta' ? semanaDe(indice).bloquePico : null })
}

function marcarPico(indice: number, bloque: BloquePico) {
  const actual = semanaDe(indice)
  // Un bloque vive en una sola semana: se retira de donde estuviera.
  const limpia = props.clasificacion.map(s => s.bloquePico === bloque && s.indice !== indice ? { ...s, bloquePico: null } : s)
  const resto = limpia.filter(s => s.indice !== indice)
  const nueva = { ...actual, temporada: 'alta' as const, bloquePico: actual.bloquePico === bloque ? null : bloque }
  emit('update:clasificacion', [...resto, nueva].sort((a, b) => a.indice - b.indice))
}

function sugerir() {
  const anio = props.anio ?? Number(props.rejilla[0]?.inicio.slice(0, 4))
  const picos = sugerirBloquesPico(anio, props.rejilla)
  const nueva = props.clasificacion.map((s) => {
    const bloque = BLOQUES_PICO.find(b => picos[b] === s.indice) ?? null
    return bloque ? { ...s, temporada: 'alta' as const, bloquePico: bloque } : { ...s, bloquePico: null }
  })
  emit('update:clasificacion', nueva)
}

function rango(semana: SemanaDeRejilla): string {
  const idioma = locale.value as Idioma
  return t('calendar.weekRange', { from: formatearDia(semana.inicio, idioma), to: formatearDia(semana.noches[6]!, idioma) })
}
</script>

<template>
  <div
    class="space-y-4"
    data-test="clasificador"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <dl class="flex flex-wrap gap-4">
        <div
          v-for="fila in resumen"
          :key="fila.temporada"
          :data-test="`resumen-${fila.temporada}`"
        >
          <dt class="text-xs uppercase tracking-wide text-muted">
            {{ t(`calendar.seasons.${fila.temporada}`) }}
          </dt>
          <dd
            class="font-mono text-sm"
            :class="fila.disponibles < fila.necesarias ? 'text-error' : ''"
          >
            {{ t('calendar.summary', { available: fila.disponibles, required: fila.necesarias }) }}
          </dd>
        </div>
      </dl>
      <UButton
        v-if="editable"
        variant="outline"
        size="sm"
        icon="i-lucide-sparkles"
        :label="t('calendar.suggestPeaks')"
        data-test="sugerir-picos"
        @click="sugerir"
      />
    </div>

    <div class="overflow-x-auto rounded-2xl border border-default">
      <table class="w-full text-sm">
        <tbody>
          <tr
            v-for="semana in rejilla"
            :key="semana.indice"
            class="border-b border-default last:border-0"
            :data-test="`semana-${semana.indice}`"
          >
            <td class="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted">
              {{ t('calendar.week', { n: semana.indice + 1 }) }}
            </td>
            <td class="whitespace-nowrap px-3 py-2">
              {{ rango(semana) }}
            </td>
            <td class="px-3 py-2">
              <div class="flex flex-wrap gap-1">
                <UButton
                  v-for="temporada in TEMPORADAS"
                  :key="temporada"
                  size="xs"
                  :color="COLOR[temporada]"
                  :variant="semanaDe(semana.indice).temporada === temporada ? 'solid' : 'ghost'"
                  :disabled="!editable"
                  :label="t(`calendar.seasons.${temporada}`)"
                  :data-test="`semana-${semana.indice}-${temporada}`"
                  @click="clasificar(semana.indice, temporada)"
                />
              </div>
            </td>
            <td class="px-3 py-2">
              <div
                v-if="semanaDe(semana.indice).temporada === 'alta'"
                class="flex flex-wrap gap-1"
              >
                <UButton
                  v-for="bloque in BLOQUES_PICO"
                  :key="bloque"
                  size="xs"
                  color="error"
                  :variant="semanaDe(semana.indice).bloquePico === bloque ? 'solid' : 'outline'"
                  :disabled="!editable"
                  icon="i-lucide-star"
                  :label="t(`calendar.peaks.${bloque}`)"
                  :data-test="`pico-${semana.indice}-${bloque}`"
                  @click="marcarPico(semana.indice, bloque)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
