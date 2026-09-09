<script setup lang="ts">
import { formatearInstante } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import { noLeidas } from '#shared/notifications/bandeja'
import type { ItemDeBandeja } from '#shared/notifications/bandeja'

/**
 * TR-03 · RF-N.5 — la bandeja. Presenta lo que recibe y emite lo que el
 * destinatario hace: leer una, leer todas. El título y el cuerpo de cada tipo
 * salen de i18n con la carga del evento como parámetros (RT-05).
 */
const props = defineProps<{
  items: ItemDeBandeja[]
  pendiente: boolean
}>()

const emit = defineEmits<{
  leer: [string]
  leerTodas: []
}>()

const { t, locale } = useI18n()

const pendientes = computed(() => noLeidas(props.items))

/** vue-i18n interpola con cadenas; la carga puede traer números y nulos. */
function parametros(item: ItemDeBandeja): Record<string, string> {
  return Object.fromEntries(Object.entries(item.payload).map(([clave, valor]) => [clave, valor === null || valor === undefined ? '' : String(valor)]))
}

function fecha(item: ItemDeBandeja): string {
  return formatearInstante(item.createdAt, locale.value as Idioma)
}
</script>

<template>
  <div
    class="space-y-4"
    data-test="bandeja"
  >
    <div
      v-if="items.length > 0"
      class="flex flex-wrap items-center justify-between gap-2"
    >
      <p
        class="text-sm text-muted"
        data-test="resumen-no-leidas"
      >
        {{ pendientes > 0 ? t('notifications.unread', { count: pendientes }) : t('notifications.allRead') }}
      </p>
      <UButton
        v-if="pendientes > 0"
        variant="link"
        size="sm"
        icon="i-lucide-check-check"
        :label="t('notifications.markAll')"
        data-test="marcar-todas"
        @click="emit('leerTodas')"
      />
    </div>

    <p
      v-if="!pendiente && items.length === 0"
      class="rounded-2xl border border-dashed border-default px-6 py-12 text-center text-sm text-muted"
      data-test="bandeja-vacia"
    >
      {{ t('notifications.empty') }}
    </p>

    <ul
      v-else
      v-auto-animate
      class="space-y-2"
    >
      <li
        v-for="item in items"
        :key="item.id"
        class="rounded-xl border border-default p-4 transition"
        :class="item.readAt === null ? 'bg-primary/5 border-primary/30' : 'bg-default'"
        :data-test="`notificacion-${item.id}`"
      >
        <div class="flex items-start gap-3">
          <span
            v-if="item.readAt === null"
            class="mt-2 size-2 shrink-0 rounded-full bg-primary"
            :data-test="`no-leida-${item.id}`"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span v-if="item.propertyName">{{ item.propertyName }}</span>
              <span v-if="item.propertyName">·</span>
              <time :datetime="item.createdAt">{{ fecha(item) }}</time>
            </div>
            <h3 class="mt-1 font-display text-lg text-highlighted">
              {{ t(`notifications.kinds.${item.kind}.title`, parametros(item)) }}
            </h3>
            <p class="mt-1 whitespace-pre-line text-sm text-default">
              {{ t(`notifications.kinds.${item.kind}.body`, parametros(item)) }}
            </p>
          </div>
          <UButton
            v-if="item.readAt === null"
            variant="ghost"
            size="xs"
            icon="i-lucide-check"
            :aria-label="t('notifications.markRead')"
            :title="t('notifications.markRead')"
            :data-test="`marcar-${item.id}`"
            @click="emit('leer', item.id)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>
