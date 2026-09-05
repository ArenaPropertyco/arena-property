<script setup lang="ts">
import type { ModoDelPlano } from '#shared/properties/detalle'
import type { MedioConUrl } from '#shared/properties/vistas'

/**
 * HU-02 · RF-02.5 · RT-12 — el plano elevado. El modo lo decide `modoDelPlano`
 * (CA-02.4) y llega por prop. En `visor3d` se monta el lienzo de `@tresjs/nuxt`
 * solo en el cliente: con un modelo `.glb` lo carga como geometría; sin modelo,
 * pinta la imagen del plano sobre una superficie inclinada. En `imagen` se muestra
 * la imagen estática; si solo hay modelo, se dice que este dispositivo no lo abre.
 */
const props = withDefaults(defineProps<{
  /** Imagen del plano: respaldo estático y textura cuando no hay modelo. */
  plano: MedioConUrl | null
  /** Modelo `.glb` del plano, si la propiedad lo publicó. */
  modelo?: MedioConUrl | null
  modo: ModoDelPlano
}>(), { modelo: null })

const { t } = useI18n()

const fuente3d = computed(() => props.modelo ?? props.plano)
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-default bg-elevated/40"
    data-test="visor-plano"
  >
    <p
      v-if="!plano && !modelo"
      class="px-6 py-16 text-center text-sm text-muted"
      data-test="sin-plano"
    >
      {{ t('property.noFloorPlan') }}
    </p>

    <template v-else-if="modo === 'visor3d' && fuente3d">
      <ClientOnly>
        <LazyFloorPlan3D
          :url="fuente3d.url"
          :es-modelo="fuente3d === modelo"
        />
        <template #fallback>
          <NuxtImg
            v-if="plano"
            :src="plano.url"
            :alt="t('property.floorPlanStatic')"
            class="aspect-[16/10] w-full object-contain"
          />
          <div
            v-else
            class="aspect-[16/10] w-full"
          />
        </template>
      </ClientOnly>
      <p class="px-4 py-2 text-center text-xs text-muted">
        {{ t('property.floorPlan3dHint') }}
      </p>
    </template>

    <NuxtImg
      v-else-if="plano"
      :src="plano.url"
      :alt="t('property.floorPlanStatic')"
      class="aspect-[16/10] w-full object-contain"
      data-test="plano-imagen"
    />

    <p
      v-else
      class="px-6 py-16 text-center text-sm text-muted"
      data-test="sin-respaldo"
    >
      {{ t('property.floorPlanOnly3d') }}
    </p>
  </div>
</template>
