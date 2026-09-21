<script setup lang="ts">
import { formatearInstante } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { Novedad } from '#shared/notifications/novedades'

/**
 * HU-29 · RF-29.3, RF-29.5, RF-29.6 · HU-30 · RF-30.1 · RT-12 — el historial de
 * novedades.
 *
 * Presenta cada novedad con su propiedad, su destinatario —toda la propiedad o
 * una fracción—, su urgencia, su estado y si está visible para los propietarios.
 * Resolver se ofrece a quien puede y sobre las abiertas; activar o desactivar,
 * solo a quien fija el estado, que es el Superadmin (D-46). Una resuelta o una
 * inactiva sigue en la lista de quien gestiona: es historial, no se oculta. La
 * lista se anima al cambiar.
 */
const props = withDefaults(defineProps<{
  novedades: Novedad[]
  puedeResolver: boolean
  /** RF-29.6 · puede activar o desactivar: solo el Superadmin. */
  puedeCambiarVisibilidad?: boolean
  pendiente: boolean
}>(), { puedeCambiarVisibilidad: false })

const emit = defineEmits<{
  resolver: [string]
  cambiarVisibilidad: [string, boolean]
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

function resoluble(novedad: Novedad): boolean {
  return props.puedeResolver && novedad.resolvedAt === null
}
</script>

<template>
  <div
    class="space-y-4"
    data-test="lista-novedades"
  >
    <p
      v-if="!pendiente && novedades.length === 0"
      class="rounded-2xl border border-dashed border-default px-6 py-12 text-center text-sm text-muted"
      data-test="sin-novedades"
    >
      {{ t('announcements.empty') }}
    </p>

    <ul
      v-else
      v-auto-animate
      class="space-y-3"
    >
      <li
        v-for="novedad in novedades"
        :key="novedad.id"
        class="rounded-2xl border p-5 transition"
        :class="[
          novedad.resolvedAt === null ? 'bg-default' : 'bg-elevated/40',
          novedad.active ? 'border-default' : 'border-dashed border-muted',
        ]"
        :data-test="`novedad-${novedad.id}`"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1 space-y-2">
            <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span v-if="novedad.propertyName">{{ novedad.propertyName }}</span>
              <span v-if="novedad.propertyName">·</span>
              <time :datetime="novedad.createdAt">{{ formatearInstante(novedad.createdAt, idioma) }}</time>
              <span v-if="novedad.createdByLabel">·</span>
              <span v-if="novedad.createdByLabel">{{ t('announcements.publishedBy', { name: novedad.createdByLabel }) }}</span>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <h3
                class="font-display text-xl text-highlighted"
                :class="novedad.resolvedAt === null && novedad.active ? '' : 'text-muted'"
              >
                {{ novedad.title }}
              </h3>
              <span :data-test="`urgencia-${novedad.id}`">
                <AnnouncementUrgencyBadge :urgencia="novedad.urgency" />
              </span>
              <UBadge
                :color="novedad.resolvedAt === null ? 'primary' : 'neutral'"
                variant="outline"
                size="sm"
                :icon="novedad.resolvedAt === null ? 'i-lucide-circle-dot' : 'i-lucide-check-circle-2'"
                :label="t(`announcements.status.${novedad.status}`)"
                :data-test="`estado-${novedad.id}`"
              />
              <!-- RF-29.5 · dirigida a una fracción: solo su titular la recibió. -->
              <UBadge
                v-if="novedad.fractionNumber !== null"
                color="neutral"
                variant="subtle"
                size="sm"
                icon="i-lucide-user-round"
                :label="t('announcements.fractionLine', { number: novedad.fractionNumber })"
                :data-test="`fraccion-${novedad.id}`"
              />
              <!-- RF-29.6 · inactiva: ningún Propietario la ve; quien gestiona, sí, marcada. -->
              <UBadge
                v-if="!novedad.active"
                color="neutral"
                variant="outline"
                size="sm"
                icon="i-lucide-eye-off"
                :label="t('announcements.inactive')"
                :data-test="`inactiva-${novedad.id}`"
              />
            </div>

            <p class="whitespace-pre-line text-sm text-default">
              {{ novedad.body }}
            </p>

            <p
              v-if="novedad.resolvedAt"
              class="text-xs text-muted"
              :data-test="`resuelta-${novedad.id}`"
            >
              {{ t('announcements.resolvedLine', { when: formatearInstante(novedad.resolvedAt, idioma) }) }}
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="puedeCambiarVisibilidad"
              variant="ghost"
              size="xs"
              :icon="novedad.active ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :label="novedad.active ? t('announcements.deactivate') : t('announcements.activate')"
              :data-test="`visibilidad-${novedad.id}`"
              @click="emit('cambiarVisibilidad', novedad.id, !novedad.active)"
            />
            <UButton
              v-if="resoluble(novedad)"
              variant="outline"
              size="xs"
              icon="i-lucide-check"
              :label="t('announcements.resolve')"
              :data-test="`resolver-${novedad.id}`"
              @click="emit('resolver', novedad.id)"
            />
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
