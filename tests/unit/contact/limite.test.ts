import { describe, expect, it } from 'vitest'
import { clavesDeTasa, crearLimitador, POLITICA_DE_CONTACTO } from '#shared/contact/limite'

/**
 * D-24 · los formularios públicos tienen límite de tasa por IP y por correo, para
 * que el envío de correo no sea un vector de abuso. Ventana deslizante en memoria.
 */

describe('D-24 · límite de tasa de los formularios públicos', () => {
  it('admite hasta el máximo de la política dentro de la ventana y rechaza el siguiente', () => {
    let ahora = 1_000
    const limitador = crearLimitador({ maximo: 3, ventanaMs: 60_000 }, () => ahora)

    expect(limitador.admite('ip:1.1.1.1')).toBe(true)
    expect(limitador.admite('ip:1.1.1.1')).toBe(true)
    expect(limitador.admite('ip:1.1.1.1')).toBe(true)
    expect(limitador.admite('ip:1.1.1.1')).toBe(false)

    ahora += 60_001
    expect(limitador.admite('ip:1.1.1.1')).toBe(true)
  })

  it('las claves son independientes: otra IP no comparte cupo', () => {
    const limitador = crearLimitador({ maximo: 1, ventanaMs: 60_000 }, () => 0)
    expect(limitador.admite('ip:a')).toBe(true)
    expect(limitador.admite('ip:b')).toBe(true)
    expect(limitador.admite('ip:a')).toBe(false)
  })

  it('un envío se limita por IP y por correo a la vez', () => {
    expect(clavesDeTasa({ ip: '1.1.1.1', email: 'Ana@Ejemplo.com' })).toEqual(['ip:1.1.1.1', 'email:ana@ejemplo.com'])
  })

  it('la política del contacto es conservadora: pocos envíos por ventana', () => {
    expect(POLITICA_DE_CONTACTO.maximo).toBeLessThanOrEqual(5)
    expect(POLITICA_DE_CONTACTO.ventanaMs).toBeGreaterThanOrEqual(5 * 60 * 1000)
  })
})
