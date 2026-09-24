/**
 * HU-62 · RF-62.11 · D-10 · RT-01 — el puerto `PaymentProvider`.
 *
 * Toda confirmación de un pago del Propietario pasa por aquí. Un proveedor
 * recibe el pago y una decisión, y devuelve la **resolución** que la base
 * entiende: confirmado o rechazado, con motivo, proveedor y referencia externa.
 *
 * Hoy solo existe el proveedor **manual**: la decisión la toma el Administrador
 * o el Superadmin al mirar el comprobante. Integrar una pasarela consistirá en
 * añadir otra implementación de este puerto —que traduzca la notificación del
 * proveedor a la misma resolución— y una ruta de servidor que la reciba, sin
 * tocar el cobro, el corte ni la billetera. Ninguna dependencia entra por aquí:
 * hacerlo exige una historia nueva y aprobarla en `docs/stack.md`.
 */

import type { CopAmount } from '../money/importe'

/** RF-62.11 · por dónde llegó el pago. */
export type PaymentChannel = 'manual' | 'gateway'

/** Lo que un proveedor necesita saber del pago para resolverlo. */
export interface PagoPorResolver {
  id: string
  amount: CopAmount
  channel: PaymentChannel
  provider: string | null
  externalReference: string | null
}

/** La decisión de una persona sobre un pago manual. */
export type DecisionManual
  = | { approved: true }
    | { approved: false, reason: string }

/** Lo que cualquier proveedor devuelve: el mismo vocabulario que la base guarda. */
export interface ResolucionDeProveedor {
  status: 'confirmed' | 'rejected'
  reason: string | null
  provider: string | null
  externalReference: string | null
}

/** El puerto. `Decision` es lo que cada canal recibe: una decisión humana, la notificación de una pasarela… */
export interface PaymentProvider<Decision = unknown> {
  readonly channel: PaymentChannel
  /** Nombre del proveedor externo; nulo en el manual. */
  readonly provider: string | null
  resolve: (payment: PagoPorResolver, decision: Decision) => ResolucionDeProveedor
}

/** RF-62.11 · el proveedor manual: traduce la decisión de una persona. */
export const proveedorManual: PaymentProvider<DecisionManual> = {
  channel: 'manual',
  provider: null,
  resolve(payment, decision) {
    if (payment.channel !== 'manual') {
      throw new RangeError(`El proveedor manual no resuelve pagos del canal ${payment.channel}.`)
    }
    if (decision.approved) {
      return { status: 'confirmed', reason: null, provider: null, externalReference: null }
    }
    const motivo = decision.reason.trim()
    if (motivo === '') {
      throw new RangeError('CA-62.8 · el rechazo de un pago exige un motivo.')
    }
    return { status: 'rejected', reason: motivo, provider: null, externalReference: null }
  },
}

/** D-10 · los proveedores servidos. Una pasarela entrará aquí cuando exista su historia. */
export const PROVEEDORES_DE_PAGO: Partial<Record<PaymentChannel, PaymentProvider<never>>> = {
  manual: proveedorManual as PaymentProvider<never>,
}

/** El proveedor de un canal; pedir uno que no existe falla en vez de inventar una confirmación. */
export function proveedorDe(channel: PaymentChannel): PaymentProvider<never> {
  const proveedor = PROVEEDORES_DE_PAGO[channel]
  if (!proveedor) {
    throw new RangeError(`RF-62.11 · D-10 · no hay pasarela de pagos configurada para el canal ${channel}: el MVP solo admite pago manual.`)
  }
  return proveedor
}
