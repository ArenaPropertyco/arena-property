<script setup lang="ts">
import { formatearDia } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { ConflictoDeReconfiguracion } from '#shared/scheduling/reconfiguracion'

/**
 * HU-12 · RF-12.9 — reconfigurar con estadías existentes exige confirmación.
 * Muestra cuántas estadías hay y cuáles quedarán fuera del nuevo reparto; nada
 * se borra. Emite `confirmar` solo cuando el Administrador lo decide.
 */
defineProps<{
  estadias: number
  conflictos: ConflictoDeReconfiguracion[]
  enviando: boolean
}>()

const emit = defineEmits<{ confirmar: [] }>()

const { t, locale } = useI18n()

function noches(conflicto: ConflictoDeReconfiguracion): string {
  const idioma = locale.value as Idioma
  return conflicto.noches.map(noche => formatearDia(noche, idioma)).join(', ')
}
</script>

<template>
  <div
    class="space-y-4"
    data-test="confirmacion-reconfiguracion"
  >
    <p class="text-sm text-muted">
      {{ t('calendar.confirmHint', { count: estadias }) }}
    </p>

    <div>
      <p class="text-xs uppercase tracking-wide text-muted">
        {{ t('calendar.conflicts') }}
      </p>
      <p
        v-if="conflictos.length === 0"
        class="mt-1 text-sm"
      >
        {{ t('calendar.noConflicts') }}
      </p>
      <ul
        v-else
        class="mt-1 space-y-1 text-sm"
      >
        <li
          v-for="conflicto in conflictos"
          :key="conflicto.estadia"
          class="flex items-start gap-2"
          data-test="conflicto"
        >
          <UIcon
            name="i-lucide-alert-circle"
            class="mt-0.5 size-4 shrink-0 text-warning"
          />
          <span>
            {{ conflicto.ahoraDe === null
              ? t('calendar.conflictPool', { fraction: conflicto.fraccion, nights: noches(conflicto) })
              : t('calendar.conflict', { fraction: conflicto.fraccion, nights: noches(conflicto), now: conflicto.ahoraDe }) }}
          </span>
        </li>
      </ul>
    </div>

    <div class="flex justify-end">
      <UButton
        color="warning"
        :loading="enviando"
        icon="i-lucide-refresh-cw"
        :label="t('calendar.confirm')"
        data-test="confirmar-reconfiguracion"
        @click="emit('confirmar')"
      />
    </div>
  </div>
</template>
