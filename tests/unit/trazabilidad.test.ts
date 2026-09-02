import { describe, expect, it } from 'vitest'
import {
  cruzar,
  extraerDeclarados,
  extraerExigidos,
  extraerProbados,
  extraerProbadosSql,
} from '../../scripts/trazabilidad'

/**
 * Principio 4 · el informe que cruza los CA declarados en las specs contra los
 * CA citados por los tests. Nivel N1: funciones puras, sin leer disco.
 */

describe('extraerDeclarados', () => {
  it('toma los CA en negrita de una spec', () => {
    const spec = [
      '- **CA-12.1** — Dado un calendario...',
      '- **CA-12.2** — Dada la rotación...',
    ].join('\n')

    expect(extraerDeclarados(spec)).toEqual(['CA-12.1', 'CA-12.2'])
  })

  it('acepta identificadores de requisitos transversales', () => {
    expect(extraerDeclarados('- **CA-D.3** — Dado un monto no divisible...')).toEqual(['CA-D.3'])
  })

  it('ignora las menciones que no son declaraciones', () => {
    expect(extraerDeclarados('Ver CA-12.1 en la otra spec.')).toEqual([])
  })
})

describe('extraerProbados', () => {
  it('toma los CA citados por el nombre de un test', () => {
    const test = `it('CA-12.1 · reparte el cupo', () => {})`

    expect(extraerProbados(test)).toEqual(['CA-12.1'])
  })

  it('no repite un CA citado varias veces', () => {
    const test = `describe('CA-D.2', () => { it('CA-D.2 suma exacta', () => {}) })`

    expect(extraerProbados(test)).toEqual(['CA-D.2'])
  })
})

describe('extraerExigidos', () => {
  it('solo exige los CA de tareas marcadas como hechas', () => {
    const tasks = [
      '- [x] **T-010 · Tipo de dinero** — `TR-02`',
      '  Hecho cuando: pasan `CA-D.1` y `CA-D.2`.',
      '- [ ] **T-011 · Prorrateo** — `TR-02`',
      '  Hecho cuando: pasan `CA-D.3`.',
    ].join('\n')

    expect(extraerExigidos(tasks)).toEqual(['CA-D.1', 'CA-D.2'])
  })

  it('devuelve vacío cuando ninguna tarea está hecha', () => {
    const tasks = '- [ ] **T-001 · Algo**\n  Hecho cuando: pasan `CA-1.1`.'

    expect(extraerExigidos(tasks)).toEqual([])
  })

  it('no exige nada por una tarea hecha que no promete ningún CA', () => {
    const tasks = '- [x] **T-001 · Bootstrap**\n  Hecho cuando: `pnpm dev` levanta.'

    expect(extraerExigidos(tasks)).toEqual([])
  })
})

describe('cruzar', () => {
  it('reporta como pendiente todo CA declarado sin test', () => {
    const informe = cruzar(['CA-1.1', 'CA-1.2'], ['CA-1.1'], [])

    expect(informe.declarados).toBe(2)
    expect(informe.probados).toBe(1)
    expect(informe.sinPrueba).toEqual(['CA-1.2'])
  })

  it('falla solo cuando un CA exigido por una tarea hecha no tiene test', () => {
    const informe = cruzar(['CA-1.1', 'CA-1.2'], ['CA-1.1'], ['CA-1.2'])

    expect(informe.incumplidos).toEqual(['CA-1.2'])
    expect(informe.pasa).toBe(false)
  })

  it('pasa cuando todo lo exigido está probado, aunque falte lo no empezado', () => {
    const informe = cruzar(['CA-1.1', 'CA-1.2'], ['CA-1.1'], ['CA-1.1'])

    expect(informe.incumplidos).toEqual([])
    expect(informe.pasa).toBe(true)
    expect(informe.sinPrueba).toEqual(['CA-1.2'])
  })

  it('delata un test que cita un CA que ninguna spec declara', () => {
    const informe = cruzar(['CA-1.1'], ['CA-1.1', 'CA-9.9'], [])

    expect(informe.huerfanos).toEqual(['CA-9.9'])
    expect(informe.pasa).toBe(false)
  })
})

describe('extraerProbados · solo cuentan los títulos de test', () => {
  it('ignora un CA mencionado en un comentario', () => {
    expect(extraerProbados('// pendiente: cubrir CA-7.7 más adelante')).toEqual([])
  })

  it('ignora un CA mencionado en el cuerpo del test', () => {
    const test = `it('reparte el cupo', () => { const nota = 'CA-7.7' })`

    expect(extraerProbados(test)).toEqual([])
  })
})

describe('extraerProbadosSql', () => {
  it('toma los CA citados en la descripción de una aserción pgTAP', () => {
    const sql = `select is(
      (select count(*) from public.audit_log),
      1::bigint,
      'CA-A.1 · una operación produce exactamente una entrada');`

    expect(extraerProbadosSql(sql)).toEqual(['CA-A.1'])
  })

  it('reconoce varias aserciones en el mismo archivo, sin repetir', () => {
    const sql = [
      `select ok(true, 'CA-A.2 · nadie actualiza');`,
      `select ok(true, 'CA-A.2 · nadie borra');`,
      `select ok(true, 'CA-A.5 · el administrador solo ve lo suyo');`,
    ].join('\n')

    expect(extraerProbadosSql(sql)).toEqual(['CA-A.2', 'CA-A.5'])
  })

  it('ignora un CA que aparece solo en un comentario', () => {
    expect(extraerProbadosSql('-- pendiente: cubrir CA-A.7 cuando exista')).toEqual([])
  })
})
