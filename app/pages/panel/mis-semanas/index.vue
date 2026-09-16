<script setup lang="ts">
/**
 * HU-20 · RF-20.1…RF-20.4 · D-42, D-43 — el historial de semanas del Propietario.
 *
 * La página orquesta: monta los filtros y el listado, que llegan ya resueltos por
 * `useHistorialDeSemanas` sobre las funciones puras de `shared/scheduling/historial`.
 * Las semanas son las de las fracciones propias en calendarios publicados, con su
 * estado real y, para las liberadas y rentadas, el ingreso de la fracción.
 */
definePageMeta({ layout: 'dashboard', acceso: { privada: true } })

const { t } = useI18n()
const { historial, filtro, propiedades, hoy, pendiente } = useHistorialDeSemanas()
</script>

<template>
  <PanelPage
    :titulo="t('history.title')"
    :subtitulo="t('history.subtitle')"
  >
    <div class="space-y-6">
      <WeekHistoryFilters
        v-model:filtro="filtro"
        :propiedades="propiedades"
      />

      <p
        v-if="pendiente && historial.length === 0"
        class="text-sm text-muted"
        data-test="historial-cargando"
      >
        {{ t('portfolio.loading') }}
      </p>
      <WeekHistoryTable
        v-else
        :semanas="historial"
        :today="hoy"
      />
    </div>
  </PanelPage>
</template>
