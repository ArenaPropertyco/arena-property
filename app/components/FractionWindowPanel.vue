<script setup lang="ts">
import { formatearInstante } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import { fractionWindowActive } from '#shared/scheduling/relocation'
import type { FractionWindowListed } from '#shared/scheduling/vistas'

/**
 * HU-59 · RF-59.9 · D-47 — las ventanas individuales del calendario, para el
 * Superadmin: abrir una a la fracción elegida por las horas que diga y cerrar
 * las que siguen abiertas. Qué fracciones se ofrecen (las que tienen titular) y
 * si una ventana está vigente lo trae ya decidido; aquí solo se elige y se emite.
 */
const props = defineProps<{
  fractions: { number: number, ownerName: string | null, hasOwner?: boolean }[]
  windows: FractionWindowListed[]
  now: string
  enviando: boolean
}>()

const emit = defineEmits<{
  abrir: [fraction: number, hours: number]
  cerrar: [id: string]
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const estado = reactive({ fraction: null as number | null, hours: 48 })

const opciones = computed(() => props.fractions
  .filter(fraccion => fraccion.hasOwner ?? fraccion.ownerName !== null)
  .map(fraccion => ({ value: fraccion.number, label: `${t('calendar.fractionLabel', { n: fraccion.number })} · ${fraccion.ownerName ?? ''}` })))

type Estado = 'active' | 'scheduled' | 'expired'
function estadoDe(ventana: FractionWindowListed): Estado {
  if (fractionWindowActive(ventana, props.now)) {
    return 'active'
  }
  return props.now < ventana.opensAt ? 'scheduled' : 'expired'
}

const COLOR: Record<Estado, 'success' | 'neutral' | 'warning'> = { active: 'success', scheduled: 'neutral', expired: 'warning' }

function abrir() {
  const hours = Number(estado.hours)
  if (estado.fraction === null || !(hours >= 1)) {
    return
  }
  emit('abrir', estado.fraction, hours)
}
</script>

<template>
  <div
    class="space-y-3 rounded-2xl border border-default bg-default p-4"
    data-test="ventanas-individuales"
  >
    <div>
      <p class="text-sm font-medium text-highlighted">
        {{ t('calendar.relocation.individual.title') }}
      </p>
      <p class="text-sm text-muted">
        {{ t('calendar.relocation.individual.subtitle') }}
      </p>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <UFormField
        :label="t('calendar.relocation.individual.fraction')"
        class="min-w-56 flex-1"
      >
        <USelect
          v-model="estado.fraction"
          :items="opciones"
          :placeholder="t('calendar.relocation.individual.fractionPlaceholder')"
          class="w-full"
          data-test="individual-fraccion"
        />
      </UFormField>
      <UFormField
        :label="t('calendar.relocation.individual.hours')"
        class="w-32"
      >
        <UInput
          v-model="estado.hours"
          type="number"
          min="1"
          max="720"
          class="w-full"
          data-test="individual-horas"
        />
      </UFormField>
      <UButton
        icon="i-lucide-key-round"
        :loading="enviando"
        :label="t('calendar.relocation.individual.open')"
        data-test="abrir-individual"
        @click="abrir"
      />
    </div>

    <p
      v-if="windows.length === 0"
      class="text-sm text-muted"
      data-test="sin-ventanas-individuales"
    >
      {{ t('calendar.relocation.individual.empty') }}
    </p>
    <ul
      v-else
      class="divide-y divide-default"
    >
      <li
        v-for="ventana in windows"
        :key="ventana.id"
        class="flex flex-wrap items-center gap-3 py-2"
        :data-test="`ventana-individual-${ventana.id}`"
        :data-estado="estadoDe(ventana)"
      >
        <span class="font-mono text-sm text-highlighted">{{ t('calendar.fractionLabel', { n: ventana.fraction }) }}</span>
        <span class="flex-1 truncate text-sm text-muted">{{ ventana.ownerName ?? '' }}</span>
        <span class="font-mono text-xs text-muted">
          {{ t('calendar.relocation.turnSlot', { from: formatearInstante(ventana.opensAt, idioma), to: formatearInstante(ventana.closesAt, idioma) }) }}
        </span>
        <UBadge
          :color="COLOR[estadoDe(ventana)]"
          variant="subtle"
          size="sm"
          :label="t(`calendar.relocation.individual.status.${estadoDe(ventana)}`)"
        />
        <UButton
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          :label="t('calendar.relocation.individual.close')"
          :data-test="`cerrar-individual-${ventana.id}`"
          @click="emit('cerrar', ventana.id)"
        />
      </li>
    </ul>
  </div>
</template>
