import { describe, expect, it } from 'vitest'
import type { Alcance, Capacidad, Columna } from '#shared/permissions/mapa'
import { alcanceDe, CAPACIDADES, CAPACIDADES_CONDICIONADAS, MATRIZ, puede } from '#shared/permissions/mapa'
import { esCombinacionValida, ROLES } from '#shared/permissions/roles'

/**
 * HU-07 · RF-07.2 y RF-07.2b — el mapa de permisos tipado es la única fuente de
 * la interfaz. Nivel N1: sin Nuxt ni base de datos.
 *
 * La tabla esperada de abajo es una transcripción literal de la matriz del VSM §2.
 * Que exista dos veces (aquí y en `shared/permissions/mapa.ts`) es el punto del
 * "test tabla-completa": si alguien toca una celda del mapa sin tocar la spec, esto
 * falla.
 */

// Orden de columnas de la matriz VSM: Superadmin, Admin, Propietario, Embajador, Usuario, Visitante.
const COLUMNAS: Columna[] = ['superadmin', 'property_admin', 'owner', 'ambassador', 'user', 'visitante']

const T: Alcance = 'todas'
const P: Alcance = 'propias'
const L: Alcance = 'lectura'
const S: Alcance = 'si'
const N: Alcance = 'no'
const X: Alcance = 'no_aplica'

const ESPERADO: Record<Capacidad, Alcance[]> = {
  ver_sitio_publico: [S, S, S, S, S, S],
  gestionar_propiedades: [T, P, N, N, N, N],
  eliminar_propiedades: [S, N, N, N, N, N],
  gestionar_calendario: [T, P, N, N, N, N],
  reservar_en_su_fraccion: [N, N, S, N, N, N],
  ver_finanzas: [T, P, P, N, N, N],
  gestionar_inventario: [N, S, L, N, N, N],
  registrar_gastos: [N, S, L, N, N, N],
  enviar_novedades: [S, S, N, N, N, N],
  administrar_usuarios_y_roles: [S, N, N, N, N, N],
  registrarse: [X, X, X, X, X, S],
  contactar_o_lista_de_espera: [X, X, X, S, S, S],
  inscribirse_como_embajador: [N, N, S, X, S, N],
  generar_codigo_referido: [N, N, N, S, N, N],
  ver_referidos: [T, N, N, P, N, N],
  ver_saldo_y_retirar: [N, N, N, S, N, N],
  definir_comision: [S, N, N, N, N, N],
  aprobar_pagos_comision: [S, N, N, N, N, N],
}

describe('CA-07.1 · el mapa de permisos coincide celda a celda con la matriz VSM', () => {
  it('declara exactamente las capacidades de la matriz', () => {
    expect([...CAPACIDADES].sort()).toEqual(Object.keys(ESPERADO).sort())
  })

  it.each(Object.entries(ESPERADO))('%s', (capacidad, fila) => {
    for (const [indice, columna] of COLUMNAS.entries()) {
      expect(MATRIZ[capacidad as Capacidad][columna], `${capacidad} × ${columna}`).toBe(fila[indice])
    }
  })
})

describe('puede · combinación de roles acumulados', () => {
  it('un visitante (sin sesión) solo ve el sitio público, se registra o contacta', () => {
    expect(puede([], 'ver_sitio_publico')).toBe(true)
    expect(puede([], 'registrarse')).toBe(true)
    expect(puede([], 'gestionar_propiedades')).toBe(false)
  })

  it('el alcance más amplio gana cuando la cuenta acumula roles', () => {
    expect(alcanceDe(['owner', 'ambassador'], 'ver_referidos')).toBe('propias')
    expect(alcanceDe(['superadmin', 'ambassador'], 'ver_referidos')).toBe('todas')
  })

  it('CA-07.4 · un Propietario que además es Embajador conserva ambos permisos', () => {
    const roles = ['owner', 'ambassador'] as const
    expect(puede([...roles], 'reservar_en_su_fraccion', { calendarioActivo: true })).toBe(true)
    expect(puede([...roles], 'generar_codigo_referido')).toBe(true)
    expect(puede([...roles], 'ver_saldo_y_retirar')).toBe(true)
  })

  it('"solo lectura" cuenta como permiso de lectura, no de escritura', () => {
    expect(alcanceDe(['owner'], 'gestionar_inventario')).toBe('lectura')
    expect(puede(['owner'], 'gestionar_inventario')).toBe(true)
    expect(puede(['owner'], 'gestionar_inventario', { escritura: true })).toBe(false)
  })
})

describe('RF-07.2b · capacidades condicionadas por estado (D-31)', () => {
  it('el mapa distingue la capacidad de rol de la condicionada por estado', () => {
    expect(CAPACIDADES_CONDICIONADAS.reservar_en_su_fraccion).toBe('calendario_activo')
    expect(Object.keys(CAPACIDADES_CONDICIONADAS)).toEqual(['reservar_en_su_fraccion'])
  })

  it('el rol Propietario no basta para reservar: exige el interruptor de calendario activo', () => {
    expect(puede(['owner'], 'reservar_en_su_fraccion')).toBe(false)
    expect(puede(['owner'], 'reservar_en_su_fraccion', { calendarioActivo: false })).toBe(false)
    expect(puede(['owner'], 'reservar_en_su_fraccion', { calendarioActivo: true })).toBe(true)
  })

  it('el interruptor no otorga la capacidad a quien no tiene el rol', () => {
    expect(puede(['user'], 'reservar_en_su_fraccion', { calendarioActivo: true })).toBe(false)
  })
})

describe('RF-07.1 · los seis roles y su acumulación', () => {
  it('declara los cinco roles con cuenta; el Visitante es la ausencia de sesión', () => {
    expect([...ROLES]).toEqual(['superadmin', 'property_admin', 'owner', 'ambassador', 'user'])
  })

  it('Embajador se acumula con Usuario o con Propietario', () => {
    expect(esCombinacionValida(['user', 'ambassador'])).toBe(true)
    expect(esCombinacionValida(['owner', 'ambassador'])).toBe(true)
  })

  it('Embajador no se acumula con Superadmin ni con Administrador', () => {
    expect(esCombinacionValida(['superadmin', 'ambassador'])).toBe(false)
    expect(esCombinacionValida(['property_admin', 'ambassador'])).toBe(false)
  })

  it('un solo rol siempre es válido', () => {
    for (const rol of ROLES) {
      expect(esCombinacionValida([rol])).toBe(true)
    }
  })
})
