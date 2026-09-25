<script setup lang="ts">
import { TEMPORADAS } from '#shared/scheduling/temporadas'
import type { Temporada } from '#shared/scheduling/temporadas'
import type { SeasonQuota } from '#shared/scheduling/week-usage'
import { COLOR_BY_SEASON } from '~/utils/weeks'

/**
 * HU-13 · RF-13.2 · D-33 · RT-06 — el cupo por temporada de cada fracción de la
 * propiedad, tal como lo calcula la proyección: confirmadas, por confirmar y
 * liberadas frente al criterio.
 *
 * Se elige una fracción y su cupo se lee en cuatro tarjetas, una por temporada,
 * con una línea por estado: en móvil se lee de arriba abajo sin desplazar una
 * tabla de lado. Sin titular no hay cupo que contar, y con el calendario inactivo
 * (D-31) se dice, porque esa fracción no podrá confirmar.
 *
 * `fraccion` es opcional: sin ella se abre en la primera con titular.
 */
const props = defineProps<{
  cupo: Map<number, Record<Temporada, SeasonQuota>>
  fracciones: { number: number, ownerName: string | null, calendarActive: boolean }[]
}>()

const fraccion = defineModel<number | null>('fraccion', { default: null })

const { t } = useI18n()

const opciones = computed(() => props.fracciones.map(f => ({
  value: f.number,
  label: `${t('calendar.fractionLabel', { n: f.number })} · ${f.ownerName ?? t('calendar.propertyBoard.noOwner')}`,
})))

// Si la elegida no está (cambio de propiedad), se vuelve a la primera con titular.
watch(() => props.fracciones, (lista) => {
  if (!lista.some(f => f.number === fraccion.value)) {
    fraccion.value = (lista.find(f => f.ownerName) ?? lista[0])?.number ?? null
  }
}, { immediate: true })

const elegida = computed(() => props.fracciones.find(f => f.number === fraccion.value) ?? null)
const cupoElegido = computed(() => elegida.value ? props.cupo.get(elegida.value.number) ?? null : null)
</script>

<template>
  <div
    class="space-y-4"
    data-test="cupo-por-fraccion"
  >
    <UFormField
      :label="t('calendar.weeks.quotaCard.pick')"
      class="sm:max-w-sm"
    >
      <USelect
        :model-value="fraccion ?? undefined"
        :items="opciones"
        class="w-full"
        data-test="selector-fraccion"
        @update:model-value="fraccion = Number($event)"
      />
    </UFormField>

    <template v-if="elegida">
      <p
        class="flex flex-wrap items-center gap-2 text-sm"
        data-test="cupo-titular"
      >
        <span class="font-mono text-xs text-muted">{{ t('calendar.fractionLabel', { n: elegida.number }) }}</span>
        <span class="text-highlighted">{{ elegida.ownerName ?? t('calendar.propertyBoard.noOwner') }}</span>
        <UBadge
          v-if="elegida.ownerName && !elegida.calendarActive"
          color="neutral"
          variant="subtle"
          size="sm"
          :label="t('calendar.propertyBoard.inactive')"
        />
      </p>

      <div
        v-if="cupoElegido"
        class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <UCard
          v-for="temporada in TEMPORADAS"
          :key="temporada"
          :ui="{ header: 'py-3 sm:px-4', body: 'py-3 sm:px-4' }"
          :data-test="`cupo-temporada-${temporada}`"
        >
          <template #header>
            <UBadge
              :color="COLOR_BY_SEASON[temporada]"
              variant="subtle"
              :label="t(`calendar.seasons.${temporada}`)"
            />
          </template>
          <dl class="space-y-1 font-mono text-sm text-highlighted">
            <dd>{{ t('calendar.weeks.quotaCard.confirmed', { n: cupoElegido[temporada].confirmed + cupoElegido[temporada].used }) }}</dd>
            <dd>{{ t('calendar.weeks.quotaCard.elected', { n: cupoElegido[temporada].elected }) }}</dd>
            <dd>{{ t('calendar.weeks.quotaCard.released', { n: cupoElegido[temporada].released }) }}</dd>
            <dd class="pt-1 text-xs text-muted">
              {{ t('calendar.weeks.quotaCard.of', { n: cupoElegido[temporada].required }, cupoElegido[temporada].required) }}
            </dd>
          </dl>
        </UCard>
      </div>
      <p
        v-else
        class="text-sm text-muted"
        data-test="cupo-sin-titular"
      >
        {{ t('calendar.weeks.quotaCard.noQuota') }}
      </p>
    </template>
  </div>
</template>
