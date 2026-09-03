<script setup lang="ts">
import type { PropiedadDetallada } from '#shared/properties/vistas'

/**
 * HU-08 · RF-08.1 — la ficha técnica tal como se lee, no como se edita.
 *
 * Las cifras van en la tipografía de cifras del manual (principio 8) y el
 * equipamiento sale de los datos: una propiedad sin equipamiento lo dice, no
 * enseña una lista de ejemplo.
 */
const props = defineProps<{ ficha: PropiedadDetallada }>()

const { t } = useI18n()

const datos = computed(() => [
  { clave: 'areaM2', valor: `${props.ficha.areaM2} m²` },
  { clave: 'bedrooms', valor: String(props.ficha.bedrooms) },
  { clave: 'bathrooms', valor: String(props.ficha.bathrooms) },
  { clave: 'parkingSpots', valor: String(props.ficha.parkingSpots) },
])

const direccion = computed(() => [props.ficha.address, props.ficha.city, props.ficha.region]
  .filter(Boolean)
  .join(', '))
</script>

<template>
  <div class="space-y-6 rounded-lg border border-default p-5">
    <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div
        v-for="dato in datos"
        :key="dato.clave"
      >
        <dt class="text-xs text-muted">
          {{ t(`properties.fields.${dato.clave}`) }}
        </dt>
        <dd
          class="font-mono text-lg"
          :data-test="`dato-${dato.clave}`"
        >
          {{ dato.valor }}
        </dd>
      </div>
    </dl>

    <div>
      <p class="text-xs text-muted">
        {{ t('properties.fields.address') }}
      </p>
      <p class="text-sm">
        {{ direccion }}
      </p>
    </div>

    <div>
      <p class="text-xs text-muted">
        {{ t('properties.fields.description') }}
      </p>
      <p class="text-sm whitespace-pre-line">
        {{ ficha.description }}
      </p>
    </div>

    <div>
      <p class="mb-2 text-xs text-muted">
        {{ t('properties.fields.admins') }}
      </p>
      <p
        v-if="ficha.adminLabels.length === 0"
        class="text-sm text-muted"
        data-test="sin-administradores-asignados"
      >
        {{ t('properties.unassigned') }}
      </p>
      <div
        v-else
        class="flex flex-wrap gap-1.5"
        data-test="administradores-asignados"
      >
        <UBadge
          v-for="administrador in ficha.adminLabels"
          :key="administrador"
          color="neutral"
          variant="subtle"
          size="sm"
          :label="administrador"
        />
      </div>
    </div>

    <div v-if="ficha.amenities.length > 0">
      <p class="mb-2 text-xs text-muted">
        {{ t('properties.fields.amenities') }}
      </p>
      <div class="flex flex-wrap gap-1.5">
        <UBadge
          v-for="elemento in ficha.amenities"
          :key="elemento"
          color="neutral"
          variant="subtle"
          size="sm"
          :label="elemento"
        />
      </div>
    </div>

    <div v-if="ficha.videoUrl">
      <p class="text-xs text-muted">
        {{ t('properties.fields.videoUrl') }}
      </p>
      <ULink
        :to="ficha.videoUrl"
        target="_blank"
        rel="noopener"
        class="text-sm"
      >
        {{ ficha.videoUrl }}
      </ULink>
    </div>
  </div>
</template>
