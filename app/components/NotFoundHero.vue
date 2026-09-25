<script setup lang="ts">
import { motion, useMotionTemplate, useMotionValue, useScroll, useSpring, useTransform } from 'motion-v'

/**
 * Página de error del sitio (404 y demás códigos). Presenta y emite: el error y la
 * forma de limpiarlo los decide `app/error.vue`.
 *
 * Tres escenas con `motion-v`, todas decorativas:
 * 1. Portada: la foto de Invictvs y el código grande en Oro Arena se mueven a
 *    velocidades distintas con el scroll (paralaje) y siguen al puntero.
 * 2. Franja: una línea de texto de marca avanza de lado mientras se baja.
 * 3. Cierre: la imagen se revela y se asienta al entrar en pantalla.
 *
 * El texto se ve aunque no corra JavaScript, y con `prefers-reduced-motion` nada se
 * mueve: el contenido es el mismo, quieto.
 */
const props = withDefaults(defineProps<{
  codigo: number
  /** Ruta localizada del modelo fraccionado, la salida secundaria. */
  modelo: string
  reducirMovimiento?: boolean
}>(), {
  reducirMovimiento: false,
})

const emit = defineEmits<{ inicio: [] }>()

const { t } = useI18n()

const esNoEncontrada = computed(() => props.codigo === 404)
const titulo = computed(() => t(esNoEncontrada.value ? 'errorPage.notFound.title' : 'errorPage.generic.title'))
const descripcion = computed(() => t(esNoEncontrada.value ? 'errorPage.notFound.description' : 'errorPage.generic.description'))

/** La franja repite la frase para que nunca se vea su final mientras avanza. */
const franja = computed(() => Array.from({ length: 4 }, () => t('errorPage.marquee')))

// 1 · Portada: el fondo baja despacio y la cifra más rápido; el texto se desvanece.
const portada = ref<HTMLElement | null>(null)
const { scrollYProgress: avancePortada } = useScroll({ target: portada, offset: ['start start', 'end start'] })
const fondoY = useTransform(avancePortada, [0, 1], ['0%', '18%'])
const fondoEscala = useTransform(avancePortada, [0, 1], [1.08, 1.18])
const cifraY = useTransform(avancePortada, [0, 1], ['0%', '60%'])
const textoY = useTransform(avancePortada, [0, 1], ['0%', '-30%'])
const textoOpacidad = useTransform(avancePortada, [0, 0.7], [1, 0])

// El puntero, de -0,5 a 0,5 en cada eje, suavizado con un resorte.
const punteroX = useMotionValue(0)
const punteroY = useMotionValue(0)
const resorte = { stiffness: 60, damping: 20, mass: 0.6 }
const suaveX = useSpring(punteroX, resorte)
const suaveY = useSpring(punteroY, resorte)
const fondoX = useTransform(suaveX, [-0.5, 0.5], [22, -22])
const cifraX = useTransform(suaveX, [-0.5, 0.5], [-28, 28])
const cifraGiro = useTransform(suaveY, [-0.5, 0.5], [-3, 3])

function seguirPuntero(evento: PointerEvent) {
  if (props.reducirMovimiento || !portada.value) {
    return
  }
  const caja = portada.value.getBoundingClientRect()
  punteroX.set((evento.clientX - caja.left) / caja.width - 0.5)
  punteroY.set((evento.clientY - caja.top) / caja.height - 0.5)
}

function soltarPuntero() {
  punteroX.set(0)
  punteroY.set(0)
}

// 2 · Franja: avanza hacia la izquierda mientras cruza la pantalla.
const cinta = ref<HTMLElement | null>(null)
const { scrollYProgress: avanceCinta } = useScroll({ target: cinta, offset: ['start end', 'end start'] })
const cintaX = useTransform(avanceCinta, [0, 1], ['0%', '-35%'])
const cintaInversaX = useTransform(avanceCinta, [0, 1], ['-35%', '0%'])

