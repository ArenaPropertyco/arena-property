/**
 * HU-06 · RF-06.2, RF-06.3, RF-06.4 y D-31 — efectos del cierre de una compra.
 *
 * D-31 separa dos ejes que aquí se ven de una vez: el cierre **da la titularidad**
 * (fracción vendida, vinculada al comprador, rol Propietario) y **no da el derecho
 * de uso**: el calendario nace inactivo y solo el plan de pagos lo abre al derivar
 * «Pago completado» (HU-58 · RF-58.7).
 *
 * Es una función pura sobre los hechos. La base repite la misma secuencia en
 * `public.cerrar_compra`, dentro de una transacción, y sus disparadores garantizan
 * la máquina de estados y la auditoría.
 */

import type { CopAmount } from '../money/importe'
import { esImporte } from '../money/importe'
import type { Rol } from '../permissions/roles'
import type { EstadoDeFraccion } from '../properties/fracciones'

export interface DatosDeCierre {
  fractionId: string
  propertyId: string
  fractionStatus: EstadoDeFraccion
  buyerId: string
  buyerRoles: readonly Rol[]
  agreedPrice: CopAmount
  /** RF-06.4 · código con el que el comprador llegó, si lo hubo (HU-51). */
  referralCode: string | null
}

export interface FraccionCerrada {
  id: string
  status: 'sold'
  ownerId: string
  /** D-31 · el cierre nunca lo activa. */
  calendarActive: false
}

/** RF-58.1 · el plan nace con el precio pactado congelado y sin abonos. */
export interface PlanInicial {
  fractionId: string
  propertyId: string
  ownerId: string
  agreedPrice: CopAmount
  referralCode: string | null
}

export interface EfectosDelCierre {
  fraccion: FraccionCerrada
  /** Pasos de la máquina de estados que hay que dar, en orden (RF-09.2). */
  transiciones: readonly EstadoDeFraccion[]
  /** `['owner']` salvo que el comprador ya lo fuera por otra fracción. */
  rolesAOtorgar: Rol[]
  plan: PlanInicial
}

export class ErrorDeCierre extends Error {
  readonly clave = 'purchases.errors.close_failed' as const

  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorDeCierre'
  }
}

/**
 * RF-06.4 · con qué código queda la compra. La atribución del perfil se escribió
 * una sola vez y no se reemplaza (D-03); la de la invitación solo suple cuando el
 * comprador no traía ninguna. `public.cerrar_compra` aplica el mismo `coalesce`.
 */
export function atribucionDeCompra(delPerfil: string | null, deLaInvitacion: string | null): string | null {
  return delPerfil ?? deLaInvitacion
}

/** La máquina de fracción no se salta: de disponible se pasa por reservada. */
const CAMINO_A_VENDIDA: Partial<Record<EstadoDeFraccion, readonly EstadoDeFraccion[]>> = {
  available: ['reserved', 'sold'],
  reserved: ['sold'],
}

export function cerrarCompra(datos: DatosDeCierre): EfectosDelCierre {
  const transiciones = CAMINO_A_VENDIDA[datos.fractionStatus]
  if (!transiciones) {
    throw new ErrorDeCierre(`RF-06.5 · una fracción ${datos.fractionStatus} no se vuelve a vender.`)
  }
  if (datos.buyerId.trim() === '') {
    throw new ErrorDeCierre('Sin comprador identificado no hay titularidad que otorgar.')
  }
  if (!esImporte(datos.agreedPrice) || datos.agreedPrice <= 0) {
    throw new ErrorDeCierre('RF-58.1 · el precio pactado debe ser un entero de pesos mayor que cero.')
  }

  return {
    fraccion: {
      id: datos.fractionId,
      status: 'sold',
      ownerId: datos.buyerId,
      calendarActive: false,
    },
    transiciones,
    rolesAOtorgar: datos.buyerRoles.includes('owner') ? [] : ['owner'],
    plan: {
      fractionId: datos.fractionId,
      propertyId: datos.propertyId,
      ownerId: datos.buyerId,
      agreedPrice: datos.agreedPrice,
      referralCode: datos.referralCode,
    },
  }
}
