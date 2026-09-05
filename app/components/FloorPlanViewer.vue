<script setup lang="ts">
import type { ModoDelPlano } from '#shared/properties/detalle'
import type { MedioConUrl } from '#shared/properties/vistas'

/**
 * HU-02 · RF-02.5 · RT-12 — el plano elevado. El modo lo decide `modoDelPlano`
 * (CA-02.4) y llega por prop: en `visor3d` se monta el lienzo de `@tresjs/nuxt`
 * solo en el cliente, con la imagen como respaldo mientras carga; en `imagen`, la
 * imagen estática. Sin plano publicado, se dice.
 */
defineProps<{
  plano: MedioConUrl | null
  modo: ModoDelPlano
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-default bg-elevated/40"
    data-test="visor-plano"
  >
    <p
      v-if="!plano"
      class="px-6 py-16 text-center text-sm text-muted"
      data-test="sin-plano"
    >
      {{ t('property.noFloorPlan') }}
    </p>

    <template v-else-if="modo === 'visor3d'">
      <ClientOnly>
        <LazyFloorPlan3D :url="plano.url" />
        <template #fallback>
          <NuxtImg
            :src="plano.url"
            :alt="t('property.floorPlanStatic')"
            class="aspect-[16/10] w-full object-contain"
          />
        </template>
      </ClientOnly>
      <p class="px-4 py-2 text-center text-xs text-muted">
        {{ t('property.floorPlan3dHint') }}
      </p>
    </template>

    <NuxtImg
      v-else
      :src="plano.url"
      :alt="t('property.floorPlanStatic')"
      class="aspect-[16/10] w-full object-contain"
      data-test="plano-imagen"
    />
  </div>
</template>