// 3 · Cierre: la imagen se abre desde un recorte y se asienta.
const cierre = ref<HTMLElement | null>(null)
const { scrollYProgress: avanceCierre } = useScroll({ target: cierre, offset: ['start end', 'center center'] })
const recorte = useTransform(avanceCierre, [0, 1], [18, 0])
const imagenRecorte = useMotionTemplate`inset(${recorte}% ${recorte}% ${recorte}% ${recorte}% round 1.5rem)`
const imagenEscala = useTransform(avanceCierre, [0, 1], [1.25, 1])
const cierreTextoY = useTransform(avanceCierre, [0, 1], [60, 0])

/** Con menos movimiento ningún estilo animado se aplica. */
function si<T>(estilo: T): T | undefined {
  return props.reducirMovimiento ? undefined : estilo
}

/** Revelado escalonado del texto de la portada, en CSS: existe sin JavaScript. */
function revelado(posicion: number) {
  return props.reducirMovimiento
    ? {}
    : { class: 'error-revelado', style: { animationDelay: `${200 + posicion * 130}ms` } }
}
</script>

<template>
  <div :data-test="reducirMovimiento ? 'error-estatico' : 'error-animado'">
    <!-- 1 · Portada -->
    <section
      ref="portada"
      class="relative isolate flex min-h-svh items-center overflow-hidden bg-ink-950 pb-36 pt-20 text-ink-50 sm:pb-44 sm:pt-24 lg:pb-52"
      @pointermove="seguirPuntero"
      @pointerleave="soltarPuntero"
    >
      <motion.div
        class="absolute -inset-[6%] -z-30"
        :style="si({ y: fondoY, x: fondoX, scale: fondoEscala })"
        aria-hidden="true"
      >
        <img
          src="/media/invictvs-aereo-atardecer.jpg"
          alt=""
          class="size-full object-cover"
          fetchpriority="high"
        >
      </motion.div>
      <div
        class="absolute inset-0 -z-20 bg-gradient-to-b from-ink-950/70 via-ink-950/55 to-ink-950"
        aria-hidden="true"
      />

      <UContainer class="w-full">
        <motion.div
          class="mx-auto max-w-2xl text-center"
          :style="si({ y: textoY, opacity: textoOpacidad })"
        >
          <!--
            La cifra encabeza la portada: grande, en degradado de Oro Arena, y más
            rápida que el fondo al bajar y al mover el puntero (paralaje).
          -->
          <p
            v-bind="revelado(0)"
            class="mb-4 sm:mb-6"
          >
            <span class="sr-only">{{ t('errorPage.eyebrow', { code: codigo }) }}</span>
            <motion.span
              class="cifra-oro inline-block select-none font-display text-[6.5rem] font-light leading-[0.85] tracking-tight sm:text-[9rem] lg:text-[11rem]"
              :style="si({ y: cifraY, x: cifraX, rotate: cifraGiro })"
              aria-hidden="true"
              data-test="error-codigo"
            >
              {{ codigo }}
            </motion.span>
          </p>

          <div class="space-y-6">
            <h1
              v-bind="revelado(1)"
              class="font-display text-4xl font-medium leading-[1.05] text-balance sm:text-6xl lg:text-7xl"
            >
              {{ titulo }}
            </h1>

            <p
              v-bind="revelado(2)"
              class="mx-auto max-w-xl text-base text-ink-100/85 sm:text-lg"
            >
              {{ descripcion }}
            </p>

            <div
              v-bind="revelado(3)"
              class="flex flex-wrap items-center justify-center gap-3 pt-2"
            >
              <motion.div
                :while-hover="si({ y: -2 })"
                :while-press="si({ scale: 0.97 })"
                class="inline-flex"
              >
                <UButton
                  size="xl"
                  icon="i-lucide-arrow-left"
                  :label="t('errorPage.home')"
                  data-test="volver-al-inicio"
                  @click="emit('inicio')"
                />
              </motion.div>
              <UButton
                size="xl"
                variant="link"
                color="neutral"
                class="text-ink-50 hover:text-arena-300"
                :to="modelo"
                :label="t('errorPage.secondary')"
                trailing-icon="i-lucide-arrow-right"
                data-test="ir-al-modelo"
              />
            </div>
          </div>
        </motion.div>
      </UContainer>

      <!-- Invitación a bajar: una línea que cae una y otra vez. -->
      <div
        class="absolute inset-x-0 bottom-8 flex flex-col items-center gap-3 sm:bottom-12 text-ink-100/70"
        aria-hidden="true"
      >
        <span class="font-mono text-[0.65rem] uppercase tracking-[0.35em]">{{ t('errorPage.scroll') }}</span>
        <span class="relative h-12 w-px overflow-hidden bg-ink-100/20">
          <span
            class="absolute inset-x-0 top-0 h-1/2 bg-arena-300"
            :class="{ 'error-caida': !reducirMovimiento }"
          />
        </span>
      </div>
    </section>

    <!-- 2 · Franja de marca: dos líneas en sentidos opuestos. -->
    <section
      ref="cinta"
      class="overflow-hidden border-y border-default bg-default py-10"
      aria-hidden="true"
    >
      <motion.p
        class="whitespace-nowrap font-display text-5xl font-light italic text-highlighted sm:text-7xl"
        :style="si({ x: cintaX })"
      >
        <span
          v-for="(frase, indice) in franja"
          :key="`a-${indice}`"
          class="mx-6"
        >{{ frase }}<span class="mx-6 text-primary">✦</span></span>
      </motion.p>
      <motion.p
        class="cifra-contorno mt-2 whitespace-nowrap font-display text-5xl font-light sm:text-7xl"
        :style="si({ x: cintaInversaX })"
      >
        <span
          v-for="(frase, indice) in franja"
          :key="`b-${indice}`"
          class="mx-6"
        >{{ frase }}<span class="mx-6">✦</span></span>
      </motion.p>
    </section>

    <!-- 3 · Cierre: la imagen se revela y el texto la acompaña. -->
    <section
      ref="cierre"
      class="bg-default py-20 sm:py-28"
    >
      <UContainer class="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <motion.div
          class="aspect-[4/5] overflow-hidden rounded-3xl sm:aspect-[4/3]"
          :style="si({ clipPath: imagenRecorte })"
        >
          <motion.img
            src="/media/invictvs-frontal.jpg"
            :alt="t('errorPage.closing.imageAlt')"
            class="size-full object-cover"
            loading="lazy"
            :style="si({ scale: imagenEscala })"
          />
        </motion.div>

        <motion.div
          class="space-y-6"
          :style="si({ y: cierreTextoY })"
        >
          <p class="font-mono text-xs uppercase tracking-[0.35em] text-primary">
            {{ t('errorPage.closing.eyebrow') }}
          </p>
          <h2 class="font-display text-3xl font-medium leading-tight text-highlighted text-balance sm:text-5xl">
            {{ t('errorPage.closing.title') }}
          </h2>
          <p class="max-w-md text-muted">
            {{ t('errorPage.closing.description') }}
          </p>
          <UButton
            size="lg"
            variant="outline"
            icon="i-lucide-house"
            :label="t('errorPage.home')"
            data-test="volver-al-inicio"
            @click="emit('inicio')"
          />
        </motion.div>
      </UContainer>
    </section>
  </div>
</template>

<style scoped>
/* El código de la portada: degradado de Oro claro a Oro Arena, con un halo leve. */
.cifra-oro {
  background-image: linear-gradient(180deg, var(--color-arena-300) 0%, var(--color-arena-500) 55%, color-mix(in oklab, var(--color-arena-500) 35%, transparent) 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  filter: drop-shadow(0 12px 40px color-mix(in oklab, var(--color-arena-500) 25%, transparent));
}

/* La franja inversa: solo el contorno, en Oro Arena. */
.cifra-contorno {
  color: transparent;
  -webkit-text-stroke: 1px color-mix(in oklab, var(--color-arena-500) 55%, transparent);
}

@media (prefers-reduced-motion: no-preference) {
  .error-revelado {
    animation: error-revelado 1s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .error-caida {
    animation: error-caida 1.8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  }
}

@keyframes error-revelado {
  from {
    opacity: 0;
    transform: translateY(28px);
    filter: blur(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

@keyframes error-caida {
  from { transform: translateY(-100%); }
  to { transform: translateY(200%); }
}
</style>
