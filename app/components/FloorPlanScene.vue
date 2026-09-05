<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { Box3, TextureLoader, Vector3 } from 'three'
import type { Group, Texture } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { shallowRef, watch } from 'vue'

/**
 * HU-02 · RF-02.5 — la escena del plano elevado. Dos fuentes posibles:
 *
 * - un modelo `.glb`, que se centra y se escala para caber en el encuadre y se
 *   presenta con una ligera inclinación, como maqueta;
 * - una imagen, que se pinta como textura sobre un plano inclinado.
 *
 * En ambos casos la escena gira despacio y obedece al arrastre del visitante.
 * `three` es dependencia directa aprobada en docs/stack.md precisamente para
 * poder importar el cargador de glTF.
 */
const props = defineProps<{
  url: string
  esModelo: boolean
  giro: number
}>()

/** Ancho que ocupa la pieza en la escena, sea modelo o imagen. */
const ANCHO_EN_ESCENA = 3.8

const textura = shallowRef<Texture | null>(null)
const modelo = shallowRef<Group | null>(null)
const proporcion = shallowRef(1.6)
const rotacionY = shallowRef(0)

watch(() => [props.url, props.esModelo] as const, async ([url, esModelo]) => {
  textura.value = null
  modelo.value = null
  if (!url) {
    return
  }

  if (esModelo) {
    const gltf = await new GLTFLoader().loadAsync(url)
    const escena = gltf.scene
    // Centrado en el origen y escalado al ancho de la escena: así cualquier
    // modelo, venga en metros o en centímetros, cabe en el mismo encuadre.
    const caja = new Box3().setFromObject(escena)
    const tamano = caja.getSize(new Vector3())
    const centro = caja.getCenter(new Vector3())
    const escala = ANCHO_EN_ESCENA / Math.max(tamano.x, tamano.z, 0.001)
    escena.position.set(-centro.x * escala, -caja.min.y * escala, -centro.z * escala)
    escena.scale.setScalar(escala)
    modelo.value = escena
    return
  }

  const cargada = await new TextureLoader().loadAsync(url)
  const ancho = cargada.image?.width ?? 16
  const alto = cargada.image?.height ?? 10
  proporcion.value = ancho / alto
  textura.value = cargada
}, { immediate: true })

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  rotacionY.value += delta * 0.15
})
</script>

<template>
  <TresGroup
    v-if="esModelo"
    :rotation="[0.08, rotacionY + giro, 0]"
    :position="[0, -0.6, 0]"
  >
    <primitive
      v-if="modelo"
      :object="modelo"
    />
  </TresGroup>

  <TresGroup
    v-else
    :rotation="[-0.95, rotacionY + giro, 0]"
  >
    <TresMesh>
      <TresPlaneGeometry :args="[ANCHO_EN_ESCENA, ANCHO_EN_ESCENA / proporcion]" />
      <TresMeshStandardMaterial
        v-if="textura"
        :map="textura"
        :transparent="true"
        :side="2"
      />
      <TresMeshStandardMaterial
        v-else
        :transparent="true"
        :opacity="0.15"
      />
    </TresMesh>
  </TresGroup>
</template>
