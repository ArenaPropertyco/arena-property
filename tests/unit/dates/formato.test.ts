import { describe, expect, it } from 'vitest'
import { ZONA_HORARIA, formatearDia, formatearInstante, hoy } from '#shared/dates/formato'

/**
 * DT-12 · las fechas se formatean en la zona del negocio, sin depender de la del
 * navegador ni del servidor.
 */

describe('DT-12 · formato de fechas', () => {
  it('la zona del negocio es Bogotá', () => {
    expect(ZONA_HORARIA).toBe('America/Bogota')
  })

  it('un día de calendario se muestra como el mismo día en los dos idiomas', () => {
    expect(formatearDia('2026-09-03', 'es')).toMatch(/3.*sept?.*2026/i)
    expect(formatearDia('2026-09-03', 'en')).toBe('Sep 3, 2026')
  })

  it('lo que no es un día se devuelve intacto', () => {
    expect(formatearDia('hoy', 'es')).toBe('hoy')
  })

  it('un instante se muestra con hora en la zona del negocio', () => {
    // 03:30 UTC del 4 de septiembre son las 22:30 del 3 en Bogotá.
    expect(formatearInstante('2026-09-04T03:30:00Z', 'en')).toBe('Sep 3, 2026, 10:30 PM')
  })

  it('«hoy» es un día de calendario en Bogotá, no en UTC', () => {
    expect(hoy(new Date('2026-09-04T03:30:00Z'))).toBe('2026-09-03')
  })
})
