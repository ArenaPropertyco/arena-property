<script setup lang="ts">
import { formatearDia, formatearInstante } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { WeekBlockListed } from '#shared/scheduling/vistas'
import { COLOR_BY_SEASON } from '~/utils/weeks'

/**
 * HU-15 · RF-15.3, RF-15.4, RF-15.5 · D-33 — los bloqueos por semanas del
 * calendario con su motivo, los conflictos abiertos que dejaron sobre semanas
 * confirmadas (para HU-17) y la acción de levantarlos, que también exige motivo.
 */
defineProps<{
  bloqueos: WeekBlockListed[]
  ocupadoId: string | null
}>()

const emit = defineEmits<{ levantar: [string, string] }>()

const { t, locale } = useI18n()

const motivos = reactive<Record<string, string>>({})
const errores = ref<Map<string, string>>(new Map())

function idioma(): Idioma {
  return locale.value as Idioma
}

function levantar(id: string) {
  const motivo = (motivos[id] ?? '').trim()
  if (motivo === '') {
    errores.value.set(id, t('calendar.blocks.validation.reason_required'))
    return
  }
  errores.value.delete(id)
  emit('levantar', id, motivo)
}
</script>

<template>
  <div
    class="space-y-3"
    data-test="lista-bloqueos"
  >
    <p
      v-if="bloqueos.length === 0"
      class="text-sm text-muted"
      data-test="sin-bloqueos"
    >
      {{ t('calendar.blocks.empty') }}
    </p>

    <article
      v-for="bloqueo in bloqueos"
      :key="bloqueo.id"
      class="rounded-2xl border border-default bg-default p-4"
      :class="bloqueo.liftedAt ? 'opacity-60' : ''"
      :data-test="`bloqueo-${bloqueo.id}`"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <p class="flex flex-wrap items-center gap-2 text-sm text-highlighted">
            <span class="font-mono">{{ t('calendar.weeks.week', { n: bloqueo.week + 1 }) }}</span>
            <span>{{ t('calendar.weekRange', { from: formatearDia(bloqueo.startsOn, idioma()), to: formatearDia(bloqueo.endsOn, idioma()) }) }}</span>
            <UBadge
              :color="COLOR_BY_SEASON[bloqueo.season]"
              variant="subtle"
              size="sm"
              :label="t(`calendar.seasons.${bloqueo.season}`)"
            />
          </p>
          <p
            class="text-sm"
            data-test="motivo"
          >
            {{ bloqueo.reason }}
          </p>
        </div>
        <UBadge
          :color="bloqueo.liftedAt ? 'neutral' : 'error'"
          variant="subtle"
          :icon="bloqueo.liftedAt ? 'i-lucide-lock-open' : 'i-lucide-lock'"
          :label="bloqueo.liftedAt ? t('calendar.blocks.liftedAt', { date: formatearInstante(bloqueo.liftedAt, idioma()) }) : t('calendar.blocks.active')"
        />
      </div>

      <div
        v-if="bloqueo.conflicts.length > 0"
        class="mt-3 rounded-xl bg-error/10 p-3 text-sm"
        data-test="conflictos"
      >
        <p class="text-xs font-medium uppercase tracking-wide text-error">
          {{ t('calendar.blocks.conflicts') }}
        </p>
        <ul class="mt-1 space-y-1">
          <li
            v-for="conflicto in bloqueo.conflicts"
            :key="`${conflicto.fraction}-${conflicto.week}`"
            :data-test="`conflicto-${bloqueo.id}-${conflicto.fraction}`"
          >
            {{ t('calendar.blocks.conflict', { week: conflicto.week + 1, fraction: t('calendar.fractionLabel', { n: conflicto.fraction }) }) }}
          </li>
        </ul>
      </div>

      <UForm
        v-if="!bloqueo.liftedAt"
        :state="motivos"
        class="mt-4 flex flex-wrap items-end gap-2 border-t border-default pt-4"
        :data-test="`formulario-levantar-${bloqueo.id}`"
        @submit.prevent="levantar(bloqueo.id)"
      >
        <UFormField
          :label="t('calendar.blocks.liftReason')"
          :error="errores.get(bloqueo.id)"
          class="min-w-56 flex-1"
        >
          <UInput
            v-model="motivos[bloqueo.id]"
            class="w-full"
            :data-test="`motivo-levantar-${bloqueo.id}`"
          />
        </UFormField>
        <UButton
          type="submit"
          variant="outline"
          color="neutral"
          icon="i-lucide-lock-open"
          :loading="ocupadoId === bloqueo.id"
          :label="t('calendar.blocks.lift')"
          :data-test="`levantar-${bloqueo.id}`"
        />
      </UForm>
    </article>
  </div>
</template>
