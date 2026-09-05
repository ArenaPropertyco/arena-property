<script setup lang="ts">
import type { MedioConUrl } from '#shared/properties/vistas'

/**
 * HU-02 · RF-02.2, RF-02.6 — galería de fotos con `UCarousel` y `@nuxt/image`
 * (RT-12). Funciona a dedo en móvil; sin fotos, lo dice.
 *
 * El recorte redondeado va en el `viewport`, nunca en el `container`: el
 * contenedor es la pista que Embla desplaza con `transform`, y un `overflow-hidden`
 * ahí recorta todas las diapositivas salvo la primera.
 */
defineProps<{
  fotos: MedioConUrl[]
  nombre: string
}>()

const { t } = useI18n()
</script>

<template>
  <div data-test="galeria">
    <UCarousel
      v-if="fotos.length > 0"
      v-slot="{ item, index }"
      :items="fotos"
      arrows
      dots
      loop
      :ui="{ viewport: 'rounded-2xl', item: 'basis-full' }"
      class="w-full"
    >
      <NuxtImg
        :src="item.url"
        :alt="`${nombre} · ${index + 1}`"
        class="aspect-[16/10] w-full object-cover"
        sizes="100vw lg:80vw"
        :loading="index === 0 ? 'eager' : 'lazy'"
      />
    </UCarousel>

    <div
      v-else
      class="flex aspect-[16/10] items-center justify-center rounded-2xl bg-elevated text-muted"
      data-test="sin-fotos"
    >
      <UIcon
        name="i-lucide-image"
        class="size-10"
      />
      <span class="sr-only">{{ t('property.gallery') }}</span>
    </div>
  </div>
</template>
