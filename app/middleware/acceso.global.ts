import { decidirAcceso } from '#shared/permissions/acceso'

/**
 * HU-04 · RF-04.2, HU-07 · RF-07.2, HU-33 · RF-33.1 — guarda de rutas.
 *
 * Global para que ninguna página privada pueda olvidarse de protegerse: basta con
 * declarar `acceso` en su `definePageMeta`. Las páginas sin `acceso` son públicas.
 * La decisión es de `decidirAcceso`; aquí solo se carga la sesión y se redirige.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const requisito = to.meta.acceso
  if (!requisito) {
    return
  }

  const { sesion, perfil, esperar, recargar } = useCuenta()
  const { matriz, esperar: esperarPermisos } = usePermisos()
  await Promise.all([esperar(), esperarPermisos()])

  // HU-61 · tras volver de Google la sesión existe antes de que el perfil se haya
  // leído: sin perfil no se decide «no verificado», se vuelve a cargar primero.
  if (sesion.value.autenticado && !perfil.value) {
    await recargar()
  }

  // Con la matriz efectiva: si el Superadmin ajustó una celda, la guarda de rutas y
  // la interfaz deciden igual y no se contradicen.
  const decision = decidirAcceso(sesion.value, requisito, matriz.value)
  if (decision.permitido) {
    return
  }

  const localePath = useLocalePath()
  return navigateTo(localePath(decision.redirigirA))
})
