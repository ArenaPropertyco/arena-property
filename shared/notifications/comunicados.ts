/**
 * HU-31 · RF-31.1, RF-31.3 — el comunicado global del Superadmin y su segmento.
 *
 * El segmento se declara con un vocabulario cerrado —todos, por roles o por
 * propiedad— y se guarda tal cual, para que el registro diga a quién se le
 * habló. Convertirlo en cuentas concretas es de `destinatariosDeComunicado`
 * (RF-31.2); aquí solo la forma y su validación.
 */

import type { Rol } from '../permissions/roles'

/** RF-31.1 · Administrador, Propietario o Embajador: los roles a los que se les habla. */
export const ROLES_SEGMENTABLES = ['property_admin', 'owner', 'ambassador'] as const satisfies readonly Rol[]
export type RolSegmentable = typeof ROLES_SEGMENTABLES[number]

export const TIPOS_DE_SEGMENTO = ['all', 'roles', 'property'] as const
export type TipoDeSegmento = typeof TIPOS_DE_SEGMENTO[number]

export type SegmentoDeComunicado
  = | { kind: 'all' }
    | { kind: 'roles', roles: RolSegmentable[] }
    | { kind: 'property', propertyId: string }

export const LARGO_MAXIMO_DE_TITULO_DE_COMUNICADO = 120
export const LARGO_MAXIMO_DE_CUERPO_DE_COMUNICADO = 4000

/** Lo que el Superadmin declara al enviar (RF-31.1). */
export interface NuevoComunicado {
  title: string
  body: string
  segment: SegmentoDeComunicado
}

/** Un comunicado tal como lo lista el registro (RF-31.3). */
export interface Comunicado extends NuevoComunicado {
  id: string
  propertyName: string | null
  recipientCount: number
  createdAt: string
  createdByLabel: string | null
}

export const CLAVES_DE_VALIDACION_DE_COMUNICADO = [
  'broadcasts.validation.title_required',
  'broadcasts.validation.title_too_long',
  'broadcasts.validation.body_required',
  'broadcasts.validation.body_too_long',
  'broadcasts.validation.roles_required',
  'broadcasts.validation.property_required',
] as const

export type ClaveDeValidacionDeComunicado = typeof CLAVES_DE_VALIDACION_DE_COMUNICADO[number]

export type CampoDeComunicado = 'title' | 'body' | 'segment'

export interface ErrorDeComunicado {
  name: CampoDeComunicado
  message: ClaveDeValidacionDeComunicado
}

export function esRolSegmentable(valor: unknown): valor is RolSegmentable {
  return typeof valor === 'string' && (ROLES_SEGMENTABLES as readonly string[]).includes(valor)
}

/** RF-31.1 · un error por campo; el segmento vale solo si dice a quién. */
export function validarComunicado(comunicado: NuevoComunicado): ErrorDeComunicado[] {
  const errores: ErrorDeComunicado[] = []
  const titulo = comunicado.title.trim()
  const cuerpo = comunicado.body.trim()

  if (titulo === '') {
    errores.push({ name: 'title', message: 'broadcasts.validation.title_required' })
  }
  else if (titulo.length > LARGO_MAXIMO_DE_TITULO_DE_COMUNICADO) {
    errores.push({ name: 'title', message: 'broadcasts.validation.title_too_long' })
  }
  if (cuerpo === '') {
    errores.push({ name: 'body', message: 'broadcasts.validation.body_required' })
  }
  else if (cuerpo.length > LARGO_MAXIMO_DE_CUERPO_DE_COMUNICADO) {
    errores.push({ name: 'body', message: 'broadcasts.validation.body_too_long' })
  }

  const segmento = comunicado.segment
  if (segmento.kind === 'roles' && (segmento.roles.length === 0 || !segmento.roles.every(esRolSegmentable))) {
    errores.push({ name: 'segment', message: 'broadcasts.validation.roles_required' })
  }
  if (segmento.kind === 'property' && segmento.propertyId.trim() === '') {
    errores.push({ name: 'segment', message: 'broadcasts.validation.property_required' })
  }

  return errores
}
