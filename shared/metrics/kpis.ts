/**
 * HU-32 · RF-32.1, RF-32.3, RF-32.4 · TR-02 — los KPI globales del Superadmin.
 *
 * La base entrega conteos y sumas ya acotados a toda la plataforma (RF-32.3);
 * aquí se derivan el porcentaje de fracciones vendidas y las comisiones
 * generadas. Cada comisión está en exactamente un estado, así que sumar los
 * estados no cuenta nada dos veces; lo reversado no entra porque no se generó.
 * Toda cifra monetaria sale con su condición (RF-D.6): son confirmadas porque
 * vienen de registros, nunca de una estimación.
 */

import { CERO, sumar } from '../money/importe'
import type { CopAmount } from '../money/importe'
import { proporcionEnPuntosBasicos } from '../money/formato'
import { confirmado } from '../money/presentacion'
import type { ImporteConCondicion } from '../money/presentacion'
import type { Rol } from '../permissions/roles'

/** Sumas por estado, sin lo reversado. */
export interface ComisionesPorEstado {
  pending: CopAmount
  inGrace: CopAmount
  available: CopAmount
  withdrawn: CopAmount
}

export interface DatosDeKpis {
  properties: number
  fractionsTotal: number
  fractionsSold: number
  /** Administradores con rol, cuenta activa y alguna asignación vigente (HU-05). */
  activeAdmins: number
  /** Titulares distintos de fracciones vendidas, con cuenta activa. */
  owners: number
  /** Embajadores aprobados con cuenta activa (HU-49). */
  activeAmbassadors: number
  commissions: ComisionesPorEstado
}

export interface KpisDeComisiones {
  /** RF-32.1 · pendientes + liberadas + pagadas. */
  generated: ImporteConCondicion
  /** Pendiente de liberar: provisionada o en gracia. */
  pending: CopAmount
  /** Liberada y retirable. */
  released: CopAmount
  /** Pagada al Embajador. */
  paid: CopAmount
}

export interface Kpis {
  properties: number
  fractionsSold: number
  fractionsTotal: number
  /** CA-32.1 · vendidas sobre el total, en puntos básicos (RF-D.5). */
  soldShare: number
  activeAdmins: number
  owners: number
  activeAmbassadors: number
  commissions: KpisDeComisiones
}

/** RF-32.1 · lo generado es lo que existe en algún estado que no sea reversado. */
export function comisionesGeneradas(comisiones: ComisionesPorEstado): CopAmount {
  return [comisiones.pending, comisiones.inGrace, comisiones.available, comisiones.withdrawn].reduce(sumar, CERO)
}

/** CA-32.1 · cada KPI a partir de los datos conocidos; nada se estima. */
export function calcularKpis(datos: DatosDeKpis): Kpis {
  return {
    properties: datos.properties,
    fractionsSold: datos.fractionsSold,
    fractionsTotal: datos.fractionsTotal,
    // Sin fracciones no hay proporción que calcular: cero, no un error.
    soldShare: datos.fractionsTotal > 0 ? proporcionEnPuntosBasicos(datos.fractionsSold, datos.fractionsTotal) : 0,
    activeAdmins: datos.activeAdmins,
    owners: datos.owners,
    activeAmbassadors: datos.activeAmbassadors,
    commissions: {
      generated: confirmado(comisionesGeneradas(datos.commissions)),
      pending: sumar(datos.commissions.pending, datos.commissions.inGrace),
      released: datos.commissions.available,
      paid: datos.commissions.withdrawn,
    },
  }
}

/** CA-32.3 · RF-32.3 · el dashboard es del Superadmin; la ruta y la base lo repiten. */
export function puedeVerMetricas(roles: readonly Rol[]): boolean {
  return roles.includes('superadmin')
}
