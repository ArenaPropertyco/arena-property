/**
 * RF-00.7 y RF-02.5 — si el visitante pidió menos movimiento. Se lee en el cliente
 * tras montar: en el servidor no hay preferencia que consultar y se asume que no.
 */
export function useMovimientoReducido() {
  const reducirMovimiento = ref(false)

  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducirMovimiento.value = consulta.matches
    consulta.addEventListener?.('change', evento => reducirMovimiento.value = evento.matches)
  })

  return { reducirMovimiento }
}
