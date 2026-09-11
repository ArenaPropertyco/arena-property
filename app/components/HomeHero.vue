<script setup lang="ts">
import { Motion } from 'motion-v'
import type { SeccionDeLaHome } from '#shared/content/home'
import { DATOS_DEL_HERO, FONDO_DEL_HERO } from '#shared/content/home'
import { RUTAS_PUBLICAS } from '#shared/content/rutas'

/**
 * HU-00 · RF-00.1, RF-00.11 — hero con video de fondo y la jerarquía del texto
 * oficial sobre él: `h1` «Copropiedad Fraccionada», `h2` la frase, `h3` la
 * promesa de precio. El video es decorativo: silenciado, en bucle y sin
 * controles, con un fotograma fijo debajo que sostiene la sección mientras
 * carga y es el único fondo para quien pidió menos movimiento.
 *
 * El revelado del texto es una animación CSS con retraso escalonado: el texto
 * existe y se ve aunque no corra JavaScript, y `motion-safe` la apaga sola con
 * `prefers-reduced-motion` (CA-00.4). `motion-v` queda para la micro-interacción
 * del botón principal, que nunca oculta contenido.
 */
const props = defineProps<{
  seccion: SeccionDeLaHome
  /** RF-00.7 · con `prefers-reduced-motion` se muestra solo el póster y sin revelados. */
  reducirMovimiento?: boolean
}>()
const emit = defineEmits<{ cta: [SeccionDeLaHome] }>()

const { t } = useI18n()
const localePath = useLocalePath()

/** Clase y retraso del revelado de cada bloque, por posición; sin movimiento, nada. */
function revelado(posicion: number) {
  return props.reducirMovimiento
    ? {}
    : { class: 'hero-revelado', style: { animationDelay: `${150 + posicion * 120}ms` } }
}
</script>

<template>
  <section
    class="relative isolate flex min-h-[92svh] items-end overflow-hidden bg-ink-950 text-ink-50"
    :aria-label="t(seccion.tituloKey)"
    data-test="seccion-hero"
  >
    <img
      :src="FONDO_DEL_HERO.poster"
      alt=""
      class="absolute inset-0 -z-30 size-full object-cover"
      fetchpriority="high"
    >
    <video
      v-if="!reducirMovimiento"
      class="hero-video absolute inset-0 -z-20 size-full object-cover"
      :poster="FONDO_DEL_HERO.poster"
      :aria-label="t('home.hero.videoLabel')"
      autoplay
      muted
      loop
      playsinline
      disablepictureinpicture
      preload="metadata"
      data-test="hero-fondo"
    >
      <source
        :src="FONDO_DEL_HERO.video"
        type="video/mp4"
      >
    </video>
    <div class="absolute inset-0 -z-10 bg-gradient-to-t from-ink-950 via-ink-950/65 to-ink-950/15" />

    <UContainer class="w-full pb-16 pt-40 sm:pb-24">
      <div
        class="max-w-3xl space-y-6"
        :data-test="reducirMovimiento ? 'hero-estatico' : 'hero-animado'"
      >
        <h1
          v-bind="revelado(0)"
          class="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.3em] text-arena-300 sm:text-sm"
          data-test="hero-titulo"
        >
          <span
            class="inline-block h-px w-8 bg-arena-300"
            aria-hidden="true"
          />
          {{ t('home.hero.headline') }}
        </h1>

        <h2
          v-bind="revelado(1)"
          class="font-display text-4xl font-medium leading-[1.05] text-balance sm:text-6xl lg:text-7xl"
          data-test="hero-frase"
        >
          {{ t(seccion.tituloKey) }}
        </h2>

        <h3
          v-bind="revelado(2)"
          class="max-w-2xl text-base font-normal text-ink-100/85 sm:text-lg"
          data-test="hero-promesa"
        >
          {{ t('home.hero.description') }}
        </h3>

        <div
          v-bind="revelado(3)"
          class="flex flex-wrap items-center gap-3 pt-2"
        >
          <Motion
            v-if="seccion.cta"
            :while-hover="reducirMovimiento ? undefined : { y: -2 }"
            :while-press="reducirMovimiento ? undefined : { scale: 0.98 }"
            class="inline-flex"
          >
            <UButton
              size="xl"
              :to="localePath(seccion.cta.destino)"
              :label="t(seccion.cta.labelKey)"
              trailing-icon="i-lucide-arrow-right"
              :data-test="`cta-${seccion.id}`"
              @click="emit('cta', seccion)"
            />
          </Motion>
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

      <dl
        v-bind="revelado(4)"
        class="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-ink-50/15 pt-6"
      >
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

<style scoped>
/*
 * RF-00.11 · revelado escalonado del texto y zoom lentísimo del video.
 * Son animaciones CSS: el texto se pinta aunque no corra JavaScript, y solo se
 * mueven cuando el visitante admite movimiento.
 */
@media (prefers-reduced-motion: no-preference) {
  .hero-revelado {
    animation: hero-revelado 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .hero-video {
    animation: hero-zoom 24s ease-in-out infinite alternate;
  }
}

@keyframes hero-revelado {
  from {
    opacity: 0;
    transform: translateY(24px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes hero-zoom {
  from { transform: scale(1); }
  to { transform: scale(1.06); }
}
</style>
