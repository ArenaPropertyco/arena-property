import { describe, expect, it } from 'vitest'
import { generarCuotas } from '#shared/finance/cuotas'
import type { FraccionParaCuota } from '#shared/finance/cuotas'
import type { LineaDelPropietario } from '#shared/finance/estado-de-cuenta'
import { proximaEstadia, tarjetasDelPortafolio } from '#shared/finance/portafolio'
import type { ContextoDelPortafolio, FraccionDelPortafolio } from '#shared/finance/portafolio'
import { pesos } from '#shared/money/importe'
import { puntosBasicos } from '#shared/money/comision'
import type { SemanaHistorica } from '#shared/scheduling/historial'

/**
 * HU-18 · RF-18.1, RF-18.2, RF-18.3, RF-18.5 · D-16, D-31, D-39 · TR-02 — el
 * resumen de cada fracción del Propietario como función pura: una tarjeta por
 * fracción (CA-18.1), la próxima estadía confirmada (CA-18.2), lo que le toca de
 * cada ingreso por renta sin redondeo silencioso (CA-18.3), el plan de pagos
 * mientras no esté completo y los copropietarios con nombre y fracción.
 */

const fracciones: FraccionDelPortafolio[] = [
  { id: 'f-p2-1', number: 1, propertyId: 'p2', propertyName: 'Refugio Salento', calendarActive: false },
  { id: 'f-p1-3', number: 3, propertyId: 'p1', propertyName: 'Casa Arena', calendarActive: true },
]

function semana(cambios: Partial<SemanaHistorica> & { week: number, startsOn: string, endsOn: string }): SemanaHistorica {
  return {
    propertyId: 'p1', propertyName: 'Casa Arena', fraction: 3, season: 'baja',
    confirmedAt: null, releasedAt: null, releaseReason: null, rented: false, income: null,
    ...cambios,
  }
}

function linea(cambios: Partial<LineaDelPropietario> & { shareId: string }): LineaDelPropietario {
  return {
    movementId: `m-${cambios.shareId}`, propertyId: 'p1', propertyName: 'Casa Arena', fraction: 3,
    kind: 'expense', allocation: 'prorated', amount: pesos(10_000), movementAmount: pesos(80_000),
    categoryName: 'Mantenimiento', incurredOn: '2026-09-14', description: 'Bomba', hasRemainder: false,
    commissionBasisPoints: null, commissionAmount: null, weekIndex: null, weekStartsOn: null, reversedAt: null,
    ...cambios,
  }
}

function ochoActivas(): FraccionParaCuota[] {
  return Array.from({ length: 8 }, (_, i) => ({ number: i + 1, status: 'sold', ownerId: `t-${i + 1}`, calendarActive: true, calendarActivatedAt: '2026-01-01T05:00:00Z' }))
}

const HOY = '2027-01-01'

const semanas: SemanaHistorica[] = [
  semana({ week: 20, startsOn: '2027-05-22', endsOn: '2027-05-29' }),
  semana({ week: 5, startsOn: '2027-02-06', endsOn: '2027-02-13', confirmedAt: '2026-11-01T10:00:00Z' }),
  semana({ week: 12, startsOn: '2027-03-27', endsOn: '2027-04-03', confirmedAt: '2026-11-01T10:00:00Z' }),
  semana({ week: 2, startsOn: '2026-01-16', endsOn: '2026-01-23', confirmedAt: '2025-10-01T10:00:00Z' }),
  semana({ week: 30, startsOn: '2026-08-07', endsOn: '2026-08-14', releasedAt: '2026-05-01T10:00:00Z', releaseReason: 'voluntary', rented: true, income: pesos(660_000) }),
]

const cuotaDeRenta = generarCuotas(pesos(800_000), ochoActivas(), '2026-09-02').find(c => c.fraction === 3)!

