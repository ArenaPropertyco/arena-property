import { describe, expect, it } from 'vitest'
import { calcularKpis, comisionesGeneradas, puedeVerMetricas } from '#shared/metrics/kpis'
import type { DatosDeKpis } from '#shared/metrics/kpis'
import { pesos } from '#shared/money/importe'

/**
 * HU-32 · RF-32.1, RF-32.3, RF-32.4 · TR-02 — los KPI globales del Superadmin.
 *
 * Conjunto conocido: 3 propiedades con 24 fracciones, 9 vendidas; 2
 * administradores activos; 7 propietarios; 4 embajadores activos; comisiones en
 * cuatro estados. Cada valor se comprueba contra el cálculo a mano (CA-32.1).
 */

const DATOS: DatosDeKpis = {
  properties: 3,
  fractionsTotal: 24,
  fractionsSold: 9,
  activeAdmins: 2,
  owners: 7,
  activeAmbassadors: 4,
  commissions: {
    pending: pesos(1_500_000),
    inGrace: pesos(3_000_000),
    available: pesos(2_400_000),
    withdrawn: pesos(900_000),
  },
}

describe('CA-32.1 · RF-32.1 · cada KPI coincide con el cálculo manual', () => {
  const kpis = calcularKpis(DATOS)

  it('cuenta propiedades, fracciones vendidas sobre el total, administradores, propietarios y embajadores', () => {
    expect(kpis.properties).toBe(3)
    expect(kpis.fractionsSold).toBe(9)
    expect(kpis.fractionsTotal).toBe(24)
    expect(kpis.activeAdmins).toBe(2)
    expect(kpis.owners).toBe(7)
    expect(kpis.activeAmbassadors).toBe(4)
  })

  it('CA-32.1 · el porcentaje de fracciones vendidas va en puntos básicos: 9 de 24 son 3.750 (37,5 %)', () => {
    expect(kpis.soldShare).toBe(3750)
    expect(calcularKpis({ ...DATOS, fractionsTotal: 0, fractionsSold: 0 }).soldShare).toBe(0)
  })

  it('RF-32.1 · las comisiones generadas son pendientes + liberadas + pagadas, sin doble conteo', () => {
    // Pendiente y en gracia son lo pendiente de liberar; disponible es lo liberado; retirado, lo pagado.
    expect(comisionesGeneradas(DATOS.commissions)).toBe(pesos(7_800_000))
    expect(kpis.commissions.generated).toEqual({ monto: pesos(7_800_000), condicion: 'confirmado' })
    expect(kpis.commissions.pending).toBe(pesos(4_500_000))
    expect(kpis.commissions.released).toBe(pesos(2_400_000))
    expect(kpis.commissions.paid).toBe(pesos(900_000))
    expect(kpis.commissions.pending + kpis.commissions.released + kpis.commissions.paid).toBe(kpis.commissions.generated.monto)
  })

  it('RF-32.4 · RF-D.6 · toda cifra monetaria del panel lleva su condición, y es confirmada porque sale de registros', () => {
    expect(kpis.commissions.generated.condicion).toBe('confirmado')
  })
})

describe('CA-32.3 · RF-32.3 · solo el Superadmin ve las métricas', () => {
  it('CA-32.3 · un Administrador, un Propietario o un Embajador quedan fuera', () => {
    expect(puedeVerMetricas(['superadmin'])).toBe(true)
    expect(puedeVerMetricas(['superadmin', 'owner'])).toBe(true)
    expect(puedeVerMetricas(['property_admin'])).toBe(false)
    expect(puedeVerMetricas(['owner', 'ambassador'])).toBe(false)
    expect(puedeVerMetricas([])).toBe(false)
  })
})
