<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { FilaGlobal } from '#shared/finance/tablero-de-cobros'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'

/**
 * HU-63 · RF-63.8 · CA-63.13 · TR-02 — la vista global: una fila por
 * propiedad con por cobrar, cobrado, en revisión y por pagar, ya sumados por
 * `shared/finance/tablero-de-cobros` con la misma función que el tablero de
 * cada una, y el enlace a ese tablero.
 */
defineProps<{ filas: FilaGlobal[] }>()

const { t, locale } = useI18n()
const localePath = useLocalePath()

const idioma = computed(() => locale.value as Idioma)

function importe(valor: CopAmount): string {
  return formatearImporte(valor, idioma.value)
}

const derecha = { class: { th: 'text-right', td: 'text-right' } }

const columnas = computed<TableColumn<FilaGlobal>[]>(() => [
  { id: 'propiedad', header: t('collections.global.columns.property') },
  { id: 'porCobrar', header: t('collections.global.columns.receivable'), meta: derecha },
  { id: 'cobrado', header: t('collections.global.columns.collected'), meta: derecha },
  { id: 'enRevision', header: t('collections.global.columns.underReview'), meta: derecha },
  { id: 'porPagar', header: t('collections.global.columns.payable'), meta: derecha },
  { id: 'acciones', header: '' },
])
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="filas.length === 0"
      class="text-sm text-muted"
      data-test="sin-propiedades-de-cobro"
    >
      {{ t('collections.global.empty') }}
    </p>

    <div
      v-else
      class="overflow-x-auto rounded-lg border border-default"
    >
      <UTable
        :data="filas"
        :columns="columnas"
        data-test="tabla-global-de-cobros"
      >
        <template #propiedad-cell="{ row }">
          <span
            class="text-highlighted"
            :data-test="`propiedad-${row.original.propertyId}`"
          >{{ row.original.propertyName }}</span>
        </template>
        <template #porCobrar-cell="{ row }">
          <span
            class="font-mono"
            :class="row.original.receivable > 0 ? 'text-error' : 'text-muted'"
            :data-test="`por-cobrar-${row.original.propertyId}`"
          >{{ importe(row.original.receivable) }}</span>
        </template>
        <template #cobrado-cell="{ row }">
          <span
            class="font-mono text-highlighted"
            :data-test="`cobrado-${row.original.propertyId}`"
          >{{ importe(row.original.collected) }}</span>
        </template>
        <template #enRevision-cell="{ row }">
          <span
            class="font-mono"
            :class="row.original.underReview > 0 ? 'text-warning' : 'text-muted'"
            :data-test="`en-revision-${row.original.propertyId}`"
          >{{ importe(row.original.underReview) }}</span>
        </template>
        <template #porPagar-cell="{ row }">
          <span
            class="font-mono"
            :class="row.original.payable > 0 ? 'text-success' : 'text-muted'"
            :data-test="`por-pagar-${row.original.propertyId}`"
          >{{ importe(row.original.payable) }}</span>
        </template>
        <template #acciones-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              variant="ghost"
              size="xs"
              icon="i-lucide-table-2"
              :label="t('collections.global.open')"
              :to="localePath(`/panel/cobros/${row.original.propertyId}`)"
              :data-test="`abrir-tablero-${row.original.propertyId}`"
            />
          </div>
        </template>
      </UTable>
    </div>
  </div>
</template>
