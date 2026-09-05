<script setup lang="ts">
import type { PropiedadPublica } from '#shared/properties/catalogo-publico'

/**
 * HU-01 · la rejilla del catálogo. Recibe lo ya filtrado; el estado vacío se dice
 * con su texto traducido (CA-01.3).
 */
defineProps<{
  propiedades: PropiedadPublica[]
  pendiente: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div>
    <div
      v-if="pendiente && propiedades.length === 0"
      class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      data-test="catalogo-cargando"
    >
      <USkeleton
        v-for="n in 3"
        :key="n"
        class="aspect-[4/5] rounded-2xl"
      />
    </div>

    <p
      v-else-if="propiedades.length === 0"
      class="rounded-2xl border border-dashed border-default px-6 py-16 text-center text-muted"
      data-test="catalogo-vacio"
    >
      {{ t('catalog.empty') }}
    </p>

    <div
      v-else
      v-auto-animate
      class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      data-test="catalogo"
    >
      <PropertyCard
        v-for="propiedad in propiedades"
        :key="propiedad.id"
        :propiedad="propiedad"
      />
    </div>
  </div>
</template>
