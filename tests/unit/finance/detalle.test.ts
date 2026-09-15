import { describe, expect, it } from 'vitest'
import { FORMULA_DE_PRORRATEO, detalleDeCuota } from '#shared/finance/detalle'
import type { CuotaConMovimiento } from '#shared/finance/detalle'
import { pesos } from '#shared/money/importe'
import { puntosBasicos } from '#shared/money/comision'

/**
 * HU-24 · RF-24.1, RF-24.2, RF-24.2b, RF-24.2c, RF-24.4 · D-39, D-41 — el detalle
 * de cómo se calculó una cuota.
 *
 * Función pura sobre el movimiento y la cuota persistidos. La regla que gobierna
 * todas las variantes es la del principio 9: **solo se presenta la fórmula «÷ 8»
 * cuando el reparto de verdad dividió entre ocho**; sobre una cuota imputada o
 * atribuida, enseñarla sería mentir sobre el cálculo.
 */

function base(cambios: Partial<CuotaConMovimiento> = {}): CuotaConMovimiento {
  return {
    movementId: 'mov-1',
    kind: 'expense',
    allocation: 'prorated',
    amount: pesos(100_000),
    categoryName: 'Mantenimiento',
    incurredOn: '2026-09-14',
    propertyName: 'Casa Invictvs',
    description: 'Bomba de la piscina',
    fraction: 1,
    shareAmount: pesos(12_500),
    hasRemainder: false,
    commissionBasisPoints: null,
    commissionAmount: null,
    weekStartsOn: null,
    weekIndex: null,
    ...cambios,
  }
}

describe('CA-24.1 · el detalle de una cuota de gasto prorrateado', () => {
  const detalle = detalleDeCuota(base())

  it('CA-24.1 · trae el movimiento original con monto, categoría, fecha y propiedad', () => {
    expect(detalle).toMatchObject({
      naturaleza: 'prorated',
      montoOriginal: 100_000,
      categoryName: 'Mantenimiento',
      incurredOn: '2026-09-14',
      propertyName: 'Casa Invictvs',
    })
  })

  it('CA-24.1 · muestra la fórmula aplicada y el monto final coherente con ella', () => {
    expect(detalle.naturaleza).toBe('prorated')
    if (detalle.naturaleza !== 'prorated') {
      return
    }
    expect(detalle.formula).toBe(FORMULA_DE_PRORRATEO)
    expect(detalle.divisor).toBe(8)
    expect(detalle.cuota).toBe(12_500)
    expect(detalle.montoOriginal / detalle.divisor).toBe(detalle.cuota)
  })
})

describe('CA-24.2 · RF-24.2 · el residuo aparece explícito', () => {
  it('CA-24.2 · una cuota con residuo lo declara y explica el peso de más', () => {
    const detalle = detalleDeCuota(base({ amount: pesos(100_001), shareAmount: pesos(12_501), hasRemainder: true }))

    expect(detalle.naturaleza).toBe('prorated')
    if (detalle.naturaleza !== 'prorated') {
      return
    }
    expect(detalle.conResiduo).toBe(true)
    expect(detalle.residuo).toBe(1)
    expect(detalle.cuota).toBe(12_501)
  })

  it('CA-24.2 · una cuota sin residuo no lo inventa', () => {
    const detalle = detalleDeCuota(base())

    expect(detalle.naturaleza === 'prorated' && detalle.conResiduo).toBe(false)
    expect(detalle.naturaleza === 'prorated' && detalle.residuo).toBe(0)
  })

  it('CA-24.2 · un ingreso prorrateado se arma con la misma estructura que un gasto', () => {
    const detalle = detalleDeCuota(base({ kind: 'income', amount: pesos(800_000), shareAmount: pesos(100_000), categoryName: 'Renta a terceros' }))

    expect(detalle.naturaleza).toBe('prorated')
    if (detalle.naturaleza !== 'prorated') {
      return
    }
    expect(detalle.formula).toBe(FORMULA_DE_PRORRATEO)
    expect(detalle.cuota).toBe(100_000)
  })
})

describe('CA-24.2b · el detalle de un ingreso por semana liberada (D-39)', () => {
  const detalle = detalleDeCuota(base({
    kind: 'income',
    allocation: 'single_fraction',
    amount: pesos(800_000),
    categoryName: 'Renta a terceros',
    description: 'Renta a tercero',
    fraction: 3,
    shareAmount: pesos(640_000),
    commissionBasisPoints: puntosBasicos(20),
    commissionAmount: pesos(160_000),
    weekStartsOn: '2027-07-10',
    weekIndex: 27,
  }))

  it('CA-24.2b · muestra bruto, porcentaje de comisión, comisión y neto', () => {
    expect(detalle.naturaleza).toBe('attributed')
    if (detalle.naturaleza !== 'attributed') {
      return
    }
    expect(detalle).toMatchObject({
      bruto: 800_000,
      comisionPuntosBasicos: 2000,
      comision: 160_000,
      neto: 640_000,
    })
  })

  it('CA-24.2b · nombra la semana de origen con su fecha', () => {
    expect(detalle.naturaleza === 'attributed' && detalle.semana).toEqual({ indice: 27, empiezaEl: '2027-07-10' })
  })

  it('CA-24.2b · NO contiene la fórmula de división entre ocho', () => {
    expect(detalle).not.toHaveProperty('formula')
    expect(detalle).not.toHaveProperty('divisor')
  })

  it('CA-24.2b · el neto y la comisión suman el bruto, para que el Propietario lo cuadre', () => {
    if (detalle.naturaleza !== 'attributed') {
      return
    }
    expect(detalle.neto + detalle.comision).toBe(detalle.bruto)
  })
})

describe('CA-24.2c · el detalle de un gasto imputado a la fracción (D-41)', () => {
  const detalle = detalleDeCuota(base({
    allocation: 'single_fraction',
    amount: pesos(150_000),
    description: 'Vidrio roto en la estadía',
    fraction: 3,
    shareAmount: pesos(150_000),
  }))

  it('CA-24.2c · muestra el monto íntegro como cuota', () => {
    expect(detalle.naturaleza).toBe('imputed')
    if (detalle.naturaleza !== 'imputed') {
      return
    }
    expect(detalle.montoOriginal).toBe(150_000)
    expect(detalle.cuota).toBe(150_000)
  })

  it('CA-24.2c · declara la imputación directa y la descripción que la justifica', () => {
    if (detalle.naturaleza !== 'imputed') {
      return
    }
    expect(detalle.fraction).toBe(3)
    expect(detalle.description).toBe('Vidrio roto en la estadía')
  })

  it('CA-24.2c · NO contiene la fórmula de división entre ocho', () => {
    expect(detalle).not.toHaveProperty('formula')
    expect(detalle).not.toHaveProperty('divisor')
  })
})

describe('RF-24.4 · el armado es una función pura y determinista', () => {
  it('el mismo par movimiento/cuota produce siempre el mismo detalle', () => {
    expect(detalleDeCuota(base())).toEqual(detalleDeCuota(base()))
  })

  it('no muta la entrada', () => {
    const entrada = base()
    const copia = { ...entrada }
    detalleDeCuota(entrada)

    expect(entrada).toEqual(copia)
  })

  it('un ingreso atribuido sin comisión registrada se trata como imputación directa, no inventa cifras', () => {
    const detalle = detalleDeCuota(base({
      kind: 'income',
      allocation: 'single_fraction',
      amount: pesos(500_000),
      shareAmount: pesos(500_000),
      commissionBasisPoints: null,
      commissionAmount: null,
    }))

    expect(detalle.naturaleza).toBe('imputed')
  })
})
