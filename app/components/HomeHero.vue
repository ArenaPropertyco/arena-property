<script setup lang="ts">
import type { SeccionDeLaHome } from '#shared/content/home'
import { DATOS_DEL_HERO, FONDO_DEL_HERO } from '#shared/content/home'
import { RUTAS_PUBLICAS } from '#shared/content/rutas'

/**
 * HU-00 · RF-00.1 — hero con fondo animado y slogan. El fondo es el GIF oficial de
 * Invictvs: decorativo, en bucle por naturaleza, con un fotograma fijo como póster
 * mientras carga y como único fondo para quien pidió menos movimiento. Los textos
 * salen del manifiesto por clave i18n.
 */
defineProps<{
  seccion: SeccionDeLaHome
  /** RF-00.7 · con `prefers-reduced-motion` se muestra solo el póster. */
  reducirMovimiento?: boolean
}>()
const emit = defineEmits<{ cta: [SeccionDeLaHome] }>()

const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <section
    class="relative isolate flex min-h-[88svh] items-end overflow-hidden bg-ink-950 text-ink-50"
    :aria-label="t(seccion.tituloKey)"
    data-test="seccion-hero"
  >
    <img
      :src="FONDO_DEL_HERO.poster"
      alt=""
      class="absolute inset-0 -z-30 size-full object-cover"
      fetchpriority="high"
    >
    <img
      v-if="!reducirMovimiento"
      :src="FONDO_DEL_HERO.gif"
      :alt="t('home.hero.videoLabel')"
      class="absolute inset-0 -z-20 size-full object-cover"
      loading="eager"
      decoding="async"
      data-test="hero-fondo"
    >
    <div class="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/60 to-ink-950/10" />

    <UContainer class="w-full pb-16 pt-40 sm:pb-24">
      <div class="max-w-3xl space-y-6">
        <p class="text-xs font-medium uppercase tracking-[0.3em] text-arena-300 sm:text-sm">
          {{ t('home.hero.headline') }}
        </p>
        <h1 class="font-display text-4xl font-medium leading-[1.05] text-balance sm:text-6xl lg:text-7xl">
          {{ t(seccion.tituloKey) }}
        </h1>
        <p class="max-w-2xl text-base text-ink-100/85 sm:text-lg">
          {{ t('home.hero.description') }}
        </p>

        <div class="flex flex-wrap items-center gap-3 pt-2">
          <UButton
            v-if="seccion.cta"
            size="xl"
            :to="localePath(seccion.cta.destino)"
            :label="t(seccion.cta.labelKey)"
            trailing-icon="i-lucide-arrow-right"
            :data-test="`cta-${seccion.id}`"
            @click="emit('cta', seccion)"
          />
          <UButton
            size="xl"
            variant="link"
            color="neutral"
            class="text-ink-50 hover:text-arena-300"
            :to="localePath(RUTAS_PUBLICAS.modelo)"
            :label="t('home.hero.secondary')"
          />
        </div>
      </div>

      <dl class="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-ink-50/15 pt-6">
        <div
          v-for="dato in DATOS_DEL_HERO"
          :key="dato"
        >
          <dt class="text-[11px] uppercase tracking-[0.2em] text-ink-100/60">
            {{ t(`home.hero.facts.${dato}.label`) }}
          </dt>
          <dd class="mt-1 font-mono text-xl text-arena-300 sm:text-2xl">
            {{ t(`home.hero.facts.${dato}.value`) }}
          </dd>
        </div>
      </dl>
    </UContainer>
  </section>
</template>
