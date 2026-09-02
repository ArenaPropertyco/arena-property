/**
 * Informe de trazabilidad CA → test (principio 4 de la constitución, plan §5.1).
 *
 * Cruza los criterios de aceptación declarados en `specs/001-Arena-Property/`
 * contra los criterios que los tests citan por identificador.
 *
 * Regla de la compuerta: falla cuando un CA **exigido por una tarea ya marcada
 * como hecha en `tasks.md`** no tiene test que lo cite, y cuando un test cita un
 * CA que ninguna spec declara. Los CA de trabajo aún no emprendido se listan como
 * pendientes, no como incumplimiento: así el informe es una compuerta útil desde
 * el primer sprint y se vuelve cobertura total cuando la última tarea queda hecha.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface Informe {
  declarados: number
  probados: number
  /** CA declarados que todavía no tiene ningún test. */
  sinPrueba: string[]
  /** CA que una tarea hecha prometió y ningún test cita. Rompen la compuerta. */
  incumplidos: string[]
  /** CA citados por un test que ninguna spec declara. Rompen la compuerta. */
  huerfanos: string[]
  pasa: boolean
}

const IDENTIFICADOR = String.raw`CA-[A-Z0-9]+\.\d+`

function unicos(valores: string[]): string[] {
  return [...new Set(valores)]
}

/** CA declarados en una spec: aparecen en negrita al abrir el criterio. */
export function extraerDeclarados(spec: string): string[] {
  return unicos([...spec.matchAll(new RegExp(String.raw`\*\*(${IDENTIFICADOR})\*\*`, 'g'))]
    .map(coincidencia => coincidencia[1]!))
}

/**
 * CA citados por un archivo de test. Solo cuentan los que aparecen en el título de
 * un `describe` o un `it`: el plan §5.1 exige que el nombre del test empiece por su
 * criterio, y así una mención de paso en un comentario no simula cobertura.
 */
export function extraerProbados(test: string): string[] {
  const titulos = [...test.matchAll(/(?:describe|it|test)(?:\.\w+)*\(\s*(['"`])([\s\S]*?)\1/g)]
    .map(coincidencia => coincidencia[2]!)

  return unicos(titulos.flatMap(titulo =>
    [...titulo.matchAll(new RegExp(`(${IDENTIFICADOR})`, 'g'))].map(c => c[1]!)))
}

/** CA prometidos por tareas ya marcadas `[x]` en tasks.md. */
export function extraerExigidos(tasks: string): string[] {
  const bloques = tasks.split(/^- \[/m).slice(1)

  return unicos(bloques
    .filter(bloque => bloque.startsWith('x]'))
    .flatMap(bloque => [...bloque.matchAll(new RegExp(`(${IDENTIFICADOR})`, 'g'))]
      .map(coincidencia => coincidencia[1]!)))
}

/**
 * CA citados por una prueba pgTAP. Cuentan los que aparecen dentro del texto de una
 * aserción —la descripción que pgTAP imprime—, no los de un comentario `--`: el
 * nivel N2 del plan §5 vive en `supabase/tests/` y también debe contar como prueba.
 */
export function extraerProbadosSql(sql: string): string[] {
  const sinComentarios = sql.replace(/--.*$/gm, '')
  const descripciones = [...sinComentarios.matchAll(/'((?:[^']|'')*)'/g)]
    .map(coincidencia => coincidencia[1]!)

  return unicos(descripciones.flatMap(texto =>
    [...texto.matchAll(new RegExp(`(${IDENTIFICADOR})`, 'g'))].map(c => c[1]!)))
}

export function cruzar(declarados: string[], probados: string[], exigidos: string[]): Informe {
  const declaradosUnicos = unicos(declarados)
  const probadosUnicos = unicos(probados)

  const sinPrueba = declaradosUnicos.filter(ca => !probadosUnicos.includes(ca))
  const incumplidos = unicos(exigidos).filter(ca => !probadosUnicos.includes(ca))
  const huerfanos = probadosUnicos.filter(ca => !declaradosUnicos.includes(ca))

  return {
    declarados: declaradosUnicos.length,
    probados: probadosUnicos.filter(ca => declaradosUnicos.includes(ca)).length,
    sinPrueba,
    incumplidos,
    huerfanos,
    pasa: incumplidos.length === 0 && huerfanos.length === 0,
  }
}

function archivos(directorio: string, extension: string): string[] {
  let entradas: string[]
  try {
    entradas = readdirSync(directorio)
  }
  catch {
    return []
  }

  return entradas.flatMap((entrada) => {
    const ruta = join(directorio, entrada)
    return statSync(ruta).isDirectory()
      ? archivos(ruta, extension)
      : (entrada.endsWith(extension) ? [ruta] : [])
  })
}

export function generarInforme(raiz = process.cwd()): Informe {
  const specs = archivos(resolve(raiz, 'specs'), '.md')
    .filter(ruta => !ruta.endsWith('tasks.md'))
  // El propio test del informe usa identificadores inventados como datos de prueba;
  // contarlos daría cobertura y huérfanos falsos.
  const tests = archivos(resolve(raiz, 'tests'), '.ts')
    .filter(ruta => !ruta.endsWith('trazabilidad.test.ts'))
  const tasks = readFileSync(resolve(raiz, 'specs/001-Arena-Property/tasks.md'), 'utf8')

  const pruebasSql = archivos(resolve(raiz, 'supabase/tests'), '.sql')

  return cruzar(
    specs.flatMap(ruta => extraerDeclarados(readFileSync(ruta, 'utf8'))),
    [
      ...tests.flatMap(ruta => extraerProbados(readFileSync(ruta, 'utf8'))),
      ...pruebasSql.flatMap(ruta => extraerProbadosSql(readFileSync(ruta, 'utf8'))),
    ],
    extraerExigidos(tasks),
  )
}

function principal(): void {
  const informe = generarInforme()
  const porcentaje = informe.declarados === 0
    ? 0
    : Math.round((informe.probados / informe.declarados) * 100)

  console.log('Trazabilidad CA → test')
  console.log(`  CA declarados en specs : ${informe.declarados}`)
  console.log(`  CA con test que los cita: ${informe.probados} (${porcentaje}%)`)
  console.log(`  CA sin test todavía     : ${informe.sinPrueba.length}`)

  if (informe.incumplidos.length > 0) {
    console.error('\nTareas marcadas como hechas cuyo CA no tiene test:')
    informe.incumplidos.forEach(ca => console.error(`  - ${ca}`))
  }

  if (informe.huerfanos.length > 0) {
    console.error('\nTests que citan un CA que ninguna spec declara:')
    informe.huerfanos.forEach(ca => console.error(`  - ${ca}`))
  }

  if (!informe.pasa) {
    process.exitCode = 1
    return
  }

  console.log('\nSin incumplimientos: todo CA prometido por una tarea hecha tiene test.')
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  principal()
}
