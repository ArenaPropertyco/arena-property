/**
 * HU-04 · RF-04.2, HU-07 · RF-07.2 y HU-33 · RF-33.1 — decisión de acceso a rutas.
 *
 * Función pura: recibe lo que se sabe de la sesión y lo que exige la ruta, y
 * devuelve si entra o adónde se le redirige. El middleware de Nuxt solo la llama.
 * El orden importa y es fijo: sesión → correo verificado → cuenta activa → capacidad.
 */

import type { Capacidad, Contexto, Matriz } from './mapa'
import { MATRIZ, puede } from './mapa'
import type { Rol } from './roles'

export const RUTAS = {
  inicio: '/',
  ingresar: '/ingresar',
  registro: '/registro',
  verificar: '/registro/verificar',
  suspendida: '/cuenta/suspendida',
  panel: '/panel',
  /** HU-61 · adonde Google devuelve al Visitante tras autenticarse. */
  continuarOAuth: '/auth/continuar',
} as const

export type EstadoCuenta = 'active' | 'suspended'

export interface Sesion {
  autenticado: boolean
  verificado: boolean
  estadoCuenta: EstadoCuenta | null
  roles: readonly Rol[]
}

export interface Requisito {
  /** La ruta exige sesión verificada y cuenta activa. */
  privada?: boolean
  /** Capacidad de la matriz que la ruta exige (implica `privada`). */
  capacidad?: Capacidad
  /** Contexto para capacidades condicionadas por estado (D-31). */
  contexto?: Contexto
}

export type Motivo = 'no_autenticado' | 'no_verificado' | 'suspendido' | 'sin_capacidad'

export type Decision
  = | { permitido: true }
    | { permitido: false, motivo: Motivo, redirigirA: string }

export function decidirAcceso(sesion: Sesion, requisito: Requisito, matriz: Matriz = MATRIZ): Decision {
  const esPrivada = requisito.privada === true || requisito.capacidad !== undefined

  if (!esPrivada) {
    return { permitido: true }
  }
  if (!sesion.autenticado) {
    return { permitido: false, motivo: 'no_autenticado', redirigirA: RUTAS.ingresar }
  }
  if (!sesion.verificado) {
    return { permitido: false, motivo: 'no_verificado', redirigirA: RUTAS.verificar }
  }
  if (sesion.estadoCuenta === 'suspended') {
    return { permitido: false, motivo: 'suspendido', redirigirA: RUTAS.suspendida }
  }
  if (requisito.capacidad && !puede(sesion.roles, requisito.capacidad, requisito.contexto, matriz)) {
    return { permitido: false, motivo: 'sin_capacidad', redirigirA: RUTAS.panel }
  }

  return { permitido: true }
}
