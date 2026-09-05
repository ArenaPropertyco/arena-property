<script setup lang="ts">
/**
 * HU-01 · RF-01.1…RF-01.5 — catálogo público. La página orquesta: consulta sin
 * sesión (la RLS recorta), filtra con el composable y monta los componentes.
 */
const { t } = useI18n()
const { propiedades, pendiente } = useCatalogo()
const { filtro, filtradas, regiones, rango } = useFiltrosDeCatalogo(propiedades)

useSeoMeta({
  title: t('catalog.title'),
  description: t('catalog.seoDescription'),
  ogTitle: t('catalog.title'),
  ogDescription: t('catalog.seoDescription'),
})
</script>

<template>
  <div>
    <UPageHeader
      :headline="t('app.name')"
      :title="t('catalog.title')"
      :description="t('catalog.subtitle')"
      :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl' }"
      class="border-b border-default"
    />

    <UContainer class="space-y-8 py-10 sm:py-14">
      <CatalogFilters
        v-model:filtro="filtro"
        :regiones="regiones"
        :rango="rango"
        :total="propiedades.length"
        :mostradas="filtradas.length"
      />

      <PropertyCatalog
        :propiedades="filtradas"
        :pendiente="pendiente"
      />
    </UContainer>
  </div>
</template>
