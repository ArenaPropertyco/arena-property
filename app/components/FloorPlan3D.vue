<script setup lang="ts">
/**
 * HU-02 · RF-02.5 · RT-12 — lienzo de `@tresjs/nuxt` para el plano elevado. Solo
 * se monta en el cliente y cuando `modoDelPlano` dio `visor3d`; la escena vive en
 * `FloorPlanScene`, que necesita el contexto del lienzo para animar y cargar.
 */
defineProps<{ url: string }>()

/** Ángulo de giro que el visitante controla arrastrando; la escena lo lee. */
const giro = ref(0)
let arrastreDesde: number | null = null

function empezar(evento: PointerEvent) {
  arrastreDesde = evento.clientX
}

function mover(evento: PointerEvent) {
  if (arrastreDesde === null) {
    return
  }
  giro.value += (evento.clientX - arrastreDesde) * 0.01
  arrastreDesde = evento.clientX
}

function soltar() {
  arrastreDesde = null
}
</script>

<template>
  <div
    class="aspect-[16/10] w-full cursor-grab touch-pan-y active:cursor-grabbing"
    data-test="plano-3d"
    @pointerdown="empezar"
    @pointermove="mover"
    @pointerup="soltar"
    @pointerleave="soltar"
  >
    <TresCanvas
      alpha
      :antialias="true"
    >
      <TresPerspectiveCamera
        :position="[0, 3.2, 4.2]"
        :look-at="[0, 0, 0]"
        :fov="40"
      />
      <TresAmbientLight :intensity="1.4" />
      <TresDirectionalLight
        :position="[2, 4, 3]"
        :intensity="1.2"
      />
      <FloorPlanScene
        :url="url"
        :giro="giro"
      />
    </TresCanvas>
  </div>
</template>