const contexto: ContextoDelPortafolio = {
  semanas,
  lineas: [
    linea({ shareId: 'renta', kind: 'income', categoryName: 'Renta a terceros', amount: cuotaDeRenta.amount, movementAmount: pesos(800_000), incurredOn: '2026-09-02' }),
    linea({ shareId: 'atribuida', kind: 'income', allocation: 'single_fraction', categoryName: 'Renta a terceros', amount: pesos(660_000), movementAmount: pesos(800_000), commissionBasisPoints: puntosBasicos(1750), commissionAmount: pesos(140_000), incurredOn: '2026-09-05', weekIndex: 30, weekStartsOn: '2026-08-07' }),
    linea({ shareId: 'gasto' }),
    linea({ shareId: 'gasto-p2', propertyId: 'p2', propertyName: 'Refugio Salento', fraction: 1, amount: pesos(5_000), movementAmount: pesos(40_000) }),
  ],
  planes: [{ fractionId: 'f-p2-1', id: 'plan-2', status: 'in_progress', balance: pesos(70_000_000) }],
  copropietarios: [
    { propertyId: 'p1', fraction: 3, name: 'Ana Ruiz' },
    { propertyId: 'p1', fraction: 5, name: 'Luis Mora' },
    { propertyId: 'p1', fraction: 7, name: null },
    { propertyId: 'p2', fraction: 1, name: 'Ana Ruiz' },
  ],
  hoy: HOY,
  periodo: '2026-09',
}

describe('CA-18.1 · una tarjeta por fracción', () => {
  it('CA-18.1 · un Propietario con 2 fracciones en propiedades distintas obtiene exactamente 2 tarjetas, con sus datos', () => {
    const tarjetas = tarjetasDelPortafolio(fracciones, contexto)

    expect(tarjetas).toHaveLength(2)
    expect(tarjetas.map(t => [t.propertyName, t.fraction])).toEqual([['Casa Arena', 3], ['Refugio Salento', 1]])
    expect(tarjetas[0]).toMatchObject({ fractionId: 'f-p1-3', propertyId: 'p1', calendarActive: true, periodo: '2026-09' })
    expect(tarjetas[1]).toMatchObject({ fractionId: 'f-p2-1', propertyId: 'p2', calendarActive: false })
  })

  it('RF-18.1 · el saldo del periodo es el neto de las líneas de esa fracción en ese mes', () => {
    const [casaArena, refugio] = tarjetasDelPortafolio(fracciones, contexto)

    expect(casaArena?.balance).toBe(750_000)
    expect(refugio?.balance).toBe(-5_000)
  })
})

describe('CA-18.2 · la próxima estadía', () => {
  it('CA-18.2 · es la semana confirmada futura más cercana; las elegidas sin confirmar y las pasadas no cuentan', () => {
    const proxima = proximaEstadia(semanas, HOY)

    expect(proxima?.week).toBe(5)
    expect(tarjetasDelPortafolio(fracciones, contexto)[0]?.nextStay?.startsOn).toBe('2027-02-06')
  })

  it('CA-18.2 · sin confirmadas futuras la tarjeta queda sin próxima estadía, para que la vista diga el vacío', () => {
    expect(proximaEstadia(semanas, '2027-06-01')).toBeNull()
    expect(tarjetasDelPortafolio(fracciones, contexto)[1]?.nextStay).toBeNull()
  })
})

describe('CA-18.3 · los ingresos por terceros que tocan a la fracción', () => {
  it('CA-18.3 · un ingreso de $800.000 en la propiedad llega a la tarjeta como $100.000 exactos, sin redondeo silencioso', () => {
    const [casaArena] = tarjetasDelPortafolio(fracciones, contexto)

    expect(cuotaDeRenta.amount).toBe(100_000)
    expect(casaArena?.rentalIncome).toEqual({ prorated: 100_000, attributed: 660_000, total: 760_000 })
  })

  it('RF-18.2 · una fracción sin ingresos por renta lo dice con ceros, no con un hueco', () => {
    expect(tarjetasDelPortafolio(fracciones, contexto)[1]?.rentalIncome).toEqual({ prorated: 0, attributed: 0, total: 0 })
  })
})

describe('RF-18.5 · plan de pagos, interruptor y copropietarios', () => {
  it('D-31 · la fracción con plan sin completar lleva su saldo pendiente; la completa no lleva plan', () => {
    const [casaArena, refugio] = tarjetasDelPortafolio(fracciones, contexto)

    expect(refugio?.plan).toEqual({ id: 'plan-2', status: 'in_progress', balance: 70_000_000 })
    expect(casaArena?.plan).toBeNull()
  })

  it('D-16 · los copropietarios son los otros titulares de la propiedad, con nombre y fracción, sin la propia ni las sin vender', () => {
    const [casaArena, refugio] = tarjetasDelPortafolio(fracciones, contexto)

    expect(casaArena?.coOwners).toEqual([{ fraction: 5, name: 'Luis Mora' }])
    expect(refugio?.coOwners).toEqual([])
  })
})
