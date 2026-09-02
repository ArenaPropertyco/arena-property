import type { Requisito } from '#shared/permissions/acceso'

/**
 * HU-07 · RF-07.2 — cada página declara qué exige para entrar:
 *   definePageMeta({ acceso: { privada: true } })
 *   definePageMeta({ acceso: { capacidad: 'administrar_usuarios_y_roles' } })
 * El middleware global `acceso` lo lee y decide con `decidirAcceso`.
 */
declare module '#app' {
  interface PageMeta {
    acceso?: Requisito
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    acceso?: Requisito
  }
}

export {}
