<script setup lang="ts">
import type { SeccionDeLaHome } from '#shared/content/home'
import type { PropiedadPublica } from '#shared/properties/catalogo-publico'

/**
 * HU-00 · RF-00.1 y HU-01 · RF-01.1 — las propiedades activas, en la home, para
 * que el Visitante las vea sin entrar al catálogo. Recibe lo que la página ya
 * consultó (solo lo publicado, por RLS) y reutiliza la tarjeta del catálogo.
 */
defineProps<{
  seccion: SeccionDeLaHome
  propiedades: PropiedadPublica[]
}>()
const emit = defineEmits<{ cta: [SeccionDeLaHome] }>()

const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <UPageSection
    :headline="t('home.properties.headline')"
    :title="t(seccion.tituloKey)"
    :description="t('home.properties.description')"
    :ui="{ title: 'font-display font-medium text-4xl sm:text-5xl', headline: 'uppercase tracking-[0.25em] text-xs' }"
    data-test="seccion-propiedades"
  >
    <p
      v-if="propiedades.length === 0"
      class="rounded-2xl border border-dashed border-default px-6 py-12 text-center text-muted"
      data-test="propiedades-vacias"
    >
      {{ t('home.properties.empty') }}
    </p>

    <div
      v-else
      class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      data-test="propiedades-activas"
    >
      <PropertyCard
        v-for="propiedad in propiedades"
        :key="propiedad.id"
        :propiedad="propiedad"
      />
    </div>

    <div
      v-if="seccion.cta"
      class="mt-10 flex justify-center"
    >
      <UButton
        size="lg"
        variant="outline"
        :to="localePath(seccion.cta.destino)"
        :label="t(seccion.cta.labelKey)"
        trailing-icon="i-lucide-arrow-right"
        :data-test="`cta-${seccion.id}`"
        @click="emit('cta', seccion)"
      />
    </div>
  </UPageSection>
</template>
