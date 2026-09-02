import { describe, expect, it } from 'vitest'
import type { AjusteDeCapacidad } from '#shared/permissions/mapa'
import {
  ALCANCES,
  CAPACIDADES_EN_BASE_DE_DATOS,
  MATRIZ,
  alcanceDe,
  filasDeMatriz,
  matrizEfectiva,
  puede,
} from '#shared/permissions/mapa'
import { decidirAcceso } from '#shared/permissions/acceso'

/**
 * HU-07 · RF-07.3 — el Superadmin ajusta la matriz por celda.
 *
 * La matriz del VSM sigue siendo código inmutable: es la base y lo que prueba
 * CA-07.1. Los ajustes son datos que se aplican encima. Así un cambio en la
 * pantalla nunca reescribe la referencia del negocio, y siempre se puede volver a ella.
 */

const ajuste = (capacidad: string, columna: string, alcance: string) =>
  ({ capacidad, columna, alcance }) as AjusteDeCapacidad

describe('matrizEfectiva', () => {
  it('sin ajustes devuelve la matriz del VSM', () => {
    expect(matrizEfectiva([])).toEqual(MATRIZ)
  })

  it('aplica un ajuste sobre la celda indicada y deja el resto igual', () => {
    const efectiva = matrizEfectiva([ajuste('gestionar_propiedades', 'owner', 'propias')])

    expect(efectiva.gestionar_propiedades.owner).toBe('propias')
    expect(efectiva.gestionar_propiedades.superadmin).toBe('todas')
    expect(efectiva.ver_finanzas).toEqual(MATRIZ.ver_finanzas)
  })

  it('no muta la matriz base: la referencia del VSM queda intacta', () => {
    matrizEfectiva([ajuste('gestionar_propiedades', 'owner', 'todas')])

    expect(MATRIZ.gestionar_propiedades.owner).toBe('no')
  })

  it('ignora ajustes con capacidad, columna o alcance que no existen', () => {
    const efectiva = matrizEfectiva([
      ajuste('capacidad_inventada', 'owner', 'si'),
      ajuste('ver_finanzas', 'columna_inventada', 'si'),
      ajuste('ver_finanzas', 'owner', 'alcance_inventado'),
    ])

    expect(efectiva).toEqual(MATRIZ)
  })

  it('el último ajuste sobre la misma celda es el que manda', () => {
    const efectiva = matrizEfectiva([
      ajuste('enviar_novedades', 'owner', 'si'),
      ajuste('enviar_novedades', 'owner', 'no'),
    ])

    expect(efectiva.enviar_novedades.owner).toBe('no')
  })

  it('declara los seis alcances posibles de una celda', () => {
    expect([...ALCANCES]).toEqual(['todas', 'propias', 'lectura', 'si', 'no', 'no_aplica'])
  })
})

describe('las decisiones honran la matriz efectiva', () => {
  const conAjuste = matrizEfectiva([ajuste('administrar_usuarios_y_roles', 'property_admin', 'si')])

  it('alcanceDe usa la matriz que se le pase', () => {
    expect(alcanceDe(['property_admin'], 'administrar_usuarios_y_roles')).toBe('no')
    expect(alcanceDe(['property_admin'], 'administrar_usuarios_y_roles', conAjuste)).toBe('si')
  })

  it('puede usa la matriz que se le pase', () => {
    expect(puede(['property_admin'], 'administrar_usuarios_y_roles')).toBe(false)
    expect(puede(['property_admin'], 'administrar_usuarios_y_roles', {}, conAjuste)).toBe(true)
  })

  it('la guarda de rutas también, para que la interfaz y el acceso no se contradigan', () => {
    const sesion = {
      autenticado: true,
      verificado: true,
      estadoCuenta: 'active' as const,
      roles: ['property_admin' as const],
    }
    const requisito = { privada: true, capacidad: 'administrar_usuarios_y_roles' as const }

    expect(decidirAcceso(sesion, requisito).permitido).toBe(false)
    expect(decidirAcceso(sesion, requisito, conAjuste).permitido).toBe(true)
  })

  it('un ajuste no rompe las capacidades condicionadas por estado (D-31)', () => {
    const abierta = matrizEfectiva([ajuste('reservar_en_su_fraccion', 'user', 'si')])

    expect(puede(['user'], 'reservar_en_su_fraccion', {}, abierta)).toBe(false)
    expect(puede(['user'], 'reservar_en_su_fraccion', { calendarioActivo: true }, abierta)).toBe(true)
  })
})

describe('filasDeMatriz', () => {
  it('refleja los ajustes aplicados', () => {
    const filas = filasDeMatriz(matrizEfectiva([ajuste('eliminar_propiedades', 'property_admin', 'si')]))
    const fila = filas.find(f => f.capacidad === 'eliminar_propiedades')

    expect(fila?.alcances.property_admin).toBe('si')
  })

  it('marca qué capacidades también hace cumplir la base de datos', () => {
    const fila = filasDeMatriz().find(f => f.capacidad === 'administrar_usuarios_y_roles')

    expect(fila?.enBaseDeDatos).toBe(true)
    expect(CAPACIDADES_EN_BASE_DE_DATOS).toContain('administrar_usuarios_y_roles')
  })

  it('una capacidad que hoy solo gobierna la interfaz no se marca', () => {
    const fila = filasDeMatriz().find(f => f.capacidad === 'ver_sitio_publico')

    expect(fila?.enBaseDeDatos).toBe(false)
  })
})
