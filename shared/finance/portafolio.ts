/**
 * HU-18 · RF-18.1, RF-18.2, RF-18.3, RF-18.5 · D-16, D-31, D-39 — el portafolio del
 * Propietario: una tarjeta por fracción, armada como función pura.
 *
 * Cada tarjeta junta lo que otras historias ya calcularon: la próxima estadía
 * sale del historial de semanas (HU-20), el saldo del periodo y los ingresos por
 * renta del estado de cuenta (HU-19), el plan de pagos de HU-58 y los
 * copropietarios de HU-13. Aquí no se consulta ni se divide nada; se compone.
 *
 * Un Propietario con fracciones en varias propiedades tiene una tarjeta por
 * cada una (CA-18.1). El plan solo viaja mientras no esté completo (D-31): cuando
 * el calendario ya está activo no hay saldo que recordar.
 */

import type { CopAmount } from '../money/importe'
import type { EstadoDePlan } from '../payments/plan'
import type { Dia } from '../scheduling/rejilla'
import type { SemanaHistorica } from '../scheduling/historial'
import { esFutura } from '../scheduling/historial'
import { hoy as hoyDe } from '../dates/formato'
import { ingresosPorRenta, mesDe, saldoDelPeriodo } from './estado-de-cuenta'
import type { IngresosPorRenta, LineaDelPropietario, Mes } from './estado-de-cuenta'

export interface FraccionDelPortafolio {
  id: string
  number: number
  propertyId: string
  propertyName: string
  /** D-31 · el interruptor de calendario, derivado del plan. */
  calendarActive: boolean
}

/** D-16 · nombre y fracción de un copropietario, sin datos de contacto. */
export interface Copropietario {
  fraction: number
  name: string | null
}

/** RF-18.5 · lo del plan que la tarjeta necesita mientras no esté completo. */
export interface PlanDeLaTarjeta {
  id: string
  status: EstadoDePlan
  balance: CopAmount
}

export interface TarjetaDeFraccion {
  fractionId: string
  fraction: number
  propertyId: string
  propertyName: string
  calendarActive: boolean
  /** CA-18.2 · la semana confirmada futura más cercana; `null` si no hay. */
  nextStay: SemanaHistorica | null
  /** RF-18.1 · el neto del periodo. */
  balance: CopAmount
  periodo: Mes
  /** RF-18.2 · lo recibido por renta a terceros, por naturaleza. */
  rentalIncome: IngresosPorRenta
  /** RF-18.5 · `null` cuando el plan está completo o no existe. */
  plan: PlanDeLaTarjeta | null
  /** RF-18.5 · D-16 · los otros titulares de la propiedad. */
  coOwners: Copropietario[]
}

export interface ContextoDelPortafolio {
  semanas: readonly SemanaHistorica[]
  lineas: readonly LineaDelPropietario[]
  planes: readonly (PlanDeLaTarjeta & { fractionId: string })[]
  copropietarios: readonly (Copropietario & { propertyId: string })[]
  hoy: Dia
  /** El mes del estado de cuenta; por defecto, el de hoy. */
  periodo?: Mes
}

/** CA-18.2 · la reserva futura más cercana: confirmada, no soltada, con entrada por delante. */
export function proximaEstadia(semanas: readonly SemanaHistorica[], today: Dia): SemanaHistorica | null {
  return semanas
    .filter(semana => semana.confirmedAt !== null && semana.releasedAt === null && esFutura(semana, today))
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] ?? null
}

/** CA-18.1 · RF-18.3 · una tarjeta por fracción, por propiedad y número. */
export function tarjetasDelPortafolio(fracciones: readonly FraccionDelPortafolio[], contexto: ContextoDelPortafolio): TarjetaDeFraccion[] {
  const periodo = contexto.periodo ?? mesDe(contexto.hoy || hoyDe())

  return [...fracciones]
    .sort((a, b) => a.propertyName.localeCompare(b.propertyName) || a.number - b.number)
    .map((fraccion) => {
      const semanas = contexto.semanas.filter(s => s.propertyId === fraccion.propertyId && s.fraction === fraccion.number)
      const lineas = contexto.lineas.filter(l => l.propertyId === fraccion.propertyId && l.fraction === fraccion.number)
      const plan = contexto.planes.find(p => p.fractionId === fraccion.id) ?? null

      return {
        fractionId: fraccion.id,
        fraction: fraccion.number,
        propertyId: fraccion.propertyId,
        propertyName: fraccion.propertyName,
        calendarActive: fraccion.calendarActive,
        nextStay: proximaEstadia(semanas, contexto.hoy),
        balance: saldoDelPeriodo(lineas, periodo),
        periodo,
        rentalIncome: ingresosPorRenta(lineas),
        plan: plan && plan.status !== 'completed' ? { id: plan.id, status: plan.status, balance: plan.balance } : null,
        coOwners: contexto.copropietarios
          .filter(c => c.propertyId === fraccion.propertyId && c.fraction !== fraccion.number && c.name !== null)
          .map(c => ({ fraction: c.fraction, name: c.name }))
          .sort((a, b) => a.fraction - b.fraction),
      }
    })
}
