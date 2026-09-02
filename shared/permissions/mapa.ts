/**
 * HU-07 · RF-07.2 y RF-07.2b — mapa de permisos tipado.
 *
 * Es la única fuente de la interfaz: ninguna vista decide por su cuenta qué puede
 * hacer un rol. Transcribe la matriz de permisos del VSM §2, capacidad por rol.
 * Las políticas RLS materializan la misma matriz en la base; el middleware de rutas
 * la consulta a través de `decidirAcceso`.
 *
 * D-31 separa dos cosas que el rol solo no resuelve: tener derecho a reservar es
 * del rol Propietario, pero ejercerlo depende del interruptor de calendario de la
 * fracción. Esas capacidades se declaran como condicionadas por estado.
 */

import type { Rol } from './roles'

/** Columnas de la matriz: los cinco roles con cuenta y el Visitante sin sesión. */
export type Columna = Rol | 'visitante'

/** Valor de una celda de la matriz. */
export type Alcance
  = | 'todas' // sobre todas las propiedades o registros
    | 'propias' // solo sobre lo asignado o propio
    | 'lectura' // ver, sin escribir
    | 'si' // capacidad sin ámbito
    | 'no' // denegada al rol
    | 'no_aplica' // no tiene sentido para el rol (ya la ejerció o no la necesita)

/** Vocabulario cerrado de una celda. Ordena de mayor a menor amplitud. */
export const ALCANCES: readonly Alcance[] = ['todas', 'propias', 'lectura', 'si', 'no', 'no_aplica']

export const CAPACIDADES = [
  'ver_sitio_publico',
  'gestionar_propiedades',
  'eliminar_propiedades',
  'gestionar_calendario',
  'reservar_en_su_fraccion',
  'ver_finanzas',
  'gestionar_inventario',
  'registrar_gastos',
  'enviar_novedades',
  'administrar_usuarios_y_roles',
  'registrarse',
  'contactar_o_lista_de_espera',
  'inscribirse_como_embajador',
  'generar_codigo_referido',
  'ver_referidos',
  'ver_saldo_y_retirar',
  'definir_comision',
  'aprobar_pagos_comision',
] as const

export type Capacidad = typeof CAPACIDADES[number]

type Fila = Record<Columna, Alcance>

function fila(
  superadmin: Alcance,
  property_admin: Alcance,
  owner: Alcance,
  ambassador: Alcance,
  user: Alcance,
  visitante: Alcance,
): Fila {
  return { superadmin, property_admin, owner, ambassador, user, visitante }
}

/** Matriz VSM §2. Columnas: Superadmin · Administrador · Propietario · Embajador · Usuario · Visitante. */
export const MATRIZ: Record<Capacidad, Fila> = {
  ver_sitio_publico: fila('si', 'si', 'si', 'si', 'si', 'si'),
  gestionar_propiedades: fila('todas', 'propias', 'no', 'no', 'no', 'no'),
  eliminar_propiedades: fila('si', 'no', 'no', 'no', 'no', 'no'),
  gestionar_calendario: fila('todas', 'propias', 'no', 'no', 'no', 'no'),
  reservar_en_su_fraccion: fila('no', 'no', 'si', 'no', 'no', 'no'),
  ver_finanzas: fila('todas', 'propias', 'propias', 'no', 'no', 'no'),
  gestionar_inventario: fila('no', 'si', 'lectura', 'no', 'no', 'no'),
  registrar_gastos: fila('no', 'si', 'lectura', 'no', 'no', 'no'),
  enviar_novedades: fila('si', 'si', 'no', 'no', 'no', 'no'),
  administrar_usuarios_y_roles: fila('si', 'no', 'no', 'no', 'no', 'no'),
  registrarse: fila('no_aplica', 'no_aplica', 'no_aplica', 'no_aplica', 'no_aplica', 'si'),
  contactar_o_lista_de_espera: fila('no_aplica', 'no_aplica', 'no_aplica', 'si', 'si', 'si'),
  inscribirse_como_embajador: fila('no', 'no', 'si', 'no_aplica', 'si', 'no'),
  // «Propietario ✅ (si es Embajador)» en el VSM: la capacidad la da el rol Embajador,
  // que el Propietario acumula. Por eso la celda de Propietario a secas es «no».
  generar_codigo_referido: fila('no', 'no', 'no', 'si', 'no', 'no'),
  ver_referidos: fila('todas', 'no', 'no', 'propias', 'no', 'no'),
  ver_saldo_y_retirar: fila('no', 'no', 'no', 'si', 'no', 'no'),
  definir_comision: fila('si', 'no', 'no', 'no', 'no', 'no'),
  aprobar_pagos_comision: fila('si', 'no', 'no', 'no', 'no', 'no'),
}

/** La matriz completa: qué alcance tiene cada capacidad para cada columna. */
export type Matriz = Record<Capacidad, Fila>

/** Un ajuste del Superadmin sobre una celda (HU-07 · RF-07.3). */
export interface AjusteDeCapacidad {
  capacidad: Capacidad
  columna: Columna
  alcance: Alcance
}

