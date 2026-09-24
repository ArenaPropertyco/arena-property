/**
 * HU-25 · RF-25.2 · DT-11 — serialización CSV propia.
 *
 * Veinte líneas de lógica no justifican una dependencia: se sigue RFC 4180 y se
 * prueba la ida y vuelta (CA-25.5). Campos separados por coma, líneas por CRLF,
 * y se entrecomilla solo lo que lo necesita —coma, comilla, salto de línea—,
 * doblando las comillas internas. El parser es el espejo exacto del serializador,
 * para que lo exportado vuelva a leerse como el mismo dato.
 */

export type ValorCsv = string | number | null

const SEPARADOR = ','
const FIN_DE_LINEA = '\r\n'

/** Un campo se entrecomilla si lleva coma, comilla, salto de línea o retorno de carro. */
function campo(valor: ValorCsv): string {
  const texto = valor === null ? '' : String(valor)
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** RF-25.2 · cabecera y filas a texto CSV; sin salto de línea final. */
export function serializarCsv(cabecera: readonly string[], filas: readonly (readonly ValorCsv[])[]): string {
  return [cabecera, ...filas].map(fila => fila.map(campo).join(SEPARADOR)).join(FIN_DE_LINEA)
}

/**
 * CA-25.5 · el espejo de `serializarCsv`: acepta CRLF o LF y un salto final sin
 * producir una fila vacía. Es un autómata de tres estados: fuera de comillas,
 * dentro de comillas y «acabo de ver una comilla dentro de comillas».
 */
export function parsearCsv(texto: string): string[][] {
  const filas: string[][] = []
  let fila: string[] = []
  let actual = ''
  let entreComillas = false

  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto[i]!
    if (entreComillas) {
      if (caracter === '"') {
        if (texto[i + 1] === '"') {
          actual += '"'
          i += 1
        }
        else {
          entreComillas = false
        }
      }
      else {
        actual += caracter
      }
      continue
    }
    if (caracter === '"') {
      entreComillas = true
    }
    else if (caracter === SEPARADOR) {
      fila.push(actual)
      actual = ''
    }
    else if (caracter === '\r' || caracter === '\n') {
      if (caracter === '\r' && texto[i + 1] === '\n') {
        i += 1
      }
      fila.push(actual)
      filas.push(fila)
      fila = []
      actual = ''
    }
    else {
      actual += caracter
    }
  }

  // La última fila no lleva salto final; si el texto terminó en salto, no hay fila pendiente.
  if (actual !== '' || fila.length > 0) {
    fila.push(actual)
    filas.push(fila)
  }
  return filas
}
