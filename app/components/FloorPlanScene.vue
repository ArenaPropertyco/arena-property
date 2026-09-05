<script setup lang="ts">
import { catalogue, useLoop } from '@tresjs/core'
import { shallowRef, watch } from 'vue'

/**
 * HU-02 · RF-02.5 — la escena del plano elevado: un plano inclinado con la imagen
 * del plano como textura, que gira despacio y obedece al arrastre del visitante.
 *
 * La textura se carga con el `TextureLoader` del catálogo de TresJS, que es la
 * puerta aprobada a `three` (docs/stack.md no lo declara como dependencia directa).
 */
const props = defineProps<{
  url: string
  giro: number
}>()

const textura = shallowRef<unknown>(null)
const proporcion = shallowRef(1.6)
const rotacionY = shallowRef(0)

interface TexturaCargada { image?: { width?: number, height?: number } }

watch(() => props.url, async (url) => {
  const Cargador = catalogue.value.TextureLoader as (new () => { loadAsync: (ruta: string) => Promise<TexturaCargada> }) | undefined
  if (!Cargador || !url) {
    return
  }
  const cargada = await new Cargador().loadAsync(url)
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
  <TresGroup :rotation="[-0.95, rotacionY + giro, 0]">
    <TresMesh>
      <TresPlaneGeometry :args="[3.6, 3.6 / proporcion]" />
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