/** Orden de columnas de la matriz VSM: Superadmin · Administrador · Propietario · Embajador · Usuario · Visitante. */
export const COLUMNAS: readonly Columna[] = ['superadmin', 'property_admin', 'owner', 'ambassador', 'user', 'visitante']

/**
 * Capacidades que además de la interfaz hace cumplir la base de datos por RLS
 * (RF-07.2). Ampliar una de estas en la pantalla no concede acceso a los datos:
 * la política SQL sigue mandando y hay que cambiarla en una migración. La lista
 * crece con cada historia que trae sus tablas.
 */
export const CAPACIDADES_EN_BASE_DE_DATOS: readonly Capacidad[] = [
  'administrar_usuarios_y_roles',
]

/** Estados que condicionan una capacidad además del rol (RF-07.2b, D-31). */
export const CAPACIDADES_CONDICIONADAS = {
  reservar_en_su_fraccion: 'calendario_activo',
} as const satisfies Partial<Record<Capacidad, string>>

export type CapacidadCondicionada = keyof typeof CAPACIDADES_CONDICIONADAS

/** Contexto de estado con que se evalúa una capacidad condicionada. */
export interface Contexto {
  /** Interruptor de calendario de la fracción sobre la que se quiere reservar. */
  calendarioActivo?: boolean
  /** La operación escribe: un alcance de solo lectura no basta. */
  escritura?: boolean
}

/**
 * La matriz del VSM con los ajustes del Superadmin aplicados encima.
 *
 * La base es código inmutable —es la referencia del negocio y lo que prueba
 * CA-07.1—; los ajustes son datos. Así un cambio en la pantalla nunca reescribe la
 * referencia y siempre se puede volver a ella retirando el ajuste. Lo que no
 * pertenezca al vocabulario se ignora: la base puede traer filas viejas.
 */
export function matrizEfectiva(ajustes: readonly AjusteDeCapacidad[]): Matriz {
  const efectiva = Object.fromEntries(
    CAPACIDADES.map(capacidad => [capacidad, { ...MATRIZ[capacidad] }]),
  ) as Matriz

  for (const ajuste of ajustes) {
    if (!CAPACIDADES.includes(ajuste.capacidad)) {
      continue
    }
    if (!COLUMNAS.includes(ajuste.columna) || !ALCANCES.includes(ajuste.alcance)) {
      continue
    }
    efectiva[ajuste.capacidad][ajuste.columna] = ajuste.alcance
  }

  return efectiva
}

/** Una fila de la matriz tal como la pinta la interfaz (RF-07.3: «ver permisos por módulo»). */
export interface FilaDeMatriz {
  capacidad: Capacidad
  /** Estado que condiciona la capacidad, si lo hay (RF-07.2b). */
  condicion: string | null
  /** La base de datos también la hace cumplir: ampliarla aquí no basta. */
  enBaseDeDatos: boolean
  alcances: Record<Columna, Alcance>
}

/** La matriz como filas, para que ninguna vista la recomponga por su cuenta. */
export function filasDeMatriz(matriz: Matriz = MATRIZ): FilaDeMatriz[] {
  return CAPACIDADES.map(capacidad => ({
    capacidad,
    condicion: (CAPACIDADES_CONDICIONADAS as Partial<Record<Capacidad, string>>)[capacidad] ?? null,
    enBaseDeDatos: CAPACIDADES_EN_BASE_DE_DATOS.includes(capacidad),
    alcances: matriz[capacidad],
  }))
}

/** De mayor a menor amplitud, para resolver cuentas con varios roles. */
const PRECEDENCIA: readonly Alcance[] = ['todas', 'propias', 'lectura', 'si', 'no_aplica', 'no']

/** Alcance más amplio que otorgan los roles de la cuenta; sin roles, el del Visitante. */
export function alcanceDe(roles: readonly Rol[], capacidad: Capacidad, matriz: Matriz = MATRIZ): Alcance {
  const columnas: Columna[] = roles.length === 0 ? ['visitante'] : [...roles]
  const alcances = columnas.map(columna => matriz[capacidad][columna])

  return PRECEDENCIA.find(alcance => alcances.includes(alcance)) ?? 'no'
}

function esCondicionada(capacidad: Capacidad): capacidad is CapacidadCondicionada {
  return capacidad in CAPACIDADES_CONDICIONADAS
}

/** ¿Puede la cuenta ejercer la capacidad, dado su conjunto de roles y el contexto? */
export function puede(
  roles: readonly Rol[],
  capacidad: Capacidad,
  contexto: Contexto = {},
  matriz: Matriz = MATRIZ,
): boolean {
  const alcance = alcanceDe(roles, capacidad, matriz)

  if (alcance === 'no' || alcance === 'no_aplica') {
    return false
  }
  if (alcance === 'lectura' && contexto.escritura) {
    return false
  }
  if (esCondicionada(capacidad) && contexto.calendarioActivo !== true) {
    return false
  }

  return true
}
