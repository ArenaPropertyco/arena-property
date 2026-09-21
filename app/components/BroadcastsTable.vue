<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { formatearInstante } from '#shared/dates/formato'
import type { Idioma } from '#shared/money/formato'
import type { Comunicado } from '#shared/notifications/comunicados'

/**
 * HU-31 · RF-31.3 — el registro de comunicados enviados: cuándo, qué, a qué
 * segmento y a cuántas cuentas llegó. Solo presenta; enviado, nada se edita.
 */
defineProps<{
  comunicados: Comunicado[]
  pendiente: boolean
}>()

const { t, locale } = useI18n()

const idioma = computed(() => locale.value as Idioma)

const columnas = computed<TableColumn<Comunicado>[]>(() => [
  { id: 'fecha', header: t('broadcasts.columns.date') },
  { id: 'titulo', header: t('broadcasts.columns.title') },
  { id: 'segmento', header: t('broadcasts.columns.segment') },
  { id: 'destinatarios', header: t('broadcasts.columns.recipients') },
])

/** El segmento, legible: «Todos», los roles elegidos o el nombre de la propiedad. */
function segmentoLegible(comunicado: Comunicado): string {
  const segmento = comunicado.segment
  switch (segmento.kind) {
    case 'roles':
      return segmento.roles.map(rol => t(`broadcasts.roles.${rol}`)).join(' · ')
    case 'property':
      return t('broadcasts.segmentProperty', { name: comunicado.propertyName ?? segmento.propertyId })
    default:
      return t('broadcasts.segments.all')
  }
}
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="!pendiente && comunicados.length === 0"
      class="rounded-2xl border border-dashed border-default px-6 py-12 text-center text-sm text-muted"
      data-test="sin-comunicados"
    >
      {{ t('broadcasts.empty') }}
    </p>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="comunicados"
        :columns="columnas"
        :loading="pendiente"
        data-test="tabla-comunicados"
      >
        <template #fecha-cell="{ row }">
          <span class="whitespace-nowrap">{{ formatearInstante(row.original.createdAt, idioma) }}</span>
        </template>

        <template #titulo-cell="{ row }">
          <div
            class="flex flex-col gap-1"
            :data-test="`comunicado-${row.original.id}`"
          >
            <span class="text-highlighted">{{ row.original.title }}</span>
            <span class="line-clamp-2 text-xs text-muted">{{ row.original.body }}</span>
            <span class="text-xs text-muted sm:hidden">{{ segmentoLegible(row.original) }}</span>
          </div>
        </template>

        <template #segmento-cell="{ row }">
          <UBadge
            color="neutral"
            variant="subtle"
            size="sm"
            :label="segmentoLegible(row.original)"
            :data-test="`segmento-${row.original.id}`"
          />
        </template>

        <template #destinatarios-cell="{ row }">
          <span
            class="font-mono"
            :data-test="`destinatarios-${row.original.id}`"
          >{{ row.original.recipientCount }}</span>
        </template>
      </UTable>
    </div>
  </div>
</template>
