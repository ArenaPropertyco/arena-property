import { describe, expect, it } from 'vitest'
import { inicialesDe, nombreParaMostrar } from '#shared/identity/perfil'

/**
 * Presentación de la identidad en el menú de cuenta del panel. Puro: sin Supabase,
 * sin interfaz. El correo completo no se muestra como nombre — solo su parte local.
 */

describe('nombreParaMostrar', () => {
  it('prefiere el nombre real cuando el perfil lo tiene', () => {
    expect(nombreParaMostrar({ fullName: 'Ana María Pérez', email: 'ana@ejemplo.com' }))
      .toBe('Ana María Pérez')
  })

  it('sin nombre, usa la parte local del correo y no el correo entero', () => {
    expect(nombreParaMostrar({ fullName: null, email: 'alascarbonycerdo@gmail.com' }))
      .toBe('alascarbonycerdo')
  })

  it('un nombre en blanco cuenta como ausente', () => {
    expect(nombreParaMostrar({ fullName: '   ', email: 'ana@ejemplo.com' })).toBe('ana')
  })

  it('sin nombre ni correo devuelve cadena vacía, no «undefined»', () => {
    expect(nombreParaMostrar({})).toBe('')
    expect(nombreParaMostrar({ fullName: null, email: null })).toBe('')
  })
})

describe('inicialesDe', () => {
  it('toma como mucho dos iniciales, en mayúscula', () => {
    expect(inicialesDe('Ana María Pérez')).toBe('AM')
  })

  it('con una sola palabra devuelve una inicial', () => {
    expect(inicialesDe('alascarbonycerdo')).toBe('A')
  })

  it('separa también por puntos, guiones y guiones bajos, como los correos', () => {
    expect(inicialesDe('ana.maria')).toBe('AM')
    expect(inicialesDe('juan-perez')).toBe('JP')
  })

  it('con texto vacío no inventa iniciales', () => {
    expect(inicialesDe('')).toBe('')
    expect(inicialesDe('   ')).toBe('')
  })
})
