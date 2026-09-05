<script setup lang="ts">
import { rutaDePropiedad } from '#shared/content/rutas'
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { admiteListaDeEspera } from '#shared/properties/catalogo-publico'
import type { PropiedadPublica } from '#shared/properties/catalogo-publico'

/**
 * HU-01 · RF-01.2, RF-01.4 — la tarjeta del catálogo: foto principal, nombre,
 * ubicación, precio por fracción, estado comercial y la ficha resumida. Enlaza al
 * detalle (HU-02). La foto va por `@nuxt/image` (RT-12).
 */
const props = defineProps<{ propiedad: PropiedadPublica }>()

const { t, locale } = useI18n()
const localePath = useLocalePath()

const COLOR_COMERCIAL = {
  coming_soon: 'info',
  fractions_available: 'primary',
  sold_out: 'neutral',
} as const

const precio = computed(() => props.propiedad.lowestPrice === null
  ? null
  : formatearImporte(props.propiedad.lowestPrice, locale.value as Idioma))

const listaDeEspera = computed(() => admiteListaDeEspera(props.propiedad))
</script>

<template>
  <NuxtLink
    :to="localePath(rutaDePropiedad(propiedad.slug))"
    class="group block overflow-hidden rounded-2xl border border-default bg-default transition hover:border-primary/40 hover:shadow-lg"
    :data-test="`propiedad-${propiedad.slug}`"
  >
    <div class="relative aspect-[4/3] overflow-hidden bg-elevated">
      <NuxtImg
        v-if="propiedad.photoUrl"
        :src="propiedad.photoUrl"
        :alt="propiedad.name"
        class="size-full object-cover transition duration-700 group-hover:scale-105"
        sizes="100vw sm:50vw lg:33vw"
        loading="lazy"
      />
      <div
        v-else
        class="flex size-full items-center justify-center text-muted"
      >
        <UIcon
          name="i-lucide-image"
          class="size-8"
        />
      </div>

      <div class="absolute left-3 top-3 flex flex-wrap gap-1.5">
        <UBadge
          :color="COLOR_COMERCIAL[propiedad.commercial]"
          variant="solid"
          size="sm"
          :label="t(`properties.commercial.${propiedad.commercial}`)"
          data-test="estado-comercial"
        />
        <UBadge
          v-if="listaDeEspera"
          color="neutral"
          variant="subtle"
          size="sm"
          :label="t('catalog.waitlist')"
          data-test="lista-de-espera"
        />
      </div>
    </div>

    <div class="space-y-3 p-5">
      <div>
        <p class="text-xs uppercase tracking-[0.2em] text-muted">
          {{ propiedad.city }} · {{ propiedad.region }}
        </p>
        <h3 class="mt-1 font-display text-2xl font-medium text-highlighted">
          {{ propiedad.name }}
        </h3>
      </div>

      <p class="text-sm">
        <template v-if="precio">
          <span class="text-muted">{{ t('catalog.from') }}</span>
          <span class="ml-1 font-mono text-lg text-highlighted">{{ precio }}</span>
          <span class="ml-1 text-muted">{{ t('catalog.perFraction') }}</span>
        </template>
        <span
          v-else
          class="text-muted"
        >{{ t('catalog.noPrice') }}</span>
      </p>

      <dl class="flex flex-wrap gap-x-4 gap-y-1 border-t border-default pt-3 font-mono text-sm text-muted">
        <div>
          <dd class="inline">{{ propiedad.areaM2 }}</dd> <dt class="inline">{{ t('catalog.specs.area') }}</dt>
        </div>
        <div>
          <dd class="inline">{{ propiedad.bedrooms }}</dd> <dt class="inline">{{ t('catalog.specs.bedrooms') }}</dt>
        </div>
        <div>
          <dd class="inline">{{ propiedad.bathrooms }}</dd> <dt class="inline">{{ t('catalog.specs.bathrooms') }}</dt>
        </div>
        <div>
          <dd class="inline">{{ propiedad.parkingSpots }}</dd> <dt class="inline">{{ t('catalog.specs.parking') }}</dt>
        </div>
      </dl>

      <p
        v-if="propiedad.commercial !== 'coming_soon'"
        class="text-xs text-muted"
      >
        {{ t('catalog.available', { count: propiedad.availableFractions }) }}
      </p>
    </div>
  </NuxtLink>
</template>
