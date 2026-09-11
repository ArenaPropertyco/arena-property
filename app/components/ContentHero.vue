<script setup lang="ts">
import type { SeccionDePagina } from '#shared/content/manifiesto'

/**
 * E1 · HU-41…HU-44, HU-48 — la cabecera a sangre de una subpágina
 * institucional: imagen oficial con velo, antetítulo, título en Cormorant y
 * descripción. Los textos llegan por clave del manifiesto; la imagen, por prop.
 */
defineProps<{
  seccion: SeccionDePagina
  imagen: string
  headlineKey: string
  descriptionKey: string
}>()

const { t } = useI18n()
</script>

<template>
  <section
    class="relative isolate flex min-h-[64svh] items-end overflow-hidden bg-ink-950 text-ink-50"
    :aria-label="t(seccion.tituloKey)"
    data-test="seccion-hero"
  >
    <NuxtImg
      :src="imagen"
      alt=""
      class="absolute inset-0 -z-20 size-full object-cover"
      sizes="100vw sm:100vw md:100vw lg:100vw xl:100vw"
      fetchpriority="high"
    />
    <div class="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/55 to-ink-950/5" />

    <UContainer class="w-full pb-14 pt-36 sm:pb-20">
      <div class="max-w-3xl space-y-5">
        <p class="text-xs font-medium uppercase tracking-[0.3em] text-arena-300 sm:text-sm">
          {{ t(headlineKey) }}
        </p>
        <h1 class="font-display text-4xl font-medium leading-[1.05] text-balance sm:text-6xl">
          {{ t(seccion.tituloKey) }}
        </h1>
        <p class="max-w-2xl text-base text-ink-100/85 sm:text-lg">
          {{ t(descriptionKey) }}
        </p>
      </div>
    </UContainer>
  </section>
</template>
