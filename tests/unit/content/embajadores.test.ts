import { describe, expect, it } from 'vitest'
import {
  comisionPublicada,
  CONDICIONES_DEL_PROGRAMA,
  destinoDelCtaDeEmbajadores,
  IDS_DE_EMBAJADORES,
  PASOS_DEL_PROGRAMA,
  RUTA_DE_INSCRIPCION,
  SECCIONES_DE_EMBAJADORES,
} from '#shared/content/embajadores'
import { problemasDelManifiesto } from '#shared/content/manifiesto'
import { RUTAS_PUBLICAS } from '#shared/content/rutas'
import { formatearImporte, formatearPorcentaje } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import type { CommissionType } from '#shared/referrals/commission'

/**
 * HU-48 · RF-48.1…RF-48.4 · D-37 — la página pública del Programa de
 * Embajadores: el flujo, el monto que publica el Superadmin y el CTA por sesión.
 */

function tipo(cambios: Partial<CommissionType> = {}): CommissionType {
  return {
    id: 't1',
    name: 'Base',
    kind: 'percentage',
    amount: null,
    basisPoints: 300,
    isDefault: true,
    active: true,
    createdBy: null,
    createdAt: '2026-09-10T00:00:00Z',
    ...cambios,
  }
}

describe('RF-48.1 · RF-48.3 · el manifiesto explica el flujo y las condiciones', () => {
  it('ordena hero, flujo, comisión, condiciones y CTA', () => {
    expect(SECCIONES_DE_EMBAJADORES.map(s => s.id)).toEqual([...IDS_DE_EMBAJADORES])
    expect(problemasDelManifiesto(SECCIONES_DE_EMBAJADORES)).toEqual([])
  })

  it('RF-48.1 · el flujo tiene los cuatro pasos: refiero, compra, paga la totalidad, se libera', () => {
    expect([...PASOS_DEL_PROGRAMA]).toEqual(['refer', 'purchase', 'pay', 'release'])
  })

  it('RF-48.3 · las condiciones publicadas son las decisiones vigentes del programa', () => {
    expect([...CONDICIONES_DEL_PROGRAMA]).toEqual(['window', 'first_click', 'no_self', 'one_commission', 'grace', 'minimum', 'roles'])
  })
})

describe('CA-48.1 · el monto vigente se publica con su formato, nunca fijo en el código', () => {
  it('CA-48.1 · un tipo porcentual se publica como porcentaje', () => {
    expect(comisionPublicada(tipo(), 'es')).toEqual({ kind: 'percentage', name: 'Base', texto: formatearPorcentaje(300, 'es') })
    expect(comisionPublicada(tipo(), 'en')?.texto).toBe(formatearPorcentaje(300, 'en'))
  })

  it('CA-48.1 · un tipo de importe fijo se publica como importe en pesos', () => {
    const fijo = tipo({ kind: 'fixed', amount: pesos(1_500_000), basisPoints: null, name: 'Bono' })
    expect(comisionPublicada(fijo, 'es')).toEqual({ kind: 'fixed', name: 'Bono', texto: formatearImporte(pesos(1_500_000), 'es') })
  })

  it('CA-48.1 · sin tipo predeterminado no se inventa una cifra', () => {
    expect(comisionPublicada(null, 'es')).toBe(null)
  })
})

describe('CA-48.2 · el CTA depende de la sesión', () => {
  it('CA-48.2 · sin sesión va al registro; con sesión, a la inscripción de HU-49', () => {
    expect(destinoDelCtaDeEmbajadores({ autenticado: false })).toBe(RUTAS_PUBLICAS.registro)
    expect(destinoDelCtaDeEmbajadores({ autenticado: true })).toBe(RUTA_DE_INSCRIPCION)
    expect(RUTA_DE_INSCRIPCION).toBe('/panel/embajador')
  })

  it('RF-48.4 · el manifiesto declara el registro como destino base del CTA', () => {
    expect(SECCIONES_DE_EMBAJADORES.find(s => s.id === 'cta')?.cta?.destino).toBe(RUTAS_PUBLICAS.registro)
  })
})
