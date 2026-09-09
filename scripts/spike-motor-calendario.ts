/**
 * HU-12 · T-098 — spike desechable del motor de reparto.
 *
 * Demuestra sobre 8 años consecutivos que la rotación cumple I-05 e I-06 y mide
 * cuánto cuesta calcular un ciclo completo. No forma parte de la aplicación:
 * `node node_modules/.pnpm/jiti@2.7.0/node_modules/jiti/lib/jiti-cli.mjs scripts/spike-motor-calendario.ts`
 * (jiti ya viene con Nuxt y resuelve las importaciones sin extensión de `shared/`).
 */

import { performance } from 'node:perf_hooks'
import { rejillaDelAnio } from '../shared/scheduling/rejilla.ts'
import { repartir } from '../shared/scheduling/reparto.ts'
import { BLOQUES_PICO, clasificacionBase, sugerirBloquesPico } from '../shared/scheduling/temporadas.ts'
import type { SemanaClasificada } from '../shared/scheduling/temporadas.ts'

function clasificacion(anio: number): SemanaClasificada[] {
  const rejilla = rejillaDelAnio(anio)
  const picos = sugerirBloquesPico(anio, rejilla)
  const altas = new Set<number>([picos.christmas, picos.new_year, picos.holy_week])
  for (let i = 0; altas.size < 8; i++) altas.add(i)
  let ma = 0
  let me = 0
  return clasificacionBase(rejilla).map((s) => {
    if (altas.has(s.indice)) return { ...s, temporada: 'alta', bloquePico: BLOQUES_PICO.find(b => picos[b] === s.indice) ?? null }
    if (ma++ < 8) return { ...s, temporada: 'media_alta', bloquePico: null }
    if (me++ < 8) return { ...s, temporada: 'media', bloquePico: null }
    return { ...s, temporada: 'baja', bloquePico: null }
  })
}

const BASE = 2026
const inicio = performance.now()
const ciclo = Array.from({ length: 8 }, (_, i) => BASE + i)
  .map(anio => repartir({ anio, anioBase: BASE, rejilla: rejillaDelAnio(anio), semanas: clasificacion(anio) }))
const duracion = performance.now() - inicio

console.log(`Ciclo de 8 años (${BASE}–${BASE + 7}) calculado en ${duracion.toFixed(2)} ms\n`)
console.log('Fracción │ ' + ciclo.map(r => String(r.anio)).join(' │ '))
console.log('─────────┼' + ciclo.map(() => '──────').join('┼'))
for (let f = 1; f <= 8; f++) {
  const celdas = ciclo.map((r) => {
    const a = r.asignaciones.find(x => x.fraccion === f)!
    const pico = a.bloquesPico[0] ? a.bloquesPico[0].slice(0, 3).toUpperCase() : '   '
    return `p${a.posicion} ${pico}`
  })
  console.log(`    ${f}    │ ` + celdas.join(' │ '))
}
console.log('\nLeyenda: pN = posición de reparto · CHR Navidad · NEW Año Nuevo · HOL Semana Santa')

const posicionesPorFraccion = Array.from({ length: 8 }, (_, i) => new Set(ciclo.map(r => r.asignaciones[i]!.posicion)).size)
const bloquesPorFraccion = Array.from({ length: 8 }, (_, i) => ciclo.flatMap(r => r.asignaciones[i]!.bloquesPico).length)
console.log(`\nI-06 · posiciones distintas por fracción en 8 años: ${posicionesPorFraccion.join(' ')} (esperado 8)`)
console.log(`I-06 · bloques pico por fracción en 8 años: ${bloquesPorFraccion.join(' ')} (esperado 3)`)
console.log(`Bolsa del Administrador por año: ${ciclo.map(r => r.bolsaDelAdministrador.length).join(' ')} semanas`)
