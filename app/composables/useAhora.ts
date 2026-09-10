/**
 * HU-59 · RF-59.3, RF-59.6 — el instante actual como estado reactivo, que avanza
 * cada minuto en el navegador. El valor inicial viaja del servidor al cliente para
 * que la hidratación no discrepe; después solo el cliente lo actualiza.
 */
export function useAhora(intervaloMs = 60_000) {
  const ahora = useState<string>('ahora', () => new Date().toISOString())

  if (import.meta.client) {
    let temporizador: ReturnType<typeof setInterval> | null = null
    onMounted(() => {
      ahora.value = new Date().toISOString()
      temporizador = setInterval(() => {
        ahora.value = new Date().toISOString()
      }, intervaloMs)
    })
    onUnmounted(() => {
      if (temporizador) {
        clearInterval(temporizador)
      }
    })
  }

  return ahora
}
