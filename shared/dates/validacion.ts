/**
 * DT-12 · un día de calendario `AAAA-MM-DD` es válido solo si existe: `2026-02-30`
 * tiene la forma pero no el día. Se comprueba en UTC porque el texto no lleva
 * zona horaria y solo interesa que el calendario lo reconozca.
 */

const DIA = /^\d{4}-\d{2}-\d{2}$/

export function esFecha(texto: string): boolean {
  if (!DIA.test(texto)) {
    return false
  }
  const fecha = new Date(`${texto}T00:00:00Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(texto)
}
