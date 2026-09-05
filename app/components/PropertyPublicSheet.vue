<script setup lang="ts">
import { formatearImporte } from '#shared/money/formato'
import type { Idioma } from '#shared/money/formato'
import { admiteListaDeEspera } from '#shared/properties/catalogo-publico'
import type { PropiedadPublicada } from '#shared/properties/detalle'
import { FRACCIONES_POR_PROPIEDAD } from '#shared/properties/fracciones'

/**
 * HU-02 · RF-02.3 — ficha técnica, precio por fracción y estado comercial con
 * las fracciones disponibles. El conteo llega derivado de la base (CA-02.3).
 */
const props = defineProps<{ propiedad: PropiedadPublicada }>()

const { t, locale } = useI18n()

const precio = computed(() => props.propiedad.lowestPrice === null
  ? null
  : formatearImporte(props.propiedad.lowestPrice, locale.value as Idioma))

const COLOR_COMERCIAL = {
  coming_soon: 'info',
  fractions_available: 'primary',
  sold_out: 'neutral',
} as const

const especificaciones = computed(() => [
  { icono: 'i-lucide-ruler', valor: props.propiedad.areaM2, etiqueta: t('catalog.specs.area') },
  { icono: 'i-lucide-bed-double', valor: props.propiedad.bedrooms, etiqueta: t('catalog.specs.bedrooms') },
  { icono: 'i-lucide-bath', valor: props.propiedad.bathrooms, etiqueta: t('catalog.specs.bathrooms') },
  { icono: 'i-lucide-car', valor: props.propiedad.parkingSpots, etiqueta: t('catalog.specs.parking') },
])
</script>

<template>
  <UCard
    :ui="{ body: 'space-y-6' }"
    data-test="ficha-publica"
  >
    <div class="flex flex-wrap items-center gap-2">
      <UBadge
        :color="COLOR_COMERCIAL[propiedad.commercial]"
        variant="subtle"
        :label="t(`properties.commercial.${propiedad.commercial}`)"
        data-test="estado-comercial"
      />
      <UBadge
        v-if="admiteListaDeEspera(propiedad)"
        color="neutral"
        variant="outline"
        :label="t('catalog.waitlist')"
      />
    </div>

    <div>
      <p class="text-xs uppercase tracking-[0.2em] text-muted">
        {{ t('property.priceFrom') }}
      </p>
      <p
        class="mt-1 font-mono text-3xl text-highlighted"
        data-test="precio-fraccion"
      >
        {{ precio ?? t('catalog.noPrice') }}
      </p>
    </div>

    <div v-if="propiedad.commercial !== 'coming_soon'">
      <p class="text-xs uppercase tracking-[0.2em] text-muted">
        {{ t('property.available') }}
      </p>
      <p
        class="mt-1 font-mono text-xl"
        data-test="fracciones-disponibles"
      >
        {{ t('property.availableOf', { count: propiedad.availableFractions, total: FRACCIONES_POR_PROPIEDAD }) }}
      </p>
    </div>

    <dl class="grid grid-cols-2 gap-4 border-t border-default pt-5">
      <div
        v-for="dato in especificaciones"
        :key="dato.etiqueta"
        class="flex items-center gap-3"
      >
        <UIcon
          :name="dato.icono"
          class="size-5 text-primary"
        />
        <div>
          <dd class="font-mono text-lg">
            {{ dato.valor }}
          </dd>
          <dt class="text-xs text-muted">
            {{ dato.etiqueta }}
          </dt>
        </div>
      </div>
    </dl>

    <div class="border-t border-default pt-5 text-sm">
      <p class="text-xs uppercase tracking-[0.2em] text-muted">
        {{ t('property.location') }}
      </p>
      <p class="mt-1">
        {{ propiedad.city }}, {{ propiedad.region }}
      </p>
      <p
        v-if="propiedad.address"
        class="text-muted"
      >
        {{ propiedad.address }}
      </p>
    </div>
  </UCard>
</template>
