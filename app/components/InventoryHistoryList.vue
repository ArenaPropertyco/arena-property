<script setup lang="ts">
import { formatearDia, formatearInstante } from '#shared/dates/formato'
import type { MovimientoListado } from '#shared/finance/vistas'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { EntradaDeHistorial } from '#shared/properties/inventario'

/**
 * HU-26 · RF-26.4 · HU-27 · RF-27.3 — el historial de un ítem: sus cambios de
 * estado y cantidad, con antes y después y quién los hizo, y los mantenimientos
 * que le fueron asociados. Todo llega ya resuelto por la base y por
 * `shared/finance/mantenimiento`; aquí solo se traduce y se formatea.
 */
defineProps<{
  entradas: EntradaDeHistorial[]
  mantenimientos: MovimientoListado[]
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

/** Los valores del histórico son texto crudo; el estado y la baja se traducen, la cantidad se muestra tal cual. */
function valor(entrada: EntradaDeHistorial, crudo: string): string {
  if (entrada.field === 'condition') {
    return t(`inventory.conditions.${crudo}`)
  }
  if (entrada.field === 'retired') {
    return t(`inventory.values.${crudo}`)
  }
  return crudo
}

function quien(entrada: EntradaDeHistorial): string {
  return entrada.changedByLabel ?? t('inventory.byAdministrator')
}
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-2">
      <h3 class="text-sm font-medium text-highlighted">
        {{ t('inventory.historyChanges') }}
      </h3>
      <p
        v-if="entradas.length === 0"
        class="text-sm text-muted"
        data-test="sin-historial"
      >
        {{ t('inventory.historyEmpty') }}
      </p>
      <ul
        v-else
        v-auto-animate
        class="divide-y divide-default rounded-lg border border-default"
      >
        <li
          v-for="entrada in entradas"
          :key="entrada.id"
          class="space-y-1 px-3 py-2 text-sm"
          :data-test="`cambio-${entrada.id}`"
        >
          <p class="text-highlighted">
            {{ t('inventory.changeLine', { field: t(`inventory.fields.${entrada.field}`), previous: valor(entrada, entrada.previous), next: valor(entrada, entrada.next) }) }}
          </p>
          <p class="text-xs text-muted">
            {{ t('inventory.changedBy', { who: quien(entrada), when: formatearInstante(entrada.changedAt, idioma) }) }}
          </p>
          <p
            v-if="entrada.note"
            class="text-xs text-muted"
          >
            {{ entrada.note }}
          </p>
        </li>
      </ul>
    </section>

    <section class="space-y-2">
      <h3 class="text-sm font-medium text-highlighted">
        {{ t('inventory.maintenance.itemHistory') }}
      </h3>
      <p
        v-if="mantenimientos.length === 0"
        class="text-sm text-muted"
        data-test="sin-mantenimientos-item"
      >
        {{ t('inventory.maintenance.itemHistoryEmpty') }}
      </p>
      <ul
        v-else
        v-auto-animate
        class="divide-y divide-default rounded-lg border border-default"
      >
        <li
          v-for="movimiento in mantenimientos"
          :key="movimiento.id"
          class="flex items-start justify-between gap-3 px-3 py-2 text-sm"
          :data-test="`mantenimiento-${movimiento.id}`"
        >
          <div class="flex flex-col">
            <span
              class="text-highlighted"
              :class="movimiento.voidedAt ? 'line-through text-muted' : ''"
            >{{ movimiento.description }}</span>
            <span class="text-xs text-muted">{{ formatearDia(movimiento.incurredOn, idioma) }} · {{ movimiento.categoryName }}</span>
            <a
              v-if="movimiento.attachmentUrl"
              :href="movimiento.attachmentUrl"
              target="_blank"
              rel="noopener"
              class="text-xs text-primary underline"
              :data-test="`factura-${movimiento.id}`"
            >{{ t('inventory.maintenance.viewAttachment') }}</a>
          </div>
          <span
            class="whitespace-nowrap font-mono"
            :class="movimiento.voidedAt ? 'line-through text-muted' : ''"
            :data-test="`monto-${movimiento.id}`"
          >{{ formatearImporte(movimiento.amount, idioma) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
