<script setup lang="ts">
/**
 * HU-32 · RF-32.1…RF-32.4 — el dashboard global del Superadmin.
 *
 * La página orquesta: pide las métricas al composable, deja elegir el periodo y
 * pinta los KPI y las dos series ya calculadas por `shared/metrics`. Solo el
 * Superadmin entra (RF-32.3): la guarda de rutas y la función de la base lo
 * repiten.
 */
definePageMeta({ layout: 'dashboard', acceso: { soloSuperadmin: true } })

const { t } = useI18n()
const { periodo, kpis, serieDeVentas, serieDeComisiones, pendiente, error } = useMetricas()
</script>

<template>
  <PanelPage
    :titulo="t('metrics.title')"
    :subtitulo="t('metrics.subtitle')"
  >
    <div class="space-y-8">
      <p
        v-if="error"
        class="text-sm text-error"
        data-test="metricas-error"
      >
        {{ t('metrics.error') }}
      </p>
      <p
        v-else-if="pendiente || !kpis"
        class="text-sm text-muted"
        data-test="metricas-cargando"
      >
        {{ t('metrics.loading') }}
      </p>

      <template v-else>
        <KpiCards :kpis="kpis" />

        <section class="space-y-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <SectionHeading :titulo="t('metrics.charts.title')" />
            <PeriodSelector v-model:periodo="periodo" />
          </div>
          <div class="grid gap-4 lg:grid-cols-2">
            <MetricsChart
              :titulo="t('metrics.charts.sales')"
              :serie="serieDeVentas"
              formato="count"
            />
            <MetricsChart
              :titulo="t('metrics.charts.commissions')"
              :serie="serieDeComisiones"
              formato="money"
            />
          </div>
        </section>
      </template>
    </div>
  </PanelPage>
</template>
