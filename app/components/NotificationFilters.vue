<script setup lang="ts">
import type { FiltroDeBandeja } from '#shared/notifications/bandeja'
import { filtroDeBandejaVacio, hayFiltroDeBandejaActivo } from '#shared/notifications/bandeja'
import { TIPOS_DE_NOTIFICACION } from '#shared/notifications/tipos'
import type { TipoDeNotificacion } from '#shared/notifications/tipos'

/**
 * TR-03 · RF-N.5 — filtro de la bandeja por propiedad, por tipo y solo no leídas.
 * Componente controlado: emite el filtro completo con cada cambio.
 */
const props = defineProps<{
  filtro: FiltroDeBandeja
  propiedades: { id: string, name: string }[]
  noLeidas: number
}>()

const emit = defineEmits<{ 'update:filtro': [FiltroDeBandeja] }>()

const { t } = useI18n()

const TODOS = '*' as const

function cambiar<C extends keyof FiltroDeBandeja>(criterio: C, valor: FiltroDeBandeja[C]) {
  emit('update:filtro', { ...props.filtro, [criterio]: valor })
}

function criterio(valor: unknown): string | null {
  return valor === TODOS || valor === '' || valor === undefined ? null : String(valor)
}

const propiedades = computed(() => [
  { label: t('notifications.filters.allProperties'), value: TODOS },
  ...props.propiedades.map(propiedad => ({ label: propiedad.name, value: propiedad.id })),
])

const tipos = computed(() => [
  { label: t('notifications.filters.allKinds'), value: TODOS },
  ...TIPOS_DE_NOTIFICACION.map(tipo => ({ label: t(`notifications.kinds.${tipo}.title`, {}), value: tipo })),
])

const activo = computed(() => hayFiltroDeBandejaActivo(props.filtro))
</script>

<template>
  <div
    class="space-y-3 rounded-2xl border border-default bg-default p-4"
    data-test="filtros-bandeja"
  >
    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField
        :label="t('notifications.filters.property')"
        data-test="filtro-propiedad"
      >
        <USelect
          :model-value="filtro.propertyId ?? TODOS"
          :items="propiedades"
          class="w-full"
          @update:model-value="cambiar('propertyId', criterio($event))"
        />
      </UFormField>

      <UFormField
        :label="t('notifications.filters.kind')"
        data-test="filtro-tipo"
      >
        <USelect
          :model-value="filtro.kind ?? TODOS"
          :items="tipos"
          class="w-full"
          @update:model-value="cambiar('kind', criterio($event) as TipoDeNotificacion | null)"
        />
      </UFormField>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <UCheckbox
        :model-value="filtro.soloNoLeidas"
        :label="t('notifications.filters.unreadOnly')"
        data-test="filtro-no-leidas"
        @update:model-value="cambiar('soloNoLeidas', $event === true)"
      />

      <div class="flex items-center gap-3 text-sm text-muted">
        <UBadge
          :color="noLeidas > 0 ? 'primary' : 'neutral'"
          variant="subtle"
          :label="t('notifications.unread', { count: noLeidas })"
          data-test="contador-no-leidas"
        />
        <UButton
          v-if="activo"
          variant="link"
          size="sm"
          icon="i-lucide-x"
          :label="t('notifications.filters.clear')"
          data-test="limpiar-filtros"
          @click="emit('update:filtro', filtroDeBandejaVacio())"
        />
      </div>
    </div>
  </div>
</template>
