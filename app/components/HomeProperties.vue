<script setup lang="ts">
import type { SeccionDeLaHome } from '#shared/content/home'
import { IMAGENES_DE_LA_HOME } from '#shared/content/home'
import type { PropiedadPublica } from '#shared/properties/catalogo-publico'

/**
 * HU-00 · RF-00.1 y HU-01 · RF-01.1 — las propiedades activas, en la home,
 * sobre un banner con la foto aérea de Invictvs. Recibe lo que la página ya
 * consultó (solo lo publicado, por RLS) y reutiliza la tarjeta del catálogo, que
 * trae la ficha rápida: nombre, ubicación, área, habitaciones, baños y valor de
 * la fracción. La lista se anima con auto-animate al cambiar (RT-12).
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
  <section
    class="relative isolate overflow-hidden bg-ink-950 py-16 text-ink-50 sm:py-24"
    :aria-label="t(seccion.tituloKey)"
    data-test="seccion-propiedades"
  >
    <NuxtImg
      :src="IMAGENES_DE_LA_HOME.properties"
      alt=""
      class="absolute inset-0 -z-20 size-full object-cover opacity-60"
      sizes="100vw sm:100vw md:100vw lg:100vw xl:100vw"
      loading="lazy"
    />
    <div class="absolute inset-0 -z-10 bg-gradient-to-b from-ink-950/80 via-ink-950/70 to-ink-950" />

    <UContainer>
      <div class="mx-auto max-w-2xl text-center">
        <p class="text-xs font-medium uppercase tracking-[0.25em] text-arena-300">
          {{ t('home.properties.headline') }}
        </p>
        <h2 class="mt-3 font-display text-4xl font-medium text-balance sm:text-5xl">
          {{ t(seccion.tituloKey) }}
        </h2>
        <p class="mt-4 text-base text-ink-100/80">
          {{ t('home.properties.description') }}
        </p>
      </div>

      <p
        v-if="propiedades.length === 0"
        class="mt-12 rounded-2xl border border-dashed border-ink-50/25 px-6 py-12 text-center text-ink-100/70"
        data-test="propiedades-vacias"
      >
        {{ t('home.properties.empty') }}
      </p>

      <div
        v-else
        v-auto-animate
        class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
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
        class="mt-12 flex justify-center"
      >
        <UButton
          size="lg"
          :to="localePath(seccion.cta.destino)"
          :label="t(seccion.cta.labelKey)"
          trailing-icon="i-lucide-arrow-right"
          :data-test="`cta-${seccion.id}`"
          @click="emit('cta', seccion)"
        />
      </div>
    </UContainer>
  </section>
</template>
