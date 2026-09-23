<script setup lang="ts">
/**
 * HU-25 · RF-25.1…RF-25.5 · D-01 — el reporte financiero consolidado del
 * Superadmin.
 *
 * La página orquesta: carga las entradas con el composable, guarda el filtro y
 * pinta los dos libros, el consolidado y las filas que el dominio agregó. La
 * exportación es un enlace a la ruta Nitro con los mismos filtros, así que el
 * archivo es exactamente lo que se ve (CA-25.4). Solo el Superadmin entra
 * (RF-25.5): la guarda de rutas, la ruta de servidor y la RLS lo repiten.
 */
definePageMeta({ layout: 'dashboard', acceso: { soloSuperadmin: true } })

const { t } = useI18n()
const { filtro, reporte, filas, propiedades, administradores, rutaCsv, pendiente, error } = useReporteFinanciero()
</script>

<template>
  <PanelPage
    :titulo="t('reports.title')"
    :subtitulo="t('reports.subtitle')"
  >
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-end gap-3">
        <UButton
          :to="rutaCsv"
          external
          icon="i-lucide-file-spreadsheet"
          variant="outline"
          :label="t('reports.export')"
          data-test="exportar-csv"
        />
      </div>

      <ReportFilters
        v-model:filtro="filtro"
        :propiedades="propiedades"
        :administradores="administradores"
      />

      <p
        v-if="error"
        class="text-sm text-error"
        data-test="reporte-error"
      >
        {{ t('reports.error') }}
      </p>
      <p
        v-else-if="pendiente"
        class="text-sm text-muted"
        data-test="reporte-cargando"
      >
        {{ t('reports.loading') }}
      </p>

      <template v-else>
        <LedgerSummaryCards :reporte="reporte" />
        <ReportTable :filas="filas" />
      </template>
    </div>
  </PanelPage>
</template>
