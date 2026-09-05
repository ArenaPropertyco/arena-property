import { modoDelPlano } from '#shared/properties/detalle'
import type { ModoDelPlano } from '#shared/properties/detalle'

/**
 * HU-02 · RF-02.5 · RT-12 — en qué modo se presenta el plano elevado. La decisión
 * es de `modoDelPlano` (CA-02.4); aquí solo se detecta WebGL y la preferencia de
 * movimiento en el cliente. En el servidor se parte de la imagen estática: el visor
 * solo se monta cuando el navegador demuestra que puede.
 */
export function useModoDelPlano() {
  const { reducirMovimiento } = useMovimientoReducido()
  const webgl = ref(false)

  onMounted(() => {
    try {
      const lienzo = document.createElement('canvas')
      webgl.value = Boolean(lienzo.getContext('webgl2') ?? lienzo.getContext('webgl'))
    }
    catch {
      webgl.value = false
    }
  })

  const modo = computed<ModoDelPlano>(() => modoDelPlano({ webgl: webgl.value, reducirMovimiento: reducirMovimiento.value }))

  return { modo }
}
