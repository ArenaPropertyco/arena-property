import { describe, expect, it } from 'vitest'
import { parsearCsv, serializarCsv } from '#shared/finance/csv'

/**
 * HU-25 · RF-25.2 · DT-11 — la serialización CSV es una función pura propia.
 *
 * Sigue RFC 4180: campos separados por coma, líneas por CRLF, y se entrecomilla
 * solo lo que lo necesita —comas, comillas, saltos de línea—, doblando las
 * comillas internas. El parser es el espejo exacto, así que la ida y vuelta
 * devuelve el mismo dato (CA-25.5).
 */

describe('RF-25.2 · serializar', () => {
  it('escribe la cabecera y una línea por fila, separadas por CRLF', () => {
    const csv = serializarCsv(['a', 'b'], [['1', '2'], ['3', '4']])
    expect(csv).toBe('a,b\r\n1,2\r\n3,4')
  })

  it('un valor sin caracteres especiales no se entrecomilla', () => {
    expect(serializarCsv(['n'], [['Mantenimiento']])).toBe('n\r\nMantenimiento')
  })

  it('los números y los nulos se escriben como texto plano; un nulo es campo vacío', () => {
    expect(serializarCsv(['total', 'medio'], [[800000, null]])).toBe('total,medio\r\n800000,')
  })

  it('CA-25.5 · una coma, una comilla o un salto de línea obligan a entrecomillar y a doblar las comillas', () => {
    expect(serializarCsv(['v'], [['Renta, terceros']])).toBe('v\r\n"Renta, terceros"')
    expect(serializarCsv(['v'], [['Dice "hola"']])).toBe('v\r\n"Dice ""hola"""')
    expect(serializarCsv(['v'], [['línea 1\nlínea 2']])).toBe('v\r\n"línea 1\nlínea 2"')
    expect(serializarCsv(['v'], [['con\r\nretorno']])).toBe('v\r\n"con\r\nretorno"')
  })
})

describe('CA-25.5 · parsear es el espejo de serializar', () => {
  it('un CSV simple vuelve a sus filas', () => {
    expect(parsearCsv('a,b\r\n1,2\r\n3,4')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })

  it('acepta LF solo y un salto final sin producir una fila vacía', () => {
    expect(parsearCsv('a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('CA-25.5 · los valores con coma, comilla y salto de línea vuelven idénticos (ida y vuelta)', () => {
    const filas = [
      ['Renta, terceros', 'Dice "hola"', 'línea 1\nlínea 2'],
      ['', 'sola', 'fin'],
    ]
    const csv = serializarCsv(['a', 'b', 'c'], filas)
    expect(parsearCsv(csv)).toEqual([['a', 'b', 'c'], ...filas])
  })

  it('un campo vacío entre comas y un campo vacío al final se conservan', () => {
    expect(parsearCsv('a,,c\r\n1,2,')).toEqual([['a', '', 'c'], ['1', '2', '']])
  })
})
