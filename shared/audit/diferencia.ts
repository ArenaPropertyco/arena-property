/**
 * TR-01 · RF-A.7 — armado de la entrada de auditoría.
 *
 * Es una función pura sobre el par (estado anterior, estado posterior): quien la
 * llama decide de dónde salen los estados y quién los escribe. Así el diff se puede
 * probar sin base de datos y no depende de la ruta que ejecutó la operación.
 *
 * La entrada guarda tanto los estados completos como el diff. Los completos permiten
 * reconstruir el hecho aunque el modelo cambie después; el diff hace legible qué se
 * tocó sin obligar a comparar dos JSON a ojo (HU-24 y las pantallas de histórico).
 */

/** Valor de un campo dentro de un estado auditado. */
export type ValorAuditable = unknown

/** Estado de una entidad en un momento dado. `null` en altas y bajas. */
export type Estado = Record<string, ValorAuditable> | null

/** Cambio de un campo concreto. `undefined` significa que el campo no estaba. */
export interface Cambio {
  antes: ValorAuditable
  despues: ValorAuditable
}

export type Cambios = Record<string, Cambio>

export interface Entidad {
  tipo: string
  id: string
}

export interface DatosDeEntrada {
  accion: string
  entidad: Entidad
  propiedadId?: string
  motivo?: string
  anterior: Estado
  posterior: Estado
}

export interface EntradaDeAuditoria {
  accion: string
  entidad: Entidad
  propiedadId?: string
  motivo?: string
  cambios: Cambios
  anterior: Estado
  posterior: Estado
}

/**
 * Comparación en profundidad por valor. Se usa la serialización canónica porque los
 * estados auditados provienen de JSON: no hay funciones, ciclos ni fechas vivas.
 */
function sonIguales(a: ValorAuditable, b: ValorAuditable): boolean {
  if (a === b) {
    return true
  }
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/**
 * Campos que cambiaron entre dos estados. Los que no cambiaron no aparecen: una
 * auditoría que repite lo que siguió igual esconde lo que sí se movió.
 *
 * Un campo ausente y un campo en `null` son hechos distintos y se distinguen.
 */
export function diferenciaDeEstados(anterior: Estado, posterior: Estado): Cambios {
  const antes = anterior ?? {}
  const despues = posterior ?? {}
  const campos = new Set([...Object.keys(antes), ...Object.keys(despues)])
  const cambios: Cambios = {}

  for (const campo of campos) {
    const valorAntes = Object.hasOwn(antes, campo) ? antes[campo] : undefined
    const valorDespues = Object.hasOwn(despues, campo) ? despues[campo] : undefined

    if (!sonIguales(valorAntes, valorDespues)) {
      cambios[campo] = { antes: valorAntes, despues: valorDespues }
    }
  }

  return cambios
}

/** Entrada de auditoría lista para escribirse, con su diff ya calculado. */
export function armarEntrada(datos: DatosDeEntrada): EntradaDeAuditoria {
  return {
    accion: datos.accion,
    entidad: datos.entidad,
    propiedadId: datos.propiedadId,
    motivo: datos.motivo,
    cambios: diferenciaDeEstados(datos.anterior, datos.posterior),
    anterior: datos.anterior,
    posterior: datos.posterior,
  }
}
